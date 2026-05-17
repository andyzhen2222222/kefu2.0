import fs from 'fs';
const s = fs.readFileSync('src/h5/H5TicketDetail.tsx', 'utf8');
const d = 'div';
const ts = `{!isInternalNote && (\n                    <${d} className="relative" ref={translationPopoverRef}>`;
console.log('idx', s.indexOf(ts));
console.log('snippet', JSON.stringify(s.slice(s.indexOf('自动翻译') - 80, s.indexOf('自动翻译') + 20)));
