const axios = require('axios');
const crypto = require('crypto');

const API_BASE_URL = 'http://localhost:3052/api/v1';
const API_KEY = 'DEV_KEY_Lovable_ERP_Integration_2026';
const API_SECRET = 'DEV_SECRET_77b3b426-3d41-4189-bbf4-1331e7f4e415';

function generateHmac(method, path, body = '') {
  const timestamp = Date.now().toString();
  const bodyHash = crypto.createHash('sha256').update(typeof body === 'object' ? JSON.stringify(body) : body).digest('hex');
  const payload = `${method}\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = crypto.createHmac('sha256', API_SECRET).update(payload).digest('hex');
  return { timestamp, signature };
}

async function test() {
  const path = '/api/v1/payment-options';
  const { timestamp, signature } = generateHmac('GET', path);

  try {
    const response = await axios.get(`${API_BASE_URL}/payment-options`, {
      headers: {
        'x-api-key': API_KEY,
        'x-timestamp': timestamp,
        'x-signature': signature
      }
    });

    console.log('--- Payment Options Result ---');
    console.log('OK:', response.data.ok);
    console.log('Terms:', response.data.data.paymentTerms.length);
    console.log('Methods:', response.data.data.paymentMethods.length);
    console.log('Sale Types:', response.data.data.saleTypes.length);
    console.log('Sample Term:', response.data.data.paymentTerms[0]);
    console.log('Sample Method:', response.data.data.paymentMethods[0]);
  } catch (err) {
    console.error('Error fetching payment options:', err.response?.status, err.response?.data || err.message);
  }

  // Testar um cliente
  try {
    const clientsPath = '/api/v1/clients';
    const { timestamp: ts2, signature: sig2 } = generateHmac('GET', clientsPath);
    const clientsRes = await axios.get(`${API_BASE_URL}/clients?limit=1`, {
        headers: {
            'x-api-key': API_KEY,
            'x-timestamp': ts2,
            'x-signature': sig2
        }
    });
    
    if (clientsRes.data.data.length > 0) {
        const client = clientsRes.data.data[0];
        console.log('\n--- Sample Client Defaults ---');
        console.log('ID:', client.id);
        console.log('Term ID:', client.defaultPaymentTermId);
        console.log('Method ID:', client.defaultPaymentMethodId);
        console.log('Sale Type ID:', client.defaultSaleTypeId);
    }
  } catch (err) {
      console.error('Error fetching client:', err.response?.status, err.response?.data || err.message);
  }
}

test();
