# ToolHub — MCP Tool Registry & Marketplace

An MCP-native tool registry where agents (e.g. NexusAI) dynamically discover, authenticate to, and invoke tools exposed by registered MCP servers — with RBAC, approvals, health monitoring, versioning, and usage analytics.

See [`docs/2026-06-12-toolhub-design.md`](docs/2026-06-12-toolhub-design.md) for the full design doc.

## Setup

```bash
npm install
npm run build
npm run seed   # populates the registry with example servers/tools (GitHub, Jira, Slack, SQL)
npm start      # or: npm run dev
```

The server listens on `http://localhost:3000` (override with `PORT`). Data is stored as JSON files under `data/` (no native DB dependencies).

## Authentication (MVP)

Pass `x-principal-id: <name>` on requests. The seed script creates two principals:

- `admin-user` — assigned the `admin` role (`manage`, `discover`, `invoke` on `*`)
- `nexusai-agent` — assigned the `agent` role (`discover`, `invoke` on `*`)

## Key Endpoints

| Feature | Endpoint |
|---|---|
| Registry | `POST/GET/PATCH/DELETE /servers`, `POST/GET /servers/:id/tools`, `GET /tools` |
| Discovery | `GET /discover?tag=&serverId=&query=`, `POST /servers/:id/refresh` |
| RBAC | `POST /roles`, `POST /roles/:id/permissions`, `POST /roles/:id/assign` |
| Invocation | `POST /invoke` `{ toolId, args }` (proxied/mocked, RBAC + approval checked) |
| Health | `GET /health`, `GET /servers/:id/health`, `POST /servers/:id/health/check` |
| Versioning | `GET/POST /tools/:id/versions` |
| Analytics | `GET /analytics/usage`, `GET /analytics/summary` |
| Approvals | `POST /approvals`, `GET /approvals?status=pending`, `POST /approvals/:id/decision` |

## Example Flow

```bash
# Discover available tools (as an agent)
curl -H "x-principal-id: nexusai-agent" "localhost:3000/discover?tag=read"

# Invoke a low-risk tool
curl -X POST -H "x-principal-id: nexusai-agent" -H "Content-Type: application/json" \
  -d '{"toolId":"<tool-id>","args":{"org":"acme"}}' localhost:3000/invoke

# High-risk tools (riskLevel: medium|high) require an approved request first
curl -X POST -H "x-principal-id: nexusai-agent" -H "Content-Type: application/json" \
  -d '{"toolId":"<tool-id>","reason":"cleanup task"}' localhost:3000/approvals

curl -X POST -H "x-principal-id: admin-user" -H "Content-Type: application/json" \
  -d '{"approve":true}' localhost:3000/approvals/<approval-id>/decision
```

## Notes / Future Work

- `POST /invoke` and `/servers/:id/refresh` are mocked — a production version would use `@modelcontextprotocol/sdk` to connect to each registered server's transport (`stdio`/`sse`/`http`) and proxy real `tools/call` / `tools/list` requests.
- JSON-file storage (`src/db/database.ts`) is a drop-in stand-in for a real database; swap `store` for a SQL-backed implementation without changing module APIs.
- Health checks run on a 60s interval via `startHealthMonitor()`.

## Framework

ToolHub follows the SuperClaude Framework project structure:

- [`PLANNING.md`](PLANNING.md) — architecture, module responsibilities, and design constraints (source of truth, kept in sync with `CLAUDE.md`)
- [`TASK.md`](TASK.md) — priority-ordered task list
- [`plugins/`](plugins/README.md) — reserved extension point for a real `@modelcontextprotocol/sdk` transport adapter and other integrations
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development setup and contribution workflow

## Getting Started

```bash
npm install
npm run dev    # ts-node, no compile step — http://localhost:3000
```

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development setup and workflow.

## License

Proprietary. See [LICENSE](LICENSE). All rights reserved.
