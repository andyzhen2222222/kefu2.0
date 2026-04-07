import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const paths = Object.keys(data.paths);

function search(term) {
    console.log(`\nSearching for "${term}"...`);
    for (const path of paths) {
        for (const method of Object.keys(data.paths[path])) {
            const op = data.paths[path][method];
            const text = JSON.stringify(op).toLowerCase();
            if (text.includes(term.toLowerCase())) {
                console.log(`- ${method.toUpperCase()} ${path} (${op.summary || op.operationId || 'no summary'})`);
            }
        }
    }
}

search('refund');
search('return');
search('cancel');
search('after-sales');
search('aftersales');
search('sales');
