import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testQuery() {
  const adminId = 'Uf129b8220ec5880321b21ba99f3c02bf'; 
  
  console.log("--- Checking Admin Member Record ---");
  const { data: adminMember } = await supabase
    .from('members')
    .select('id, name, line_id')
    .eq('line_id', adminId)
    .single();
    
  if (!adminMember) {
    console.error("Admin member not found in DB!");
    return;
  }
  console.log("Admin DB ID:", adminMember.id);
  console.log("Admin Name:", adminMember.name);

  console.log("\n--- Checking House Members ---");
  const { data: houseMembers, error } = await supabase
    .from('member_houses')
    .select('member_id, status, member:members!member_id(id, name, line_id)')
    .eq('admin_id', adminMember.id);

  if (error) {
    console.error("Query Error:", error);
    return;
  }

  console.log(`Found ${houseMembers.length} members in this house:`);
  houseMembers.forEach((hm, i) => {
    console.log(`${i+1}. Name: ${hm.member?.name}, Status: ${hm.status}, LINE ID: ${hm.member?.line_id ? 'YES' : 'NO'} (${hm.member?.line_id || 'N/A'})`);
  });
}

testQuery();
