import express, { Request, Response, NextFunction } from "express";
import * as registry from "../registry/registry";
import * as discovery from "../discovery/discovery";
import * as rbac from "../rbac/rbac";
import * as health from "../health/health";
import * as versioning from "../versioning/versioning";
import * as analytics from "../analytics/analytics";
import * as approvals from "../approvals/approvals";
import { Action } from "../types";

export function createApp() {
  const app = express();
  app.use(express.json());

  // ---- Auth/RBAC middleware ----
  // Principal is identified via the `x-principal-id` header (simplified for MVP).
  function requirePermission(resourceFn: (req: Request) => string, action: Action) {
    return (req: Request, res: Response, next: NextFunction) => {
      const principalId = (req.header("x-principal-id") as string) || "anonymous";
      const resource = resourceFn(req);
      if (!rbac.isAllowed(principalId, resource, action)) {
        return res.status(403).json({ error: `Principal '${principalId}' lacks '${action}' permission on '${resource}'` });
      }
      (req as any).principalId = principalId;
      next();
    };
  }

  // ---- Registry ----
  app.post("/servers", requirePermission(() => "*", "manage"), (req, res) => {
    res.status(201).json(registry.registerServer(req.body));
  });

  app.get("/servers", (req, res) => {
    res.json(registry.listServers());
  });

  app.get("/servers/:id", (req, res) => {
    const server = registry.getServer(req.params.id);
    server ? res.json(server) : res.status(404).json({ error: "not found" });
  });

  app.patch("/servers/:id", requirePermission((r) => r.params.id, "manage"), (req, res) => {
    const updated = registry.updateServer(req.params.id, req.body);
    updated ? res.json(updated) : res.status(404).json({ error: "not found" });
  });

  app.delete("/servers/:id", requirePermission((r) => r.params.id, "manage"), (req, res) => {
    const ok = registry.deleteServer(req.params.id);
    ok ? res.status(204).end() : res.status(404).json({ error: "not found" });
  });

  app.post("/servers/:id/tools", requirePermission((r) => r.params.id, "manage"), (req, res) => {
    const server = registry.getServer(req.params.id);
    if (!server) return res.status(404).json({ error: "server not found" });
    res.status(201).json(registry.registerTool({ ...req.body, serverId: req.params.id }));
  });

  app.get("/tools", (req, res) => {
    res.json(registry.listTools());
  });

  app.get("/tools/:id", (req, res) => {
    const tool = registry.getTool(req.params.id);
    tool ? res.json(tool) : res.status(404).json({ error: "not found" });
  });

  // ---- Discovery ----
  app.get(
    "/discover",
    requirePermission(() => "*", "discover"),
    (req, res) => {
      const { tag, serverId, query } = req.query as Record<string, string | undefined>;
      res.json(discovery.discoverTools({ tag, serverId, query }));
    }
  );

  app.post("/servers/:id/refresh", requirePermission((r) => r.params.id, "manage"), (req, res) => {
    res.json(discovery.refreshServerTools(req.params.id));
  });

  // ---- RBAC ----
  app.post("/roles", requirePermission(() => "*", "manage"), (req, res) => {
    res.status(201).json(rbac.createRole(req.body.name));
  });

  app.get("/roles", (req, res) => {
    res.json(rbac.listRoles());
  });

  app.post("/roles/:id/permissions", requirePermission(() => "*", "manage"), (req, res) => {
    const { resource, action } = req.body;
    res.status(201).json(rbac.addPermission(req.params.id, resource, action));
  });

  app.post("/roles/:id/assign", requirePermission(() => "*", "manage"), (req, res) => {
    const { principalId } = req.body;
    res.status(201).json(rbac.assignRole(principalId, req.params.id));
  });

  app.get("/principals/:id/permissions", (req, res) => {
    res.json(rbac.getPermissionsForPrincipal(req.params.id));
  });

  // ---- Invocation (proxy) ----
  app.post(
    "/invoke",
    requirePermission((r) => r.body.toolId, "invoke"),
    (req, res) => {
      const principalId = (req as any).principalId as string;
      const { toolId, args } = req.body;

      const tool = registry.getTool(toolId);
      if (!tool) return res.status(404).json({ error: "tool not found" });

      const approval = approvals.checkApprovalRequired(principalId, toolId);
      if (approval.required && !approval.approved) {
        return res.status(403).json({
          error: "approval required",
          detail: `Tool '${tool.name}' has riskLevel '${tool.riskLevel}' and requires an approved request before invocation.`,
        });
      }

      const start = Date.now();
      // MVP: invocation is mocked. A real implementation would proxy this
      // call to the MCP server via @modelcontextprotocol/sdk's tools/call.
      const result = {
        toolId,
        toolName: tool.name,
        serverId: tool.serverId,
        args,
        output: `[mocked] invoked '${tool.name}' on server '${tool.serverId}'`,
      };
      const durationMs = Date.now() - start;

      analytics.logUsage({ principalId, toolId, serverId: tool.serverId, durationMs, success: true });

      res.json(result);
    }
  );

  // ---- Health ----
  app.get("/health", (req, res) => {
    res.json(health.getHealthOverview());
  });

  app.get("/servers/:id/health", (req, res) => {
    res.json({ latest: health.getLatestHealth(req.params.id), history: health.getHealthHistory(req.params.id) });
  });

  app.post("/servers/:id/health/check", requirePermission((r) => r.params.id, "manage"), (req, res) => {
    const check = health.checkServerHealth(req.params.id);
    check ? res.json(check) : res.status(404).json({ error: "not found" });
  });

  // ---- Versioning ----
  app.get("/tools/:id/versions", (req, res) => {
    res.json(versioning.getVersionHistory(req.params.id));
  });

  app.post("/tools/:id/versions", requirePermission((r) => r.params.id, "manage"), (req, res) => {
    const { version, changelog } = req.body;
    const record = versioning.addVersion(req.params.id, version, changelog);
    record ? res.status(201).json(record) : res.status(404).json({ error: "tool not found" });
  });

  // ---- Analytics ----
  app.get("/analytics/usage", (req, res) => {
    const { toolId, principalId, from, to } = req.query as Record<string, string | undefined>;
    res.json(analytics.queryUsage({ toolId, principalId, from, to }));
  });

  app.get("/analytics/summary", (req, res) => {
    res.json(analytics.getUsageSummary());
  });

  // ---- Approvals ----
  app.post("/approvals", (req, res) => {
    const principalId = (req.header("x-principal-id") as string) || "anonymous";
    const { toolId, reason } = req.body;
    res.status(201).json(approvals.requestApproval(principalId, toolId, reason));
  });

  app.get("/approvals", requirePermission(() => "*", "manage"), (req, res) => {
    res.json(approvals.listApprovals(req.query.status as any));
  });

  app.post("/approvals/:id/decision", requirePermission(() => "*", "manage"), (req, res) => {
    const reviewedBy = (req.header("x-principal-id") as string) || "admin";
    const { approve } = req.body;
    const updated = approvals.decideApproval(req.params.id, !!approve, reviewedBy);
    updated ? res.json(updated) : res.status(404).json({ error: "not found" });
  });

  return app;
}
