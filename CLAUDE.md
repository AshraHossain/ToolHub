# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Development (ts-node, no compile step)
npm run dev

# Build TypeScript → dist/
npm run build

# Run compiled server
npm start

# Seed the database with 4 example MCP servers + tools
npm run seed

# Docker (persists data/ as a named volume)
docker-compose up
```

No test framework is configured yet. CI runs: `npm run build` → `npm run seed` → start server + `curl` smoke tests → Docker image build.

Server listens on port 3000 by default; override with `PORT=<n>`.

## Architecture

ToolHub is a REST API server that acts as a central registry and governance layer for MCP (Model Context Protocol) servers. Agents discover and invoke tools through ToolHub rather than connecting to MCP servers directly.

### Startup sequence

```
initSchema()           ← creates data/ dir + empty JSON files if absent
rbac.ensureDefaultRoles()  ← bootstraps admin + agent roles
createApp()            ← mounts all Express routes
startHealthMonitor(60_000) ← background setInterval health pings
```

### Request flow

```
Agent → POST /invoke (x-principal-id header)
           ↓
      requirePermission middleware (RBAC check)
           ↓
      approvals.checkApprovalRequired (blocks high/medium-risk tools without approved request)
           ↓
      mocked MCP tools/call (real implementation would proxy via @modelcontextprotocol/sdk)
           ↓
      analytics.logUsage (fire-and-forget)
```

### API surface

| Method | Route | Auth required | Purpose |
|---|---|---|---|
| `POST` | `/servers` | manage `*` | Register an MCP server |
| `GET` | `/servers` | — | List all servers |
| `PATCH` | `/servers/:id` | manage server | Update server metadata |
| `DELETE` | `/servers/:id` | manage server | Delete server + cascade-delete its tools |
| `POST` | `/servers/:id/tools` | manage server | Register a tool on a server |
| `GET` | `/tools` | — | List all tools |
| `GET` | `/discover` | discover `*` | Filter tools by `?tag=`, `?serverId=`, `?query=` |
| `POST` | `/invoke` | invoke tool | Call a tool (mocked); gated by RBAC + approvals |
| `GET` | `/health` | — | Overview of all server health |
| `GET` | `/servers/:id/health` | — | Latest + history for one server |
| `POST` | `/approvals` | — | Request approval to invoke a medium/high-risk tool |
| `GET` | `/approvals` | manage `*` | List approval requests |
| `POST` | `/approvals/:id/decision` | manage `*` | Approve or deny a request |
| `GET` | `/analytics/usage` | — | Query usage events |
| `GET` | `/analytics/summary` | — | Aggregated usage summary |
| `GET` | `/tools/:id/versions` | — | Version history for a tool |
| `POST` | `/tools/:id/versions` | manage tool | Append a version record |
| `GET` | `/roles` | — | List roles |
| `POST` | `/roles` | manage `*` | Create a role |
| `POST` | `/roles/:id/permissions` | manage `*` | Add permission to a role |
| `POST` | `/roles/:id/assign` | manage `*` | Assign role to a principal |
| `GET` | `/principals/:id/permissions` | — | List a principal's resolved permissions |

`requirePermission` resolves the resource from the request (body or path param) and calls `rbac.isAllowed(principalId, resource, action)`. The `resource` value `"*"` matches any wildcard permission.

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

### Key design constraints

- **No live MCP connections** — invocation (`POST /invoke`) returns a mocked response. Real forwarding via `@modelcontextprotocol/sdk` is the primary next-step extension.
- **JSON-file storage** — `store` in `src/db/database.ts` is the only persistence abstraction; it keeps an in-memory cache and flushes to `data/<table>.json` on every write. The `data/` directory is created on `initSchema()`.
- **Principal identity is a plain string header** — `x-principal-id` is not validated or cryptographically verified. RBAC logic is real but auth is intentionally minimal for the MVP.
- **Approval gating** — `riskLevel: "high"` or `"medium"` tools require a separate `POST /approvals` + admin decision before `POST /invoke` succeeds for a given principal.

## Framework conventions

This project follows the SuperClaude Framework structure adopted across the
portfolio:

- **`PLANNING.md`** is the source-of-truth architecture doc — keep it in
  sync with the Architecture section of this file when either changes.
- **`TASK.md`** holds the priority-ordered task list; check it before
  picking up new work.
- **`plugins/`** is the reserved extension point for replacing the mocked
  MCP invocation with a real `@modelcontextprotocol/sdk` transport adapter —
  see `plugins/README.md`.
- **`CONTRIBUTING.md`** documents the development setup (`npm install`,
  `npm run dev`/`npm run build`) for contributors.
- Line endings are pinned to LF via `.gitattributes`.
