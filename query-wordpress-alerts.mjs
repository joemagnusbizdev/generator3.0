import https from 'https';

/**
 * Query the last N alerts sent to WordPress
 * Usage: node query-wordpress-alerts.mjs [limit]
 */

const limit = process.argv[2] || '3';

async function queryAlerts(limitNum = '3') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'gnobnyzezkuyptuakztf.supabase.co',
      path: `/rest/v1/alerts?wordpress_post_id=not.is.null&order=created_at.desc&limit=${limitNum}&select=id,title,location,country,severity,created_at,wordpress_post_id,event_start_date,source_url`,
      method: 'GET',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc1B1YmxpYyI6dHJ1ZX0.2Z3kn8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

try {
  const alerts = await queryAlerts(limit);
  
  if (!Array.isArray(alerts) || alerts.length === 0) {
    console.log('\n❌ No alerts have been sent to WordPress yet.\n');
    console.log('To post alerts to WordPress:');
    console.log('  1. Run a scour to generate alerts');
    console.log('  2. Go to the Alert Review Queue');
    console.log('  3. Approve alerts and click "Publish to WordPress"');
    console.log('  4. Run this script again to see posted alerts\n');
  } else {
    console.log(`\n📝 Last ${alerts.length} alert(s) sent to WordPress:\n`);
    alerts.forEach((alert, i) => {
      console.log(`${i + 1}. "${alert.title}"`);
      console.log(`   📍 ${alert.location}, ${alert.country}`);
      console.log(`   🔴 Severity: ${alert.severity.toUpperCase()}`);
      console.log(`   📅 Event: ${alert.event_start_date || 'N/A'}`);
      console.log(`   🔗 WordPress Post: https://generator30.wordpress.com/?p=${alert.wordpress_post_id}`);
      console.log(`   📰 Source: ${alert.source_url || 'N/A'}`);
      console.log('');
    });
  }
} catch (err) {
  console.error('❌ Error querying alerts:', err.message);
  process.exit(1);
}
