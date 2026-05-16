//go:build windows

package downloader

import (
	"os"
	"strings"

	"golang.org/x/sys/windows/registry"
)

// ReadSystemProxy reads the Windows system proxy from the registry.
// Falls back to HTTP_PROXY / HTTPS_PROXY env vars.
func ReadSystemProxy() string {
	// Env vars take priority (set by proxy clients like Clash/V2Ray in TUN mode)
	for _, k := range []string{"HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY",
		"https_proxy", "http_proxy", "all_proxy"} {
		if v := os.Getenv(k); v != "" {
			return v
		}
	}

	// Read Windows Internet Settings registry key
	key, err := registry.OpenKey(
		registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Internet Settings`,
		registry.QUERY_VALUE,
	)
	if err != nil {
		return ""
	}
	defer key.Close()

	enabled, _, err := key.GetIntegerValue("ProxyEnable")
	if err != nil || enabled == 0 {
		return ""
	}

	server, _, err := key.GetStringValue("ProxyServer")
	if err != nil || server == "" {
		return ""
	}

	return parseProxyServer(server)
}

// parseProxyServer converts Windows proxy server string to a URL.
// Windows format: "host:port" or "http=h:p;https=h:p;ftp=f:p;socks=s:p"
func parseProxyServer(server string) string {
	if !strings.Contains(server, "=") {
		// Simple "host:port" — apply to all protocols
		if !strings.Contains(server, "://") {
			return "http://" + server
		}
		return server
	}

	// Protocol-specific: prefer https, then http
	for _, part := range strings.Split(server, ";") {
		part = strings.TrimSpace(part)
		for _, prefix := range []string{"https=", "http="} {
			if strings.HasPrefix(part, prefix) {
				addr := strings.TrimPrefix(part, prefix)
				if !strings.Contains(addr, "://") {
					addr = "http://" + addr
				}
				return addr
			}
		}
	}
	return ""
}
