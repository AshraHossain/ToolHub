import { initSchema } from "./db/database";
import { createApp } from "./api/server";
import { startHealthMonitor } from "./health/health";
import * as rbac from "./rbac/rbac";

initSchema();
rbac.ensureDefaultRoles();

const app = createApp();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

startHealthMonitor(60_000);

app.listen(PORT, () => {
  console.log(`ToolHub listening on http://localhost:${PORT}`);
});
