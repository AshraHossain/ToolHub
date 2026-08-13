# ToolHub — MCP Tool Registry & Marketplace

> **Implementation note:** this is the original design doc; two details below
> shipped differently. Storage is JSON-file-based (`src/db/database.ts`), not
> SQLite/better-sqlite3. The `/discover` endpoint takes `tag`/`serverId`/`query`
> params, not `tag`/`server`/`capability`. See [PLANNING.md](../PLANNING.md)
> for the current, code-derived architecture.

## Elevator Pitch
ToolHub is an MCP-native registry where agents (e.g. NexusAI) dynamically discover, authenticate to, and invoke tools exposed by registered MCP servers — with governance (RBAC, approvals, health, versioning, analytics) built in.

## Problem
Agents today are hardcoded to specific tool integrations. Enterprises need a central place to register MCP servers, control who/what can call which tools, monitor availability, and track usage — without redeploying agents every time a tool changes.

## Goals
- Single source of truth for "what MCP servers and tools exist, and what do they do"
- Agents discover capabilities at runtime via ToolHub's API instead of static config
- Admins control access via roles/permissions and approval workflows
- Operators get health/version/usage visibility

## High-Level Architecture

```
                ┌─────────────┐
                │   NexusAI    │  (or any MCP-capable agent)
                └──────┬───────┘
                       │ REST/JSON (discover, invoke, auth)
                       ▼
                ┌─────────────────────────────────────────┐
                │                ToolHub                    │
                │  ┌───────────┐ ┌───────────┐ ┌─────────┐ │
                │  │ Registry  │ │ Discovery │ │  RBAC   │ │
                │  └───────────┘ └───────────┘ └─────────┘ │
                │  ┌───────────┐ ┌───────────┐ ┌─────────┐ │
                │  │  Health   │ │ Versioning│ │Analytics│ │
                │  └───────────┘ └───────────┘ └─────────┘ │
                │  ┌────────────────────┐                  │
                │  │ Approval Workflow   │                  │
                │  └────────────────────┘                  │
                │  ┌────────────────────┐                  │
                │  │  SQLite storage     │                  │
                │  └────────────────────┘                  │
                └──────────────┬────────────────────────────┘
                                │ MCP protocol (tools/list, tools/call)
            ┌───────────────────┼────────────────────┬───────────────┐
            ▼                   ▼                    ▼               ▼
     GitHub MCP Server   Jira MCP Server      Slack MCP Server   SQL MCP Server
```

## Data Models

### McpServer
| field | type | notes |
|---|---|---|
| id | string (uuid) | |
| name | string | e.g. "GitHub MCP Server" |
| description | string | |
| endpoint | string | URL or command for the MCP server |
| transport | enum | `stdio` \| `sse` \| `http` |
| owner | string | team/user responsible |
| tags | string[] | for discovery filtering |
| status | enum | `active` \| `disabled` \| `deprecated` |
| createdAt / updatedAt | datetime | |

### Tool (Capability)
| field | type | notes |
|---|---|---|
| id | string (uuid) | |
| serverId | string | FK → McpServer |
| name | string | tool name as exposed by MCP server |
| description | string | |
| inputSchema | json | JSON Schema |
| outputSchema | json | optional |
| version | string | semver |
| tags | string[] | |
| riskLevel | enum | `low` \| `medium` \| `high` — drives approval requirement |

### Role / Permission (RBAC)
| field | type | notes |
|---|---|---|
| role.id / role.name | string | e.g. "agent-readonly", "admin" |
| permission | { resource, action } | resource = server/tool id or wildcard; action = `discover`\|`invoke`\|`manage` |
| roleAssignment | { principalId, roleId } | principal = agent or user |

### HealthCheck
| field | type | notes |
|---|---|---|
| serverId | string | |
| timestamp | datetime | |
| status | enum | `healthy`\|`unhealthy`\|`unknown` |
| latencyMs | number | |
| error | string? | |

### VersionRecord
| field | type | notes |
|---|---|---|
| toolId | string | |
| version | string | |
| changelog | string | |
| createdAt | datetime | |

### UsageEvent (Analytics)
| field | type | notes |
|---|---|---|
| id | string | |
| principalId | string | who invoked |
| toolId | string | |
| serverId | string | |
| timestamp | datetime | |
| durationMs | number | |
| success | boolean | |

### ApprovalRequest
| field | type | notes |
|---|---|---|
| id | string | |
| principalId | string | requester |
| toolId | string | |
| reason | string | |
| status | enum | `pending`\|`approved`\|`denied` |
| reviewedBy | string? | |
| createdAt / reviewedAt | datetime | |

## API Surface (REST/JSON)

### Registry
- `POST /servers` — register an MCP server
- `GET /servers` / `GET /servers/:id`
- `PATCH /servers/:id` — update/disable
- `DELETE /servers/:id`
- `POST /servers/:id/tools` — register tool metadata (or auto-populated via discovery)
- `GET /tools` / `GET /tools/:id`

### Discovery
- `GET /discover?tag=&server=&capability=` — list tools matching filters (capability discovery)
- `POST /servers/:id/refresh` — re-query server's `tools/list` and sync catalog

### RBAC
- `POST /roles`, `GET /roles`
- `POST /roles/:id/assign` — assign role to principal
- `GET /principals/:id/permissions`
- Middleware: every `/invoke` and `/discover` call checks permission

### Invocation (proxy)
- `POST /invoke` — `{ principalId, toolId, args }` → checks RBAC + approval status → proxies MCP `tools/call` → logs UsageEvent

### Health
- `GET /servers/:id/health`
- `GET /health` — overview of all servers
- Background job pings each server on interval

### Versioning
- `GET /tools/:id/versions`
- `POST /tools/:id/versions` — record new version + changelog

### Analytics
- `GET /analytics/usage?toolId=&principalId=&from=&to=`
- `GET /analytics/summary` — top tools, error rates, etc.

### Approvals
- `POST /approvals` — request access to a high-risk tool
- `GET /approvals?status=pending`
- `POST /approvals/:id/decision` — `{ approve: true|false }`

## Tech Stack (MVP)
- Node.js + TypeScript
- Express for REST API
- better-sqlite3 for storage (single-file DB, zero setup)
- `@modelcontextprotocol/sdk` for MCP client connections (discovery + invocation proxy)
- In-process scheduler (`setInterval`) for health checks

## MVP Scope (Full Feature Set, Simplified)
All eight features implemented with minimal-but-functional logic:
1. Registry — CRUD on servers & tools
2. Discovery — list/filter + refresh-from-server
3. RBAC — roles, permission checks on discover/invoke
4. Health monitoring — periodic ping + status endpoint
5. Versioning — version history per tool
6. Dynamic capability discovery — `/discover` + `/refresh`
7. Usage analytics — event logging + summary
8. Approval policies — request/approve/deny gating high-risk tools

Seed data includes four example MCP servers (GitHub, Jira, Slack, SQL) with placeholder tool metadata — these are mocked (not live connections) for the MVP demo since live credentials aren't available.

## Future Extensions
- Real MCP client connections (stdio/SSE) instead of mocked tool lists
- OAuth-based per-principal credential vaulting
- Web UI marketplace browsing
- Multi-tenant orgs
- Webhook notifications for approval requests
