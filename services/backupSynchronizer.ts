import { RecordFile } from '../types';
import { supabase, isConfigured } from './supabaseClient';
import {
  CACHE_KEYS,
  getFromCache,
  saveToCache,
  sanitizePayloadFor22P02,
  sanitizePayloadForDateErrors,
  mapRecordFromDb,
} from './apiCore';
import {
  getTargetTable,
  getInferredTable,
  sanitizeRecordPayloadForTable,
  recoverPayloadFromSchemaError,
} from './apiRecords';
import {
  mapArchiveRecordToLuutruDb,
  mapArchiveDbToRecordFile,
} from './apiArchive';

export type TargetRecordTable = 'luutru_records' | 'land_records' | 'dangky_records';

export interface BackupSyncCandidate {
  record: RecordFile;
  targetTable: TargetRecordTable;
}

export interface BackupSyncAnalysis {
  fileName?: string;
  backupTime?: string;
  backupVersion?: string;
  totalInBackup: number;
  existingCount: number;
  missingCount: number;
  unroutableCount: number;
  missingCandidates: BackupSyncCandidate[];
  skippedRecords: Array<{ id: string; code: string; customerName: string; status: string }>;
  unroutableRecords: Array<{ id: string; code: string; reason: string }>;
  missingByTable: {
    luutru_records: number;
    land_records: number;
    dangky_records: number;
  };
  logs: string[];
}

export interface BackupSyncOptions {
  /** Nếu bật, kiểm tra trùng cả Mã hồ sơ (code) ngoài ID. Mặc định false (chỉ so sánh chính xác theo ID). */
  alsoSkipMatchingCode?: boolean;
  /** Kích thước mỗi lô chèn lên Supabase (mặc định 50) */
  chunkSize?: number;
  /** Callback cập nhật tiến độ */
  onProgress?: (processed: number, total: number, message: string) => void;
}

export interface BackupSyncResult {
  success: boolean;
  totalInBackup: number;
  insertedCount: number;
  skippedCount: number;
  failedCount: number;
  insertedByTable: {
    luutru_records: number;
    land_records: number;
    dangky_records: number;
  };
  insertedRecords: Array<{
    id: string;
    code: string;
    customerName: string;
    recordType: string;
    status: string;
    targetTable: TargetRecordTable;
  }>;
  logs: string[];
  startedAt: string;
  completedAt: string;
}

/**
 * BackupSynchronizer
 * Thực hiện cập nhật gia tăng (Insert-Only Incremental Upsert) từ file Backup JSON vào hệ thống hiện tại:
 * 1. So sánh ID của từng hồ sơ trong backup với dữ liệu hiện tại (RAM + Cache + 3 bảng Supabase).
 * 2. Chỉ chèn các hồ sơ chưa tồn tại.
 * 3. Đảm bảo giữ nguyên 100% các dữ liệu hiện có.
 * 4. Bỏ qua (không ghi đè) các bản ghi đã có để tránh mất dữ liệu mới.
 * 5. Cung cấp log kết quả chi tiết (số bản ghi thêm mới, số bản ghi bỏ qua, phân loại theo bảng).
 */
export class BackupSynchronizer {
  /**
   * Trích xuất và chuẩn hóa danh sách hồ sơ từ nội dung JSON bất kỳ của file Backup
   */
  public static extractRecordsFromBackupJson(rawJson: any): {
    records: RecordFile[];
    backupTime?: string;
    backupVersion?: string;
  } {
    if (!rawJson) {
      throw new Error('Nội dung file backup rỗng hoặc không hợp lệ.');
    }

    // Trường hợp 1: File JSON là mảng hồ sơ trực tiếp
    if (Array.isArray(rawJson)) {
      const normalized = this.deduplicateBackupRecords(
        rawJson.map(item => this.normalizeBackupItemToRecordFile(item)).filter(Boolean) as RecordFile[]
      );
      return { records: normalized };
    }

    const payload = rawJson.data || rawJson;
    const extracted: RecordFile[] = [];

    // Trường hợp 2: Danh sách records chính (FullBackupData.data.records)
    if (Array.isArray(payload.records)) {
      for (const r of payload.records) {
        const norm = this.normalizeBackupItemToRecordFile(r);
        if (norm) extracted.push(norm);
      }
    }

    // Trường hợp 3: Nếu file backup tách theo tên bảng trực tiếp
    for (const tableKey of ['luutru_records', 'land_records', 'dangky_records'] as const) {
      if (Array.isArray(payload[tableKey])) {
        for (const r of payload[tableKey]) {
          const norm = this.normalizeBackupItemToRecordFile({ ...r, sourceTable: tableKey });
          if (norm) extracted.push(norm);
        }
      }
    }

    // Trường hợp 4: Các mảng archive_saoluc, archive_congvan, archive_vaoso trong FullBackupData
    const archiveArrays: Array<{ items: any[]; defaultType: string; table: TargetRecordTable }> = [
      { items: payload.archive_saoluc || [], defaultType: 'saoluc', table: 'luutru_records' },
      { items: payload.archive_congvan || [], defaultType: 'congvan', table: 'luutru_records' },
      { items: payload.archive_vaoso || [], defaultType: 'vaoso', table: 'dangky_records' },
    ];

    for (const group of archiveArrays) {
      if (Array.isArray(group.items)) {
        for (const ar of group.items) {
          if (!ar || !ar.id) continue;
          const norm = this.normalizeArchiveItemToRecordFile(ar, group.defaultType, group.table);
          if (norm) extracted.push(norm);
        }
      }
    }

    const deduplicated = this.deduplicateBackupRecords(extracted);

    return {
      records: deduplicated,
      backupTime: rawJson.backup_time || payload.backup_time,
      backupVersion: rawJson.version || payload.version,
    };
  }

  private static normalizeBackupItemToRecordFile(item: any): RecordFile | null {
    if (!item || typeof item !== 'object') return null;
    const id = String(item.id || '').trim();
    if (!id) return null;

    if (item.customerName !== undefined || item.recordType !== undefined || item.receivedDate !== undefined) {
      return {
        ...item,
        id,
        code: String(item.code || item.so_hieu || '').trim(),
        customerName: String(item.customerName || item.noi_nhan_gui || 'Chưa xác định').trim(),
      } as RecordFile;
    }

    // Nếu là cấu trúc ArchiveRecord thô
    if (item.so_hieu !== undefined || item.noi_nhan_gui !== undefined || item.trich_yeu !== undefined) {
      return this.normalizeArchiveItemToRecordFile(item, item.type || 'saoluc', 'luutru_records');
    }

    return mapRecordFromDb(item);
  }

  private static normalizeArchiveItemToRecordFile(
    ar: any,
    defaultType: string,
    defaultTable: TargetRecordTable
  ): RecordFile | null {
    try {
      const dbPayload = mapArchiveRecordToLuutruDb({
        ...ar,
        type: ar.type || defaultType,
      });
      const recFile = mapArchiveDbToRecordFile(dbPayload);
      return {
        ...recFile,
        sourceTable: defaultTable,
      };
    } catch {
      return null;
    }
  }

  private static deduplicateBackupRecords(records: RecordFile[]): RecordFile[] {
    const map = new Map<string, RecordFile>();
    for (const r of records) {
      if (!r || !r.id) continue;
      const existing = map.get(r.id);
      if (!existing) {
        map.set(r.id, r);
      } else {
        // Ưu tiên bản ghi có đầy đủ thông tin code & customerName hơn
        const existingHasInfo = Boolean(existing.code && existing.customerName && existing.customerName !== 'Chưa xác định');
        const newHasInfo = Boolean(r.code && r.customerName && r.customerName !== 'Chưa xác định');
        if (!existingHasInfo && newHasInfo) {
          map.set(r.id, r);
        }
      }
    }
    return Array.from(map.values());
  }

  /**
   * Thu thập toàn bộ tập hợp ID (và Code) đang tồn tại trên hệ thống hiện tại
   * (Kết hợp cả state truyền vào, Local Cache và truy vấn trực tiếp 3 bảng trên Supabase)
   */
  public static async fetchCurrentExistingIdentifiers(
    currentRecords: RecordFile[] = []
  ): Promise<{ existingIds: Set<string>; existingCodes: Set<string> }> {
    const existingIds = new Set<string>();
    const existingCodes = new Set<string>();

    const addFromList = (list: Array<Partial<RecordFile>>) => {
      for (const r of list) {
        if (!r) continue;
        if (r.id) existingIds.add(String(r.id).trim());
        const c = String(r.code || (r as any).so_hieu || '').trim().toLowerCase();
        if (c) existingCodes.add(c);
      }
    };

    // 1. Từ React state hiện tại
    addFromList(currentRecords);

    // 2. Từ LocalStorage Cache
    const cached = getFromCache<RecordFile[]>(CACHE_KEYS.RECORDS, []);
    addFromList(cached);

    // 3. Từ cả 3 bảng trên Supabase (đảm bảo chính xác tuyệt đối 100%)
    if (isConfigured) {
      try {
        const [ltRes, ddRes, dkRes] = await Promise.all([
          supabase.from('luutru_records').select('id, code, so_hieu'),
          supabase.from('land_records').select('id, code'),
          supabase.from('dangky_records').select('id, code'),
        ]);

        if (ltRes.data) addFromList(ltRes.data);
        if (ddRes.data) addFromList(ddRes.data);
        if (dkRes.data) addFromList(dkRes.data);
      } catch (err) {
        console.warn('[BackupSynchronizer] Không thể truy vấn trực tiếp danh sách ID từ Supabase, sử dụng dữ liệu bộ nhớ hiện tại:', err);
      }
    }

    return { existingIds, existingCodes };
  }

  /**
   * Xác định bảng đích an toàn cho hồ sơ từ file Backup
   */
  public static resolveBackupRecordTable(record: RecordFile): TargetRecordTable | null {
    try {
      return getTargetTable(record);
    } catch {
      const inferred = getInferredTable(record);
      if (inferred) return inferred;
      if (
        record.sourceTable === 'luutru_records' ||
        record.sourceTable === 'land_records' ||
        record.sourceTable === 'dangky_records'
      ) {
        return record.sourceTable;
      }
      if ((record.sourceTable as string) === 'archive_records') {
        return 'luutru_records';
      }
      return null;
    }
  }

  /**
   * Bước 1: Phân tích & đối chiếu file Backup với dữ liệu hiện tại (Dry-Run Preview)
   */
  public static async analyzeBackup(
    rawJson: any,
    currentRecords: RecordFile[] = [],
    options?: BackupSyncOptions & { fileName?: string }
  ): Promise<BackupSyncAnalysis> {
    const logs: string[] = [];
    const nowStr = new Date().toLocaleString('vi-VN');
    logs.push(`[${nowStr}] Bắt đầu phân tích dữ liệu backup${options?.fileName ? ` từ file "${options.fileName}"` : ''}...`);

    const { records: backupRecords, backupTime, backupVersion } = this.extractRecordsFromBackupJson(rawJson);
    logs.push(`- Đọc được tổng cộng ${backupRecords.length} hồ sơ duy nhất từ bản sao lưu.`);

    const { existingIds, existingCodes } = await this.fetchCurrentExistingIdentifiers(currentRecords);
    logs.push(`- Hệ thống hiện tại đang có ${existingIds.size} ID hồ sơ.`);

    const missingCandidates: BackupSyncCandidate[] = [];
    const skippedRecords: Array<{ id: string; code: string; customerName: string; status: string }> = [];
    const unroutableRecords: Array<{ id: string; code: string; reason: string }> = [];

    const missingByTable = {
      luutru_records: 0,
      land_records: 0,
      dangky_records: 0,
    };

    for (const r of backupRecords) {
      const id = String(r.id || '').trim();
      const code = String(r.code || '').trim();
      const lowerCode = code.toLowerCase();

      const hasId = existingIds.has(id);
      const hasCode = Boolean(options?.alsoSkipMatchingCode && lowerCode && existingCodes.has(lowerCode));

      // NGUYÊN TẮC 1, 3, 4: Nếu ID đã tồn tại trên hệ thống hiện tại -> BỎ QUA HOÀN TOÀN (không ghi đè)
      if (hasId || hasCode) {
        skippedRecords.push({
          id,
          code: code || '(Không mã)',
          customerName: r.customerName || 'Chưa xác định',
          status: String(r.status || ''),
        });
        continue;
      }

      const targetTable = this.resolveBackupRecordTable(r);
      if (!targetTable) {
        unroutableRecords.push({
          id,
          code: code || '(Không mã)',
          reason: 'Không xác định được bảng nghiệp vụ đích (thiếu loại thủ tục / nhóm / sourceTable)',
        });
        continue;
      }

      missingCandidates.push({
        record: { ...r, sourceTable: targetTable },
        targetTable,
      });
      missingByTable[targetTable]++;
    }

    logs.push(`- Kết quả đối chiếu ID:`);
    logs.push(`  + Đã tồn tại (Bỏ qua - giữ nguyên dữ liệu hiện có): ${skippedRecords.length} hồ sơ.`);
    logs.push(`  + Chưa tồn tại (Cần chèn bổ sung): ${missingCandidates.length} hồ sơ.`);
    logs.push(
      `    • Bảng Lưu trữ (luutru_records): ${missingByTable.luutru_records} hồ sơ\n` +
      `    • Bảng Đo đạc (land_records): ${missingByTable.land_records} hồ sơ\n` +
      `    • Bảng Đăng ký (dangky_records): ${missingByTable.dangky_records} hồ sơ`
    );
    if (unroutableRecords.length > 0) {
      logs.push(`  + Cảnh báo không định tuyến được bảng: ${unroutableRecords.length} hồ sơ.`);
    }

    return {
      fileName: options?.fileName,
      backupTime,
      backupVersion,
      totalInBackup: backupRecords.length,
      existingCount: skippedRecords.length,
      missingCount: missingCandidates.length,
      unroutableCount: unroutableRecords.length,
      missingCandidates,
      skippedRecords,
      unroutableRecords,
      missingByTable,
      logs,
    };
  }

  /**
   * Bước 2: Thực thi đồng bộ gia tăng (Chỉ chèn các hồ sơ chưa tồn tại, tuyệt đối không ghi đè bản ghi cũ)
   */
  public static async synchronizeIncremental(
    rawJsonOrAnalysis: any | BackupSyncAnalysis,
    currentRecords: RecordFile[] = [],
    options?: BackupSyncOptions
  ): Promise<BackupSyncResult> {
    const startedAt = new Date().toISOString();
    const analysis: BackupSyncAnalysis =
      rawJsonOrAnalysis && Array.isArray(rawJsonOrAnalysis.missingCandidates) && typeof rawJsonOrAnalysis.totalInBackup === 'number'
        ? rawJsonOrAnalysis
        : await this.analyzeBackup(rawJsonOrAnalysis, currentRecords, options);

    const logs: string[] = [...analysis.logs];
    const chunkSize = options?.chunkSize || 50;

    // Kiểm tra lại một lần nữa với DB ngay trước khi chèn để đảm bảo an toàn tuyệt đối
    const { existingIds, existingCodes } = await this.fetchCurrentExistingIdentifiers(currentRecords);
    const verifiedCandidates = analysis.missingCandidates.filter(c => {
      const id = String(c.record.id || '').trim();
      const lowerCode = String(c.record.code || '').trim().toLowerCase();
      if (existingIds.has(id)) return false;
      if (options?.alsoSkipMatchingCode && lowerCode && existingCodes.has(lowerCode)) return false;
      return true;
    });

    const newlySkippedDuringVerify = analysis.missingCandidates.length - verifiedCandidates.length;
    const totalSkipped = analysis.existingCount + newlySkippedDuringVerify;

    if (verifiedCandidates.length === 0) {
      const msg = `Hoàn tất: Toàn bộ ${analysis.totalInBackup} hồ sơ trong bản backup đều đã tồn tại trên hệ thống. Đã bỏ qua ${totalSkipped} hồ sơ, thêm mới 0 hồ sơ.`;
      logs.push(`[${new Date().toLocaleString('vi-VN')}] ${msg}`);
      options?.onProgress?.(100, 100, msg);
      return {
        success: true,
        totalInBackup: analysis.totalInBackup,
        insertedCount: 0,
        skippedCount: totalSkipped,
        failedCount: 0,
        insertedByTable: { luutru_records: 0, land_records: 0, dangky_records: 0 },
        insertedRecords: [],
        logs,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }

    logs.push(`[${new Date().toLocaleString('vi-VN')}] Bắt đầu chèn mới ${verifiedCandidates.length} hồ sơ chưa tồn tại...`);

    const grouped: Record<TargetRecordTable, RecordFile[]> = {
      luutru_records: [],
      land_records: [],
      dangky_records: [],
    };

    for (const item of verifiedCandidates) {
      grouped[item.targetTable].push(item.record);
    }

    const insertedRecords: BackupSyncResult['insertedRecords'] = [];
    const insertedRecordFiles: RecordFile[] = [];
    const insertedByTable = {
      luutru_records: 0,
      land_records: 0,
      dangky_records: 0,
    };
    let failedCount = 0;
    let processed = 0;
    const totalToInsert = verifiedCandidates.length;

    const tables: TargetRecordTable[] = ['luutru_records', 'land_records', 'dangky_records'];

    for (const table of tables) {
      const tableRecords = grouped[table];
      if (tableRecords.length === 0) continue;

      for (let i = 0; i < tableRecords.length; i += chunkSize) {
        const chunk = tableRecords.slice(i, i + chunkSize);
        options?.onProgress?.(
          processed,
          totalToInsert,
          `Đang chèn bổ sung vào bảng ${table} (${i + 1}–${Math.min(i + chunkSize, tableRecords.length)}/${tableRecords.length})...`
        );

        const sanitizedChunk = chunk.map(r => {
          let payload = sanitizeRecordPayloadForTable(r, table);
          payload = sanitizePayloadFor22P02(payload);
          payload = sanitizePayloadForDateErrors(payload);
          return payload;
        });

        if (isConfigured) {
          const chunkSuccess = await this.insertOnlyChunkToSupabase(table, sanitizedChunk, logs);
          for (const rec of chunk) {
            if (chunkSuccess.succeededIds.has(rec.id)) {
              insertedByTable[table]++;
              insertedRecordFiles.push({ ...rec, sourceTable: table });
              insertedRecords.push({
                id: rec.id,
                code: rec.code || '(Không mã)',
                customerName: rec.customerName || 'Chưa xác định',
                recordType: rec.recordType || '',
                status: String(rec.status || ''),
                targetTable: table,
              });
              logs.push(`  [+ THÊM MỚI] Bảng ${table} | ID: ${rec.id} | Mã: ${rec.code || 'N/A'} | Chủ SD: ${rec.customerName || 'N/A'} | Trạng thái: ${rec.status}`);
            } else {
              failedCount++;
            }
          }
        } else {
          // Chế độ Offline / Mock Cache
          for (const rec of chunk) {
            insertedByTable[table]++;
            insertedRecordFiles.push({ ...rec, sourceTable: table });
            insertedRecords.push({
              id: rec.id,
              code: rec.code || '(Không mã)',
              customerName: rec.customerName || 'Chưa xác định',
              recordType: rec.recordType || '',
              status: String(rec.status || ''),
              targetTable: table,
            });
            logs.push(`  [+ THÊM MỚI (CACHE)] Bảng ${table} | ID: ${rec.id} | Mã: ${rec.code || 'N/A'} | Chủ SD: ${rec.customerName || 'N/A'}`);
          }
        }

        processed += chunk.length;
        options?.onProgress?.(processed, totalToInsert, `Đã xử lý ${processed}/${totalToInsert} hồ sơ cần thêm...`);
      }
    }

    // Cập nhật bổ sung vào Local Cache (chỉ thêm hồ sơ mới, giữ nguyên 100% các hồ sơ đã có trong cache)
    if (insertedRecordFiles.length > 0) {
      const currentCache = getFromCache<RecordFile[]>(CACHE_KEYS.RECORDS, []);
      const cacheIdSet = new Set(currentCache.map(r => r.id));
      const newForCache = insertedRecordFiles.filter(r => !cacheIdSet.has(r.id));
      if (newForCache.length > 0) {
        saveToCache(CACHE_KEYS.RECORDS, [...newForCache, ...currentCache]);
      }
    }

    const summaryMsg =
      `[HOÀN TẤT ĐỒNG BỘ GIA TĂNG] Tổng trong backup: ${analysis.totalInBackup} | ` +
      `Đã thêm mới: ${insertedRecords.length} (Lưu trữ: ${insertedByTable.luutru_records}, Đo đạc: ${insertedByTable.land_records}, Đăng ký: ${insertedByTable.dangky_records}) | ` +
      `Đã bỏ qua (giữ nguyên bản ghi cũ): ${totalSkipped}` +
      (failedCount > 0 ? ` | Lỗi: ${failedCount}` : '');

    logs.push(`[${new Date().toLocaleString('vi-VN')}] ${summaryMsg}`);
    options?.onProgress?.(totalToInsert, totalToInsert, summaryMsg);

    return {
      success: failedCount === 0,
      totalInBackup: analysis.totalInBackup,
      insertedCount: insertedRecords.length,
      skippedCount: totalSkipped,
      failedCount,
      insertedByTable,
      insertedRecords,
      logs,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Thực hiện chèn chỉ thêm mới (ON CONFLICT (id) DO NOTHING / ignoreDuplicates: true) lên Supabase.
   * Tuyệt đối không bao giờ ghi đè bản ghi đã tồn tại.
   */
  private static async insertOnlyChunkToSupabase(
    table: TargetRecordTable,
    payloadChunk: any[],
    logs: string[]
  ): Promise<{ succeededIds: Set<string> }> {
    const succeededIds = new Set<string>();
    if (payloadChunk.length === 0) return { succeededIds };

    let currentChunk = [...payloadChunk];
    let { error } = await supabase
      .from(table)
      .upsert(currentChunk, { onConflict: 'id', ignoreDuplicates: true });

    // Tự động phục hồi nếu gặp lỗi thiếu cột schema (PGRST204 / 42703)
    let retryCount = 0;
    while (
      error &&
      retryCount < 5 &&
      (error.code === 'PGRST204' ||
        String(error.code) === '42703' ||
        String(error.message || '').includes('does not exist') ||
        String(error.message || '').includes('Could not find'))
    ) {
      retryCount++;
      const { recoveredPayload, missingColumn } = recoverPayloadFromSchemaError(currentChunk, table, error);
      logs.push(`  [!] Tự động bỏ qua cột chưa có trên bảng ${table}: ${missingColumn || 'unknown'}`);
      currentChunk = recoveredPayload;
      const retryRes = await supabase
        .from(table)
        .upsert(currentChunk, { onConflict: 'id', ignoreDuplicates: true });
      error = retryRes.error;
    }

    if (!error) {
      currentChunk.forEach(item => {
        if (item.id) succeededIds.add(item.id);
      });
      return { succeededIds };
    }

    // Nếu lô gặp lỗi cá biệt (ví dụ trùng unique code ở 1 dòng), chuyển sang chèn từng bản ghi để không làm hỏng cả lô
    logs.push(`  [!] Lô chèn trên bảng ${table} gặp lỗi (${error.message}), chuyển sang chèn từng hồ sơ...`);
    for (const row of currentChunk) {
      let singleRow = { ...row };
      let singleRes = await supabase
        .from(table)
        .upsert([singleRow], { onConflict: 'id', ignoreDuplicates: true });

      if (
        singleRes.error &&
        (singleRes.error.code === 'PGRST204' ||
          String(singleRes.error.code) === '42703' ||
          String(singleRes.error.message || '').includes('does not exist') ||
          String(singleRes.error.message || '').includes('Could not find'))
      ) {
        const { recoveredPayload } = recoverPayloadFromSchemaError(singleRow, table, singleRes.error);
        singleRow = recoveredPayload;
        singleRes = await supabase
          .from(table)
          .upsert([singleRow], { onConflict: 'id', ignoreDuplicates: true });
      }

      if (!singleRes.error) {
        succeededIds.add(singleRow.id);
      } else {
        logs.push(`  [x LỖI] Không thể chèn hồ sơ ID=${singleRow.id} (Mã: ${singleRow.code || 'N/A'}) vào bảng ${table}: ${singleRes.error.message}`);
      }
    }

    return { succeededIds };
  }
}
