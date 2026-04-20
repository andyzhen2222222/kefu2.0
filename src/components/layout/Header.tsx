import { Link } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import { cn } from '@/src/lib/utils';
import { Store, CreditCard, LogOut } from 'lucide-react';
import { NezhaLogo } from '@/src/components/ui/NezhaLogo';
import { useMembershipTier } from '@/src/lib/membership';
import { MembershipStatusPill } from '@/src/components/membership/MemberUi';

const mainNavItems = [
  { label: '订单', href: 'https://tiaojia.nezhachuhai.com/dashboard/analyzeOrder/platformOrderDetail' },
  { label: '商品', href: 'https://tiaojia.nezhachuhai.com/products/product/ozon' },
  { label: '跟卖', href: 'https://tiaojia.nezhachuhai.com/selection' },
  { label: '调价', href: 'https://tiaojia.nezhachuhai.com/welcome' },
  { label: '刊登', href: 'https://tiaojia.nezhachuhai.com/publish/welcome' },
  { label: '客服', href: '/', isActive: true },
];

export default function Header() {
  const { user, logout } = useAuth();
  const { isMember, setTier } = useMembershipTier();
  const showTierToggle = Boolean(import.meta.env.DEV);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <NezhaLogo className="h-8 w-auto" />
        </Link>

        {/* Main Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {mainNavItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                item.isActive 
                  ? "bg-orange-50 text-orange-600" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <MembershipStatusPill isMember={isMember} />
          {showTierToggle ? (
            <button
              type="button"
              onClick={() => setTier(isMember ? 'free' : 'member')}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              title="仅本地预览切换，不影响真实账号"
            >
              {isMember ? '切到非会员' : '切到会员'}
            </button>
          ) : null}
        </div>
        <a
          href="https://tiaojia.nezhachuhai.com/authorization"
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
        >
          <Store className="w-4 h-4" />
          授权店铺
        </a>
        <a
          href="https://tiaojia.nezhachuhai.com/buying"
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-md transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          购买套餐
        </a>

        <div className="w-px h-4 bg-slate-200 mx-2" />

        {user ? (
          <div className="flex items-center gap-3 group relative">
            <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-200 overflow-hidden flex items-center justify-center text-xs font-bold text-orange-700 cursor-pointer">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <button 
              onClick={logout}
              className="absolute right-0 top-full mt-2 w-32 bg-white border border-slate-200 rounded-md shadow-lg py-1 hidden group-hover:block"
            >
              <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-100 mb-1">
                {user.email}
              </div>
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer transition-colors">
                <LogOut className="w-4 h-4" />
                退出登录
              </div>
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
