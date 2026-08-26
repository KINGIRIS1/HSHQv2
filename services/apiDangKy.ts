import { supabase, isConfigured } from './supabaseClient';
import { DangKyRecord, DangKyParty } from '../types';
import { 
  getFromCache, 
  saveToCache, 
  CACHE_KEYS, 
  logError, 
  keepOnlyDate, 
  normalizeCode, 
  executeSupabaseOperationWithAutoClean,
  sanitizePayloadFor22P02
} from './apiCore';

// UUID validation and generator
const isValidUUID = (str: any): boolean => {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
};

export const generateStandardId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
};

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

// Infer actual active status from dates/logs if rawStatus is generic or empty
export const resolveActualDangKyStatus = (item: any): string => {
  if (!item) return 'Tiếp nhận mới';
  
  // Return early if specific Vietnamese status is already explicit
  const raw = (item.status || '').trim();
  const explicitStatuses = [
    'Thẩm định', 'Phiếu chuyển thuế', 'Chờ Thuế KV7', 'Chờ giấy nộp tiền',
    'Chờ In GCN', 'Chờ kiểm tra', 'Chờ ký duyệt', 'Chờ bàn giao',
    'Đã giao 1 cửa', 'Đã trả kết quả', 'Chờ bổ sung', 'CSD rút HS', 'Trả hủy hồ sơ'
  ];
  if (explicitStatuses.includes(raw)) return raw;

  // Deduce backwards from latest completion stages:
  if (item.resultReturnedDate) return 'Đã trả kết quả';
  if (item.deliveryDate) return 'Đã giao 1 cửa';
  if (item.exportDate || item.exportBatch) return 'Chờ bàn giao';
  if (item.approvalDate || item.submissionDate || item.submittedTo) return 'Chờ ký duyệt';
  if (item.pendingCheckDate || item.checkedBy) return 'Chờ kiểm tra';
  if (item.printDate || item.printStaff) return 'Chờ In GCN';
  if (item.taxNoticeDate || item.taxPaymentReceiptDate || item.taxNoticeStaff) return 'Chờ giấy nộp tiền';
  if (item.taxKV7TransferDate || item.taxKV7Staff) return 'Chờ Thuế KV7';
  if (item.taxFormDate || item.taxFormStaff) return 'Phiếu chuyển thuế';
  if (item.appraisalDate || item.appraisalStaff) return 'Thẩm định';

  if (Array.isArray(item.statusLogs) && item.statusLogs.length > 0) {
    const lastLog = item.statusLogs[item.statusLogs.length - 1];
    const logSt = lastLog?.newStatus || lastLog?.status || lastLog?.step;
    if (logSt && explicitStatuses.includes(logSt)) return logSt;
  }

  return raw || 'Tiếp nhận mới';
};

// Normalize raw status string to DangKyStatusType in Vietnamese
export const normalizeDangKyStatus = (rawStatus?: string, item?: any): DangKyRecord['status'] => {
  let s = String(rawStatus || '').trim();
  if (item && (!s || s === 'IN_PROGRESS' || s === 'ASSIGNED' || s === 'RECEIVED' || s === 'processing' || s === 'Đang thực hiện' || s === 'Đang xử lý')) {
    s = resolveActualDangKyStatus(item);
  }
  if (!s) return 'Tiếp nhận mới';
  const lower = s.toLowerCase();

  if (lower.includes('trả kết quả') || lower.includes('đã trả') || lower.includes('da_tra_kq') || lower === 'returned' || lower === 'completed' || lower === 'done') {
    return 'Đã trả kết quả';
  }
  if (lower.includes('giao 1 cửa') || lower.includes('1 cửa') || lower.includes('giao_1_cua') || lower === 'one_door') {
    return 'Đã giao 1 cửa';
  }
  if (lower.includes('bàn giao') || lower.includes('cho_ban_giao') || lower === 'handover') {
    return 'Chờ bàn giao';
  }
  if (lower.includes('ký duyệt') || lower.includes('trình ký') || lower.includes('trinh_ky') || lower === 'submitted') {
    return 'Chờ ký duyệt';
  }
  if (lower.includes('kiểm tra') || lower.includes('kiem_tra') || lower === 'checking') {
    return 'Chờ kiểm tra';
  }
  if (lower.includes('in gcn') || lower.includes('in_gcn') || lower === 'printing') {
    return 'Chờ In GCN';
  }
  if (lower.includes('nộp tiền') || lower.includes('thông báo thuế') || lower.includes('gnt') || lower === 'tax_payment') {
    return 'Chờ giấy nộp tiền';
  }
  if (lower.includes('thuế kv7') || lower.includes('thue_kv7') || lower === 'tax_kv7') {
    return 'Chờ Thuế KV7';
  }
  if (lower.includes('chuyển thuế') || lower.includes('phieu_chuyen') || lower === 'tax_transfer') {
    return 'Phiếu chuyển thuế';
  }
  if (lower.includes('thẩm định') || lower.includes('tham_dinh') || lower === 'appraisal') {
    return 'Thẩm định';
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
  if (lower.includes('tiếp nhận') || lower.includes('tiep_nhan') || lower === 'new' || lower === 'received' || lower === 'tiep_nhan_moi') {
    return 'Tiếp nhận mới';
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
    applicantName: item.applicantName || item.applicant_name || item.submitterName || item.submitter_name || '',
    applicantPhone: item.applicantPhone || item.applicant_phone || item.submitterPhone || item.submitter_phone || '',
    applicantCccd: item.applicantCccd || item.applicant_cccd || '',
    applicantAddress: item.applicantAddress || item.applicant_address || '',
    applicantIsOwner: item.applicantIsOwner ?? item.applicant_is_owner ?? false,
    landPlot: item.landPlot || item.land_plot || '',
    mapSheet: item.mapSheet || item.map_sheet || '',
    issueNumber: item.issueNumber || item.issue_number || '',
    entryNumber: item.entryNumber || item.entry_number || '',
    issueDate: item.issueDate || item.issue_date || '',
    totalArea: item.totalArea ?? item.total_area ?? item.area ?? 0,
    residentialArea: item.residentialArea ?? item.residential_area ?? 0,
    ward: item.ward || '',
    nonBoundaryWard: item.nonBoundaryWard || item.non_boundary_ward || '',
    isNonBoundary: item.isNonBoundary ?? item.is_non_boundary ?? false,
    recordType: item.recordType || item.record_type || '',
    receivedDate: item.receivedDate || item.received_date || '',
    receivedBy: item.receivedBy || item.received_by || '',
    assignedDate: item.assignedDate || item.assigned_date || '',
    assignedTo: item.assignedTo || item.assigned_to || '',
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
    approvalDate: item.approvalDate || item.approval_date || '',
    completedDate: item.completedDate || item.completed_date || '',
    exportBatch: item.exportBatch || item.export_batch || '',
    exportDate: item.exportDate || item.export_date || '',
    handoverWard: item.handoverWard || item.handover_ward || '',
    deliveryDate: item.deliveryDate || item.delivery_date || '',
    resultReturnedDate: item.resultReturnedDate || item.result_returned_date || '',
    receiptNumber: item.receiptNumber || item.receipt_number || '',
    invoiceNumber: item.invoiceNumber || item.invoice_number || '',
    receiptType: item.receiptType || item.receipt_type || null,
    receiverName: item.receiverName || item.receiver_name || '',
    feeAmount: item.feeAmount ?? item.fee_amount ?? 0,
    price: item.price ?? null,
    returnedPrice: item.returnedPrice ?? item.returned_price ?? null,
    status: normalizeDangKyStatus(item.status, item),
    statusLogs: Array.isArray(item.statusLogs) ? item.statusLogs : (Array.isArray(item.status_logs) ? item.status_logs : []),
    notes: item.notes || '',
    personalNotes: item.personalNotes || item.personal_notes || '',
    privateNotes: item.privateNotes || item.private_notes || '',
    reminderDate: item.reminderDate || item.reminder_date || '',
    otherDocs: item.otherDocs || item.other_docs || '',
    attachedDocs: Array.isArray(item.attachedDocs) ? item.attachedDocs : (Array.isArray(item.attached_docs) ? item.attached_docs : []),
    attachedDocuments: Array.isArray(item.attachedDocuments) ? item.attachedDocuments : (Array.isArray(item.attached_documents) ? item.attached_documents : []),
    explanationPlan: item.explanationPlan || item.explanation_plan || '',
    customerName: item.customerName || item.customer_name || '',
    phoneNumber: item.phoneNumber || item.phone_number || '',
    cccd: item.cccd || '',
    customerAddress: item.customerAddress || item.customer_address || '',
    address: item.address || '',
    submitterName: item.submitterName || item.submitter_name || item.applicantName || item.applicant_name || '',
    submitterPhone: item.submitterPhone || item.submitter_phone || item.applicantPhone || item.applicant_phone || '',
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
    updatedAt: item.updatedAt || item.updated_at || new Date().toISOString()
  };
};

// Helper map Record to DB
export const mapDangKyToDb = (record: DangKyRecord): any => {
  const safeId = isValidUUID(record.id) ? record.id : (record.id && !record.id.startsWith('dk-') ? record.id : generateStandardId());
  
  return {
    id: safeId,
    code: String(record.code || '').trim(),
    owners: Array.isArray(record.owners) ? record.owners : [],
    transferees: Array.isArray(record.transferees) ? record.transferees : [],
    authorizedPersonName: record.authorizedPersonName || null,
    authorizedPersonId: record.authorizedPersonId || null,
    authorizedPersonPhone: record.authorizedPersonPhone || null,
    authorizedPersonAddress: record.authorizedPersonAddress || null,
    applicantName: record.applicantName || record.submitterName || null,
    applicantPhone: record.applicantPhone || record.submitterPhone || null,
    applicantCccd: record.applicantCccd || record.cccd || null,
    applicantAddress: record.applicantAddress || record.customerAddress || null,
    applicantIsOwner: record.applicantIsOwner ?? false,
    landPlot: record.landPlot || null,
    mapSheet: record.mapSheet || null,
    issueNumber: record.issueNumber || null,
    entryNumber: record.entryNumber || null,
    issueDate: keepOnlyDate(record.issueDate),
    totalArea: record.totalArea && !isNaN(Number(record.totalArea)) ? Number(record.totalArea) : 0,
    residentialArea: record.residentialArea && !isNaN(Number(record.residentialArea)) ? Number(record.residentialArea) : 0,
    ward: record.ward || null,
    nonBoundaryWard: record.nonBoundaryWard || null,
    isNonBoundary: record.isNonBoundary ?? false,
    recordType: record.recordType || null,
    receivedDate: keepOnlyDate(record.receivedDate),
    receivedBy: record.receivedBy || null,
    assignedDate: keepOnlyDate(record.assignedDate),
    assignedTo: record.assignedTo || null,
    deadline: keepOnlyDate(record.deadline),
    appraisalDate: keepOnlyDate(record.appraisalDate),
    appraisalStaff: record.appraisalStaff || null,
    taxFormDate: keepOnlyDate(record.taxFormDate),
    taxFormNumber: record.taxFormNumber || null,
    taxFormStaff: record.taxFormStaff || null,
    taxKV7TransferDate: keepOnlyDate(record.taxKV7TransferDate),
    taxKV7Staff: record.taxKV7Staff || null,
    taxNoticeDate: keepOnlyDate(record.taxNoticeDate),
    taxNoticeStaff: record.taxNoticeStaff || null,
    taxPaymentReceiptDate: keepOnlyDate(record.taxPaymentReceiptDate),
    printDate: keepOnlyDate(record.printDate),
    printStaff: record.printStaff || null,
    pendingCheckDate: keepOnlyDate(record.pendingCheckDate),
    checkedBy: record.checkedBy || null,
    submissionDate: keepOnlyDate(record.submissionDate),
    submittedTo: record.submittedTo || null,
    approvalDate: keepOnlyDate(record.approvalDate),
    completedDate: keepOnlyDate(record.completedDate),
    exportBatch: record.exportBatch || null,
    exportDate: keepOnlyDate(record.exportDate),
    handoverWard: record.handoverWard || null,
    deliveryDate: keepOnlyDate(record.deliveryDate),
    resultReturnedDate: keepOnlyDate(record.resultReturnedDate),
    receiptNumber: record.receiptNumber || null,
    invoiceNumber: record.invoiceNumber || null,
    receiptType: record.receiptType || null,
    receiverName: record.receiverName || null,
    feeAmount: record.feeAmount && !isNaN(Number(record.feeAmount)) ? Number(record.feeAmount) : 0,
    price: record.price && !isNaN(Number(record.price)) ? Number(record.price) : null,
    returnedPrice: record.returnedPrice && !isNaN(Number(record.returnedPrice)) ? Number(record.returnedPrice) : null,
    status: record.status || 'Tiếp nhận mới',
    statusLogs: Array.isArray(record.statusLogs) ? record.statusLogs : [],
    notes: record.notes || null,
    personalNotes: record.personalNotes || null,
    privateNotes: record.privateNotes || null,
    reminderDate: keepOnlyDate(record.reminderDate),
    otherDocs: record.otherDocs || null,
    attachedDocs: Array.isArray(record.attachedDocs) ? record.attachedDocs : [],
    attachedDocuments: Array.isArray(record.attachedDocuments) ? record.attachedDocuments : [],
    explanationPlan: record.explanationPlan || null,
    customerName: record.customerName || record.applicantName || null,
    phoneNumber: record.phoneNumber || record.applicantPhone || null,
    cccd: record.cccd || record.applicantCccd || null,
    customerAddress: record.customerAddress || record.applicantAddress || null,
    address: record.address || null,
    submitterName: record.submitterName || record.applicantName || null,
    submitterPhone: record.submitterPhone || record.applicantPhone || null,
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
  const index = allRecords.findIndex(r => r.id === record.id || (record.code && normalizeCode(r.code) === normalizeCode(record.code)));
  let updatedList: DangKyRecord[];

  const now = new Date().toISOString();
  const updatedRecord = { 
    ...record, 
    id: record.id || generateStandardId(),
    sourceTable: 'dangky_records' as const, 
    updatedAt: now 
  };

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
    const genIndex = generalCached.findIndex(r => r.id === updatedRecord.id || (updatedRecord.code && normalizeCode(r.code) === normalizeCode(updatedRecord.code)));
    if (genIndex >= 0) {
      generalCached[genIndex] = { ...generalCached[genIndex], ...updatedRecord };
    } else {
      generalCached.unshift(updatedRecord);
    }
    saveToCache(CACHE_KEYS.RECORDS, generalCached);
  } catch (e) {
    console.warn('Error syncing dangky record to general records cache:', e);
  }

  if (isConfigured) {
    try {
      const payload = mapDangKyToDb(updatedRecord);
      
      const { error } = await executeSupabaseOperationWithAutoClean(
        async (cleanPayload) => {
          return await supabase
            .from('dangky_records')
            .upsert(cleanPayload, { onConflict: 'code' });
        },
        payload
      );

      if (error) {
        // Fallback to land_records if dangky_records table doesn't exist
        if (error.code === '42P01' || error.code === 'PGRST205' || String(error.message || '').includes('schema cache')) {
          console.warn('Table dangky_records missing on Supabase, falling back to land_records...');
          await executeSupabaseOperationWithAutoClean(
            async (cleanPayload) => {
              return await supabase
                .from('land_records')
                .upsert(cleanPayload, { onConflict: 'code' });
            },
            payload
          );
        } else {
          logError('saveDangKyRecordApi Supabase', error, true);
        }
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

// Batch Import or Bulk Save DangKy Records (Tiếp nhận hàng loạt từ Excel)
export const saveDangKyRecordsBatchApi = async (
  recordsToSave: DangKyRecord[],
  onProgress?: (processed: number, total: number) => void
): Promise<boolean> => {
  if (!recordsToSave || recordsToSave.length === 0) return true;
  const allRecords = await fetchDangKyRecords();
  const existingMap = new Map<string, number>();
  
  allRecords.forEach((r, idx) => {
    if (r.id) existingMap.set(String(r.id).trim().toLowerCase(), idx);
    if (r.code) existingMap.set(normalizeCode(r.code), idx);
  });

  const now = new Date().toISOString();
  const updatedList = [...allRecords];

  for (const item of recordsToSave) {
    const keyId = item.id ? String(item.id).trim().toLowerCase() : '';
    const normCode = item.code ? normalizeCode(item.code) : '';
    const matchIdx = (keyId && existingMap.has(keyId)) 
      ? existingMap.get(keyId)! 
      : ((normCode && existingMap.has(normCode)) ? existingMap.get(normCode)! : -1);

    const recordWithTimestamp: DangKyRecord = {
      ...item,
      id: item.id || generateStandardId(),
      sourceTable: 'dangky_records',
      updatedAt: now,
      createdAt: item.createdAt || now
    };

    if (matchIdx >= 0) {
      updatedList[matchIdx] = { ...updatedList[matchIdx], ...recordWithTimestamp };
    } else {
      updatedList.unshift(recordWithTimestamp);
      if (keyId) existingMap.set(keyId, 0);
      if (normCode) existingMap.set(normCode, 0);
    }
  }

  saveToCache(CACHE_KEYS.DANGKY_RECORDS, updatedList);

  if (isConfigured) {
    try {
      const dbPayloads = recordsToSave.map(r => mapDangKyToDb({
        ...r,
        id: r.id || generateStandardId()
      }));

      // Batch upsert in chunks of 25 with auto-clean
      const chunkSize = 25;
      for (let i = 0; i < dbPayloads.length; i += chunkSize) {
        const chunk = dbPayloads.slice(i, i + chunkSize);
        
        const { error } = await executeSupabaseOperationWithAutoClean(
          async (cleanChunk) => {
            return await supabase
              .from('dangky_records')
              .upsert(cleanChunk, { onConflict: 'code' });
          },
          chunk
        );

        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST205') {
            await executeSupabaseOperationWithAutoClean(
              async (cleanChunk) => {
                return await supabase
                  .from('land_records')
                  .upsert(cleanChunk, { onConflict: 'code' });
              },
              chunk
            );
          } else {
            console.warn('Batch chunk upsert warning:', error);
          }
        }

        if (onProgress) {
          onProgress(Math.min(i + chunkSize, dbPayloads.length), dbPayloads.length);
        }
      }
    } catch (e) {
      logError('saveDangKyRecordsBatchApi catch', e, true);
    }
  }

  return true;
};

// Batch update status or field (Cập nhật hàng loạt / Xử lý All)
export const bulkUpdateDangKyRecordsApi = async (
  ids: string[],
  updates: Partial<DangKyRecord>,
  onProgress?: (processed: number, total: number) => void
): Promise<boolean> => {
  if (!ids || ids.length === 0) return true;
  const idSet = new Set(ids.map(x => String(x).trim().toLowerCase()));
  const allRecords = await fetchDangKyRecords();
  
  const matchedCodes: string[] = [];
  const matchedIds: string[] = [];
  
  const updatedList = allRecords.map(r => {
    const rId = String(r.id || '').trim().toLowerCase();
    const rCode = normalizeCode(r.code);
    if (idSet.has(rId) || idSet.has(rCode)) {
      if (r.id) matchedIds.push(r.id);
      if (r.code) matchedCodes.push(r.code);
      return { ...r, ...updates, updatedAt: new Date().toISOString() };
    }
    return r;
  });

  saveToCache(CACHE_KEYS.DANGKY_RECORDS, updatedList);

  if (isConfigured) {
    try {
      // Clean and sanitize dbUpdates
      const dbUpdates: any = {};
      Object.keys(updates).forEach(key => {
        const val = (updates as any)[key];
        if (
          key === 'receivedDate' || 
          key === 'deadline' || 
          key === 'appraisalDate' || 
          key === 'taxFormDate' || 
          key === 'taxKV7TransferDate' || 
          key === 'taxNoticeDate' || 
          key === 'taxPaymentReceiptDate' || 
          key === 'printDate' || 
          key === 'pendingCheckDate' || 
          key === 'submissionDate' || 
          key === 'approvalDate' || 
          key === 'completedDate' || 
          key === 'exportDate' || 
          key === 'deliveryDate' || 
          key === 'resultReturnedDate' || 
          key === 'reminderDate' || 
          key === 'issueDate'
        ) {
          dbUpdates[key] = keepOnlyDate(val);
        } else if (key === 'totalArea' || key === 'residentialArea' || key === 'feeAmount' || key === 'price' || key === 'returnedPrice') {
          dbUpdates[key] = val !== undefined && val !== null && !isNaN(Number(val)) ? Number(val) : null;
        } else if (key !== 'id') {
          dbUpdates[key] = val;
        }
      });
      dbUpdates.updatedAt = new Date().toISOString();

      const targetsToUpdateIds = matchedIds.length > 0 ? matchedIds : ids;

      // Update in chunks
      const chunkSize = 20;
      for (let i = 0; i < targetsToUpdateIds.length; i += chunkSize) {
        const chunkIds = targetsToUpdateIds.slice(i, i + chunkSize);
        
        const { error } = await executeSupabaseOperationWithAutoClean(
          async (cleanPayload) => {
            return await supabase
              .from('dangky_records')
              .update(cleanPayload)
              .in('id', chunkIds);
          },
          dbUpdates
        );

        if (error) {
          // If update by ID fails, attempt update by code
          if (matchedCodes.length > 0) {
            const chunkCodes = matchedCodes.slice(i, i + chunkSize);
            await executeSupabaseOperationWithAutoClean(
              async (cleanPayload) => {
                return await supabase
                  .from('dangky_records')
                  .update(cleanPayload)
                  .in('code', chunkCodes);
              },
              dbUpdates
            );
          }
          // Also fallback to land_records if table is missing
          if (error.code === '42P01' || error.code === 'PGRST205') {
            await executeSupabaseOperationWithAutoClean(
              async (cleanPayload) => {
                return await supabase
                  .from('land_records')
                  .update(cleanPayload)
                  .in('id', chunkIds);
              },
              dbUpdates
            );
          }
        }

        if (onProgress) {
          onProgress(Math.min(i + chunkSize, targetsToUpdateIds.length), targetsToUpdateIds.length);
        }
      }
    } catch (e) {
      logError('bulkUpdateDangKyRecordsApi catch', e, true);
    }
  }

  return true;
};

