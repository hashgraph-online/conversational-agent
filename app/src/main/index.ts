import './init-logger'
import { app, BrowserWindow, shell, ipcMain, nativeImage } from 'electron'
import path from 'path'
import started from 'electron-squirrel-startup'
import electronLog from 'electron-log'

// Configure electron-log for the main process immediately
electronLog.transports.file.level = 'info'
electronLog.transports.console.level = 'info'

if (started) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let logger: any

function createWindow() {
  logger.info('Creating main window...')
  logger.info('Preload path:', path.join(__dirname, 'preload.js'))
  
  // Load icon properly for macOS
  // In development, __dirname is .vite/build, so we need to go up 2 levels to app/ then into assets/
  const iconPath = app.isPackaged 
    ? path.join(__dirname, '../../assets/hol-app-icon-bubble.png')
    : path.join(__dirname, '../../assets/hol-app-icon-bubble.png');
  
  console.log('=== ICON DEBUG ===');
  console.log('Icon path:', iconPath);
  console.log('Icon exists:', require('fs').existsSync(iconPath));
  console.log('App packaged:', app.isPackaged);
  console.log('__dirname:', __dirname);
  
  const icon = nativeImage.createFromPath(iconPath);
  console.log('Icon loaded:', !icon.isEmpty());
  console.log('Icon size:', icon.getSize());
  console.log('=================');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: true,
    center: true,
    icon: icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      nodeIntegrationInWorker: true,
      sandbox: false,
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
  const { Logger } = await import('@hashgraphonline/standards-sdk')
  const { setupIPCHandlers } = await import('./ipc/handlers')
  const { testConfigService } = await import('./test-config')
  
  logger = new Logger({ module: 'MainProcess' })
  logger.info('App ready, initializing...')
  
  // Set the dock icon for macOS
  if (process.platform === 'darwin') {
    // In development, __dirname is .vite/build, so we need to go up 2 levels to app/ then into assets/
    const iconPath = app.isPackaged 
      ? path.join(__dirname, '../../assets/hol-app-icon-bubble.png')
      : path.join(__dirname, '../../assets/hol-app-icon-bubble.png');
    logger.info('Dock icon path:', iconPath);
    logger.info('Dock icon exists:', require('fs').existsSync(iconPath));
    
    const icon = nativeImage.createFromPath(iconPath);
    logger.info('Dock icon loaded:', !icon.isEmpty());
    
    if (!icon.isEmpty()) {
      if (app.dock) {
        app.dock.setIcon(icon);
        logger.info('Dock icon set successfully');
      }
    } else {
      logger.error('Failed to load dock icon');
    }
  }
  
  const masterPassword = process.env.MASTER_PASSWORD || 'default-secure-password-change-me'
  setupIPCHandlers(masterPassword)
  logger.info('IPC handlers setup complete')
  
  createWindow()
  
  // Initialize UpdateService after window is created
  if (mainWindow) {
    const { UpdateService } = await import('./services/UpdateService')
    const updateService = UpdateService.getInstance()
    updateService.setMainWindow(mainWindow)
    logger.info('UpdateService initialized')
  }
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