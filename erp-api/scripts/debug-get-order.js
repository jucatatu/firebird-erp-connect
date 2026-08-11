const http = require('http');
const crypto = require('crypto');

const API_KEY = 'DEV-TEST-KEY';
const API_SECRET = 'DEV-TEST-SECRET';
const HOST = 'localhost';
const PORT = 3052;

function sign(method, path, body = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyString = Object.keys(body).length > 0 ? JSON.stringify(body) : '';
  const bodyHash = crypto.createHmac('sha256', API_SECRET).update(bodyString).digest('hex');
  
  const stringToSign = `${method.toUpperCase()}
${path}
${timestamp}
${bodyHash}`;
  const signature = crypto.createHmac('sha256', API_SECRET).update(stringToSign).digest('hex');
  
  return {
    'x-api-key': API_KEY,
    'x-signature': signature,
    'x-timestamp': timestamp.toString(),
    'x-body-hash': bodyHash
  };
}

function testGetOrder(orderNumber) {
  const path = `/api/v1/orders/${orderNumber}`;
  const headers = sign('GET', path);
  
  console.log(`Testing GET ${path}...`);
  
  const options = {
    hostname: HOST,
    port: PORT,
    path: path,
    method: 'GET',
    headers: headers
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('STATUS:', res.statusCode);
      try {
        console.log('DATA:', JSON.stringify(JSON.parse(data), null, 2));
      } catch (e) {
        console.log('RAW DATA:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('ERROR:', e.message);
  });

  req.end();
}

testGetOrder(8623);