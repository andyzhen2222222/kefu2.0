import fs from 'fs';

function patchTicketDetail(path) {
  let s = fs.readFileSync(path, 'utf8');

  const transMarker =
    '{!isInternalNote && (\n                    <motion className="relative" ref={translationPopoverRef}>';
  const transMarker2 =
    '{!isInternalNote && (\n                    <div className="relative" ref={translationPopoverRef}>';
  const templateMarker = '                  <div className="relative" ref={templatePopoverRef}>';

  let idx = s.indexOf(transMarker2);
  if (idx === -1) idx = s.indexOf(transMarker);
  if (idx !== -1) {
    const end = s.indexOf(templateMarker, idx);
    if (end !== -1) {
      s = s.slice(0, idx) + s.slice(end);
      console.log(path, ': removed translation toolbar');
    }
  }

  const polishBlock = `<motion className="relative" ref={aiPolishPopoverRef}>`;
  const polishBlock2 = `<motion className="relative" ref={aiPolishPopoverRef}>`;
  let pIdx = s.indexOf('<div className="relative" ref={aiPolishPopoverRef}>');
  if (pIdx !== -1) {
    const after = s.slice(pIdx);
    const nextToolbarClose = after.indexOf('\n                </div>\n              </motion>');
    const nextToolbarClose2 = after.indexOf('\n                </div>\n              </motion>');
    let closeAt = after.indexOf('\n                </div>\n              </div>');
    if (closeAt === -1) closeAt = after.length;

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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-700 transition-colors shadow-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      title="AI 辅助：生成回复建议"
                    >
                      {isGeneratingDraft ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      )}
                      AI 辅助
                    </button>
                  )}`;

    const segment = after;
    let depth = 0;
    let endPos = 0;
    const openTag = '<div className="relative" ref={aiPolishPopoverRef}>';
    let pos = 0;
    const tagRe = /<\/?div\b[^>]*>/g;
    let m;
    const startPos = 0;
    tagRe.lastIndex = startPos;
    depth = 1;
    while ((m = tagRe.exec(segment)) !== null) {
      if (m[0].startsWith('</div')) depth--;
      else if (!m[0].endsWith('/>')) depth++;
      if (depth === 0) {
        endPos = m.index + m[0].length;
        break;
      }
    }
    if (endPos > 0) {
      s = s.slice(0, pIdx) + aiAssist + s.slice(pIdx + endPos);
      console.log(path, ': replaced AI polish with AI assist');
    }
  }

  const sendToOld = `                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSendToCustomer((v) => !v)}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                              sendToCustomer
                                ? 'border-blue-200 bg-blue-50 text-blue-900'
                                : 'border-dashed border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                                sendToCustomer
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-slate-300 bg-white'
                              )}
                              aria-hidden
                            >
                              {sendToCustomer && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                            </span>
                            客户
                          </button>
                          <button
                            type="button"
                            onClick={() => setSendToManager((v) => !v)}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                              sendToManager
                                ? 'border-amber-200 bg-amber-50 text-amber-950'
                                : 'border-dashed border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                                sendToManager
                                  ? 'border-amber-600 bg-amber-600 text-white'
                                  : 'border-slate-300 bg-white'
                              )}
                              aria-hidden
                            >
                              {sendToManager && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                            </span>
                            平台经理
                          </button>
                        </div>`;

  const sendToNew = `                        <div className="flex items-center gap-4">
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                            <ToggleSwitch
                              checked={sendToCustomer}
                              onChange={setSendToCustomer}
                              aria-label="发送至客户"
                            />
                            客户
                          </label>
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                            <ToggleSwitch
                              checked={sendToManager}
                              onChange={setSendToManager}
                              aria-label="发送至平台经理"
                            />
                            平台经理
                          </label>
                        </div>`;

  if (s.includes(sendToOld)) {
    s = s.replace(sendToOld, sendToNew);
    console.log(path, ': updated send-to toggles');
  }

  if (!s.includes("import ToggleSwitch from '@/src/components/ui/ToggleSwitch'")) {
    s = s.replace(
      "import { cn } from '@/src/lib/utils';",
      "import { cn } from '@/src/lib/utils';\nimport ToggleSwitch from '@/src/components/ui/ToggleSwitch';"
    );
    console.log(path, ': added ToggleSwitch import');
  }

  if (path.includes('H5TicketDetail') && s.includes("label: '发票'")) {
    s = s.replace(/label: '发票'/g, "label: '包裹'");
    s = s.replace(
      "'invoice': '发票'",
      "'invoice': '包裹'"
    );
    console.log(path, ': invoice tab -> 包裹');
  }

  const emptyTextOld =
    '点击按钮开始分析工单，AI 将自动识别客户意图、情绪并生成摘要。';
  const emptyTextNew =
    '点击下方按钮开始分析工单，AI 将为您提炼核心诉求、推荐回复策略。';
  if (s.includes(emptyTextOld)) {
    s = s.replace(emptyTextOld, emptyTextNew);
    console.log(path, ': updated AI empty text');
  }

  fs.writeFileSync(path, s);
}

patchTicketDetail('src/components/ticket/TicketDetail.tsx');
patchTicketDetail('src/h5/H5TicketDetail.tsx');

// H5: replace AI 回复 + AI 润色 with single AI 辅助
{
  const path = 'src/h5/H5TicketDetail.tsx';
  let s = fs.readFileSync(path, 'utf8');
  const start = s.indexOf('{!isInternalNote && (\n                    <div className="relative shrink-0">');
  const endMarker = '\n                </motion>\n              </>\n            )}';
  const endMarker2 = '\n                </div>\n              </>\n            )}';
  if (start !== -1) {
    let end = s.indexOf(endMarker2, start);
    if (end === -1) end = s.indexOf('\n                </div>\n              </>', start);
    const aiBlock = `{!isInternalNote && (
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

                  <div className="hidden" ref={aiPolishPopoverRef} />`;
    if (end !== -1) {
      const polishStart = s.indexOf('<div className="relative shrink-0" ref={aiPolishPopoverRef}>', start);
      if (polishStart !== -1 && polishStart < end) {
        s = s.slice(0, start) + aiBlock + s.slice(end);
        fs.writeFileSync(path, s);
        console.log(path, ': H5 AI toolbar simplified');
      }
    }
  }
}
