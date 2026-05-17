import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/h5/H5TicketDetail.tsx');
let s = fs.readFileSync(file, 'utf8');

const replyStart = s.indexOf('        {/* Reply Area */}');
const replyEnd = s.indexOf('        </>\n        ) : null}', replyStart);
if (replyStart === -1 || replyEnd === -1) {
  console.error('markers not found', { replyStart, replyEnd });
  process.exit(1);
}

const composerBlock = `        <H5ComposerBar
          isInternalNote={isInternalNote}
          onInternalNoteChange={setIsInternalNote}
          replyText={replyText}
          onReplyTextChange={setReplyText}
          onSend={handleSend}
          sendDisabled={!replyText.trim() || !outboundRecipientReady}
          sendLabel={isInternalNote ? '保存备注' : '发送'}
          sendToCustomer={sendToCustomer}
          sendToManager={sendToManager}
          onSendToCustomerChange={setSendToCustomer}
          onSendToManagerChange={setSendToManager}
          showRecipientRow={!isInternalNote}
          onOpenTemplate={() => {
            setShowEmojiPicker(false);
            setShowTranslationPopover(false);
            setShowAiPolishPopover(false);
            setShowTemplatePopover(true);
          }}
          onAiAssist={() => void handleAiSuggest()}
          aiAssistLoading={isGeneratingDraft}
          onOpenTranslation={() => setShowTranslationPopover(true)}
          showComposerSheet={showComposerSheet}
          onComposerSheetChange={setShowComposerSheet}
          showEmojiPicker={showEmojiPicker}
          onEmojiPickerChange={setShowEmojiPicker}
          emojiPopoverRef={emojiPopoverRef}
        />

        {showTemplatePopover ? (
          <motion className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40" onClick={() => setShowTemplatePopover(false)}>
            <motion
              className="max-h-[min(70vh,28rem)] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              ref={templatePopoverRef}
            >
              <div className="border-b border-slate-100 bg-slate-50/50 p-3">
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="搜索模板名称、内容..."
                    value={templateSearchQuery}
                    onChange={(e) => setTemplateSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20"
                  />
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div className="max-h-[min(50vh,20rem)] space-y-1 overflow-y-auto p-2">
                {pickerTemplatesForTicket
                  .filter(
                    (tpl) =>
                      String(tpl.title ?? '')
                        .toLowerCase()
                        .includes(templateSearchQuery.toLowerCase()) ||
                      String(tpl.content ?? '')
                        .toLowerCase()
                        .includes(templateSearchQuery.toLowerCase())
                  )
                  .map((tpl) => {
                    const intent = (ticket.intent ?? '').trim();
                    const cats = tpl.categoryValues?.length
                      ? tpl.categoryValues
                      : tpl.categoryValue
                        ? [tpl.categoryValue]
                        : [];
                    const isRecommended =
                      !!intent &&
                      cats.some((c) =>
                        ticketIntentMatchesAfterSalesCategoryValue(intent, String(c).trim())
                      );
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          setReplyText(replaceTemplatePlaceholders(tpl.content));
                          setIsAiGenerated(false);
                          setShowTemplatePopover(false);
                          setTemplateSearchQuery('');
                        }}
                        className={cn(
                          'w-full rounded-lg p-2.5 text-left transition-colors',
                          isRecommended
                            ? 'border border-orange-100/50 bg-orange-50/50'
                            : 'hover:bg-slate-50'
                        )}
                      >
                        <span className="text-xs font-bold text-slate-900">{tpl.title}</span>
                        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{tpl.content}</p>
                      </button>
                    );
                  })}
              </div>
              <div className="flex justify-center border-t border-slate-100 bg-slate-50/50 p-2.5">
                <Link
                  to="/settings/templates"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
                >
                  管理模板库
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </motion>
          </motion>
        ) : null}
`;

// Fix motion -> div in composer block
const composerFixed = composerBlock.replace(/<motion/g, '<div').replace(/<\/motion>/g, '</motion>').replace(/<\/motion>/g, '</div>');

s = s.slice(0, replyStart) + composerFixed + s.slice(replyEnd);

// Restructure chat vs business: ) : null} after messages -> ) : ( business )}
s = s.replace(
  `        </>
        ) : null}
      </div>
      
      {/* Right Sidebar - Business Intelligence */}
      {activeTab !== 'chat' && (
        <div className="flex flex-col overflow-hidden bg-slate-50 absolute inset-x-0 bottom-0 top-0 z-10 pt-[100px]">
          {renderBusinessSidebarContent()}
        </div>
      )}`,
  `        </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
            {renderBusinessSidebarContent()}
          </div>
        )}
      </div>`
);

fs.writeFileSync(file, s);
console.log('patched H5TicketDetail composer');
