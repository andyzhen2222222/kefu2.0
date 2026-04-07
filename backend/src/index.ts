import './load-env.js';
import express, { type NextFunction } from 'express';
import { resolveLlmBackend } from './lib/llmClient.js';
import compression from 'compression';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { prisma } from './lib/prisma.js';
import { requireTenant } from './middleware/tenant.js';
import { augmentUserFromFirebase } from './middleware/firebaseUser.js';
import { wsRegister } from './lib/wsHub.js';
import ticketsRouter from './routes/tickets.js';
import ordersRouter from './routes/orders.js';
import afterSalesRouter from './routes/afterSales.js';
import aiRouter from './routes/ai.js';
import dashboardRouter from './routes/dashboard.js';
import settingsRouter from './routes/settings.js';
import syncRouter from './routes/sync.js';
import { sessionFromAccountHandler } from './routes/auth.js';
import { runTenantMessageSync, runTenantOrderSync } from './services/motherSystemSync.js';
import {
  touchScopedSyncWatermark,
  SCHEDULED_MESSAGE_SCOPE,
  SCHEDULED_ORDER_SCOPE,
} from './lib/syncWatermark.js';

const app = express();
const port = Number(process.env.PORT) || 4000;

if (resolveLlmBackend() === 'none') {
  console.warn(
    '[ai] 当前进程未检测到可用 LLM：请确认已保存磁盘上的 backend/.env，并包含 ARK_API_KEY（或 DOUBAO_API_KEY）与 DOUBAO_ENDPOINT_ID（如 ep-…），然后重启本后端。'
  );
}

app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const apiChain = [requireTenant, augmentUserFromFirebase] as const;
/** 显式注册，避免 app.use('/api/auth', router) 在部分部署下子路由未命中导致 404 */
app.post('/api/auth/session-from-account', requireTenant, sessionFromAccountHandler);
app.use('/api/tickets', ...apiChain, ticketsRouter);
app.use('/api/orders', ...apiChain, ordersRouter);
app.use('/api/after-sales', ...apiChain, afterSalesRouter);
app.use('/api/ai', ...apiChain, aiRouter);
app.use('/api/dashboard', ...apiChain, dashboardRouter);
app.use('/api/settings', ...apiChain, settingsRouter);
app.use('/api/sync', ...apiChain, syncRouter);

/** 未捕获的异步错误 → JSON，避免仅返回纯文本 Internal Server Error */
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: NextFunction) => {
    console.error('[api] unhandled error:', err);
    const message = err instanceof Error ? err.message : String(err);
    if (res.headersSent) return;
    res.status(500).json({
      error: 'internal_server_error',
      message,
    });
  }
);

const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', async (ws, req) => {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const tenantId = url.searchParams.get('tenantId')?.trim();
  if (!tenantId) {
    ws.close(4000, 'missing tenantId query');
    return;
  }
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t) {
    ws.close(4001, 'invalid tenant');
    return;
  }
  wsRegister(ws, tenantId);
  ws.send(JSON.stringify({ type: 'connected', tenantId }));
});

function startMotherSyncScheduler(): void {
  const on = process.env.SYNC_SCHEDULER_ENABLED === '1' || process.env.SYNC_SCHEDULER_ENABLED === 'true';
  if (!on) return;
  const token = process.env.NEZHA_API_TOKEN?.trim() || '';
  if (!token) {
    console.warn('[sync-scheduler] SYNC_SCHEDULER_ENABLED 已开启但 NEZHA_API_TOKEN 为空，跳过定时同步');
    return;
  }
  const tickMs = Math.max(10_000, parseInt(process.env.SYNC_SCHEDULER_TICK_MS || '20000', 10) || 20_000);
  setInterval(async () => {
    try {
      const rows = await prisma.tenantSyncSettings.findMany({ where: { syncEnabled: true } });
      const now = Date.now();
      for (const s of rows) {
        const tenantId = s.tenantId;
        try {
          const lastMsg = await prisma.tenantSyncState.findUnique({
            where: { tenantId_scope: { tenantId, scope: SCHEDULED_MESSAGE_SCOPE } },
          });
          const lastOrd = await prisma.tenantSyncState.findUnique({
            where: { tenantId_scope: { tenantId, scope: SCHEDULED_ORDER_SCOPE } },
          });
          const msgDue =
            !lastMsg?.lastWatermarkAt ||
            now - lastMsg.lastWatermarkAt.getTime() >= s.messagePollIntervalSec * 1000;
          const ordDue =
            !lastOrd?.lastWatermarkAt ||
            now - lastOrd.lastWatermarkAt.getTime() >= s.orderPollIntervalSec * 1000;
          const pick = {
            incrementalSyncDays: s.incrementalSyncDays,
            useSyncWatermark: s.useSyncWatermark,
          };
          if (msgDue) {
            await runTenantMessageSync(tenantId, token, pick);
            await touchScopedSyncWatermark(tenantId, SCHEDULED_MESSAGE_SCOPE);
          }
          if (ordDue) {
            await runTenantOrderSync(tenantId, token, pick);
            await touchScopedSyncWatermark(tenantId, SCHEDULED_ORDER_SCOPE);
          }
        } catch (e) {
          console.error('[sync-scheduler] tenant', tenantId, e);
        }
      }
    } catch (e) {
      console.error('[sync-scheduler]', e);
    }
  }, tickMs);
  console.log(`[sync-scheduler] 已启动，tick=${tickMs}ms（需 NEZHA_API_TOKEN + 租户 syncEnabled）`);
}

server.listen(port, () => {
  console.log(`IntelliDesk API http://localhost:${port}`);
  console.log(`WebSocket ws://localhost:${port}/ws?tenantId=<uuid>`);
  startMotherSyncScheduler();
});
