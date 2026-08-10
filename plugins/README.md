# plugins/

Reserved for SuperClaude Framework plugin extensions for this project (e.g.
a real `@modelcontextprotocol/sdk` transport adapter, a SQL-backed storage
driver, or CI notifiers packaged as plugins).

No plugins are defined yet. ToolHub currently mocks MCP server invocation
(`POST /invoke`) and server refresh (`/servers/:id/refresh`) rather than
proxying to a real MCP server transport — see `PLANNING.md` for the exact
request flow and module responsibilities. The intended extension point is
replacing that mock with real `@modelcontextprotocol/sdk` connections
(stdio/sse/http) to each registered server, each packaged as an installable
plugin under this directory.
