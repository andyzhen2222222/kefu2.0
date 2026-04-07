import fetch from 'node-fetch';

const MOTHER_SYSTEM_API_URL = 'https://tiaojia.nezhachuhai.com';
const token = 'TESTYU60ltGTM9_1006755';

async function main() {
  const url = `${MOTHER_SYSTEM_API_URL}/v1/api/ecommerce/auth-platform-shop?page=1&limit=1`;
  console.log(`Testing ${url}...`);
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    console.log(JSON.stringify(data.data.list[0], null, 2));
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

main();
