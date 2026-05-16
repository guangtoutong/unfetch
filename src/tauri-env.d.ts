// 扩展 React CSSProperties，支持 Tauri 拖拽区域 CSS 属性
import 'react'

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}
