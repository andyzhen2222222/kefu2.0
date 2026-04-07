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
    
    const tryParams = [
        `originalOrderId=${orderId}`,
        `platformOrderId=${orderId}`,
        `id=${orderId}`,
        `trackingNumber=${orderId}`
    ];

    for (const p of tryParams) {
        const url = `${MOTHER_SYSTEM_API_URL}/v1/api/ecommerce/platform-order?${p}`;
        console.log(`Checking URL: ${url}`);
        
        try {
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }});
            const data = await res.json();
            const list = data.data?.list || [];
            
            // Check list.length to be safe - the API might return 28k items if not found
            if (list.length > 0 && list.length < 28000) {
                // Actually check if ANY order in the list matches our orderId
                const foundOrder = list.find(o => 
                    o.originalOrderId === orderId || 
                    String(o.platformOrderId) === orderId || 
                    String(o.id) === orderId ||
                    (o.items && o.items.some(it => 
                        String(it.shippingTracking) === orderId || 
                        String(it.originalOrderId) === orderId
                    ))
                );

                if (foundOrder) {
                    console.log(`\n!!! MATCH FOUND !!! using parameter: ${p}`);
                    console.log('Order Details:');
                    console.log(JSON.stringify(foundOrder, null, 2));
                    return;
                }
            }
        } catch (e) {
            console.error('Error:', e.message);
        }
    }
    console.log(`\nResult: No exact match found for ID "${orderId}" in any checked parameter.`);
}

main();
