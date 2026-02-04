#!/usr/bin/env node
const https = require('https');

async function queryAlerts() {
  const options = {
    hostname: 'gnobnyzezkuyptuakztf.supabase.co',
    path: '/rest/v1/alerts?wordpress_post_id=not.is.null&order=created_at.desc&limit=3&select=id,title,location,country,severity,created_at,wordpress_post_id,source_url',
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

queryAlerts().then(alerts => {
  console.log('Last 3 alerts sent to WordPress:\n');
  alerts.forEach((alert, i) => {
    console.log(`${i + 1}. ${alert.title}`);
    console.log(`   Location: ${alert.location}, ${alert.country}`);
    console.log(`   Severity: ${alert.severity}`);
    console.log(`   Created: ${alert.created_at}`);
    console.log(`   WordPress Post ID: ${alert.wordpress_post_id}`);
    console.log(`   Source: ${alert.source_url}`);
    console.log('');
  });
}).catch(err => {
  console.error('Error:', err.message);
});
