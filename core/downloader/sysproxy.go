//go:build !windows

package downloader

import "os"

// ReadSystemProxy returns the system-level proxy URL, or "" if none is configured.
func ReadSystemProxy() string {
	for _, k := range []string{"HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY",
		"https_proxy", "http_proxy", "all_proxy"} {
		if v := os.Getenv(k); v != "" {
			return v
		}
	}
	return ""
}
