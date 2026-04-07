import type { ReactNode, ReactElement } from 'react';
import { cn } from '@/src/lib/utils';
import { formatOrderMoney } from '@/src/lib/orderDisplay';
import { platformGroupLabelForTicket } from '@/src/lib/platformLabels';
import { readableIdTail } from '@/src/lib/businessRefDisplay';
import { AfterSalesRecord, AfterSalesType } from '@/src/types';
import { format } from 'date-fns';

export function afterSalesMinimalRef(record: AfterSalesRecord): string {
  const d = format(new Date(record.createdAt), 'MM-dd');
  return `${d}·${readableIdTail(record.id)}`;
}

function orderSummarySource(record: AfterSalesRecord): {
  platformType: string | null | undefined;
  shopLabel: string | undefined;
  platformOrderId?: string;
  amount?: number;
  currency?: string;
  titles?: string[];
} {
  const shop = record.orderChannelShopLabel ?? record.channelShopLabel;
  const pt = record.orderChannelPlatformType ?? record.channelPlatformType;
  return {
    platformType: pt,
    shopLabel: shop,
    platformOrderId: record.orderPlatformOrderId,
    amount: record.orderAmount,
    currency: record.orderCurrency,
    titles: record.orderProductTitles,
  };
}

function compactInternalOrderId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 12)}…`;
}

export function AfterSalesOrderAndIssueCell(props: {
  record: AfterSalesRecord;
  ticketLink: ReactNode;
}): ReactElement {
  const { record, ticketLink } = props;
  const src = orderSummarySource(record);
  const platform = platformGroupLabelForTicket(src.platformType ?? null, src.shopLabel ?? '');
  const shopSeg =
    src.shopLabel && platform && src.shopLabel.toLowerCase().startsWith(platform.toLowerCase() + ' ')
      ? src.shopLabel.slice(platform.length).trim()
      : src.shopLabel;
  const titles = src.titles?.length ? src.titles : [];
  const firstTitle = titles[0] ?? '';
  const more = titles.length > 1 ? titles.length - 1 : 0;
  const amountLine =
    src.amount != null
      ? formatOrderMoney(src.amount, src.currency)
      : null;

  return (
    <div className="space-y-2 min-w-0 max-w-xl">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
        <span className="font-semibold text-slate-700">{platform}</span>
        {shopSeg ? (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-slate-600 truncate max-w-[200px]" title={src.shopLabel}>
              {shopSeg}
            </span>
          </>
        ) : null}
      </div>
      <div className="text-xs text-slate-800 space-y-0.5">
        {src.platformOrderId ? (
          <div className="font-mono text-[12px]">
            订单 <span className="font-semibold text-slate-900">#{src.platformOrderId}</span>
            <span className="text-slate-400 font-normal ml-2">内 {compactInternalOrderId(record.orderId)}</span>
          </div>
        ) : (
          <div className="font-mono text-[12px] text-slate-600">内单 {compactInternalOrderId(record.orderId)}</div>
        )}
        {firstTitle ? (
          <p className="text-slate-700 line-clamp-2 leading-snug" title={titles.join('；')}>
            {firstTitle}
            {more > 0 ? (
              <span className="text-slate-400 font-medium"> · +{more} 件</span>
            ) : null}
          </p>
        ) : (
          <p className="text-slate-400 italic">暂无商品摘要</p>
        )}
        {amountLine ? <p className="font-semibold text-slate-900 tabular-nums">{amountLine}</p> : null}
      </div>
      <div className="pt-1 border-t border-slate-100 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
              record.priority === 'high'
                ? 'bg-red-50 text-red-700'
                : record.priority === 'medium'
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-slate-100 text-slate-600'
            )}
          >
            {record.priority === 'high' ? '高优先' : record.priority === 'medium' ? '中优先' : '低优先'}
          </span>
          <span className="text-xs font-bold text-slate-800">{record.problemType || '—'}</span>
        </div>
        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{record.buyerFeedback || '—'}</p>
      </div>
      {ticketLink}
    </div>
  );
}

const TYPE_BADGE: Record<
  AfterSalesType,
  { label: string; className: string }
> = {
  [AfterSalesType.REFUND]: { label: '仅退款', className: 'bg-red-50 text-red-600 border-red-100' },
  [AfterSalesType.RETURN]: { label: '退货退款', className: 'bg-blue-50 text-blue-600 border-blue-100' },
  [AfterSalesType.EXCHANGE]: { label: '换货', className: 'bg-purple-50 text-purple-600 border-purple-100' },
  [AfterSalesType.REISSUE]: { label: '重发', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
};

export function AfterSalesTypeBadge({ type }: { type: AfterSalesType }): ReactElement {
  const b = TYPE_BADGE[type];
  return (
    <span
      className={cn(
        'inline-flex px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap',
        b.className
      )}
    >
      {b.label}
    </span>
  );
}

export function AfterSalesTypeDetailsCell({ record }: { record: AfterSalesRecord }): ReactElement {
  switch (record.type) {
    case AfterSalesType.REFUND:
      return (
        <ul className="text-xs text-slate-700 space-y-1.5 list-none">
          <li>
            <span className="text-slate-400">退款金额</span>{' '}
            <span className="font-semibold tabular-nums">
              {record.refundAmount != null
                ? formatOrderMoney(record.refundAmount, record.orderCurrency ?? 'USD')
                : '—'}
            </span>
          </li>
          {record.refundReason ? (
            <li className="text-[11px] text-slate-500 line-clamp-3" title={record.refundReason}>
              <span className="text-slate-400">说明</span> {record.refundReason}
            </li>
          ) : null}
        </ul>
      );
    case AfterSalesType.RETURN:
      return (
        <ul className="text-xs text-slate-700 space-y-1.5 list-none">
          <li>
            <span className="text-slate-400">退件单号</span>{' '}
            <span className="font-mono font-medium">{record.returnTrackingNumber || '—'}</span>
          </li>
          <li>
            <span className="text-slate-400">承运商</span>{' '}
            <span>{record.returnCarrier || '—'}</span>
          </li>
        </ul>
      );
    case AfterSalesType.EXCHANGE:
      return (
        <ul className="text-xs text-slate-700 space-y-1.5 list-none">
          <li>
            <span className="text-slate-400">目标 SKU</span>{' '}
            <span className="font-mono font-medium">{record.reissueSku || '—'}</span>
          </li>
          <li>
            <span className="text-slate-400">数量</span>{' '}
            <span className="tabular-nums font-medium">{record.reissueQuantity ?? '—'}</span>
          </li>
        </ul>
      );
    case AfterSalesType.REISSUE:
      return (
        <ul className="text-xs text-slate-700 space-y-1.5 list-none">
          <li>
            <span className="text-slate-400">补发 SKU</span>{' '}
            <span className="font-mono font-medium">{record.reissueSku || '—'}</span>
          </li>
          <li>
            <span className="text-slate-400">数量</span>{' '}
            <span className="tabular-nums font-medium">{record.reissueQuantity ?? '—'}</span>
          </li>
        </ul>
      );
    default:
      return <span className="text-xs text-slate-400">—</span>;
  }
}
