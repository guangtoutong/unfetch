//go:build masbuild

package types

// AppStoreEdition 标记当前二进制是否为 Mac App Store 阉割版。
// MAS 版（-tags masbuild）为 true：仅支持 HTTP / HTTPS 直链多线程下载，
// 不支持 BT / 磁力 / 视频网站抓取，以符合 App Store Review Guideline 5.2.3。
const AppStoreEdition = true

// EditionName 用于 /health 等接口对外暴露。
const EditionName = "appstore"
