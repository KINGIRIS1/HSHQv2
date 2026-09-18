import { supabase } from './supabaseClient';
import { RecordFile, RecordStatusLog, DossierComponentItem, AttachedFileMeta, RecordStatus } from '../types';
import { connectionManager } from './connectionService';
import { sanitizeData, isBlankRecord } from './apiCore';
import { getTargetTable, RECORD_DB_COLUMNS } from './apiRecords';

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
    previousStatus: dbItem.previousStatus || '',
    supplementReason: dbItem.supplementReason || '',
    statusLogs,
    dossierComponents,
    attachedFiles,
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
  if (record.area !== undefined) payload.area = Number(record.area) || 0;
  if (record.address !== undefined) payload.address = record.address;
  if (record.group !== undefined) payload.group = record.group;
  if (record.recordType !== undefined) payload.recordType = record.recordType;
  if (record.content !== undefined) payload.content = record.content;
  if (record.issueNumber !== undefined) payload.issueNumber = record.issueNumber;
  if (record.entryNumber !== undefined) payload.entryNumber = record.entryNumber;
  if (record.issueDate !== undefined) payload.issueDate = record.issueDate || null;
  if (record.residentialArea !== undefined) payload.residentialArea = record.residentialArea;
  if (record.status !== undefined) payload.status = record.status;
  if (record.receivedBy !== undefined) payload.receivedBy = record.receivedBy;
  if (record.receivedDate !== undefined) payload.receivedDate = record.receivedDate || null;
  if (record.deadline !== undefined) payload.deadline = record.deadline || null;
  if (record.assignedTo !== undefined) payload.assignedTo = record.assignedTo;
  if (record.assignedDate !== undefined) payload.assignedDate = record.assignedDate || null;
  if (record.checkedBy !== undefined) payload.checkedBy = record.checkedBy;
  if (record.submissionDate !== undefined) payload.submissionDate = record.submissionDate || null;
  if (record.approvalDate !== undefined) payload.approvalDate = record.approvalDate || null;
  if (record.completedDate !== undefined) payload.completedDate = record.completedDate || null;
  if (record.price !== undefined) payload.price = Number(record.price) || 0;
  if (record.advancePayment !== undefined) payload.advancePayment = Number(record.advancePayment) || 0;
  if (record.notes !== undefined) payload.notes = record.notes;
  if (record.privateNotes !== undefined) payload.privateNotes = record.privateNotes;
  if (record.personalNotes !== undefined) payload.personalNotes = record.personalNotes;
  if (record.otherDocs !== undefined) payload.otherDocs = record.otherDocs;
  if (record.authorizedBy !== undefined) payload.authorizedBy = record.authorizedBy;
  if (record.authDocType !== undefined) payload.authDocType = record.authDocType;
  if (record.submittedTo !== undefined) payload.submittedTo = record.submittedTo;
  if (record.pendingCheckDate !== undefined) payload.pendingCheckDate = record.pendingCheckDate || null;
  if (record.checkedDate !== undefined) payload.checkedDate = record.checkedDate || null;
  if (record.completedWorkDate !== undefined) payload.completedWorkDate = record.completedWorkDate || null;
  if (record.receiptNumber !== undefined) payload.receiptNumber = record.receiptNumber;
  if (record.receiptType !== undefined) payload.receiptType = record.receiptType;
  if (record.receiverName !== undefined) payload.receiverName = record.receiverName;
  if (record.returnedBy !== undefined) payload.returnedBy = record.returnedBy;
  if (record.resultReturnedDate !== undefined) payload.resultReturnedDate = record.resultReturnedDate || null;
  if (record.returnedPrice !== undefined) payload.returnedPrice = Number(record.returnedPrice) || 0;
  if (record.isHandedOver !== undefined) payload.isHandedOver = Boolean(record.isHandedOver);
  if (record.archiveHandoverDate !== undefined) payload.archiveHandoverDate = record.archiveHandoverDate || null;
  if (record.archiveHandoverBatch !== undefined) payload.archiveHandoverBatch = record.archiveHandoverBatch;
  if (record.exportBatch !== undefined) payload.exportBatch = record.exportBatch;
  if (record.exportDate !== undefined) payload.exportDate = record.exportDate || null;
  if (record.handoverWard !== undefined) payload.handoverWard = record.handoverWard;
  if (record.returnBatch !== undefined) payload.returnBatch = record.returnBatch;
  if (record.returnBatchDate !== undefined) payload.returnBatchDate = record.returnBatchDate || null;
  if (record.returnHandoverDept !== undefined) payload.returnHandoverDept = record.returnHandoverDept;
  if (record.reminderDate !== undefined) payload.reminderDate = record.reminderDate || null;
  if (record.lastRemindedAt !== undefined) payload.lastRemindedAt = record.lastRemindedAt || null;
  if (record.deadlineReminded !== undefined) payload.deadlineReminded = Boolean(record.deadlineReminded);
  if (record.appraisalDate !== undefined) payload.appraisalDate = record.appraisalDate || null;
  if (record.postingDate !== undefined) payload.postingDate = record.postingDate || null;
  if (record.postingEndDate !== undefined) payload.postingEndDate = record.postingEndDate || null;
  if (record.taxTransferDate !== undefined) payload.taxTransferDate = record.taxTransferDate || null;
  if (record.taxKv7Date !== undefined) payload.taxKv7Date = record.taxKv7Date || null;
  if (record.taxPaymentDate !== undefined) payload.taxPaymentDate = record.taxPaymentDate || null;
  if (record.printCertDate !== undefined) payload.printCertDate = record.printCertDate || null;
  if (record.pendingHandoverDate !== undefined) payload.pendingHandoverDate = record.pendingHandoverDate || null;
  if (record.previousStatus !== undefined) payload.previousStatus = record.previousStatus;
  if (record.supplementReason !== undefined) payload.supplementReason = record.supplementReason;

  if (record.statusLogs !== undefined) payload.statusLogs = record.statusLogs;
  if (record.dossierComponents !== undefined) payload.dossierComponents = record.dossierComponents;
  if (record.attachedFiles !== undefined) payload.attachedFiles = record.attachedFiles;

  payload.updatedAt = new Date().toISOString();
  return payload;
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

    // Tự động phân loại và di chuyển các hồ sơ bị phân nhầm vào dangky_records
    const misplacedForLuutru = mapped.filter(r => getTargetTable(r) === 'luutru_records');
    const misplacedForLand = mapped.filter(r => getTargetTable(r) === 'land_records');

    // Tự động phát hiện các dòng hoàn toàn trống rác
    const blankRecords = mapped.filter(r => isBlankRecord(r));

    const blankIds = new Set(blankRecords.map(r => r.id).filter(Boolean));
    const misplacedIds = new Set([
      ...misplacedForLuutru.map(r => r.id),
      ...misplacedForLand.map(r => r.id)
    ].filter(Boolean));

    if (misplacedForLuutru.length > 0 || misplacedForLand.length > 0 || blankIds.size > 0) {
      console.log(`[DangKy Auto-Fix] Phát hiện ${misplacedForLuutru.length} nhầm Lưu trữ, ${misplacedForLand.length} nhầm Đo đạc, ${blankIds.size} dòng trống. Đang tự động xử lý...`);
      setTimeout(async () => {
        try {
          if (misplacedForLuutru.length > 0) {
            await supabase.from('luutru_records').upsert(misplacedForLuutru.map(r => sanitizeData(r, RECORD_DB_COLUMNS)));
            await supabase.from(TABLE_NAME).delete().in('id', misplacedForLuutru.map(r => r.id));
          }
          if (misplacedForLand.length > 0) {
            await supabase.from('land_records').upsert(misplacedForLand.map(r => sanitizeData(r, RECORD_DB_COLUMNS)));
            await supabase.from(TABLE_NAME).delete().in('id', misplacedForLand.map(r => r.id));
          }
          if (blankIds.size > 0) {
            await supabase.from(TABLE_NAME).delete().in('id', Array.from(blankIds));
          }
        } catch (cleanErr) {
          console.error("[DangKy Auto-Fix] Lỗi khi dọn dẹp bản ghi nhầm/trống:", cleanErr);
        }
      }, 300);
    }

    return mapped.filter(r => !blankIds.has(r.id) && !misplacedIds.has(r.id));
  } catch (err) {
    console.error(`[DangKy API] Lỗi khi tải danh sách hồ sơ:`, err);
    connectionManager.reportNetworkError('fetchDangkyRecords', err);
    return [];
  }
};

/**
 * Thêm một hồ sơ Đăng ký mới vào bảng dangky_records
 */
export const addDangkyRecord = async (record: RecordFile): Promise<RecordFile> => {
  const payload = mapDangkyRecordToDb(record);
  if (!payload.createdAt) {
    payload.createdAt = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([payload])
    .select()
    .single();

  if (error) {
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
  const payload = mapDangkyRecordToDb(record);

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(payload)
    .eq('id', record.id)
    .select()
    .single();

  if (error) {
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
  const payload = mapDangkyRecordToDb(fields);

  const { error } = await supabase
    .from(TABLE_NAME)
    .update(payload)
    .eq('id', id);

  if (error) {
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
  assignedDate: string
): Promise<void> => {
  if (!recordIds || recordIds.length === 0) return;

  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      assignedTo,
      assignedDate,
      status: RecordStatus.IN_PROGRESS,
      updatedAt: new Date().toISOString(),
    })
    .in('id', recordIds);

  if (error) {
    console.error(`[DangKy API] Lỗi khi phân công hàng loạt:`, error);
    connectionManager.reportNetworkError('assignDangkyRecordsBatch', error);
    throw error;
  }
};
