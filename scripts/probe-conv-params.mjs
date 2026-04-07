import fetch from 'node-fetch';

const MOTHER_SYSTEM_API_URL = 'https://tiaojia.nezhachuhai.com';
const token = 'TESTYU60ltGTM9_1006755';

async function testEndpoint(path, params = {}) {
  const url = new URL(`${MOTHER_SYSTEM_API_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  
  console.log(`Testing ${url.toString()}...`);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    console.log(`Status: ${res.status}, Code: ${data.code}, Msg: ${data.msg}`);
    if (data.data?.list) {
        console.log(`List length: ${data.data.list.length}`);
    }
    return data;
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

async function main() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const startAt = startDate.toISOString();

  console.log('--- Testing Conversations ---');
  await testEndpoint('/v1/api/ecommerce/platform-conversation', { page: 1, limit: 10, startAt });
  await testEndpoint('/v1/api/ecommerce/platform-conversation', { page: 1, limit: 10, startTime: startAt });

  console.log('\n--- Testing Messages ---');
  await testEndpoint('/v1/api/ecommerce/platform-conversation-message', { page: 1, limit: 10, startAt });
  await testEndpoint('/v1/api/ecommerce/platform-conversation-message', { page: 1, limit: 10, startTime: startAt });
}

main();
