export type ServerStatus = "active" | "disabled" | "deprecated";
export type Transport = "stdio" | "sse" | "http";
export type RiskLevel = "low" | "medium" | "high";
export type ApprovalStatus = "pending" | "approved" | "denied";
export type HealthStatus = "healthy" | "unhealthy" | "unknown";
export type Action = "discover" | "invoke" | "manage";

export interface McpServer {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  transport: Transport;
  owner: string;
  tags: string[];
  status: ServerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Tool {
  id: string;
  serverId: string;
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema: unknown | null;
  version: string;
  tags: string[];
  riskLevel: RiskLevel;
}

export interface Role {
  id: string;
  name: string;
}

export interface Permission {
  id: string;
  roleId: string;
  resource: string; // "*", server id, or tool id
  action: Action;
}

export interface RoleAssignment {
  id: string;
  principalId: string;
  roleId: string;
}

export interface HealthCheck {
  id: string;
  serverId: string;
  timestamp: string;
  status: HealthStatus;
  latencyMs: number;
  error: string | null;
}

export interface VersionRecord {
  id: string;
  toolId: string;
  version: string;
  changelog: string;
  createdAt: string;
}

export interface UsageEvent {
  id: string;
  principalId: string;
  toolId: string;
  serverId: string;
  timestamp: string;
  durationMs: number;
  success: boolean;
}

export interface ApprovalRequest {
  id: string;
  principalId: string;
  toolId: string;
  reason: string;
  status: ApprovalStatus;
  reviewedBy: string | null;
  createdAt: string;
  reviewedAt: string | null;
}
