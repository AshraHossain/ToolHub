# Contributing to ToolHub

ToolHub follows the SuperClaude Framework project structure used across this
portfolio. Before making changes, read [`PLANNING.md`](PLANNING.md) for the
architecture (startup sequence, request flow, module responsibilities, and
key design constraints) and [`TASK.md`](TASK.md) for the current priority
list.

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode (ts-node, no compile step)
npm run dev

# Build TypeScript → dist/
npm run build

# Run the compiled server
npm start

# Seed the registry with 4 example MCP servers + tools
npm run seed
```

No automated test framework is configured yet. CI runs `npm run build` →
`npm run seed` → start server + `curl` smoke tests → Docker image build.
Treat a clean run of that sequence as the minimum bar before opening a PR.

## Docker

```bash
docker-compose up --build
```

Data is persisted as a named volume under `data/` (JSON files, no native DB
dependencies).

## Project Structure

| Path | Purpose |
|---|---|
| `src/db/database.ts` | JSON-file persistence layer (`store`) |
| `src/registry/registry.ts` | MCP server + tool CRUD |
| `src/rbac/rbac.ts` | Roles, permissions, `isAllowed` checks |
| `src/health/health.ts` | Background health monitor |
| `src/discovery/discovery.ts` | Tool discovery/filtering |
| `src/versioning/versioning.ts` | Tool version history |
| `src/analytics/analytics.ts` | Usage event logging |
| `src/approvals/approvals.ts` | Medium/high-risk tool approval gating |
| `src/api/server.ts` | Express router wiring all modules |
| `src/seed.ts` | Seed script / smoke test |
| `plugins/` | Reserved extension point — see [`plugins/README.md`](plugins/README.md) |

See [`PLANNING.md`](PLANNING.md) for the authoritative architecture
reference — keep it (and `CLAUDE.md`) in sync with any structural change.

## Conventions

- TypeScript, `tsc` build to `dist/`, Express 4.x, JSON-file persistence — no
  database or ORM.
- Principal identity is the `x-principal-id` header — plain string, not
  cryptographically verified (MVP auth). RBAC checks (`isAllowed`) are real.
- `riskLevel: "medium"` or `"high"` tools require an approved
  `POST /approvals` request before `POST /invoke` will succeed for a given
  principal.
- Line endings are pinned to LF via `.gitattributes` — don't fight it with
  editor-local CRLF settings.
- Commit messages follow Conventional Commits, scoped to the project:
  `type(ToolHub): description` (e.g. `feat(ToolHub): add SQL storage backend`).

## License

Proprietary — see [LICENSE](LICENSE). Contributions are accepted under the
same terms as the rest of the repository.
