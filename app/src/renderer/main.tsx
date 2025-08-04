import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { initializeRendererLogger } from './utils/logger-init'

// Initialize electron-log for the renderer process
initializeRendererLogger()

try {
  const root = document.getElementById('root')
  
  if (!root) {
    throw new Error('Root element not found')
  }
  
  const reactRoot = ReactDOM.createRoot(root)
  
  reactRoot.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (error) {
}