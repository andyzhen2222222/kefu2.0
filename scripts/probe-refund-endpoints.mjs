import fetch from 'node-fetch';

const MOTHER_SYSTEM_API_URL = 'https://tiaojia.nezhachuhai.com';
const token = 'TESTYU60ltGTM9_1006755';

async function checkEndpoint(path, method = 'GET') {
    const url = `${MOTHER_SYSTEM_API_URL}${path}`;
    console.log(`Checking ${method} ${url}...`);
    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`  Status: ${res.status} ${res.statusText}`);
        if (res.ok || res.status === 400 || res.status === 405) {
             const data = await res.json().catch(() => ({}));
             console.log(`  Response: ${JSON.stringify(data).substring(0, 200)}`);
        }
        return res.status;
    } catch (e) {
        console.log(`  Error: ${e.message}`);
        return null;
    }
}

async function main() {
    const patterns = [
        '/v1/api/ecommerce/platform-order/refund',
        '/v1/api/ecommerce/platform-order/apply-refund',
        '/v1/api/ecommerce/platform-order/cancel',
        '/v1/api/ecommerce/refund',
        '/v1/api/ecommerce/after-sales/refund',
        '/v1/api/biz/order/refund',
        '/v1/api/biz/order/apply-refund'
    ];

    for (const p of patterns) {
        await checkEndpoint(p, 'POST');
        await checkEndpoint(p, 'GET');
    }
}

main();
