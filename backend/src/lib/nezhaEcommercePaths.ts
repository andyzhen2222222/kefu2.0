/**
 * 哪吒母系统 — 会话与消息相关 HTTP 路径（仅 /v1/api/ecommerce，不使用 /v1/admin）。
 * 列表同步用下列两个；单条详情与回复为同一会话资源的子路径。
 */
export const NEZHA_PLATFORM_CONVERSATION_API = '/v1/api/ecommerce/platform-conversation';
export const NEZHA_PLATFORM_CONVERSATION_MESSAGE_API = '/v1/api/ecommerce/platform-conversation-message';

export function nezhaPlatformConversationDetailPath(conversationId: string): string {
  return `${NEZHA_PLATFORM_CONVERSATION_API}/${encodeURIComponent(String(conversationId).trim())}`;
}

export function nezhaPlatformConversationReplyPath(conversationId: string): string {
  return `${nezhaPlatformConversationDetailPath(conversationId)}/reply`;
}
