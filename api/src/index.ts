// interval api — 部署於 Railway 的背景服務
// 職責:
//  1. /health 健康檢查
//  2. 內建排程:報價追蹤/過期、訂單提醒(每小時檢查一次,單發不重複)
//  3. /jobs/run 手動觸發排程(需 JOB_SECRET)
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { runFollowupJobs } from "./jobs.js";

const app = new Hono();

app.get("/", (c) => c.json({ service: "interval-api", ok: true }));
app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

app.post("/jobs/run", async (c) => {
  const auth = c.req.header("authorization") ?? "";
  const secret = process.env.JOB_SECRET ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const result = await runFollowupJobs();
  return c.json(result);
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`interval-api listening on :${info.port}`);
});

// 每小時跑一次追蹤排程(避免依賴外部 cron)
const HOUR = 60 * 60 * 1000;
setInterval(() => {
  runFollowupJobs().catch((err) => console.error("[jobs] failed:", err));
}, HOUR);
