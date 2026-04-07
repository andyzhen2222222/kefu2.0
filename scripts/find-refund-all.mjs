import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const paths = Object.keys(data.paths);

for (const path of paths) {
    const methods = data.paths[path];
    for (const method of Object.keys(methods)) {
        const op = methods[method];
        const text = JSON.stringify(op).toLowerCase();
        if (text.includes('refund')) {
             console.log(`${method.toUpperCase()} ${path}: ${op.summary || op.operationId}`);
        }
    }
}
