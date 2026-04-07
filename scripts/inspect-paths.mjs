import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const paths = Object.keys(data.paths);

function inspectPath(path) {
    console.log(`\nInspecting path: ${path}`);
    if (data.paths[path]) {
        console.log(JSON.stringify(data.paths[path], null, 2));
    } else {
        console.log('Path not found.');
    }
}

inspectPath('/v1/api/ecommerce/platform-order');
inspectPath('/v1/api/biz/order');
