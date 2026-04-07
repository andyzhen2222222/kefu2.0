import fetch from 'node-fetch';

const MOTHER_SYSTEM_API_URL = 'https://tiaojia.nezhachuhai.com';
const token = 'TESTYU60ltGTM9_1006755';

async function testEndpoint(path, params = {}) {
  const url = new URL(`${MOTHER_SYSTEM_API_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  
  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return res.json();
}

async function main() {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const futureAt = futureDate.toISOString();

  console.log('--- Testing Conversations with future startTime ---');
  const res = await testEndpoint('/v1/api/ecommerce/platform-conversation', { page: 1, limit: 10, startTime: futureAt });
  console.log(`Code: ${res.code}, List length: ${res.data?.list?.length || 0}, Total: ${res.data?.totalSize}`);
}

main();
