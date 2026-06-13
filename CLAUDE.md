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
```

No test framework is configured yet.

## Architecture

ToolHub is a REST API server that acts as a central registry and governance layer for MCP (Model Context Protocol) servers. Agents discover and invoke tools through ToolHub rather than connecting to MCP servers directly.

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
