// 扩展 React CSSProperties，支持 Tauri 拖拽区域 CSS 属性
import 'react'

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

// 编译时由 Vite define 注入 package.json 的 version。
// 由于本文件用了 import 'react' 成为 module,declare const 需放进 declare global。
declare global {
  const __APP_VERSION__: string
}
