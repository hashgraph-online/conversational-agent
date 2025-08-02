import { contextBridge } from 'electron';

console.log('=== PRELOAD SCRIPT RUNNING ===');

contextBridge.exposeInMainWorld('electron', {
  test: () => 'IT WORKS!'
});

console.log('=== PRELOAD COMPLETE ===');