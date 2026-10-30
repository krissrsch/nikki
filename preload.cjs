const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = (channel) => (cb) => ipcRenderer.on(channel, (_e, data) => cb(data));

contextBridge.exposeInMainWorld('companion', {
  getState: () => ipcRenderer.invoke('get-state'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  branch: (cwd) => ipcRenderer.invoke('branch', cwd), // `git branch --show-current` or null
  toggleFavorite: (_backend, modelId) => ipcRenderer.invoke('toggle-favorite', { modelId }),
  setModel: (cwd, _backend, model) => ipcRenderer.invoke('set-model', { cwd, model }),
  chatsList: () => ipcRenderer.invoke('chats-list'),
  chatsSave: (chat) => ipcRenderer.invoke('chats-save', chat),
  chatsDelete: (id) => ipcRenderer.invoke('chats-delete', id),
  setLastChat: (id) => ipcRenderer.invoke('set-last-chat', id),
  start: (prompt, cwd, { newSession, plan, model, sessionId }) =>
    ipcRenderer.invoke('start', { prompt, cwd, newSession, plan, model, sessionId }),
  stop: () => ipcRenderer.send('stop'),
  // answer: { answer: 'allow' | 'always' | 'deny', picks?: string[][], message?: string, interrupt?: boolean }
  answerPermission: (id, answer) => ipcRenderer.send('permission-answer', { id, ...answer }),
  setClickThrough: (on) => ipcRenderer.send('click-through', on),
  setMuted: (muted) => ipcRenderer.send('set-muted', muted),
  focus: () => ipcRenderer.send('focus'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  pathForFile: (file) => webUtils.getPathForFile(file), // Electron 32+ has no File.path
  onTerminal: on('terminal'),
  onMuted: on('muted'),
  onStatus: on('status'),
  onSession: on('session'),
  onPermissionRequest: on('permission-request'),
  onPermissionCancel: on('permission-cancel'),
  onToggle: on('toggle'),
  onShow: on('show'),
  onPointer: on('pointer'), // mouse position for the eyes and click-through, { x, y } window-relative
});
