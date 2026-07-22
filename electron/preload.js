
const { ipcRenderer } = require('electron');

window.electronAPI = {
  captureScreenshot: (options) => ipcRenderer.invoke('capture-screenshot', options),
  openExternal: (url) => ipcRenderer.invoke('open-external-link', url),
  
  // API Lưu và mở file trực tiếp (Dành cho Tiện ích)
  // Updated: Chấp nhận outputFolder
  saveAndOpenFile: (data) => ipcRenderer.invoke('save-and-open-file', data),
  openFilePath: (path) => ipcRenderer.invoke('open-file-path', path),
  
  // API Chọn thư mục
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // API Update
  checkForUpdate: (serverUrl) => ipcRenderer.invoke('check-for-update', serverUrl),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, value) => callback(value)),
  removeUpdateListener: () => ipcRenderer.removeAllListeners('update-status'),

  // API Notification
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
  
  // API Navigation (Từ Main -> Renderer)
  onNavigateToView: (callback) => ipcRenderer.on('navigate-to-view', (_event, viewId) => callback(viewId)),
  removeNavigationListener: () => ipcRenderer.removeAllListeners('navigate-to-view'),

  // API Native Confirm
  showConfirmDialog: (message, title) => ipcRenderer.invoke('show-confirm-dialog', { message, title })
};
