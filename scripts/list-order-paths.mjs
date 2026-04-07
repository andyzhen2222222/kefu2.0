import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const paths = Object.keys(data.paths);
const filtered = paths.filter(p => p.includes('order'));
console.log(JSON.stringify(filtered, null, 2));
