import { useState } from 'react';
import { Clock, Plus, Save } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import AddSLARuleModal from './AddSLARuleModal';

export default function SLAPage() {
  const [isAddSLAModalOpen, setIsAddSLAModalOpen] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">SLA 规则配置</h1>
            <p className="text-sm text-slate-500 mt-1">自定义不同平台和优先级的超时时间</p>
          </div>
          <button 
            onClick={() => setIsAddSLAModalOpen(true)}
            className="px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加规则
          </button>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="space-y-4">
            {/* SLA Rule Item */}
            <div className="p-5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">Amazon</span>
                  <h3 className="font-bold text-slate-900">标准回复时效</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">目标: 24小时</span>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]"></div>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-slate-500">警告阈值 (Warning)</span>
                  <p className="font-medium text-slate-900">剩余 2 小时</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500">超时阈值 (Timeout)</span>
                  <p className="font-medium text-slate-900">24 小时</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500">适用条件</span>
                  <p className="font-medium text-slate-900">所有 Amazon 消息</p>
                </div>
              </div>
            </div>

            {/* SLA Rule Item */}
            <div className="p-5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold">eBay</span>
                  <h3 className="font-bold text-slate-900">周末回复时效</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">目标: 48小时</span>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]"></div>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="text-slate-500">警告阈值 (Warning)</span>
                  <p className="font-medium text-slate-900">剩余 4 小时</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500">超时阈值 (Timeout)</span>
                  <p className="font-medium text-slate-900">48 小时</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500">适用条件</span>
                  <p className="font-medium text-slate-900">周六、周日</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
            <button className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-colors shadow-sm">
              <Save className="w-4 h-4" />
              保存更改
            </button>
          </div>
        </div>
      </div>

      <AddSLARuleModal 
        isOpen={isAddSLAModalOpen} 
        onClose={() => setIsAddSLAModalOpen(false)} 
      />
    </div>
  );
}
