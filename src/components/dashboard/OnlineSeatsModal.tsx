import { X } from 'lucide-react';
import type { AgentSeat } from '@/src/types';

interface OnlineSeatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  seats: AgentSeat[];
  onlineBySeatId: Record<string, boolean>;
}

export default function OnlineSeatsModal({
  isOpen,
  onClose,
  seats,
  onlineBySeatId,
}: OnlineSeatsModalProps) {
  if (!isOpen) return null;

  const activeSeats = seats.filter((s) => s.status === 'active');
  const onlineCount = activeSeats.filter((s) => onlineBySeatId[s.id]).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="online-seats-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 id="online-seats-title" className="text-lg font-bold text-slate-900">
              在线坐席
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              当前启用坐席 {activeSeats.length} 人 · 在线 {onlineCount} 人
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="p-4 max-h-[min(60vh,360px)] overflow-y-auto space-y-2">
          {activeSeats.length === 0 ? (
            <li className="text-sm text-slate-500 text-center py-8">暂无启用中的坐席</li>
          ) : (
            activeSeats.map((s) => {
              const online = Boolean(onlineBySeatId[s.id]);
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{s.displayName}</p>
                    <p className="text-xs text-slate-500 truncate">{s.account}</p>
                  </div>
                  <span
                    className={
                      online
                        ? 'shrink-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1'
                        : 'shrink-0 inline-flex items-center gap-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-semibold px-2.5 py-1'
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
                      aria-hidden
                    />
                    {online ? '在线' : '离线'}
                  </span>
                </li>
              );
            })
          )}
        </ul>

        <p className="px-6 pb-4 text-[11px] text-slate-400 leading-relaxed">
          当前为演示数据。接入后端后，在线状态将以坐席登录会话或心跳为准。
        </p>
      </div>
    </div>
  );
}
