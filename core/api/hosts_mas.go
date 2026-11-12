//go:build masbuild

package api

// videoHostnames 在 Mac App Store 版中置空，避免二进制中包含第三方视频平台域名字符串。
var videoHostnames []string
