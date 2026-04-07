/**
 * Core Data Models for IntelliDesk
 */

export enum TicketStatus {
  NEW = 'new',
  TODO = 'todo',
  WAITING = 'waiting',
  SNOOZED = 'snoozed',
  RESOLVED = 'resolved',
  SPAM = 'spam',
}

export enum Sentiment {
  ANGRY = 'angry',
  ANXIOUS = 'anxious',
  NEUTRAL = 'neutral',
  JOYFUL = 'joyful',
}

/** 工单消息处理状态：未读 / 未回复 / 已回复 */
export type MessageProcessingStatus = 'unread' | 'unreplied' | 'replied';

export enum LogisticsStatus {
  NOT_FOUND = 'NotFound',
  INFO_RECEIVED = 'InfoReceived',
  IN_TRANSIT = 'InTransit',
  AVAILABLE_FOR_PICKUP = 'AvailableForPickup',
  OUT_FOR_DELIVERY = 'OutForDelivery',
  DELIVERED = 'Delivered',
  DELIVERY_FAILURE = 'DeliveryFailure',
  EXPIRED = 'Expired',
  EXCEPTION = 'Exception'
}

export interface LogisticsEvent {
  id: string;
  status: LogisticsStatus;
  subStatus: string;
  description: string;
  location?: string;
  timestamp: string;
}

export interface Channel {
  id: string;
  type: string;
  platformName: string;
  storeName: string;
  region: string;
  authStatus: 'connected' | 'unauthorized' | 'paused';
  syncStatus: boolean;
  defaultSlaHours: number;
  defaultLanguage: string;
  brandProfileId: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  shippingCountry: string;
  sentiment: Sentiment;
  segments: string[];
  totalOrderValue: number;
  ordersCount: number;
  latestPurchaseAt: string;
  customerSince: string;
}

export interface Order {
  id: string;
  platformOrderId: string;
  customerId: string;
  channelId: string;
  skuList: string[];
  productTitles: string[];
  amount: number;
  currency: string;
  orderStatus: 'unshipped' | 'shipped' | 'refunded' | 'partial_refund';
  shippingStatus: string;
  trackingNumber?: string;
  deliveryEta?: string;
  paymentStatus: string;
  refundStatus?: string;
  returnStatus?: string;
  logisticsStatus?: LogisticsStatus;
  logisticsPrimaryStatus?: string;
  logisticsSecondaryStatus?: string;
  logisticsStatusCode?: string;
  logisticsSubStatusCode?: string;
  isLogisticsException?: boolean;
  logisticsLastSyncedAt?: string | null;
  logisticsIsRegistered?: boolean;
  logisticsEvents?: LogisticsEvent[];
  carrier?: string;
  paidAt?: string;
  shippedAt?: string;
  refundedAt?: string;
  platformType?: string | null;
  hasVatInfo?: boolean;
  eanList?: string[];
  storeEntity?: StoreEntity;
  /** 订单创建时间（平台/本地落库时间，ISO） */
  createdAt?: string;
  updatedAt?: string;
}

/** 店铺主体信息：由母系统（Main System）维护并同步 */
export interface StoreEntity {
  id: string;
  /** 法人/公司名称 */
  legalName: string;
  /** 店铺对外展示名称 */
  displayName: string;
  /** 注册地址 */
  address: string;
  /** VAT 税号 */
  vatNumber: string;
  /** 税务代码（部分地区需要） */
  taxCode?: string;
}

export interface Ticket {
  id: string;
  /** 店铺展示名（同 Channel.displayName） */
  channelId: string;
  /** 平台类型：AMAZON / EBAY / SHOPIFY / WALMART 等，用于分组与统计 */
  platformType?: string | null;
  customerId: string;
  orderId?: string;
  status: TicketStatus;
  ownerUserId?: string;
  /** 当前负责的客服坐席 id（与设置-坐席与分配中的坐席一致） */
  assignedSeatId?: string;
  priority: number;
  sentiment: Sentiment;
  intent: string;
  /** 未读 / 未回复 / 已回复 */
  messageProcessingStatus: MessageProcessingStatus;
  /** 列表/详情「译入」展示用标题（如中文）；与 subjectOriginal 二选一展示取决于是否开启自动翻译 */
  subject: string;
  /** 平台侧原文标题（多为英文）。关闭自动翻译时列表只展示此项，不调用翻译模型 */
  subjectOriginal?: string;
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  slaDueAt: string;
  isImportant: boolean;
  isFavorite: boolean;
  isShared: boolean;
  tags: string[];
  /** 最近一条买家入站消息摘要（后端列表/详情填充；列表展示约 30 字） */
  lastInboundPreview?: string | null;
  /** 母系统 platform-site 同步：店铺默认货币（ISO），订单币种为空时用于金额展示 */
  channelDefaultCurrency?: string | null;
  /** 母系统 platform-site：平台/站点语言代码 */
  channelPlatformLanguage?: string | null;
  /** 已关联母系统会话；本地无消息时提示执行收件箱同步 */
  motherConversationLinked?: boolean;
}

export interface Message {
  id: string;
  ticketId: string;
  senderId: string;
  /** customer / manager：左侧入站；agent / ai：右侧出站；system：系统提示 */
  senderType: 'customer' | 'manager' | 'agent' | 'system' | 'ai';
  /** 平台侧原文（入站）或客服输入原文（出站已译发时） */
  content: string;
  createdAt: string;
  attachments?: string[];
  isInternal?: boolean;
  /** 客服端看到的入站译文（与 content 成对）；开启自动翻译时默认展示本字段 */
  translatedContent?: string;
  /** 出站已译为平台语并发送的文本（与 content 成对）；会话列表默认展示本字段 */
  sentPlatformText?: string;
  /** 客服出站消息实际送达的店铺/平台侧（演示用） */
  deliveryTargets?: ('customer' | 'manager')[];
  /** 出站消息发送状态 */
  deliveryStatus?: 'sending' | 'success' | 'failed';
  /** 发送失败原因 */
  deliveryError?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'team_lead' | 'agent' | 'finance' | 'operations' | 'external';
  avatar?: string;
}

export enum AfterSalesType {
  REFUND = 'refund',
  RETURN = 'return',
  EXCHANGE = 'exchange',
  REISSUE = 'reissue',
}

export enum AfterSalesStatus {
  SUBMITTED = 'submitted',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

export interface AfterSalesRecord {
  id: string;
  orderId: string;
  ticketId: string;
  type: AfterSalesType;
  status: AfterSalesStatus;
  handlingMethod: string;
  priority: 'low' | 'medium' | 'high';
  problemType: string;
  buyerFeedback: string;
  createdAt: string;
  updatedAt: string;
  refundAmount?: number;
  refundReason?: string;
  returnTrackingNumber?: string;
  returnCarrier?: string;
  reissueSku?: string;
  reissueQuantity?: number;
  /** 关联工单店铺展示名（接口返回，用于可读售后单号） */
  channelShopLabel?: string;
  channelPlatformType?: string | null;
  /** 关联订单摘要（列表展示，来自订单 + 店铺） */
  orderPlatformOrderId?: string;
  orderAmount?: number;
  orderCurrency?: string;
  orderProductTitles?: string[];
  orderChannelShopLabel?: string;
  orderChannelPlatformType?: string | null;
}

/** 同租户可配置角色；permissionKeys 与 `src/lib/seatPermissions.ts` 中键一致 */
export interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissionKeys: string[];
  /** 所选权限包；与 permissionKeys 不一致时为 custom */
  permissionTemplateId?: 'standard' | 'lead' | 'finance' | 'configurator' | 'full' | 'custom';
}

/** 客服坐席：登录帐号下的业务处理席位 */
export interface AgentSeat {
  id: string;
  displayName: string;
  email: string;
  /** 登录账号（可与邮箱不同） */
  account: string;
  roleId: string;
  status: 'active' | 'inactive';
  /** 演示：已设置登录密码（不落库明文，仅状态位） */
  loginPasswordConfigured?: boolean;
}

/**
 * 工单/会话自动分配规则（与「未分配」池对应：无匹配或未启用坐席时进入未分配）
 * conditions 存 JSON：`platformTypes` / `channelIds` / `afterSalesTypes` 均为 string[]，**空数组表示该维度不限**。
 */
export interface TicketRoutingRule {
  id: string;
  priority: number;
  /** 与后端评估同序：同具体度、同 priority 时按创建时间；演示数据可省略 */
  createdAt?: string;
  /** 平台类型（通常对应 Channel.platformType；演示可为展示用字符串） */
  platformTypes: string[];
  /** 店铺 channelId（UUID 或演示 id） */
  channelIds: string[];
  /** 售后归因字典 value，与字段管理「售后类型」一致 */
  afterSalesTypes: string[];
  assignToSeatId: string;
  enabled: boolean;
}
