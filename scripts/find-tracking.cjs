const fs = require('fs');
const data = fs.readFileSync('openapi-evol.json', 'utf8');
const obj = JSON.parse(data);
const paths = Object.keys(obj.paths);
for(const p of paths) {
    if(p.toLowerCase().includes('track') || p.toLowerCase().includes('logistic') || p.toLowerCase().includes('ship')) {
        console.log(p);
    }
}

function searchValues(o, prefix) {
    if(!o) return;
    if(typeof o === 'object') {
        for(const k of Object.keys(o)) {
            if(k.toLowerCase().includes('tracking') || k.toLowerCase().includes('logistic')) {
                console.log(prefix + '.' + k);
            }
            searchValues(o[k], prefix + '.' + k);
        }
    }
}
// searchValues(obj.components.schemas, 'schemas');
