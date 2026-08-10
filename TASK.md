# TASK.md — ToolHub

Priority task list. See `PLANNING.md` for architecture context.

## High priority

- [ ] **Replace mocked MCP invocation with real `@modelcontextprotocol/sdk`
  calls** — `POST /invoke` and `/servers/:id/refresh` currently return
  canned/no-op responses instead of proxying `tools/call` / `tools/list` to
  the registered server's actual transport (stdio/sse/http). This is the
  primary next-step extension called out in `PLANNING.md` and `README.md`'s
  Notes / Future Work section.
- [ ] **Add a test suite** — no test framework is configured. CI currently
  runs `npm run build` → `npm run seed` → start server + `curl` smoke tests,
  which is not an automated pass/fail regression check.

## Medium priority

- [ ] **Real principal authentication** — `x-principal-id` is a plain,
  unverified header today. RBAC logic (`isAllowed`) is real, but there is no
  cryptographic identity behind the principal.
- [ ] **SQL-backed persistence option** — `src/db/database.ts` is JSON-file
  only; swap `store` for a SQL-backed implementation for multi-instance
  deployments without changing module APIs.
- [ ] **Live health checks** — `health.ts` simulates pings based on server
  status rather than actually probing each registered MCP server's
  transport.

## Low priority / infra

- [x] Express 4.19.2 REST API on TypeScript 5.5.3, `tsc` build to `dist/`.
- [x] JSON-file persistence (`src/db/database.ts`, `data/*.json`).
- [x] Dockerfile + `docker-compose.yml` (persists `data/` as a named volume).
- [x] CI workflow (`npm run build` → `npm run seed` → smoke test → Docker
  image build).
- [x] `.gitattributes` pinning line endings to LF (was producing recurring
  CRLF/LF status noise on Windows checkouts).
- [ ] Structured logging / observability for request and invocation flow.
