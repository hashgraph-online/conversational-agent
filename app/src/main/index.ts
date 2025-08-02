import { app, BrowserWindow, shell, ipcMain } from 'electron'
import path from 'path'
import { setupIPCHandlers } from './ipc/handlers'
import started from 'electron-squirrel-startup'
import { testConfigService } from './test-config'
import { Logger } from '@hashgraphonline/standards-sdk'

if (started) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
const logger = new Logger({ module: 'MainProcess' })

function createWindow() {
  logger.info('Creating main window...')
  logger.info('Preload path:', path.join(__dirname, 'preload.js'))
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: true,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      nodeIntegrationInWorker: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })
  
  mainWindow.show()
  mainWindow.focus()

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    logger.info('Loading dev server URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL)
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    logger.info('Loading file:', indexPath)
    mainWindow.loadFile(indexPath)
  }
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error('Failed to load:', errorCode, errorDescription)
  })
  
  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('Page finished loading')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
  
  ipcMain.on('window-control', (event, action) => {
    if (!mainWindow) return
    
    switch (action) {
      case 'minimize':
        mainWindow.minimize()
        break
      case 'maximize':
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize()
        } else {
          mainWindow.maximize()
        }
        break
      case 'close':
        mainWindow.close()
        break
    }
  })
}

app.on('ready', async () => {
  logger.info('App ready, initializing...')
  
  
  const masterPassword = process.env.MASTER_PASSWORD || 'default-secure-password-change-me'
  setupIPCHandlers(masterPassword)
  logger.info('IPC handlers setup complete')
  
  createWindow()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event) => {
    event.preventDefault()
  })
})