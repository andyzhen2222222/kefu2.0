import fs from 'fs';

const content = fs.readFileSync('openapi-evol.json', 'utf8');
const regex = /refund/gi;
let match;
while ((match = regex.exec(content)) !== null) {
    const start = Math.max(0, match.index - 50);
    const end = Math.min(content.length, match.index + 50);
    console.log(`...${content.substring(start, end)}...`);
}
