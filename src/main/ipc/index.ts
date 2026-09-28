import { registerDatabaseIpc } from './database.ipc';
import { registerContentIpc } from './content.ipc';
import { registerLeadsIpc } from './leads.ipc';
import { registerMetaIpc } from './meta.ipc';
import { registerPagesIpc } from './pages.ipc';
import { registerReportsIpc } from './reports.ipc';
import { registerSystemIpc } from './system.ipc';

export function registerIpcHandlers(): void {
  registerSystemIpc();
  registerDatabaseIpc();
  registerMetaIpc();
  registerPagesIpc();
  registerContentIpc();
  registerLeadsIpc();
  registerReportsIpc();
}
