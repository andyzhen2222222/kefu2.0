import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const schemas = data.components.schemas;

for (const [name, schema] of Object.entries(schemas)) {
    if (schema.properties && schema.properties.allowRefund) {
        console.log(`Schema found: ${name}`);
        console.log(JSON.stringify(schema, null, 2));
    }
}
