import React, { useState, useEffect } from 'react';
import { RecordFile, Employee, User, UserRole, RecordStatus } from '../types';
import { getNormalizedWard, getShortRecordType } from '../constants';
import StatusBadge from './StatusBadge';
import { 
  X, MapPin, FileText, User as UserIcon, Receipt, DollarSign, 
  CheckCircle2, Circle, Send, FileSignature, CheckSquare, 
  CalendarClock, FileCheck, Loader2, StickyNote, 
  Save, Bell, Printer, Pencil, Trash2, Info, Undo2,
  Archive, FolderSearch, Phone, Hash, ShieldCheck, Building2, Calendar
} from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import DocxPreviewModal from './DocxPreviewModal';
import { updateRecordApi } from '../services/api';
import SystemReceiptTemplate from './receive-record/SystemReceiptTemplate';
import { getEmployeeName as getEmpNameHelper, extractBatchOnly } from '../utils/appHelpers';
import { AutoResizeTextarea } from './AutoResizeTextarea';

const parseAuthDocType = (str: string | null | undefined) => {
  if (!str) return { cccd: '', address: '', phone: '' };
  const parts = str.split('|');
  const firstPart = parts[0] || '';
  const secondPart = parts[1] || '';
  const thirdPart = parts[2] || '';
  
  const knownDocTypes = ['Hợp đồng ủy quyền', 'Giấy ủy quyền', 'Văn bản ủy quyền', 'Hợp đồng uỷ quyền', 'Giấy uỷ quyền', 'Văn bản uỷ quyền', 'Khác'];
  const isDocType = knownDocTypes.some(type => firstPart.toLowerCase().includes(type.toLowerCase()));
  
  if (isDocType) {
    if (parts.length >= 4) {
      return { cccd: parts[2] || '', address: parts[3] || '', phone: parts[4] || '' };
    }
    return { cccd: '', address: '', phone: '' };
  } else {
    return {
      cccd: firstPart,
      address: secondPart,
      phone: thirdPart
    };
  }
};

const parseAttachedDocs = (otherDocsStr: string | null | undefined, attachedDocs?: any[] | null): { name: string; type: string }[] => {
  if (attachedDocs && Array.isArray(attachedDocs) && attachedDocs.length > 0) {
    return attachedDocs.map(d => ({
      name: d.name || '',
      type: d.type || 'Bản chính'
    }));
  }
  if (!otherDocsStr) return [];
  try {
    const parsed = JSON.parse(otherDocsStr);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        name: item.name || '',
        type: item.type === 'Bản sao' ? 'Bản sao' : 'Bản chính'
      }));
    }
  } catch (e) {
    const parts = otherDocsStr.split('|');
    if (parts[0] && !parts[0].startsWith('{') && !parts[0].startsWith('[')) {
      return [{
        name: parts[0],
        type: parts[1] === 'Bản sao' ? 'Bản sao' : 'Bản chính'
      }];
    }
  }
  return [];
};

export interface LuuTruDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  employees: Employee[];
  users: User[];
  currentUser: User | null;
  onEdit?: (record: RecordFile) => void;
  onDelete?: (record: RecordFile) => void;
  onRefreshData?: () => void;
  onOpenRejectReturnModal?: (record: RecordFile) => void;
  onOpenExtendModal?: (record: RecordFile) => void;
}

export const LuuTruDetailModal: React.FC<LuuTruDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  employees,
  users,
  currentUser,
  onEdit,
  onDelete,
  onRefreshData,
  onOpenRejectReturnModal,
  onOpenExtendModal
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemReceiptData, setSystemReceiptData] = useState<Partial<RecordFile> | null>(null);

  // State cho Ghi chú cá nhân
  const [personalNote, setPersonalNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // State cho Nhắc việc
  const [reminderDate, setReminderDate] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  useEffect(() => {
    if (record) {
      setPersonalNote(record.personalNotes || '');
      if (record.reminderDate) {
        setReminderDate(record.reminderDate.split('T')[0]);
      } else {
        setReminderDate('');
      }
    }
  }, [record?.id, record?.personalNotes, record?.reminderDate, isOpen]);

  if (!isOpen || !record) return null;

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
  const isOneDoor = currentUser?.role === UserRole.ONEDOOR;
  const canPerformAction = isAdmin || isSubadmin || isOneDoor;
  const canPrintReceipt = isAdmin || isOneDoor;

  const isCongVan = getShortRecordType(record.recordType) === '1.2 Công văn' || (record.recordType || '').toLowerCase().includes('công văn');

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '---';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  const handleSavePersonalNote = async () => {
    setIsSavingNote(true);
    const updatedRecord = { ...record, personalNotes: personalNote };
    const result = await updateRecordApi(updatedRecord);
    setIsSavingNote(false);
    
    if (result) {
      alert('Đã lưu ghi chú cá nhân thành công!');
      if (onRefreshData) onRefreshData();
    } else {
      alert('Lỗi khi lưu ghi chú.');
    }
  };

  const handleSaveReminder = async () => {
    setIsSavingReminder(true);
    const newReminderDate = reminderDate ? new Date(reminderDate).toISOString() : null;
    const updatedRecord = { 
      ...record, 
      reminderDate: newReminderDate as string, 
      lastRemindedAt: null as any 
    };
    
    const result = await updateRecordApi(updatedRecord);
    setIsSavingReminder(false);
    
    if (result) {
      alert('Đã lưu lịch nhắc việc!');
      if (onRefreshData) onRefreshData();
    } else {
      alert('Lỗi khi lưu nhắc việc.');
    }
  };

  const handlePrintReceipt = async () => {
    if (!currentUser) return;
    
    if (!hasTemplate(STORAGE_KEYS.RECEIPT_TEMPLATE)) {
      setSystemReceiptData(record);
      return;
    }

    setIsProcessing(true);

    const rDate = record.receivedDate ? new Date(record.receivedDate) : new Date();
    const dDate = record.deadline ? new Date(record.deadline) : new Date();
    
    const standardDays = "10"; 
    let tp1Value = isCongVan ? 'Phiếu tiếp nhận Công văn' : 'Phiếu yêu cầu Cung cấp thông tin, dữ liệu đất đai';
    if (record.ward) {
      tp1Value += ` tại ${getNormalizedWard(record.ward)}`;
    }

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

    const val = (v: any) => (v === undefined || v === null) ? "" : String(v);

    const printData = {
      code: val(record.code),
      customerName: val(record.customerName),
      landPlot: val(record.landPlot),
      mapSheet: val(record.mapSheet),
      XAPHUONG: val(getNormalizedWard(record.ward)),
      NGAYNHAN: dateFullString,
      NGAY_NHAN: dateShortString, 
      LOAI_GIAY_TO_UY_QUYEN: "",
      DIA_CHI_CHI_TIET: val(record.address),
      MA: val(record.code), 
      SO_HS: val(record.code), 
      MA_HO_SO: val(record.code),
      CODE: val(record.code),
      TEN: val(record.customerName).toUpperCase(), 
      HO_TEN: val(record.customerName).toUpperCase(),
      CHU_SU_DUNG: val(record.customerName).toUpperCase(),
      KHACH_HANG: val(record.customerName).toUpperCase(),
      ONG_BA: val(record.customerName).toUpperCase(),
      SDT: val(record.phoneNumber), 
      DIEN_THOAI: val(record.phoneNumber),
      PHONE: val(record.phoneNumber),
      CCCD: val(record.cccd), 
      CMND: val(record.cccd),
      DIA_CHI_CHU_SU_DUNG: val(record.customerAddress),
      DIA_CHI: val(record.address || getNormalizedWard(record.ward)),
      DC: val(record.address || getNormalizedWard(record.ward)),
      ADDRESS: val(record.address || getNormalizedWard(record.ward)),
      XA: val(getNormalizedWard(record.ward)), 
      PHUONG: val(getNormalizedWard(record.ward)),
      WARD: val(getNormalizedWard(record.ward)),
      TO: val(record.mapSheet), 
      SO_TO: val(record.mapSheet),
      THUA: val(record.landPlot), 
      SO_THUA: val(record.landPlot),
      DT: val(record.area), 
      DIEN_TICH: val(record.area),
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
      NOI_DUNG: val(record.content),
      CONTENT: val(record.content),
      LOAI_HS: val(record.recordType), 
      RECORD_TYPE: val(record.recordType),
      GIAY_TO_KHAC: val(record.otherDocs),
      NGUOI_UY_QUYEN: "",
      UY_QUYEN: "",
      LOAI_UY_QUYEN: "",
      TGTRA: standardDays, 
      SO_NGAY: standardDays,
      TP1: tp1Value, 
      TIEU_DE: tp1Value,
      SDTLH: "", 
      TINH: "Bình Phước", 
      HUYEN: "huyện Hớn Quản"
    };

    const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
    setIsProcessing(false);

    if (blob) {
      setPreviewBlob(blob);
      setPreviewFileName(`Phieu_LuuTru_${record.code}`);
      setIsPreviewOpen(true);
    }
  };

  const TimelineItem = ({ date, label, icon: Icon, isLast, colorClass, forceActive, subText }: any) => {
    const isActive = !!date || !!forceActive;
    return (
      <div className="relative flex gap-4">
        <div className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 bg-white ${isActive ? colorClass.border : 'border-gray-200'}`}>
            {isActive ? <CheckCircle2 size={16} className={colorClass.text} /> : <Circle size={16} className="text-gray-300" />}
          </div>
          {!isLast && <div className={`w-0.5 grow ${isActive ? colorClass.bg : 'bg-gray-100'} my-1`}></div>}
        </div>
        <div className="pb-6">
          <p className={`text-xs font-bold uppercase mb-0.5 ${isActive ? colorClass.text : 'text-gray-400'}`}>{label}</p>
          <div className="flex items-center gap-2">
            <Icon size={14} className={isActive ? 'text-gray-500' : 'text-gray-300'} />
            <span className={`text-sm font-medium ${isActive ? 'text-gray-800' : 'text-gray-400 italic'}`}>
              {date ? formatDate(date) : (forceActive ? 'Đã hoàn tất' : 'Chưa thực hiện')}
            </span>
          </div>
          {subText && <p className="text-[11px] text-teal-700 mt-1 italic">{subText}</p>}
        </div>
      </div>
    );
  };

  const getDisplayStatus = (r: RecordFile) => {
    if (r.status) return r.status;
    if (r.resultReturnedDate) return RecordStatus.RETURNED;
    if ((r.exportBatch || r.exportDate) && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.RETURNED && r.status !== RecordStatus.REJECTED) {
      return RecordStatus.HANDOVER;
    }
    return RecordStatus.RECEIVED;
  };

  const displayStatus = getDisplayStatus(record);

  // Timeline active steps for Archive
  const isWorkDone = [
    RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.completedWorkDate;

  const isPendingSignActive = [
    RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.submissionDate;

  const isSignedActive = [
    RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.approvalDate;

  const authParsed = parseAuthDocType(record.authDocType);
  const authName = record.authorizedPersonName || record.authorizedBy;
  const authCccd = record.authorizedPersonId || authParsed.cccd;
  const authPhone = record.authorizedPersonPhone || authParsed.phone;
  const authAddress = record.authorizedPersonAddress || authParsed.address;
  const hasAuthPerson = !isCongVan && !!(authName || authCccd || authPhone || authAddress);

  // Lưu trữ fee calculation: Cố định 310.000 đ nếu là Cung cấp tài liệu / Sao lục hoặc theo returnedPrice/price
  const archiveFeeText = (() => {
    if (record.returnedPrice !== undefined && record.returnedPrice !== null) {
      return record.returnedPrice.toLocaleString('vi-VN') + ' đ';
    }
    if (record.price !== undefined && record.price !== null && record.price > 0) {
      return record.price.toLocaleString('vi-VN') + ' đ';
    }
    if (!isCongVan) {
      return '310.000 đ';
    }
    return '0 đ (Công văn)';
  })();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col animate-fade-in-up">
        
        {/* HEADER */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <span className="bg-teal-700 text-white font-mono font-bold px-3 py-1 rounded-lg text-sm shadow-xs">
              {record.code}
            </span>
            <h2 className="text-base font-bold text-gray-800 uppercase tracking-tight">{record.recordType}</h2>
            <StatusBadge status={displayStatus} />
          </div>
          
          <div className="flex items-center gap-2">
            {/* Nút Trả hồ sơ */}
            {onOpenRejectReturnModal && (record.status === RecordStatus.PENDING_CHECK || record.status === RecordStatus.CHECKED || record.status === RecordStatus.PENDING_SIGN || record.status === RecordStatus.SIGNED) && (
              <button
                onClick={() => { onClose(); onOpenRejectReturnModal(record); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-100 transition-colors text-xs font-bold shadow-xs cursor-pointer"
                title="Trả hồ sơ (Yêu cầu sửa / bổ sung / hủy)"
              >
                <Undo2 size={15} /> Trả hồ sơ
              </button>
            )}

            {/* Nút Gia hạn */}
            {onOpenExtendModal && (
              <button
                onClick={() => { onClose(); onOpenExtendModal(record); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors text-xs font-bold shadow-xs cursor-pointer"
                title="Gia hạn ngày hẹn trả"
              >
                <CalendarClock size={15} /> Gia hạn
              </button>
            )}

            {/* Nút In phiếu yêu cầu / tiếp nhận */}
            {canPrintReceipt && (
              <button 
                onClick={handlePrintReceipt}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-teal-300 text-teal-700 rounded-lg hover:bg-teal-50 transition-colors text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                In biên nhận
              </button>
            )}
            
            {/* Sửa */}
            {canPerformAction && onEdit && (
              <button 
                onClick={() => { onClose(); onEdit(record); }} 
                className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="Chỉnh sửa thông tin hồ sơ"
              >
                <Pencil size={18} />
              </button>
            )}
            
            {/* Xóa */}
            {canPerformAction && onDelete && (isAdmin || isSubadmin) && (
              <button 
                onClick={() => { onClose(); onDelete(record); }} 
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Xóa hồ sơ"
              >
                <Trash2 size={18} />
              </button>
            )}

            <div className="w-px h-6 bg-gray-200 mx-1"></div>

            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMN 1: THÔNG TIN YÊU CẦU & ĐỊA BÀN TRA CỨU */}
            <div className="space-y-6">
              
              {/* KHÁCH HÀNG HOẶC NƠI GỬI CÔNG VĂN */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="text-xs font-bold text-teal-700 uppercase mb-3.5 flex items-center gap-2 border-l-4 border-teal-600 pl-2">
                  <UserIcon size={16}/> {isCongVan ? 'Thông tin nơi gửi / Công văn' : 'Thông tin người yêu cầu sao lục'}
                </h3>
                
                {isCongVan ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Số, ký hiệu Công văn</label>
                      <p className="text-base font-bold text-gray-900 font-mono">{record.issueNumber || record.customerName || '---'}</p>
                    </div>
                    {record.issueDate && (
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Ngày văn bản</label>
                        <p className="text-sm font-bold text-gray-800">{formatDate(record.issueDate)}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Cơ quan ban hành / Nơi gửi</label>
                      <p className="text-sm font-bold text-teal-900">{record.customerName || record.issueNumber || '---'}</p>
                    </div>
                    {record.phoneNumber && (
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Số điện thoại liên hệ</label>
                        <p className="text-sm font-bold text-gray-800 font-mono">{record.phoneNumber}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Người yêu cầu / Chủ sử dụng</label>
                      <p className="text-base font-bold text-gray-900">{record.customerName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Số điện thoại</label>
                        <p className="text-sm font-bold text-gray-800 font-mono">{record.phoneNumber || '---'}</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Số CCCD / CMND</label>
                        <p className="text-sm font-bold text-gray-800 font-mono">{record.cccd || '---'}</p>
                      </div>
                    </div>
                    {record.customerAddress && (
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Địa chỉ thường trú</label>
                        <p className="text-xs font-medium text-gray-700">{record.customerAddress}</p>
                      </div>
                    )}

                    {/* Người nộp thay */}
                    {hasAuthPerson && (
                      <div className="border-t border-gray-100 pt-3 mt-2">
                        <label className="text-[10px] text-teal-700 uppercase font-bold block mb-1.5 flex items-center gap-1">
                          <ShieldCheck size={13} /> Người nộp thay / Được ủy quyền
                        </label>
                        <div className="space-y-1.5 bg-teal-50/50 p-3 rounded-lg border border-teal-100 text-xs">
                          {authName && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Họ và tên:</span>
                              <span className="font-bold text-teal-950">{authName}</span>
                            </div>
                          )}
                          {authPhone && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Số điện thoại:</span>
                              <span className="font-bold text-emerald-700 font-mono">{authPhone}</span>
                            </div>
                          )}
                          {authCccd && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Số CCCD:</span>
                              <span className="font-semibold text-gray-800 font-mono">{authCccd}</span>
                            </div>
                          )}
                          {authAddress && (
                            <div className="pt-1 border-t border-teal-100/60">
                              <span className="text-gray-500 block text-[10px]">Địa chỉ liên hệ:</span>
                              <span className="font-medium text-gray-800">{authAddress}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* VỊ TRÍ ĐẤT TRA CỨU / SAO LỤC */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="text-xs font-bold text-emerald-700 uppercase mb-3.5 flex items-center gap-2 border-l-4 border-emerald-600 pl-2">
                  <MapPin size={16}/> Địa bàn & Thửa đất tra cứu
                </h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200/80 text-center">
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Xã/Phường</label>
                    <p className="font-bold text-gray-800 text-xs truncate">{getNormalizedWard(record.ward)}</p>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200/80 text-center">
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Tờ bản đồ</label>
                    <p className="font-bold text-teal-800 text-sm font-mono">{record.mapSheet || '-'}</p>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-200/80 text-center">
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Thửa đất</label>
                    <p className="font-bold text-teal-800 text-sm font-mono">{record.landPlot || '-'}</p>
                  </div>
                </div>

                {record.address && (
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Địa chỉ chi tiết</label>
                    <p className="text-xs font-medium text-gray-800">{record.address}</p>
                  </div>
                )}
              </div>

              {/* REMINDER */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <div className="flex justify-between items-center mb-2.5">
                  <h4 className="text-xs font-bold text-teal-700 uppercase flex items-center gap-1.5">
                    <Bell size={15} /> Hẹn giờ nhắc việc
                  </h4>
                  <button 
                    onClick={handleSaveReminder} 
                    disabled={isSavingReminder}
                    className="text-[10px] bg-teal-600 text-white px-2.5 py-1 rounded-md flex items-center gap-1 hover:bg-teal-700 disabled:opacity-50 font-bold transition-all cursor-pointer"
                  >
                    {isSavingReminder ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Lưu
                  </button>
                </div>
                <input 
                  type="date" 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all font-mono"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                />
              </div>

              {/* PERSONAL NOTE */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-teal-700 font-bold text-xs uppercase">
                    <StickyNote size={15} />
                    <span>Ghi chú cá nhân</span>
                  </div>
                  <button 
                    onClick={handleSavePersonalNote} 
                    disabled={isSavingNote}
                    className="text-[10px] bg-teal-600 text-white px-2.5 py-1 rounded-md flex items-center gap-1 hover:bg-teal-700 disabled:opacity-50 font-bold transition-all cursor-pointer"
                  >
                    {isSavingNote ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                    Lưu
                  </button>
                </div>
                <AutoResizeTextarea
                  minRows={1}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 leading-relaxed"
                  placeholder="Nhập ghi chú riêng của bạn..."
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                />
              </div>
            </div>

            {/* COLUMN 2: CHI TIẾT TÀI LIỆU YÊU CẦU & THU PHÍ LƯU TRỮ */}
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
                
                {/* NỘI DUNG CHI TIẾT / TRÍCH YẾU YÊU CẦU */}
                <div>
                  <h3 className="text-xs font-bold text-teal-700 uppercase mb-2 flex items-center gap-1.5 border-l-4 border-teal-600 pl-2">
                    <FolderSearch size={16}/> Nội dung trích yếu / Yêu cầu sao lục
                  </h3>
                  <div className="bg-gray-50 px-3.5 py-2.5 rounded-lg border border-gray-200/80 text-gray-800 text-xs font-medium leading-relaxed whitespace-pre-line">
                    {record.content ? record.content : <span className="text-gray-400 italic">Không có nội dung chi tiết.</span>}
                  </div>
                </div>

                {/* BẢNG GIẤY TỜ KÈM THEO */}
                <div className="border-t border-gray-100 pt-3">
                  <label className="text-[10px] text-teal-700 uppercase font-bold block mb-1.5 flex items-center gap-1">
                    <FileText size={12} /> Giấy tờ / Hồ sơ kèm theo
                  </label>
                  {(() => {
                    const attachedDocsList = parseAttachedDocs(record.otherDocs, record.attachedDocs);
                    if (attachedDocsList.length > 0) {
                      return (
                        <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase">
                                <th className="py-1.5 px-2 text-center w-8">#</th>
                                <th className="py-1.5 px-2">Tên giấy tờ / Hồ sơ</th>
                                <th className="py-1.5 px-2 w-24 text-center">Hình thức</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {attachedDocsList.map((doc, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="py-1.5 px-2 text-center font-bold text-gray-400">{idx + 1}</td>
                                  <td className="py-1.5 px-2 font-medium text-gray-800">{doc.name}</td>
                                  <td className="py-1.5 px-2 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      doc.type === 'Bản chính' || doc.type === 'Chính'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}>
                                      {doc.type === 'Bản chính' ? 'Chính' : doc.type === 'Bản sao' ? 'Sao' : (doc.type || 'Chính')}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }
                    if (record.otherDocs && typeof record.otherDocs === 'string' && !record.otherDocs.startsWith('[') && !record.otherDocs.startsWith('{')) {
                      return (
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-gray-200 text-xs text-gray-700 font-medium">
                          {record.otherDocs}
                        </div>
                      );
                    }
                    return (
                      <div className="text-xs text-gray-400 italic bg-slate-50/50 p-2.5 rounded-lg border border-dashed border-gray-200">
                        Chưa có giấy tờ kèm theo.
                      </div>
                    );
                  })()}
                </div>

                {/* THU PHÍ LƯU TRỮ & BIÊN LAI / HÓA ĐƠN */}
                <div className="border-t border-gray-100 pt-3.5 space-y-3">
                  <label className="text-xs font-bold text-slate-800 uppercase block flex items-center gap-1.5">
                    <Receipt size={16} className="text-emerald-600" />
                    <span>Lệ phí & Thu tiền Cung cấp thông tin</span>
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Số tiền thu */}
                    <div className="bg-emerald-50/90 p-3 rounded-xl border border-emerald-200/90 flex flex-col justify-center">
                      <label className="text-[10px] text-emerald-700 uppercase font-bold block whitespace-nowrap truncate">
                        Phí Cung cấp thông tin
                      </label>
                      <p className="text-base font-black text-emerald-800 font-mono whitespace-nowrap truncate mt-0.5">
                        {archiveFeeText}
                      </p>
                    </div>

                    {/* Số Biên lai / Hóa đơn */}
                    <div className="bg-blue-50/90 p-3 rounded-xl border border-blue-200/90 flex flex-col justify-center">
                      <label className="text-[10px] text-blue-700 uppercase font-bold block whitespace-nowrap truncate">
                        {record.receiptType === 'Biên Lai' ? 'Số Biên Lai' : record.receiptType === 'Hóa Đơn' ? 'Số Hóa Đơn' : 'Số BL / Hóa Đơn'}
                      </label>
                      <p className="text-xs font-black text-blue-900 font-mono whitespace-nowrap truncate mt-0.5">
                        {record.receiptNumber || '---'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ghi chú nội bộ */}
                {record.privateNotes && (
                  <div className="border-t border-dashed border-gray-200 pt-3">
                    <div className="bg-amber-50/80 p-3 rounded-lg border border-amber-200">
                      <div className="flex items-center gap-1.5 mb-1 text-amber-800 font-bold text-xs">
                        <Info size={14} />
                        <span>Ghi chú nội bộ</span>
                      </div>
                      <p className="text-amber-900 text-xs italic">"{record.privateNotes}"</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 3: TIẾN ĐỘ XỬ LÝ LƯU TRỮ & SAO LỤC */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="bg-teal-700 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <CalendarClock size={16} />
                    <span className="text-xs font-bold uppercase">Tiến độ Lưu trữ & Sao lục</span>
                  </div>
                </div>
                
                <div className="p-5 text-center border-b border-gray-100 bg-slate-50/60">
                  <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Hạn trả kết quả</label>
                  <p className="text-2xl font-black text-gray-900 font-mono">{formatDate(record.deadline)}</p>
                  <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full mt-1.5 inline-block font-mono">
                    Ngày tiếp nhận: {formatDate(record.receivedDate)}
                  </span>
                </div>

                <div className="p-5 space-y-0">
                  <TimelineItem 
                    date={record.receivedDate} 
                    label="1. TIẾP NHẬN YÊU CẦU" 
                    icon={UserIcon}
                    colorClass={{text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
                    subText={record.receivedBy ? (() => {
                      const receiver = users.find(u => u.employeeId === record.receivedBy);
                      if (!receiver) return undefined;
                      const emp = employees.find(e => e.id === receiver.employeeId);
                      return `${receiver.name} (${emp?.position || 'Nhân viên tiếp nhận'})`;
                    })() : undefined}
                  />

                  <TimelineItem 
                    date={record.assignedDate || record.completedWorkDate} 
                    forceActive={isWorkDone || !!record.assignedDate}
                    label="2. TRA CỨU & XỬ LÝ HỒ SƠ" 
                    icon={FolderSearch}
                    colorClass={{text: 'text-teal-700', border: 'border-teal-600', bg: 'bg-teal-600'}}
                    subText={record.assignedTo ? (() => {
                      const emp = employees.find(e => e.id === record.assignedTo);
                      if (!emp) return undefined;
                      return emp.position ? `${emp.name} (${emp.position})` : emp.name;
                    })() : undefined}
                  />

                  <TimelineItem 
                    date={record.submissionDate || record.approvalDate} 
                    forceActive={isPendingSignActive || isSignedActive}
                    label="3. TRÌNH KÝ DUYỆT" 
                    icon={FileSignature}
                    colorClass={{text: 'text-purple-700', border: 'border-purple-600', bg: 'bg-purple-600'}}
                    subText={record.submittedTo ? (() => {
                      const director = users.find(u => u.employeeId === record.submittedTo);
                      if (!director) return undefined;
                      const emp = employees.find(e => e.id === director.employeeId);
                      return `${director.name} (${emp?.position || (director.role === UserRole.ADMIN ? 'Giám đốc' : 'Phó giám đốc')})`;
                    })() : undefined}
                  />
                  
                  <TimelineItem 
                    date={record.completedDate || record.exportDate} 
                    forceActive={!!record.completedDate || !!record.exportDate || !!record.exportBatch}
                    label={record.status === RecordStatus.REJECTED ? "4. TRẢ HỒ SƠ" : record.status === RecordStatus.WITHDRAWN ? "4. CSD RÚT HỒ SƠ" : "4. HOÀN THÀNH SAO LỤC"} 
                    icon={CheckSquare}
                    isLast={false}
                    colorClass={{
                      text: record.status === RecordStatus.REJECTED ? 'text-red-700' : 'text-green-700', 
                      border: record.status === RecordStatus.REJECTED ? 'border-red-600' : 'border-green-600', 
                      bg: record.status === RecordStatus.REJECTED ? 'bg-red-600' : 'bg-green-600'
                    }}
                    subText={record.exportBatch ? `Đợt xuất: ${extractBatchOnly(record.exportBatch)}` : undefined}
                  />
                  
                  <TimelineItem 
                    date={record.resultReturnedDate} 
                    label="5. TRẢ KẾT QUẢ" 
                    icon={FileCheck}
                    isLast={true}
                    colorClass={{text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
                    subText={record.resultReturnedDate && record.receiverName ? `Người nhận: ${record.receiverName}` : undefined}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* MODALS PHỤ TRỢ: DOCX PREVIEW & SYSTEM RECEIPT */}
        <DocxPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          docxBlob={previewBlob}
          fileName={previewFileName}
        />

        {systemReceiptData && (
          <SystemReceiptTemplate 
            data={systemReceiptData} 
            receivingWard={employees.find(e => e.id === currentUser?.employeeId)?.managedWards?.[0] || 'Tân Khai'}
            onClose={() => setSystemReceiptData(null)} 
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
};

export default LuuTruDetailModal;
