const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let backendProcess;

function createWindow() {
    // Maak het app-venster aan
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        // icon: path.join(__dirname, 'logo.ico'), // Zet hier straks de naam van je logo!
        webPreferences: {
            nodeIntegration: true
        }
    });

    // Verberg de standaard Windows menubalk (Bestand, Bewerken, Beeld, etc.)
    mainWindow.setMenuBarVisibility(false);

    // Laad de frontend die we in Stap 2 hebben gebouwd ('dist' map)
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
}

app.whenReady().then(() => {
    // 1. Start de backend met de interne Node van Electron (geen shell nodig!)
    backendProcess = fork(path.join(__dirname, 'backend', 'src', 'app.js'), [], {
        cwd: path.join(__dirname, 'backend'),
        silent: true // Dit zorgt ervoor dat we de console.logs nog kunnen lezen
    });

    // Print backend errors in de console (handig voor debuggen)
    backendProcess.stdout.on('data', (data) => console.log(`Backend: ${data}`));
    backendProcess.stderr.on('data', (data) => console.error(`Backend Error: ${data}`));

    // 2. Open de app
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Sluit de app volledig als alle vensters gesloten zijn
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// BELANGRIJK: Zorg dat de backend stopt als je de app wegklikt!
app.on('quit', () => {
    if (backendProcess) {
        backendProcess.kill();
    }
});