const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function audit() {
  const { data, error } = await supabase
    .from('order_drafts')
    .select('id, erp_order_number, customer_name_snapshot, payload')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching drafts:', error);
    return;
  }

  console.log('--- AUDIT REPORT ---');
  data.forEach(d => {
    console.log(`Draft ID: ${d.id} | ERP #: ${d.erp_order_number}`);
    console.log(`Customer Snapshot: ${d.customer_name_snapshot}`);
    console.log(`Payload Structure:`);
    console.log(`- Client: `, JSON.stringify(d.payload?.client || d.payload?.customer || 'MISSING'));
    console.log(`- Items (first): `, JSON.stringify(d.payload?.items?.[0] || 'NONE'));
    console.log(`- Equipments (first): `, JSON.stringify((d.payload?.equipments || d.payload?.equipment)?.[0] || 'NONE'));
    console.log('--------------------');
  });
}

audit();
