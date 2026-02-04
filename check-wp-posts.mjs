import https from 'https';

/**
 * Query the last N alerts with wordpress_post_id set
 * This script queries directly from the alerts table
 */

const limit = process.argv[2] || '3';

// Try with different potential API keys
const apiKeys = [
  'sb_publishable_1iNgvQzTvtYKqWCdE3oIKg_rjsRMwGG', // real anon key
];

async function queryAlerts(apiKey, limitNum) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'gnobnyzezkuyptuakztf.supabase.co',
      path: `/rest/v1/alerts?wordpress_post_id=not.is.null&order=created_at.desc&limit=${limitNum}&select=id,title,location,country,severity,created_at,wordpress_post_id`,
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, error: true });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function checkAllAlerts(apiKey, limitNum) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'gnobnyzezkuyptuakztf.supabase.co',
      path: `/rest/v1/alerts?order=created_at.desc&limit=${limitNum}&select=id,title,status,created_at,wordpress_post_id`,
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, error: true });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

try {
  console.log('\n🔍 Checking for WordPress-posted alerts...\n');
  
  const result = await queryAlerts(apiKeys[0], limit);
  
  if (result.status !== 200) {
    console.log(`API Status: ${result.status}`);
    console.log(`Response: ${JSON.stringify(result.data).substring(0, 200)}\n`);
    
    console.log('Trying alternative API key...\n');
    const result2 = await queryAlerts(apiKeys[1], limit);
    console.log(`API Status: ${result2.status}`);
    if (result2.status === 200) {
      const alerts = Array.isArray(result2.data) ? result2.data : [];
      if (alerts.length > 0) {
        console.log(`Found ${alerts.length} alerts:\n`);
        alerts.forEach((a, i) => console.log(`${i+1}. ${a.title} (WP ID: ${a.wordpress_post_id})`));
      } else {
        console.log('No alerts with wordpress_post_id found');
      }
    }
  } else {
    const alerts = Array.isArray(result.data) ? result.data : [];
    if (alerts.length === 0) {
      console.log('❌ No alerts with wordpress_post_id found in first query');
      console.log('\nChecking all recent alerts to verify what is in database...\n');
      
      const allResult = await checkAllAlerts(apiKeys[0], 5);
      if (allResult.status === 200) {
        const allAlerts = Array.isArray(allResult.data) ? allResult.data : [];
        console.log(`✓ Found ${allAlerts.length} total alerts\n`);
        allAlerts.forEach((a, i) => {
          const wpStatus = a.wordpress_post_id ? `✓ (WP: ${a.wordpress_post_id})` : '✗ (not posted)';
          console.log(`${i+1}. [${a.status}] ${a.title} ${wpStatus}`);
        });
      }
    } else {
      console.log(`✓ Found ${alerts.length} WordPress-posted alerts:\n`);
      alerts.forEach((alert, i) => {
        console.log(`${i + 1}. "${alert.title}"`);
        console.log(`   📍 ${alert.location}, ${alert.country}`);
        console.log(`   🔴 Severity: ${alert.severity}`);
        console.log(`   WordPress Post ID: ${alert.wordpress_post_id}`);
        console.log('');
      });
    }
  }
} catch (err) {
  console.error('❌ Error:', err.message);
}
