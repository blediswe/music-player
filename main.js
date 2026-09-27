const { app, BrowserWindow, ipcMain, dialog } = require('electron');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1060,
    height: 820,
    minWidth: 1060,
    minHeight: 820,
    resizable: false,
    maximizable: false,
    webPreferences: {
      preload: __dirname + '/preload.js'
    }
  });

  win.loadFile('renderer/index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('select-music', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: 'Select your music files',
    defaultPath: app.getPath('music'),
    filters: [
      {
        name: 'All Files',
        extensions: ['*']
      },
      {
        name: 'Music Files',
        extensions: ['mp3', 'wav', 'flac', 'm4a']
      }
    ],
    properties: ['openFile', 'multiSelections']
  });

  return result.filePaths;
});
