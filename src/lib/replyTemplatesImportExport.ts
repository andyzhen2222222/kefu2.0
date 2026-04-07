/**
 * 回复模板批量导入：下载 CSV 模版，填写后导入（合并进 localStorage 话术库）。
 */

import { ROUTING_AFTER_SALES_TYPE_OPTIONS } from './routingRuleOptions';

export type ImportedReplyTemplateRow = {
  name: string;
  platforms: string[];
  categoryValues: string[]; // 改为数组
  content: string;
  status: 'active' | 'draft';
};

export type ParseReplyTemplatesImportResult =
  | { ok: true; rows: ImportedReplyTemplateRow[] }
  | { ok: false; error: string };

const REQUIRED_COLUMNS = ['模板名称', '售后类型', '模板内容'] as const;

function normalizeHeaderCell(s: string): string {
  // 移除 BOM 并去除首尾空格
  return s.replace(/^\uFEFF/, '').trim();
}

function normalizeStatus(v: string): 'active' | 'draft' {
  const x = v.trim().toLowerCase();
  if (x === 'active' || x === '已启用' || x === 'active') return 'active';
  return 'draft';
}

function resolveCategoryValue(labelOrValue: string): string {
  const t = labelOrValue.trim();
  const foundByLabel = ROUTING_AFTER_SALES_TYPE_OPTIONS.find((o) => o.label === t);
  if (foundByLabel) return foundByLabel.value;
  const foundByValue = ROUTING_AFTER_SALES_TYPE_OPTIONS.find((o) => o.value === t);
  if (foundByValue) return foundByValue.value;
  return t;
}

/** RFC 4180 风格：支持引号字段、换行、逗号 */
export function parseCsvToRows(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const flushLine = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = '';
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      flushLine();
    } else {
      field += c;
    }
  }

  if (inQuotes) {
    throw new Error('unclosed quote');
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
}

function buildHeaderIndex(headerCells: string[]): Record<string, number> | string {
  const h = headerCells.map((c) => normalizeHeaderCell(String(c)));
  const map: Record<string, number> = {};
  for (let i = 0; i < h.length; i++) {
    const key = h[i];
    if (!key) continue;
    if (map[key] !== undefined) return `表头重复列：${key}`;
    map[key] = i;
  }
  for (const col of REQUIRED_COLUMNS) {
    if (map[col] === undefined) return `表头缺少必填列：${col}`;
  }
  return map;
}

function parseDataRow(
  cells: string[],
  col: Record<string, number>,
  rowIndex: number
): ImportedReplyTemplateRow | string {
  const nameCol = col['模板名称'];
  const name = nameCol !== undefined ? String(cells[nameCol] ?? '').trim() : '';
  
  const contentCol = col['模板内容'];
  const content = contentCol !== undefined ? String(cells[contentCol] ?? '').trim() : '';
  
  const categoryCol = col['售后类型'];
  const categoryRaw = categoryCol !== undefined ? String(cells[categoryCol] ?? '').trim() : '';
  const categoryValues = categoryRaw 
    ? categoryRaw.split(/[,，]/).map(v => resolveCategoryValue(v.trim())).filter(Boolean)
    : [];

  if (!name) return `第 ${rowIndex + 1} 行：「模板名称」不能为空`;
  if (categoryValues.length === 0) return `第 ${rowIndex + 1} 行：「售后类型」不能为空`;
  if (!content) return `第 ${rowIndex + 1} 行：「模板内容」不能为空`;

  const platformCol = col['适用平台'];
  const platformRaw =
    platformCol !== undefined ? String(cells[platformCol] ?? '').trim() || 'All' : 'All';
  // 导入时将 CSV 中的逗号分隔或单一字符串转为数组
  const platforms = platformRaw.split(/[,，]/).map(p => p.trim()).filter(Boolean);

  const statusCol = col['状态'];
  const statusRaw = statusCol !== undefined ? String(cells[statusCol] ?? '') : '';
  const status = statusRaw.trim() ? normalizeStatus(statusRaw) : 'draft';

  return { name, platforms, categoryValues, content, status };
}

export function parseReplyTemplatesImportCsv(text: string): ParseReplyTemplatesImportResult {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return { ok: false, error: '文件为空' };

  let grid: string[][];
  try {
    grid = parseCsvToRows(trimmed);
  } catch {
    return { ok: false, error: 'CSV 解析失败（例如未闭合的引号），请使用下载的模版格式' };
  }

  if (grid.length < 2) {
    return { ok: false, error: '至少需要表头行与一行数据' };
  }

  const headerResult = buildHeaderIndex(grid[0]);
  if (typeof headerResult === 'string') return { ok: false, error: headerResult };
  const col = headerResult;

  const rows: ImportedReplyTemplateRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    if (cells.every((c) => String(c).trim() === '')) continue;
    const parsed = parseDataRow(cells, col, r + 1);
    if (typeof parsed === 'string') return { ok: false, error: parsed };
    rows.push(parsed);
  }

  if (rows.length === 0) return { ok: false, error: '没有可导入的数据行' };
  return { ok: true, rows };
}

function escapeCsvCell(raw: string): string {
  const s = String(raw);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildReplyTemplatesImportTemplateCsv(): string {
  const header = '模板名称,适用平台,售后类型,状态,模板内容';
  const sampleName = '示例：物流进度说明';
  const samplePlatforms = 'Amazon, eBay'; // 示例多选
  const sampleCats = '物流问题, 售后退款'; // 示例多选
  const sampleStatus = '草稿';
  const sampleContent =
    '{买家姓名} 您好，订单 {订单号} 物流 {物流单号} 已在途中。{店铺名称} 客服';
  const line = [
    escapeCsvCell(sampleName),
    escapeCsvCell(samplePlatforms),
    escapeCsvCell(sampleCats),
    escapeCsvCell(sampleStatus),
    escapeCsvCell(sampleContent),
  ].join(',');
  return `${header}\r\n${line}\r\n`;
}

export function triggerReplyTemplatesImportTemplateDownload(): void {
  const body = `\uFEFF${buildReplyTemplatesImportTemplateCsv()}`;
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'intellidesk-reply-templates-import.csv';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
