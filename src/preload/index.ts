import { contextBridge } from 'electron';
import { fsiApi } from './api';

contextBridge.exposeInMainWorld('fsi', fsiApi);
