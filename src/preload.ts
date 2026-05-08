/**
 * Preload script for Electron renderer process.
 * Exposes a safe, limited API to the renderer via contextBridge.
 * This script runs in a privileged context but can access the DOM.
 */

import { contextBridge, ipcRenderer } from 'electron';

/** Allowed IPC channels for sending messages to main process */
const ALLOWED_SEND_CHANNELS = [
  'window:minimize',
  'window:maximize',
  'window:close',
  'app:get-version',
  'dialog:open-file',
  'dialog:save-file',
] as const;

/** Allowed IPC channels for receiving messages from main process */
const ALLOWED_RECEIVE_CHANNELS = [
  'app:update-available',
  'app:update-downloaded',
  'window:maximize-changed',
] as const;

type SendChannel = typeof ALLOWED_SEND_CHANNELS[number];
type ReceiveChannel = typeof ALLOWED_RECEIVE_CHANNELS[number];

/**
 * Electron API exposed to the renderer process.
 * Only safe, whitelisted operations are available.
 */
const electronAPI = {
  /**
   * Send a one-way IPC message to the main process.
   */
  send: (channel: SendChannel, ...args: unknown[]): void => {
    if (ALLOWED_SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn(`[preload] Blocked send on unauthorized channel: ${channel}`);
    }
  },

  /**
   * Invoke a main-process handler and await the result.
   */
  invoke: async (channel: SendChannel, ...args: unknown[]): Promise<unknown> => {
    if (ALLOWED_SEND_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    console.warn(`[preload] Blocked invoke on unauthorized channel: ${channel}`);
    return undefined;
  },

  /**
   * Register a listener for messages from the main process.
   * Returns a cleanup function to remove the listener.
   */
  on: (
    channel: ReceiveChannel,
    listener: (...args: unknown[]) => void
  ): (() => void) => {
    if (ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
        listener(...args);
      ipcRenderer.on(channel, subscription);
      // Return a cleanup / unsubscribe function
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    console.warn(`[preload] Blocked listener on unauthorized channel: ${channel}`);
    return () => {};
  },

  /**
   * Returns the current application version string.
   */
  getAppVersion: (): Promise<string> =>
    ipcRenderer.invoke('app:get-version') as Promise<string>,
};

// Expose the API under `window.electron` in the renderer
contextBridge.exposeInMainWorld('electron', electronAPI);

// Type augmentation so TypeScript knows about window.electron in renderer files
export type ElectronAPI = typeof electronAPI;
