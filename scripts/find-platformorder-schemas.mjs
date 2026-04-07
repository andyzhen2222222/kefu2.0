import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const schemas = Object.keys(data.components.schemas);

console.log('Schemas related to platform-order:');
schemas.filter(s => s.toLowerCase().includes('platformorder')).forEach(s => {
    console.log(`- ${s}`);
    const schema = data.components.schemas[s];
    if (schema.properties) {
        console.log('  Properties:', Object.keys(schema.properties).join(', '));
    }
});
