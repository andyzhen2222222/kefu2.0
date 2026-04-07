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
    const url = `${MOTHER_SYSTEM_API_URL}/v1/api/ecommerce/platform-order?originalOrderId=${orderId}`;
    console.log(`Searching for ${orderId} at ${url}`);
    
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }});
        const data = await res.json();
        console.log('Full Response Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

main();
