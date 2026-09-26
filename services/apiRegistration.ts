import { supabase } from './supabaseClient';
import { RecordFile, RecordStatusLog, DossierComponentItem, AttachedFileMeta, RecordStatus } from '../types';
import { connectionManager } from './connectionService';
import { sanitizeData, isBlankRecord, keepOnlyDate, keepOnlyDateTime, sanitizePayloadForDateErrors, sanitizePayloadFor22P02 } from './apiCore';
import { getTargetTable, RECORD_DB_COLUMNS, DANGKY_RECORDS_DB_COLUMNS } from './apiRecords';
import { calculateRegistrationDeadline, addCalendarDays } from '../utils/registrationWorkflows';

const toNullableNumber = (val: any): number | null => {
  if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
};

/**
 * Service chuyên trách 100% độc lập cho bảng dangky_records (Tổ Đăng ký / Cấp giấy)
 * Đảm bảo cô lập hoàn toàn, không phụ thuộc hay can thiệp vào land_records.
 */

const TABLE_NAME = 'dangky_records';

/**
 * Chuyển đổi dữ liệu thô từ DB sang RecordFile
 */
export const mapDangkyRecordFromDb = (dbItem: any): RecordFile => {
  let statusLogs: RecordStatusLog[] = [];
  if (Array.isArray(dbItem.statusLogs)) {
    statusLogs = dbItem.statusLogs;
  } else if (typeof dbItem.statusLogs === 'string') {
    try {
      statusLogs = JSON.parse(dbItem.statusLogs);
    } catch {
      statusLogs = [];
    }
  }

  let dossierComponents: DossierComponentItem[] = [];
  if (Array.isArray(dbItem.dossierComponents)) {
    dossierComponents = dbItem.dossierComponents;
  } else if (typeof dbItem.dossierComponents === 'string') {
    try {
      dossierComponents = JSON.parse(dbItem.dossierComponents);
    } catch {
      dossierComponents = [];
    }
  }

  let attachedFiles: AttachedFileMeta[] = [];
  if (Array.isArray(dbItem.attachedFiles)) {
    attachedFiles = dbItem.attachedFiles;
  } else if (typeof dbItem.attachedFiles === 'string') {
    try {
      attachedFiles = JSON.parse(dbItem.attachedFiles);
    } catch {
      attachedFiles = [];
    }
  }

  return {
    id: dbItem.id,
    code: dbItem.code || '',
    customerName: dbItem.customerName || '',
    phoneNumber: dbItem.phoneNumber || '',
    cccd: dbItem.cccd || '',
    customerAddress: dbItem.customerAddress || '',
    ward: dbItem.ward || '',
    landPlot: dbItem.landPlot || '',
    mapSheet: dbItem.mapSheet || '',
    area: dbItem.area != null ? Number(dbItem.area) : 0,
    address: dbItem.address || '',
    group: dbItem.group || '3. Đăng ký đất đai, cấp GCN',
    recordType: dbItem.recordType || '',
    content: dbItem.content || '',
    issueNumber: dbItem.issueNumber || '',
    entryNumber: dbItem.entryNumber || '',
    issueDate: dbItem.issueDate || '',
    residentialArea: dbItem.residentialArea || 0,
    status: (dbItem.status as RecordStatus) || RecordStatus.RECEIVED,
    receivedBy: dbItem.receivedBy || '',
    receivedDate: dbItem.receivedDate || (dbItem.createdAt ? dbItem.createdAt.substring(0, 10) : ''),
    deadline: dbItem.deadline || '',
    assignedTo: dbItem.assignedTo || '',
    assignedDate: dbItem.assignedDate || '',
    checkedBy: dbItem.checkedBy || '',
    submissionDate: dbItem.submissionDate || '',
    approvalDate: dbItem.approvalDate || '',
    completedDate: dbItem.completedDate || '',
    price: dbItem.price != null ? Number(dbItem.price) : 0,
    advancePayment: dbItem.advancePayment != null ? Number(dbItem.advancePayment) : 0,
    notes: dbItem.notes || '',
    privateNotes: dbItem.privateNotes || '',
    personalNotes: dbItem.personalNotes || '',
    otherDocs: dbItem.otherDocs || '',
    authorizedBy: dbItem.authorizedBy || '',
    authDocType: dbItem.authDocType || '',
    submittedTo: dbItem.submittedTo || '',
    pendingCheckDate: dbItem.pendingCheckDate || '',
    checkedDate: dbItem.checkedDate || '',
    completedWorkDate: dbItem.completedWorkDate || '',
    receiptNumber: dbItem.receiptNumber || '',
    receiptType: dbItem.receiptType || '',
    receiverName: dbItem.receiverName || '',
    returnedBy: dbItem.returnedBy || '',
    resultReturnedDate: dbItem.resultReturnedDate || '',
    returnedPrice: dbItem.returnedPrice != null ? Number(dbItem.returnedPrice) : 0,
    isHandedOver: Boolean(dbItem.isHandedOver),
    archiveHandoverDate: dbItem.archiveHandoverDate || '',
    archiveHandoverBatch: dbItem.archiveHandoverBatch ? Number(dbItem.archiveHandoverBatch) : null,
    exportBatch: dbItem.exportBatch || '',
    exportDate: dbItem.exportDate || '',
    handoverWard: dbItem.handoverWard || '',
    returnBatch: dbItem.returnBatch != null ? Number(dbItem.returnBatch) : null,
    returnBatchDate: dbItem.returnBatchDate || '',
    returnHandoverDept: dbItem.returnHandoverDept || '',
    reminderDate: dbItem.reminderDate || '',
    lastRemindedAt: dbItem.lastRemindedAt || '',
    deadlineReminded: Boolean(dbItem.deadlineReminded),
    appraisalDate: dbItem.appraisalDate || '',
    postingDate: dbItem.postingDate || '',
    postingEndDate: dbItem.postingEndDate || '',
    taxTransferDate: dbItem.taxTransferDate || '',
    taxKv7Date: dbItem.taxKv7Date || '',
    taxPaymentDate: dbItem.taxPaymentDate || '',
    printCertDate: dbItem.printCertDate || '',
    pendingHandoverDate: dbItem.pendingHandoverDate || '',
    printStaffId: dbItem.printStaffId || dbItem.print_staff_id || '',
    print_staff_id: dbItem.printStaffId || dbItem.print_staff_id || '',
    printStaffAssignedAt: dbItem.printStaffAssignedAt || dbItem.print_staff_assigned_at || '',
    print_staff_assigned_at: dbItem.printStaffAssignedAt || dbItem.print_staff_assigned_at || '',
    printAssignmentStatus: dbItem.printAssignmentStatus || dbItem.print_assignment_status || null,
    print_assignment_status: dbItem.printAssignmentStatus || dbItem.print_assignment_status || null,
    printDeadlineStartAt: dbItem.printDeadlineStartAt || dbItem.print_deadline_start_at || '',
    print_deadline_start_at: dbItem.printDeadlineStartAt || dbItem.print_deadline_start_at || '',
    paymentReceivedAt: dbItem.paymentReceivedAt || dbItem.payment_received_at || '',
    payment_received_at: dbItem.paymentReceivedAt || dbItem.payment_received_at || '',
    paymentReceiptDate: dbItem.paymentReceiptDate || dbItem.payment_receipt_date || '',
    payment_receipt_date: dbItem.paymentReceiptDate || dbItem.payment_receipt_date || '',
    previousStatus: dbItem.previousStatus || dbItem.supplementReturnStatus || '',
    supplementReturnStatus: dbItem.supplementReturnStatus || dbItem.previousStatus || '',
    supplementReason: dbItem.supplementReason || dbItem.pendingSupplementReason || '',
    supplementRequestedBy: dbItem.supplementRequestedBy || '',
    supplementRequestedAt: dbItem.supplementRequestedAt || dbItem.supplementRequestDate || '',
    supplementStartedAt: dbItem.supplementStartedAt || dbItem.supplementRequestedAt || '',
    supplementCompletedBy: dbItem.supplementCompletedBy || dbItem.supplementConfirmedBy || '',
    supplementCompletedAt: dbItem.supplementCompletedAt || dbItem.supplementReturnedDate || '',
    statusLogs,
    dossierComponents,
    attachedFiles,
    data: dbItem.data || {},
    sourceTable: 'dangky_records',
  };
};

/**
 * Chuyển đổi RecordFile sang payload DB cho dangky_records
 */
export const mapDangkyRecordToDb = (record: Partial<RecordFile>): Record<string, any> => {
  const payload: Record<string, any> = {};

  if (record.id !== undefined) payload.id = record.id;
  if (record.code !== undefined) payload.code = String(record.code).trim();
  if (record.customerName !== undefined) payload.customerName = record.customerName;
  if (record.phoneNumber !== undefined) payload.phoneNumber = record.phoneNumber;
  if (record.cccd !== undefined) payload.cccd = record.cccd;
  if (record.customerAddress !== undefined) payload.customerAddress = record.customerAddress;
  if (record.ward !== undefined) payload.ward = record.ward;
  if (record.landPlot !== undefined) payload.landPlot = record.landPlot;
  if (record.mapSheet !== undefined) payload.mapSheet = record.mapSheet;
  if (record.area !== undefined) payload.area = toNullableNumber(record.area) ?? 0;
  if (record.address !== undefined) payload.address = record.address;
  if (record.group !== undefined) payload.group = record.group;
  if (record.recordType !== undefined) payload.recordType = record.recordType;
  if (record.content !== undefined) payload.content = record.content;
  if (record.issueNumber !== undefined) payload.issueNumber = record.issueNumber;
  if (record.entryNumber !== undefined) payload.entryNumber = record.entryNumber;
  if (record.issueDate !== undefined) payload.issueDate = keepOnlyDate(record.issueDate);
  if (record.residentialArea !== undefined) payload.residentialArea = toNullableNumber(record.residentialArea);
  if (record.status !== undefined) payload.status = record.status;
  if (record.data !== undefined) payload.data = record.data;
  if (record.receivedBy !== undefined) payload.receivedBy = record.receivedBy;
  if (record.receivedDate !== undefined) payload.receivedDate = keepOnlyDate(record.receivedDate);
  if (record.deadline !== undefined) {
    payload.deadline = keepOnlyDate(record.deadline);
  } else if (record.receivedDate) {
    const calc = calculateRegistrationDeadline(record as RecordFile);
    if (calc.deadline) {
      payload.deadline = keepOnlyDate(calc.deadline);
    }
  }
  if (record.assignedTo !== undefined) payload.assignedTo = record.assignedTo;
  if (record.assignedDate !== undefined) payload.assignedDate = keepOnlyDate(record.assignedDate);
  if (record.checkedBy !== undefined) payload.checkedBy = record.checkedBy;
  if (record.submissionDate !== undefined) payload.submissionDate = keepOnlyDate(record.submissionDate);
  if (record.approvalDate !== undefined) payload.approvalDate = keepOnlyDate(record.approvalDate);
  if (record.completedDate !== undefined) payload.completedDate = keepOnlyDate(record.completedDate);
  if (record.price !== undefined) payload.price = toNullableNumber(record.price) ?? 0;
  if (record.advancePayment !== undefined) payload.advancePayment = toNullableNumber(record.advancePayment) ?? 0;
  if (record.notes !== undefined) payload.notes = record.notes;
  if (record.privateNotes !== undefined) payload.privateNotes = record.privateNotes;
  if (record.personalNotes !== undefined) payload.personalNotes = record.personalNotes;
  if (record.otherDocs !== undefined) payload.otherDocs = record.otherDocs;
  if (record.authorizedBy !== undefined) payload.authorizedBy = record.authorizedBy;
  if (record.authDocType !== undefined) payload.authDocType = record.authDocType;
  if (record.submittedTo !== undefined) payload.submittedTo = record.submittedTo;
  if (record.pendingCheckDate !== undefined) payload.pendingCheckDate = keepOnlyDate(record.pendingCheckDate);
  if (record.checkedDate !== undefined) payload.checkedDate = keepOnlyDate(record.checkedDate);
  if (record.completedWorkDate !== undefined) payload.completedWorkDate = keepOnlyDate(record.completedWorkDate);
  if (record.receiptNumber !== undefined) payload.receiptNumber = record.receiptNumber;
  if (record.receiptType !== undefined) payload.receiptType = record.receiptType;
  if (record.receiverName !== undefined) payload.receiverName = record.receiverName;
  if (record.returnedBy !== undefined) payload.returnedBy = record.returnedBy;
  if (record.resultReturnedDate !== undefined) payload.resultReturnedDate = keepOnlyDate(record.resultReturnedDate);
  if (record.returnedPrice !== undefined) payload.returnedPrice = toNullableNumber(record.returnedPrice) ?? 0;
  if (record.isHandedOver !== undefined) payload.isHandedOver = Boolean(record.isHandedOver);
  if (record.archiveHandoverDate !== undefined) payload.archiveHandoverDate = keepOnlyDate(record.archiveHandoverDate);
  if (record.archiveHandoverBatch !== undefined) payload.archiveHandoverBatch = toNullableNumber(record.archiveHandoverBatch);
  if (record.exportBatch !== undefined) payload.exportBatch = record.exportBatch;
  if (record.exportDate !== undefined) payload.exportDate = keepOnlyDate(record.exportDate);
  if (record.handoverWard !== undefined) payload.handoverWard = record.handoverWard;
  if (record.returnBatch !== undefined) payload.returnBatch = toNullableNumber(record.returnBatch);
  if (record.returnBatchDate !== undefined) payload.returnBatchDate = keepOnlyDate(record.returnBatchDate);
  if (record.returnHandoverDept !== undefined) payload.returnHandoverDept = record.returnHandoverDept;
  if (record.reminderDate !== undefined) payload.reminderDate = keepOnlyDateTime(record.reminderDate);
  if (record.lastRemindedAt !== undefined) payload.lastRemindedAt = keepOnlyDateTime(record.lastRemindedAt);
  if (record.deadlineReminded !== undefined) payload.deadlineReminded = Boolean(record.deadlineReminded);
  if (record.appraisalDate !== undefined) payload.appraisalDate = keepOnlyDate(record.appraisalDate);
  if (record.postingDate !== undefined) {
    payload.postingDate = keepOnlyDate(record.postingDate);
    if (payload.postingDate && !record.postingEndDate) {
      payload.postingEndDate = keepOnlyDate(addCalendarDays(payload.postingDate, 30));
    }
  }
  if (record.postingEndDate !== undefined && payload.postingEndDate === undefined) {
    payload.postingEndDate = keepOnlyDate(record.postingEndDate);
  }
  if (record.taxTransferDate !== undefined) payload.taxTransferDate = keepOnlyDate(record.taxTransferDate);
  if (record.taxKv7Date !== undefined) payload.taxKv7Date = keepOnlyDate(record.taxKv7Date);
  if (record.taxPaymentDate !== undefined) payload.taxPaymentDate = keepOnlyDate(record.taxPaymentDate);
  if (record.printCertDate !== undefined) payload.printCertDate = keepOnlyDate(record.printCertDate);
  if (record.pendingHandoverDate !== undefined) payload.pendingHandoverDate = keepOnlyDate(record.pendingHandoverDate);
  if (record.printStaffId !== undefined || (record as any).print_staff_id !== undefined) {
    payload.printStaffId = record.printStaffId || (record as any).print_staff_id || null;
  }
  if (record.printStaffAssignedAt !== undefined || (record as any).print_staff_assigned_at !== undefined) {
    payload.printStaffAssignedAt = keepOnlyDateTime(record.printStaffAssignedAt || (record as any).print_staff_assigned_at);
  }
  if (record.printAssignmentStatus !== undefined || (record as any).print_assignment_status !== undefined) {
    payload.printAssignmentStatus = record.printAssignmentStatus || (record as any).print_assignment_status || null;
  }
  if (record.printDeadlineStartAt !== undefined || (record as any).print_deadline_start_at !== undefined) {
    payload.printDeadlineStartAt = keepOnlyDateTime(record.printDeadlineStartAt || (record as any).print_deadline_start_at);
  }
  if (record.paymentReceivedAt !== undefined || (record as any).payment_received_at !== undefined) {
    payload.paymentReceivedAt = keepOnlyDateTime(record.paymentReceivedAt || (record as any).payment_received_at);
  }
  if (record.paymentReceiptDate !== undefined || (record as any).payment_receipt_date !== undefined) {
    payload.paymentReceiptDate = keepOnlyDate(record.paymentReceiptDate || (record as any).payment_receipt_date);
  }
  if (record.previousStatus !== undefined) payload.previousStatus = record.previousStatus;
  if (record.supplementReturnStatus !== undefined) payload.supplementReturnStatus = record.supplementReturnStatus;
  if (record.supplementReason !== undefined) payload.supplementReason = record.supplementReason;
  if (record.supplementRequestedBy !== undefined) payload.supplementRequestedBy = record.supplementRequestedBy;
  if (record.supplementRequestedAt !== undefined || (record as any).supplementRequestDate !== undefined) {
    payload.supplementRequestedAt = keepOnlyDateTime(record.supplementRequestedAt || (record as any).supplementRequestDate);
  }
  if (record.supplementStartedAt !== undefined) {
    payload.supplementStartedAt = keepOnlyDateTime(record.supplementStartedAt);
  }
  if (record.supplementCompletedBy !== undefined) payload.supplementCompletedBy = record.supplementCompletedBy;
  if (record.supplementCompletedAt !== undefined || (record as any).supplementReturnedDate !== undefined) {
    payload.supplementCompletedAt = keepOnlyDateTime(record.supplementCompletedAt || (record as any).supplementReturnedDate);
  }

  if (record.statusLogs !== undefined) payload.statusLogs = record.statusLogs;
  if (record.dossierComponents !== undefined) payload.dossierComponents = record.dossierComponents;
  if (record.attachedFiles !== undefined) payload.attachedFiles = record.attachedFiles;

  payload.updatedAt = new Date().toISOString();
  return sanitizePayloadForDateErrors(payload);
};

/**
 * Lấy toàn bộ danh sách hồ sơ Đăng ký từ bảng dangky_records
 */
export const fetchDangkyRecords = async (): Promise<RecordFile[]> => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        console.warn(`[DangKy API] Bảng ${TABLE_NAME} chưa được tạo.`, error);
        return [];
      }
      throw error;
    }

    const mapped = (data || []).map(mapDangkyRecordFromDb);

    // Kiểm tra log nếu có hồ sơ bị phân nhầm bảng (giữ nguyên READ ONLY, không tự động di chuyển)
    const misplacedForLuutru = mapped.filter(r => getTargetTable(r) === 'luutru_records');
    const misplacedForLand = mapped.filter(r => getTargetTable(r) === 'land_records');
    const blankRecords = mapped.filter(r => isBlankRecord(r));

    if (misplacedForLuutru.length > 0 || misplacedForLand.length > 0) {
      console.warn(`[DangKy API Warning] Phát hiện ${misplacedForLuutru.length} hồ sơ Lưu trữ và ${misplacedForLand.length} hồ sơ Đo đạc nằm trong bảng dangky_records. Giữ nguyên dữ liệu, không tự động di chuyển.`);
    }

    const blankIds = new Set(blankRecords.map(r => r.id).filter(Boolean));
    return mapped.filter(r => !blankIds.has(r.id));
  } catch (err) {
    console.error(`[DangKy API] Lỗi khi tải danh sách hồ sơ:`, err);
    connectionManager.reportNetworkError('fetchDangkyRecords', err);
    return [];
  }
};

/**
 * Lấy một hồ sơ Đăng ký theo ID
 */
export const getDangkyRecordById = async (id: string): Promise<RecordFile | null> => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return mapDangkyRecordFromDb(data);
  } catch (err) {
    console.error(`[DangKy API] Lỗi khi lấy hồ sơ ${id}:`, err);
    return null;
  }
};

/**
 * Thêm một hồ sơ Đăng ký mới vào bảng dangky_records
 */
export const addDangkyRecord = async (record: RecordFile): Promise<RecordFile> => {
  let payload = mapDangkyRecordToDb(record);
  if (!payload.createdAt) {
    payload.createdAt = new Date().toISOString();
  }
  payload = sanitizeData(payload, DANGKY_RECORDS_DB_COLUMNS);
  payload = sanitizePayloadFor22P02(payload);
  payload = sanitizePayloadForDateErrors(payload);

  let { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([payload])
    .select()
    .single();

  if (error) {
    if (
      error.code === '22P02' ||
      String(error.message || '').toLowerCase().includes('22p02') ||
      String(error.message || '').toLowerCase().includes('invalid input syntax')
    ) {
      console.warn(`[DangKy API] Phát hiện lỗi 22P02 kiểu dữ liệu khi thêm (${error.message}). Đang làm sạch và thử lại...`);
      payload = sanitizePayloadFor22P02(payload);
      const retryRes = await supabase
        .from(TABLE_NAME)
        .insert([payload])
        .select()
        .single();
      if (!retryRes.error && retryRes.data) {
        return mapDangkyRecordFromDb(retryRes.data);
      }
      error = retryRes.error || error;
    } else if (
      error.code === '22007' ||
      error.code === '22008' ||
      String(error.message || '').toLowerCase().includes('timestamp') ||
      String(error.message || '').toLowerCase().includes('date')
    ) {
      console.warn(`[DangKy API] Phát hiện lỗi định dạng ngày tháng khi thêm (${error.message}). Đang tự động làm sạch và thử lại...`);
      payload = sanitizePayloadForDateErrors(payload);
      const retryRes = await supabase
        .from(TABLE_NAME)
        .insert([payload])
        .select()
        .single();
      if (!retryRes.error && retryRes.data) {
        return mapDangkyRecordFromDb(retryRes.data);
      }
      error = retryRes.error || error;
    }
    console.error(`[DangKy API] Lỗi khi thêm hồ sơ:`, error);
    connectionManager.reportNetworkError('addDangkyRecord', error);
    throw error;
  }

  return mapDangkyRecordFromDb(data);
};

/**
 * Cập nhật hồ sơ Đăng ký trong bảng dangky_records
 */
export const updateDangkyRecord = async (record: RecordFile): Promise<RecordFile> => {
  let payload = mapDangkyRecordToDb(record);
  payload = sanitizeData(payload, DANGKY_RECORDS_DB_COLUMNS);
  payload = sanitizePayloadFor22P02(payload);
  payload = sanitizePayloadForDateErrors(payload);

  let { data, error } = await supabase
    .from(TABLE_NAME)
    .update(payload)
    .eq('id', record.id)
    .select()
    .single();

  if (error) {
    if (
      error.code === '22P02' ||
      String(error.message || '').toLowerCase().includes('22p02') ||
      String(error.message || '').toLowerCase().includes('invalid input syntax')
    ) {
      console.warn(`[DangKy API] Phát hiện lỗi 22P02 kiểu dữ liệu khi cập nhật (${error.message}). Đang làm sạch và thử lại...`);
      payload = sanitizePayloadFor22P02(payload);
      const retryRes = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq('id', record.id)
        .select()
        .single();
      if (!retryRes.error && retryRes.data) {
        return mapDangkyRecordFromDb(retryRes.data);
      }
      error = retryRes.error || error;
    } else if (
      error.code === '22007' ||
      error.code === '22008' ||
      String(error.message || '').toLowerCase().includes('timestamp') ||
      String(error.message || '').toLowerCase().includes('date')
    ) {
      console.warn(`[DangKy API] Phát hiện lỗi định dạng ngày tháng khi cập nhật (${error.message}). Đang tự động làm sạch và thử lại...`);
      payload = sanitizePayloadForDateErrors(payload);
      const retryRes = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq('id', record.id)
        .select()
        .single();
      if (!retryRes.error && retryRes.data) {
        return mapDangkyRecordFromDb(retryRes.data);
      }
      error = retryRes.error || error;
    }
    console.error(`[DangKy API] Lỗi khi cập nhật hồ sơ:`, error);
    connectionManager.reportNetworkError('updateDangkyRecord', error);
    throw error;
  }

  return mapDangkyRecordFromDb(data);
};

/**
 * Cập nhật một phần các trường (Partial Update)
 */
export const updateDangkyRecordFields = async (
  id: string,
  fields: Partial<RecordFile>
): Promise<void> => {
  let payload = mapDangkyRecordToDb(fields);
  payload = sanitizeData(payload, DANGKY_RECORDS_DB_COLUMNS);
  payload = sanitizePayloadFor22P02(payload);
  payload = sanitizePayloadForDateErrors(payload);

  let { error } = await supabase
    .from(TABLE_NAME)
    .update(payload)
    .eq('id', id);

  if (error) {
    if (
      error.code === '22P02' ||
      String(error.message || '').toLowerCase().includes('22p02') ||
      String(error.message || '').toLowerCase().includes('invalid input syntax')
    ) {
      console.warn(`[DangKy API] Phát hiện lỗi 22P02 kiểu dữ liệu khi cập nhật trường (${error.message}). Đang làm sạch và thử lại...`);
      payload = sanitizePayloadFor22P02(payload);
      const retryRes = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq('id', id);
      if (!retryRes.error) {
        return;
      }
      error = retryRes.error || error;
    } else if (
      error.code === '22007' ||
      error.code === '22008' ||
      String(error.message || '').toLowerCase().includes('timestamp') ||
      String(error.message || '').toLowerCase().includes('date')
    ) {
      console.warn(`[DangKy API] Phát hiện lỗi định dạng ngày tháng khi cập nhật trường (${error.message}). Đang tự động làm sạch và thử lại...`);
      payload = sanitizePayloadForDateErrors(payload);
      const retryRes = await supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq('id', id);
      if (!retryRes.error) {
        return;
      }
      error = retryRes.error || error;
    }
    console.error(`[DangKy API] Lỗi khi cập nhật trường hồ sơ ${id}:`, error);
    connectionManager.reportNetworkError('updateDangkyRecordFields', error);
    throw error;
  }
};

/**
 * Xóa một hồ sơ Đăng ký
 */
export const deleteDangkyRecord = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (error) {
    console.error(`[DangKy API] Lỗi khi xóa hồ sơ ${id}:`, error);
    connectionManager.reportNetworkError('deleteDangkyRecord', error);
    throw error;
  }
};

/**
 * Xóa hàng loạt hồ sơ Đăng ký
 */
export const deleteBulkDangkyRecords = async (ids: string[]): Promise<void> => {
  if (!ids || ids.length === 0) return;

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .in('id', ids);

  if (error) {
    console.error(`[DangKy API] Lỗi khi xóa hàng loạt:`, error);
    connectionManager.reportNetworkError('deleteBulkDangkyRecords', error);
    throw error;
  }
};

/**
 * Phân công cán bộ xử lý hàng loạt cho Đăng ký
 */
export const assignDangkyRecordsBatch = async (
  recordIds: string[],
  assignedTo: string,
  assignedDate: string,
  assignStep: 'appraisal' | 'tax_transfer' = 'appraisal'
): Promise<void> => {
  if (!recordIds || recordIds.length === 0) return;

  const targetStatus = assignStep === 'tax_transfer' ? RecordStatus.TAX_TRANSFER : RecordStatus.APPRAISAL;
  const updateData: any = {
    assignedTo,
    assignedDate,
    status: targetStatus,
    updatedAt: new Date().toISOString(),
  };

  if (assignStep === 'appraisal') {
    updateData.appraisalDate = assignedDate;
  } else if (assignStep === 'tax_transfer') {
    updateData.taxTransferDate = assignedDate;
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .update(updateData)
    .in('id', recordIds);

  if (error) {
    console.error(`[DangKy API] Lỗi khi phân công hàng loạt:`, error);
    connectionManager.reportNetworkError('assignDangkyRecordsBatch', error);
    throw error;
  }
};

/**
 * Giao trước Cán bộ In GCN khi hồ sơ đang ở Chờ thuế khu vực 7 (TC01)
 * Lưu printStaffId, printStaffAssignedAt, printAssignmentStatus='PRE_ASSIGNED'
 * Không kích hoạt deadline In GCN (printDeadlineStartAt là null)
 * Status giữ nguyên PENDING_TAX_KV7
 */
export const preAssignPrintStaffInDb = async (
  recordsOrIds: (RecordFile | string)[],
  printStaffId: string,
  currentUser?: string | { id?: string; name?: string; username?: string; employeeId?: string }
): Promise<{ success: boolean; updatedCount: number; error?: string; records: RecordFile[] }> => {
  if (!recordsOrIds || recordsOrIds.length === 0) return { success: true, updatedCount: 0, records: [] };
  const now = new Date().toISOString();
  const userName = typeof currentUser === 'string' ? currentUser : (currentUser?.name || currentUser?.username || 'Cán bộ quản lý');
  const updatedRecords: RecordFile[] = [];

  try {
    for (const item of recordsOrIds) {
      let record: RecordFile | null = typeof item === 'string' ? await getDangkyRecordById(item) : item;
      if (!record) continue;

      const existingLogs = Array.isArray(record.statusLogs) ? [...record.statusLogs] : [];
      const newLog: RecordStatusLog = {
        id: crypto.randomUUID?.() || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        recordId: record.id,
        previousStatus: record.status,
        newStatus: record.status,
        changedBy: userName,
        changedAt: now,
        note: `Giao trước cán bộ In GCN: ${printStaffId}`,
      };

      const updatedRecord: RecordFile = {
        ...record,
        printStaffId,
        print_staff_id: printStaffId,
        printStaffAssignedAt: now,
        print_staff_assigned_at: now,
        printAssignmentStatus: 'PRE_ASSIGNED',
        print_assignment_status: 'PRE_ASSIGNED',
        // printDeadlineStartAt remains unchanged/null
        statusLogs: [...existingLogs, newLog],
        updatedAt: now,
      };

      await updateDangkyRecord(updatedRecord);
      updatedRecords.push(updatedRecord);
    }

    return { success: true, updatedCount: updatedRecords.length, records: updatedRecords };
  } catch (err: any) {
    console.error('preAssignPrintStaffInDb error:', err);
    return { success: false, updatedCount: 0, error: err?.message || 'Lỗi giao trước cán bộ in', records: [] };
  }
};

/**
 * Một cửa bấm Xác nhận đã có Giấy nộp tiền (GNT) (TC02, TC03, TC05)
 * - paymentReceivedAt = now
 * - printDeadlineStartAt = paymentReceivedAt
 * - Nếu đã có printStaffId: tự động chuyển PENDING_PRINT_CERT, assignedTo = printStaffId, printAssignmentStatus = 'READY_FOR_PRINT'
 * - Nếu chưa có printStaffId: printAssignmentStatus = 'WAITING_ASSIGNMENT', giữ status PENDING_TAX_PAYMENT (Chờ giao In GCN)
 */
export const confirmPaymentReceiptInDb = async (
  recordsOrIds: (RecordFile | string)[],
  receiptData: { receiptDate?: string; receiptNumber?: string; note?: string },
  currentUser?: string | { id?: string; name?: string; username?: string; employeeId?: string }
): Promise<{ success: boolean; updatedCount: number; error?: string; records: RecordFile[] }> => {
  if (!recordsOrIds || recordsOrIds.length === 0) return { success: true, updatedCount: 0, records: [] };
  const now = new Date().toISOString();
  const todayStr = receiptData.receiptDate || now.split('T')[0];
  const userName = typeof currentUser === 'string' ? currentUser : (currentUser?.name || currentUser?.username || 'Bộ phận Một cửa');
  const updatedRecords: RecordFile[] = [];

  try {
    for (const item of recordsOrIds) {
      let record: RecordFile | null = typeof item === 'string' ? await getDangkyRecordById(item) : item;
      if (!record) continue;

      // TC05 Idempotency check: Nếu đã xác nhận GNT trước đó thì không ghi đè hoặc tạo log trùng
      if (record.paymentReceivedAt) {
        console.warn(`[DangKy API] Hồ sơ ${record.code} đã được xác nhận GNT vào lúc ${record.paymentReceivedAt}, bỏ qua cập nhật trùng.`);
        updatedRecords.push(record);
        continue;
      }

      const existingLogs = Array.isArray(record.statusLogs) ? [...record.statusLogs] : [];
      const printStaff = record.printStaffId || record.print_staff_id;
      const hasPreAssigned = Boolean(printStaff && printStaff.trim() !== '');

      const paymentLog: RecordStatusLog = {
        id: crypto.randomUUID?.() || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        recordId: record.id,
        previousStatus: record.status,
        newStatus: hasPreAssigned ? RecordStatus.PENDING_PRINT_CERT : record.status,
        changedBy: userName,
        changedAt: now,
        note: `Một cửa xác nhận đã có Giấy nộp tiền (GNT)${receiptData.receiptNumber ? ` - Số BL: ${receiptData.receiptNumber}` : ''}${receiptData.note ? ` - ${receiptData.note}` : ''}`,
      };

      const logsToAdd: RecordStatusLog[] = [paymentLog];

      let newStatus = record.status;
      let newAssignedTo = record.assignedTo;
      let newPrintAssignmentStatus = 'WAITING_ASSIGNMENT';
      let newPrintCertDate = record.printCertDate;

      if (hasPreAssigned) {
        // TC02: Tự động kích hoạt In GCN cho cán bộ đã giao trước
        newStatus = RecordStatus.PENDING_PRINT_CERT;
        newAssignedTo = printStaff;
        newPrintAssignmentStatus = 'READY_FOR_PRINT';
        newPrintCertDate = todayStr;

        logsToAdd.push({
          id: crypto.randomUUID?.() || `log_${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
          recordId: record.id,
          previousStatus: record.status,
          newStatus: RecordStatus.PENDING_PRINT_CERT,
          changedBy: 'Hệ thống (Tự động kích hoạt)',
          changedAt: now,
          note: `Tự động chuyển tiếp vào Tab In GCN cho cán bộ đã giao trước: ${printStaff}`,
        });
      }

      const updatedRecord: RecordFile = {
        ...record,
        paymentReceivedAt: now,
        payment_received_at: now,
        taxPaymentDate: todayStr,
        paymentReceiptDate: todayStr,
        payment_receipt_date: todayStr,
        receiptNumber: receiptData.receiptNumber || record.receiptNumber || '',
        printDeadlineStartAt: now, // Bắt buộc: print_deadline_start_at = payment_received_at
        print_deadline_start_at: now,
        status: newStatus,
        assignedTo: newAssignedTo,
        printAssignmentStatus: newPrintAssignmentStatus,
        print_assignment_status: newPrintAssignmentStatus,
        printCertDate: newPrintCertDate,
        statusLogs: [...existingLogs, ...logsToAdd],
        updatedAt: now,
      };

      await updateDangkyRecord(updatedRecord);
      updatedRecords.push(updatedRecord);
    }

    return { success: true, updatedCount: updatedRecords.length, records: updatedRecords };
  } catch (err: any) {
    console.error('confirmPaymentReceiptInDb error:', err);
    return { success: false, updatedCount: 0, error: err?.message || 'Lỗi xác nhận Giấy nộp tiền', records: [] };
  }
};

/**
 * Lãnh đạo giao Cán bộ In GCN sau khi đã có GNT (TC04) hoặc cho hồ sơ không thuế (TC09)
 * - Mốc printDeadlineStartAt được giữ nguyên là paymentReceivedAt nếu có GNT, hoặc tính từ lúc giao việc nếu không thuế
 */
export const assignPrintStaffInDb = async (
  recordsOrIds: (RecordFile | string)[],
  staffId: string,
  currentUser?: string | { id?: string; name?: string; username?: string; employeeId?: string }
): Promise<{ success: boolean; updatedCount: number; error?: string; records: RecordFile[] }> => {
  if (!recordsOrIds || recordsOrIds.length === 0) return { success: true, updatedCount: 0, records: [] };
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];
  const userName = typeof currentUser === 'string' ? currentUser : (currentUser?.name || currentUser?.username || 'Lãnh đạo phê duyệt');
  const updatedRecords: RecordFile[] = [];

  try {
    for (const item of recordsOrIds) {
      let record: RecordFile | null = typeof item === 'string' ? await getDangkyRecordById(item) : item;
      if (!record) continue;

      const existingLogs = Array.isArray(record.statusLogs) ? [...record.statusLogs] : [];
      const deadlineStart = record.paymentReceivedAt || record.printDeadlineStartAt || now;

      const newLog: RecordStatusLog = {
        id: crypto.randomUUID?.() || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        recordId: record.id,
        previousStatus: record.status,
        newStatus: RecordStatus.PENDING_PRINT_CERT,
        changedBy: userName,
        changedAt: now,
        note: `Giao cán bộ In GCN: ${staffId}`,
      };

      const updatedRecord: RecordFile = {
        ...record,
        printStaffId: staffId,
        print_staff_id: staffId,
        printStaffAssignedAt: now,
        print_staff_assigned_at: now,
        assignedTo: staffId,
        status: RecordStatus.PENDING_PRINT_CERT,
        printAssignmentStatus: 'READY_FOR_PRINT',
        print_assignment_status: 'READY_FOR_PRINT',
        printCertDate: todayStr,
        printDeadlineStartAt: deadlineStart,
        print_deadline_start_at: deadlineStart,
        statusLogs: [...existingLogs, newLog],
        updatedAt: now,
      };

      await updateDangkyRecord(updatedRecord);
      updatedRecords.push(updatedRecord);
    }

    return { success: true, updatedCount: updatedRecords.length, records: updatedRecords };
  } catch (err: any) {
    console.error('assignPrintStaffInDb error:', err);
    return { success: false, updatedCount: 0, error: err?.message || 'Lỗi giao cán bộ in GCN', records: [] };
  }
};

/**
 * Giao niêm yết cho thủ tục Cấp lại do mất (TC10)
 * Ghi nhận postingDate, postingEndDate (30 ngày), status = PENDING_POSTING
 */
export const handoverPostingInDb = async (
  recordsOrIds: (RecordFile | string)[],
  staffId: string,
  currentUser?: string | { id?: string; name?: string; username?: string; employeeId?: string }
): Promise<{ success: boolean; updatedCount: number; error?: string; records: RecordFile[] }> => {
  if (!recordsOrIds || recordsOrIds.length === 0) return { success: true, updatedCount: 0, records: [] };
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];
  const userName = typeof currentUser === 'string' ? currentUser : (currentUser?.name || currentUser?.username || 'Lãnh đạo phê duyệt');
  const updatedRecords: RecordFile[] = [];

  try {
    for (const item of recordsOrIds) {
      let record: RecordFile | null = typeof item === 'string' ? await getDangkyRecordById(item) : item;
      if (!record) continue;

      const existingLogs = Array.isArray(record.statusLogs) ? [...record.statusLogs] : [];
      const newLog: RecordStatusLog = {
        id: crypto.randomUUID?.() || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        recordId: record.id,
        previousStatus: record.status,
        newStatus: RecordStatus.PENDING_POSTING,
        changedBy: userName,
        changedAt: now,
        note: `Giao niêm yết (công văn gửi xã/phường 30 ngày) cho cán bộ: ${staffId}`,
      };

      const updatedRecord: RecordFile = {
        ...record,
        assignedTo: staffId,
        status: RecordStatus.PENDING_POSTING,
        postingDate: todayStr,
        postingEndDate: addCalendarDays(todayStr, 30),
        statusLogs: [...existingLogs, newLog],
        updatedAt: now,
      };

      await updateDangkyRecord(updatedRecord);
      updatedRecords.push(updatedRecord);
    }

    return { success: true, updatedCount: updatedRecords.length, records: updatedRecords };
  } catch (err: any) {
    console.error('handoverPostingInDb error:', err);
    return { success: false, updatedCount: 0, error: err?.message || 'Lỗi giao niêm yết', records: [] };
  }
};

/**
 * Giao chuyển thuế cho thủ tục có phát sinh nghĩa vụ tài chính
 */
export const handoverTaxInDb = async (
  recordsOrIds: (RecordFile | string)[],
  staffId: string,
  currentUser?: string | { id?: string; name?: string; username?: string; employeeId?: string }
): Promise<{ success: boolean; updatedCount: number; error?: string; records: RecordFile[] }> => {
  if (!recordsOrIds || recordsOrIds.length === 0) return { success: true, updatedCount: 0, records: [] };
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];
  const userName = typeof currentUser === 'string' ? currentUser : (currentUser?.name || currentUser?.username || 'Lãnh đạo phê duyệt');
  const updatedRecords: RecordFile[] = [];

  try {
    for (const item of recordsOrIds) {
      let record: RecordFile | null = typeof item === 'string' ? await getDangkyRecordById(item) : item;
      if (!record && typeof item === 'string') {
        try {
          const { data } = await supabase.from('land_records').select('*').eq('id', item).single();
          if (data) record = mapDangkyRecordFromDb(data);
        } catch (_) {}
      }
      if (!record) continue;

      const existingLogs = Array.isArray(record.statusLogs) ? [...record.statusLogs] : [];
      const newLog: RecordStatusLog = {
        id: crypto.randomUUID?.() || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        recordId: record.id,
        previousStatus: record.status,
        newStatus: RecordStatus.TAX_TRANSFER,
        changedBy: userName,
        changedAt: now,
        note: `Giao lập phiếu chuyển thông tin nghĩa vụ tài chính cho cán bộ: ${staffId}`,
      };

      const updatedRecord: RecordFile = {
        ...record,
        assignedTo: staffId,
        assignedDate: todayStr,
        status: RecordStatus.TAX_TRANSFER,
        taxTransferDate: todayStr,
        statusLogs: [...existingLogs, newLog],
        updatedAt: now,
      };

      try {
        await updateDangkyRecord(updatedRecord);
      } catch (_) {
        await supabase.from('land_records').update({
          assigned_to: staffId,
          assigned_date: todayStr,
          status: RecordStatus.TAX_TRANSFER,
          tax_transfer_date: todayStr,
          status_logs: updatedRecord.statusLogs,
          updated_at: now,
        }).eq('id', record.id);
      }

      updatedRecords.push(updatedRecord);
    }

    return { success: true, updatedCount: updatedRecords.length, records: updatedRecords };
  } catch (err: any) {
    console.error('handoverTaxInDb error:', err);
    return { success: false, updatedCount: 0, error: err?.message || 'Lỗi giao chuyển thuế', records: [] };
  }
};

/**
 * Chuyển trạng thái trong Tab Thuế (Chờ chuyển thuế -> Chờ KV7 -> Chờ giấy nộp tiền)
 */
export const advanceTaxStatusInDb = async (
  recordsOrIds: (RecordFile | string)[],
  targetStatus: RecordStatus.PENDING_TAX_KV7 | RecordStatus.PENDING_TAX_PAYMENT,
  currentUser?: string | { id?: string; name?: string; username?: string; employeeId?: string }
): Promise<{ success: boolean; updatedCount: number; error?: string; records: RecordFile[] }> => {
  if (!recordsOrIds || recordsOrIds.length === 0) return { success: true, updatedCount: 0, records: [] };
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];
  const userName = typeof currentUser === 'string' ? currentUser : (currentUser?.name || currentUser?.username || 'Cán bộ xử lý thuế');
  const updatedRecords: RecordFile[] = [];

  try {
    for (const item of recordsOrIds) {
      let record: RecordFile | null = typeof item === 'string' ? await getDangkyRecordById(item) : item;
      if (!record) continue;

      const existingLogs = Array.isArray(record.statusLogs) ? [...record.statusLogs] : [];
      const isToKv7 = targetStatus === RecordStatus.PENDING_TAX_KV7;
      const noteText = isToKv7 
        ? 'Đã chuyển hồ sơ sang Thuế khu vực 7 tiếp nhận và tính thuế' 
        : 'Đã nhận thông báo thuế từ Thuế KV7, chuyển sang chờ công dân nộp tiền (GNT)';

      const newLog: RecordStatusLog = {
        id: crypto.randomUUID?.() || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        recordId: record.id,
        previousStatus: record.status,
        newStatus: targetStatus,
        changedBy: userName,
        changedAt: now,
        note: noteText,
      };

      const updatedRecord: RecordFile = {
        ...record,
        status: targetStatus,
        taxKv7Date: isToKv7 ? todayStr : record.taxKv7Date,
        statusLogs: [...existingLogs, newLog],
        updatedAt: now,
      };

      await updateDangkyRecord(updatedRecord);
      updatedRecords.push(updatedRecord);
    }

    return { success: true, updatedCount: updatedRecords.length, records: updatedRecords };
  } catch (err: any) {
    console.error('advanceTaxStatusInDb error:', err);
    return { success: false, updatedCount: 0, error: err?.message || 'Lỗi chuyển trạng thái thuế', records: [] };
  }
};

/**
 * Giao In Giấy chứng nhận cho cán bộ chuyên trách
 */
export const handoverPrintInDb = async (
  recordsOrIds: (RecordFile | string)[],
  staffId: string,
  currentUser?: string | { id?: string; name?: string; username?: string; employeeId?: string }
): Promise<{ success: boolean; updatedCount: number; error?: string; records: RecordFile[] }> => {
  if (!recordsOrIds || recordsOrIds.length === 0) return { success: true, updatedCount: 0, records: [] };
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];
  const userName = typeof currentUser === 'string' ? currentUser : (currentUser?.name || currentUser?.username || 'Lãnh đạo phê duyệt');
  const updatedRecords: RecordFile[] = [];

  try {
    for (const item of recordsOrIds) {
      let record: RecordFile | null = typeof item === 'string' ? await getDangkyRecordById(item) : item;
      if (!record) continue;

      const existingLogs = Array.isArray(record.statusLogs) ? [...record.statusLogs] : [];
      const newLog: RecordStatusLog = {
        id: crypto.randomUUID?.() || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        recordId: record.id,
        previousStatus: record.status,
        newStatus: RecordStatus.PENDING_PRINT_CERT,
        changedBy: userName,
        changedAt: now,
        note: `Giao cán bộ in Giấy chứng nhận (GCN): ${staffId}`,
      };

      const updatedRecord: RecordFile = {
        ...record,
        assignedTo: staffId,
        assignedDate: todayStr,
        status: RecordStatus.PENDING_PRINT_CERT,
        printStaffAssignedAt: now,
        statusLogs: [...existingLogs, newLog],
        updatedAt: now,
      };

      await updateDangkyRecord(updatedRecord);
      updatedRecords.push(updatedRecord);
    }

    return { success: true, updatedCount: updatedRecords.length, records: updatedRecords };
  } catch (err: any) {
    console.error('handoverPrintInDb error:', err);
    return { success: false, updatedCount: 0, error: err?.message || 'Lỗi giao in GCN', records: [] };
  }
};
