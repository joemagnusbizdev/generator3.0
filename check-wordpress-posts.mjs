import https from 'https';

/**
 * Query WordPress REST API for recent posts
 * This checks what's actually been published to WordPress
 */

async function queryWordPressPosts(limit = 3) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'blog.magnusafety.com',
      path: `/wp-json/wp/v2/posts?per_page=${limit}&orderby=date&order=desc&_fields=id,date,title,content,link`,
      method: 'GET',
      headers: {
        'User-Agent': 'Generator3.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
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
  console.log('\n📰 Querying WordPress for recent posts...\n');
  
  const result = await queryWordPressPosts(3);
  
  if (result.status === 200) {
    const posts = Array.isArray(result.data) ? result.data : [];
    
    if (posts.length === 0) {
      console.log('❌ No posts found on WordPress');
    } else {
      console.log(`✓ Found ${posts.length} recent posts on WordPress:\n`);
      posts.forEach((post, i) => {
        const date = new Date(post.date).toLocaleString();
        console.log(`${i + 1}. ${post.title.rendered}`);
        console.log(`   📅 ${date}`);
        console.log(`   🔗 ${post.link}`);
        console.log(`   📝 ${post.content.rendered.substring(0, 100).replace(/<[^>]*>/g, '')}...`);
        console.log('');
      });
    }
  } else {
    console.log(`❌ Error: HTTP ${result.status}`);
    console.log(`Response: ${JSON.stringify(result.data).substring(0, 300)}`);
  }
} catch (err) {
  console.error('❌ Error:', err.message);
  console.log('\nNote: WordPress site may not be accessible or may not allow public REST API access');
}
