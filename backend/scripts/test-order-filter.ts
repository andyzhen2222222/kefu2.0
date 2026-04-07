import fetch from 'node-fetch';

const MOTHER_SYSTEM_API_URL = 'https://tiaojia.nezhachuhai.com';
const token = 'TESTYU60ltGTM9_1006755';

async function testParam(paramName: string) {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const timeStr = oneHourAgo.toISOString();
    
    const url = `${MOTHER_SYSTEM_API_URL}/v1/api/ecommerce/platform-order?page=1&limit=1&${paramName}=${timeStr}`;
    console.log(`Testing ${paramName}...`);
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }});
        const data = await res.json();
        console.log(`  ${paramName} Total: ${data.data?.totalSize}`);
    } catch (e) {
        console.log(`  ${paramName} Error: ${e.message}`);
    }
}

async function main() {
    await testParam('startTime');
    await testParam('startAt');
    await testParam('start_at');
    await testParam('createAtStart');
    await testParam('createdAtStart');
    await testParam('startDate');
}

main();
