# IntelliDesk 后端

Node + Express + Prisma(PostgreSQL) + WebSocket，对齐仓库根目录 `PRD_Backend_Detailed.md` 与 `openapi/openapi.yaml`。

## 本地运行

1. 启动 PostgreSQL（默认连接见 `.env.example`）。可用本目录 `docker compose up -d`（需本机 Docker）；若 Docker 不可用，请自备 PostgreSQL 实例并调整 `DATABASE_URL`。
2. 复制环境变量：`cp .env.example .env`，按需填写 `DATABASE_URL`、`ARK_API_KEY`（或 `DOUBAO_API_KEY`）与 `DOUBAO_ENDPOINT_ID`、`NEZHA_API_TOKEN` 等；未配豆包时可仅用 `GEMINI_API_KEY` 回退。
3. 安装依赖：`npm install`
4. 迁移：`npx prisma migrate deploy`
5. 种子数据（二选一）：
   - **全量演示**（工单/订单/售后等）：`npm run db:seed` 或 `npm run db:deploy`
   - **生产骨架**（仅租户、用户、渠道、坐席、规则，无业务单）：`npm run db:seed:production` 或 `npm run db:deploy:production`
6. 开发：`npm run dev` → API `http://localhost:4000`，WS `ws://localhost:4000/ws?tenantId=<种子租户UUID>`（默认 `PORT=4000`，与根目录 Vite 联调端口 4001 错开）

## 豆包 / 火山方舟 AI 配置

工单内 **AI 草稿、润色、摘要、售后识别、翻译** 等由 `src/lib/llmClient.ts` 统一调用方舟；**仅服务端读环境变量**，不要把 API Key 写进前端构建参数（联调时前端走 `/api/ai/*`）。

### 环境变量（见本目录 `.env.example`）

| 变量 | 说明 |
|------|------|
| `ARK_API_KEY` 或 `DOUBAO_API_KEY` | 方舟 API Key，与官方 curl 里 `Authorization: Bearer` 一致 |
| `DOUBAO_ENDPOINT_ID`（或 `ARK_ENDPOINT_ID`） | **推理接入点**填 `ep-…`；或填 **模型名**（如 `doubao-seed-1-8-251228`）走 Responses API |
| `DOUBAO_MODEL_ID` | 可选，非空时覆盖上面的模型/接入点字段 |
| `DOUBAO_BASE_URL` | 可选，默认 `https://ark.cn-beijing.volces.com/api/v3` |
| `DOUBAO_API_MODE` | 可选：`chat` 强制 Chat Completions，`responses` 强制 Responses API；**不设**时：`ep-` 前缀走 Chat，否则走 Responses |
| `GEMINI_API_KEY` | 未配置豆包时回退 Gemini；可选 `GEMINI_MODEL`（默认 `gemini-2.0-flash`） |

### 路由与官方 curl 对应关系

- **接入点 `ep-…`** → 内部请求 **`POST /api/v3/chat/completions`**（OpenAI 兼容），与下列 curl 一致：

```bash
curl https://ark.cn-beijing.volces.com/api/v3/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -d '{
    "model": "ep-你的接入点ID",
    "messages": [
      {"role": "system", "content": "你是人工智能助手."},
      {"role": "user", "content": "你好"}
    ]
  }'
```

本地 `.env` 中令 `DOUBAO_ENDPOINT_ID=ep-你的接入点ID` 即可；本服务会把业务提示词作为 user 消息发送（与多条 `messages` 等价用途）。

- **模型名 `doubao-seed-…`** → 内部请求 **`POST /api/v3/responses`**；多模态示例（图+文）与官方一致：

```bash
curl https://ark.cn-beijing.volces.com/api/v3/responses \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seed-1-8-251228",
    "input": [
      {
        "role": "user",
        "content": [
          {"type": "input_image", "image_url": "https://example.com/demo.png"},
          {"type": "input_text", "text": "你看见了什么？"}
        ]
      }
    ]
  }'
```

纯文本场景也可使用 `"input": "你好"`（字符串形式），由 `llmClient` 在走 Responses 分支时自动采用。

### 自建 API 路由

- `POST /api/ai/suggest-reply`、`/summarize`、`/classify-intent`（工单意图，供详情顶栏刷新）、`/polish`、`/recognize-after-sales`、`/summarize-messages`、`/translate`  
- 自检：`GET /api/ai/audit` 返回近期调用与当前解析到的提供商类型（`doubao` / `gemini` / `none`）

配置保存后需**重启** `npm run dev`。

## 鉴权（演示）

- 必填：`X-Tenant-Id`（与种子一致：`11111111-1111-4111-8111-111111111111`）
- 可选：`X-User-Id`（写操作设置类、完成退款类售后需要对应角色）

## 示例请求

```http
GET /api/tickets
X-Tenant-Id: 11111111-1111-4111-8111-111111111111
```

```http
GET /api/tickets/66666666-6666-4666-8666-666666666666
X-Tenant-Id: 11111111-1111-4111-8111-111111111111
```

## 正式 / 预发环境（为何页面上看不到种子工单？）

种子数据**只写入 PostgreSQL**，不会随「只部署代码」自动出现。需同时满足：

1. **数据库**：对正式库使用的 `DATABASE_URL` 执行迁移与种子（可重复执行，多为 `upsert`）：
   - **推荐生产首次上线**：`npm run db:deploy:production`（迁移 + 生产骨架，不含演示工单）。
   - **需要演示/联调数据**：`npm run db:deploy`（迁移 + 全量 `db:seed`）。
   - 分步示例：`npx prisma migrate deploy` → `npm run db:seed:production` 或 `npm run db:seed`。
2. **租户一致**：请求头 `X-Tenant-Id` 须与种子租户一致（默认 `11111111-1111-4111-8111-111111111111`）。若正式环境使用**其它租户 ID**，种子不会出现在该租户下，需在库里为该租户单独导数据或改 seed。
3. **前端必须走真实 API**：构建静态站时**必须**注入 `VITE_API_BASE_URL`（指向你的 API 根，无尾部 `/`）。未设置时前端会走**内置 mock**，永远看不到数据库里的工单。建议同时设置 `VITE_INTELLIDESK_DATA_SOURCE=api`。租户与演示用户可选：`VITE_INTELLIDESK_TENANT_ID`、`VITE_INTELLIDESK_USER_ID`（与 seed 一致即可联调）。

部署后自检：对 API 执行 `GET /api/tickets?limit=200` 并带上正式环境的 `X-Tenant-Id`，应能看到多条工单；若为空，说明当前库未 seed 或租户不对。

## 与前端联调

在 IntelliDesk Web 中配置同源反向代理，将 `/api` 指到本服务。本地联调推荐：根目录 `npm run dev:api`（Vite `:4001` 已代理 `/api`、`/ws` 至后端 `:4000`），环境变量 `VITE_API_BASE_URL=http://localhost:4001`。

## 目录

| 路径 | 说明 |
|------|------|
| `prisma/schema.prisma` | 数据模型 |
| `prisma/ERD.md` | 实体关系与 PRD 对齐说明 |
| `openapi/openapi.yaml` | OpenAPI 3.1 |
| `src/routes/*.ts` | REST 路由 |
| `src/services/nezhaAdapter.ts` | 母系统订单回源（可选） |
