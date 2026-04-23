import { useEffect, useState } from 'react';

export type MembershipTier = 'free' | 'member';

export const MEMBERSHIP_STORAGE_KEY = 'intellidesk_membership_tier';
export const MEMBERSHIP_CHANGE_EVENT = 'intellidesk-membership-changed';
export const MEMBERSHIP_UPGRADE_URL = 'https://tiaojia.nezhachuhai.com/buying';

/** 订阅页入口图标悬停提示（与 UI 文案统一） */
export const PAID_FEATURE_HINT = '付费功能';

export function getMembershipTier(): MembershipTier {
  /** 产品策略：客服能力不按「个人会员」开关，一律视为已开通（平台套餐由 InboxList 等平台维度管理） */
  return 'member';
}

export function isMemberActive(): boolean {
  return getMembershipTier() === 'member';
}

export function setMembershipTier(next: MembershipTier): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MEMBERSHIP_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(MEMBERSHIP_CHANGE_EVENT, { detail: next }));
}

export function useMembershipTier() {
  const [tier, setTierState] = useState<MembershipTier>(() => getMembershipTier());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setTierState(getMembershipTier());
    window.addEventListener('storage', sync);
    window.addEventListener(MEMBERSHIP_CHANGE_EVENT, sync as EventListener);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(MEMBERSHIP_CHANGE_EVENT, sync as EventListener);
    };
  }, []);

  return {
    tier,
    isMember: tier === 'member',
    setTier: setMembershipTier,
  };
}

export function memberFeatureMessage(_feature: string): string {
  return '';
}
