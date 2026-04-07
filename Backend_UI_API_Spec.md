# 智能客服子系统（前端）— 后端开发对照说明

> 基于当前仓库 `src/` 路由与组件的**全量梳理**，供后端设计接口、权限与数据模型时对照。  
> 说明：大量交互仍为 **Mock / 本地状态**；文档标注「需接口」处为建议对接点。

---

## 1. 全局结构与入口

### 1.1 路由（`App.tsx`）

| 路径 | 页面组件 | 说明 |
|------|-----------|------|
| `/login` | `LoginPage` | 未登录可访问；已登录重定向 `/` |
| `/` | `DashboardPage` | 工作台 |
| `/mailbox`、`/mailbox/:ticketId` | `MailboxPage` | 工单 + 工单详情（同页左右栏） |
| `/orders` | `OrdersPage` | **侧栏无入口**，仅路由可达 |
| `/customers` | `CustomersPage` | **侧栏无入口**，仅路由可达 |
| `/after-sales` | `AfterSalesPage` | 售后管理 |
| `/insights` | 占位组件 | 仅展示文案「Insights」 |
| `/settings` | `SettingsIndexRedirect` | 按角色跳到首个可见设置子页 |
| `/settings/seats` | `SeatsAndRolesPage` | **仅 `role === 'admin'`** |
| `/settings/translation` | `TranslationSettingsPage` | **仅 admin** |
| `/settings/templates` | `TemplatesPage` | 全员可见（过滤后） |
| `/settings/knowledge` | `KnowledgeBasePage` | 全员可见 |
| `/settings/sla` | `SLAPage` | 全员可见 |
| `/settings/rules` | `AutoReplyRulesPage` | 全员可见 |
| `/settings/dictionary` | `DataDictionaryPage` | 全员可见 |
| `/settings/routing` | `RoutingRulesPage` | **重定向**至 `/settings/seats?step=3` |

### 1.2 顶栏 `Header`

- **Logo**：链接 `/`。
- **主导航外链**（母系统）：订单、商品、跟卖、调价、刊登；**客服**高亮指向 `/`。
- **授权店铺**、**购买套餐**：外链。
- **用户区**：头像；悬停展开 **邮箱** + **退出登录**（`logout`）。

### 1.3 侧栏 `Sidebar`（主应用内）

- 工作台 `/`
- 工单 `/mailbox`
- 售后管理 `/after-sales`
- 设置 `/settings`（任意 `/settings/*` 高亮）

### 1.4 设置内导航 `settingsNavConfig.ts`

- **admin**：坐席与分配、智能翻译、模板、知识库、SLA、自动回复、字段管理。
- **非 admin**：无「坐席与分配」「智能翻译」，其余保留。

### 1.5 认证（`useAuth.tsx`）

- 当前演示：`signIn` 写入 `localStorage.mockUser`（管理员 Mock），**未接真实账号体系**。
- 可选：Firebase Auth + Firestore `users/{uid}`（`User`: `id, name, email, role, avatar?`）。
- **后端需支持**：登录、登出、当前用户、`role` 与设置页权限一致。

---

## 2. 核心领域模型（`types/index.ts` 摘要）

后端宜对齐或扩展以下结构（前端已使用字段名）：

- **Ticket**：`id, channelId, customerId, orderId?, status (TicketStatus), assignedSeatId?, priority, sentiment, intent, messageProcessingStatus ('unread' \| 'unreplied' \| 'replied'), subject, subjectOriginal?, createdAt, updatedAt, slaDueAt, tags, ...`
- **Message**：`id, ticketId, senderId, senderIdOriginal? (母系统原始ID), senderType ('customer'|'manager'|'agent'|'system'|'ai'), content, createdAt, isInternal?, translatedContent?, sentPlatformText?, deliveryTargets?`
    - **senderType 说明**：`manager` 映射母系统的 `PLATFORM`, `OPERATOR`, `MARKETPLACE` 等平台角色；`agent` 映射客服坐席。
    - **同步策略**：会话用 `/v1/api/ecommerce/platform-conversation`，消息用 `/v1/api/ecommerce/platform-conversation-message`；不调用 `/v1/admin/*`。代码常量见 `backend/src/lib/nezhaEcommercePaths.ts`。
- **Order / Customer**：见类型定义；工单侧栏展示订单、物流、发票条件等。
- **AfterSalesRecord**：`id, orderId, ticketId, type (refund/return/exchange/reissue), status, handlingMethod, priority, problemType, buyerFeedback, refundAmount?, returnTrackingNumber?, ...`
- **CustomRole / AgentSeat / TicketRoutingRule**：设置-坐席与分配第三步使用。

---

## 3. 分页面：控件与建议接口

### 3.1 登录页 `/login`

**Tab**：密码登录 | 验证码登录（第三项「扫码」Tab 未实现，仅有 SSO/微信/扫码按钮占位）。

**密码登录字段**：账号/手机号、密码、图形验证码（占位 `8X2A`）、**自动登录** checkbox、**忘记密码** 按钮（无逻辑）。

**验证码登录字段**：手机号、短信验证码、**获取验证码** 按钮。

**按钮**：主 **登录**：**Mock** 调 `signIn`；**API 联调**（`VITE_INTELLIDESK_API_BASE_URL` 等已配置）调 **`POST /api/auth/session-from-account`**（根路径注册；若 404 可回退 **`POST /api/settings/session-from-account`**），请求体 `{ account, password }`，响应 `{ userId, email, name, role }`；前端写入 `localStorage.mockUser` 与 **`X-User-Id`**。生产需后端 **`ALLOW_ACCOUNT_SESSION=1`**。

**需接口**：账号密码会话（上）、验证码、图形码、SSO、会话续期、忘记密码。

---

### 3.2 工作台 `/`（`DashboardPage`）

- **标题区**：欢迎语（`user.name`）、**查看实时报告**（无跳转逻辑）。
- **AI 效能洞察**：挂载后调 `summarizeTicket`（联调走后端 `/api/ai/summarize-messages`，mock 可走浏览器豆包/Gemini）；展示生成文案。
- **使用导航**：4 个 `Link`（绑定店铺→`/settings`，配置坐席→`/settings/seats`，模版→`/settings/templates`，SLA→`/settings/sla`）。
- **四张指标卡**：未读 / 已读未回复 / 已回复 / 超时 → 链接 `/mailbox?filter=...`（**工单未读 query 参数**，需后端列表筛选对齐）。
- **已读未回复卡**：admin 可见 **配置分配规则** → `/settings/seats?step=3`。
- **业务结构分布**：三张饼图（Mock 百分比）。
- **工单处理趋势**：`select` 最近 7/30 天 + AreaChart（Mock）。
- **渠道分布** + **管理渠道** → `/settings`。

**需接口**：仪表盘聚合指标、趋势序列、分布统计、AI 摘要（可选异步任务）。

---

### 3.3 工单 `/mailbox`（`MailboxPage` + `InboxList` + `TicketDetail`）

#### 3.3.1 左侧 `InboxList`

- **标题**：工单。
- **排序**：按钮展开 — 按时间降序 / 升序 / 按优先级。
- **筛选**：Filter 展开面板 — **平台渠道、买家意图、买家情绪、订单状态、会话状态** 等 `select`（**当前未绑定请求，仅 UI**）；**重置过滤**。
- **搜索框**：placeholder「搜索订单号、买家姓名…」；实际过滤：`getTicketSubjectForDisplay(ticket)`、`subject`、`subjectOriginal`、`channelId`、`orderId`。
- **树**：平台 → 店铺 → 工单卡片；点击 `navigate(/mailbox/:ticketId)`。
- **卡片展示**：买家名、`updatedAt` 相对时间、标题（受翻译设置影响）、未读红点条件（`messageProcessingStatus === 'unread'` 或 `status === NEW`）；选中行展示 `InboxTicketStatusIcons`。

**需接口**：工单列表（分页/游标）、搜索、排序、多维筛选、未读状态。

#### 3.3.2 右侧 `TicketDetail`

**顶栏**

- 工单状态图标 + **标题**（`getTicketSubjectForDisplay`）。
- 元数据：`#id`、`channelId`。
- **TicketDetailStatusChips**：SLA、订单、意图、情绪、**会话**（若传 `onMessageProcessingStatusChange` 则会话 chip 为 `select` 覆盖层：未读/未回复/已回复）。
- **分配给坐席**：`select`（`seatOptions`）+ `onAssignSeat(seatId)`（Mailbox 用本地 `seatAssignmentByTicket`）。
- **回调 `onUpdateTicket(patch)`**：当前用于更新 `messageProcessingStatus`。

**消息时间线**

- 展示 `messages`；支持 **查看原文/译文**（`translatedContent` / `sentPlatformText` 等）。
- AI 消息：**查看引用来源** → 侧滑/面板展示 Mock `MOCK_KB_CITATIONS`。

**回复区**

- **回复买家 | 内部备注** 切换。
- **自动翻译**：开关（受 `TranslationSettingsPage` 与出站策略影响）。
- **插入模板**：按钮无下拉数据绑定（需接模板列表）。
- **AI 草稿**：`generateReplySuggestion`（联调走 `/api/ai/suggest-reply`，服务端豆包优先）。
- **textarea**：占位随模式变化；展开后底部工具栏。
- **附件、表情**：按钮无实际上传。
- **收件人**（非内部备注）：**客户**、**平台经理** 可多选 pill。
- **取消**、**发送/保存备注**：`onSendMessage({ content, recipients, isInternal, translateToPlatform })`；Mailbox 追加本地 `Message`。

**弹窗**

- **SubmitAfterSalesModal**：见 §3.6（从售后 Tab / 按钮打开）。
- **InvoicePreviewModal**：见 §3.7。

**右侧栏 Tab：订单 / 物流 / 发票 / 售后**

- **订单**：客户信息；可折叠 **订单信息**（平台单号、状态、时间、地址、商品、税费、**查看订单** 外链母系统）；**内部备注**列表（来自 `isInternal` 消息）。
- **物流**：运单号、时间轴（`logisticsEvents`）；无数据时空态。
- **发票**：若 `order.hasVatInfo` — 模版选择 simple/standard/detailed、**生成并预览发票**；否则引导 **去维护主体信息** 外链。
- **售后**：已登记列表（本地 `afterSalesRecords`）+ **再次提交**；空态有 **发起售后** 入口。

**需接口**：工单详情、消息列表（分页）、发送消息、内部备注、会话状态 PATCH、坐席分配、AI 草稿/引用、订单/物流/发票权限与数据、售后创建与列表。

---

### 3.4 订单页 `/orders`（`OrdersPage`）

- **Sync Orders** 按钮（无逻辑）。
- 搜索框；**Filters** 按钮（无面板）。
- 表格列：Order Info、Channel、Products、Amount、Status、Actions（外链、更多 — 无逻辑）。
- 底部分页文案 + 翻页按钮（禁用/占位）。

**需接口**：订单同步、列表、筛选、分页、跳转母系统订单。

---

### 3.5 客户页 `/customers`（`CustomersPage`）

- **Add Customer**（无逻辑）。
- 三张统计卡（Mock）。
- 搜索；**Segments** 按钮（无面板）。
- 表格：Customer、Location、Sentiment、Orders、Total Spend、Actions（邮件、更多 — 无逻辑）。
- 分页区（Mock）。

**需接口**：客户 CRUD、分群、列表、分页。

---

### 3.6 售后管理 `/after-sales`（`AfterSalesPage` + `SubmitAfterSalesModal`）

**页面**

- **导出数据**（无逻辑）、**手动登记售后** → 打开弹窗。
- 搜索框（**未绑定过滤逻辑**）。
- **状态 Tab**：全部 / 已提交 / 处理中 / 已完成 / 已拒绝。
- **更多筛选** 下拉面板：售后类型、处理方式、签收方/退件仓、平台、店铺；**重置**、**确定**。
- 表格列：售后单号、订单信息（含关联工单文案）、**处理方式**（类型标签）、**处理状态**（`select` 就地更新本地 state）、退款/退件详情、优先级、售后类型、操作（**查看**无逻辑、**编辑** 打开弹窗带 `initialData`、**删除** confirm）。
- 分页（Mock）。

**弹窗 `SubmitAfterSalesModal`**

- 标题：提交售后 / 修改售后工单。
- **无传入 order 时**：**订单号搜索** + **搜索带入**（Mock 订单）；订单摘要；**重新搜索**。
- **售后信息**：处理方式 `select`（退款/退货/换货/重发）、优先级、售后状态（禁用展示「已提交」）。
- **退款**：退款金额、**售后类型** `select`（可 **管理售后类型** → `openFieldConfigPage`）、**退款执行方式**（登记 vs API 原路 — 渠道 Mock 判断是否支持）、**AI 自动识别**（`recognizeAfterSalesFromFeedback`）。
- **退货/换货**：退回物流单号、承运商。
- **重发/换货**：重发 SKU、数量。
- **签收方** `select`（**管理签收方** 外链）、客户签收时间、客户反馈时间（date）、**买家反馈** textarea、**添加**（占位）、**上传图片**（占位）。
- 底部：**取消**、**提交售后** / **保存修改** / **提交并原路退款**（动态文案）。

**需接口**：售后单 CRUD、订单搜索、状态流转、退款 API 能力探测、附件上传、与工单关联。

---

### 3.7 发票预览 `InvoicePreviewModal`

- 根据 `template` 渲染 simple / standard / detailed 预览。
- **下载 PDF**（html2canvas + jsPDF）、**发送给客户**（Mock `alert`）、关闭。

**需接口**：发票生成、存储、发送、模版配置。

---

### 3.8 设置 — 坐席与分配 `/settings/seats`（`SeatsAndRolesPage`）

**三步 Tab**（URL `?step=1|2|3`）

1. **创建角色**：角色列表；**新增/编辑角色** 弹窗（名称、描述、权限多选 `PERMISSION_PRESETS`）；删除（校验无坐席绑定）。
2. **创建坐席**：坐席列表；**新增坐席** 弹窗（显示名、邮箱、登录账号、密码、角色、状态）；与 `AgentSeat` 字段对应。
3. **工单分配**：`TicketRoutingRulesBlock` — **平台+店铺风琴面板**（选平台展开选店，默认该平台下店铺全选）；规则表（平台、店铺、售后类型、分配坐席、启用；**无「优先级」列**；同一店铺若被多条规则命中多坐席则行内 **「多坐席共享」** 标注）；**新增/编辑规则** 弹窗；删除。排序以「创建/更新时间」为主（同档仍可有内部兜底顺序，产品不展示优先级）。

**坐席创建**：`POST /api/settings/agent-seats` 成功后后端按邮箱 **upsert `User`** 并回写 **`AgentSeat.userId`**（收件箱「指派给自己」仍要求登录邮箱与坐席邮箱一致）。

**需接口**：角色 CRUD、坐席 CRUD、分配规则 CRUD、与工单 `assignedSeatId` 联动。

---

### 3.9 设置 — 智能翻译 `/settings/translation`

- **本地存储** `localStorage.edesk_translation_settings_v1`（非后端）。
- 字段：`autoTranslateEnabled, inboundTargetLang, outboundTranslateOnSend, allowSendOriginalChinese`。
- UI：总开关、译入语言 `select`、出站两个 Toggle。

**需接口（若需云端一致）**：租户级翻译策略、与母系统积分/店铺语种同步。

---

### 3.10 设置 — 模板管理 `/settings/templates`

- **新建模板**、搜索、**更多筛选**（平台、售后类型）。
- 表格行操作：**编辑**、**复制**、**删除**（见代码）。
- **`AddTemplateModal`**：模板名称、适用平台、售后类型（**管理售后类型** 外链）、支持语言（单选 radio 一组）、模板内容 + 变量插入按钮、**AI 智能生成**（Mock 延时）、**保存后立即启用** checkbox；**取消** / **保存模板**。

**需接口**：模板 CRUD、变量体系、AI 生成、启用状态、按平台/类型检索。

---

### 3.11 设置 — 知识库 `/settings/knowledge`

**Tab：文档库 | 问答对 | 引用与反馈**

- **文档库**：搜索文档；**新增文档** 面板（标题、粘贴/上传模式、正文、适用范围 select）；保存后 Mock「处理中→草稿」；行内 **发布/下架**、**删除**。
- **检索试查**：输入买家问法、**试查**（本地 Mock 命中 chunks）。
- **问答对**：**新增问答**；列表 **发布**、**删除**。
- **引用与反馈**：展示会话引用反馈 Mock；**处理/忽略** 等（见组件内 `dismissFeedback`）。

**需接口**：文档上传与切片、索引状态、FAQ CRUD、检索 API、引用反馈工单。

---

### 3.12 设置 — SLA `/settings/sla`

- **添加规则** → `AddSLARuleModal`：规则名称、适用平台、目标回复小时、预警剩余小时、工作时间（7x24 / 仅工作日）；**取消** / **保存规则**（当前仅关窗）。
- 主列表：两条示例规则 + 每条 **启用开关**；底部 **保存更改**（无持久化）。

**需接口**：SLA 规则 CRUD、与工单 `slaDueAt` 计算、告警。

---

### 3.13 设置 — 自动回复 `/settings/rules`

- **添加规则** → `AddAutoReplyRuleModal`：规则名称；触发类型 **时间段 / 关键字 / AI 意图** 及子表单；回复模版 + 变量快捷按钮 + **从现有模版导入**（无数据）；执行动作 checkbox（已回复标记；分配客服组 disabled+说明）；**取消** / **保存规则**。
- 列表示例「节假日自动回复」+ 开关；**保存更改**。

**需接口**：规则 CRUD、触发器求值、模板关联、执行动作与工单状态。

---

### 3.14 设置 — 字段管理 `/settings/dictionary`

- 字典切换：**售后类型、处理方式、签收方/退件仓**（`?dict=` 同步 URL）。
- 搜索选项；**新增选项**；表格 **编辑/删除**；**表单必填** toggle（UI 未持久化）。
- **新增/编辑弹窗**：显示标签、存储值、状态。

**需接口**：数据字典分类与选项 CRUD、被售后/模板等引用。

---

## 4. 前端已调用或占位的外部能力

| 能力 | 位置 | 说明 |
|------|------|------|
| `summarizeTicket` | 工作台 | AI 洞察 |
| `postAiBatchTranslate` | 工单详情 | **批量翻译** (POST `/api/ai/batch-translate`) |
| `postTicketMessage` | 工单详情 | **发送消息** (POST `/api/tickets/:id/messages`)，已接通母系统回复接口；发送成功 tooltip 已从「已送达」更新为「已发送至平台」 |
| `generateReplySuggestion` | 工单详情 | AI 草稿，支持双语预览弹窗；平台语从母系统 API 动态获取 |
| `syncMessagesFromMotherSystem` | 后端服务 | **消息同步**；优先调 admin 接口以区分「平台信息」|
| `postAiClassifySentiment` | 工单详情 | **情绪识别** (POST `/api/ai/classify-sentiment`)，支持二次刷新并在后端安全归一化 |
| `postAiClassifyIntent` | 工单详情 | **意图分类** (POST `/api/ai/classify-intent`)，支持二次刷新 |
| `recognizeAfterSalesFromFeedback` | 售后弹窗 | AI 填表 |
| 豆包 / 方舟 AI | `backend/src/lib/llmClient.ts` + `POST /api/ai/*` | **服务端**配置 `ARK_API_KEY`、`DOUBAO_ENDPOINT_ID`（`ep-…` 或模型名）；详见 **`backend/README.md`「豆包 / 火山方舟 AI 配置」** 与 **`backend/.env.example`** |
| 浏览器直连模型（mock） | `src/lib/llmClient.ts` | 可选 `VITE_DOUBAO_*`，生产建议禁用 |
| Gemini 回退 | `GEMINI_API_KEY` | 未配豆包时使用 |
| Firebase Auth/Firestore | `useAuth` / `firebase.ts` | 可与 Mock 并存 |

---

## 5. 与后端协作优先级建议

1. **认证与用户/角色**（侧栏设置权限、Header 用户）。
2. **工单 + 消息 + 发送**（工单核心闭环）。
3. **messageProcessingStatus、assignedSeatId** 的 PATCH。
4. **订单/客户** 详情供侧栏（或与母系统 ID 映射）。
5. **售后单** 全流程与列表筛选。
6. **模板、字典、SLA、自动回复、知识库** 等运营配置类接口。
7. **仪表盘统计** 与 `?filter=` 查询对齐。

---

## 6. 文档维护

- 代码路径：`src/App.tsx`、`src/components/**`。
- 若新增路由或弹窗，请同步更新本文档对应章节。
