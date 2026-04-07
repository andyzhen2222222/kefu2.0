/**
 * 17track API 适配器 (v2.4)
 * 文档: https://api.17track.net/zh-cn/doc?version=v2.4
 */

import { prisma } from '../lib/prisma.js';

const TRACK17_API_BASE = 'https://api.17track.net';
const getTrack17Token = () => process.env.TRACK17_API_TOKEN?.trim() ?? '';

export interface Track17RegistrationItem {
  number: string;
  carrier?: number; // 运输商 ID，可选
  tag?: string;    // 自定义标签，可选
}

export interface Track17Response<T> {
  code: number; // 0 表示成功
  data: T;
  message?: string;
}

export interface Track17TrackInfo {
  number: string;
  carrier: number;
  status: string; // 状态：NotFound, InfoReceived, InTransit, PickUp, OutForDelivery, Delivered, Exception, Expired
  sub_status?: string; // 子状态
  last_event?: string; // 最新事件描述
  events?: {
    time: string; // 事件时间 (ISO 8601)
    description: string; // 事件描述
    location?: string; // 事件地点
    status?: string; // 事件状态
  }[];
}

export interface DetailedLogisticsStatus {
  primaryStatus: string;
  secondaryStatus: string;
  primaryCode: string;
  secondaryCode: string;
  shippingStatus: string;
  isException: boolean;
}

/**
 * 根据 17track 的主状态和子状态映射详细的一二级状态
 */
export function mapDetailedLogisticsStatus(mainStatus: string, subStatus?: string): DetailedLogisticsStatus {
  // 默认兜底
  const fallback: DetailedLogisticsStatus = {
    primaryStatus: '查询不到',
    secondaryStatus: '运输商没有返回任何信息',
    primaryCode: '09',
    secondaryCode: '091',
    shippingStatus: 'unshipped',
    isException: false,
  };

  const key = subStatus ? `${mainStatus}_${subStatus}` : mainStatus;

  const mapping: Record<string, DetailedLogisticsStatus> = {
    // NotFound
    NotFound: { primaryStatus: '查询不到', secondaryStatus: '运输商没有返回任何信息', primaryCode: '09', secondaryCode: '091', shippingStatus: 'unshipped', isException: false },
    NotFound_Other: { primaryStatus: '查询不到', secondaryStatus: '运输商没有返回任何信息', primaryCode: '09', secondaryCode: '091', shippingStatus: 'unshipped', isException: false },
    NotFound_InvalidCode: { primaryStatus: '查询不到', secondaryStatus: '物流单号无效，无法进行查询', primaryCode: '09', secondaryCode: '092', shippingStatus: 'unshipped', isException: false },

    // InfoReceived
    InfoReceived: { primaryStatus: '已接收信息', secondaryStatus: '无细分含义，与主状态一致', primaryCode: '04', secondaryCode: '041', shippingStatus: 'unshipped', isException: false },

    // InTransit
    InTransit: { primaryStatus: '运输中', secondaryStatus: '其他运输中的情况', primaryCode: '02', secondaryCode: '025', shippingStatus: 'shipped', isException: false },
    InTransit_PickedUp: { primaryStatus: '运输中', secondaryStatus: '运输商已从发件人处取回包裹（已揽收）', primaryCode: '02', secondaryCode: '021', shippingStatus: 'shipped', isException: false },
    InTransit_Departure: { primaryStatus: '运输中', secondaryStatus: '包裹已离开出发国 / 地区港口', primaryCode: '02', secondaryCode: '022', shippingStatus: 'shipped', isException: false },
    InTransit_Arrival: { primaryStatus: '运输中', secondaryStatus: '包裹已抵达目的国 / 地区港口', primaryCode: '02', secondaryCode: '023', shippingStatus: 'shipped', isException: false },
    InTransit_CustomsProcessing: { primaryStatus: '运输中', secondaryStatus: '包裹正在清关流程中', primaryCode: '02', secondaryCode: '024', shippingStatus: 'shipped', isException: false },
    InTransit_Other: { primaryStatus: '运输中', secondaryStatus: '其他运输中的情况', primaryCode: '02', secondaryCode: '025', shippingStatus: 'shipped', isException: false },

    // AvailableForPickup
    AvailableForPickup: { primaryStatus: '到达待取', secondaryStatus: '包裹已到达自提点，等待收件人领取', primaryCode: '07', secondaryCode: '071', shippingStatus: 'shipped', isException: true },
    AvailableForPickup_Other: { primaryStatus: '到达待取', secondaryStatus: '包裹已到达自提点，等待收件人领取', primaryCode: '07', secondaryCode: '071', shippingStatus: 'shipped', isException: true },

    // OutForDelivery
    OutForDelivery: { primaryStatus: '派送中', secondaryStatus: '快递员已取出包裹，正在上门派送途中', primaryCode: '03', secondaryCode: '031', shippingStatus: 'shipped', isException: false },
    OutForDelivery_Other: { primaryStatus: '派送中', secondaryStatus: '快递员已取出包裹，正在上门派送途中', primaryCode: '03', secondaryCode: '031', shippingStatus: 'shipped', isException: false },

    // Delivered
    Delivered: { primaryStatus: '已妥投', secondaryStatus: '包裹已完成投递（无签收记录）', primaryCode: '01', secondaryCode: '012', shippingStatus: 'shipped', isException: false },
    Delivered_Signed: { primaryStatus: '已妥投', secondaryStatus: '包裹已由收件人签收确认', primaryCode: '01', secondaryCode: '011', shippingStatus: 'shipped', isException: false },
    Delivered_Other: { primaryStatus: '已妥投', secondaryStatus: '包裹已完成投递（无签收记录）', primaryCode: '01', secondaryCode: '012', shippingStatus: 'shipped', isException: false },

    // DeliveryFailure
    DeliveryFailure: { primaryStatus: '投递失败', secondaryStatus: '其他投递失败情况', primaryCode: '05', secondaryCode: '054', shippingStatus: 'shipped', isException: true },
    DeliveryFailure_Missed: { primaryStatus: '投递失败', secondaryStatus: '收件人不在家，派送员将重新安排投递', primaryCode: '05', secondaryCode: '051', shippingStatus: 'shipped', isException: true },
    DeliveryFailure_AddressUnknown: { primaryStatus: '投递失败', secondaryStatus: '收件地址不明，无法完成投递', primaryCode: '05', secondaryCode: '052', shippingStatus: 'shipped', isException: true },
    DeliveryFailure_RemoteArea: { primaryStatus: '投递失败', secondaryStatus: '收件地址为偏远地区，暂不支持派送', primaryCode: '05', secondaryCode: '053', shippingStatus: 'shipped', isException: true },
    DeliveryFailure_Other: { primaryStatus: '投递失败', secondaryStatus: '其他投递失败情况', primaryCode: '05', secondaryCode: '054', shippingStatus: 'shipped', isException: true },

    // Expired
    Expired: { primaryStatus: '运输过久', secondaryStatus: '包裹长时间无状态更新，系统停止跟踪', primaryCode: '06', secondaryCode: '061', shippingStatus: 'shipped', isException: true },
    Expired_Other: { primaryStatus: '运输过久', secondaryStatus: '包裹长时间无状态更新，系统停止跟踪', primaryCode: '06', secondaryCode: '061', shippingStatus: 'shipped', isException: true },

    // Exception
    Exception: { primaryStatus: '异常', secondaryStatus: '其他异常情况', primaryCode: '08', secondaryCode: '085', shippingStatus: 'shipped', isException: true },
    Exception_Returned: { primaryStatus: '异常', secondaryStatus: '包裹正在退回发件人', primaryCode: '08', secondaryCode: '081', shippingStatus: 'shipped', isException: true },
    Exception_CustomsDetained: { primaryStatus: '异常', secondaryStatus: '包裹被海关扣留', primaryCode: '08', secondaryCode: '082', shippingStatus: 'shipped', isException: true },
    Exception_Damaged: { primaryStatus: '异常', secondaryStatus: '包裹在运输途中出现破损', primaryCode: '08', secondaryCode: '083', shippingStatus: 'shipped', isException: true },
    Exception_Lost: { primaryStatus: '异常', secondaryStatus: '包裹在运输途中丢失', primaryCode: '08', secondaryCode: '084', shippingStatus: 'shipped', isException: true },
    Exception_Other: { primaryStatus: '异常', secondaryStatus: '其他异常情况', primaryCode: '08', secondaryCode: '085', shippingStatus: 'shipped', isException: true },
    Exception_Returning: { primaryStatus: '异常', secondaryStatus: '包裹正在退回寄件人途中', primaryCode: '08', secondaryCode: '086', shippingStatus: 'shipped', isException: true },
  };

  // 尝试匹配具体子状态
  if (mapping[key]) return mapping[key];

  // 尝试匹配主状态
  if (mapping[mainStatus]) return mapping[mainStatus];

  return fallback;
}

/**
 * 注册查询单号 (最多 40 个)
 */
export async function registerTrack17(items: Track17RegistrationItem[]): Promise<boolean> {
  const token = getTrack17Token();
  if (!token || items.length === 0) return false;

  try {
    const res = await fetch(`${TRACK17_API_BASE}/track/v2.4/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': token,
      },
      body: JSON.stringify(items),
    });

    const json = (await res.json()) as Track17Response<{ accepted: any[]; rejected: any[] }>;
    if (!res.ok) return false;
    return json.code === 0;
  } catch (error) {
    console.error('[track17] register error:', error);
    return false;
  }
}

/**
 * 获取轨迹详情 (最多 40 个单号)
 */
export async function getTrack17List(numbers: string[]): Promise<Track17TrackInfo[]> {
  const token = getTrack17Token();
  if (!token || numbers.length === 0) return [];

  try {
    // v2.4 使用 gettrackinfo 获取详细轨迹
    const res = await fetch(`${TRACK17_API_BASE}/track/v2.4/gettrackinfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': token,
      },
      body: JSON.stringify(numbers.map((n) => ({ number: n }))),
    });

    const json = (await res.json()) as Track17Response<{
      accepted: {
        number: string;
        carrier: number;
        track_info: {
          latest_status: { status: string; sub_status: string };
          tracking: {
            providers: {
              events: {
                time_iso: string;
                description: string;
                location?: string;
                stage?: string;
              }[];
            }[];
          };
        };
      }[];
      rejected: { number: string; error: any }[];
    }>;

    if (!res.ok || json.code !== 0) {
      return [];
    }

    return (json.data.accepted || []).map((item) => {
      const trackInfo = item.track_info;
      const provider = trackInfo?.tracking?.providers?.[0];
      return {
        number: item.number,
        carrier: item.carrier,
        status: trackInfo?.latest_status?.status || 'NotFound',
        sub_status: trackInfo?.latest_status?.sub_status,
        events: (provider?.events || []).map((e) => ({
          time: e.time_iso,
          description: e.description,
          location: e.location,
          status: e.stage,
        })),
      };
    });
  } catch (error) {
    console.error('[track17] gettracklist error:', error);
    return [];
  }
}

/**
 * 将 17track 状态映射到系统内部状态
 */
export function mapTrack17Status(status: string): string {
  const map: Record<string, string> = {
    NotFound: 'NotFound',
    InfoReceived: 'InfoReceived',
    InTransit: 'InTransit',
    PickUp: 'AvailableForPickup',
    OutForDelivery: 'OutForDelivery',
    Delivered: 'Delivered',
    Exception: 'Exception',
    Expired: 'Expired',
  };
  return map[status] || status;
}

/**
 * 同步订单物流信息
 */
/**
 * 同步订单物流信息
 */
export async function syncOrderLogistics(
  orderId: string,
  trackingNumber: string,
  force = false
): Promise<{ success: boolean; message?: string }> {
  // 1. 获取当前订单状态，检查限频
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      logisticsLastSyncedAt: true,
      logisticsPrimaryStatus: true,
      logisticsStatusCode: true,
      logisticsIsRegistered: true,
    },
  });

  if (!force && order?.logisticsLastSyncedAt) {
    const now = new Date();
    const lastSync = new Date(order.logisticsLastSyncedAt);
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMins = diffMs / (1000 * 60);

    // 如果是“已妥投”且已经同步过，除非强制刷新，否则 24 小时内不重复查
    if (order.logisticsStatusCode === '01' && diffMins < 24 * 60) {
      return { success: true, message: 'Status is Delivered, skipping refresh' };
    }

    // 普通状态 30 分钟内不重复查
    if (diffMins < 30) {
      return { success: true, message: 'Synced recently, skipping refresh' };
    }
  }

  const trackInfos = await getTrack17List([trackingNumber]);

  if (trackInfos.length === 0) {
    // 如果没有查到，且尚未注册过，尝试注册
    let registered = order?.logisticsIsRegistered || false;
    let message = 'No tracking info yet.';

    if (!registered) {
      registered = await registerTrack17([{ number: trackingNumber }]);
      message = registered
        ? 'Tracking number registered on 17track. Please wait for sync.'
        : 'Failed to register or no info yet.';
    } else {
      message = 'Tracking is registered but 17track has no info yet. Please wait.';
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        logisticsLastSyncedAt: new Date(),
        logisticsIsRegistered: registered,
        // 如果注册成功但还没查到轨迹，至少把状态标记为“查询不到”而不是 null
        logisticsStatus: order?.logisticsStatusCode ? undefined : 'NotFound',
        logisticsPrimaryStatus: order?.logisticsStatusCode ? undefined : '查询不到',
        logisticsSecondaryStatus: order?.logisticsStatusCode ? undefined : '已提交查询，请等待同步',
        logisticsStatusCode: order?.logisticsStatusCode ? undefined : '09',
        logisticsSubStatusCode: order?.logisticsStatusCode ? undefined : '091',
      },
    });

    return {
      success: true,
      message,
    };
  }

  const info = trackInfos[0];
  const mappedStatus = mapTrack17Status(info.status);
  const detailed = mapDetailedLogisticsStatus(info.status, info.sub_status);

  // 更新订单主表状态
  await prisma.order.update({
    where: { id: orderId },
    data: {
      logisticsStatus: mappedStatus,
      logisticsPrimaryStatus: detailed.primaryStatus,
      logisticsSecondaryStatus: detailed.secondaryStatus,
      logisticsStatusCode: detailed.primaryCode,
      logisticsSubStatusCode: detailed.secondaryCode,
      isLogisticsException: detailed.isException,
      logisticsLastSyncedAt: new Date(),
      logisticsIsRegistered: true,
      shippingStatus: detailed.shippingStatus,
    },
  });

  // 更新物流事件 (增量更新)
  if (info.events && info.events.length > 0) {
    for (const [idx, event] of info.events.entries()) {
      const timestamp = new Date(event.time);
      const description = event.description || '';

      const existing = await prisma.logisticsEvent.findFirst({
        where: {
          orderId,
          timestamp,
          description,
        },
      });

      if (!existing) {
        await prisma.logisticsEvent.create({
          data: {
            orderId,
            status: mappedStatus,
            subStatus: event.status || '',
            description,
            location: event.location || '',
            timestamp,
            sortIndex: idx,
          },
        });
      }
    }
  }

  return { success: true };
}
