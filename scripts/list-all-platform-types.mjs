import fetch from 'node-fetch';

const MOTHER_SYSTEM_API_URL = 'https://tiaojia.nezhachuhai.com';
const token = 'TESTYU60ltGTM9_1006755';

async function main() {
  let page = 1;
  const types = new Set();
  while (true) {
    const url = `${MOTHER_SYSTEM_API_URL}/v1/api/ecommerce/auth-platform-shop?page=${page}&limit=100`;
    try {
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await res.json();
      const list = json.data?.list || [];
      if (list.length === 0) break;
      list.forEach(s => types.add(s.platformApiType));
      if (list.length < 100) break;
      page++;
    } catch (e) { break; }
  }
  console.log('Unique platformApiTypes:', Array.from(types).sort());
}

main();
