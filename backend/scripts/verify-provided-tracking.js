import fetch from 'node-fetch';
import { getTrack17List, registerTrack17 } from '../src/services/track17Adapter.js';
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

const mappings = [
    { orderId: '82443972-A', tracking: '4PX3002628128019CN' },
    { orderId: '49642214-A', tracking: '4PX3002591138329CN' },
    { orderId: '2603221641QKXNG', tracking: '4PX3002591776439CN' }
];

async function check17Track() {
    console.log('--- Checking 17Track for provided tracking numbers ---');
    const numbers = mappings.map(m => m.tracking);
    try {
        const results = await getTrack17List(numbers);
        console.log('17Track Results:', JSON.stringify(results, null, 2));
        
        if (results.length === 0) {
            console.log('No results from 17track, attempting registration...');
            const regOk = await registerTrack17(numbers.map(n => ({ number: n })));
            console.log('Registration success:', regOk);
        }
    } catch (e) {
        console.error('17Track Error:', e.message);
    }
}

async function searchMotherOrders() {
    console.log('\n--- Searching Mother System for specific orders ---');
    for (const m of mappings) {
        // Try multiple query param names just in case
        const queries = [
            `originalOrderId=${m.orderId}`,
            `platformOrderId=${m.orderId}`,
            `orderId=${m.orderId}`,
            `keyword=${m.orderId}`
        ];
        
        for (const q of queries) {
            const url = `${MOTHER_SYSTEM_API_URL}/v1/api/ecommerce/platform-order?${q}`;
            try {
                const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }});
                const data = await res.json();
                const list = data.data?.list || [];
                const found = list.find(o => 
                    String(o.originalOrderId).toLowerCase() === m.orderId.toLowerCase() || 
                    String(o.platformOrderId).toLowerCase() === m.orderId.toLowerCase() ||
                    String(o.id) === m.orderId
                );
                
                if (found) {
                    console.log(`FOUND ${m.orderId} using ${q}`);
                    console.log(`  Internal ID: ${found.id}`);
                    console.log(`  Status: ${found.state}`);
                    console.log(`  Tracking in API: ${JSON.stringify(found.items?.map(it => it.shippingTracking))}`);
                    break; 
                }
            } catch (e) {
                console.error(`Error searching ${url}:`, e.message);
            }
        }
    }
}

async function main() {
    await searchMotherOrders();
    await check17Track();
}

main();
