import { useEffect, useState } from 'react';

export type MembershipTier = 'free' | 'member';

export const MEMBERSHIP_STORAGE_KEY = 'intellidesk_membership_tier';
export const MEMBERSHIP_CHANGE_EVENT = 'intellidesk-membership-changed';
export const MEMBERSHIP_UPGRADE_URL = 'https://tiaojia.nezhachuhai.com/buying';

function resolveTierFromQuery(): MembershipTier | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const membership = params.get('membership')?.trim().toLowerCase();
  if (membership === 'free' || membership === 'member') return membership;

  const member = params.get('member')?.trim().toLowerCase();
  if (member === '0' || member === 'false' || member === 'free') return 'free';
  if (member === '1' || member === 'true' || member === 'member') return 'member';
  return null;
}

function resolveDefaultTier(): MembershipTier {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return 'free';
  }
  return 'member';
}

export function getMembershipTier(): MembershipTier {
  const queryTier = resolveTierFromQuery();
  if (queryTier) return queryTier;

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(MEMBERSHIP_STORAGE_KEY)?.trim().toLowerCase();
      if (raw === 'free' || raw === 'member') return raw;
    } catch {
      /* ignore */
    }
  }

  return resolveDefaultTier();
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

export function memberFeatureMessage(feature: string): string {
  return `${feature}为会员功能，开通会员后即可使用。`;
}
