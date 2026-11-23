process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

// Support loading V8 Bytecode (.jsc)
try {
  require('bytenode');
} catch (err) {
  // bytenode loaded when installed
}

let mainWindow = null;
let serverProcess = null;
const SERVER_PORT = 5050;

// Path for user persistent configuration
const configFilePath = path.join(app.getPath('userData'), 'erp-config.json');

function loadConfig() {
  let config = {
    mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erp_mern',
    serverPort: SERVER_PORT,
  };
  try {
    if (fs.existsSync(configFilePath)) {
      config = { ...config, ...JSON.parse(fs.readFileSync(configFilePath, 'utf8')) };
    }
  } catch (err) {
    console.error('Error reading config file:', err);
  }

  let updated = false;
  if (!config.jwtSecret) {
    config.jwtSecret = crypto.randomBytes(48).toString('hex');
    updated = true;
  }
  if (!config.sessionSecret) {
    config.sessionSecret = crypto.randomBytes(48).toString('hex');
    updated = true;
  }
  if (updated) {
    saveConfig(config);
  }
  return config;
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving config file:', err);
    return false;
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * Gracefully and forcefully kill server process tree
 */
function killServerProcess() {
  if (!serverProcess) return;
  const pid = serverProcess.pid;
  try {
    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (err) {
    try {
      serverProcess.kill('SIGKILL');
    } catch (e) {}
  }
  serverProcess = null;
}

/**
 * Start the Express backend server
 */
function startBackendServer() {
  const config = loadConfig();
  const isPackaged = app.isPackaged;
  
  // Resolve server entry path
  let serverEntry = '';
  if (isPackaged) {
    // In production, server is bundled at resources/server/index.js
    serverEntry = path.join(process.resourcesPath, 'server', 'index.js');
  } else {
    serverEntry = path.join(__dirname, '../../erp-mern-server-v3/src/index.js');
  }

  const clientDir = isPackaged 
    ? path.join(process.resourcesPath, 'client')
    : path.join(__dirname, '../../erp-mern-client-v3-full/dist');

  const port = String(config.serverPort || SERVER_PORT);
  const serverDir = isPackaged 
    ? path.dirname(serverEntry) 
    : path.resolve(__dirname, '../../erp-mern-server-v3');

  const env = {
    ...process.env,
    PORT: port,
    MONGO_URI: config.mongoUri,
    MONGODB_URI: config.mongoUri,
    JWT_SECRET: process.env.JWT_SECRET || config.jwtSecret,
    SESSION_SECRET: process.env.SESSION_SECRET || config.sessionSecret,
    CLIENT_DIR: clientDir,
    SERVE_CLIENT: 'true',
    CORS_ORIGINS: `http://127.0.0.1:${port},http://localhost:${port},http://localhost:5173,http://127.0.0.1:5173`,
    NODE_ENV: isPackaged ? 'production' : 'development',
    ELECTRON_RUN_AS_NODE: '1'
  };

  console.log(`Starting backend server on port ${port} from: ${serverEntry}`);

  const { fork } = require('child_process');
  const logFile = path.join(app.getPath('userData'), 'server.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  try {
    serverProcess = fork(serverEntry, [], {
      env,
      cwd: serverDir,
      execPath: process.execPath,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });

    if (serverProcess.stdout) {
      serverProcess.stdout.pipe(logStream);
    }
    if (serverProcess.stderr) {
      serverProcess.stderr.pipe(logStream);
    }

    serverProcess.on('exit', (code) => {
      console.log(`Server process exited with code ${code}`);
    });
  } catch (err) {
    console.error('Failed to start server process:', err);
  }
}

/**
 * Poll server until /api/health returns 200
 */
function waitForServer(port, timeoutMs = 35000) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          retry();
        }
      });

      req.on('error', () => {
        retry();
      });

      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        resolve(false); // timeout
      } else {
        setTimeout(check, 400);
      }
    };

    check();
  });
}

/**
 * Create Application Window
 */
async function createMainWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../assets/icon.ico')
    : path.join(__dirname, '../assets/icon.png');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: 'CORE SYSTEM ERP',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged
    }
  });

  // Remove default menu bar for sleek modern desktop look
  mainWindow.setMenuBarVisibility(false);

  // Show splash / loading screen
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html dir="rtl" style="height:100%;background:#0f172a;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
      <head><meta charset="utf-8"><title>CORE SYSTEM ERP</title></head>
      <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;margin:0;">
        <div style="width:68px;height:68px;border-radius:20px;background:linear-gradient(135deg,#2563eb,#6366f1);display:flex;align-items:center;justify-content:center;box-shadow:0 12px 28px -6px rgba(37,99,235,0.45);margin-bottom:24px;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
        </div>
        <h2 style="font-size:22px;font-weight:800;letter-spacing:0.5px;margin:0 0 8px 0;">CORE SYSTEM ERP</h2>
        <p style="font-size:13px;color:#94a3b8;margin:0 0 28px 0;">جاري تهيئة الخادم الداخلي والاتصال بقاعدة البيانات...</p>
        <div style="width:180px;height:5px;background:#1e293b;border-radius:999px;overflow:hidden;position:relative;">
          <div style="width:70px;height:100%;background:linear-gradient(90deg,#3b82f6,#6366f1);border-radius:999px;position:absolute;animation:slide 1.2s infinite ease-in-out;"></div>
        </div>
        <style>
          @keyframes slide {
            0% { left: -70px; }
            100% { left: 180px; }
          }
        </style>
      </body>
    </html>
  `)}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer]: ${message}`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Load Error]: ${errorCode} - ${errorDescription} on ${validatedURL}`);
  });

  const config = loadConfig();
  const serverReady = await waitForServer(config.serverPort || SERVER_PORT, 40000);

  if (serverReady) {
    const port = config.serverPort || SERVER_PORT;
    const targetUrl = `http://127.0.0.1:${port}/`;
    console.log(`Loading application from: ${targetUrl}`);
    mainWindow.loadURL(targetUrl);
  } else {
    // Show database connection configuration dialog
    showDbConfigScreen();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showDbConfigScreen() {
  const config = loadConfig();
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html dir="rtl" style="height:100%;background:#0f172a;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
      <head><meta charset="utf-8"><title>إعداد قاعدة البيانات - CORE SYSTEM</title></head>
      <body style="display:flex;align-items:center;justify-content:center;height:100%;margin:0;padding:20px;box-sizing:border-box;">
        <div style="background:#1e293b;border:1px solid #334155;border-radius:20px;padding:32px;max-width:540px;width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.6);">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
            <div style="width:44px;height:44px;border-radius:14px;background:#ef4444;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <div>
              <h3 style="margin:0;font-size:17px;font-weight:bold;">الاتصال بقاعدة البيانات MongoDB</h3>
              <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">تعذر الاتصال بقاعدة البيانات. اختر نوع القاعدة أو حدّث رابط الاتصال أدناه:</p>
            </div>
          </div>

          <div style="display:flex;gap:8px;margin-bottom:16px;">
            <button id="presetLocal" type="button" style="flex:1;background:#334155;color:#f8fafc;border:1px solid #475569;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer;">
              💻 محلي (Local MongoDB)
            </button>
            <button id="presetAtlas" type="button" style="flex:1;background:#334155;color:#f8fafc;border:1px solid #475569;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer;">
              ☁️ سحابي (MongoDB Atlas)
            </button>
          </div>

          <div style="margin-bottom:18px;">
            <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:#cbd5e1;">رابط الاتصال (MongoDB Connection URI):</label>
            <input id="uri" type="text" value="${config.mongoUri || 'mongodb://127.0.0.1:27017/erp_mern'}" style="width:100%;padding:12px 14px;background:#0f172a;border:1px solid #334155;border-radius:10px;color:white;font-family:monospace;font-size:12px;box-sizing:border-box;">
          </div>

          <div id="statusMsg" style="margin-bottom:14px;font-size:12px;padding:10px 14px;border-radius:10px;display:none;"></div>

          <div style="display:flex;gap:10px;">
            <button id="testBtn" style="flex:1;background:#334155;color:white;border:1px solid #475569;border-radius:12px;padding:12px;font-weight:bold;font-size:13px;cursor:pointer;">
              🔍 فحص الاتصال
            </button>
            <button id="saveBtn" style="flex:2;background:#2563eb;color:white;border:none;border-radius:12px;padding:12px;font-weight:bold;font-size:13px;cursor:pointer;">
              🚀 حفظ وتشغيل النظام
            </button>
          </div>
        </div>

        <script>
          const uriInput = document.getElementById('uri');
          const saveBtn = document.getElementById('saveBtn');
          const testBtn = document.getElementById('testBtn');
          const statusMsg = document.getElementById('statusMsg');

          document.getElementById('presetLocal').addEventListener('click', () => {
            uriInput.value = 'mongodb://127.0.0.1:27017/erp_mern';
          });

          document.getElementById('presetAtlas').addEventListener('click', () => {
            uriInput.value = 'mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/erp_mern';
          });

          testBtn.addEventListener('click', async () => {
            const uri = uriInput.value.trim();
            testBtn.innerText = 'جاري الفحص...';
            testBtn.disabled = true;
            statusMsg.style.display = 'block';
            statusMsg.style.background = 'rgba(56, 189, 248, 0.1)';
            statusMsg.style.color = '#38bdf8';
            statusMsg.innerText = 'جاري اختبار الاتصال بالخادم...';

            if (window.desktopAPI) {
              const res = await window.desktopAPI.testDbConnection(uri);
              testBtn.disabled = false;
              testBtn.innerText = '🔍 فحص الاتصال';
              if (res && res.success) {
                statusMsg.style.background = 'rgba(34, 197, 94, 0.15)';
                statusMsg.style.color = '#4ade80';
                statusMsg.innerText = '✅ الاتصال ناجح ومستقر!';
              } else {
                statusMsg.style.background = 'rgba(239, 68, 68, 0.15)';
                statusMsg.style.color = '#f87171';
                statusMsg.innerText = '❌ فشل الاتصال: ' + (res?.error || 'يرجى التحقق من الرابط');
              }
            }
          });

          saveBtn.addEventListener('click', async () => {
            const uri = uriInput.value.trim();
            saveBtn.innerText = 'جاري الحفظ وإعادة التشغيل...';
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.7';
            statusMsg.style.display = 'block';
            statusMsg.style.background = 'rgba(56, 189, 248, 0.1)';
            statusMsg.style.color = '#38bdf8';
            statusMsg.innerText = 'جاري حفظ الإعدادات وإعادة تشغيل الخادم الداخلي...';

            if (window.desktopAPI) {
              const res = await window.desktopAPI.saveDbConfig({ mongoUri: uri });
              if (!res || !res.success) {
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.innerText = 'إعادة المحاولة';
                statusMsg.style.background = 'rgba(239, 68, 68, 0.15)';
                statusMsg.style.color = '#f87171';
                statusMsg.innerText = '❌ تعذر الاتصال بالسيرفر بعد حفظ الرابط. تأكد من صحة الرابط وتشغيل MongoDB.';
              }
            }
          });
        </script>
      </body>
    </html>
  `)}`);
}

// IPC Handlers: Window Controls
ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow && mainWindow.close());

// IPC Handlers: Config & Database
ipcMain.handle('db:get-config', () => loadConfig());

ipcMain.handle('db:test-connection', async (event, uri) => {
  if (!uri || typeof uri !== 'string') return { success: false, error: 'رابط الاتصال فارغ' };
  try {
    let mongoose;
    try {
      mongoose = require(path.join(__dirname, '../../erp-mern-server-v3/node_modules/mongoose'));
    } catch (e) {
      if (app.isPackaged) {
        mongoose = require(path.join(process.resourcesPath, 'server/node_modules/mongoose'));
      }
    }
    if (mongoose) {
      const conn = await mongoose.createConnection(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      }).asPromise();
      await conn.close();
      return { success: true };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db:save-config', async (event, newConfig) => {
  const current = loadConfig();
  const updated = { ...current, ...newConfig };
  saveConfig(updated);
  
  // Gracefully restart backend server
  killServerProcess();
  await new Promise(r => setTimeout(r, 800));
  startBackendServer();

  const port = updated.serverPort || SERVER_PORT;
  const ready = await waitForServer(port, 40000);
  if (ready && mainWindow) {
    mainWindow.loadURL(`http://127.0.0.1:${port}/`);
    return { success: true };
  }
  return { success: false, error: 'تعذر الاتصال بالخادم الداخلي' };
});

// IPC Handlers: Hardware & Printers
ipcMain.handle('printer:get-list', async () => {
  if (mainWindow && mainWindow.webContents) {
    return await mainWindow.webContents.getPrintersAsync();
  }
  return [];
});

ipcMain.handle('printer:print-silent', async (event, options = {}) => {
  if (mainWindow && mainWindow.webContents) {
    return new Promise((resolve) => {
      mainWindow.webContents.print({
        silent: true,
        printBackground: true,
        deviceName: options.deviceName || '',
        ...options
      }, (success, failureReason) => {
        resolve({ success, failureReason });
      });
    });
  }
  return { success: false, failureReason: 'نافذة التطبيق غير متاحة' };
});

ipcMain.handle('server:status', () => {
  return {
    running: !!serverProcess,
    port: loadConfig().serverPort || SERVER_PORT
  };
});

// App Lifecycle
app.whenReady().then(() => {
  startBackendServer();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  killServerProcess();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killServerProcess();
});

process.on('exit', () => {
  killServerProcess();
});
