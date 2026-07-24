import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lrnfdksqepztnihrkgrr.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxybmZka3NxZXB6dG5paHJrZ3JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Njk1NzQsImV4cCI6MjA5MjQ0NTU3NH0.eIif2yiYZ8RwdoVLjHXBc73ookcWWEIqF_om7O-Eso8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    // 1. Fetch a record to see current values
    const recordId = '005dda0e-9052-40f3-9821-4d1a4319d5db';
    const { data: before } = await supabase.from('land_records').select('*').eq('id', recordId);
    console.log("Before upsert (customerName, receivedDate, deadline):", {
        name: before?.[0]?.customerName,
        receivedDate: before?.[0]?.receivedDate,
        deadline: before?.[0]?.deadline
    });

    // 2. Perform upsert with ONLY id and dates
    console.log("Upserting partial columns...");
    const { error } = await supabase.from('land_records').upsert([
        {
            id: recordId,
            receivedDate: '2026-06-09',
            deadline: '2026-07-21'
        }
    ]);

    if (error) {
        console.error("Upsert Error:", error);
        return;
    }

    // 3. Fetch again to see if customerName was erased/nulled
    const { data: after } = await supabase.from('land_records').select('*').eq('id', recordId);
    console.log("After upsert (customerName, receivedDate, deadline):", {
        name: after?.[0]?.customerName,
        receivedDate: after?.[0]?.receivedDate,
        deadline: after?.[0]?.deadline
    });
}

test();
