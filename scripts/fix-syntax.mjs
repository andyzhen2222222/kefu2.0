import fs from 'fs';

// H5: remove misplaced AI 辅助 in ai-insight section
{
  const p = 'src/h5/H5TicketDetail.tsx';
  let s = fs.readFileSync(p, 'utf8');
  const marker =
    '                </div>\n                  {!isInternalNote && (\n                    <button';
  const endMarker = '                  )}\n\n              ) : (';
  const i = s.indexOf(marker);
  if (i !== -1) {
    const end = s.indexOf(endMarker, i);
    if (end !== -1) {
      s = s.slice(0, i + '                </div>'.length) + s.slice(end);
      fs.writeFileSync(p, s);
      console.log('H5: removed misplaced block');
    }
  }

  s = fs.readFileSync(p, 'utf8');
  s = s.replace(
    'hover:bg-blue-700 shadow-sm transition-colors hover:bg-purple-100',
    'hover:bg-blue-700 shadow-sm transition-colors'
  );
  fs.writeFileSync(p, s);
}
