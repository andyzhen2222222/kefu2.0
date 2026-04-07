import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const paths = Object.keys(data.paths);

console.log('Paths with platform-order:');
paths.filter(p => p.toLowerCase().includes('platform-order')).forEach(p => {
    console.log(`- ${p}`);
});
