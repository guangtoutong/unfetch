package downloader

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// HLSKey 描述 #EXT-X-KEY
type HLSKey struct {
	Method string // NONE / AES-128
	URI    string // 绝对或已解析的密钥 URL
	IV     []byte // 显式 16 字节 IV；为空时使用 sequence number
}

// HLSSegment 描述单个切片
type HLSSegment struct {
	Index      int
	SeqNum     uint64
	URI        string
	Duration   float64
	Key        *HLSKey
	HasRange   bool
	RangeStart int64
	RangeLen   int64
}

// HLSMediaPlaylist 解析后的媒体播放列表
type HLSMediaPlaylist struct {
	InitSegment   *HLSSegment
	Segments      []HLSSegment
	TotalDuration float64
}

// HLSVariant 描述 Master Playlist 中的一个清晰度变体
type HLSVariant struct {
	URI        string
	Bandwidth  int64
	Width      int
	Height     int
	Resolution string
}

// ParseHLSMasterOrMedia 解析 m3u8 文本：
// - 若是 Master Playlist（包含 #EXT-X-STREAM-INF），返回 variants 列表
// - 若是 Media Playlist（包含 #EXTINF），返回 HLSMediaPlaylist
func ParseHLSMasterOrMedia(baseURL string, content string) ([]HLSVariant, *HLSMediaPlaylist, error) {
	base, err := url.Parse(baseURL)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid base url: %w", err)
	}

	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	isMaster := false
	for _, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), "#EXT-X-STREAM-INF:") {
			isMaster = true
			break
		}
	}

	if isMaster {
		var variants []HLSVariant
		for i := 0; i < len(lines); i++ {
			line := strings.TrimSpace(lines[i])
			if !strings.HasPrefix(line, "#EXT-X-STREAM-INF:") {
				continue
			}
			attrs := parseHLSAttributes(strings.TrimPrefix(line, "#EXT-X-STREAM-INF:"))
			var bw int64
			if v, ok := attrs["BANDWIDTH"]; ok {
				bw, _ = strconv.ParseInt(v, 10, 64)
			} else if v, ok := attrs["AVERAGE-BANDWIDTH"]; ok {
				bw, _ = strconv.ParseInt(v, 10, 64)
			}
			var w, h int
			res := attrs["RESOLUTION"]
			if res != "" {
				parts := strings.SplitN(strings.ToLower(res), "x", 2)
				if len(parts) == 2 {
					w, _ = strconv.Atoi(parts[0])
					h, _ = strconv.Atoi(parts[1])
				}
			}
			for j := i + 1; j < len(lines); j++ {
				u := strings.TrimSpace(lines[j])
				if u == "" || strings.HasPrefix(u, "#") {
					continue
				}
				variants = append(variants, HLSVariant{
					URI:        resolveHLSURI(base, u),
					Bandwidth:  bw,
					Width:      w,
					Height:     h,
					Resolution: res,
				})
				i = j
				break
			}
		}
		if len(variants) == 0 {
			return nil, nil, fmt.Errorf("master playlist contains no variants")
		}
		return variants, nil, nil
	}

	// Media Playlist
	media := &HLSMediaPlaylist{}
	var seqNum uint64 = 0
	var currentKey *HLSKey
	var pendingDur float64
	var pendingRange bool
	var rangeStart, rangeLen, lastRangeEnd int64

	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "#EXT-X-MEDIA-SEQUENCE:") {
			val := strings.TrimSpace(strings.TrimPrefix(line, "#EXT-X-MEDIA-SEQUENCE:"))
			if v, err := strconv.ParseUint(val, 10, 64); err == nil {
				seqNum = v
			}
			continue
		}
		if strings.HasPrefix(line, "#EXT-X-KEY:") {
			attrs := parseHLSAttributes(strings.TrimPrefix(line, "#EXT-X-KEY:"))
			method := strings.ToUpper(attrs["METHOD"])
			if method == "" || method == "NONE" {
				currentKey = nil
			} else {
				var iv []byte
				if ivHex, ok := attrs["IV"]; ok {
					ivHex = strings.TrimPrefix(strings.TrimPrefix(ivHex, "0x"), "0X")
					if len(ivHex)%2 == 1 {
						ivHex = "0" + ivHex
					}
					if decoded, err := hex.DecodeString(ivHex); err == nil {
						if len(decoded) < 16 {
							padded := make([]byte, 16)
							copy(padded[16-len(decoded):], decoded)
							iv = padded
						} else {
							iv = decoded[:16]
						}
					}
				}
				currentKey = &HLSKey{
					Method: method,
					URI:    resolveHLSURI(base, attrs["URI"]),
					IV:     iv,
				}
			}
			continue
		}
		if strings.HasPrefix(line, "#EXT-X-MAP:") {
			attrs := parseHLSAttributes(strings.TrimPrefix(line, "#EXT-X-MAP:"))
			mapURI := attrs["URI"]
			if mapURI != "" {
				initSeg := &HLSSegment{
					Index: -1,
					URI:   resolveHLSURI(base, mapURI),
					Key:   currentKey,
				}
				if br, ok := attrs["BYTERANGE"]; ok {
					l, s, hasS := parseByteRange(br, 0)
					initSeg.HasRange = true
					initSeg.RangeLen = l
					if hasS {
						initSeg.RangeStart = s
					}
				}
				media.InitSegment = initSeg
			}
			continue
		}
		if strings.HasPrefix(line, "#EXT-X-BYTERANGE:") {
			br := strings.TrimSpace(strings.TrimPrefix(line, "#EXT-X-BYTERANGE:"))
			l, s, hasS := parseByteRange(br, lastRangeEnd)
			pendingRange = true
			rangeLen = l
			rangeStart = s
			_ = hasS
			lastRangeEnd = rangeStart + rangeLen
			continue
		}
		if strings.HasPrefix(line, "#EXTINF:") {
			rest := strings.TrimPrefix(line, "#EXTINF:")
			if comma := strings.IndexByte(rest, ','); comma >= 0 {
				rest = rest[:comma]
			}
			pendingDur, _ = strconv.ParseFloat(strings.TrimSpace(rest), 64)
			continue
		}
		if strings.HasPrefix(line, "#") {
			continue
		}

		idx := len(media.Segments)
		seg := HLSSegment{
			Index:    idx,
			SeqNum:   seqNum + uint64(idx),
			URI:      resolveHLSURI(base, line),
			Duration: pendingDur,
			Key:      currentKey,
		}
		if pendingRange {
			seg.HasRange = true
			seg.RangeStart = rangeStart
			seg.RangeLen = rangeLen
			pendingRange = false
		}
		media.TotalDuration += pendingDur
		pendingDur = 0
		media.Segments = append(media.Segments, seg)
	}

	if len(media.Segments) == 0 {
		return nil, nil, fmt.Errorf("media playlist contains no segments")
	}
	return nil, media, nil
}

// SelectHLSVariant 根据 quality（best / 1080p / 720p / 480p）选择最匹配的清晰度变体
func SelectHLSVariant(variants []HLSVariant, quality string) HLSVariant {
	if len(variants) == 0 {
		return HLSVariant{}
	}
	q := strings.ToLower(strings.TrimSpace(quality))
	targetHeight := 0
	switch q {
	case "1080p":
		targetHeight = 1080
	case "720p":
		targetHeight = 720
	case "480p":
		targetHeight = 480
	}

	if targetHeight > 0 {
		var bestMatch *HLSVariant
		for i := range variants {
			v := &variants[i]
			if v.Height > 0 && v.Height <= targetHeight {
				if bestMatch == nil || v.Height > bestMatch.Height || (v.Height == bestMatch.Height && v.Bandwidth > bestMatch.Bandwidth) {
					bestMatch = v
				}
			}
		}
		if bestMatch != nil {
			return *bestMatch
		}
	}

	best := variants[0]
	for _, v := range variants[1:] {
		if v.Bandwidth > best.Bandwidth || (v.Bandwidth == best.Bandwidth && v.Height > best.Height) {
			best = v
		}
	}
	return best
}

// DecryptAES128CBC 解密 HLS AES-128 CBC 切片并移除 PKCS#7 填充
func DecryptAES128CBC(ciphertext, key, iv []byte, seqNum uint64) ([]byte, error) {
	if len(key) != 16 {
		return nil, fmt.Errorf("invalid AES-128 key length: %d", len(key))
	}
	if len(ciphertext) == 0 || len(ciphertext)%aes.BlockSize != 0 {
		return nil, fmt.Errorf("ciphertext length (%d) is not a multiple of AES block size", len(ciphertext))
	}

	actualIV := make([]byte, 16)
	if len(iv) == 16 {
		copy(actualIV, iv)
	} else {
		binary.BigEndian.PutUint64(actualIV[8:], seqNum)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	plain := make([]byte, len(ciphertext))
	mode := cipher.NewCBCDecrypter(block, actualIV)
	mode.CryptBlocks(plain, ciphertext)

	padLen := int(plain[len(plain)-1])
	if padLen > 0 && padLen <= aes.BlockSize && padLen <= len(plain) {
		validPad := true
		for i := len(plain) - padLen; i < len(plain); i++ {
			if plain[i] != byte(padLen) {
				validPad = false
				break
			}
		}
		if validPad {
			plain = plain[:len(plain)-padLen]
		}
	}
	return plain, nil
}

func parseHLSAttributes(raw string) map[string]string {
	attrs := make(map[string]string)
	var key strings.Builder
	var val strings.Builder
	inQuotes := false
	parsingVal := false

	for i := 0; i < len(raw); i++ {
		ch := raw[i]
		if !parsingVal {
			if ch == '=' {
				parsingVal = true
				val.Reset()
			} else if ch == ',' {
				key.Reset()
			} else {
				key.WriteByte(ch)
			}
		} else {
			if ch == '"' {
				inQuotes = !inQuotes
			} else if ch == ',' && !inQuotes {
				k := strings.ToUpper(strings.TrimSpace(key.String()))
				if k != "" {
					attrs[k] = strings.TrimSpace(val.String())
				}
				key.Reset()
				val.Reset()
				parsingVal = false
			} else {
				val.WriteByte(ch)
			}
		}
	}
	if parsingVal {
		k := strings.ToUpper(strings.TrimSpace(key.String()))
		if k != "" {
			attrs[k] = strings.TrimSpace(val.String())
		}
	}
	return attrs
}

func parseByteRange(br string, defaultStart int64) (length int64, start int64, hasStart bool) {
	br = strings.Trim(br, "\"")
	if at := strings.IndexByte(br, '@'); at >= 0 {
		length, _ = strconv.ParseInt(br[:at], 10, 64)
		start, _ = strconv.ParseInt(br[at+1:], 10, 64)
		return length, start, true
	}
	length, _ = strconv.ParseInt(br, 10, 64)
	return length, defaultStart, false
}

func resolveHLSURI(base *url.URL, ref string) string {
	ref = strings.TrimSpace(strings.Trim(ref, "\""))
	if ref == "" {
		return ""
	}
	u, err := url.Parse(ref)
	if err != nil {
		return ref
	}
	return base.ResolveReference(u).String()
}

func normalizeHLSFilename(filename, rawURL string) string {
	name := strings.TrimSpace(filename)
	if name == "" || name == "unknown" || name == "download" {
		if u, err := url.Parse(rawURL); err == nil {
			base := filepath.Base(u.Path)
			if base != "" && base != "." && base != "/" {
				name = base
			}
		}
	}
	if name == "" || name == "." || name == "/" {
		name = "stream"
	}
	lower := strings.ToLower(name)
	if strings.HasSuffix(lower, ".m3u8") || strings.HasSuffix(lower, ".m3u") {
		extLen := 5
		if strings.HasSuffix(lower, ".m3u") {
			extLen = 4
		}
		stem := name[:len(name)-extLen]
		if stem == "" {
			stem = "stream"
		}
		if _, err := exec.LookPath("ffmpeg"); err == nil {
			return stem + ".mp4"
		}
		return stem + ".ts"
	}
	if filepath.Ext(name) == "" {
		if _, err := exec.LookPath("ffmpeg"); err == nil {
			return name + ".mp4"
		}
		return name + ".ts"
	}
	return name
}

func isMPEGTSFile(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()
	var b [1]byte
	if _, err := f.Read(b[:]); err != nil {
		return false
	}
	return b[0] == 0x47
}
