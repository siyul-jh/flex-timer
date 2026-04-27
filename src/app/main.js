const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  shell,
  nativeImage,
  ipcMain,
  Notification,
  session,
} = require('electron');
const path = require('path');
const { loadSettings, saveSettings } = require('../shared/lib/settings');
const { fetchWorkData, resetUserId } = require('../entities/work-data/model');
const { clockIn, clockOut } = require('../features/clock-actions');
const {
  POLL_INTERVAL_MS,
  POPOVER_WIDTH,
  POPOVER_HEIGHT,
  LOGIN_WIDTH,
  LOGIN_HEIGHT,
  BASE_URL,
  DEFAULT_ICON,
  DEFAULT_LOGGED_IN_ICON,
} = require('../shared/constants');

app.dock?.hide();

let popover = null;
let loginWindow = null;
let settingsWindow = null;
let workData = null;
let tray = null;
let overtimeNotified = false;
let serverTimeOffset = 0;
let currentSettings = {
  breakMinutes: 90,
  breakStartTime: '11:30',
  breakEndTime: '13:00',
  customIcon: DEFAULT_ICON,
  loggedInIcon: DEFAULT_LOGGED_IN_ICON,
  targetWorkHours: 7.5,
  overtimeHours: 7.5,
};

function calcBreakOverlapMs(clockInTime, endTime, settings) {
  const d = new Date(endTime);
  const [startH, startM] = settings.breakStartTime.split(':').map(Number);
  const [endH, endM] = settings.breakEndTime.split(':').map(Number);
  const breakStart = new Date(d).setHours(startH, startM, 0, 0);
  const breakEnd = new Date(d).setHours(endH, endM, 0, 0);
  if (clockInTime >= breakEnd || endTime <= breakStart) return 0;
  return Math.max(0, Math.min(endTime, breakEnd) - Math.max(clockInTime, breakStart));
}

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 400,
    height: 520,
    title: 'FlexTimer 설정',
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  settingsWindow.loadFile(path.join(__dirname, '../pages/settings/ui/index.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function setupCookieListener() {
  session.defaultSession.cookies.on('changed', (event, cookie) => {
    if (cookie.domain.includes('flex.team')) {
      if (cookie.name.includes('FlexTeam') || cookie.name.includes('flex_session')) {
        resetUserId();
        loadData();
      }
    }
  });
}

function formatElapsed(clockInTime) {
  if (!clockInTime) return '--:--';
  const now = Date.now() + serverTimeOffset;
  const breakOverlapMs = calcBreakOverlapMs(clockInTime, now, currentSettings);
  const s = Math.max(0, Math.floor((now - clockInTime - breakOverlapMs) / 1000));
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII='
  );
  tray = new Tray(icon);
  tray.setTitle(`${currentSettings.customIcon} --:--`);
  tray.setToolTip('FlexTimer');
  tray.on('click', togglePopover);
  tray.on('right-click', () => {
    const isClockedIn = workData?.isClockedIn ?? false;
    const isLoggedIn = workData?.isLoggedIn ?? false;
    tray.popUpContextMenu(
      Menu.buildFromTemplate([
        {
          label: '출근하기',
          enabled: isLoggedIn && !isClockedIn,
          click: async () => {
            await clockIn();
            loadData();
          },
        },
        {
          label: '퇴근하기',
          enabled: isLoggedIn && isClockedIn,
          click: async () => {
            await clockOut();
            loadData();
          },
        },
        { type: 'separator' },
        { label: 'Flex 열기', click: () => shell.openExternal(BASE_URL) },
        { type: 'separator' },
        {
          label: '새로고침',
          click: () => {
            resetUserId();
            loadData();
          },
        },
        { label: '설정', click: openSettingsWindow },
        { type: 'separator' },
        { label: '종료', click: () => app.quit() },
      ])
    );
  });
}

function createPopover() {
  popover = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  popover.loadFile(path.join(__dirname, '../pages/popover/ui/popover.html'));
  popover.on('blur', () => popover.hide());
}

function togglePopover() {
  if (popover.isVisible()) {
    popover.hide();
    return;
  }
  const bounds = tray.getBounds();
  const { width: pw } = popover.getBounds();
  const x = Math.round(bounds.x + bounds.width / 2 - pw / 2);
  const y = bounds.y + bounds.height + 4;
  popover.setPosition(x, y);
  popover.show();
  popover.focus();
}

function openLoginWindow() {
  if (loginWindow) {
    loginWindow.focus();
    return;
  }
  loginWindow = new BrowserWindow({
    width: LOGIN_WIDTH,
    height: LOGIN_HEIGHT,
    title: 'flex.team 로그인',
    webPreferences: { nodeIntegration: false },
  });
  loginWindow.loadURL(`${BASE_URL}/login`);
  loginWindow.on('closed', () => {
    loginWindow = null;
  });
  loginWindow.webContents.on('did-navigate', (_, url) => {
    if (url.includes('flex.team/home') || url.includes('flex.team/time-tracking')) {
      setTimeout(() => {
        if (loginWindow) loginWindow.close();
      }, 1000);
    }
  });
}

async function loadData() {
  try {
    const data = await fetchWorkData();
    if (data.serverNow) {
      serverTimeOffset = data.serverNow - Date.now();
    }
    if (!data.isLoggedIn && !data.error) resetUserId();

    let totalWorkedSec = null;
    if (!data.isClockedIn && data.clockOutTime && data.clockInTime) {
      const breakOverlapMs = calcBreakOverlapMs(
        data.clockInTime,
        data.clockOutTime,
        currentSettings
      );
      totalWorkedSec = Math.max(
        0,
        Math.floor((data.clockOutTime - data.clockInTime - breakOverlapMs) / 1000)
      );
    }

    let expectedClockOutTime = null;
    if (data.isClockedIn && data.clockInTime) {
      expectedClockOutTime =
        data.clockInTime +
        (currentSettings.targetWorkHours * 3600 + currentSettings.breakMinutes * 60) * 1000;
    }

    workData = {
      ...data,
      breakMinutes: currentSettings.breakMinutes,
      totalWorkedSec,
      expectedClockOutTime,
    };
    popover?.webContents.send('work-data', workData);
  } catch (e) {
    console.error('[loadData Error]', e.message);
    workData = { isLoggedIn: false, error: '데이터를 불러오지 못했습니다' };
    popover?.webContents.send('work-data', workData);
  }
}

function startTick() {
  setInterval(() => {
    const { clockInTime, isClockedIn, error, isLoggedIn } = workData ?? {};

    let icon = currentSettings.customIcon || DEFAULT_ICON;
    if (error) icon = '⚠️';
    else if (isLoggedIn) icon = currentSettings.loggedInIcon || DEFAULT_LOGGED_IN_ICON;

    const elapsed = isClockedIn ? formatElapsed(clockInTime) : '--:--';
    tray?.setTitle(`${icon} ${elapsed}`);

    if (popover?.isVisible() && isClockedIn) {
      popover.webContents.send('tick', { elapsed, clockInTime });
    }

    if (!clockInTime || !isClockedIn) {
      overtimeNotified = false;
      return;
    }

    if (!overtimeNotified) {
      const now = Date.now() + serverTimeOffset;
      const netSec = Math.floor(
        (now - clockInTime - calcBreakOverlapMs(clockInTime, now, currentSettings)) / 1000
      );
      if (netSec >= currentSettings.overtimeHours * 3600) {
        overtimeNotified = true;
        const h = Math.floor(currentSettings.overtimeHours);
        const m = Math.round((currentSettings.overtimeHours - h) * 60);
        const timeStr = m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
        new Notification({
          title: 'FlexTimer',
          body: `근무 시간이 ${timeStr}을 초과했어요. 퇴근할 시간입니다! 🏠`,
        }).show();
      }
    }
  }, 1000);
}

ipcMain.on('request-data', () => {
  if (workData) popover?.webContents.send('work-data', workData);
  else loadData();
});
ipcMain.on('open-login', openLoginWindow);
ipcMain.on('open-settings', openSettingsWindow);
ipcMain.on('refresh', () => {
  resetUserId();
  loadData();
});
ipcMain.on('quit', () => app.quit());

ipcMain.handle('get-break-minutes', () => currentSettings.breakMinutes);
ipcMain.on('set-break-minutes', (_, min) => {
  currentSettings.breakMinutes = Math.max(0, Math.min(480, min));
  saveSettings(currentSettings);
  pushSettingsToPopover();
});

function pushSettingsToPopover() {
  if (!workData) return;
  let expectedClockOutTime = null;
  if (workData.isClockedIn && workData.clockInTime) {
    expectedClockOutTime =
      workData.clockInTime +
      (currentSettings.targetWorkHours * 3600 + currentSettings.breakMinutes * 60) * 1000;
  }
  workData = { ...workData, breakMinutes: currentSettings.breakMinutes, expectedClockOutTime };
  popover?.webContents.send('work-data', workData);
}

ipcMain.handle('get-settings', () => currentSettings);
ipcMain.on('save-settings', (_, newSettings) => {
  const sanitized = { ...newSettings };
  if (isNaN(sanitized.targetWorkHours) || sanitized.targetWorkHours <= 0)
    sanitized.targetWorkHours = currentSettings.targetWorkHours;
  if (isNaN(sanitized.overtimeHours) || sanitized.overtimeHours <= 0)
    sanitized.overtimeHours = currentSettings.overtimeHours;
  if (isNaN(sanitized.breakMinutes) || sanitized.breakMinutes < 0)
    sanitized.breakMinutes = currentSettings.breakMinutes;
  currentSettings = { ...currentSettings, ...sanitized };
  saveSettings(currentSettings);
  pushSettingsToPopover();
});

ipcMain.on('resize-window', (event, width, height) => {
  BrowserWindow.fromWebContents(event.sender)?.setSize(width, height);
});

ipcMain.handle('get-launch-at-login', () => app.getLoginItemSettings().openAtLogin);
ipcMain.on('set-launch-at-login', (_, val) => {
  app.setLoginItemSettings({ openAtLogin: val });
});

ipcMain.handle('clock-in', async () => {
  try {
    const res = await clockIn();
    await loadData();
    return { ok: res.status < 300, status: res.status, json: res.json, error: res.error };
  } catch (e) {
    return { ok: false, status: 500, error: e.message };
  }
});

ipcMain.handle('clock-out', async () => {
  try {
    const res = await clockOut();
    await loadData();
    return { ok: res.status < 300, status: res.status, json: res.json, error: res.error };
  } catch (e) {
    return { ok: false, status: 500, error: e.message };
  }
});

app.whenReady().then(() => {
  const saved = loadSettings();
  currentSettings = { ...currentSettings, ...saved };

  setupCookieListener();
  createTray();
  createPopover();
  startTick();
  loadData();
  setInterval(loadData, POLL_INTERVAL_MS);
});

app.on('window-all-closed', (e) => e.preventDefault());
