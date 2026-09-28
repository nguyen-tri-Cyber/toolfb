import type { DashboardStats, HealthStatus } from '@shared/types/ipc';
import { checkDatabaseHealth, getDashboardStats } from '../database';
import { metaService } from '../meta/meta.service';

export function getHealthStatus(): HealthStatus {
  let meta: HealthStatus['meta'] = 'DISCONNECTED';

  try {
    meta = metaService.getConnectionStatus().connected ? 'CONNECTED' : 'DISCONNECTED';
  } catch {
    meta = 'ERROR';
  }

  return {
    desktop: true,
    database: checkDatabaseHealth(),
    facebook: meta === 'CONNECTED',
    meta
  };
}

export function getDashboardStatistics(): DashboardStats {
  return getDashboardStats();
}
