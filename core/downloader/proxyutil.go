package downloader

import (
	"net/url"

	"golang.org/x/net/proxy"

	"unfetch/core/types"
)

// 代理解析 / 拨号器构建：被 http.go（始终编译）与 bt.go/ytdlp.go（仅非 MAS 版）
// 共用。必须放在不带 build tag 的文件里，否则 masbuild 下 http.go 会因为找不到
// buildSOCKS5Dialer 编译失败。

// resolveProxy returns the effective proxy for a task: task-level > config-level > system proxy.
func resolveProxy(taskProxy string, cfg *types.Config) string {
	if taskProxy != "" {
		return taskProxy
	}
	if cfg.Proxy != "" {
		return cfg.Proxy
	}
	if cfg.UseSystemProxy {
		return ReadSystemProxy()
	}
	return ""
}

// buildSOCKS5Dialer 从 socks5:// URL 构建代理拨号器
func buildSOCKS5Dialer(proxyURL *url.URL) (proxy.Dialer, error) {
	var auth *proxy.Auth
	if proxyURL.User != nil {
		password, _ := proxyURL.User.Password()
		auth = &proxy.Auth{
			User:     proxyURL.User.Username(),
			Password: password,
		}
	}
	return proxy.SOCKS5("tcp", proxyURL.Host, auth, proxy.Direct)
}
