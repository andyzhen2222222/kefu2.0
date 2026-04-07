import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const paths = Object.keys(data.paths);
paths.sort();

console.log('Total paths:', paths.length);
console.log('Sample paths:');
paths.slice(0, 50).forEach(p => console.log(p));
