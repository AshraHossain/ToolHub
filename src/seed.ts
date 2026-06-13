import { initSchema } from "./db/database";
import * as registry from "./registry/registry";
import * as rbac from "./rbac/rbac";

initSchema();

const { adminRole, agentRole } = rbac.ensureDefaultRoles();
rbac.assignRole("admin-user", adminRole.id);
rbac.assignRole("nexusai-agent", agentRole.id);

// GitHub MCP Server
const github = registry.registerServer({
  name: "GitHub MCP Server",
  description: "Provides tools for repos, issues, PRs",
  endpoint: "mcp://github-mcp-server",
  transport: "http",
  owner: "platform-team",
  tags: ["github", "vcs", "code"],
});
registry.registerTool({
  serverId: github.id,
  name: "create_issue",
  description: "Create a GitHub issue in a repository",
  inputSchema: { type: "object", properties: { repo: { type: "string" }, title: { type: "string" }, body: { type: "string" } }, required: ["repo", "title"] },
  tags: ["issues", "write"],
  riskLevel: "medium",
});
registry.registerTool({
  serverId: github.id,
  name: "list_repos",
  description: "List repositories for the authenticated org",
  inputSchema: { type: "object", properties: { org: { type: "string" } } },
  tags: ["repos", "read"],
  riskLevel: "low",
});

// Jira MCP Server
const jira = registry.registerServer({
  name: "Jira MCP Server",
  description: "Provides tools for Jira issues and projects",
  endpoint: "mcp://jira-mcp-server",
  transport: "http",
  owner: "platform-team",
  tags: ["jira", "tickets"],
});
registry.registerTool({
  serverId: jira.id,
  name: "create_ticket",
  description: "Create a Jira ticket",
  inputSchema: { type: "object", properties: { project: { type: "string" }, summary: { type: "string" } }, required: ["project", "summary"] },
  tags: ["tickets", "write"],
  riskLevel: "medium",
});
registry.registerTool({
  serverId: jira.id,
  name: "search_issues",
  description: "Search Jira issues with JQL",
  inputSchema: { type: "object", properties: { jql: { type: "string" } }, required: ["jql"] },
  tags: ["tickets", "read"],
  riskLevel: "low",
});

// Slack MCP Server
const slack = registry.registerServer({
  name: "Slack MCP Server",
  description: "Provides tools for Slack messaging",
  endpoint: "mcp://slack-mcp-server",
  transport: "sse",
  owner: "comms-team",
  tags: ["slack", "messaging"],
});
registry.registerTool({
  serverId: slack.id,
  name: "post_message",
  description: "Post a message to a Slack channel",
  inputSchema: { type: "object", properties: { channel: { type: "string" }, text: { type: "string" } }, required: ["channel", "text"] },
  tags: ["messaging", "write"],
  riskLevel: "medium",
});

// SQL MCP Server
const sql = registry.registerServer({
  name: "SQL MCP Server",
  description: "Provides read/write access to enterprise SQL databases",
  endpoint: "mcp://sql-mcp-server",
  transport: "stdio",
  owner: "data-team",
  tags: ["sql", "database"],
});
registry.registerTool({
  serverId: sql.id,
  name: "run_query",
  description: "Run a read-only SQL query",
  inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  tags: ["read"],
  riskLevel: "low",
});
registry.registerTool({
  serverId: sql.id,
  name: "execute_statement",
  description: "Execute an INSERT/UPDATE/DELETE statement",
  inputSchema: { type: "object", properties: { statement: { type: "string" } }, required: ["statement"] },
  tags: ["write"],
  riskLevel: "high",
});

console.log("Seed complete:");
console.log(JSON.stringify({ servers: registry.listServers(), tools: registry.listTools() }, null, 2));
