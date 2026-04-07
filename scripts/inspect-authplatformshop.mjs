import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const schemas = Object.keys(data.components.schemas);

schemas.filter(s => s.toLowerCase().includes('authplatformshop')).forEach(s => {
    console.log(`Schema: ${s}`);
    console.log(JSON.stringify(data.components.schemas[s], null, 2));
});
