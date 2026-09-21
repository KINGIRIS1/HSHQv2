import { supabase } from '../services/supabaseClient';
import { runRoutingAudit } from '../services/adminDataMigration';

async function fastBatchArchiveMigration() {
  console.log('=== FAST BATCH ARCHIVE MIGRATION (WITH SCHEMA KEY FILTER) ===');

  // 1. Fetch allowed schema keys for luutru_records
  const { data: sampleRow } = await supabase.from('luutru_records').select('*').limit(1).single();
  const allowedLuutruKeys = new Set(Object.keys(sampleRow || {}));
  console.log(`Allowed keys in luutru_records schema: ${allowedLuutruKeys.size}`);

  // 2. Audit current conflicts
  const audit = await runRoutingAudit();
  console.log(`Initial Audit: Total Checked: ${audit.totalChecked} | Valid: ${audit.validCount} | Conflicts: ${audit.conflictCount}`);

  if (audit.conflictCount === 0) {
    console.log('No conflicts found! All archive records are already in luutru_records.');
    return;
  }

  const conflicts = audit.conflicts;
  console.log(`Migrating ${conflicts.length} archive conflict records...`);

  const chunkSize = 50;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < conflicts.length; i += chunkSize) {
    const chunk = conflicts.slice(i, i + chunkSize);

    const payloadBatch = chunk.map(c => {
      const orig = c.originalPayload || {};
      const cleanPayload: Record<string, any> = {};

      for (const [k, v] of Object.entries(orig)) {
        if (allowedLuutruKeys.has(k)) {
          cleanPayload[k] = v;
        }
      }

      cleanPayload.id = c.id;
      cleanPayload.code = c.code;
      cleanPayload.updated_at = new Date().toISOString();
      if (!cleanPayload.recordType) {
        cleanPayload.recordType = c.recordType || 'Hồ sơ lưu trữ';
      }

      return cleanPayload;
    });

    // A. Batch Upsert to luutru_records
    const { error: upsertErr } = await supabase.from('luutru_records').upsert(payloadBatch);
    if (upsertErr) {
      console.error(`Chunk ${i / chunkSize + 1} upsert error:`, upsertErr.message);
      failCount += chunk.length;
      continue;
    }

    // B. Verify IDs in luutru_records
    const chunkIds = chunk.map(c => c.id);
    const { data: verifyData } = await supabase.from('luutru_records').select('id').in('id', chunkIds);
    const verifiedIds = (verifyData || []).map(v => v.id);

    if (verifiedIds.length > 0) {
      // C. Delete verified IDs from land_records
      const { error: delErr } = await supabase.from('land_records').delete().in('id', verifiedIds);
      if (delErr) {
        console.error(`Chunk ${i / chunkSize + 1} delete error:`, delErr.message);
      } else {
        successCount += verifiedIds.length;
        console.log(`Chunk ${i / chunkSize + 1}: Migrated & verified ${verifiedIds.length} / ${chunk.length} records.`);
      }
    }
  }

  console.log(`Migration Complete: Success: ${successCount} | Failed: ${failCount}`);

  // 3. Post Audit
  const finalAudit = await runRoutingAudit();
  console.log(`=== POST MIGRATION AUDIT ===`);
  console.log(`Checked: ${finalAudit.totalChecked} | Valid: ${finalAudit.validCount} | Conflicts: ${finalAudit.conflictCount}`);
}

fastBatchArchiveMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
