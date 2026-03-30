import type { WebSocket } from 'ws';

type Client = { ws: WebSocket; tenantId: string };

const clients = new Set<Client>();

export function wsRegister(ws: WebSocket, tenantId: string) {
  const c = { ws, tenantId };
  clients.add(c);
  ws.on('close', () => clients.delete(c));
}

/** 向某租户下所有连接广播 JSON */
export function broadcastTenant(tenantId: string, payload: unknown) {
  const raw = JSON.stringify(payload);
  for (const c of clients) {
    if (c.tenantId === tenantId && c.ws.readyState === 1) {
      c.ws.send(raw);
    }
  }
}
