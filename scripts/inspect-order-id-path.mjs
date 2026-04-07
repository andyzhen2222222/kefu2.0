import fs from 'fs';

const data = JSON.parse(fs.readFileSync('openapi-evol.json', 'utf8'));
const path = "/v1/api/biz/order/{id}";
console.log(JSON.stringify(data.paths[path], null, 2));
