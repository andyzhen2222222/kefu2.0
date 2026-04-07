import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const schemas = Object.keys(data.components.schemas);

console.log('Searching for "refund" or "capabilities" in shop/site schemas:');
schemas.filter(s => s.toLowerCase().includes('shop') || s.toLowerCase().includes('site')).forEach(s => {
    const schema = data.components.schemas[s];
    const text = JSON.stringify(schema).toLowerCase();
    if (text.includes('refund') || text.includes('capability') || text.includes('feature')) {
        console.log(`- ${s}`);
    }
});
