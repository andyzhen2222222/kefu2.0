import fs from 'fs';

const path = 'src/h5/H5TicketDetail.tsx';
let s = fs.readFileSync(path, 'utf8');

function removeDivBlock(source, openTag) {
  const idx = source.indexOf(openTag);
  if (idx === -1) return { source, removed: false };
  const segment = source.slice(idx);
  const re = /<\/?div\b[^>]*>/g;
  let depth = 0;
  let endPos = 0;
  const first = segment.match(/^<div[^>]*>/);
  if (!first) return { source, removed: false };
  depth = 1;
  re.lastIndex = first[0].length;
  let m;
  while ((m = re.exec(segment)) !== null) {
    if (m[0].startsWith('</div')) depth--;
    else if (!m[0].endsWith('/>')) depth++;
    if (depth === 0) {
      endPos = m.index + m[0].length;
      break;
    }
  }
  if (endPos <= 0) return { source, removed: false };
  return { source: source.slice(0, idx) + source.slice(idx + endPos), removed: true };
}

// Remove AI 回复 wrapper, replace with AI 辅助 inline after template
const aiReplyStart = '{!isInternalNote && (\n                    <div className="relative shrink-0">';
const aiReplyIdx = s.indexOf(aiReplyStart);
if (aiReplyIdx !== -1) {
  const afterReply = s.indexOf('</div>\n                  )}', aiReplyIdx);
  if (afterReply !== -1) {
    const end = afterReply + '</div>\n                  )}'.length;
    s = s.slice(0, aiReplyIdx) + s.slice(end);
    console.log('removed AI 回复 block');
  }
}

const polishOpen = '<div className="relative shrink-0" ref={aiPolishPopoverRef}>';
const r = removeDivBlock(s, polishOpen);
if (r.removed) {
  s = r.source;
  console.log('removed AI 润色 block');
}

const insertAfterTemplate = '                  </div>\n                </div>';
const aiAssist = `                  {!isInternalNote && (
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
                  )}
`;

const toolbarEnd = s.indexOf(insertAfterTemplate);
if (toolbarEnd !== -1 && !s.includes('AI 辅助')) {
  const pos = toolbarEnd + insertAfterTemplate.length;
  s = s.slice(0, pos) + '\n' + aiAssist + s.slice(pos);
  console.log('inserted AI 辅助');
}

const sendToOld = `                        <div className="flex w-full min-w-0 gap-2">
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
                        </div>`;

const sendToNew = `                        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                          <label className="inline-flex min-h-11 flex-1 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 text-sm font-medium text-slate-700">
                            <span>客户</span>
                            <ToggleSwitch checked={sendToCustomer} onChange={setSendToCustomer} aria-label="发送至客户" />
                          </label>
                          <label className="inline-flex min-h-11 flex-1 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 text-sm font-medium text-slate-700">
                            <span>平台经理</span>
                            <ToggleSwitch checked={sendToManager} onChange={setSendToManager} aria-label="发送至平台经理" />
                          </label>
                        </div>`;

if (s.includes(sendToOld)) {
  s = s.replace(sendToOld, sendToNew);
  console.log('H5 send-to toggles');
}

s = s.replace(
  '!isInternalNote ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-800"',
  '!isInternalNote ? "bg-white text-[#F97316] shadow-sm" : "text-slate-600 hover:text-slate-800"'
);

s = s.replaceAll(
  'border border-purple-200 bg-purple-50 px-3 py-2.5 text-sm font-bold text-purple-800',
  'bg-blue-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-blue-700'
);

fs.writeFileSync(path, s);
console.log('done');
