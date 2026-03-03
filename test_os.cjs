const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const options = {
  hostname: 'api.opensea.io',
  path: '/api/v2/offers/collection/merge-by-pxtrickc',
  headers: {
    'x-api-key': process.env.ETHERSCAN_API_KEY, // Wait, NUXT_OPENSEA_API_KEY
    'Accept': 'application/json'
  }
};

https.get(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(res.statusCode, body));
});
