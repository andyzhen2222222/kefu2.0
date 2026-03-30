import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { prisma } from './lib/prisma.js';
import { requireTenant } from './middleware/tenant.js';
import { wsRegister } from './lib/wsHub.js';
import ticketsRouter from './routes/tickets.js';
import ordersRouter from './routes/orders.js';
import afterSalesRouter from './routes/afterSales.js';
import aiRouter from './routes/ai.js';
import dashboardRouter from './routes/dashboard.js';
import settingsRouter from './routes/settings.js';

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/tickets', requireTenant, ticketsRouter);
app.use('/api/orders', requireTenant, ordersRouter);
app.use('/api/after-sales', requireTenant, afterSalesRouter);
app.use('/api/ai', requireTenant, aiRouter);
app.use('/api/dashboard', requireTenant, dashboardRouter);
app.use('/api/settings', requireTenant, settingsRouter);

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

server.listen(port, () => {
  console.log(`IntelliDesk API http://localhost:${port}`);
  console.log(`WebSocket ws://localhost:${port}/ws?tenantId=<uuid>`);
});
