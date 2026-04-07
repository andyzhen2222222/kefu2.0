/**
 * 工单路由：平台类型 key 与渠道过滤（与 backend ticketRoutingAssign matchesPlatform 语义对齐）
 */

export function platformKeyFromChannelType(platformType: string | null | undefined): string {
  const t = platformType?.trim();
  return t && t.length > 0 ? t : '__unset__';
}

export function channelMatchesPlatformKeys(
  channelPlatformType: string | null | undefined,
  selectedKeys: string[]
): boolean {
  if (selectedKeys.length === 0) return false;
  const key = platformKeyFromChannelType(channelPlatformType);
  return selectedKeys.some((sel) => {
    const s = sel.trim();
    if (s === key) return true;
    if (channelPlatformType?.trim() && s.toLowerCase() === channelPlatformType.trim().toLowerCase()) return true;
    if (s.toLowerCase() === key.toLowerCase()) return true;
    return false;
  });
}

export function filterChannelsByPlatformKeys<T extends { platformType: string | null }>(
  channels: T[],
  platformKeys: string[]
): T[] {
  if (platformKeys.length === 0) return [];
  return channels.filter((c) => channelMatchesPlatformKeys(c.platformType, platformKeys));
}

/** 仅有店铺 id 时反推应勾选的平台 key（编辑旧规则用） */
export function inferPlatformKeysFromChannelIds(
  channels: { id: string; platformType: string | null }[],
  channelIds: string[]
): string[] {
  const keys = new Set<string>();
  for (const id of channelIds) {
    const ch = channels.find((c) => c.id === id);
    if (ch) keys.add(platformKeyFromChannelType(ch.platformType));
  }
  return [...keys];
}

/** 保存前：有勾选店铺时，自动补齐其所属平台 key，避免 conditions 不一致 */
export function mergePlatformTypesWithChannels(
  platformTypes: string[],
  channelIds: string[],
  channels: { id: string; platformType: string | null }[]
): string[] {
  if (channelIds.length === 0) return [...platformTypes];
  const set = new Set(platformTypes);
  for (const id of channelIds) {
    const ch = channels.find((c) => c.id === id);
    if (ch) set.add(platformKeyFromChannelType(ch.platformType));
  }
  return [...set];
}

/** 平台变更后，去掉已不属于所选平台的店铺 id */
export function pruneChannelIdsForPlatforms(
  channelIds: string[],
  channels: { id: string; platformType: string | null }[],
  platformKeys: string[]
): string[] {
  if (platformKeys.length === 0) return [];
  const allowed = new Set(
    filterChannelsByPlatformKeys(channels, platformKeys).map((c) => c.id)
  );
  return channelIds.filter((id) => allowed.has(id));
}
