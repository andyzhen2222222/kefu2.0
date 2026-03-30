import { useState } from 'react';
import { MessageSquare, Plus, Save } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import AddAutoReplyRuleModal from './AddAutoReplyRuleModal';

export default function AutoReplyRulesPage() {
  const [isAddAutoReplyModalOpen, setIsAddAutoReplyModalOpen] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">自动回复规则</h1>
            <p className="text-sm text-slate-500 mt-1">基于时间、关键字、订单状态配置自动回复</p>
          </div>
          <button 
            onClick={() => setIsAddAutoReplyModalOpen(true)}
            className="px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加规则
          </button>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="space-y-4">
            <div className="p-5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-slate-900">节假日自动回复</h3>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]"></div>
                </label>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex gap-2">
                  <span className="text-slate-500 w-20 shrink-0">触发条件:</span>
                  <span className="font-medium text-slate-900">非工作时间 (周六 00:00 - 周日 23:59)</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-500 w-20 shrink-0">回复模板:</span>
                  <span className="font-medium text-blue-600 hover:underline cursor-pointer">周末安抚模板 (多语言)</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-slate-500 w-20 shrink-0">执行动作:</span>
                  <span className="font-medium text-slate-900">发送回复并标记为"已回复"</span>
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

      <AddAutoReplyRuleModal 
        isOpen={isAddAutoReplyModalOpen} 
        onClose={() => setIsAddAutoReplyModalOpen(false)} 
      />
    </div>
  );
}
