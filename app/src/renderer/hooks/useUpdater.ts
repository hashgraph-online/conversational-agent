import { useState, useEffect, useCallback } from 'react';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export interface UpdateError {
  message: string;
  stack?: string;
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'not-available';

interface UpdaterHookReturn {
  updateState: UpdateState;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: UpdateError | null;
  currentVersion: string;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  openRepository: () => void;
}

/**
 * Hook to manage application updates via IPC communication with the main process
 */
export const useUpdater = (): UpdaterHookReturn => {
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<UpdateError | null>(null);
  const [currentVersion, setCurrentVersion] = useState('1.0.0');

  useEffect(() => {
    if (!window.electron) {
      console.warn('Electron APIs not available - update functionality disabled');
      return;
    }

    window.electron.ipcRenderer.invoke('get-app-version').then((version: string) => {
      setCurrentVersion(version);
    }).catch((err) => {
      console.error('Failed to get app version:', err);
    });

    const removeCheckingListener = window.electron.ipcRenderer.on('update:checking', () => {
      setUpdateState('checking');
      setError(null);
    });

    const removeAvailableListener = window.electron.ipcRenderer.on('update:available', (info: UpdateInfo) => {
      setUpdateState('available');
      setUpdateInfo(info);
      setError(null);
    });

    const removeNotAvailableListener = window.electron.ipcRenderer.on('update:not-available', () => {
      setUpdateState('not-available');
      setError(null);
    });

    const removeDownloadProgressListener = window.electron.ipcRenderer.on('update:download-progress', (progressInfo: UpdateProgress) => {
      setUpdateState('downloading');
      setProgress(progressInfo);
    });

    const removeDownloadedListener = window.electron.ipcRenderer.on('update:downloaded', () => {
      setUpdateState('downloaded');
      setProgress(null);
    });

    const removeErrorListener = window.electron.ipcRenderer.on('update:error', (errorInfo: UpdateError) => {
      setUpdateState('error');
      setError(errorInfo);
      setProgress(null);
    });

    return () => {
      removeCheckingListener();
      removeAvailableListener();
      removeNotAvailableListener();
      removeDownloadProgressListener();
      removeDownloadedListener();
      removeErrorListener();
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!window.electron) {
      console.warn('Electron APIs not available');
      return;
    }

    try {
      setUpdateState('checking');
      setError(null);
      await window.electron.ipcRenderer.invoke('check-for-updates');
    } catch (err) {
      console.error('Failed to check for updates:', err);
      setError({
        message: err instanceof Error ? err.message : 'Failed to check for updates'
      });
      setUpdateState('error');
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    if (!window.electron) {
      console.warn('Electron APIs not available');
      return;
    }

    try {
      setProgress(null);
      await window.electron.ipcRenderer.invoke('download-update');
    } catch (err) {
      console.error('Failed to download update:', err);
      setError({
        message: err instanceof Error ? err.message : 'Failed to download update'
      });
      setUpdateState('error');
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!window.electron) {
      console.warn('Electron APIs not available');
      return;
    }

    try {
      await window.electron.ipcRenderer.invoke('install-update');
    } catch (err) {
      console.error('Failed to install update:', err);
      setError({
        message: err instanceof Error ? err.message : 'Failed to install update'
      });
      setUpdateState('error');
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateState('idle');
    setUpdateInfo(null);
    setProgress(null);
    setError(null);
  }, []);

  const openRepository = useCallback(() => {
    if (!window.electron) {
      console.warn('Electron APIs not available');
      return;
    }

    window.electron.ipcRenderer.invoke('open-repository-url').catch((err) => {
      console.error('Failed to open repository:', err);
    });
  }, []);

  return {
    updateState,
    updateInfo,
    progress,
    error,
    currentVersion,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
    openRepository
  };
};