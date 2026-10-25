const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = (channel) => (cb) => ipcRenderer.on(channel, (_e, data) => cb(data));

contextBridge.exposeInMainWorld('companion', {
  getState: () => ipcRenderer.invoke('get-state'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  branch: (cwd) => ipcRenderer.invoke('branch', cwd),
  gitStatus: (cwd) => ipcRenderer.invoke('git-status', cwd),
  gitOpenRemote: (cwd) => ipcRenderer.invoke('git-open-remote', cwd),
  openAiStudio: (text) => ipcRenderer.invoke('open-aistudio', { text }),
  cursorModels: () => ipcRenderer.invoke('cursor-models'),
  toggleFavorite: (backend, modelId) => ipcRenderer.invoke('toggle-favorite', { backend, modelId }),
  setModel: (cwd, backend, model) => ipcRenderer.invoke('set-model', { cwd, backend, model }),
  chatsList: () => ipcRenderer.invoke('chats-list'),
  chatsSave: (chat) => ipcRenderer.invoke('chats-save', chat),
  chatsDelete: (id) => ipcRenderer.invoke('chats-delete', id),
  setLastChat: (id) => ipcRenderer.invoke('set-last-chat', id),
  start: (prompt, cwd, { newSession, plan, model, backend, sessionId }) =>
    ipcRenderer.invoke('start', { prompt, cwd, newSession, plan, model, backend, sessionId }),
  stop: () => ipcRenderer.send('stop'),
  // answer: { answer: 'allow' | 'always' | 'deny', picks?: string[][], message?: string }
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
  onCursor: on('cursor'),
});
