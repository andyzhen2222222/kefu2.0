import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'src/components/inbox/InboxList.tsx');
let s = fs.readFileSync(file, 'utf8');

const start = s.indexOf('            <motion className="shrink-0 border-b border-slate-200/80 bg-white px-3 py-2">');
const start2 = s.indexOf('            <div className="shrink-0 border-b border-slate-200/80 bg-white px-3 py-2">');
const startIdx = start !== -1 ? start : start2;
const end = s.indexOf('            <motion className="flex flex-1 flex-col min-h-0 overflow-hidden">', startIdx);
const end2 = s.indexOf('            <div className="flex flex-1 flex-col min-h-0 overflow-hidden">', startIdx);
const endIdx = end2 !== -1 ? end2 : end;

if (startIdx === -1 || endIdx === -1) {
  console.error('not found', { startIdx, endIdx });
  process.exit(1);
}

const replacement = `            <div className="shrink-0 border-b border-slate-200/80 bg-white px-3 py-2">
              {useInfiniteList ? (
                <div className="flex items-center gap-2">
                  <InboxFilterDropdown
                    ariaLabel="选择平台"
                    triggerText={platformTriggerLabel}
                    options={platformFilterOptions}
                    selectedId={selectedPlatform}
                    onSelect={(id) => {
                      setSelectedPlatform(id);
                      setSelectedShop(ALL_SHOPS);
                    }}
                    isOpen={openScopeFilter === 'platform'}
                    onOpenChange={(open) => setOpenScopeFilter(open ? 'platform' : null)}
                  />
                  <InboxFilterDropdown
                    ariaLabel="选择店铺"
                    triggerText={
                      sortedShopsForPlatform.length === 0 ? '暂无店铺' : shopTriggerLabel
                    }
                    options={shopFilterOptions}
                    selectedId={selectedShop}
                    onSelect={setSelectedShop}
                    isOpen={openScopeFilter === 'shop'}
                    onOpenChange={(open) => setOpenScopeFilter(open ? 'shop' : null)}
                    disabled={sortedShopsForPlatform.length === 0}
                  />
                  <button
                    type="button"
                    title={
                      onReloadList
                        ? listReloading
                          ? '正在加载…'
                          : '重新加载工单列表'
                        : '演示模式不支持刷新列表'
                    }
                    aria-label={onReloadList ? '重新加载工单列表' : '演示模式不支持刷新列表'}
                    disabled={listReloading || !onReloadList}
                    onClick={() => onReloadList?.()}
                    className={cn(
                      'shrink-0 rounded-lg border p-2 transition-colors',
                      listReloading
                        ? 'cursor-wait border-orange-200/60 bg-orange-50/50 text-[#F97316]'
                        : onReloadList
                          ? 'border-slate-200/90 text-slate-500 active:bg-slate-100 active:text-[#F97316]'
                          : 'cursor-not-allowed border-slate-100/90 text-slate-300'
                    )}
                  >
                    {listReloading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#F97316]" aria-hidden />
                    ) : (
                      <RefreshCw className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <label
                  htmlFor="inbox-list-platform"
                  className="shrink-0 text-[10px] font-medium text-slate-500"
                >
                  平台
                </label>
                <select
                  id="inbox-list-platform"
                  aria-label="收件箱：选择平台"
                  title="选择平台"
                  className="min-w-0 flex-1 rounded-md border border-slate-200/90 bg-slate-50/90 py-1 pl-1.5 pr-5 text-[11px] text-slate-700 outline-none focus:border-[#F97316] focus:ring-1 focus:ring-orange-200/80"
                  value={selectedPlatform}
                  onChange={(e) => {
                    setSelectedPlatform(e.target.value);
                    setSelectedShop(ALL_SHOPS);
                  }}
                >
                  <option value={ALL_PLATFORMS}>
                    全部平台（{displayTickets.length}）
                  </option>
                  {allPlatformKeys.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}（{platformTicketCounts[platform] ?? 0}）
                    </option>
                  ))}
                </select>

                <label
                  htmlFor="inbox-list-shop"
                  className="shrink-0 text-[10px] font-medium text-slate-500"
                >
                  店铺
                </label>
                {sortedShopsForPlatform.length === 0 ? (
                  <span className="min-w-0 flex-1 truncate rounded-md border border-dashed border-slate-200/90 bg-slate-50/50 py-1 pl-1.5 text-[11px] text-slate-400">
                    暂无店铺
                  </span>
                ) : (
                  <select
                    id="inbox-list-shop"
                    aria-label="收件箱：选择店铺"
                    title="选择店铺"
                    className="min-w-0 flex-1 rounded-md border border-slate-200/90 bg-slate-50/90 py-1 pl-1.5 pr-5 text-[11px] text-slate-700 outline-none focus:border-[#F97316] focus:ring-1 focus:ring-orange-200/80"
                    value={selectedShop}
                    onChange={(e) => setSelectedShop(e.target.value)}
                  >
                    <option value={ALL_SHOPS}>全部店铺（{allShopsScopeCount}）</option>
                    {sortedShopsForPlatform.map((shop) => (
                      <option key={shop} value={shop}>
                        {shop}（{shopTicketCounts[shop] ?? 0}）
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  title={
                    onReloadList
                      ? listReloading
                        ? '正在加载…'
                        : '重新加载工单列表'
                      : '演示模式不支持刷新列表'
                  }
                  aria-label={onReloadList ? '重新加载工单列表' : '演示模式不支持刷新列表'}
                  disabled={listReloading || !onReloadList}
                  onClick={() => onReloadList?.()}
                  className={cn(
                    'shrink-0 rounded-md border p-1.5 transition-colors',
                    listReloading
                      ? 'cursor-wait border-orange-200/60 bg-orange-50/50 text-[#F97316]'
                      : onReloadList
                        ? 'border-slate-200/90 text-slate-500 hover:bg-slate-100 hover:text-[#F97316]'
                        : 'cursor-not-allowed border-slate-100/90 text-slate-300'
                  )}
                >
                  {listReloading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F97316]" aria-hidden />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </div>
              )}
            </div>

`;

// Fix motion -> div in replacement
const fixed = replacement.replace(/<motion/g, '<motion').replace(/<\/motion>/g, '</motion>');
const fixed2 = fixed.replace(/<motion /g, '<div ').replace(/<\/motion>/g, '</div>');

s = s.slice(0, startIdx) + fixed2 + s.slice(endIdx);
fs.writeFileSync(file, s);
console.log('patched', { startIdx, endIdx });
