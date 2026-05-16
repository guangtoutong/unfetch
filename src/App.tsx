import React, { useState, useEffect } from 'react'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { TaskList } from './components/TaskList'
import { StatusBar } from './components/StatusBar'
import { AddTaskDialog } from './components/AddTaskDialog'
import { SettingsPanel } from './components/SettingsPanel'
import { ClipboardPrompt } from './components/ClipboardPrompt'
import { DropOverlay } from './components/DropOverlay'
import { AdBanner } from './components/AdBanner'
import { useTaskStore } from './stores/taskStore'
import { useSettingsStore } from './stores/settingsStore'

const App: React.FC = () => {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const { startPolling, stopPolling } = useTaskStore()
  const { loadConfig } = useSettingsStore()

  useEffect(() => {
    // 初始化：加载配置并开始轮询
    loadConfig()
    startPolling()

    // 窗口加载完成后显示（避免白屏）
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('show_window').catch(() => {})
    }).catch(() => {})

    return () => {
      stopPolling()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
        overflow: 'hidden',
      }}
    >
      {/* 标题栏 */}
      <TitleBar />

      {/* 主体 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 侧边栏 */}
        <Sidebar />

        {/* 右侧内容区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* 工具栏 */}
          <Toolbar onAdd={() => setAddDialogOpen(true)} />

          {/* 任务列表 */}
          <TaskList />

          {/* 推荐位（可远程配置） */}
          <AdBanner />
        </div>
      </div>

      {/* 状态栏 */}
      <StatusBar />

      {/* 添加任务弹窗 */}
      <AddTaskDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
      />

      {/* 设置面板 */}
      <SettingsPanel />

      {/* 剪贴板嗅探提示 */}
      <ClipboardPrompt />

      {/* 拖拽下载提示 */}
      <DropOverlay />
    </div>
  )
}

export default App
