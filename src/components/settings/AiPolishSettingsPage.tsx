import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  AI_POLISH_BUILTIN_DEFAULTS,
  loadAiPolishPresets,
  newPolishPresetId,
  persistAiPolishPresets,
  resetBuiltinPolishPreset,
  type AiPolishPreset,
} from '@/src/lib/aiPolishPresetsStore';

type Draft = {
  id?: string;
  name: string;
  hint: string;
  prompt: string;
  enabled: boolean;
};

const emptyDraft = (): Draft => ({
  name: '',
  hint: '',
  prompt: '【语气】',
  enabled: true,
});

export default function AiPolishSettingsPage() {
  const [presets, setPresets] = useState<AiPolishPreset[]>(() => loadAiPolishPresets());
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refresh = useCallback(() => setPresets(loadAiPolishPresets()), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openCreate = () => {
    setSaveError(null);
    setEditing(emptyDraft());
  };

  const openEdit = (p: AiPolishPreset) => {
    setSaveError(null);
    setEditing({
      id: p.id,
      name: p.name,
      hint: p.hint,
      prompt: p.prompt,
      enabled: p.enabled,
    });
  };

  const handleSave = () => {
    if (!editing) return;
    const name = editing.name.trim();
    const prompt = editing.prompt.trim();
    if (!name) {
      setSaveError('请填写方案名称');
      return;
    }
    if (!prompt) {
      setSaveError('请填写提示词内容');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    let next: AiPolishPreset[];
    if (editing.id) {
      next = presets.map((p) =>
        p.id === editing.id
          ? {
              ...p,
              name,
              hint: editing.hint.trim(),
              prompt,
              enabled: editing.enabled,
              updatedAt: today,
            }
          : p
      );
    } else {
      next = [
        ...presets,
        {
          id: newPolishPresetId(),
          name,
          hint: editing.hint.trim(),
          prompt,
          enabled: editing.enabled,
          builtin: false,
          sortOrder: presets.length,
          updatedAt: today,
        },
      ];
    }
    persistAiPolishPresets(next);
    setPresets(next);
    setEditing(null);
    setSaveError(null);
  };

  const toggleEnabled = (id: string) => {
    const next = presets.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
    persistAiPolishPresets(next);
    setPresets(next);
  };

  const handleDelete = (id: string) => {
    const target = presets.find((p) => p.id === id);
    if (!target || target.builtin) return;
    if (!window.confirm(`确定删除润色方案「${target.name}」？`)) return;
    const next = presets.filter((p) => p.id !== id);
    persistAiPolishPresets(next);
    setPresets(next);
    if (editing?.id === id) setEditing(null);
  };

  const handleResetBuiltin = (id: string) => {
    if (!window.confirm('将恢复该内置方案的默认名称与提示词，是否继续？')) return;
    setPresets(resetBuiltinPolishPreset(id));
    if (editing?.id === id) {
      const def = AI_POLISH_BUILTIN_DEFAULTS.find((p) => p.id === id);
      if (def) {
        setEditing({
          id: def.id,
          name: def.name,
          hint: def.hint,
          prompt: def.prompt,
          enabled: presets.find((p) => p.id === id)?.enabled ?? true,
        });
      }
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">AI 润色方案</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          配置工单回复区的润色选项。每条方案的「提示词」会注入 AI 润色请求，指导模型语气与风格。内置方案可修改提示词，也可
          <Link to="/mailbox" className="mx-0.5 font-medium text-[#F97316] hover:underline">
            在工单中
          </Link>
          点选使用。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" />
          新增方案
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {presets.map((p) => (
            <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{p.name}</span>
                  {p.builtin ? (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                      内置
                    </span>
                  ) : (
                    <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-600">
                      自定义
                    </span>
                  )}
                  {!p.enabled ? (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      已停用
                    </span>
                  ) : null}
                </div>
                {p.hint ? <p className="mt-0.5 text-xs text-slate-500">{p.hint}</p> : null}
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{p.prompt}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={() => toggleEnabled(p.id)}
                    className="rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]/30"
                  />
                  启用
                </label>
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  编辑
                </button>
                {p.builtin ? (
                  <button
                    type="button"
                    onClick={() => handleResetBuiltin(p.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    title="恢复默认提示词"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    恢复默认
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-100 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {editing ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            {editing.id ? '编辑润色方案' : '新增润色方案'}
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">方案名称</label>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="例如：促销关怀"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">简短说明（选填）</label>
              <input
                value={editing.hint}
                onChange={(e) => setEditing({ ...editing, hint: e.target.value })}
                placeholder="在工单润色菜单中展示的提示"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">提示词</label>
              <textarea
                value={editing.prompt}
                onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
                rows={6}
                placeholder="【语气】… 描述润色时须遵守的语气、风格与禁忌"
                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                建议以「【语气】」或「【风格】」开头，写清适用场景与表达要求；润色时将与工单上下文一并发送给模型。
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editing.enabled}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                className="rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]/30"
              />
              保存后立即启用
            </label>
            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setSaveError(null);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
