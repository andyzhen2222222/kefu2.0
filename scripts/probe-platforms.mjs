import fetch from 'node-fetch';

const MOTHER_SYSTEM_API_URL = 'https://tiaojia.nezhachuhai.com';
const token = 'TESTYU60ltGTM9_1006755';

async function main() {
    const url = `${MOTHER_SYSTEM_API_URL}/v1/api/biz/platform/all`;
    console.log(`Checking ${url}...`);
    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await res.json();
        console.log(JSON.stringify(data.data, null, 2));
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

main();
