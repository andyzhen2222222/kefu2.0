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

/** 收件箱消息处理状态：未读 / 未回复 / 已回复 */
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
  logisticsEvents?: LogisticsEvent[];
  carrier?: string;
  hasVatInfo?: boolean;
}

export interface Ticket {
  id: string;
  channelId: string;
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
  /** 客服出站消息实际送达的渠道（演示用） */
  deliveryTargets?: ('customer' | 'manager')[];
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
}

/** 同帐号下可配置的客服角色（权限集合为演示用标签） */
export interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissionKeys: string[];
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
 */
export interface TicketRoutingRule {
  id: string;
  priority: number;
  /** 空表示不限 */
  platform: string;
  store: string;
  afterSalesType: string;
  assignToSeatId: string;
  enabled: boolean;
}
