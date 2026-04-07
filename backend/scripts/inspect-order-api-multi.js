import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env from backend/.env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const MOTHER_SYSTEM_API_URL = 'https://tiaojia.nezhachuhai.com';
const token = 'TESTYU60ltGTM9_1006755';

async function main() {
    const orderId = process.argv[2] || '2603221641QKXNG';
    const params = [
        `originalOrderId=${orderId}`,
        `platformOrderId=${orderId}`,
        `id=${orderId}`
    ];

    for (const p of params) {
        const url = `${MOTHER_SYSTEM_API_URL}/v1/api/ecommerce/platform-order?${p}`;
        console.log(`Searching for ${orderId} using ${p}...`);
        
        try {
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }});
            const data = await res.json();
            const list = data.data?.list || [];
            if (list.length > 0) {
                console.log(`FOUND ${orderId} with ${p}`);
                console.log(JSON.stringify(list, null, 2));
                return;
            }
        } catch (e) {
            console.error('Error:', e.message);
        }
    }
    console.log(`NOT FOUND: ${orderId}`);
}

main();
