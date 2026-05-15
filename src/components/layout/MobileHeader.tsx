import { Link, useNavigate, useLocation } from 'react-router-dom';
import { NezhaLogo } from '@/src/components/ui/NezhaLogo';
import { ChevronLeft } from 'lucide-react';
import { getMobileNavTitle } from '@/src/lib/mobileNavTitles';
import { cn } from '@/src/lib/utils';

export default function MobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const depth = location.pathname.split('/').filter(Boolean).length;
  const showBack = depth >= 2;

  const title = getMobileNavTitle(location.pathname);

  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-slate-200 bg-white/95 pt-safe backdrop-blur-sm supports-[backdrop-filter]:bg-white/90">
      <div className="grid h-12 min-h-[48px] grid-cols-[44px_1fr_44px] items-center px-1">
        <div className="flex justify-center">
          {showBack ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 active:bg-slate-200"
              aria-label="返回上一页"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2} />
            </button>
          ) : (
            <Link
              to="/"
              className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-slate-50"
              aria-label="返回工作台"
            >
              <NezhaLogo className="h-7 w-auto" />
            </Link>
          )}
        </div>

        <h1
          className={cn(
            'min-w-0 truncate text-center text-[15px] font-bold leading-tight tracking-tight text-slate-900'
          )}
          title={title}
        >
          {title}
        </h1>

        {/* 占位，保持标题绝对居中 */}
        <div className="w-11 shrink-0" aria-hidden />
      </div>
    </header>
  );
}
