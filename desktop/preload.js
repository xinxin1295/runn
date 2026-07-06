const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("runn", {
  getState: () => ipcRenderer.invoke("state:get"),
  checkin: (ml) => ipcRenderer.invoke("checkin", {ml}),
  undoLastCheckin: () => ipcRenderer.invoke("checkin:undo"),
  setStatus: (status) => ipcRenderer.invoke("status:set", {status}),
  setInterval: (interval) => ipcRenderer.invoke("interval:set", {interval}),
  setMeetingAutoBack: (minutes) => ipcRenderer.invoke("meetingAutoBack:set", {minutes}),
  setTarget: (target) => ipcRenderer.invoke("target:set", {target}),
  toggleStartup: () => ipcRenderer.invoke("startup:toggle"),
  getStartup: () => ipcRenderer.invoke("startup:get"),
  requestNotify: () => ipcRenderer.invoke("notify:request"),
  dismissMini: (payload) => ipcRenderer.invoke("mini:dismiss", payload || {}),
  resizeMini: (h) => ipcRenderer.invoke("mini:resize", {h}),
  previewMini: () => ipcRenderer.invoke("mini:preview"),
  openMain: () => ipcRenderer.invoke("main:open"),
  hideMain: () => ipcRenderer.invoke("main:hide"),
  minimizeMain: () => ipcRenderer.invoke("main:minimize"),
  attemptQuit: () => ipcRenderer.invoke("app:attemptQuit"),
  confirmQuit: () => ipcRenderer.invoke("app:quit"),
  pauseOneHour: () => ipcRenderer.invoke("pause:oneHour"),
  onStateUpdate: (cb) => {
    const handler = (_e, s) => cb(s);
    ipcRenderer.on("state:update", handler);
    return () => ipcRenderer.removeListener("state:update", handler);
  },
  onWhisper: (cb) => {
    const handler = (_e, text) => cb(text);
    ipcRenderer.on("notify:whisper", handler);
    return () => ipcRenderer.removeListener("notify:whisper", handler);
  }
});
