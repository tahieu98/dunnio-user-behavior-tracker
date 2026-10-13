'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('dunnioSettings',{save:input=>ipcRenderer.invoke('clarity-save',input)});
