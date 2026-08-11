import axios from 'axios';
import { createHmac } from 'crypto';

const API_KEY = "DEV-TEST-KEY";
const API_SECRET = "DEV-TEST-SECRET";
const BASE_URL = "http://localhost:3052/api/v1";

function sign(method, path, body = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyString = Object.keys(body).length > 0 ? JSON.stringify(body) : '';
  const bodyHash = createHmac('sha256', API_SECRET).update(bodyString).digest('hex');
  
  // A assinatura deve incluir a query string se existir, mas aqui o path é limpo
  const stringToSign = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = createHmac('sha256', API_SECRET).update(stringToSign).digest('hex');
  
  return {
    'x-api-key': API_KEY,
    'x-signature': signature,
    'x-timestamp': timestamp.toString(),
    'x-body-hash': bodyHash
  };
}

async function testGetOrder(orderNumber) {
  const path = `/orders/${orderNumber}`;
  const headers = sign('GET', path);
  
  console.log(`Testing GET ${path}...`);
  try {
    const response = await axios.get(`${BASE_URL}${path}`, { headers });
    console.log('SUCCESS:', response.status);
    console.log('DATA:', JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('ERROR:', err.response?.status || err.message);
    if (err.response?.data) {
      console.error('DETAILS:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

async function run() {
  await testGetOrder(8623);
}

run();
