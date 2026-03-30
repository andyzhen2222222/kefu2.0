# IntelliDesk 数据模型（ERD 说明）

与 [PRD_Backend_Detailed.md](../../PRD_Backend_Detailed.md) 及前端 [src/types/index.ts](../../src/types/index.ts) 对齐。

## 实体关系

```
Tenant 1 — * User
Tenant 1 — * AgentSeat
Tenant 1 — * Channel
Tenant 1 — * Customer
Tenant 1 — * Order
Tenant 1 — * Ticket
Tenant 1 — * AfterSalesRecord
Tenant 1 — * SlaRule / AutoReplyRule / TicketRoutingRule

Customer 1 — * Order
Customer 1 — * Ticket
Channel  1 — * Order
Channel  1 — * Ticket
Order    1 — * LogisticsEvent
Order    1 — * Ticket (optional)
Order    1 — * AfterSalesRecord
Ticket   1 — * Message
Ticket   1 — * AfterSalesRecord
```

## 字段对齐表

| PRD / 前端 | Prisma 模型.字段 | 说明 |
|------------|------------------|------|
| Ticket.id (UUID) | Ticket.id | API 用 UUID；前端展示短号可加 `displayNumber` 后续 |
| channelId | Ticket.channelId → Channel | 前端原字符串渠道名 → 用 `Channel.displayName` 或 id |
| customerId | Ticket.customerId | |
| orderId | Ticket.orderId | 可选 |
| TicketStatus | Ticket.status | enum |
| messageProcessingStatus | Ticket.messageProcessingStatus | unread / unreplied / replied |
| subject / subjectOriginal | Ticket.subject / subjectOriginal | |
| Message.senderType | Message.senderType | 含 manager |
| Message 扩展字段 | translatedContent, sentPlatformText, deliveryTargets, attachments | |
| AfterSalesRecord | AfterSalesRecord | type/status/priority 枚举化 |

## 租户

所有业务表带 `tenantId`，请求头 `X-Tenant-Id` 解析后注入查询（演示种子见 `npm run db:seed`）。
