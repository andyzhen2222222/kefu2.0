import type {
  DashboardAiContext,
  DashboardInboxMetrics,
  DashboardStructure,
  TrendPoint,
} from '@/src/services/intellideskApi';

/**
 * 工作台「AI 效能洞察」系统提示词：约束角色、输入维度与输出形态。
 * 与 POST /api/ai/summarize-messages 前置说明配合使用（该接口会将 system/user 拼入总结任务）。
 */
export const DASHBOARD_AI_INSIGHT_SYSTEM_PROMPT = `你是 IntelliDesk 跨境电商客服主管的「数据洞察助手」。下面 USER 消息中会提供一份**当前租户工作台快照**（JSON），字段已尽量使用中文业务名。

你必须**只依据快照中的数字与分布**发言，不要编造未出现的指标；若某块数据缺失或全为 0，可简要说明「暂无数据」而非臆测。

分析时请**统筹考虑**以下维度（有则评，无则略）：
1. **工单队列**：未读、已读未回复、已回复的数量及环比（较昨日同时段）；积压是否在恶化。
2. **SLA**：当前 SLA 已超时工单数；未来 24 小时内即将到期的工单数（若快照提供）；是否需要优先消化高风险队列。
3. **工单工作流状态**：新建/待办/等待买家/已暂停/已解决/垃圾 等分布，判断是否在「等待买家」或「待办」上堆积。
4. **用户情绪**：愤怒抱怨、焦急催促等负面占比是否偏高，是否需升级流程或加强话术。
5. **意图/咨询结构**：各 intent（工单意图）占比，是否被物流、退款、发票等某类挤占。
6. **关联订单状态**：已退款、部分退款、未发货、已发货等占比；**退款/履约**是否与售后压力相关。
7. **平台分布**：各销售平台工单占比，是否某平台异常集中。
8. **售后单据**：售后单按状态（已提交/处理中/已完成/已拒绝）、按类型（退款/退货/换货/补发）的数量；若有「在途退款金额合计」，结合订单退款状态谈资金与处理压力。
9. **趋势**：所选时间窗口内每日新建工单数、已解决数；判断量是上升还是回落，与当前队列是否一致。

**输出格式（严格遵守）**：
- 使用**简体中文**。
- **共 2～3 句**：第 1～2 句概括整体健康度与最需关注的 1～2 个点（可跨维度关联，例如「负面情绪高 + 物流类 intent 多」）；第 3 句给**一条可执行建议**（具体、可当天落地，如优先处理某队列、关注某平台、协调售后与工单）。
- 不要输出 JSON、Markdown 标题或项目符号列表；语气专业、简洁。`;

function formatBucketLines(bucket: Record<string, { count: number; percent: number }> | undefined): string {
  if (!bucket || Object.keys(bucket).length === 0) return '（无）';
  return Object.entries(bucket)
    .map(([k, v]) => `${k}: ${v.count} 单 (${v.percent}%)`)
    .join('；');
}

function formatCountMap(obj: Record<string, number> | undefined): string {
  if (!obj || Object.keys(obj).length === 0) return '（无）';
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${v}`)
    .join('；');
}

function formatMetricCard(
  label: string,
  card: { current: number; previousSameTimeYesterday: number; changePercent: number | null }
): string {
  const pct =
    card.changePercent === null ? '环比 N/A' : `环比 ${card.changePercent >= 0 ? '+' : ''}${card.changePercent}%（较昨日同时段）`;
  return `${label}: 当前 ${card.current}，昨日同时段约 ${card.previousSameTimeYesterday}，${pct}`;
}

/** 将仪表盘已拉取的数据序列化为 USER 消息正文（JSON 文本块）。 */
export function buildDashboardInsightUserContent(input: {
  liveDash: boolean;
  metrics: DashboardInboxMetrics | null;
  structure: DashboardStructure | null;
  trendRange: '7d' | '30d';
  trendSeries: TrendPoint[];
  aiContext: DashboardAiContext | null;
}): string {
  const { liveDash, metrics, structure, trendRange, trendSeries, aiContext } = input;

  const payload: Record<string, unknown> = {
    dataMode: liveDash ? 'live' : 'demo',
    工单队列与环比: liveDash && metrics
      ? {
          未读: formatMetricCard('未读', metrics.unread),
          已读未回复: formatMetricCard('已读未回复', metrics.unreplied),
          已回复: formatMetricCard('已回复', metrics.replied),
          SLA已超时工单数: formatMetricCard('SLA已超时', metrics.slaOverdue),
        }
      : '演示模式：以下为示意数据，非真实租户',
    工单工作流状态分布: aiContext ? formatCountMap(aiContext.ticketsByWorkflowStatusZh) : '（未拉取）',
    SLA未来24小时内将到期未结案工单数:
      aiContext != null ? String(aiContext.slaDueWithin24hCount) : '（未拉取）',
    用户情绪分布: formatBucketLines(structure?.sentiment),
    工单意图分布: formatBucketLines(structure?.afterSalesIntent),
    关联订单状态分布: formatBucketLines(structure?.orderStatus),
    平台工单分布: formatBucketLines(structure?.channels),
    售后单按状态: aiContext ? formatCountMap(aiContext.afterSalesByStatusZh) : '（未拉取）',
    售后单按类型: aiContext ? formatCountMap(aiContext.afterSalesByTypeZh) : '（未拉取）',
    在途退款类售后单金额合计_未结案:
      aiContext?.openRefundAmountSum != null ? aiContext.openRefundAmountSum : '（无或未拉取）',
    趋势窗口: trendRange === '30d' ? '最近30天' : '最近7天',
    趋势按日: trendSeries.map((d) => ({ 日期: d.name, 新建工单: d.tickets, 已解决: d.resolved })),
    快照时间: aiContext?.generatedAt ?? new Date().toISOString(),
  };

  return `以下为本租户工作台数据快照，请按系统指令生成洞察。\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}
