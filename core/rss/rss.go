package rss

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"

	"unfetch/core/queue"
	"unfetch/core/types"
)

// rssDoc 兼容 RSS 2.0 / Atom 的最简子集
type rssDoc struct {
	XMLName xml.Name `xml:"rss"`
	Channel struct {
		Items []rssItem `xml:"item"`
	} `xml:"channel"`
}

type rssItem struct {
	Title     string    `xml:"title"`
	Link      string    `xml:"link"`
	GUID      string    `xml:"guid"`
	Enclosure enclosure `xml:"enclosure"`
}

type enclosure struct {
	URL  string `xml:"url,attr"`
	Type string `xml:"type,attr"`
}

// Poller 拉取并去重
type Poller struct {
	mgr       *queue.Manager
	getCfg    func() *types.Config
	seen      map[string]bool // guid/link
	seenFile  string
	seenMu    sync.Mutex
	stopCh    chan struct{}
	httpCli   *http.Client
}

func NewPoller(mgr *queue.Manager, getCfg func() *types.Config) *Poller {
	dir, _ := os.UserHomeDir()
	seenFile := filepath.Join(dir, ".config", "unfetch", "rss-seen.json")
	p := &Poller{
		mgr:      mgr,
		getCfg:   getCfg,
		seen:     make(map[string]bool),
		seenFile: seenFile,
		stopCh:   make(chan struct{}),
		httpCli:  &http.Client{Timeout: 30 * time.Second},
	}
	p.loadSeen()
	return p
}

func (p *Poller) Start(ctx context.Context) {
	go p.run(ctx)
}

func (p *Poller) Stop() {
	close(p.stopCh)
}

func (p *Poller) run(ctx context.Context) {
	// 立刻跑一次，然后每分钟检查一次每个 feed 的间隔
	p.tick(ctx)
	t := time.NewTicker(1 * time.Minute)
	defer t.Stop()
	feedLast := map[string]time.Time{}
	for {
		select {
		case <-ctx.Done():
			return
		case <-p.stopCh:
			return
		case now := <-t.C:
			cfg := p.getCfg()
			for i := range cfg.RSSFeeds {
				f := cfg.RSSFeeds[i]
				if !f.Enabled {
					continue
				}
				interval := time.Duration(f.IntervalMin) * time.Minute
				if interval < 5*time.Minute {
					interval = 15 * time.Minute
				}
				last := feedLast[f.URL]
				if now.Sub(last) < interval {
					continue
				}
				feedLast[f.URL] = now
				if err := p.pollFeed(ctx, &f); err != nil {
					slog.Warn("rss poll failed", "name", f.Name, "url", f.URL, "err", err)
				}
			}
		}
	}
}

func (p *Poller) tick(ctx context.Context) {
	cfg := p.getCfg()
	for i := range cfg.RSSFeeds {
		f := cfg.RSSFeeds[i]
		if !f.Enabled {
			continue
		}
		if err := p.pollFeed(ctx, &f); err != nil {
			slog.Warn("rss poll failed", "name", f.Name, "err", err)
		}
	}
}

func (p *Poller) pollFeed(ctx context.Context, f *types.RSSFeed) error {
	req, err := http.NewRequestWithContext(ctx, "GET", f.URL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "unfetch-rss/1.0")
	resp, err := p.httpCli.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8*1024*1024))
	if err != nil {
		return err
	}
	var doc rssDoc
	if err := xml.Unmarshal(body, &doc); err != nil {
		return fmt.Errorf("xml parse: %w", err)
	}

	var re *regexp.Regexp
	if f.FilterRegex != "" {
		re, err = regexp.Compile(f.FilterRegex)
		if err != nil {
			return fmt.Errorf("bad regex: %w", err)
		}
	}

	added := 0
	for _, it := range doc.Channel.Items {
		key := it.GUID
		if key == "" {
			key = it.Link
		}
		if key == "" {
			continue
		}
		if p.isSeen(key) {
			continue
		}
		if re != nil && !re.MatchString(it.Title) {
			p.markSeen(key)
			continue
		}
		url := it.Enclosure.URL
		if url == "" {
			url = it.Link
		}
		if url == "" {
			continue
		}
		req := types.AddTaskRequest{
			URL:     url,
			SaveDir: f.SaveDir,
			Tags:    f.Tags,
		}
		taskType := types.TaskTypeHTTP
		if isBTLike(url) || it.Enclosure.Type == "application/x-bittorrent" {
			taskType = types.TaskTypeBT
		}
		if _, err := p.mgr.AddTask(req, taskType); err != nil {
			slog.Warn("rss add task failed", "url", url, "err", err)
			continue
		}
		p.markSeen(key)
		added++
		slog.Info("rss task added", "feed", f.Name, "title", it.Title, "url", url)
	}
	if added > 0 {
		p.saveSeen()
	}
	return nil
}

func isBTLike(u string) bool {
	if len(u) >= 8 && u[:8] == "magnet:?" {
		return true
	}
	if len(u) >= 9 && u[len(u)-8:] == ".torrent" {
		return true
	}
	return false
}

func (p *Poller) isSeen(key string) bool {
	p.seenMu.Lock()
	defer p.seenMu.Unlock()
	return p.seen[key]
}

func (p *Poller) markSeen(key string) {
	p.seenMu.Lock()
	defer p.seenMu.Unlock()
	p.seen[key] = true
}

func (p *Poller) loadSeen() {
	data, err := os.ReadFile(p.seenFile)
	if err != nil {
		return
	}
	var keys []string
	if err := json.Unmarshal(data, &keys); err != nil {
		return
	}
	p.seenMu.Lock()
	defer p.seenMu.Unlock()
	for _, k := range keys {
		p.seen[k] = true
	}
}

func (p *Poller) saveSeen() {
	p.seenMu.Lock()
	keys := make([]string, 0, len(p.seen))
	for k := range p.seen {
		keys = append(keys, k)
	}
	p.seenMu.Unlock()
	// 防止无限增长，最多保留 5000 条
	if len(keys) > 5000 {
		keys = keys[len(keys)-5000:]
	}
	data, err := json.Marshal(keys)
	if err != nil {
		return
	}
	_ = os.MkdirAll(filepath.Dir(p.seenFile), 0755)
	_ = os.WriteFile(p.seenFile, data, 0644)
}
