import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { MiniApp } from './MiniApp'
import './i18n'
import './index.css'

const params = new URLSearchParams(window.location.search)
const isMini = params.get('window') === 'mini'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isMini ? <MiniApp /> : <App />}
  </React.StrictMode>,
)
