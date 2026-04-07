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
    return data;
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

async function main() {
  console.log('--- Checking Channels ---');
  const channels = await testEndpoint('/v1/api/ecommerce/auth-platform-shop', { page: 1, limit: 5 });
  console.log('Sample Channels:', JSON.stringify(channels.data?.list?.map(s => ({ id: s.id, name: s.name })), null, 2));

  console.log('\n--- Checking Conversations ---');
  const convs = await testEndpoint('/v1/api/ecommerce/platform-conversation', { page: 1, limit: 5 });
  console.log('Sample Conversations:', JSON.stringify(convs.data?.list?.map(c => ({ id: c.id, platformShopId: c.platformShopId, subject: c.subject })), null, 2));

  console.log('\n--- Checking Messages ---');
  const msgs = await testEndpoint('/v1/api/ecommerce/platform-conversation-message', { page: 1, limit: 5 });
  console.log('Sample Messages:', JSON.stringify(msgs.data?.list?.map(m => ({ id: m.id, conversationId: m.conversationId, content: m.content?.substring(0, 50) })), null, 2));
}

main();
