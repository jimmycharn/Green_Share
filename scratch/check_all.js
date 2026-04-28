import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllMembers() {
  console.log("--- Listing All Members in DB ---");
  const { data: members, error } = await supabase
    .from('members')
    .select('id, name, line_id, status, role');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Total members: ${members.length}`);
  members.forEach((m, i) => {
    console.log(`${i+1}. [${m.id}] Name: ${m.name}, Role: ${m.role}, LINE ID: ${m.line_id || 'N/A'}`);
  });

  console.log("\n--- Listing All Member House Relationships ---");
  const { data: houses } = await supabase
    .from('member_houses')
    .select('member_id, admin_id, status');
    
  console.log(`Total house links: ${houses?.length || 0}`);
  houses?.forEach((h, i) => {
    console.log(`${i+1}. Member: ${h.member_id} -> Admin: ${h.admin_id} [Status: ${h.status}]`);
  });
}

checkAllMembers();
