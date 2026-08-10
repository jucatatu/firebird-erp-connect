const { createClient } = require('@supabase/supabase-js');

const url = 'https://qoxnhepwzelefapvkmip.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFveG5oZXB3emVsZWZhcHZrbWlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2ODA5ODIsImV4cCI6MjEwMDI1Njk4Mn0.XIrg430IuogQTwdMC3xq8UoUeFDnzzzNVLonwGUaVVY';

const supabase = createClient(url, key);

async function audit() {
  const { data, error } = await supabase
    .from('order_drafts')
    .select('id, erp_order_number, customer_name_snapshot, payload')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching drafts:', error);
    return;
  }

  console.log('Total drafts found:', data.length);
  if (data.length > 0) {
    data.slice(0, 10).forEach(d => {
      console.log(`Draft ID: ${d.id} | ERP #: ${d.erp_order_number}`);
      console.log(`Customer Snapshot: ${d.customer_name_snapshot}`);
      console.log(`Payload Structure:`);
      console.log(`- Client: `, JSON.stringify(d.payload?.client || d.payload?.customer || 'MISSING'));
      console.log(`- Items (first): `, JSON.stringify(d.payload?.items?.[0] || 'NONE'));
      console.log(`- Equipments (first): `, JSON.stringify((d.payload?.equipments || d.payload?.equipment)?.[0] || 'NONE'));
      console.log('--------------------');
    });
  }
}

audit();
