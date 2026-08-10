# PLANNING.md — ToolHub

## What this is

ToolHub is a REST API server that acts as a central registry and governance
layer for MCP (Model Context Protocol) servers. Agents (e.g. NexusAI)
discover and invoke tools through ToolHub rather than connecting to MCP
servers directly — ToolHub adds RBAC, approval gating, health monitoring,
versioning, and usage analytics on top of the raw MCP surface.

## Architecture

### Startup sequence

```
initSchema()                ← creates data/ dir + empty JSON files if absent
rbac.ensureDefaultRoles()   ← bootstraps admin + agent roles
createApp()                 ← mounts all Express routes
startHealthMonitor(60_000)  ← background setInterval health pings
```

### Request flow

```
Agent → POST /invoke (x-principal-id header)
           │
           ▼
      requirePermission middleware (RBAC check)
           │
           ▼
      approvals.checkApprovalRequired (blocks high/medium-risk tools without approved request)
           │
           ▼
      mocked MCP tools/call (real implementation would proxy via @modelcontextprotocol/sdk)
           │
           ▼
      analytics.logUsage (fire-and-forget)
```

### Module responsibilities

| Module | Path | Purpose |
|---|---|---|
| `db/database` | `src/db/database.ts` | In-memory + JSON-file persistence. `store` object is the only data access layer — no SQL, no ORM. Data lives in `data/*.json` files. |
| `registry` | `src/registry/registry.ts` | CRUD for `McpServer` and `Tool` records. `registerTool` auto-creates an initial `VersionRecord`. `deleteServer` cascades to tools. |
| `rbac` | `src/rbac/rbac.ts` | Roles, permissions, and principal assignments. `isAllowed(principalId, resource, action)` is the single permission check. Two default roles bootstrapped on startup: `admin` (full access) and `agent` (discover + invoke). |
| `health` | `src/health/health.ts` | Simulated health pings stored as `HealthCheck` records. Background monitor runs every 60s via `setInterval`. Active servers are reported "healthy"; disabled/deprecated return "unknown". |
| `discovery` | `src/discovery/discovery.ts` | Filters tools by tag, serverId, and free-text query. Only returns tools from `active` servers by default. `refreshServerTools` is a no-op stub. |
| `versioning` | `src/versioning/versioning.ts` | Append-only version history per tool. |
| `analytics` | `src/analytics/analytics.ts` | `UsageEvent` logging and summary queries. |
| `approvals` | `src/approvals/approvals.ts` | Tools with `riskLevel` of `medium` or `high` block invocation until an `ApprovalRequest` for that principal+tool is set to `approved`. |
| `api/server` | `src/api/server.ts` | Express router wiring all modules. Principal identity comes from `x-principal-id` header (no real auth). |
| `seed` | `src/seed.ts` | Populates 4 demo servers (GitHub, Jira, Slack, SQL) with representative tools. Run once on a fresh `data/` directory. |

### Permission model

`requirePermission` resolves the resource from the request (body or path
param) and calls `rbac.isAllowed(principalId, resource, action)`. The
`resource` value `"*"` matches any wildcard permission. Two default roles are
bootstrapped at startup: `admin` (`manage`/`discover`/`invoke` on `*`) and
`agent` (`discover`/`invoke` on `*`).

## Key design constraints

- **No live MCP connections** — invocation (`POST /invoke`) returns a mocked
  response. Real forwarding via `@modelcontextprotocol/sdk` (stdio/sse/http
  transports) is the primary next-step extension.
- **JSON-file storage** — `store` in `src/db/database.ts` is the only
  persistence abstraction; it keeps an in-memory cache and flushes to
  `data/<table>.json` on every write. The `data/` directory is created on
  `initSchema()`.
- **Principal identity is a plain string header** — `x-principal-id` is not
  validated or cryptographically verified. RBAC logic is real but auth is
  intentionally minimal for the MVP.
- **Approval gating** — `riskLevel: "high"` or `"medium"` tools require a
  separate `POST /approvals` + admin decision before `POST /invoke` succeeds
  for a given principal.

## Next steps (not yet done)

- Replace mocked `POST /invoke` and `/servers/:id/refresh` with real
  `@modelcontextprotocol/sdk` connections to registered servers (see
  `plugins/README.md`).
- Swap JSON-file `store` for a SQL-backed implementation without changing
  module APIs.
- No test framework configured yet — `npm run build && npm run seed` plus
  the CI smoke-test curl checks are the current verification path.
