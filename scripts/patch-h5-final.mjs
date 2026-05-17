import fs from 'fs';

const path = 'src/h5/H5TicketDetail.tsx';
let s = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const d = 'div';

const transStart = `{!isInternalNote && (\n                    <${d} className="relative" ref={translationPopoverRef}>`;
const templateMarker = `                  <${d} className="relative" ref={templatePopoverRef}>`;
const trIdx = s.indexOf(transStart);
const tIdx = s.indexOf(templateMarker);
if (trIdx !== -1 && tIdx !== -1 && trIdx < tIdx) {
  s = s.slice(0, trIdx) + s.slice(tIdx);
  console.log('removed translation toolbar');
}

const sendToOld = `                        <${d} className="flex w-full min-w-0 gap-2">
                          <button
                            type="button"
                            onClick={() => setSendToCustomer((v) => !v)}
                            className={cn(
                              'inline-flex min-h-11 flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-medium transition-all active:scale-[0.99]',
                              sendToCustomer
                                ? 'border-blue-200 bg-blue-50 text-blue-900'
                                : 'border-dashed border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                            )}
                          >
                            <User className="h-4 w-4 shrink-0" />
                            客户
                          </button>
                          <button
                            type="button"
                            onClick={() => setSendToManager((v) => !v)}
                            className={cn(
                              'inline-flex min-h-11 flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-medium transition-all active:scale-[0.99]',
                              sendToManager
                                ? 'border-amber-200 bg-amber-50 text-amber-900'
                                : 'border-dashed border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                            )}
                          >
                            <ShieldCheck className="h-4 w-4 shrink-0" />
                            <span className="hidden sm:inline">平台</span>经理
                          </button>
                        </${d}>`;

const sendToNew = `                        <${d} className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                          <label className="inline-flex min-h-11 flex-1 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 text-sm font-medium text-slate-700">
                            <span>客户</span>
                            <ToggleSwitch checked={sendToCustomer} onChange={setSendToCustomer} aria-label="发送至客户" />
                          </label>
                          <label className="inline-flex min-h-11 flex-1 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 text-sm font-medium text-slate-700">
                            <span>平台经理</span>
                            <ToggleSwitch checked={sendToManager} onChange={setSendToManager} aria-label="发送至平台经理" />
                          </label>
                        </${d}>`;

if (s.includes(sendToOld)) {
  s = s.replace(sendToOld, sendToNew);
  console.log('send-to toggles');
}

const aiWrapStart = `{!isInternalNote && (\n                    <${d} className="relative shrink-0">`;
const aiWrapIdx = s.indexOf(aiWrapStart);
if (aiWrapIdx !== -1) {
  const btnEnd = s.indexOf('AI 辅助', aiWrapIdx);
  const closeDiv = s.indexOf(`</${d}>`, btnEnd);
  const closeCond = s.indexOf(')}', closeDiv);
  if (btnEnd !== -1 && closeCond !== -1) {
    const replacement = `{!isInternalNote && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowTemplatePopover(false);
                        setShowEmojiPicker(false);
                        setShowAiPolishPopover(false);
                        setShowTranslationPopover(false);
                        void handleAiSuggest();
                      }}
                      disabled={isGeneratingDraft}
                      className="inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                      title="AI 辅助：生成回复建议"
                    >
                      {isGeneratingDraft ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 shrink-0 text-blue-600" />
                      )}
                      AI 辅助
                    </button>
                  )}`;
    s = s.slice(0, aiWrapIdx) + replacement + s.slice(closeCond + 2);
    console.log('flattened AI assist button');
  }
}

if (s.includes('AI 回复\n                      </button>')) {
  s = s.replace('AI 回复\n                      </button>', 'AI 辅助\n                      </button>');
  console.log('renamed toolbar AI label');
}

fs.writeFileSync(path, s);
console.log('done');
