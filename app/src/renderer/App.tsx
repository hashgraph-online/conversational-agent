import React from 'react'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import MCPPage from './pages/MCPPage'
import SettingsPage from './pages/SettingsPage'
import PluginsPage from './pages/PluginsPage'
import { StoreProvider } from './providers/StoreProvider'
import { KeyboardShortcutsProvider } from './providers/KeyboardShortcutsProvider'
import { MCPInitProvider } from './providers/MCPInitProvider'
import { ConfigInitProvider } from './providers/ConfigInitProvider'
import { NotificationContainer } from './components/notifications/NotificationContainer'
import { ErrorBoundary } from './components/ErrorBoundary'

interface AppProps {}

const App: React.FC<AppProps> = () => {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <Router>
          <ConfigInitProvider>
            <MCPInitProvider>
              <KeyboardShortcutsProvider>
                <Layout>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/chat/:agentId?" element={<ChatPage />} />
                    <Route path="/mcp" element={<MCPPage />} />
                    <Route path="/plugins" element={<PluginsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Routes>
                </Layout>
                <NotificationContainer />
              </KeyboardShortcutsProvider>
            </MCPInitProvider>
          </ConfigInitProvider>
        </Router>
      </StoreProvider>
    </ErrorBoundary>
  )
}

export default App