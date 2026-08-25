import { supabase, isConfigured } from './supabaseClient';
import { DangKyRecord, DangKyParty } from '../types';
import { getFromCache, saveToCache, CACHE_KEYS, logError } from './apiCore';

// Mẫu dữ liệu giả định ban đầu khi chưa có dữ liệu trong DB
export const MOCK_DANGKY_RECORDS: DangKyRecord[] = [
  {
    id: 'dk-001',
    code: '000.00.00.H05-260818-0001',
    owners: [
      { name: 'Nguyễn Văn Anh', cccd: '038090001111', address: 'Xã Hải Tiến, Huyện Hậu Lộc' },
      { name: 'Trần Thị Bình', cccd: '038192002222', address: 'Xã Hải Tiến, Huyện Hậu Lộc' }
    ],
    transferees: [
      { name: 'Lê Văn Cường', cccd: '038085003333', address: 'Thị trấn Quảng Xương' }
    ],
    authorizedPersonName: 'Phạm Văn Dũng',
    authorizedPersonId: '038099004444',
    authorizedPersonAddress: 'TP Thanh Hóa',
    issueNumber: 'CP 123456',
    entryNumber: 'CS 01234',
    totalArea: 150.5,
    residentialArea: 100,
    ward: 'Xã Hải Tiến',
    recordType: 'Chuyển nhượng QSDĐ',
    receivedDate: new Date().toISOString(),
    deadline: new Date(Date.now() + 15 * 86400000).toISOString(),
    appraisalDate: new Date().toISOString(),
    appraisalStaff: 'Nguyễn Văn Minh',
    taxFormDate: '',
    taxFormStaff: '',
    taxKV7TransferDate: '',
    taxNoticeDate: '',
    taxPaymentReceiptDate: '',
    printDate: '',
    pendingCheckDate: '',
    checkedBy: '',
    submissionDate: '',
    submittedTo: '',
    completedDate: '',
    exportBatch: '',
    resultReturnedDate: '',
    receiptNumber: 'BL-001',
    invoiceNumber: 'HD-001',
    feeAmount: 100000,
    status: 'Tiếp nhận mới',
    notes: 'Hồ sơ đầy đủ thủ tục',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Normalize raw status string to DangKyStatusType in Vietnamese
export const normalizeDangKyStatus = (rawStatus?: string): DangKyRecord['status'] => {
  if (!rawStatus) return 'Tiếp nhận mới';
  const s = String(rawStatus).trim();
  const lower = s.toLowerCase();

  if (lower.includes('tiếp nhận') || lower.includes('tiep_nhan') || lower === 'new' || lower === 'received' || lower === 'tiep_nhan_moi') {
    return 'Tiếp nhận mới';
  }
  if (lower.includes('thẩm định') || lower.includes('tham_dinh') || lower === 'appraisal') {
    return 'Thẩm định';
  }
  if (lower.includes('chuyển thuế') || lower.includes('phieu_chuyen') || lower === 'tax_transfer') {
    return 'Phiếu chuyển thuế';
  }
  if (lower.includes('thuế kv7') || lower.includes('thue_kv7') || lower === 'tax_kv7') {
    return 'Chờ Thuế KV7';
  }
  if (lower.includes('nộp tiền') || lower.includes('thông báo thuế') || lower.includes('gnt') || lower === 'tax_payment') {
    return 'Chờ giấy nộp tiền';
  }
  if (lower.includes('in gcn') || lower.includes('in_gcn') || lower === 'printing') {
    return 'Chờ In GCN';
  }
  if (lower.includes('kiểm tra') || lower.includes('kiem_tra') || lower === 'checking') {
    return 'Chờ kiểm tra';
  }
  if (lower.includes('ký duyệt') || lower.includes('trình ký') || lower.includes('trinh_ky') || lower === 'submitted') {
    return 'Chờ ký duyệt';
  }
  if (lower.includes('bàn giao') || lower.includes('cho_ban_giao') || lower === 'handover') {
    return 'Chờ bàn giao';
  }
  if (lower.includes('giao 1 cửa') || lower.includes('1 cửa') || lower.includes('giao_1_cua') || lower === 'one_door') {
    return 'Đã giao 1 cửa';
  }
  if (lower.includes('trả kết quả') || lower.includes('đã trả') || lower.includes('da_tra_kq') || lower === 'returned' || lower === 'completed' || lower === 'done') {
    return 'Đã trả kết quả';
  }
  if (lower.includes('bổ sung') || lower.includes('bo_sung') || lower === 'pending') {
    return 'Chờ bổ sung';
  }
  if (lower.includes('rút') || lower.includes('csd_rut')) {
    return 'CSD rút HS';
  }
  if (lower.includes('hủy') || lower.includes('tra_huy') || lower === 'cancelled' || lower === 'rejected') {
    return 'Trả hủy hồ sơ';
  }

  return 'Tiếp nhận mới';
};

// Helper map DB to Record
export const mapDangKyFromDb = (item: any): DangKyRecord => {
  return {
    id: String(item.id || item.code),
    code: String(item.code || ''),
    owners: Array.isArray(item.owners) ? item.owners : (typeof item.owners === 'string' ? JSON.parse(item.owners || '[]') : []),
    transferees: Array.isArray(item.transferees) ? item.transferees : (typeof item.transferees === 'string' ? JSON.parse(item.transferees || '[]') : []),
    authorizedPersonName: item.authorizedPersonName || item.authorized_person_name || '',
    authorizedPersonId: item.authorizedPersonId || item.authorized_person_id || '',
    authorizedPersonPhone: item.authorizedPersonPhone || item.authorized_person_phone || '',
    authorizedPersonAddress: item.authorizedPersonAddress || item.authorized_person_address || '',
    landPlot: item.landPlot || item.land_plot || '',
    mapSheet: item.mapSheet || item.map_sheet || '',
    issueNumber: item.issueNumber || item.issue_number || '',
    entryNumber: item.entryNumber || item.entry_number || '',
    totalArea: item.totalArea ?? item.total_area ?? 0,
    residentialArea: item.residentialArea ?? item.residential_area ?? 0,
    ward: item.ward || '',
    recordType: item.recordType || item.record_type || '',
    receivedDate: item.receivedDate || item.received_date || '',
    receivedBy: item.receivedBy || item.received_by || '',
    deadline: item.deadline || '',
    appraisalDate: item.appraisalDate || item.appraisal_date || '',
    appraisalStaff: item.appraisalStaff || item.appraisal_staff || '',
    taxFormDate: item.taxFormDate || item.tax_form_date || '',
    taxFormNumber: item.taxFormNumber || item.tax_form_number || '',
    taxFormStaff: item.taxFormStaff || item.tax_form_staff || '',
    taxKV7TransferDate: item.taxKV7TransferDate || item.tax_kv7_transfer_date || '',
    taxKV7Staff: item.taxKV7Staff || item.tax_kv7_staff || '',
    taxNoticeDate: item.taxNoticeDate || item.tax_notice_date || '',
    taxNoticeStaff: item.taxNoticeStaff || item.tax_notice_staff || '',
    taxPaymentReceiptDate: item.taxPaymentReceiptDate || item.tax_payment_receipt_date || '',
    printDate: item.printDate || item.print_date || '',
    printStaff: item.printStaff || item.print_staff || '',
    pendingCheckDate: item.pendingCheckDate || item.pending_check_date || '',
    checkedBy: item.checkedBy || item.checked_by || '',
    submissionDate: item.submissionDate || item.submission_date || '',
    submittedTo: item.submittedTo || item.submitted_to || '',
    completedDate: item.completedDate || item.completed_date || '',
    exportBatch: item.exportBatch || item.export_batch || '',
    exportDate: item.exportDate || item.export_date || '',
    resultReturnedDate: item.resultReturnedDate || item.result_returned_date || '',
    receiptNumber: item.receiptNumber || item.receipt_number || '',
    invoiceNumber: item.invoiceNumber || item.invoice_number || '',
    receiptType: item.receiptType || item.receipt_type || null,
    receiverName: item.receiverName || item.receiver_name || '',
    feeAmount: item.feeAmount ?? item.fee_amount ?? 0,
    price: item.price ?? null,
    returnedPrice: item.returnedPrice ?? item.returned_price ?? null,
    status: normalizeDangKyStatus(item.status),
    notes: item.notes || '',
    personalNotes: item.personalNotes || item.personal_notes || '',
    privateNotes: item.privateNotes || item.private_notes || '',
    reminderDate: item.reminderDate || item.reminder_date || '',
    otherDocs: item.otherDocs || item.other_docs || '',
    explanationPlan: item.explanationPlan || item.explanation_plan || '',
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
    updatedAt: item.updatedAt || item.updated_at || new Date().toISOString()
  };
};

// Helper map Record to DB
export const mapDangKyToDb = (record: DangKyRecord): any => {
  return {
    id: record.id,
    code: record.code,
    owners: record.owners || [],
    transferees: record.transferees || [],
    authorizedPersonName: record.authorizedPersonName || null,
    authorizedPersonId: record.authorizedPersonId || null,
    authorizedPersonPhone: record.authorizedPersonPhone || null,
    authorizedPersonAddress: record.authorizedPersonAddress || null,
    landPlot: record.landPlot || null,
    mapSheet: record.mapSheet || null,
    issueNumber: record.issueNumber || null,
    entryNumber: record.entryNumber || null,
    totalArea: record.totalArea ? Number(record.totalArea) : 0,
    residentialArea: record.residentialArea ? Number(record.residentialArea) : 0,
    ward: record.ward || null,
    recordType: record.recordType || null,
    receivedDate: record.receivedDate || null,
    receivedBy: record.receivedBy || null,
    deadline: record.deadline || null,
    appraisalDate: record.appraisalDate || null,
    appraisalStaff: record.appraisalStaff || null,
    taxFormDate: record.taxFormDate || null,
    taxFormNumber: record.taxFormNumber || null,
    taxFormStaff: record.taxFormStaff || null,
    taxKV7TransferDate: record.taxKV7TransferDate || null,
    taxKV7Staff: record.taxKV7Staff || null,
    taxNoticeDate: record.taxNoticeDate || null,
    taxNoticeStaff: record.taxNoticeStaff || null,
    taxPaymentReceiptDate: record.taxPaymentReceiptDate || null,
    printDate: record.printDate || null,
    printStaff: record.printStaff || null,
    pendingCheckDate: record.pendingCheckDate || null,
    checkedBy: record.checkedBy || null,
    submissionDate: record.submissionDate || null,
    submittedTo: record.submittedTo || null,
    completedDate: record.completedDate || null,
    exportBatch: record.exportBatch || null,
    exportDate: record.exportDate || null,
    resultReturnedDate: record.resultReturnedDate || null,
    receiptNumber: record.receiptNumber || null,
    invoiceNumber: record.invoiceNumber || null,
    receiptType: record.receiptType || null,
    receiverName: record.receiverName || null,
    feeAmount: record.feeAmount ? Number(record.feeAmount) : 0,
    price: record.price ? Number(record.price) : null,
    returnedPrice: record.returnedPrice ? Number(record.returnedPrice) : null,
    status: record.status || 'Tiếp nhận mới',
    notes: record.notes || null,
    personalNotes: record.personalNotes || null,
    privateNotes: record.privateNotes || null,
    reminderDate: record.reminderDate || null,
    otherDocs: record.otherDocs || null,
    explanationPlan: record.explanationPlan || null,
    updatedAt: new Date().toISOString()
  };
};

// Fetch DangKy Records
export const fetchDangKyRecords = async (): Promise<DangKyRecord[]> => {
  let dbRecords: DangKyRecord[] | null = null;
  if (isConfigured) {
    try {
      // Thử order theo created_at hoặc receivedDate (chuẩn Supabase)
      let { data, error } = await supabase
        .from('dangky_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && (error.code === '42703' || error.message?.includes('created_at') || error.message?.includes('createdAt'))) {
        // Nếu không có created_at, order theo receivedDate
        const fallbackRes = await supabase
          .from('dangky_records')
          .select('*')
          .order('receivedDate', { ascending: false });
        
        if (!fallbackRes.error && fallbackRes.data) {
          data = fallbackRes.data;
          error = null;
        } else {
          // Fallback cuối cùng: query không order
          const anyRes = await supabase.from('dangky_records').select('*');
          if (!anyRes.error && anyRes.data) {
            data = anyRes.data;
            error = null;
          }
        }
      }

      if (error) {
        if (error.code !== 'PGRST205' && error.code !== '42P01') {
          console.warn('fetchDangKyRecords Supabase:', error.message || error);
        }
      } else if (data !== null && Array.isArray(data)) {
        dbRecords = data.map(mapDangKyFromDb);
      }
    } catch (e) {
      console.warn('fetchDangKyRecords catch:', e);
    }
  }

  // If successfully fetched from DB, cache and return
  if (dbRecords !== null) {
    saveToCache(CACHE_KEYS.DANGKY_RECORDS, dbRecords);
    return dbRecords;
  }

  // Fallback to cache if offline / DB failure
  const cached = getFromCache<DangKyRecord[] | null>(CACHE_KEYS.DANGKY_RECORDS, null);
  if (cached !== null) {
    return cached;
  }

  // Migration fallback: check general records cache on first run
  const generalCached: any[] = getFromCache(CACHE_KEYS.RECORDS, []);
  const dangKyFromGeneral = generalCached
    .filter(r => r.sourceTable === 'dangky_records')
    .map(mapDangKyFromDb);

  if (dangKyFromGeneral.length > 0) {
    saveToCache(CACHE_KEYS.DANGKY_RECORDS, dangKyFromGeneral);
    return dangKyFromGeneral;
  }

  saveToCache(CACHE_KEYS.DANGKY_RECORDS, MOCK_DANGKY_RECORDS);
  return MOCK_DANGKY_RECORDS;
};

// Save / Add DangKy Record
export const saveDangKyRecordApi = async (record: DangKyRecord): Promise<DangKyRecord> => {
  const allRecords = await fetchDangKyRecords();
  const index = allRecords.findIndex(r => r.id === record.id || (record.code && r.code === record.code));
  let updatedList: DangKyRecord[];

  const now = new Date().toISOString();
  const updatedRecord = { ...record, sourceTable: 'dangky_records' as const, updatedAt: now };

  if (index >= 0) {
    updatedList = [...allRecords];
    updatedList[index] = updatedRecord;
  } else {
    updatedList = [updatedRecord, ...allRecords];
  }

  saveToCache(CACHE_KEYS.DANGKY_RECORDS, updatedList);

  // Also sync to general records cache (offline_records)
  try {
    const generalCached: any[] = getFromCache(CACHE_KEYS.RECORDS, []);
    const genIndex = generalCached.findIndex(r => r.id === updatedRecord.id || (updatedRecord.code && r.code === updatedRecord.code));
    if (genIndex >= 0) {
      generalCached[genIndex] = { ...generalCached[genIndex], ...updatedRecord };
    } else {
      generalCached.unshift(updatedRecord);
    }
    saveToCache(CACHE_KEYS.RECORDS, generalCached);
  } catch (e) {
    console.error('Error syncing dangky record to general records cache:', e);
  }

  if (isConfigured) {
    try {
      let payload = mapDangKyToDb(updatedRecord);
      let { error } = await supabase
        .from('dangky_records')
        .upsert(payload, { onConflict: 'code' });

      if (error && (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist'))) {
        console.warn('saveDangKyRecordApi: Missing column in DB schema, retrying without optional extended fields...', error.message);
        // Strip optional columns if DB schema doesn't have them yet
        const safePayload = { ...payload };
        delete safePayload.authorizedPersonName;
        delete safePayload.authorizedPersonId;
        delete safePayload.authorizedPersonPhone;
        delete safePayload.authorizedPersonAddress;
        delete safePayload.transferees;
        delete safePayload.taxFormNumber;
        delete safePayload.tax_form_number;
        delete safePayload.authorized_person_name;
        delete safePayload.authorized_person_id;
        delete safePayload.authorized_person_phone;
        delete safePayload.authorized_person_address;

        const retryRes = await supabase
          .from('dangky_records')
          .upsert(safePayload, { onConflict: 'code' });
        
        if (retryRes.error) {
          logError('saveDangKyRecordApi retry Supabase', retryRes.error, true);
        }
      } else if (error) {
        logError('saveDangKyRecordApi Supabase', error, true);
      }
    } catch (e) {
      logError('saveDangKyRecordApi catch', e, true);
    }
  }

  return updatedRecord;
};

// Delete DangKy Record
export const deleteDangKyRecordApi = async (idOrCode: string): Promise<boolean> => {
  if (!idOrCode) return true;
  const cleanTarget = String(idOrCode).trim();
  const targetLower = cleanTarget.toLowerCase();

  // 1. Remove from DANGKY_RECORDS cache
  const cachedDangKy = getFromCache<DangKyRecord[]>(CACHE_KEYS.DANGKY_RECORDS, []);
  const updatedDangKy = cachedDangKy.filter(r => {
    const rId = String(r.id || '').trim().toLowerCase();
    const rCode = String(r.code || '').trim().toLowerCase();
    return rId !== targetLower && rCode !== targetLower;
  });
  saveToCache(CACHE_KEYS.DANGKY_RECORDS, updatedDangKy);

  // 2. Remove from GENERAL RECORDS cache (offline_records)
  const generalCached = getFromCache<any[]>(CACHE_KEYS.RECORDS, []);
  const updatedGeneral = generalCached.filter(r => {
    const rId = String(r.id || '').trim().toLowerCase();
    const rCode = String(r.code || '').trim().toLowerCase();
    return rId !== targetLower && rCode !== targetLower;
  });
  saveToCache(CACHE_KEYS.RECORDS, updatedGeneral);

  // 3. Delete from Supabase tables
  if (isConfigured) {
    try {
      await Promise.allSettled([
        supabase.from('dangky_records').delete().eq('id', cleanTarget),
        supabase.from('dangky_records').delete().eq('code', cleanTarget),
        supabase.from('land_records').delete().eq('id', cleanTarget),
        supabase.from('land_records').delete().eq('code', cleanTarget),
        supabase.from('luutru_records').delete().eq('id', cleanTarget),
        supabase.from('luutru_records').delete().eq('code', cleanTarget)
      ]);
    } catch (e) {
      console.warn('deleteDangKyRecordApi catch:', e);
    }
  }

  return true;
};

// Bulk Delete DangKy Records
export const bulkDeleteDangKyRecordsApi = async (idsOrCodes: string[]): Promise<boolean> => {
  if (!idsOrCodes || idsOrCodes.length === 0) return true;
  const cleanSet = new Set(idsOrCodes.map(x => String(x).trim().toLowerCase()));

  // 1. Remove from DANGKY_RECORDS cache
  const cachedDangKy = getFromCache<DangKyRecord[]>(CACHE_KEYS.DANGKY_RECORDS, []);
  const updatedDangKy = cachedDangKy.filter(r => {
    const rId = String(r.id || '').trim().toLowerCase();
    const rCode = String(r.code || '').trim().toLowerCase();
    return !cleanSet.has(rId) && !cleanSet.has(rCode);
  });
  saveToCache(CACHE_KEYS.DANGKY_RECORDS, updatedDangKy);

  // 2. Remove from GENERAL RECORDS cache
  const generalCached = getFromCache<any[]>(CACHE_KEYS.RECORDS, []);
  const updatedGeneral = generalCached.filter(r => {
    const rId = String(r.id || '').trim().toLowerCase();
    const rCode = String(r.code || '').trim().toLowerCase();
    return !cleanSet.has(rId) && !cleanSet.has(rCode);
  });
  saveToCache(CACHE_KEYS.RECORDS, updatedGeneral);

  // 3. Delete from Supabase tables
  if (isConfigured) {
    try {
      const targets = Array.from(cleanSet);
      await Promise.allSettled([
        supabase.from('dangky_records').delete().in('id', targets),
        supabase.from('dangky_records').delete().in('code', targets),
        supabase.from('land_records').delete().in('id', targets),
        supabase.from('land_records').delete().in('code', targets),
        supabase.from('luutru_records').delete().in('id', targets),
        supabase.from('luutru_records').delete().in('code', targets)
      ]);
    } catch (e) {
      console.warn('bulkDeleteDangKyRecordsApi catch:', e);
    }
  }

  return true;
};

// Batch Import or Bulk Save DangKy Records
export const saveDangKyRecordsBatchApi = async (
  recordsToSave: DangKyRecord[]
): Promise<boolean> => {
  if (!recordsToSave || recordsToSave.length === 0) return true;
  const allRecords = await fetchDangKyRecords();
  const existingMap = new Map<string, number>();
  
  allRecords.forEach((r, idx) => {
    if (r.id) existingMap.set(String(r.id).trim().toLowerCase(), idx);
    if (r.code) existingMap.set(String(r.code).trim().toLowerCase(), idx);
  });

  const now = new Date().toISOString();
  const updatedList = [...allRecords];

  for (const item of recordsToSave) {
    const keyId = item.id ? String(item.id).trim().toLowerCase() : '';
    const keyCode = item.code ? String(item.code).trim().toLowerCase() : '';
    const matchIdx = (keyId && existingMap.has(keyId)) ? existingMap.get(keyId)! : ((keyCode && existingMap.has(keyCode)) ? existingMap.get(keyCode)! : -1);

    const recordWithTimestamp = {
      ...item,
      updatedAt: now,
      createdAt: item.createdAt || now
    };

    if (matchIdx >= 0) {
      updatedList[matchIdx] = { ...updatedList[matchIdx], ...recordWithTimestamp };
    } else {
      updatedList.unshift(recordWithTimestamp);
      if (keyId) existingMap.set(keyId, 0);
      if (keyCode) existingMap.set(keyCode, 0);
    }
  }

  saveToCache(CACHE_KEYS.DANGKY_RECORDS, updatedList);

  if (isConfigured) {
    try {
      const dbPayloads = recordsToSave.map(mapDangKyToDb);
      // Batch upsert in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < dbPayloads.length; i += chunkSize) {
        const chunk = dbPayloads.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('dangky_records')
          .upsert(chunk, { onConflict: 'code' });
        if (error) {
          logError('saveDangKyRecordsBatchApi Supabase', error, true);
        }
      }
    } catch (e) {
      logError('saveDangKyRecordsBatchApi catch', e, true);
    }
  }

  return true;
};

// Batch update status or field
export const bulkUpdateDangKyRecordsApi = async (
  ids: string[],
  updates: Partial<DangKyRecord>
): Promise<boolean> => {
  const allRecords = await fetchDangKyRecords();
  const updatedList = allRecords.map(r => {
    if (ids.includes(r.id)) {
      return { ...r, ...updates, updatedAt: new Date().toISOString() };
    }
    return r;
  });

  saveToCache(CACHE_KEYS.DANGKY_RECORDS, updatedList);

  if (isConfigured) {
    try {
      const dbUpdates: any = { ...updates };
      dbUpdates.updatedAt = new Date().toISOString();

      const { error } = await supabase
        .from('dangky_records')
        .update(dbUpdates)
        .in('id', ids);

      if (error) {
        logError('bulkUpdateDangKyRecordsApi Supabase', error, true);
      }
    } catch (e) {
      logError('bulkUpdateDangKyRecordsApi catch', e, true);
    }
  }

  return true;
};

