import type { AgentSeat } from '@/src/types';

/**
 * 演示用初始坐席，与「设置 → 坐席与分配」默认数据一致。
 * 接入后端后由接口替换；在线状态由 DEMO_SEAT_ONLINE_BY_ID 模拟（如心跳/WebSocket）。
 */
export const DEMO_AGENT_SEATS_INITIAL: AgentSeat[] = [
  {
    id: 'seat-1',
    displayName: '李娜',
    email: 'lina@company.com',
    account: 'lina',
    roleId: 'role-agent',
    status: 'active',
    loginPasswordConfigured: true,
  },
  {
    id: 'seat-2',
    displayName: '王强',
    email: 'wang@company.com',
    account: 'wang.qiang',
    roleId: 'role-finance',
    status: 'active',
    loginPasswordConfigured: true,
  },
];

/** 演示：坐席是否处于「在线」（已登录且会话未过期）；未列出的坐席视为离线 */
export const DEMO_SEAT_ONLINE_BY_ID: Record<string, boolean> = {
  'seat-1': true,
  'seat-2': true,
};
