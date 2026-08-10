import { supabase, isConfigured } from './supabaseClient';
import { RecordFile, RecordStatus, RecordStatusLog } from '../types';
import { getFromCache, saveToCache, logError, mapRecordFromDb, sanitizeData } from './apiCore';
import { RECORD_DB_COLUMNS } from './apiRecords';

export const DANGKY_CACHE_KEY = 'offline_dangky_records';

export const DANGKY_11_STEPS = [
  { id: 'tiep_nhan_giao_viec', label: 'Chưa giao', code: 'STEP_1', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'tham_dinh', label: 'Chờ thẩm định', code: 'STEP_2', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'phieu_chuyen_thue', label: 'Chờ chuyển thuế', code: 'STEP_3', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'cho_tbt', label: 'Chờ thông báo thuế', code: 'STEP_4', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'cho_gnt', label: 'Chờ GNT', code: 'STEP_5', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { id: 'in_hoan_thien', label: 'Chờ In & Hoàn thiện', code: 'STEP_6', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'trinh_kiem_tra', label: 'Kiểm tra', code: 'STEP_7', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'trinh_ky', label: 'Trình ký', code: 'STEP_8', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { id: 'cho_ban_giao', label: 'Bàn giao', code: 'STEP_9', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { id: 'cho_giao_1cua_tra_kq', label: 'Chờ trả kết quả', code: 'STEP_10', color: 'bg-green-50 text-green-700 border-green-200' },
  { id: 'da_tra_ket_qua', label: 'Đã trả kết quả', code: 'STEP_11', color: 'bg-slate-50 text-slate-700 border-slate-200' },
];

export const fetchDangkyRecords = async (): Promise<RecordFile[]> => {
  if (!isConfigured) {
    return getFromCache<RecordFile[]>(DANGKY_CACHE_KEY, []);
  }

  try {
    const { data, error } = await supabase
      .from('dangky_records')
      .select('*')
      .order('receivedDate', { ascending: false });

    if (error) {
      logError('fetchDangkyRecords', error);
      return getFromCache<RecordFile[]>(DANGKY_CACHE_KEY, []);
    }

    const mappedRecords = (data || []).map(mapRecordFromDb);
    saveToCache(DANGKY_CACHE_KEY, mappedRecords);
    return mappedRecords;
  } catch (err) {
    logError('fetchDangkyRecords', err);
    return getFromCache<RecordFile[]>(DANGKY_CACHE_KEY, []);
  }
};

export const saveDangkyRecord = async (record: RecordFile): Promise<RecordFile | null> => {
  const payload = sanitizeData(record, RECORD_DB_COLUMNS);
  if (!payload.group) payload.group = 'cap_giay';
  
  // Save locally first
  const currentLocal = getFromCache<RecordFile[]>(DANGKY_CACHE_KEY, []);
  const existingIdx = currentLocal.findIndex(r => r.id === record.id);
  let updatedLocal: RecordFile[];
  if (existingIdx >= 0) {
    updatedLocal = currentLocal.map((r, i) => i === existingIdx ? record : r);
  } else {
    updatedLocal = [record, ...currentLocal];
  }
  saveToCache(DANGKY_CACHE_KEY, updatedLocal);

  if (!isConfigured) return record;

  try {
    const { data, error } = await supabase
      .from('dangky_records')
      .upsert([payload])
      .select();

    if (error) {
      logError('saveDangkyRecord', error);
      return record;
    } else if (data && data.length > 0) {
      return mapRecordFromDb(data[0]);
    }
  } catch (err) {
    logError('saveDangkyRecord', err);
  }

  return record;
};

export const deleteDangkyRecord = async (id: string): Promise<boolean> => {
  const currentLocal = getFromCache<RecordFile[]>(DANGKY_CACHE_KEY, []);
  const filtered = currentLocal.filter(r => r.id !== id);
  saveToCache(DANGKY_CACHE_KEY, filtered);

  if (!isConfigured) return true;

  try {
    const { error } = await supabase.from('dangky_records').delete().eq('id', id);
    if (error) {
      await supabase.from('land_records').delete().eq('id', id);
    }
    return true;
  } catch (err) {
    logError('deleteDangkyRecord', err);
    return false;
  }
};

/**
 * Logic advanceStatus dành riêng cho quy trình 11 bước của Tab Đăng ký
 */
export const advanceDangkyStatus = (
  record: RecordFile,
  currentUser: any,
  targetEmployeeId?: string
): { updatedRecord: RecordFile; nextStepLabel: string } => {
  const currentSubStep = record.capGiaySubStep || 'tiep_nhan_giao_viec';
  const stepIdx = DANGKY_11_STEPS.findIndex(s => s.id === currentSubStep);
  
  const nextIdx = stepIdx < DANGKY_11_STEPS.length - 1 ? stepIdx + 1 : stepIdx;
  const nextStep = DANGKY_11_STEPS[nextIdx];

  const nowIso = new Date().toISOString();
  let newStatus: RecordStatus = record.status;

  // Map high level status based on 11 steps
  switch (nextStep.id) {
    case 'tiep_nhan_giao_viec':
      newStatus = targetEmployeeId ? RecordStatus.ASSIGNED : RecordStatus.RECEIVED;
      break;
    case 'tham_dinh':
    case 'phieu_chuyen_thue':
    case 'cho_tbt':
    case 'cho_gnt':
    case 'in_hoan_thien':
      newStatus = RecordStatus.IN_PROGRESS;
      break;
    case 'trinh_kiem_tra':
      newStatus = RecordStatus.PENDING_CHECK;
      break;
    case 'trinh_ky':
      newStatus = RecordStatus.PENDING_SIGN;
      break;
    case 'cho_vo_so':
      newStatus = RecordStatus.SIGNED;
      break;
    case 'cho_giao_1cua_tra_kq':
      newStatus = RecordStatus.HANDOVER;
      break;
    case 'chinh_ly_luu_tru':
      newStatus = RecordStatus.RETURNED;
      break;
  }

  const logMessage = `Chuyển bước Đăng ký: [${DANGKY_11_STEPS[stepIdx]?.label || currentSubStep}] ➔ [${nextStep.label}]`;
  const existingLogs = Array.isArray(record.statusLogs) ? record.statusLogs : [];
  const newLog: RecordStatusLog = {
    id: `log-${Date.now()}`,
    recordId: record.id,
    newStatus: newStatus,
    changedBy: currentUser?.name || 'Hệ thống',
    changedAt: nowIso,
    status: newStatus,
    subStep: nextStep.id,
    updatedAt: nowIso,
    updatedBy: currentUser?.name || 'Hệ thống',
    note: logMessage
  };

  const updatedRecord: RecordFile = {
    ...record,
    status: newStatus,
    capGiaySubStep: nextStep.id,
    group: 'cap_giay',
    assignedTo: targetEmployeeId || record.assignedTo,
    completedWorkDate: nextStep.id === 'in_hoan_thien' ? nowIso : record.completedWorkDate,
    pendingCheckDate: nextStep.id === 'trinh_kiem_tra' ? nowIso : record.pendingCheckDate,
    submissionDate: nextStep.id === 'trinh_ky' ? nowIso : record.submissionDate,
    approvalDate: nextStep.id === 'cho_vo_so' ? nowIso : record.approvalDate,
    completedDate: nextStep.id === 'chinh_ly_luu_tru' ? nowIso : record.completedDate,
    resultReturnedDate: nextStep.id === 'chinh_ly_luu_tru' ? nowIso : record.resultReturnedDate,
    statusLogs: [...existingLogs, newLog]
  };

  return {
    updatedRecord,
    nextStepLabel: nextStep.label
  };
};
