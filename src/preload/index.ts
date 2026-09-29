import { contextBridge } from 'electron';
import { createFsiApi } from './api';

declare const __IS_DEV__: boolean | undefined;
const isDev = typeof __IS_DEV__ !== 'undefined' ? __IS_DEV__ : process.env.NODE_ENV !== 'production';

contextBridge.exposeInMainWorld('fsi', createFsiApi(isDev));
