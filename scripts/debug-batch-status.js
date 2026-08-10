const crypto = require('crypto');
const axios = require('axios');

const API_KEY = 'test-api-key';
const API_SECRET = 'test-api-secret';
const BASE_URL = 'http://localhost:3052/api/v1';

async function test() {
  const timestamp = Date.now().toString();
  const method = 'GET';
  const path = '/api/v1/orders/batch-status';
  const queryString = '?orderIds=8619,8618';
  
  // No body for GET
  const bodyHash = crypto.createHash('sha256').update('').digest('hex');
  
  const signatureBase = `${timestamp}${method}${path}${queryString}${bodyHash}`;
  const signature = crypto.createHmac('sha256', API_SECRET).update(signatureBase).digest('hex');

  try {
    console.log('Testing GET /api/v1/orders/batch-status?orderIds=8619,8618...');
    const response = await axios.get(`${BASE_URL}/orders/batch-status${queryString}`, {
      headers: {
        'x-api-key': API_KEY,
        'x-signature': signature,
        'x-timestamp': timestamp
      }
    });
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('Error:', err.response ? err.response.status : err.message);
    if (err.response) console.error('Data:', err.response.data);
  }
}

test();
