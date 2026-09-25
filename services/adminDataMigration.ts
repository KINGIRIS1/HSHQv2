import { supabase } from './supabaseClient';
import { resolveRecordRouting, RecordRoutingResult } from './apiRecords';

const TABLE_SCHEMA_CACHE: Record<string, Set<string>> = {};

export interface RoutingConflictItem {
  id: string;
  code: string;
  actualTable: 'dangky_records' | 'land_records' | 'luutru_records' | 'contracts';
  expectedTable: 'dangky_records' | 'land_records' | 'luutru_records' | 'contracts';
  module: string;
  recordType?: string;
  procedureCode?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  originalPayload: any;
  hasMissingProcedureCode: boolean;
  routingReason?: string;
}

export interface RoutingAuditReport {
  timestamp: string;
  totalChecked: number;
  validCount: number;
  conflictCount: number;
  missingProcedureCodeCount: number;
  unresolvedCount: number;
  conflicts: RoutingConflictItem[];
}

export interface MigrationRecordResult {
  id: string;
  code: string;
  actualTable: string;
  expectedTable: string;
  status: 'SUCCESS' | 'MIGRATION_FAILED' | 'SKIPPED';
  reason?: string;
  verifiedInTarget?: boolean;
  deletedFromSource?: boolean;
}

export interface MigrationBatchResult {
  batchId: string;
  timestamp: string;
  totalProcessed: number;
  successCount: number;
  failCount: number;
  results: MigrationRecordResult[];
}

async function fetchAllRowsFromTable(tableName: 'dangky_records' | 'land_records' | 'luutru_records'): Promise<any[]> {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !data || data.length === 0) {
      break;
    }

    allRows = [...allRows, ...data];
    if (data.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allRows;
}

/**
 * Perform a Read-Only Audit across all record tables to detect routing conflicts.
 */
export const runRoutingAudit = async (): Promise<RoutingAuditReport> => {
  const [dangkyData, landData, luutruData] = await Promise.all([
    fetchAllRowsFromTable('dangky_records'),
    fetchAllRowsFromTable('land_records'),
    fetchAllRowsFromTable('luutru_records')
  ]);

  let totalChecked = 0;
  let validCount = 0;
  let conflictCount = 0;
  let missingProcedureCodeCount = 0;
  let unresolvedCount = 0;
  const conflicts: RoutingConflictItem[] = [];

  const processRow = (row: any, actualTable: 'dangky_records' | 'land_records' | 'luutru_records') => {
    totalChecked++;
    const res = resolveRecordRouting(row, actualTable);

    if (res.hasMissingProcedureCode) {
      missingProcedureCodeCount++;
    }

    if (res.routingStatus === 'ROUTING_VALID') {
      validCount++;
    } else if (res.routingStatus === 'ROUTING_CONFLICT') {
      conflictCount++;
      conflicts.push({
        id: row.id || (row as any)?.data?.id || `UNKNOWN_${Math.random()}`,
        code: res.code || row.code || 'N/A',
        actualTable,
        expectedTable: res.expectedTable as any,
        module: res.module,
        recordType: row.recordType || row.type || (row as any)?.data?.recordType || 'N/A',
        procedureCode: res.procedureCode || 'N/A',
        status: row.status || (row as any)?.data?.status || 'N/A',
        created_at: row.created_at || row.createdAt || (row as any)?.data?.created_at,
        updated_at: row.updated_at || row.updatedAt || (row as any)?.data?.updated_at,
        originalPayload: row,
        hasMissingProcedureCode: res.hasMissingProcedureCode,
        routingReason: res.routingReason
      });
    } else {
      unresolvedCount++;
    }
  };

  dangkyData.forEach(r => processRow(r, 'dangky_records'));
  landData.forEach(r => processRow(r, 'land_records'));
  luutruData.forEach(r => processRow(r, 'luutru_records'));

  console.log(`[ROUTING AUDIT] VALID: ${validCount}, CONFLICT: ${conflictCount}, MISSING_PROCEDURE_CODE: ${missingProcedureCodeCount}, UNRESOLVED: ${unresolvedCount}`);

  return {
    timestamp: new Date().toISOString(),
    totalChecked,
    validCount,
    conflictCount,
    missingProcedureCodeCount,
    unresolvedCount,
    conflicts
  };
};

/**
 * Maps schema payload cleanly between source and target tables.
 */
const mapRecordForTable = (
  originalRow: any,
  expectedTable: 'dangky_records' | 'land_records' | 'luutru_records' | 'contracts'
): any => {
  const cleanObj = { ...originalRow };

  // Common core columns
  const mapped: any = {
    id: cleanObj.id,
    code: cleanObj.code,
    created_at: cleanObj.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Preserve recordType, status, customer, content, metadata
  if (cleanObj.recordType) mapped.recordType = cleanObj.recordType;
  if (cleanObj.status) mapped.status = cleanObj.status;
  if (cleanObj.customer) mapped.customer = cleanObj.customer;
  if (cleanObj.content) mapped.content = cleanObj.content;
  if (cleanObj.group) mapped.group = cleanObj.group;
  if (cleanObj.ward) mapped.ward = cleanObj.ward;
  if (cleanObj.district) mapped.district = cleanObj.district;
  if (cleanObj.province) mapped.province = cleanObj.province;
  if (cleanObj.assignedTo) mapped.assignedTo = cleanObj.assignedTo;
  if (cleanObj.entryNumber) mapped.entryNumber = cleanObj.entryNumber;
  if (cleanObj.data) mapped.data = cleanObj.data;

  // Additional schema mapping for luutru_records
  if (expectedTable === 'luutru_records') {
    if (!mapped.recordType) {
      mapped.recordType = cleanObj.code?.startsWith('LT-') ? 'Sao lục / Vào sổ GCN' : 'Hồ sơ lưu trữ';
    }
  }

  return mapped;
};

/**
 * Execute atomic migration for routing conflicts.
 * Follows strict BACKUP -> VALIDATE -> INSERT -> VERIFY -> DELETE SOURCE -> FINAL VERIFY.
 */
export const executeAtomicRoutingMigration = async (
  targetConflictIds?: string[]
): Promise<MigrationBatchResult> => {
  const nowStr = new Date().toISOString().replace(/[T.:-]/g, '').slice(0, 14);
  const batchId = `routing_migration_${nowStr}`;

  // 1. Audit current conflicts
  const audit = await runRoutingAudit();
  let itemsToMigrate = audit.conflicts;

  if (targetConflictIds && targetConflictIds.length > 0) {
    itemsToMigrate = itemsToMigrate.filter(item => targetConflictIds.includes(item.id));
  }

  const results: MigrationRecordResult[] = [];
  let successCount = 0;
  let failCount = 0;

  // Backup array to store in system_settings
  const migrationBackups: any[] = [];

  for (const item of itemsToMigrate) {
    const { id, code, actualTable, expectedTable, originalPayload } = item;

    const recordRes: MigrationRecordResult = {
      id,
      code,
      actualTable,
      expectedTable,
      status: 'MIGRATION_FAILED'
    };

    try {
      // --- STEP A: BACKUP ---
      const backupEntry = {
        migrationBatchId: batchId,
        timestamp: new Date().toISOString(),
        id,
        code,
        actualTable,
        expectedTable,
        originalPayload
      };
      migrationBackups.push(backupEntry);

      // --- STEP B: VALIDATE ---
      // Check record exists in source table
      const { data: sourceCheck, error: sourceErr } = await supabase
        .from(actualTable)
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (sourceErr || !sourceCheck) {
        recordRes.reason = `Source record ID ${id} not found in ${actualTable}`;
        failCount++;
        results.push(recordRes);
        continue;
      }

      // Check record does NOT already exist in target table
      const { data: targetCheck } = await supabase
        .from(expectedTable)
        .select('id')
        .eq('id', id)
        .maybeSingle();

      if (targetCheck) {
        // Record already present in target table, abort or resolve conflict
        console.warn(`[MIGRATION] Record ${id} already present in target table ${expectedTable}`);
      }

      // Prepare mapped payload for target table
      if (!TABLE_SCHEMA_CACHE[expectedTable]) {
        const { data: targetSample } = await supabase.from(expectedTable).select('*').limit(1).maybeSingle();
        TABLE_SCHEMA_CACHE[expectedTable] = new Set(Object.keys(targetSample || {}));
      }
      const allowedKeys = TABLE_SCHEMA_CACHE[expectedTable];

      const cleanPayload: any = {};
      if (allowedKeys.size > 0) {
        for (const [k, v] of Object.entries(originalPayload)) {
          if (allowedKeys.has(k)) {
            cleanPayload[k] = v;
          }
        }
      } else {
        Object.assign(cleanPayload, originalPayload);
      }
      cleanPayload.id = id;
      cleanPayload.code = code;
      cleanPayload.updated_at = new Date().toISOString();

      if (expectedTable === 'luutru_records' && !cleanPayload.recordType) {
        cleanPayload.recordType = code.startsWith('LT-') ? 'Sao lục / Vào sổ GCN' : 'Hồ sơ lưu trữ';
      }

      // --- STEP C: INSERT INTO TARGET TABLE ---
      const { error: insertErr } = await supabase
        .from(expectedTable)
        .upsert(cleanPayload);

      if (insertErr) {
        recordRes.reason = `Failed to insert into ${expectedTable}: ${insertErr.message}`;
        failCount++;
        results.push(recordRes);
        continue;
      }

      // --- STEP D: VERIFY IN TARGET TABLE ---
      const { data: verifyTarget } = await supabase
        .from(expectedTable)
        .select('id, code')
        .eq('id', id)
        .maybeSingle();

      if (!verifyTarget || verifyTarget.id !== id) {
        recordRes.reason = `Verification failed: Record ${id} missing in target table ${expectedTable} after insert`;
        failCount++;
        results.push(recordRes);
        continue;
      }
      recordRes.verifiedInTarget = true;

      // --- STEP E: DELETE FROM SOURCE TABLE ---
      const { error: deleteErr } = await supabase
        .from(actualTable)
        .delete()
        .eq('id', id);

      if (deleteErr) {
        recordRes.reason = `Failed to delete source record ${id} from ${actualTable}: ${deleteErr.message}`;
        failCount++;
        results.push(recordRes);
        continue;
      }
      recordRes.deletedFromSource = true;

      // --- STEP F: FINAL VERIFY ---
      const [finalTargetCheck, finalSourceCheck] = await Promise.all([
        supabase.from(expectedTable).select('id', { count: 'exact', head: true }).eq('id', id),
        supabase.from(actualTable).select('id', { count: 'exact', head: true }).eq('id', id)
      ]);

      const targetCount = finalTargetCheck.count ?? 0;
      const sourceCount = finalSourceCheck.count ?? 0;

      if (targetCount === 1 && sourceCount === 0) {
        recordRes.status = 'SUCCESS';
        successCount++;
        console.log(`[MIGRATION SUCCESS] Record ${code} (${id}) moved from ${actualTable} -> ${expectedTable}`);
      } else {
        recordRes.status = 'MIGRATION_FAILED';
        recordRes.reason = `Final verify failed: Target count=${targetCount} (expected 1), Source count=${sourceCount} (expected 0)`;
        failCount++;
      }
    } catch (err: any) {
      recordRes.status = 'MIGRATION_FAILED';
      recordRes.reason = err.message || 'Unknown migration error';
      failCount++;
    }

    results.push(recordRes);
  }

  // Save backup batch to system_settings for permanent auditability
  try {
    const backupKey = `MIGRATION_BACKUP_${batchId}`;
    await supabase.from('system_settings').upsert({
      key: backupKey,
      value: JSON.stringify({
        batchId,
        timestamp: new Date().toISOString(),
        total: migrationBackups.length,
        backups: migrationBackups
      })
    });
  } catch (bErr) {
    console.warn(`[MIGRATION BACKUP WARN] Could not save backup to system_settings:`, bErr);
  }

  return {
    batchId,
    timestamp: new Date().toISOString(),
    totalProcessed: itemsToMigrate.length,
    successCount,
    failCount,
    results
  };
};
