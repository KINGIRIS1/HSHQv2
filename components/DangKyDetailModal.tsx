import React, { useState, useEffect } from 'react';
import { DangKyRecord, Employee, User, UserRole } from '../types';
import { 
  X, MapPin, FileText, User as UserIcon, Users, UserPlus, Shield, 
  DollarSign, CheckCircle2, Circle, Calendar, Printer, Pencil, 
  Trash2, ArrowRight, Building2, FileCheck, Layers, CalendarClock,
  Receipt, Bell, StickyNote, Save, Loader2, CheckSquare, Send, Info,
  Award, ShieldCheck, PauseCircle, Clock
} from 'lucide-react';
import { saveDangKyRecordApi } from '../services/apiDangKy';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import DocxPreviewModal from './DocxPreviewModal';
import SystemReceiptTemplate from './receive-record/SystemReceiptTemplate';
import { getNormalizedWard } from '../constants';
import { getShortRecordType, getCanonicalRecordType } from '../constants/procedures';
import { 
  getProcedureWorkflow, 
  getNextStatusForDangKyRecord, 
  WorkflowStep, 
  STANDARD_AVAILABLE_STEPS 
} from '../constants/procedureWorkflows';
import { AutoResizeTextarea } from './AutoResizeTextarea';

const STEP_ICONS: Record<string, any> = {
  tiep_nhan: UserIcon,
  tham_dinh: UserIcon,
  phieu_chuyen_thue: Send,
  thue_kv7: Building2,
  thong_bao_thue: Receipt,
  in_gcn: Printer,
  trinh_kiem_tra: ShieldCheck,
  trinh_ky: Send,
  hoan_thanh: CheckSquare,
  tra_ket_qua: FileCheck
};

export interface AttachedDocItem {
  id?: string;
  name: string;
  type: string;
}

export const parseAttachedDocs = (rawDocs: any, otherDocsStr?: string, attachedDocumentsRaw?: any): AttachedDocItem[] => {
  const tryParseJson = (str: string): any => {
    if (!str || typeof str !== 'string') return null;
    const clean = str.trim();
    if ((clean.startsWith('[') && clean.endsWith(']')) || (clean.startsWith('{') && clean.endsWith('}'))) {
      try {
        return JSON.parse(clean);
      } catch {
        return null;
      }
    }
    return null;
  };

  // 1. If rawDocs is already an Array
  if (Array.isArray(rawDocs) && rawDocs.length > 0) {
    return rawDocs.map((d, i) => {
      if (typeof d === 'string') {
        const json = tryParseJson(d);
        if (json && typeof json === 'object') {
          return {
            id: json.id || String(i + 1),
            name: json.name || json.docName || d,
            type: json.type || json.docType || 'Bản chính'
          };
        }
        return { id: String(i + 1), name: d, type: 'Bản chính' };
      }
      return {
        id: d.id || String(i + 1),
        name: d.name || d.docName || '',
        type: d.type || d.docType || 'Bản chính'
      };
    }).filter(d => d.name && d.name.trim() !== '');
  }

  // 2. If rawDocs is a JSON string
  if (typeof rawDocs === 'string' && rawDocs.trim()) {
    const parsed = tryParseJson(rawDocs);
    if (Array.isArray(parsed)) {
      return parseAttachedDocs(parsed);
    } else if (parsed && typeof parsed === 'object') {
      return [{
        id: parsed.id || '1',
        name: parsed.name || parsed.docName || rawDocs,
        type: parsed.type || parsed.docType || 'Bản chính'
      }];
    }
  }

  // 3. If attachedDocumentsRaw is provided
  if (Array.isArray(attachedDocumentsRaw) && attachedDocumentsRaw.length > 0) {
    return parseAttachedDocs(attachedDocumentsRaw);
  }
  if (typeof attachedDocumentsRaw === 'string' && attachedDocumentsRaw.trim()) {
    const parsed = tryParseJson(attachedDocumentsRaw);
    if (parsed) return parseAttachedDocs(parsed);
  }

  // 4. If otherDocsStr is a JSON string
  if (typeof otherDocsStr === 'string' && otherDocsStr.trim()) {
    const parsed = tryParseJson(otherDocsStr);
    if (Array.isArray(parsed)) {
      return parseAttachedDocs(parsed);
    } else if (parsed && typeof parsed === 'object') {
      return [{
        id: parsed.id || '1',
        name: parsed.name || parsed.docName || otherDocsStr,
        type: parsed.type || parsed.docType || 'Bản chính'
      }];
    } else {
      // Normal semicolon / newline separated text
      return otherDocsStr.split(/[\n;]/).map((item, idx) => ({
        id: String(idx + 1),
        name: item.trim(),
        type: 'Bản chính'
      })).filter(d => d.name !== '');
    }
  }

  return [];
};

interface DangKyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DangKyRecord | null;
  employees: Employee[];
  currentUser: User | null;
  onEdit?: (record: DangKyRecord) => void;
  onDelete?: (record: DangKyRecord) => void;
  onStatusAdvance?: (record: DangKyRecord) => void;
  onRefreshData?: () => void;
  onOpenExtendModal?: (record: DangKyRecord) => void;
}

export const DangKyDetailModal: React.FC<DangKyDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  employees,
  currentUser,
  onEdit,
  onDelete,
  onStatusAdvance,
  onRefreshData,
  onOpenExtendModal
}) => {
  const [personalNote, setPersonalNote] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
  const [reminderDate, setReminderDate] = useState<string>('');
  const [isSavingReminder, setIsSavingReminder] = useState<boolean>(false);

  // States cho Gia hạn ngày hẹn
  const [showExtendForm, setShowExtendForm] = useState<boolean>(false);
  const [extendDate, setExtendDate] = useState<string>('');
  const [isExtending, setIsExtending] = useState<boolean>(false);

  // States cho In biên nhận & DOCX Preview
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [systemReceiptData, setSystemReceiptData] = useState<any | null>(null);

  // Dynamic procedure workflow steps
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);

  useEffect(() => {
    if (record) {
      setPersonalNote(record.personalNotes || record.notes || '');
      if (record.reminderDate) {
        setReminderDate(record.reminderDate.split('T')[0]);
      } else {
        setReminderDate('');
      }
      if (record.deadline) {
        setExtendDate(record.deadline.split('T')[0]);
      } else {
        setExtendDate(new Date().toISOString().split('T')[0]);
      }

      // Load workflow steps for this specific record procedure
      const steps = getProcedureWorkflow(record.recordType, record.code);
      setWorkflowSteps(steps);
    }
  }, [record, isOpen]);

  // Listen to workflow configuration change in real time
  useEffect(() => {
    const handleWorkflowChanged = () => {
      if (record) {
        const updatedSteps = getProcedureWorkflow(record.recordType, record.code);
        setWorkflowSteps(updatedSteps);
      }
    };

    window.addEventListener('registration_workflow_changed', handleWorkflowChanged);
    return () => {
      window.removeEventListener('registration_workflow_changed', handleWorkflowChanged);
    };
  }, [record]);

  if (!isOpen || !record) return null;

  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUBADMIN;
  const isOneDoor = currentUser?.role === UserRole.ONEDOOR;
  const canPerformAction = isAdmin || isOneDoor || true;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '---';
    try {
      const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const parts = clean.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount?: number | string | null) => {
    if (amount === undefined || amount === null || amount === '') return '---';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num) || num <= 0) return '---';
    return `${num.toLocaleString('vi-VN')} đ`;
  };

  const handleSavePersonalNote = async () => {
    if (!record) return;
    setIsSavingNote(true);
    try {
      await saveDangKyRecordApi({ ...record, personalNotes: personalNote });
      alert('Đã lưu ghi chú cá nhân thành công!');
      if (onRefreshData) onRefreshData();
    } catch (e) {
      alert('Lỗi khi lưu ghi chú!');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleSaveReminder = async () => {
    if (!record) return;
    setIsSavingReminder(true);
    try {
      await saveDangKyRecordApi({ ...record, reminderDate: reminderDate || undefined });
      alert('Đã lưu hẹn giờ nhắc việc thành công!');
      if (onRefreshData) onRefreshData();
    } catch (e) {
      alert('Lỗi khi lưu hẹn giờ nhắc việc!');
    } finally {
      setIsSavingReminder(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!record) return;

    // Chuẩn hóa thông tin người đại diện nộp / chủ sử dụng
    const transferees = record.transferees || [];
    const hasTransferees = transferees.length > 0 && transferees.some(t => t.name && t.name.trim() !== '');
    const primaryPerson = hasTransferees ? transferees[0] : (record.owners && record.owners.length > 0 ? record.owners[0] : null);

    const customerName = primaryPerson?.name || (record as any).customerName || '---';
    const phoneNumber = primaryPerson?.phone || (record as any).phoneNumber || '';
    const cccd = primaryPerson?.cccd || (record as any).cccd || '';
    const customerAddress = primaryPerson?.address || (record as any).address || '';

    const normalizedRecord = {
      ...record,
      customerName,
      phoneNumber,
      cccd,
      customerAddress,
      address: customerAddress || (record as any).address || record.ward,
      area: (record as any).area || record.totalArea || '',
      content: record.notes || record.recordType || 'Đăng ký đất đai',
    };

    if (!hasTemplate(STORAGE_KEYS.RECEIPT_TEMPLATE)) {
      setSystemReceiptData(normalizedRecord);
      return;
    }

    setIsProcessing(true);
    try {
      const rDate = record.receivedDate ? new Date(record.receivedDate) : new Date();
      const dDate = record.deadline ? new Date(record.deadline) : new Date();

      const day = rDate.getDate().toString().padStart(2, '0');
      const month = (rDate.getMonth() + 1).toString().padStart(2, '0');
      const year = rDate.getFullYear();
      const dateFullString = `ngày ${day} tháng ${month} năm ${year}`;
      const dateShortString = `${day}/${month}/${year}`;

      const dayDead = dDate.getDate().toString().padStart(2, '0');
      const monthDead = (dDate.getMonth() + 1).toString().padStart(2, '0');
      const yearDead = dDate.getFullYear();
      const deadlineFullString = `ngày ${dayDead} tháng ${monthDead} năm ${yearDead}`;
      const deadlineShortString = `${dayDead}/${monthDead}/${yearDead}`;

      const val = (v: any) => (v === undefined || v === null) ? '' : String(v);

      const printData = {
        code: val(record.code),
        customerName: val(customerName),
        landPlot: val(record.landPlot),
        mapSheet: val(record.mapSheet),
        XAPHUONG: val(getNormalizedWard(record.ward)),
        NGAYNHAN: dateFullString,
        NGAY_NHAN: dateShortString,
        LOAI_GIAY_TO_UY_QUYEN: '',
        DIA_CHI_CHI_TIET: val(customerAddress),
        MA: val(record.code),
        SO_HS: val(record.code),
        MA_HO_SO: val(record.code),
        CODE: val(record.code),
        TEN: val(customerName).toUpperCase(),
        HO_TEN: val(customerName).toUpperCase(),
        CHU_SU_DUNG: val(customerName).toUpperCase(),
        KHACH_HANG: val(customerName).toUpperCase(),
        ONG_BA: val(customerName).toUpperCase(),
        SDT: val(phoneNumber),
        DIEN_THOAI: val(phoneNumber),
        PHONE: val(phoneNumber),
        CCCD: val(cccd),
        CMND: val(cccd),
        DIA_CHI_CHU_SU_DUNG: val(customerAddress),
        DIA_CHI: val(customerAddress || record.ward),
        DC: val(customerAddress || record.ward),
        ADDRESS: val(customerAddress || record.ward),
        XA: val(getNormalizedWard(record.ward)),
        PHUONG: val(getNormalizedWard(record.ward)),
        WARD: val(getNormalizedWard(record.ward)),
        TO: val(record.mapSheet),
        SO_TO: val(record.mapSheet),
        THUA: val(record.landPlot),
        SO_THUA: val(record.landPlot),
        DT: val(record.totalArea || (record as any).area),
        DIEN_TICH: val(record.totalArea || (record as any).area),
        NGAY_NHAN_FULL: dateFullString,
        NGAY: day,
        THANG: month,
        NAM: year,
        RECEIVED_DATE: dateShortString,
        HEN_TRA: deadlineShortString,
        NGAY_HEN: deadlineShortString,
        DEADLINE: deadlineShortString,
        HEN_TRA_FULL: deadlineFullString,
        NGAY_HEN_FULL: deadlineFullString,
        NGUOI_NHAN: val(currentUser?.name),
        CAN_BO: val(currentUser?.name),
        USER: val(currentUser?.name),
        NOI_DUNG: val(record.notes || record.recordType),
        CONTENT: val(record.notes || record.recordType),
        LOAI_HS: val(getCanonicalRecordType(record.recordType, record.code)),
        RECORD_TYPE: val(getCanonicalRecordType(record.recordType, record.code)),
        GIAY_TO_KHAC: '',
        NGUOI_UY_QUYEN: '',
        UY_QUYEN: '',
        LOAI_UY_QUYEN: '',
        TGTRA: '13',
        SO_NGAY: '13',
        TP1: `Phiếu tiếp nhận Đăng ký đất đai tại ${getNormalizedWard(record.ward)}`,
        TIEU_DE: `Phiếu tiếp nhận Đăng ký đất đai tại ${getNormalizedWard(record.ward)}`,
        SDTLH: '',
        TINH: 'Bình Phước',
        HUYEN: 'huyện Hớn Quản'
      };

      const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
      if (blob) {
        setPreviewBlob(blob);
        setPreviewFileName(`BienNhan_${record.code}`);
        setIsPreviewOpen(true);
      } else {
        setSystemReceiptData(normalizedRecord);
      }
    } catch (e) {
      console.error('Error printing receipt:', e);
      setSystemReceiptData(normalizedRecord);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveExtension = async () => {
    if (!record) return;
    if (!extendDate) {
      alert('Vui lòng chọn ngày hẹn mới.');
      return;
    }

    setIsExtending(true);
    
    const nowStr = new Date().toLocaleString('vi-VN');
    const userLabel = currentUser ? `${currentUser.name} (${currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Quản trị'})` : 'Hệ thống';
    const extensionNote = `[Gia hạn ngày hẹn] Hạn cũ: ${formatDate(record.deadline)} -> Hạn mới: ${formatDate(extendDate)} (Bởi: ${userLabel} lúc ${nowStr})`;
    
    const newPrivateNotes = record.privateNotes 
      ? `${record.privateNotes}\n${extensionNote}` 
      : extensionNote;

    const updatedRecord: DangKyRecord = {
      ...record,
      deadline: extendDate,
      privateNotes: newPrivateNotes
    };

    try {
      const result = await saveDangKyRecordApi(updatedRecord);
      if (result) {
        alert('Đã gia hạn ngày hẹn thành công!');
        setShowExtendForm(false);
        record.deadline = extendDate;
        record.privateNotes = newPrivateNotes;
        if (onRefreshData) {
          onRefreshData();
        }
      } else {
        alert('Lỗi khi cập nhật ngày gia hạn.');
      }
    } catch (err) {
      console.error("Lỗi gia hạn:", err);
      alert('Có lỗi xảy ra khi thực hiện gia hạn.');
    } finally {
      setIsExtending(false);
    }
  };

  const formatStaffInfo = (staffNameOrId?: string | null) => {
    if (!staffNameOrId) return null;
    const emp = employees?.find(e => e.id === staffNameOrId || e.name === staffNameOrId);
    if (emp) {
      const pos = emp.position || '';
      return pos ? `${emp.name} (${pos})` : emp.name;
    }
    return staffNameOrId;
  };

  // Timeline Step Item chuẩn như DetailModal
  const TimelineItem = ({
    date,
    label,
    icon: Icon,
    isLast,
    colorClass,
    forceActive,
    subText,
    slaLabel,
    isExcludedFromTotalSla
  }: {
    date?: string | null;
    label: string;
    icon: any;
    isLast?: boolean;
    colorClass: { text: string; border: string; bg: string };
    forceActive?: boolean;
    subText?: string | null;
    slaLabel?: string | null;
    isExcludedFromTotalSla?: boolean;
  }) => {
    const isActive = !!date || !!forceActive;
    return (
      <div className="relative flex gap-4">
        <div className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 bg-white ${isActive ? colorClass.border : 'border-gray-200'}`}>
            {isActive ? <CheckCircle2 size={16} className={colorClass.text} /> : <Circle size={16} className="text-gray-300" />}
          </div>
          {!isLast && <div className={`w-0.5 grow ${isActive ? colorClass.bg : 'bg-gray-100'} my-1`}></div>}
        </div>
        <div className="pb-6 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
            <p className={`text-xs font-bold uppercase ${isActive ? colorClass.text : 'text-gray-400'}`}>{label}</p>
            {slaLabel && (
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold font-mono ${
                isExcludedFromTotalSla 
                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                {isExcludedFromTotalSla ? `[${slaLabel} - Dừng SLA]` : `SLA: ${slaLabel}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Icon size={14} className={isActive ? 'text-gray-500' : 'text-gray-300'} />
            <span className={`text-sm font-medium ${isActive ? 'text-gray-800' : 'text-gray-400 italic'}`}>
              {date ? formatDate(date) : (forceActive ? 'Đã hoàn tất' : 'Chưa thực hiện')}
            </span>
          </div>
          {subText && <p className="text-[11px] text-indigo-600 mt-1 italic font-medium">{subText}</p>}
        </div>
      </div>
    );
  };

  const owners = record.owners || [];
  const transferees = record.transferees || [];
  const hasTransferees = transferees.length > 0 && transferees.some(t => t.name && t.name.trim() !== '');
  const hasOwners = owners.length > 0 && owners.some(o => o.name && o.name.trim() !== '');

  // Ưu tiên hiển thị: 1. Người nộp / Khách hàng -> 2. Người được ủy quyền -> 3. Người nhận CQ -> 4. Chủ sử dụng
  const primaryPerson = (() => {
    if (record.applicantName && record.applicantName.trim()) {
      return {
        role: '',
        roleBadge: '',
        name: record.applicantName.trim(),
        phone: record.applicantPhone || record.phoneNumber || 'Chưa cập nhật',
        cccd: record.applicantCccd || record.cccd || 'Chưa cập nhật',
        address: record.applicantAddress || record.customerAddress || 'Chưa cập nhật'
      };
    }
    if (record.authorizedPersonName && record.authorizedPersonName.trim()) {
      return {
        role: '',
        roleBadge: '',
        name: record.authorizedPersonName.trim(),
        phone: record.authorizedPersonPhone || record.phoneNumber || 'Chưa cập nhật',
        cccd: record.authorizedPersonId || record.cccd || 'Chưa cập nhật',
        address: record.authorizedPersonAddress || record.customerAddress || 'Chưa cập nhật'
      };
    }
    if (hasTransferees) {
      const t = transferees[0];
      return {
        role: '',
        roleBadge: '',
        name: t.name.trim(),
        phone: t.phone || record.phoneNumber || 'Chưa cập nhật',
        cccd: t.cccd || record.cccd || 'Chưa cập nhật',
        address: t.address || record.customerAddress || 'Chưa cập nhật'
      };
    }
    if (hasOwners) {
      const o = owners[0];
      return {
        role: '',
        roleBadge: '',
        name: o.name.trim(),
        phone: o.phone || record.phoneNumber || 'Chưa cập nhật',
        cccd: o.cccd || record.cccd || 'Chưa cập nhật',
        address: o.address || record.customerAddress || 'Chưa cập nhật'
      };
    }
    if (record.customerName && record.customerName.trim()) {
      return {
        role: '',
        roleBadge: '',
        name: record.customerName.trim(),
        phone: record.phoneNumber || 'Chưa cập nhật',
        cccd: record.cccd || 'Chưa cập nhật',
        address: record.customerAddress || record.address || 'Chưa cập nhật'
      };
    }
    return {
      role: '',
      roleBadge: '',
      name: 'Chưa cập nhật tên',
      phone: record.phoneNumber || 'Chưa cập nhật',
      cccd: record.cccd || 'Chưa cập nhật',
      address: record.customerAddress || record.address || 'Chưa cập nhật'
    };
  })();

  const parsedAttachedDocs = parseAttachedDocs(record.attachedDocs, record.otherDocs, record.attachedDocuments);
  const nextStatus = getNextStatusForDangKyRecord(record);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs animate-fade-in">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col border border-gray-200">
        
        {/* HEADER */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="bg-blue-100 text-blue-700 font-bold font-mono px-3 py-1 rounded text-sm border border-blue-200">
              {record.code}
            </span>
            <h2 className="text-lg font-bold text-gray-800 uppercase flex items-center gap-2" title={record.recordType || 'Hồ sơ Đăng ký cấp GCN'}>
              <Layers size={18} className="text-blue-600" />
              {getShortRecordType(record.recordType, record.code) || 'Hồ sơ Đăng ký cấp GCN'}
            </h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {record.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                if (onOpenExtendModal) {
                  onClose();
                  onOpenExtendModal(record);
                } else {
                  setShowExtendForm(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors text-xs font-bold shadow-2xs cursor-pointer"
              title="Gia hạn ngày hẹn trả"
            >
              <CalendarClock size={15} />
              Gia hạn
            </button>

            <button 
              onClick={handlePrintReceipt}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-xs font-bold shadow-2xs cursor-pointer"
            >
              <Printer size={15} />
              In biên nhận
            </button>

            {onEdit && (
              <button
                onClick={() => { onClose(); onEdit(record); }}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg cursor-pointer"
                title="Chỉnh sửa hồ sơ"
              >
                <Pencil size={18} />
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => { onClose(); onDelete(record); }}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg cursor-pointer"
                title="Xóa hồ sơ"
              >
                <Trash2 size={18} />
              </button>
            )}

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* BODY (GRID 3 COLUMNS) */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMN 1: THÔNG TIN CHỦ HỒ SƠ & ĐỊA CHÍNH */}
            <div className="space-y-6">
              
              {/* THÔNG TIN KHÁCH HÀNG */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-l-4 border-blue-600 pl-2">
                  <h3 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2">
                    <UserIcon size={16}/> Thông tin khách hàng
                  </h3>
                  {primaryPerson.role && primaryPerson.roleBadge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${primaryPerson.roleBadge}`}>
                      {primaryPerson.role}
                    </span>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">
                      Họ và tên
                    </label>
                    <p className="text-base font-bold text-gray-800 uppercase">{primaryPerson.name}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Số điện thoại</label>
                      <p className={`text-xs font-bold font-mono ${primaryPerson.phone && primaryPerson.phone !== 'Chưa cập nhật' ? 'text-emerald-700' : 'text-gray-400 italic'}`}>
                        {primaryPerson.phone}
                      </p>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Số CCCD / CMND</label>
                      <p className={`text-xs font-bold font-mono ${primaryPerson.cccd && primaryPerson.cccd !== 'Chưa cập nhật' ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                        {primaryPerson.cccd}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Địa chỉ thường trú</label>
                    <p className={`text-xs font-semibold ${primaryPerson.address && primaryPerson.address !== 'Chưa cập nhật' ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                      {primaryPerson.address}
                    </p>
                  </div>
                </div>

                {/* NGƯỜI ĐƯỢC ỦY QUYỀN (NẾU CÓ) */}
                {record.authorizedPersonName && (
                  <div className="border-t border-gray-100 pt-3 mt-4">
                    <label className="text-[10px] text-indigo-500 uppercase font-bold block mb-2 flex items-center gap-1">
                      <Shield size={12} /> Người được ủy quyền
                    </label>
                    <div className="space-y-1.5 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Họ tên:</span>
                        <span className="font-bold text-indigo-900 uppercase">{record.authorizedPersonName}</span>
                      </div>
                      {record.authorizedPersonId && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">CCCD:</span>
                          <span className="font-semibold text-gray-800 font-mono">{record.authorizedPersonId}</span>
                        </div>
                      )}
                      {record.authorizedPersonPhone && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">SĐT:</span>
                          <span className="font-semibold text-emerald-700 font-mono">{record.authorizedPersonPhone}</span>
                        </div>
                      )}
                      {record.authorizedPersonAddress && (
                        <div className="text-xs">
                          <span className="text-gray-500 block mb-0.5">Địa chỉ:</span>
                          <span className="font-semibold text-gray-800 block">{record.authorizedPersonAddress}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ĐỊA CHÍNH */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-bold text-green-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-green-600 pl-2">
                  <MapPin size={16}/> Thông tin địa chính
                </h3>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Xã / Phường</label>
                    <p className="font-bold text-gray-800 text-sm truncate">{record.ward || '---'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Tờ bản đồ</label>
                    <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center font-mono text-sm">{record.mapSheet || '-'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Thửa đất</label>
                    <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center font-mono text-sm">{record.landPlot || '-'}</p>
                  </div>
                </div>
              </div>

              {/* REMINDER */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2">
                    <Bell size={16} /> Hẹn giờ nhắc việc
                  </h4>
                  <button 
                    onClick={handleSaveReminder} 
                    disabled={isSavingReminder}
                    className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50 font-bold transition-all cursor-pointer"
                  >
                    {isSavingReminder ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Lưu
                  </button>
                </div>
                <input 
                  type="date" 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                />
              </div>

              {/* PERSONAL NOTE */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase">
                    <StickyNote size={16} />
                    <span>Ghi chú cá nhân</span>
                  </div>
                  <button 
                    onClick={handleSavePersonalNote} 
                    disabled={isSavingNote}
                    className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50 font-bold transition-all cursor-pointer"
                  >
                    {isSavingNote ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                    Lưu
                  </button>
                </div>
                <AutoResizeTextarea
                  minRows={1}
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 leading-relaxed"
                  placeholder="Nhập ghi chú riêng của bạn..."
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                />
              </div>
            </div>

            {/* COLUMN 2: CHI TIẾT & TÀI CHÍNH */}
            <div className="space-y-6">
              
              {/* NỘI DUNG CHI TIẾT & PHIẾU CHUYỂN THUẾ / SỐ PHÁT HÀNH GCN */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                
                {/* 2 HÀNG BÁO SỐ PHIẾU CHUYỂN THUẾ & SỐ SERI GCN (ĐẶT SONG SONG TRÊN CÙNG HÀNG NGANG) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Cột 1: Số phiếu chuyển */}
                  <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex items-center gap-2.5 min-w-0">
                    <div className="bg-amber-200 text-amber-800 p-2 rounded-lg shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="text-left truncate min-w-0">
                      <span className="text-[10px] text-amber-700 uppercase font-bold block truncate">Số phiếu chuyển :</span>
                      <p className="text-xs font-bold text-amber-950 font-mono truncate">
                        {record.taxFormNumber || '...'}
                      </p>
                    </div>
                  </div>

                  {/* Cột 2: Số seri GCN (Song song) */}
                  <div className="bg-purple-50/80 border border-purple-200/80 rounded-xl p-3 flex items-center gap-2.5 min-w-0">
                    <div className="bg-purple-200 text-purple-800 p-2 rounded-lg shrink-0">
                      <Award size={16} />
                    </div>
                    <div className="text-left truncate min-w-0">
                      <span className="text-[10px] text-purple-700 uppercase font-bold block truncate">Số seri GCN :</span>
                      <p className="text-xs font-bold text-purple-950 font-mono truncate">
                        {record.issueNumber || '...'}
                      </p>
                    </div>
                  </div>
                </div>

                <h3 className="text-xs font-bold text-purple-600 uppercase flex items-center gap-2 border-l-4 border-purple-600 pl-2">
                  <FileText size={16}/> Nội dung chi tiết
                </h3>
                
                <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-200/80 text-gray-800 text-sm font-medium leading-relaxed whitespace-pre-line">
                  {record.notes ? record.notes : <span className="text-gray-400 italic">Không có nội dung chi tiết bổ sung.</span>}
                </div>

                {/* GIẤY TỜ KÈM THEO */}
                <div>
                  <label className="text-[10px] text-teal-600 uppercase font-bold block mb-2 flex items-center gap-1">
                    <FileText size={12} /> Giấy tờ kèm theo
                  </label>
                  {parsedAttachedDocs && parsedAttachedDocs.length > 0 ? (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white shadow-2xs">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase">
                            <th className="py-1.5 px-2 text-center w-8">#</th>
                            <th className="py-1.5 px-2">Tên giấy tờ</th>
                            <th className="py-1.5 px-2 w-28 text-center">Hình thức</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {parsedAttachedDocs.map((doc, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-1.5 px-2 text-center font-bold text-gray-400">{idx + 1}</td>
                              <td className="py-1.5 px-2 font-medium text-gray-800">{doc.name}</td>
                              <td className="py-1.5 px-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  doc.type === 'Bản chính' || doc.type === 'Chính'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {doc.type === 'Bản chính' ? 'Chính' : doc.type === 'Bản sao' ? 'Sao' : doc.type}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : record.otherDocs && !record.otherDocs.trim().startsWith('[') ? (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-gray-200 text-xs text-gray-700 font-medium">
                      {record.otherDocs}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic bg-slate-50/50 p-2.5 rounded-lg border border-dashed border-gray-200">
                      Chưa có giấy tờ kèm theo.
                    </div>
                  )}
                </div>

                {record.explanationPlan && (
                  <div>
                    <label className="text-[10px] text-purple-500 uppercase font-bold block mb-1">Phương án giải trình</label>
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-purple-900 text-sm font-medium">
                      {record.explanationPlan}
                    </div>
                  </div>
                )}

                {/* TÀI CHÍNH & LỆ PHÍ */}
                <div className="border-t border-gray-100 pt-4">
                  <label className="text-[11px] font-bold text-slate-700 uppercase block mb-2.5 flex items-center gap-1.5">
                    <Receipt size={15} className="text-emerald-600" />
                    <span>Thông tin Trả kết quả & Thu phí / Lệ phí</span>
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* SỐ TIỀN THU */}
                    <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200/80 flex flex-col justify-center min-w-0">
                      <label className="text-[10px] text-emerald-700 uppercase font-bold block whitespace-nowrap truncate">
                        Số tiền thu
                      </label>
                      <p className="text-sm font-black text-emerald-800 whitespace-nowrap truncate mt-0.5">
                        {formatCurrency(record.feeAmount || record.price || record.returnedPrice)}
                      </p>
                    </div>

                    {/* SỐ BIÊN LAI / HÓA ĐƠN */}
                    <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200/80 flex flex-col justify-center min-w-0">
                      <label className="text-[10px] text-blue-700 uppercase font-bold block whitespace-nowrap truncate">
                        {record.receiptType === 'Biên Lai' ? 'SỐ BIÊN LAI' : record.receiptType === 'Hóa Đơn' ? 'SỐ HÓA ĐƠN' : 'SỐ BIÊN LAI / HÓA ĐƠN'}
                      </label>
                      <p className="text-xs font-black text-blue-900 font-mono whitespace-nowrap truncate mt-0.5">
                        {record.receiptNumber || record.invoiceNumber || '---'}
                      </p>
                    </div>
                  </div>

                  {record.exportBatch && (
                    <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Đợt xuất bàn giao Một cửa:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Đợt {record.exportBatch}
                      </span>
                    </div>
                  )}
                </div>

                {/* GHI CHÚ NỘI BỘ */}
                {record.privateNotes && (
                  <div className="pt-2 border-t border-dashed border-gray-200">
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <div className="flex items-center gap-2 mb-1 text-yellow-800 font-bold text-xs">
                        <Info size={14} />
                        <span>Ghi chú nội bộ</span>
                      </div>
                      <p className="text-yellow-900 text-xs italic">"{record.privateNotes}"</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 3: TIẾN ĐỘ & THỜI GIAN (TIMELINE) */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-indigo-600 px-5 py-3 flex items-center gap-2">
                  <CalendarClock size={16} className="text-white"/>
                  <span className="text-xs font-bold text-white uppercase">Tiến độ & Thời gian</span>
                </div>
                
                <div className="p-6 text-center border-b border-gray-100">
                  <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Hạn trả kết quả</label>
                  <p className="text-2xl font-black text-gray-800 font-mono">{formatDate(record.deadline)}</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded inline-block font-mono">
                      Ngày nhận: {formatDate(record.receivedDate)}
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-0">
                  {workflowSteps && workflowSteps.length > 0 ? (
                    workflowSteps.map((step, idx) => {
                      const StepIcon = STEP_ICONS[step.code] || STEP_ICONS.tham_dinh;
                      const isLast = idx === workflowSteps.length - 1;
                      
                      // Resolve date & staff
                      let stepDate: string | undefined = step.dateField ? (record as any)[step.dateField] : undefined;
                      let stepStaff: string | undefined = step.staffField ? (record as any)[step.staffField] : undefined;
                      let isForceActive = !!stepDate || !!stepStaff;

                      if (step.code === 'tiep_nhan') {
                        stepDate = stepDate || record.receivedDate;
                        stepStaff = stepStaff || record.receivedBy;
                      } else if (step.code === 'tham_dinh') {
                        stepDate = stepDate || record.appraisalDate;
                        stepStaff = stepStaff || record.appraisalStaff;
                        isForceActive = !!record.appraisalStaff || !!record.appraisalDate;
                      } else if (step.code === 'phieu_chuyen_thue') {
                        stepDate = stepDate || record.taxFormDate;
                        stepStaff = stepStaff || record.taxFormStaff;
                        isForceActive = !!record.taxFormStaff || !!record.taxFormDate;
                      } else if (step.code === 'thue_kv7') {
                        stepDate = stepDate || record.taxKV7TransferDate;
                        stepStaff = stepStaff || record.taxKV7Staff;
                        isForceActive = !!record.taxKV7Staff || !!record.taxKV7TransferDate;
                      } else if (step.code === 'thong_bao_thue') {
                        stepDate = stepDate || record.taxNoticeDate;
                        stepStaff = stepStaff || record.taxNoticeStaff;
                        isForceActive = !!record.taxNoticeStaff || !!record.taxNoticeDate;
                      } else if (step.code === 'in_gcn') {
                        stepDate = stepDate || record.printDate;
                        stepStaff = stepStaff || record.printStaff;
                        isForceActive = !!record.printDate || !!record.printStaff;
                      } else if (step.code === 'trinh_kiem_tra') {
                        stepDate = stepDate || record.pendingCheckDate;
                        stepStaff = stepStaff || record.checkedBy;
                        isForceActive = !!record.pendingCheckDate || !!record.checkedBy;
                      } else if (step.code === 'trinh_ky') {
                        stepDate = stepDate || record.submissionDate;
                        stepStaff = stepStaff || record.submittedTo;
                        isForceActive = !!record.submissionDate || !!record.submittedTo;
                      } else if (step.code === 'hoan_thanh') {
                        stepDate = stepDate || record.completedDate || record.exportDate;
                        stepStaff = stepStaff || (record.exportBatch ? `Đợt xuất: ${record.exportBatch}` : undefined);
                        isForceActive = !!record.completedDate || !!record.exportBatch;
                      } else if (step.code === 'tra_ket_qua') {
                        stepDate = stepDate || record.resultReturnedDate;
                        stepStaff = stepStaff || (record.receiverName ? `Người nhận: ${record.receiverName}` : undefined);
                        isForceActive = !!record.resultReturnedDate;
                      }

                      // Determine colors
                      let colorClass = { text: 'text-blue-700', border: 'border-blue-600', bg: 'bg-blue-600' };
                      if (record.status === 'Trả hủy hồ sơ' && step.code === 'hoan_thanh') {
                        colorClass = { text: 'text-red-700', border: 'border-red-600', bg: 'bg-red-600' };
                      } else if (step.isExcludedFromTotalSla) {
                        colorClass = { text: 'text-amber-700', border: 'border-amber-600', bg: 'bg-amber-600' };
                      } else if (step.colorScheme === 'emerald' || step.code === 'tiep_nhan' || step.code === 'tra_ket_qua') {
                        colorClass = { text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600' };
                      } else if (step.colorScheme === 'orange' || step.code === 'phieu_chuyen_thue') {
                        colorClass = { text: 'text-orange-700', border: 'border-orange-600', bg: 'bg-orange-600' };
                      } else if (step.colorScheme === 'amber' || step.code === 'thue_kv7' || step.code === 'trinh_kiem_tra') {
                        colorClass = { text: 'text-amber-700', border: 'border-amber-600', bg: 'bg-amber-600' };
                      } else if (step.colorScheme === 'purple' || step.code === 'in_gcn') {
                        colorClass = { text: 'text-purple-700', border: 'border-purple-600', bg: 'bg-purple-600' };
                      } else if (step.colorScheme === 'indigo' || step.code === 'trinh_ky') {
                        colorClass = { text: 'text-indigo-700', border: 'border-indigo-600', bg: 'bg-indigo-600' };
                      } else if (step.colorScheme === 'green' || step.code === 'hoan_thanh') {
                        colorClass = { text: 'text-green-700', border: 'border-green-600', bg: 'bg-green-600' };
                      }

                      let displayLabel = step.name;
                      if (step.code === 'hoan_thanh') {
                        if (record.status === 'Trả hủy hồ sơ') displayLabel = 'TRẢ HỦY HỒ SƠ';
                        else if (record.status === 'CSD rút HS') displayLabel = 'CSD RÚT HỒ SƠ';
                      }

                      return (
                        <TimelineItem
                          key={step.id || idx}
                          date={stepDate}
                          forceActive={isForceActive}
                          label={displayLabel}
                          icon={StepIcon}
                          isLast={isLast}
                          colorClass={colorClass}
                          slaLabel={step.slaLabel || (step.slaHours ? `${step.slaHours}h` : '')}
                          isExcludedFromTotalSla={step.isExcludedFromTotalSla}
                          subText={step.code === 'hoan_thanh' || step.code === 'tra_ket_qua' ? stepStaff : formatStaffInfo(stepStaff)}
                        />
                      );
                    })
                  ) : (
                    <p className="text-xs text-gray-400 italic py-4 text-center">Chưa có dữ liệu tiến độ</p>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {systemReceiptData && (
        <SystemReceiptTemplate 
          data={systemReceiptData} 
          receivingWard={record.ward || ''} 
          currentUser={currentUser} 
          onClose={() => setSystemReceiptData(null)} 
        />
      )}

      <DocxPreviewModal 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
        docxBlob={previewBlob} 
        fileName={previewFileName} 
      />

      {/* EXTENSION MODAL OVERLAY */}
      {showExtendForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">
            <div className="bg-amber-500 px-5 py-3.5 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center gap-2 text-base">
                <CalendarClock size={18} />
                Gia hạn ngày hẹn trả
              </h3>
              <button 
                onClick={() => setShowExtendForm(false)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
                <p><span className="font-bold">Mã hồ sơ:</span> <span className="font-mono font-bold text-blue-700">{record.code}</span></p>
                <p><span className="font-bold">Hạn trả hiện tại:</span> {formatDate(record.deadline)}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Ngày hẹn trả mới <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 font-mono"
                  value={extendDate}
                  onChange={(e) => setExtendDate(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowExtendForm(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveExtension}
                  disabled={isExtending}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isExtending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Xác nhận gia hạn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DangKyDetailModal;
