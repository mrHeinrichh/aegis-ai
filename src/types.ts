export type Finding = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  path?: string;
  evidence: string;
  recommendation: string;
  quarantinable?: boolean;
  quarantined?: boolean;
};
export type Scan = {
  id: string;
  startedAt: string;
  finishedAt: string;
  root: string;
  scanned: number;
  skipped: number;
  status: string;
  engine: string;
  findings: Finding[];
  warnings: string[];
};
export type Diagnostics = {
  platform: string;
  hostname: string;
  os: string;
  cpu: {
    brand: string;
    usage: number;
    cores: number;
    temperature: number | null;
  };
  memory: { total: number; used: number; percent: number };
  disks: {
    name: string;
    total: number;
    used: number;
    percent: number;
    smart: string;
  }[];
  battery: { available: boolean; percent: number; charging: boolean };
  processes: { pid: number; name: string; cpu: number; memory: number }[];
  network: Network;
  findings: Finding[];
  limitations: string[];
};
export type Network = {
  checkedAt?: string;
  interfaces: { name: string; address: string; mac?: string }[];
  gateway: string | null;
  connections: {
    protocol: string;
    local: string;
    remote: string;
    state: string;
    process: string;
  }[];
  findings?: Finding[];
  limitations?: string[];
};
export type Provider = {
  id: string;
  name: string;
  available: boolean;
  authenticated: boolean | null;
  detail: string;
};
export type Engine = {
  id: string;
  name: string;
  available: boolean;
  detail: string;
};
export type Quarantine = {
  id: string;
  findingId?: string;
  originalPath?: string;
  path?: string;
  quarantinedAt?: string;
  title?: string;
  restoredAt?: string;
  [key: string]: unknown;
};
export type Progress = { scanned: number; current: string; status: string };
export type Settings = {
  autoQuarantine: boolean;
  watchDownloads: boolean;
  watchNetwork: boolean;
};
export type CleanupItem = {
  id: string;
  path: string;
  size: number;
  modified: string;
};
export interface AegisApi {
  call<T = unknown>(action: string, payload?: unknown): Promise<T>;
  onEvent(
    callback: (event: { type: string; data: unknown }) => void,
  ): () => void;
}
declare global {
  interface Window {
    aegis?: AegisApi;
  }
}
