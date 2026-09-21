import { executeAtomicRoutingMigration, runRoutingAudit } from '../services/adminDataMigration';

async function runArchiveMigration() {
  console.log('=== STARTING ARCHIVE 549 RECORDS MIGRATION ===');
  
  // 1. Audit first
  const audit = await runRoutingAudit();
  console.log(`Initial Audit: Checked ${audit.totalChecked} | Valid: ${audit.validCount} | Conflicts: ${audit.conflictCount}`);

  if (audit.conflictCount === 0) {
    console.log('No conflicts found. All records are already properly routed!');
    return;
  }

  // 2. Execute Atomic Migration
  console.log(`Migrating ${audit.conflictCount} conflicts...`);
  const result = await executeAtomicRoutingMigration();

  console.log(`Migration Finished: Total Processed: ${result.totalProcessed} | Success: ${result.successCount} | Failed: ${result.failCount}`);

  // 3. Post-migration audit
  const postAudit = await runRoutingAudit();
  console.log(`Post Audit: Checked ${postAudit.totalChecked} | Valid: ${postAudit.validCount} | Conflicts: ${postAudit.conflictCount}`);
}

runArchiveMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
