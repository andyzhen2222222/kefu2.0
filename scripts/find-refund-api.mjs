import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const paths = Object.keys(data.paths);
const refundPaths = paths.filter(p => p.toLowerCase().includes('refund'));

console.log('Refund related paths:');
refundPaths.forEach(p => {
    console.log(`- ${p}`);
    console.log('  Methods:', Object.keys(data.paths[p]).join(', '));
});

// Also search for tags or operationIds
console.log('\nSearching for "refund" in operationIds...');
for (const path of paths) {
    for (const method of Object.keys(data.paths[path])) {
        const op = data.paths[path][method];
        if (op.operationId?.toLowerCase().includes('refund') || op.summary?.toLowerCase().includes('refund') || op.description?.toLowerCase().includes('refund')) {
            console.log(`- ${method.toUpperCase()} ${path} (${op.operationId || op.summary})`);
        }
    }
}
