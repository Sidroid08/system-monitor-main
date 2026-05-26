export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoredInstance {
  id: string;
  organizationId: string;
  awsAccountId?: string;
  instanceId: string;
  instanceName?: string;
  hostname?: string;
  privateIp?: string;
  publicIp?: string;
  platform: 'LINUX' | 'WINDOWS';
  serviceType: 'EC2' | 'VM' | 'BARE_METAL' | 'CONTAINER';
  region?: string;
  status: 'RUNNING' | 'STOPPED' | 'TERMINATED' | 'UNKNOWN';
  orgLabel?: string;
  serviceLabel?: string;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Metric {
  timestamp: number;
  value: number;
  unit?: string;
}

export interface MetricsData {
  cpu: Metric[];
  memory: Metric[];
  disk: Metric[];
  network: Metric[];
  load: Metric[];
}

export interface Alert {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source?: string;
  metricName?: string;
  instanceId?: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  triggeredAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardPreferences {
  organizationId: string;
  selectedInstances: string[];
  metrics: string[];
  refreshInterval: number;
  theme: 'light' | 'dark';
}

export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password?: string;
}

export interface RegisterPayload {
  email: string;
  password?: string;
  name: string;
}
