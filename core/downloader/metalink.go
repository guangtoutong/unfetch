package downloader

import (
	"encoding/xml"
	"fmt"
	"sort"
	"strings"
)

// MetalinkResult 解析 .meta4 / .metalink 得到的下载源与校验信息
type MetalinkResult struct {
	Filename string
	Size     int64
	SHA256   string
	MD5      string
	URLs     []string // 按优先级排序的 HTTP/HTTPS 镜像 URL
}

// IsMetalinkURL 判断 URL 是否指向 .meta4 或 .metalink 清单
func IsMetalinkURL(rawURL string) bool {
	u := strings.ToLower(strings.TrimSpace(rawURL))
	pathOnly := strings.Split(strings.Split(u, "?")[0], "#")[0]
	return strings.HasSuffix(pathOnly, ".meta4") || strings.HasSuffix(pathOnly, ".metalink")
}

// ParseMetalink 解析 Metalink v4 (RFC 5854) 或 Metalink v3 XML 内容
func ParseMetalink(data []byte) (*MetalinkResult, error) {
	// 兼容 v4 (<metalink><file>...) 与 v3 (<metalink><files><file>...)
	type hashEntry struct {
		Type  string `xml:"type,attr"`
		Value string `xml:",chardata"`
	}
	type urlEntry struct {
		Type     string `xml:"type,attr"`
		Protocol string `xml:"protocol,attr"`
		Location string `xml:"location,attr"`
		Priority int    `xml:"priority,attr"`
		Value    string `xml:",chardata"`
	}
	type fileEntry struct {
		Name   string      `xml:"name,attr"`
		Size   int64       `xml:"size"`
		Hashes []hashEntry `xml:"hash"`
		Verification struct {
			Hashes []hashEntry `xml:"hash"`
		} `xml:"verification"`
		URLs      []urlEntry `xml:"url"`
		Resources struct {
			URLs []urlEntry `xml:"url"`
		} `xml:"resources"`
	}
	type doc struct {
		XMLName xml.Name    `xml:"metalink"`
		FilesV4 []fileEntry `xml:"file"`
		FilesV3 struct {
			Files []fileEntry `xml:"file"`
		} `xml:"files"`
	}

	var parsed doc
	if err := xml.Unmarshal(data, &parsed); err != nil {
		return nil, fmt.Errorf("parse metalink xml: %w", err)
	}

	files := parsed.FilesV4
	if len(files) == 0 {
		files = parsed.FilesV3.Files
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("metalink contains no <file> entries")
	}

	f := files[0]
	res := &MetalinkResult{
		Filename: strings.TrimSpace(f.Name),
		Size:     f.Size,
	}

	allHashes := append([]hashEntry{}, f.Hashes...)
	allHashes = append(allHashes, f.Verification.Hashes...)
	for _, h := range allHashes {
		t := strings.ToLower(strings.TrimSpace(h.Type))
		v := strings.TrimSpace(h.Value)
		if v == "" {
			continue
		}
		switch t {
		case "sha-256", "sha256":
			if res.SHA256 == "" {
				res.SHA256 = v
			}
		case "md5":
			if res.MD5 == "" {
				res.MD5 = v
			}
		}
	}

	allURLs := append([]urlEntry{}, f.URLs...)
	allURLs = append(allURLs, f.Resources.URLs...)
	sort.SliceStable(allURLs, func(i, j int) bool {
		pi := allURLs[i].Priority
		pj := allURLs[j].Priority
		if pi <= 0 {
			pi = 999999
		}
		if pj <= 0 {
			pj = 999999
		}
		return pi < pj
	})
	seen := make(map[string]bool)
	for _, u := range allURLs {
		val := strings.TrimSpace(u.Value)
		if val == "" {
			continue
		}
		lower := strings.ToLower(val)
		if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
			continue
		}
		if !seen[val] {
			seen[val] = true
			res.URLs = append(res.URLs, val)
		}
	}

	if len(res.URLs) == 0 {
		return nil, fmt.Errorf("metalink contains no HTTP/HTTPS mirror URLs")
	}
	return res, nil
}
