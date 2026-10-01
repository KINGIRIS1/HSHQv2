
const { app, BrowserWindow, ipcMain, desktopCapturer, shell, dialog, Notification, protocol, net } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Cấu hình Logger
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Tắt tự động tải về (để người dùng bấm nút mới tải)
autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = false;

let mainWindow;
protocol.registerSchemesAsPrivileged([{ scheme: 'hshq', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

function getAppIconPath() {
  const distIcon = path.join(__dirname, '../dist-desktop/icon.ico');
  const publicIcon = path.join(__dirname, '../public/icon.ico');
  if (fs.existsSync(distIcon)) return distIcon;
  if (fs.existsSync(publicIcon)) return publicIcon;
  return distIcon;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: getAppIconPath(), 
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
  });

  // Đặt App User Model ID để thông báo hiển thị đúng trên Windows
  app.setAppUserModelId("vn.info.qlhshq.desktop");

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('hshq://app/index.html');
  }
  
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// --- IPC Handlers ---

// Chọn thư mục lưu
ipcMain.handle('select-folder', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Chọn thư mục lưu file xuất',
        buttonLabel: 'Chọn thư mục này'
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Lưu file và trả về đường dẫn để mở (Dùng cho tính năng Xuất & Mở ngay)
// Cập nhật: Chấp nhận outputFolder
ipcMain.handle('save-and-open-file', async (event, { fileName, base64Data, outputFolder }) => {
    // Nếu có outputFolder thì dùng, nếu không thì mặc định Downloads
    const folder = outputFolder || app.getPath('downloads');
    const filePath = path.join(folder, fileName);
    
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        // Tự động mở file sau khi lưu
        shell.openPath(filePath);
        return { success: true, path: filePath };
    } catch (error) {
        log.error('Save and open error:', error);
        return { success: false, message: error.message };
    }
});

// Chỉ mở file theo đường dẫn
ipcMain.handle('open-file-path', async (event, filePath) => {
    if (filePath) {
        shell.openPath(filePath);
        return true;
    }
    return false;
});

ipcMain.handle('check-for-update', async (event, serverUrl) => {
  if (!app.isPackaged) return { status: 'dev-mode', message: 'Đang chạy chế độ Dev (Không update)' };
  
  try {
    // LOGIC THÔNG MINH:
    // 1. Nếu serverUrl chứa "github.com" hoặc rỗng -> Sử dụng cấu hình mặc định trong package.json (GitHub Releases)
    // 2. Nếu serverUrl là IP hoặc tên miền riêng (LAN) -> Sử dụng chế độ Custom Server
    
    if (serverUrl && !serverUrl.includes('github.com') && serverUrl.trim() !== '') {
        const feedUrl = `${serverUrl}/updates`;
        log.info(`Checking updates from Custom Server: ${feedUrl}`);
        autoUpdater.setFeedURL(feedUrl);
    } else {
        log.info('Checking updates from GitHub Releases (using package.json config)');
        // Không gọi setFeedURL, để electron-updater tự dùng "publish" trong package.json
    }

    const result = await autoUpdater.checkForUpdates();
    
    if (result && result.updateInfo) {
       return { status: 'available', version: result.updateInfo.version, info: result.updateInfo };
    }
    return { status: 'not-available' };
  } catch (error) {
    log.error('Update Check Error:', error);
    return { status: 'error', message: error.message };
  }
});

// FIX LỖI: "Please check update first"
ipcMain.handle('download-update', async () => {
  log.info("User requested download update...");
  try {
    // Cố gắng tải ngay lập tức
    return await autoUpdater.downloadUpdate();
  } catch (e) {
    log.warn("Direct download failed, attempting to re-check update first...", e.message);
    
    // Nếu lỗi do chưa có state update, ta thực hiện check lại rồi mới download
    if (e.message.includes('check update first')) {
        try {
            // Check lại (sử dụng feedURL đã set trước đó hoặc mặc định)
            const checkResult = await autoUpdater.checkForUpdates();
            if (checkResult && checkResult.updateInfo) {
                // Sau khi check xong, gọi download lại
                return await autoUpdater.downloadUpdate();
            } else {
                throw new Error("Không tìm thấy bản cập nhật khi thử lại.");
            }
        } catch (retryError) {
            log.error("Retry download failed:", retryError);
            throw retryError;
        }
    }
    
    throw e;
  }
});

ipcMain.handle('quit-and-install', () => {
  log.info("Quitting and installing...");
  autoUpdater.quitAndInstall();
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
  if(mainWindow) mainWindow.webContents.send('update-status', { status: 'available', info });
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available.');
  if(mainWindow) mainWindow.webContents.send('update-status', { status: 'not-available', info });
});

autoUpdater.on('error', (err) => {
  log.error("Update error:", err);
  if(mainWindow) mainWindow.webContents.send('update-status', { status: 'error', message: err.message });
});

autoUpdater.on('download-progress', (progressObj) => {
  if(mainWindow) mainWindow.webContents.send('update-status', { 
    status: 'downloading', 
    progress: progressObj.percent,
    bytesPerSecond: progressObj.bytesPerSecond,
    total: progressObj.total,
    transferred: progressObj.transferred
  });
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded');
  if(mainWindow) mainWindow.webContents.send('update-status', { status: 'downloaded', info });
});

ipcMain.handle('capture-screenshot', async (event, { hideWindow = true } = {}) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (hideWindow && win) {
      win.minimize(); 
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
    if (hideWindow && win) { win.restore(); win.focus(); }
    if (sources.length > 0) return sources[0].thumbnail.toDataURL();
    return null;
  } catch (error) {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) { win.restore(); win.focus(); }
    throw error;
  }
});

ipcMain.handle('open-external-link', async (event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('show-notification', async (event, { title, body }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      icon: getAppIconPath(),
      silent: false 
    });
    notification.show();
    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        mainWindow.webContents.send('navigate-to-view', 'internal_chat');
      }
    });
    return true;
  }
  return false;
});

ipcMain.handle('show-confirm-dialog', async (event, { message, title }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Không', 'Có'], 
    defaultId: 1,
    cancelId: 0,
    title: title || 'Xác nhận',
    message: message,
    icon: getAppIconPath()
  });
  return result.response === 1; 
});

app.whenReady().then(() => {
  // Serve bundled assets from a stable secure origin. All data uses Supabase.
  protocol.handle('hshq', request => {
    const base = path.resolve(__dirname, '../dist-desktop');
    let relative;
    try { relative = decodeURIComponent(new URL(request.url).pathname); }
    catch { return new Response('Bad request', { status: 400 }); }
    const file = path.resolve(base, '.' + relative);
    if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('Not found', { status: 404 });
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
