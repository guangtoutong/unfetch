//go:build !masbuild

package types

// AppStoreEdition 标记当前二进制是否为 Mac App Store 阉割版。
// 完整版（官网 / GitHub Release）为 false：支持 HTTP / BT / 磁力 / 视频网站。
const AppStoreEdition = false

// EditionName 用于 /health 等接口对外暴露。
const EditionName = "full"
