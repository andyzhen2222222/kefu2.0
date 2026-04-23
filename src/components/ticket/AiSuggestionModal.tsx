import React from 'react';
import { X, RefreshCw, Check, Loader2, Sparkles, Languages } from 'lucide-react';
import { cn } from '@/src/lib/utils';
interface AiSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  suggestion: { suggestion: string; platformSuggestion?: string } | null;
  onAdopt: (text: string) => void;
  onRefresh: () => void;
}

export default function AiSuggestionModal({
  isOpen,
  onClose,
  isLoading,
  suggestion,
  onAdopt,
  onRefresh,
}: AiSuggestionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">AI 智能回复生成</h3>
              </div>
              <p className="text-xs text-slate-500">基于知识库与当前会话为您推荐最佳回复</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭 AI 智能回复生成弹窗"
            title="关闭"
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[300px] max-h-[70vh]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                <Sparkles className="w-5 h-5 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-900">正在查阅知识库并生成回复...</p>
                <p className="text-xs text-slate-500 mt-1">这可能需要几秒钟时间，请稍候</p>
              </div>
            </div>
          ) : suggestion ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500">
              {/* 我的语言 (中文) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wider">
                      我的语言 (预览)
                    </span>
                    <span className="text-xs font-medium text-slate-900">简体中文</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {suggestion.suggestion}
                </div>
              </div>

              {/* 平台语言 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100 uppercase tracking-wider">
                      平台语言 (发送)
                    </span>
                    <Languages className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <button
                    onClick={() => onAdopt(suggestion.platformSuggestion || suggestion.suggestion)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    采纳此回复
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-purple-50/30 border border-purple-100 text-sm text-slate-800 leading-relaxed font-medium whitespace-pre-wrap italic">
                  {suggestion.platformSuggestion || suggestion.suggestion}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Sparkles className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">暂无生成内容</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            不满意？重新生成
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
