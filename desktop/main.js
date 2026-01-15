const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');



let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 360,
        height: 700,
        frame: false,
        transparent: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Simplified for this local demo
        },
        icon: path.join(__dirname, '../client/public/favicon.ico')
    });

    // Load the Vite local server
    mainWindow.loadURL('http://localhost:5173');

    // ipcMain handlers
    ipcMain.on('app-close', () => {
        app.quit();
    });

    ipcMain.on('app-minimize', () => {
        mainWindow.minimize();
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
