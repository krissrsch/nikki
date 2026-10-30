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
  // a message for a terminal session that still works; Claude gets it when its turn ends (Stop hook)
  queueMessage: (sessionId, text) => ipcRenderer.invoke('queue-message', { sessionId, text }),
  setClickThrough: (on) => ipcRenderer.send('click-through', on),
  settingsGet: () => ipcRenderer.invoke('settings-get'),
  // returns all settings again, plus error: 'taken' | 'invalid' when a hotkey did not take
  settingsSet: (key, value) => ipcRenderer.invoke('settings-set', key, value),
  focus: () => ipcRenderer.send('focus'),
  // module data: userData/modules/<id>.json (null when there is none yet); set resolves false when it was not saved
  moduleGet: (id) => ipcRenderer.invoke('module-get', id),
  moduleSet: (id, data) => ipcRenderer.invoke('module-set', id, data),
  toast: (text) => ipcRenderer.send('toast', text), // Windows toast even while the island can be seen
  // music: what Windows plays and the volume, from helper/NikkiHelper.exe while the music module is on
  mediaGet: () => ipcRenderer.invoke('media-get'), // { media: { title, artist, app, status, position, duration, updatedAt, cover } | null, volume: { level, muted } | null }
  media: (cmd, value) => ipcRenderer.send('media-cmd', cmd, value), // toggle | next | prev | mute | unmute | volume (0-100)
  onMedia: on('media'),
  onVolume: on('volume'),
  // shelf: copies in userData/shelf; the renderer names items by id, main does every file operation
  shelfList: () => ipcRenderer.invoke('shelf-list'), // [{ id, name, size, path?, thumb?, text? }]
  shelfAdd: (paths) => ipcRenderer.invoke('shelf-add', paths), // { items, errors }
  shelfAddText: (text) => ipcRenderer.invoke('shelf-add-text', text), // { items, errors }
  shelfClear: () => ipcRenderer.invoke('shelf-clear'), // { items, errors }
  shelfOpen: (id) => ipcRenderer.invoke('shelf-open', id), // '' or why not
  shelfDrag: (ids) => ipcRenderer.send('shelf-drag', ids), // start dragging these files out of the island
  openExternal: (url) => ipcRenderer.send('open-external', url),
  pathForFile: (file) => webUtils.getPathForFile(file), // Electron 32+ has no File.path
  onTerminal: on('terminal'),
  onStatus: on('status'),
  onSession: on('session'),
  onPermissionRequest: on('permission-request'),
  onPermissionCancel: on('permission-cancel'),
  onQueued: on('queued'), // { sessionId, text | null (delivered) }
  onToggle: on('toggle'),
  onShow: on('show'), // data: the page to open on, or undefined
  onPointer: on('pointer'), // mouse position for the eyes and click-through, { x, y } window-relative
});
