const {app, BrowserWindow, Tray, Menu, ipcMain, Notification, screen, nativeImage, shell} = require("electron");
const path = require("path");
const fs = require("fs");

const WHISPERS = [
  "你的键盘已经敲了很久，允许自己端起杯子吗",
  "会议刚散，是不是可以给自己 30 秒",
  "距上次饮水一小时了，尿酸浓度正在缓慢上升",
  "一小口水，就是给关节一次减压",
  "手边有杯子就行，冷的也可以",
  "昨晚睡得晚，今天更该多喝一点",
  "空调开着，喝水能顶回来一半",
  "深呼吸一下，端起杯子",
  "屏幕已经盯了很久，眼睛也想喝一口",
  "血液里那些结晶正在悄悄堆积",
  "先不为工作，先为膝盖",
  "润，不是灌，一口就好",
  "这一秒的水，是给下个月的自己",
  "评审会前，先把水喝了",
  "打字的间隙就够了，不用起身",
  "热水更好，凉的也行，别不喝",
  "关节不会大声抗议，它只会等你想起来",
  "五分钟后你要接下一个会，趁现在",
  "身体里的水正在被咖啡带走，补一杯回来",
  "工位上那杯昨晚泡的茶，喝完它",
  "痛风人比普通人多需要 800ml，不为难自己",
  "站起来去接水的那一分钟，是给腰的假",
  "别等口渴，口渴时血尿酸已经飙起来了",
  "开会时手边有杯水，全场只有你听见的关照",
  "PRD 写完这段就去接水",
  "痛的代价太贵，一杯水不贵",
  "写代码到卡壳时，起身接水正好清脑",
  "OKR 再紧，也不比膝盖紧",
  "现在的你，比昨晚的你多喝了几口",
  "水杯离你只有一步远，值这一步"
];

const gotLock = app.requestSingleInstanceLock();
if(!gotLock){
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let miniWindow = null;
let tray = null;
let whisperTimer = null;
let pauseUntil = 0;
let firstCloseHintShown = false;
let quitting = false;
let lastWhisperIdx = -1;

const userDataDir = app.getPath("userData");
const statePath = path.join(userDataDir, "runn-state.json");

const SAFE_MAX = 3500;

const DEFAULT_STATE = {
  today: todayKey(),
  ml: 0,
  cups: 0,
  target: 2500,
  streak: 0,
  history: [],
  checkins: [],
  status: "focus",
  interval: 45,
  meetingAutoBack: 60,
  lastCheckinTs: 0,
  firstRun: true
};

let meetingBackAt = 0;

let state = loadState();

function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function loadState(){
  try{
    if(!fs.existsSync(statePath)) return {...DEFAULT_STATE};
    const raw = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const merged = {...DEFAULT_STATE, ...raw};
    if(merged.today !== todayKey()){
      if(merged.ml > 0){
        merged.history = merged.history || [];
        merged.history.unshift({date: merged.today, ml: merged.ml, met: merged.ml >= merged.target});
        merged.history = merged.history.slice(0, 30);
      }
      merged.streak = merged.ml >= merged.target ? (merged.streak||0) + 1 : 0;
      merged.today = todayKey();
      merged.ml = 0;
      merged.cups = 0;
    }
    return merged;
  }catch(e){
    console.error("状态载入失败，使用默认值", e);
    return {...DEFAULT_STATE};
  }
}

function saveState(){
  try{
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
  }catch(e){
    console.error("状态保存失败", e);
  }
}

function predictedDays(){
  const base = 14;
  const bonus = Math.min(60, state.streak*4 + Math.round(state.ml/state.target*8));
  return base + bonus;
}

function pushState(){
  const payload = {...state, predictedDays: predictedDays()};
  if(mainWindow && !mainWindow.isDestroyed()){
    mainWindow.webContents.send("state:update", payload);
  }
  if(miniWindow && !miniWindow.isDestroyed()){
    miniWindow.webContents.send("state:update", payload);
  }
  updateTrayMenu();
}

function pickWhisper(){
  let idx;
  let tries = 0;
  do{
    idx = Math.floor(Math.random() * WHISPERS.length);
    tries++;
  }while(idx === lastWhisperIdx && tries < 6);
  lastWhisperIdx = idx;
  return WHISPERS[idx];
}

function loadTrayIcon(){
  const trayPath = path.join(__dirname, "assets", "tray.png");
  if(fs.existsSync(trayPath)){
    const img = nativeImage.createFromPath(trayPath);
    if(process.platform === "darwin") img.setTemplateImage(false);
    return img;
  }
  return nativeImage.createEmpty();
}

function loadAppIcon(){
  const iconPath = path.join(__dirname, "assets", "icon.png");
  if(fs.existsSync(iconPath)) return nativeImage.createFromPath(iconPath);
  return undefined;
}

function createMainWindow(){
  if(mainWindow && !mainWindow.isDestroyed()){
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  const icon = loadAppIcon();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    frame: false,
    show: false,
    backgroundColor: "#f4f1ea",
    title: "润 Runn",
    icon: icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "main.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("close", (e) => {
    if(!quitting){
      e.preventDefault();
      mainWindow.hide();
      if(!firstCloseHintShown){
        firstCloseHintShown = true;
        try{
          new Notification({
            title: "润 · Runn",
            body: "已缩到托盘继续陪着你 · 右键托盘图标可完全退出",
            silent: true,
            icon: loadAppIcon()
          }).show();
        }catch(e){}
      }
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    shell.openExternal(url);
    return {action: "deny"};
  });
}

function showMiniWindow(force){
  if(!force){
    if(state.status === "meeting") return;
    if(Date.now() < pauseUntil) return;
    const hour = new Date().getHours();
    if(hour < 6 || hour >= 24) return;
  }

  if(miniWindow && !miniWindow.isDestroyed()){
    miniWindow.webContents.send("notify:whisper", pickWhisper());
    miniWindow.show();
    miniWindow.focus();
    return;
  }

  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const W = 340, H = 200;
  const margin = 16;

  miniWindow = new BrowserWindow({
    width: W,
    height: H,
    x: workArea.x + workArea.width - W - margin,
    y: workArea.y + workArea.height - H - margin,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    focusable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  miniWindow.setAlwaysOnTop(true, "floating");
  miniWindow.loadFile(path.join(__dirname, "renderer", "mini.html"));

  miniWindow.once("ready-to-show", () => {
    miniWindow.show();
    miniWindow.webContents.send("notify:whisper", pickWhisper());
  });

  miniWindow.on("closed", () => {
    miniWindow = null;
  });
}

function scheduleWhisper(){
  if(whisperTimer) clearInterval(whisperTimer);
  const intervalMs = state.interval * 60 * 1000;
  whisperTimer = setInterval(() => {
    if(state.ml >= state.target && Math.random() > 0.35) return;
    showMiniWindow();
  }, intervalMs);
}

function updateTrayMenu(){
  if(!tray) return;
  const startupEnabled = getStartupEnabled();
  const menu = Menu.buildFromTemplate([
    {label: `今日 ${state.ml} / ${state.target} ml`, enabled: false},
    {label: `连续达标 ${state.streak} 天 · 预测 ${predictedDays()} 天无发作`, enabled: false},
    {type: "separator"},
    {label: "打开主界面", click: () => createMainWindow()},
    {label: "现在提醒我", click: () => showMiniWindow(true)},
    {type: "separator"},
    {
      label: "工作状态",
      submenu: [
        {label: "会议中（静默）", type: "radio", checked: state.status === "meeting", click: () => setStatus("meeting")},
        {label: "深度专注", type: "radio", checked: state.status === "focus", click: () => setStatus("focus")},
        {label: "空隙时刻", type: "radio", checked: state.status === "break", click: () => setStatus("break")}
      ]
    },
    {
      label: "提醒间隔",
      submenu: [30, 45, 60, 90].map(v => ({
        label: `每 ${v} 分钟`,
        type: "radio",
        checked: state.interval === v,
        click: () => { state.interval = v; saveState(); scheduleWhisper(); pushState(); }
      }))
    },
    {label: "暂停一小时", click: () => { pauseUntil = Date.now() + 3600*1000; }},
    {type: "separator"},
    {label: "开机自启", type: "checkbox", checked: startupEnabled, click: () => toggleStartup()},
    {label: "关于 · 润 Runn", click: () => createMainWindow()},
    {type: "separator"},
    {label: "退出", click: () => quitApp()}
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`润 Runn · 今日 ${state.ml}/${state.target} ml`);
}

function setStatus(status){
  state.status = status;
  if(status === "meeting" && state.meetingAutoBack > 0){
    meetingBackAt = Date.now() + state.meetingAutoBack * 60 * 1000;
  }else{
    meetingBackAt = 0;
  }
  saveState();
  pushState();
}

function getStartupEnabled(){
  try{
    return app.getLoginItemSettings().openAtLogin;
  }catch(e){
    return false;
  }
}

function toggleStartup(){
  const current = getStartupEnabled();
  try{
    app.setLoginItemSettings({
      openAtLogin: !current,
      openAsHidden: true,
      path: process.execPath,
      args: ["--hidden"]
    });
  }catch(e){
    console.error("开机自启设置失败", e);
  }
  updateTrayMenu();
  pushState();
  return !current;
}

function quitApp(){
  quitting = true;
  saveState();
  if(mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  if(miniWindow && !miniWindow.isDestroyed()) miniWindow.destroy();
  app.quit();
}

app.on("second-instance", () => {
  createMainWindow();
});

app.whenReady().then(() => {
  const trayIcon = loadTrayIcon();
  tray = new Tray(trayIcon);
  tray.setToolTip("润 Runn");
  updateTrayMenu();
  tray.on("click", () => {
    if(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()){
      mainWindow.hide();
    }else{
      createMainWindow();
    }
  });
  tray.on("double-click", () => createMainWindow());

  const args = process.argv || [];
  const startHidden = args.includes("--hidden");
  if(!startHidden){
    createMainWindow();
  }

  if(state.firstRun){
    state.firstRun = false;
    saveState();
    try{
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
        path: process.execPath,
        args: ["--hidden"]
      });
    }catch(e){}
  }

  scheduleWhisper();

  setInterval(() => {
    if(state.today !== todayKey()){
      state = loadState();
      pushState();
    }
    if(state.status === "meeting" && meetingBackAt > 0 && Date.now() >= meetingBackAt){
      setStatus("focus");
      try{
        new Notification({
          title: "润 · Runn",
          body: "会议应该散了,润回来了。有空喝一口",
          silent: true,
          icon: loadAppIcon()
        }).show();
      }catch(e){}
      showMiniWindow(true);
    }
  }, 60*1000);
});

app.on("window-all-closed", (e) => {
  e.preventDefault();
});

app.on("before-quit", () => {
  quitting = true;
  saveState();
});

ipcMain.handle("state:get", () => ({...state, predictedDays: predictedDays(), startupEnabled: getStartupEnabled()}));

ipcMain.handle("checkin", (_e, {ml}) => {
  ml = parseInt(ml, 10) || 0;
  if(ml <= 0) return {ok: false};
  const before = state.ml;
  state.ml += ml;
  state.cups += 1;
  state.checkins = state.checkins || [];
  state.checkins.push({ml, ts: Date.now()});
  state.lastCheckinTs = Date.now();
  saveState();
  pushState();
  let alert = null;
  if(state.ml >= SAFE_MAX && before < SAFE_MAX){
    alert = {kind: "overdrink", text: `今日已 ${state.ml}ml，痛风人一天不建议超 ${SAFE_MAX}ml，剩下的留给明天`};
  }else if(state.ml >= state.target && before < state.target){
    alert = {kind: "goal", text: "今日饮水达标 · 关节镇会记住这一天"};
  }
  return {ok: true, ml: state.ml, cups: state.cups, predictedDays: predictedDays(), alert};
});

ipcMain.handle("checkin:undo", () => {
  const list = state.checkins || [];
  if(list.length === 0) return {ok: false, reason: "empty"};
  const last = list.pop();
  state.ml = Math.max(0, state.ml - last.ml);
  state.cups = Math.max(0, state.cups - 1);
  saveState();
  pushState();
  return {ok: true, undone: last.ml, ml: state.ml, cups: state.cups};
});

ipcMain.handle("status:set", (_e, {status}) => {
  if(!["meeting","focus","break"].includes(status)) return {ok: false};
  setStatus(status);
  if(status === "break"){
    setTimeout(() => showMiniWindow(true), 600);
  }
  return {ok: true, status};
});

ipcMain.handle("interval:set", (_e, {interval}) => {
  state.interval = parseInt(interval, 10) || 45;
  saveState();
  scheduleWhisper();
  pushState();
  return {ok: true, interval: state.interval};
});

ipcMain.handle("meetingAutoBack:set", (_e, {minutes}) => {
  const v = parseInt(minutes, 10);
  state.meetingAutoBack = isNaN(v) ? 60 : v;
  if(state.status === "meeting"){
    meetingBackAt = state.meetingAutoBack > 0 ? Date.now() + state.meetingAutoBack*60*1000 : 0;
  }
  saveState();
  pushState();
  return {ok: true, meetingAutoBack: state.meetingAutoBack};
});

ipcMain.handle("target:set", (_e, {target}) => {
  state.target = Math.max(500, parseInt(target, 10) || 2500);
  saveState();
  pushState();
  return {ok: true, target: state.target};
});

ipcMain.handle("startup:toggle", () => ({enabled: toggleStartup()}));
ipcMain.handle("startup:get", () => ({enabled: getStartupEnabled()}));

ipcMain.handle("notify:request", () => ({granted: true}));

ipcMain.handle("mini:dismiss", (_e, {snooze}) => {
  if(snooze && typeof snooze === "number"){
    pauseUntil = Date.now() + snooze*60*1000;
  }
  if(miniWindow && !miniWindow.isDestroyed()){
    miniWindow.hide();
    setTimeout(() => {
      if(miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
    }, 200);
  }
  return {ok: true};
});

ipcMain.handle("mini:preview", () => { showMiniWindow(true); return {ok: true}; });
ipcMain.handle("main:open", () => { createMainWindow(); return {ok: true}; });
ipcMain.handle("main:hide", () => {
  if(mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  return {ok: true};
});
ipcMain.handle("main:minimize", () => {
  if(mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
  return {ok: true};
});

ipcMain.handle("app:attemptQuit", () => ({ok: true, requireConfirm: true}));
ipcMain.handle("app:quit", () => { quitApp(); return {ok: true}; });

ipcMain.handle("pause:oneHour", () => {
  pauseUntil = Date.now() + 3600*1000;
  return {ok: true, pauseUntil};
});
