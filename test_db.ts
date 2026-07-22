import { supabase } from './services/supabaseClient';
async function test() {
  const { data, error } = await supabase.from('land_records').select('pendingCheckDate, checkedDate, completedWorkDate').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}
test();
