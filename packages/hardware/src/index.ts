/**
 * C3 Hardware Package
 * Interface definition for local resource inspection.
 */

import { HardwareService, HardwareInfo } from '@c3/contracts';

export type { HardwareService, HardwareInfo };

export interface HardwareInspectorAdapter {
  inspect(): Promise<HardwareInfo>;
}
