
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import getMAC from 'getmac';
import { autoUpdater } from 'electron-updater';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import url from 'node:url';

// FIX 1: Allow the updater to handle the automatic restart lifecycle natively
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let updateAvailable = false;
let isUpdating = false;
let initialCheckFinished = false;
let splashStartTime = 0;
function resolveSplashImagePath(): string | null {
  const dirs = [
    path.join(app.getAppPath(), 'src', 'assets'),
    path.join(app.getAppPath(), 'static'),
    path.join(app.getAppPath(), '.vite', 'renderer', 'main_window', 'assets'),
    path.join(app.getAppPath(), '..', '.vite', 'renderer', 'main_window', 'assets'),
    path.join(process.resourcesPath, 'static'),
    path.join(process.resourcesPath, '.vite', 'renderer', 'main_window', 'assets'),
    path.join(process.resourcesPath, 'app.asar', 'static'),
    path.join(process.resourcesPath, 'app.asar', '.vite', 'renderer', 'main_window', 'assets'),
    path.join(process.resourcesPath, 'app.asar', 'src', 'assets'),
    path.join(__dirname, '../../src/assets'),
    path.join(__dirname, '../../static'),
  ];

  const exactCandidates = [
    path.join(app.getAppPath(), 'src', 'assets', 'YGT.png'),
    path.join(app.getAppPath(), 'static', 'YGT.png'),
    path.join(app.getAppPath(), '.vite', 'renderer', 'main_window', 'assets', 'YGT.png'),
    path.join(app.getAppPath(), '..', '.vite', 'renderer', 'main_window', 'assets', 'YGT.png'),
    path.join(process.resourcesPath, 'static', 'YGT.png'),
    path.join(process.resourcesPath, '.vite', 'renderer', 'main_window', 'assets', 'YGT.png'),
    path.join(process.resourcesPath, 'app.asar', 'static', 'YGT.png'),
    path.join(process.resourcesPath, 'app.asar', '.vite', 'renderer', 'main_window', 'assets', 'YGT.png'),
    path.join(process.resourcesPath, 'app.asar', 'src', 'assets', 'YGT.png'),
    path.join(__dirname, '../../src/assets/YGT.png'),
    path.join(__dirname, '../../static/YGT.png'),
  ];

  for (const candidate of exactCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      const files = fs.readdirSync(dir);
      const match = files.find((file) => /^YGT([-.].*)?\.png$/i.test(file));
      if (match) {
        return path.join(dir, match);
      }
    } catch (err) {
      // ignore directories we cannot read
    }
  }

  console.error('Splash image path does not exist. Tried exact files and these directories:', exactCandidates, dirs);
  return null;
}
function createSplashWindow(): void {
  let splashImage = '';
  const splashPath = resolveSplashImagePath();
  splashStartTime = Date.now();

  if (splashPath) {
    try {
      const imageBuffer = fs.readFileSync(splashPath);
      splashImage = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    } catch (err) {
      console.error('Failed to read splash image file:', splashPath, err);
    }
  }
  splashWindow = new BrowserWindow({
    // width: 400,
    // height: 300,
    fullscreen: true,
    backgroundColor: "#000",
    frame: false,
    alwaysOnTop: true,
    transparent: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const splashHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        background: #000;
        color: white;
        font-family: sans-serif;
      }
      body {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .splash-inner {
        width: 100%;
        max-width: 420px;
        text-align: center;
        transform: rotate(90deg) !important;
            transform-origin: center center !important;
      }
      .splash-image {
        width: 180px;
        height: auto;
        margin: 0 auto 30px;
        display: block;
         
      }
      .progress-container {
        width: 100%;
        background: #7f8c8d;
        height: 10px;
        border-radius: 5px;
        margin: 20px auto 0;
        overflow: hidden;
      }
      .progress-bar {
        width: 0%;
        height: 100%;
        background: #2ecc71;
        border-radius: 5px;
        transition: width 0.2s ease;
      }
      .loading-text {
        margin-top: 18px;
        font-size: 16px;
        color: #f2f2f2;
        letter-spacing: 0.5px;
      }
    </style></head><body>
      <div class="splash-inner">
        ${splashImage ? `<img class="splash-image" src="${splashImage}" alt="YGT"/>` : '<div style="font-size:42px; font-weight:700; letter-spacing:1px; margin-bottom:30px;">YGT</div>'}
        <div class="loading-text">Loading application...</div>
      </div>
    </body></html>`;

  splashWindow.loadURL(`data:text/html;base64,${Buffer.from(splashHTML).toString('base64')}`);
  
  // Show splash immediately, don't wait for ready-to-show event
  // Use a small delay to ensure the window is fully initialized
  setImmediate(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
    }
  });
}
        // <h2 style="margin:0 0 8px;">Checking for updates...</h2>
        // <p id="status" style="margin:0;color:#ccc;">Connecting to server...</p>
        // <div class="progress-container"><div id="bar" class="progress-bar"></div></div>
app.disableHardwareAcceleration();
let isInitialBoot = true;
const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    show: false, // Keep hidden while loading to prevent white flash
    backgroundColor: '#000', 
    icon: path.join(__dirname, '../../src/assets/YGT.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,       
      contextIsolation: true,       
      sandbox: true,                
      webSecurity: true,            
      allowRunningInsecureContent: false, 
    },
  });

  // Read the splash image natively and convert to base64
  let inlineLogoBase64 = '';
  try {
    const splashImagePath = resolveSplashImagePath();
    if (splashImagePath && fs.existsSync(splashImagePath)) {
      const bitmap = fs.readFileSync(splashImagePath);
      inlineLogoBase64 = `data:image/png;base64,${bitmap.toString('base64')}`;
    }
  } catch (err) {
    console.error('Failed to read splash image for main window injection:', err);
  }

  // Inject the logo layout immediately when the HTML document starts loading
  mainWindow.webContents.on('did-start-loading', () => {
    // FIX: If this is NOT the initial application boot (e.g., a reload/refresh), 
    // exit immediately and do NOT show the image layout overlay.
    if (!isInitialBoot || !inlineLogoBase64 || !mainWindow) return;

    const cssInjectionScript = `
      (function() {
        const style = document.createElement('style');
        style.id = 'ygt-splash-styles';
        style.innerHTML = \`
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #000 !important;
            width: 100vw !important;
            height: 100vh !important;
            overflow: hidden !important;
            position: relative !important;
          }

          .ygt-loading-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 99999 !important;
            background-color: #000 !important;
            background-image: url('${inlineLogoBase64}') !important;
            background-repeat: no-repeat !important;
            background-position: center !important;
            background-size: 180px auto !important;
            transform: rotate(90deg) !important;
            transform-origin: center center !important;
          }

          .ygt-loading-text {
            position: absolute !important;
            bottom: 24px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            color: #fff !important;
            font-size: 16px !important;
            font-family: sans-serif !important;
            letter-spacing: 0.5px !important;
          }
        \`;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'ygt-loading-screen';
        overlay.className = 'ygt-loading-overlay';

        const loadingText = document.createElement('div');
        loadingText.className = 'ygt-loading-text';
        loadingText.textContent = 'Loading application...';
        overlay.appendChild(loadingText);

        document.body.appendChild(overlay);

        // Monitor the DOM: INSTANTLY delete this overlay when React content mounts
        const observer = new MutationObserver(function(mutations, obs) {
          const rootEl = document.getElementById('root');
          if (rootEl && rootEl.children.length > 0) {
            overlay.remove();
            style.remove();
            obs.disconnect(); // Clear memory instantly
          }
        });

        observer.observe(document.body, { childList: true, subtree: true });
      })();
    `;

    mainWindow.webContents.executeJavaScript(cssInjectionScript).catch(() => { });
  });
 if (!app.isPackaged && typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined' && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    let productionFilePath = path.join(app.getAppPath(), '.vite/build/renderer/main_window/index.html');
    if (!fs.existsSync(productionFilePath)) {
      productionFilePath = path.join(app.getAppPath(), '.vite/renderer/main_window/index.html');
    }
    if (!fs.existsSync(productionFilePath)) {
      productionFilePath = path.join(__dirname, '../renderer/main_window/index.html');
    }

    mainWindow.loadURL(
      url.format({
        pathname: productionFilePath,
        protocol: 'file:',
        slashes: true
      })
    ).catch((err) => {
      console.error("Index.html asset stream failure:", err);
    });
  }

  // Splash stays visible until React sends app-ready signal or 10-second timeout
  mainWindow.once('ready-to-show', () => {
    const minimumSplashTime = 5000; // 5 seconds minimum
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        console.warn('React app-ready signal did not arrive within 10 seconds, forcing reveal');
        showMainWindowAfterSplash();
      }
    }, minimumSplashTime + 5000); // Total 10 seconds
  });

  ipcMain.on('request-fullscreen', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isFullScreen()) {
      win.setFullScreen(true);
    }
  });

  ipcMain.on('app-ready', () => {
    // React app is ready - enforce 5-second minimum splash display
    const minimumSplashTime = 5000; // 5 seconds
    const elapsedTime = Date.now() - splashStartTime;
    const remainingTime = Math.max(0, minimumSplashTime - elapsedTime);

    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      }
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      isInitialBoot = false;
    }, remainingTime);
  });

  mainWindow.on('focus', () => {
    if (mainWindow && !mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(true);
    }
  });

  mainWindow.on('restore', () => {
    if (mainWindow) mainWindow.setFullScreen(true);
  });
};
// Helper function to safely bring the main window forward and close the updater splash
function revealWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show(); // 1. Unhides your main app window directly into your rotated layout
  }
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close(); // 2. Permanently destroys the initial loading splash window
  }
}

function showMainWindowAfterSplash(): void {
  // Reveal immediately when called - splash stays visible until React is ready
  revealWindow();
  isInitialBoot = false;
}
app.disableHardwareAcceleration();
app.whenReady().then(() => {
  createSplashWindow();

  if (app.isPackaged) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'http://10.200.10.11/PTAPP'
    });
    autoUpdater.checkForUpdates();
  } else {
    initialCheckFinished = true;
    createWindow();
    // Keep the splash visible until the renderer is ready to show.
    // mainWindow.once('ready-to-show') will close the splash and show the main window.
  }

  ipcMain.handle('get-mac-address', async () => {
    try {
      const macAddress = await getMAC();
      return macAddress;
    } catch (error) {
      return null;
    }
  });

  ipcMain.on('app:restart', () => {
    if (!app.isPackaged && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const win: any = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows();
      if (win) win.reload();
    } else {
      app.relaunch();
      app.exit(0);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

autoUpdater.on('update-available', () => {
  updateAvailable = true;
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(`
      var statusEl = document.getElementById('status');
      if(statusEl) statusEl.innerText = 'New update found! Downloading...';
    `).catch(err => console.log("Splash script deferred"));
  }
});

autoUpdater.on('update-not-available', () => {
  initialCheckFinished = true;
  if (!mainWindow) createWindow();
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  }, 500);
});

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(`
      var statusEl = document.getElementById('status');
      var barEl = document.getElementById('bar');
      if(statusEl) statusEl.innerText = 'Downloading update: ${percent}%';
      if(barEl) barEl.style.width = '${percent}%';
    `).catch(err => console.log("Splash script deferred"));
  }
});

// FIX 2: Clear file locks, overwrite the binary, and fire a clean native restart hook
autoUpdater.on('update-downloaded', (info) => {
  isUpdating = true;
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(`
      var statusEl = document.getElementById('status');
      if(statusEl) statusEl.innerText = 'Installing update...';
    `).catch(err => console.log("Splash script deferred"));
  }

  if (process.platform === 'linux') {
    const currentAppImagePath = process.env.APPIMAGE || '/home/user/Test/PTD.AppImage';
    const downloadedImagePath = info.downloadedFile;

    if (downloadedImagePath && fs.existsSync(downloadedImagePath)) {
      try {
        // Unlinking breaks the file-lock so we can write to the path
        if (fs.existsSync(currentAppImagePath)) {
          fs.unlinkSync(currentAppImagePath);
        }

        fs.copyFileSync(downloadedImagePath, currentAppImagePath);
        fs.chmodSync(currentAppImagePath, '0755');

        console.log("File swap complete. Forcing automatic application open sequence...");

        // FIX 3: Instead of manual app.exit(0) which kills background execution inside WSL,
        // use quitAndInstall with (isSilent: false, isForceRunAfter: true) to make Electron reopen natively.
        setImmediate(() => {
          autoUpdater.quitAndInstall(false, true);
        });
        return;
      } catch (err) {
        console.error("Direct hot-swap failed, running independent process restart:", err);
        // Fallback: Using shell command background tasks to force automatic application opening
        exec(`mv -f "${downloadedImagePath}" "${currentAppImagePath}" && chmod +x "${currentAppImagePath}"`, () => {
          setImmediate(() => {
            autoUpdater.quitAndInstall(false, true);
          });
        });
        return;
      }
    }
  }

  // Windows system automatic open sequence fallback
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
});

autoUpdater.on('error', (error) => {
  console.error("AutoUpdater Error encountered:", error);
  initialCheckFinished = true;
  if (!mainWindow) createWindow();
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !isUpdating) {
    app.quit();
  }
});

So the issue is a startup timing/boot sequence problem, not a crash.
here problem with startuptiming /boost at that time not display ygt image spash window show after 5 sconds why