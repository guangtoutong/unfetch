; unfetch NSIS 安装钩子
; 1. 安装/卸载前杀掉 unfetch 进程，避免文件锁
; 2. 显式注册 magnet:// 协议（不依赖 tauri-plugin-deep-link 自动注册）

!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping running unfetch processes..."
  nsExec::Exec 'taskkill /F /IM unfetch.exe /T'
  nsExec::Exec 'taskkill /F /IM unfetch-daemon.exe /T'
  Sleep 800
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Registering magnet:// protocol handler..."
  ; 写入 HKCU\Software\Classes（per-user，无需管理员）
  WriteRegStr HKCU "Software\Classes\magnet" "" "URL:magnet Protocol"
  WriteRegStr HKCU "Software\Classes\magnet" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\magnet\DefaultIcon" "" "$INSTDIR\unfetch.exe,0"
  WriteRegStr HKCU "Software\Classes\magnet\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\magnet\shell\open\command" "" '"$INSTDIR\unfetch.exe" "%1"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping running unfetch processes..."
  nsExec::Exec 'taskkill /F /IM unfetch.exe /T'
  nsExec::Exec 'taskkill /F /IM unfetch-daemon.exe /T'
  Sleep 800
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\magnet"
!macroend
