package downloader

import (
	"encoding/xml"
	"fmt"
	"math"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

// IsDASHManifest 判断 URL 或响应内容是否为 MPEG-DASH (.mpd) 清单
func IsDASHManifest(rawURL string, content string) bool {
	u := strings.ToLower(strings.TrimSpace(rawURL))
	pathOnly := strings.Split(strings.Split(u, "?")[0], "#")[0]
	if strings.HasSuffix(pathOnly, ".mpd") {
		return true
	}
	trimmed := strings.TrimSpace(content)
	return strings.Contains(trimmed, "<MPD") && strings.Contains(trimmed, "</MPD>")
}

type mpdDocument struct {
	XMLName                   xml.Name    `xml:"MPD"`
	MediaPresentationDuration string      `xml:"mediaPresentationDuration,attr"`
	BaseURL                   string      `xml:"BaseURL"`
	Periods                   []mpdPeriod `xml:"Period"`
}

type mpdPeriod struct {
	Duration       string             `xml:"duration,attr"`
	BaseURL        string             `xml:"BaseURL"`
	AdaptationSets []mpdAdaptationSet `xml:"AdaptationSet"`
}

type mpdAdaptationSet struct {
	MimeType        string              `xml:"mimeType,attr"`
	ContentType     string              `xml:"contentType,attr"`
	BaseURL         string              `xml:"BaseURL"`
	SegmentTemplate *mpdSegmentTemplate `xml:"SegmentTemplate"`
	SegmentList     *mpdSegmentList     `xml:"SegmentList"`
	Representations []mpdRepresentation `xml:"Representation"`
}

type mpdRepresentation struct {
	ID              string              `xml:"id,attr"`
	MimeType        string              `xml:"mimeType,attr"`
	Bandwidth       int64               `xml:"bandwidth,attr"`
	Width           int                 `xml:"width,attr"`
	Height          int                 `xml:"height,attr"`
	BaseURL         string              `xml:"BaseURL"`
	SegmentTemplate *mpdSegmentTemplate `xml:"SegmentTemplate"`
	SegmentList     *mpdSegmentList     `xml:"SegmentList"`
}

type mpdSegmentTemplate struct {
	Timescale      int64               `xml:"timescale,attr"`
	Duration       int64               `xml:"duration,attr"`
	StartNumber    int64               `xml:"startNumber,attr"`
	Initialization string              `xml:"initialization,attr"`
	Media          string              `xml:"media,attr"`
	Timeline       *mpdSegmentTimeline `xml:"SegmentTimeline"`
}

type mpdSegmentTimeline struct {
	S []mpdTimelineS `xml:"S"`
}

type mpdTimelineS struct {
	T *int64 `xml:"t,attr"`
	D int64  `xml:"d,attr"`
	R int64  `xml:"r,attr"`
}

type mpdSegmentList struct {
	Timescale      int64   `xml:"timescale,attr"`
	Duration       int64   `xml:"duration,attr"`
	Initialization mpdInit `xml:"Initialization"`
	SegmentURLs    []struct {
		Media string `xml:"media,attr"`
	} `xml:"SegmentURL"`
}

type mpdInit struct {
	SourceURL string `xml:"sourceURL,attr"`
}

// ParseDASHManifest 解析 MPEG-DASH (.mpd) 清单并转换为 HLSMediaPlaylist，复用多线程分片下载与合并管线
func ParseDASHManifest(baseURL string, xmlText string, quality string) (*HLSMediaPlaylist, error) {
	var doc mpdDocument
	if err := xml.Unmarshal([]byte(xmlText), &doc); err != nil {
		return nil, fmt.Errorf("parse DASH MPD xml: %w", err)
	}
	if len(doc.Periods) == 0 {
		return nil, fmt.Errorf("DASH MPD has no <Period>")
	}

	rootBase, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid base url: %w", err)
	}
	if strings.TrimSpace(doc.BaseURL) != "" {
		if u, err := url.Parse(resolveHLSURI(rootBase, strings.TrimSpace(doc.BaseURL))); err == nil {
			rootBase = u
		}
	}

	period := doc.Periods[0]
	if strings.TrimSpace(period.BaseURL) != "" {
		if u, err := url.Parse(resolveHLSURI(rootBase, strings.TrimSpace(period.BaseURL))); err == nil {
			rootBase = u
		}
	}

	totalDur := parseISO8601Duration(doc.MediaPresentationDuration)
	if totalDur <= 0 {
		totalDur = parseISO8601Duration(period.Duration)
	}

	wantAudioOnly := strings.EqualFold(strings.TrimSpace(quality), "audio")
	targetHeight := 0
	switch strings.ToLower(strings.TrimSpace(quality)) {
	case "1080p", "1080":
		targetHeight = 1080
	case "720p", "720":
		targetHeight = 720
	case "480p", "480":
		targetHeight = 480
	}

	type candidate struct {
		as  mpdAdaptationSet
		rep mpdRepresentation
	}
	var candidates []candidate
	for _, as := range period.AdaptationSets {
		for _, rep := range as.Representations {
			mime := strings.ToLower(rep.MimeType + " " + as.MimeType + " " + as.ContentType)
			isAudio := strings.Contains(mime, "audio")
			isVideo := strings.Contains(mime, "video") || rep.Height > 0 || rep.Width > 0
			if wantAudioOnly && isAudio {
				candidates = append(candidates, candidate{as: as, rep: rep})
			} else if !wantAudioOnly && isVideo {
				candidates = append(candidates, candidate{as: as, rep: rep})
			}
		}
	}
	// 回退：如果没匹配到特定类型，收集全部 Representation
	if len(candidates) == 0 {
		for _, as := range period.AdaptationSets {
			for _, rep := range as.Representations {
				candidates = append(candidates, candidate{as: as, rep: rep})
			}
		}
	}
	if len(candidates) == 0 {
		return nil, fmt.Errorf("DASH MPD has no <Representation>")
	}

	chosen := candidates[0]
	for _, c := range candidates[1:] {
		if targetHeight > 0 && c.rep.Height > 0 {
			curDiff := absInt(chosen.rep.Height - targetHeight)
			newDiff := absInt(c.rep.Height - targetHeight)
			if newDiff < curDiff || (newDiff == curDiff && c.rep.Bandwidth > chosen.rep.Bandwidth) {
				chosen = c
			}
		} else {
			if c.rep.Height > chosen.rep.Height || (c.rep.Height == chosen.rep.Height && c.rep.Bandwidth > chosen.rep.Bandwidth) {
				chosen = c
			}
		}
	}

	repBase := rootBase
	if strings.TrimSpace(chosen.as.BaseURL) != "" {
		if u, err := url.Parse(resolveHLSURI(repBase, strings.TrimSpace(chosen.as.BaseURL))); err == nil {
			repBase = u
		}
	}
	if strings.TrimSpace(chosen.rep.BaseURL) != "" {
		if u, err := url.Parse(resolveHLSURI(repBase, strings.TrimSpace(chosen.rep.BaseURL))); err == nil {
			repBase = u
		}
	}

	playlist := &HLSMediaPlaylist{
		TotalDuration: totalDur,
	}

	// 1. SegmentList 模式
	segList := chosen.rep.SegmentList
	if segList == nil {
		segList = chosen.as.SegmentList
	}
	if segList != nil && len(segList.SegmentURLs) > 0 {
		if segList.Initialization.SourceURL != "" {
			playlist.InitSegment = &HLSSegment{
				Index: -1,
				URI:   resolveHLSURI(repBase, segList.Initialization.SourceURL),
			}
		}
		for i, s := range segList.SegmentURLs {
			if strings.TrimSpace(s.Media) == "" {
				continue
			}
			playlist.Segments = append(playlist.Segments, HLSSegment{
				Index:  i,
				SeqNum: uint64(i + 1),
				URI:    resolveHLSURI(repBase, strings.TrimSpace(s.Media)),
			})
		}
		return playlist, nil
	}

	// 2. SegmentTemplate 模式
	tmpl := chosen.rep.SegmentTemplate
	if tmpl == nil {
		tmpl = chosen.as.SegmentTemplate
	}
	if tmpl != nil && strings.TrimSpace(tmpl.Media) != "" {
		startNum := tmpl.StartNumber
		if startNum <= 0 {
			startNum = 1
		}
		if strings.TrimSpace(tmpl.Initialization) != "" {
			initRel := expandDASHTemplate(tmpl.Initialization, chosen.rep.ID, chosen.rep.Bandwidth, startNum, 0)
			playlist.InitSegment = &HLSSegment{
				Index: -1,
				URI:   resolveHLSURI(repBase, initRel),
			}
		}

		if tmpl.Timeline != nil && len(tmpl.Timeline.S) > 0 {
			var curTime int64
			num := startNum
			idx := 0
			for _, s := range tmpl.Timeline.S {
				if s.T != nil {
					curTime = *s.T
				}
				repeat := s.R
				if repeat < 0 {
					repeat = 0
				}
				for r := int64(0); r <= repeat; r++ {
					mediaRel := expandDASHTemplate(tmpl.Media, chosen.rep.ID, chosen.rep.Bandwidth, num, curTime)
					playlist.Segments = append(playlist.Segments, HLSSegment{
						Index:  idx,
						SeqNum: uint64(num),
						URI:    resolveHLSURI(repBase, mediaRel),
					})
					curTime += s.D
					num++
					idx++
				}
			}
			return playlist, nil
		}

		// duration + timescale 计算总分片数
		timescale := tmpl.Timescale
		if timescale <= 0 {
			timescale = 1
		}
		if tmpl.Duration > 0 && totalDur > 0 {
			segSec := float64(tmpl.Duration) / float64(timescale)
			count := int(math.Ceil(totalDur / segSec))
			if count < 1 {
				count = 1
			}
			if count > 10000 {
				count = 10000
			}
			for i := 0; i < count; i++ {
				num := startNum + int64(i)
				tVal := int64(i) * tmpl.Duration
				mediaRel := expandDASHTemplate(tmpl.Media, chosen.rep.ID, chosen.rep.Bandwidth, num, tVal)
				playlist.Segments = append(playlist.Segments, HLSSegment{
					Index:    i,
					SeqNum:   uint64(num),
					Duration: segSec,
					URI:      resolveHLSURI(repBase, mediaRel),
				})
			}
			return playlist, nil
		}
	}

	// 3. 单文件 BaseURL 模式
	if strings.TrimSpace(chosen.rep.BaseURL) != "" {
		playlist.Segments = append(playlist.Segments, HLSSegment{
			Index:  0,
			SeqNum: 1,
			URI:    repBase.String(),
		})
		return playlist, nil
	}

	return nil, fmt.Errorf("unsupported DASH MPD structure (no SegmentTemplate, SegmentList, or BaseURL)")
}

var dashFmtVarRegex = regexp.MustCompile(`\$(Number|Time|Bandwidth)(%[0-9]+d)?\$`)

func expandDASHTemplate(tpl string, repID string, bandwidth int64, number int64, timeVal int64) string {
	out := strings.ReplaceAll(tpl, "$$", "\x00")
	out = strings.ReplaceAll(out, "$RepresentationID$", repID)
	out = dashFmtVarRegex.ReplaceAllStringFunc(out, func(match string) string {
		sub := dashFmtVarRegex.FindStringSubmatch(match)
		if len(sub) < 2 {
			return match
		}
		var val int64
		switch sub[1] {
		case "Number":
			val = number
		case "Time":
			val = timeVal
		case "Bandwidth":
			val = bandwidth
		}
		if len(sub) >= 3 && sub[2] != "" {
			return fmt.Sprintf(sub[2], val)
		}
		return strconv.FormatInt(val, 10)
	})
	return strings.ReplaceAll(out, "\x00", "$")
}

var iso8601DurRegex = regexp.MustCompile(`^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$`)

func parseISO8601Duration(raw string) float64 {
	raw = strings.ToUpper(strings.TrimSpace(raw))
	m := iso8601DurRegex.FindStringSubmatch(raw)
	if len(m) == 0 {
		return 0
	}
	var total float64
	if m[1] != "" {
		if h, err := strconv.ParseFloat(m[1], 64); err == nil {
			total += h * 3600
		}
	}
	if m[2] != "" {
		if min, err := strconv.ParseFloat(m[2], 64); err == nil {
			total += min * 60
		}
	}
	if m[3] != "" {
		if s, err := strconv.ParseFloat(m[3], 64); err == nil {
			total += s
		}
	}
	return total
}

func absInt(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
