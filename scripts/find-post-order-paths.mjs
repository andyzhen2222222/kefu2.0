import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const paths = Object.keys(data.paths);

console.log('POST paths:');
paths.filter(p => data.paths[p].post).forEach(p => {
    const op = data.paths[p].post;
    const summary = op.summary || op.operationId || '';
    if (p.toLowerCase().includes('refund') || summary.toLowerCase().includes('refund') || p.toLowerCase().includes('order') || summary.toLowerCase().includes('order')) {
        console.log(`- POST ${p} (${summary})`);
    }
});
