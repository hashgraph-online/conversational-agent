import { contextBridge } from 'electron';

console.log('=== PRELOAD SCRIPT EXECUTING ===');

contextBridge.exposeInMainWorld('electronTest', {
  ping: () => 'pong',
  isWorking: true
});

console.log('=== PRELOAD SCRIPT COMPLETE ===');