package web

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed all:dist
var distFS embed.FS

// Handler 返回内嵌的 React dist 的 HTTP handler。
// 找不到资源时回退到 index.html（SPA 路由）。
// 如果 dist 目录为空（未在构建前拷贝），返回提示页。
func Handler() http.Handler {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return placeholder()
	}
	// 探测 index.html 是否存在
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return placeholder()
	}

	fileServer := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/")
		if p == "" {
			p = "index.html"
		}
		if _, err := fs.Stat(sub, p); err != nil {
			// SPA fallback
			r2 := r.Clone(r.Context())
			r2.URL.Path = "/"
			fileServer.ServeHTTP(w, r2)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

func placeholder() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<!doctype html><html><body>
<h2>unfetch daemon</h2>
<p>Web UI 未内嵌。请在构建前执行 <code>pnpm build</code> 并将 <code>dist/</code> 拷贝到 <code>core/web/dist/</code>。</p>
</body></html>`))
	})
}
