import https from 'https';

async function queryAlerts() {
  const options = {
    hostname: 'gnobnyzezkuyptuakztf.supabase.co',
    path: '/rest/v1/alerts?select=id,title,location,country,severity,created_at,wordpress_post_id,status&limit=5',
    method: 'GET',
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc1B1YmxpYyI6dHJ1ZX0.2Z3kn8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8',
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const alerts = JSON.parse(data);
          resolve(alerts);
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
  const result = await queryAlerts();
  const alerts = Array.isArray(result) ? result : (result.alerts || []);
  
  if (alerts.length === 0) {
    console.log('No alerts found in database yet');
    console.log('\nTo check for WordPress-posted alerts, you need to:');
    console.log('1. Create alerts through scour or manual entry');
    console.log('2. Approve them in the review queue');
    console.log('3. Publish them to WordPress');
  } else {
    console.log(`Found ${alerts.length} alerts\n`);
    console.log('Last alerts (checking WordPress Post ID):\n');
    const postedAlerts = alerts.filter(a => a.wordpress_post_id);
    
    if (postedAlerts.length === 0) {
      console.log('No alerts have been posted to WordPress yet\n');
      console.log('Sample of alerts in database:\n');
      alerts.forEach((alert, i) => {
        console.log(`${i + 1}. [${alert.status}] ${alert.title}`);
        console.log(`   ${alert.location}, ${alert.country}`);
        console.log(`   Created: ${alert.created_at}`);
        console.log('');
      });
    } else {
      console.log('Alerts posted to WordPress:\n');
      postedAlerts.forEach((alert, i) => {
        console.log(`${i + 1}. ${alert.title}`);
        console.log(`   Location: ${alert.location}, ${alert.country}`);
        console.log(`   Severity: ${alert.severity}`);
        console.log(`   Created: ${alert.created_at}`);
        console.log(`   WordPress Post ID: ${alert.wordpress_post_id}`);
        console.log('');
      });
    }
  }
} catch (err) {
  console.error('Error:', err.message);
}
