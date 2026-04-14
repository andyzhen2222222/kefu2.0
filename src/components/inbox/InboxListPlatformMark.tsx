import { cn } from '@/src/lib/utils';

type MarkDef = { bg: string; label: string };

function bucketKey(platformLabel: string): string {
  const u = platformLabel.toUpperCase();
  if (u.includes('AMAZON')) return 'AMAZON';
  if (u.includes('EBAY')) return 'EBAY';
  if (u.includes('SHOPIFY')) return 'SHOPIFY';
  if (u.includes('WALMART')) return 'WALMART';
  if (u.includes('CDISCOUNT')) return 'CDISCOUNT';
  if (u.includes('WORTEN')) return 'WORTEN';
  if (u.includes('EMAG')) return 'EMAG';
  if (u.includes('OZON')) return 'OZON';
  if (u.includes('TEMU')) return 'TEMU';
  if (u.includes('SHEIN')) return 'SHEIN';
  if (u.includes('TIKTOK')) return 'TIKTOK';
  if (u.includes('SHOPEE')) return 'SHOPEE';
  if (u.includes('LAZADA')) return 'LAZADA';
  if (u.includes('ALIEXPRESS')) return 'ALIEXPRESS';
  if (u.includes('MERCADO')) return 'MERCADO';
  if (u.includes('FNAC')) return 'FNAC';
  if (u.includes('ALLEGRO')) return 'ALLEGRO';
  if (u.includes('KAUFLAND')) return 'KAUFLAND';
  if (u.includes('WISH')) return 'WISH';
  if (u.includes('其他') || u === 'OTHER') return 'OTHER';
  return 'FALLBACK';
}

const BUCKET: Record<string, MarkDef> = {
  AMAZON: { bg: 'bg-[#FF9900]', label: 'A' },
  EBAY: { bg: 'bg-[#E53238]', label: 'E' },
  SHOPIFY: { bg: 'bg-[#95BF47]', label: 'S' },
  WALMART: { bg: 'bg-[#0071CE]', label: 'W' },
  CDISCOUNT: { bg: 'bg-[#0082C3]', label: 'C' },
  WORTEN: { bg: 'bg-[#E42313]', label: 'W' },
  EMAG: { bg: 'bg-[#005EB8]', label: 'e' },
  OZON: { bg: 'bg-[#005BFF]', label: 'O' },
  TEMU: { bg: 'bg-[#FF6F00]', label: 'T' },
  SHEIN: { bg: 'bg-[#000000]', label: 'H' },
  TIKTOK: { bg: 'bg-[#000000]', label: 'Tk' },
  SHOPEE: { bg: 'bg-[#EE4D2D]', label: 'P' },
  LAZADA: { bg: 'bg-[#0F146D]', label: 'L' },
  ALIEXPRESS: { bg: 'bg-[#E43225]', label: 'Ae' },
  MERCADO: { bg: 'bg-[#FFE600] text-black', label: 'M' },
  FNAC: { bg: 'bg-[#E75204]', label: 'F' },
  ALLEGRO: { bg: 'bg-[#FF5A00]', label: 'Al' },
  KAUFLAND: { bg: 'bg-[#E30B1C]', label: 'K' },
  WISH: { bg: 'bg-[#2FB7EC]', label: 'Wi' },
  OTHER: { bg: 'bg-slate-500', label: '?' },
  FALLBACK: { bg: 'bg-slate-400', label: '' },
};

/** 收件箱列表卡片右下角平台角标（色块 + 缩写） */
export function InboxListPlatformMark({ platformLabel }: { platformLabel: string }) {
  const key = bucketKey(platformLabel.trim() || '其他');
  const def = BUCKET[key] ?? BUCKET.FALLBACK;
  const letter =
    def.label ||
    (platformLabel.trim().slice(0, 1).toUpperCase() || '?');

  return (
    <span
      className={cn(
        'pointer-events-none inline-flex h-5 min-w-[1.15rem] max-w-[1.75rem] shrink-0 items-center justify-center rounded px-0.5 text-[8px] font-bold uppercase leading-none tracking-tight shadow-sm ring-1 ring-black/10',
        def.bg,
        key === 'MERCADO' ? 'text-black' : 'text-white'
      )}
      title={platformLabel}
    >
      {letter}
    </span>
  );
}
