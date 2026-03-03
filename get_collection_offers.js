const https = require('https');
const options = {
  hostname: 'api.opensea.io',
  path: '/api/v2/orders/ethereum/seaport/offers?asset_contract_address=0xc3f8a0f5841abff777d3eefa5047e8d413a1c9ab&limit=1', // no token_ids limits to only collection offers? Or is it all offers for the collection?
  headers: {
    'x-api-key': process.env.OPENSEA_API_KEY,
    'Accept': 'application/json'
  }
};
https.get(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log(body));
});
