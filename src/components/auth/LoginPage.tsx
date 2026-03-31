import { useAuth } from '@/src/hooks/useAuth';
import { Globe, ShieldCheck, Zap, MessageSquare, Smartphone, Key, QrCode } from 'lucide-react';
import { useState } from 'react';
import { NezhaLogo } from '@/src/components/ui/NezhaLogo';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [loginMethod, setLoginMethod] = useState<'password' | 'code' | 'qr'>('password');

  const [loginAccount, setLoginAccount] = useState('');

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Left side - Value Proposition */}
      <div className="hidden lg:flex flex-col justify-center w-1/2 bg-slate-900 p-16 text-white space-y-12 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-orange-500 to-purple-600 blur-3xl" />
          <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tl from-blue-500 to-purple-600 blur-3xl" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <NezhaLogo className="h-10 w-auto" textFill="#FFFFFF" subTextFill="#CBD5E1" />
        </div>
        
        <div className="relative z-10 space-y-8">
          <h2 className="text-5xl font-bold leading-tight tracking-tight">
            跨境卖家多平台<br />消息聚合处理中心
          </h2>
          <p className="text-xl text-slate-300 max-w-lg">
            AI 自动化回复，提升利润空间。一站式管理所有客户沟通，实时监控 SLA 履约状态。
          </p>
        </div>
        
        <div className="relative z-10 grid grid-cols-2 gap-8">
          <div className="space-y-3">
            <div className="p-3 bg-white/10 backdrop-blur-sm w-fit rounded-xl border border-white/10">
              <Globe className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="font-bold text-lg">多平台聚合</h3>
            <p className="text-sm text-slate-400">支持欧洲小语种等主流跨境电商平台。</p>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-white/10 backdrop-blur-sm w-fit rounded-xl border border-white/10">
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="font-bold text-lg">AI 智能回复</h3>
            <p className="text-sm text-slate-400">意图识别，自动草稿，多语言润色。</p>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-white/10 backdrop-blur-sm w-fit rounded-xl border border-white/10">
              <ShieldCheck className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="font-bold text-lg">SLA 实时监控</h3>
            <p className="text-sm text-slate-400">超时预警，确保首次响应与解决时效。</p>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-white/10 backdrop-blur-sm w-fit rounded-xl border border-white/10">
              <MessageSquare className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="font-bold text-lg">商业智能面板</h3>
            <p className="text-sm text-slate-400">订单、物流、发票、售后一目了然。</p>
          </div>
        </div>
      </div>
      
      {/* Right side - Login Card */}
      <div className="flex flex-col items-center justify-center w-full lg:w-1/2 p-8 bg-slate-50">
        <div className="w-full max-w-[420px] space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">欢迎登录</h2>
            <p className="text-slate-500">哪吒科技生态 - 智能客服子系统</p>
          </div>
          
          <div className="bg-white p-8 rounded-[24px] shadow-xl shadow-slate-200/50 border border-slate-100 space-y-6">
            
            {/* Login Method Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button 
                onClick={() => setLoginMethod('password')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${loginMethod === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                密码登录
              </button>
              <button 
                onClick={() => setLoginMethod('code')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${loginMethod === 'code' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                验证码登录
              </button>
            </div>

            {loginMethod === 'password' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">账号 / 手机号</label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="text" 
                      value={loginAccount}
                      onChange={(e) => setLoginAccount(e.target.value)}
                      placeholder="请输入账号或手机号（输入包含 agent 可测试客服角色）"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 rounded-xl text-sm transition-all outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">密码</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="password" 
                      placeholder="请输入密码"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 rounded-xl text-sm transition-all outline-none"
                    />
                  </div>
                </div>
                {/* CAPTCHA Placeholder */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">验证码</label>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="图形验证码"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 rounded-xl text-sm transition-all outline-none"
                    />
                    <div className="w-24 h-[46px] bg-slate-200 rounded-xl flex items-center justify-center text-slate-500 text-sm font-mono tracking-widest cursor-pointer hover:bg-slate-300 transition-colors">
                      8X2A
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loginMethod === 'code' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">手机号</label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      type="tel" 
                      placeholder="请输入手机号"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 rounded-xl text-sm transition-all outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">短信验证码</label>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="请输入验证码"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 rounded-xl text-sm transition-all outline-none"
                    />
                    <button className="whitespace-nowrap px-4 py-3 bg-orange-50 text-orange-600 font-medium rounded-xl text-sm hover:bg-orange-100 transition-colors">
                      获取验证码
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors">自动登录</span>
              </label>
              <button className="text-xs font-medium text-slate-500 hover:text-orange-600 transition-colors">忘记密码？</button>
            </div>
            
            <button 
              onClick={() => signIn(loginAccount)}
              className="w-full py-3.5 bg-[#F97316] text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95"
            >
              登录
            </button>

            <div className="relative pt-4">
              <div className="absolute inset-0 flex items-center pt-4">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs font-medium text-slate-400">
                <span className="bg-white px-4">其他登录方式</span>
              </div>
            </div>

            <div className="flex justify-center gap-6 pt-2">
              <button 
                onClick={signIn}
                className="flex flex-col items-center gap-2 group"
                title="Google SSO"
              >
                <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center group-hover:bg-slate-50 group-hover:border-slate-300 transition-all">
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
                </div>
                <span className="text-[10px] text-slate-400 group-hover:text-slate-600">SSO</span>
              </button>
              
              <button 
                className="flex flex-col items-center gap-2 group"
                title="微信登录"
              >
                <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center group-hover:bg-[#07C160]/10 group-hover:border-[#07C160]/30 transition-all">
                  <MessageSquare className="w-5 h-5 text-slate-400 group-hover:text-[#07C160] transition-colors" />
                </div>
                <span className="text-[10px] text-slate-400 group-hover:text-slate-600">微信</span>
              </button>

              <button 
                className="flex flex-col items-center gap-2 group"
                title="扫码登录"
              >
                <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center group-hover:bg-purple-50 group-hover:border-purple-200 transition-all">
                  <QrCode className="w-5 h-5 text-slate-400 group-hover:text-purple-600 transition-colors" />
                </div>
                <span className="text-[10px] text-slate-400 group-hover:text-slate-600">扫码</span>
              </button>
            </div>
          </div>
          
          <p className="text-center text-xs text-slate-400">
            登录即代表您同意 <a href="#" className="text-slate-500 hover:text-orange-600 transition-colors">服务条款</a> 和 <a href="#" className="text-slate-500 hover:text-orange-600 transition-colors">隐私政策</a>
          </p>
        </div>
      </div>
    </div>
  );
}
