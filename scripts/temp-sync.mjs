async function sync() {
  const payload = {
    token: 'TESTYU60ltGTM9_1006755',
    days: 30,
    // 全量纠正买家映射时可改为 true；日常增量同步建议 false，避免前端 Ticket not found
    clearExisting: true
  };
  
  console.log('--- 开始同步 ---');
  console.log('目标: http://localhost:4000/api/sync/mother-system');
  console.log('配置:', JSON.stringify(payload, null, 2));

  try {
    const res = await fetch('http://localhost:4000/api/sync/mother-system', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': '11111111-1111-4111-8111-111111111111'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('同步失败:', JSON.stringify(data, null, 2));
      return;
    }

    console.log('--- 同步成功 ---');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('网络或系统错误:', err.message);
  }
}

sync();
