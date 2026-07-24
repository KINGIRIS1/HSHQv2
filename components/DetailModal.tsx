
import React, { useState, useEffect } from 'react';
import { RecordFile, Employee, User, UserRole, SplitItem, RecordStatus } from '../types';
import { getNormalizedWard, getShortRecordType } from '../constants';
import StatusBadge from './StatusBadge';
import { X, MapPin, FileText, User as UserIcon, Receipt, DollarSign, CheckCircle2, Circle, Send, FileSignature, CheckSquare, CalendarClock, FileCheck, Calculator, Loader2, StickyNote, Save, Bell, Printer, Pencil, Trash2, Info, FileDown } from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import DocxPreviewModal from './DocxPreviewModal';
import { updateRecordApi, fetchContracts } from '../services/api';
import SystemReceiptTemplate from './receive-record/SystemReceiptTemplate';
import SystemAnnexTemplate from './receive-record/SystemAnnexTemplate';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  employees: Employee[];
  users: User[];
  currentUser: User | null;
  onEdit?: (record: RecordFile) => void;
  onDelete?: (record: RecordFile) => void;
  onCreateLiquidation?: (record: RecordFile) => void; 
  onCreateContract?: (record: Partial<RecordFile>) => void;
  onRefreshData?: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, record, employees, users, currentUser, onEdit, onDelete, onCreateLiquidation, onCreateContract, onRefreshData }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemReceiptData, setSystemReceiptData] = useState<Partial<RecordFile> | null>(null);
  
  // State cho Gia hạn ngày hẹn
  const [showExtendForm, setShowExtendForm] = useState(false);
  const [extendDate, setExtendDate] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [isExtending, setIsExtending] = useState(false);

  // State cho Ghi chú cá nhân
  const [personalNote, setPersonalNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // State cho Nhắc nhở
  const [reminderDate, setReminderDate] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  // State cho giá hợp đồng
  const [contractPrice, setContractPrice] = useState<number | null>(null);
  const [contractSplitItems, setContractSplitItems] = useState<SplitItem[] | null>(null);
  
  // State cho Thanh lý
  const [liquidationInfo, setLiquidationInfo] = useState<{ amount: number, content: string } | null>(null);

  // State cho Phụ lục
  const [isAnnexModalOpen, setIsAnnexModalOpen] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [matchedContract, setMatchedContract] = useState<any | null>(null);

  useEffect(() => {
      if (record) {
          setPersonalNote(record.personalNotes || '');
          // Chuyển ISO string sang format datetime-local (yyyy-MM-ddTHH:mm) để hiển thị trong input
          if (record.reminderDate) {
              const d = new Date(record.reminderDate);
              const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
              setReminderDate(localIso);
          } else {
              setReminderDate('');
          }

          // Fetch Contract Price & Details
          const fetchPrice = async () => {
              const fetchedContracts = await fetchContracts();
              setContracts(fetchedContracts);
              // Tìm hợp đồng có cùng mã hồ sơ (qua customerAddress hoặc trường code kế thừa) - Case insensitive
              const match = fetchedContracts.find(c => 
                  (c.customerAddress && record.code && c.customerAddress.trim().toLowerCase() === record.code.trim().toLowerCase()) ||
                  (c.code && record.code && c.code.trim().toLowerCase() === record.code.trim().toLowerCase())
              );
              
              if (match) {
                  setMatchedContract(match);
                  // GIÁ TRỊ HỢP ĐỒNG (Lấy từ totalAmount - giá trị lúc lập hợp đồng)
                  setContractPrice(match.totalAmount ?? null);
                  setContractSplitItems(match.splitItems || null);

                  // GIÁ TRỊ THANH LÝ (Lấy từ liquidationAmount - nếu đã nhập)
                  if (match.liquidationAmount !== null && match.liquidationAmount !== undefined) {
                      
                      let liquidationLabel = 'Thanh lý hợp đồng';
                      const cType = (match.contractType || '').toLowerCase();
                      const sType = (match.serviceType || '').toLowerCase();

                      if (cType.includes('trích lục') || sType.includes('trích lục')) {
                          liquidationLabel = 'Thanh lý trích lục';
                      } else if (cType.includes('cắm mốc') || sType.includes('cắm mốc')) {
                          liquidationLabel = 'Thanh lý cắm mốc';
                      } else if (cType.includes('tách thửa') || sType.includes('tách thửa')) {
                          liquidationLabel = 'Thanh lý tách thửa';
                      } else if (cType.includes('đo đạc') || sType.includes('đo đạc')) {
                          liquidationLabel = 'Thanh lý đo đạc';
                      }

                      setLiquidationInfo({
                          amount: match.liquidationAmount, 
                          content: liquidationLabel
                      });
                  } else {
                      setLiquidationInfo(null);
                  }

              } else {
                  setMatchedContract(null);
                  // Fallback: Nếu không có hợp đồng nhưng là hồ sơ Trích lục -> Hiển thị 53.163
                  const type = (record.recordType || '').toLowerCase();
                  if (type.includes('trích lục')) {
                      setContractPrice(53163);
                  } else {
                      setContractPrice(null);
                  }
                  setContractSplitItems(null);
                  setLiquidationInfo(null);
              }
          };
          fetchPrice();
      }
  }, [record]);

  if (!isOpen || !record) return null;

  const parsedAuth = (() => {
      if (!record.authDocType) return { cccd: '', address: '' };
      const parts = record.authDocType.split('|');
      const firstPart = parts[0] || '';
      const secondPart = parts[1] || '';
      const knownDocTypes = ['Hợp đồng ủy quyền', 'Giấy ủy quyền', 'Văn bản ủy quyền', 'Hợp đồng uỷ quyền', 'Giấy uỷ quyền', 'Văn bản uỷ quyền', 'Khác'];
      const isDocType = knownDocTypes.some(type => firstPart.toLowerCase().includes(type.toLowerCase()));
      if (isDocType) {
          if (parts.length >= 4) {
              return { cccd: parts[2] || '', address: parts[3] || '' };
          }
          return { cccd: '', address: '' };
      }
      return { cccd: firstPart, address: secondPart };
  })();

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
  const isOneDoor = currentUser?.role === UserRole.ONEDOOR;

  const canPerformAction = isAdmin || isSubadmin || isOneDoor; // Điều kiện để Sửa, Xóa
  
  // Điều kiện để In biên nhận: Chỉ Admin hoặc Một cửa mới được thấy nút này
  const canPrintReceipt = isAdmin || isOneDoor;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const getEmployeeName = (id?: string | null) => {
    if (!id) return 'Chưa giao';
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.name} (${emp.department})` : 'Không xác định';
  };

  const handleSavePersonalNote = async () => {
      setIsSavingNote(true);
      const updatedRecord = { ...record, personalNotes: personalNote };
      const result = await updateRecordApi(updatedRecord);
      setIsSavingNote(false);
      
      if (result) {
          alert('Đã lưu ghi chú cá nhân thành công!');
      } else {
          alert('Lỗi khi lưu ghi chú.');
      }
  };

  const handleSaveReminder = async () => {
      setIsSavingReminder(true);
      
      // Nếu user xóa trắng input -> xóa nhắc nhở
      const newReminderDate = reminderDate ? new Date(reminderDate).toISOString() : null;
      
      // Reset lastRemindedAt khi đặt lịch mới để hệ thống nhắc lại từ đầu
      const updatedRecord = { 
          ...record, 
          reminderDate: newReminderDate as string, 
          lastRemindedAt: null as any 
      };
      
      const result = await updateRecordApi(updatedRecord);
      setIsSavingReminder(false);
      
      if (result) {
          alert('Đã lưu lịch nhắc nhở!');
          // Cập nhật lại record local nếu cần thiết (thường App sẽ auto refresh)
      } else {
          alert('Lỗi khi lưu nhắc nhở.');
      }
  };

  const handleSaveExtension = async () => {
      if (!record) return;
      if (!extendDate) {
          alert('Vui lòng chọn ngày hẹn mới.');
          return;
      }
      if (!extendReason.trim()) {
          alert('Vui lòng nhập lý do gia hạn.');
          return;
      }

      setIsExtending(true);
      
      const nowStr = new Date().toLocaleString('vi-VN');
      const userLabel = currentUser ? `${currentUser.name} (${currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Quản trị'})` : 'Hệ thống';
      const extensionNote = `[Gia hạn ngày hẹn] Hạn cũ: ${formatDate(record.deadline)} -> Hạn mới: ${formatDate(extendDate)}. Lý do: ${extendReason.trim()} (Bởi: ${userLabel} lúc ${nowStr})`;
      
      const newPrivateNotes = record.privateNotes 
          ? `${record.privateNotes}\n${extensionNote}` 
          : extensionNote;

      const updatedRecord: RecordFile = {
          ...record,
          deadline: extendDate,
          privateNotes: newPrivateNotes
      };

      try {
          const result = await updateRecordApi(updatedRecord);
          if (result) {
              alert('Đã gia hạn ngày hẹn thành công!');
              setShowExtendForm(false);
              setExtendReason('');
              setExtendDate('');
              if (onRefreshData) {
                  onRefreshData();
              }
              // Cập nhật local state tức thời cho UI hiển thị
              record.deadline = extendDate;
              record.privateNotes = newPrivateNotes;
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

  const handlePrintReceipt = async () => {
    if (!currentUser) return;
    
    if (!hasTemplate(STORAGE_KEYS.RECEIPT_TEMPLATE)) {
        setSystemReceiptData(record);
        return;
    }

    setIsProcessing(true);

    const rDate = record.receivedDate ? new Date(record.receivedDate) : new Date();
    const dDate = record.deadline ? new Date(record.deadline) : new Date();
    
    let standardDays = "30"; 
    const type = (record.recordType || '').toLowerCase();

    // Logic tính số ngày
    if (type.includes('trích lục')) {
        standardDays = "10";
    } else if (type.includes('trích đo chỉnh lý')) {
        standardDays = "15"; 
    } else if (type.includes('trích đo') || type.includes('đo đạc') || type.includes('cắm mốc')) {
        standardDays = "30";
    }

    // Logic Tiêu đề phiếu
    let tp1Value = 'Phiếu yêu cầu';
    if (type.includes('chỉnh lý') || type.includes('trích đo') || type.includes('trích lục')) {
        tp1Value = 'Phiếu yêu cầu trích lục, trích đo';
    } 
    else if (type.includes('đo đạc') || type.includes('cắm mốc')) {
        tp1Value = 'Phiếu yêu cầu Đo đạc, cắm mốc';
    }
    if (record.ward) {
        tp1Value += ` tại ${getNormalizedWard(record.ward)}`;
    }
    
    // Logic SĐT Liên hệ tự động
    let sdtLienHe = "";
    const wRaw = (record.ward || "").toLowerCase();
    if (wRaw.includes("minh hưng") || wRaw.includes("minh hung")) {
        sdtLienHe = "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757";
    } else if (wRaw.includes("nha bích") || wRaw.includes("nha bich")) {
        sdtLienHe = "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344";
    } else if (wRaw.includes("chơn thành") || wRaw.includes("chon thanh")) {
        sdtLienHe = "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691";
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
        // --- ENGLISH RAW KEYS (Requested) ---
        code: val(record.code),
        customerName: val(record.customerName),
        landPlot: val(record.landPlot),
        mapSheet: val(record.mapSheet),
        
        // --- VIETNAMESE KEYS (Formatted per request) ---
        XAPHUONG: val(getNormalizedWard(record.ward)),
        
        // NGAYNHAN: ngày tháng năm
        NGAYNHAN: dateFullString,
        
        // NGAY_NHAN: dd/mm/yyyy
        NGAY_NHAN: dateShortString, 
        
        LOAI_GIAY_TO_UY_QUYEN: "",
        DIA_CHI_CHI_TIET: val(record.address),

        // --- NHÓM THÔNG TIN CƠ BẢN ---
        MA: val(record.code), 
        SO_HS: val(record.code), 
        MA_HO_SO: val(record.code),
        CODE: val(record.code),

        // --- NHÓM CHỦ SỬ DỤNG ---
        TEN: val(record.customerName).toUpperCase(), 
        HO_TEN: val(record.customerName).toUpperCase(),
        CHU_SU_DUNG: val(record.customerName).toUpperCase(),
        KHACH_HANG: val(record.customerName).toUpperCase(),
        ONG_BA: val(record.customerName).toUpperCase(),

        // --- NHÓM LIÊN HỆ ---
        SDT: val(record.phoneNumber), 
        DIEN_THOAI: val(record.phoneNumber),
        PHONE: val(record.phoneNumber),
        CCCD: val(record.cccd), 
        CMND: val(record.cccd),
        DIA_CHI_CHU_SU_DUNG: val(record.customerAddress),

        // --- NHÓM ĐỊA CHỈ ---
        DIA_CHI: val(record.address || getNormalizedWard(record.ward)),
        DC: val(record.address || getNormalizedWard(record.ward)),
        ADDRESS: val(record.address || getNormalizedWard(record.ward)),
        XA: val(getNormalizedWard(record.ward)), 
        PHUONG: val(getNormalizedWard(record.ward)),
        WARD: val(getNormalizedWard(record.ward)),
        
        // --- NHÓM THỬA ĐẤT ---
        TO: val(record.mapSheet), 
        SO_TO: val(record.mapSheet),
        THUA: val(record.landPlot), 
        SO_THUA: val(record.landPlot),
        DT: val(record.area), 
        DIEN_TICH: val(record.area),
        
        // --- NHÓM NGÀY THÁNG (ALIASES) ---
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
        
        // --- NHÓM CÁN BỘ ---
        NGUOI_NHAN: val(currentUser?.name), 
        CAN_BO: val(currentUser?.name),
        USER: val(currentUser?.name),
        
        // --- NHÓM NỘI DUNG ---
        NOI_DUNG: val(record.content),
        CONTENT: val(record.content),
        LOAI_HS: val(record.recordType), 
        RECORD_TYPE: val(record.recordType),
        GIAY_TO_KHAC: val(record.otherDocs),
        
        // --- NHÓM ỦY QUYỀN (Không thể hiện trên biên nhận nữa theo yêu cầu) ---
        NGUOI_UY_QUYEN: "",
        UY_QUYEN: "",
        LOAI_UY_QUYEN: "",
        
        // --- CẤU HÌNH ---
        TGTRA: standardDays, 
        SO_NGAY: standardDays,
        TP1: tp1Value, 
        TIEU_DE: tp1Value,
        SDTLH: sdtLienHe, 
        TINH: "Bình Phước", 
        HUYEN: "huyện Hớn Quản"
    };

    const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
    
    setIsProcessing(false);

    if (blob) {
        setPreviewBlob(blob);
        setPreviewFileName(`BienNhan_${record.code}`);
        setIsPreviewOpen(true);
    }
  };

  // Helper cho Timeline
  // Updated: Hỗ trợ forceActive cho các bước không có ngày tháng cụ thể
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
              <div className={`pb-6 ${!isLast ? '' : ''}`}>
                  <p className={`text-xs font-bold uppercase mb-0.5 ${isActive ? colorClass.text : 'text-gray-400'}`}>{label}</p>
                  <div className="flex items-center gap-2">
                      <Icon size={14} className={isActive ? 'text-gray-500' : 'text-gray-300'} />
                      <span className={`text-sm font-medium ${isActive ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                          {date ? formatDate(date) : (forceActive ? 'Đã hoàn tất' : 'Chưa thực hiện')}
                      </span>
                  </div>
                  {subText && <p className="text-[11px] text-indigo-600 mt-1 italic">{subText}</p>}
              </div>
          </div>
      );
  };

  // LOGIC HIỂN THỊ STATUS
  const getDisplayStatus = (r: RecordFile) => {
      if ((r.exportBatch || r.exportDate) && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.RETURNED && r.status !== RecordStatus.REJECTED) {
          return RecordStatus.HANDOVER;
      }
      return r.status;
  };
  const displayStatus = getDisplayStatus(record);
  const recordTypeLower = (record?.recordType || '').toLowerCase();
  const isCongVan = record?.recordType ? getShortRecordType(record.recordType) === '1.2 Công văn' : false;

  // LOGIC CHECK NẾU ĐÃ THỰC HIỆN XONG (Để hiển thị bước "Đã thực hiện")
  const isWorkDone = [
      RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.completedWorkDate;
  
  const isPendingCheckActive = [
      RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.pendingCheckDate;

  const isCheckedActive = [
      RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.checkedDate;

  const isPendingSignActive = [
      RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.submissionDate;

  const isSignedActive = [
      RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.approvalDate;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col animate-fade-in-up">
        
        {/* HEADER */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded text-sm border border-blue-200">
                    {record.code}
                </span>
                <h2 className="text-lg font-bold text-gray-800 uppercase">{record.recordType}</h2>
                <StatusBadge status={displayStatus} />
            </div>
            
            <div className="flex items-center gap-2">
                {onCreateLiquidation && record && record.recordType && (getShortRecordType(record.recordType).startsWith('2.3') || getShortRecordType(record.recordType).startsWith('2.4')) && (
                    <button
                        onClick={() => { onClose(); onCreateLiquidation(record); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded hover:bg-gray-50 transition-colors text-sm font-medium"
                        title="Thanh lý HĐ"
                    >
                        <FileCheck size={16} /> Thanh lý HĐ
                    </button>
                )}

                {record && record.recordType && (getShortRecordType(record.recordType).startsWith('2.3') || getShortRecordType(record.recordType).startsWith('2.4')) && (
                    <button
                        onClick={() => {
                            const hasAnnexTemplate = hasTemplate(STORAGE_KEYS.CONTRACT_TEMPLATE_ANNEX);
                            if (!hasAnnexTemplate) {
                                alert("Chưa có mẫu Phụ lục gia hạn hợp đồng nào được cấu hình trong hệ thống.\nVui lòng vào mục Cài đặt hệ thống để cấu hình mẫu này.");
                                return;
                            }
                            setIsAnnexModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-rose-200 text-rose-600 rounded hover:bg-rose-50 transition-colors text-sm font-medium"
                        title="In phụ lục hợp đồng"
                    >
                        <FileDown size={16} /> Phụ lục
                    </button>
                )}

                {canPrintReceipt && (
                    <button 
                        onClick={handlePrintReceipt}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                        In biên nhận
                    </button>
                )}
                
                {canPerformAction && onEdit && (
                    <button onClick={() => { onClose(); onEdit(record); }} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                        <Pencil size={20} />
                    </button>
                )}
                
                {canPerformAction && onDelete && (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUBADMIN') && (
                    <button onClick={() => { onClose(); onDelete(record); }} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={20} />
                    </button>
                )}

                <div className="w-px h-6 bg-gray-300 mx-2"></div>

                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={24} />
                </button>
            </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLUMN 1: THÔNG TIN CHUNG */}
                <div className="space-y-6">
                    {/* KHÁCH HÀNG */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-xs font-bold text-blue-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-blue-600 pl-2">
                            <UserIcon size={16}/> {isCongVan ? 'Thông tin nơi gửi / nhận' : 'Thông tin chủ hồ sơ'}
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                                    {isCongVan ? 'Số, ký hiệu Công văn' : 'Chủ sử dụng'}
                                </label>
                                <p className="text-base font-bold text-gray-800">{record.customerName}</p>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                                    {isCongVan ? 'Số điện thoại liên hệ' : 'Số điện thoại'}
                                </label>
                                <p className="text-base font-bold text-gray-800">{record.phoneNumber || '---'}</p>
                            </div>
                            {record.customerAddress && (
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Địa chỉ chủ sử dụng</label>
                                    <p className="text-sm font-bold text-gray-800">{record.customerAddress}</p>
                                </div>
                            )}
                            {record.authorizedBy && (
                                <div className="border-t border-gray-100 pt-3 mt-1">
                                    <label className="text-[10px] text-indigo-500 uppercase font-bold block mb-2">Người được ủy quyền</label>
                                    <div className="space-y-1.5 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-500">Họ tên:</span>
                                            <span className="font-bold text-indigo-900">{record.authorizedBy}</span>
                                        </div>
                                        {parsedAuth.cccd && (
                                            <div className="flex justify-between text-xs">
                                                <span className="text-gray-500">CCCD:</span>
                                                <span className="font-semibold text-gray-800">{parsedAuth.cccd}</span>
                                            </div>
                                        )}
                                        {parsedAuth.address && (
                                            <div className="text-xs">
                                                <span className="text-gray-500 block mb-0.5">Địa chỉ thường trú:</span>
                                                <span className="font-semibold text-gray-800 block">{parsedAuth.address}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ĐỊA CHÍNH */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-xs font-bold text-green-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-green-600 pl-2">
                            <MapPin size={16}/> {isCongVan ? 'Văn bản Công văn' : 'Thông tin địa chính'}
                        </h3>
                        {isCongVan ? (
                            <div className="grid grid-cols-1 gap-4">
                                {record.issueNumber && (
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Cơ quan ban hành / Nơi gửi</label>
                                        <p className="text-sm font-bold text-gray-800">{record.issueNumber}</p>
                                    </div>
                                )}
                                {record.issueDate && (
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Ngày Công văn</label>
                                        <p className="text-sm font-bold text-gray-800">{formatDate(record.issueDate)}</p>
                                    </div>
                                )}
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Xã / Phường liên quan</label>
                                    <p className="font-bold text-gray-800 text-sm">{getNormalizedWard(record.ward)}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Xã/Phường</label>
                                        <p className="font-bold text-gray-800 text-sm">{getNormalizedWard(record.ward)}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Tờ bản đồ</label>
                                        <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center">{record.mapSheet || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Thửa đất</label>
                                        <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center">{record.landPlot || '-'}</p>
                                    </div>
                                </div>
                                {record.address && (
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Địa chỉ chi tiết</label>
                                        <p className="text-sm font-bold text-gray-800">{record.address}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* NGƯỜI XỬ LÝ */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-2">Người xử lý hồ sơ</label>
                        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                <UserIcon size={16}/>
                            </div>
                            <span className="font-bold text-sm text-gray-700">{getEmployeeName(record.assignedTo)}</span>
                        </div>

                        {record.status === RecordStatus.PENDING_CHECK || record.status === RecordStatus.CHECKED ? (
                            <div className="mt-4">
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-2">Người kiểm tra</label>
                                <div className="flex items-center gap-3 bg-orange-50 p-3 rounded-lg border border-orange-100">
                                    <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center text-orange-600">
                                        <UserIcon size={16}/>
                                    </div>
                                    <span className="font-bold text-sm text-orange-800">{getEmployeeName(record.checkedBy)}</span>
                                </div>
                            </div>
                        ) : null}
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
                                className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50 font-bold transition-all"
                            >
                                {isSavingReminder ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Lưu
                            </button>
                        </div>
                        <input 
                            type="datetime-local" 
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
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
                                className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50 font-bold transition-all"
                            >
                                {isSavingNote ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                Lưu
                            </button>
                        </div>
                        <textarea
                            rows={3}
                            className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Nhập ghi chú riêng của bạn..."
                            value={personalNote}
                            onChange={(e) => setPersonalNote(e.target.value)}
                        />
                    </div>
                </div>

                {/* COLUMN 2: CHI TIẾT & TÀI CHÍNH */}
                <div className="space-y-6">
                    {/* NỘI DUNG */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
                        <h3 className="text-xs font-bold text-purple-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-purple-600 pl-2">
                            <FileText size={16}/> Nội dung chi tiết
                        </h3>
                        
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-gray-800 text-sm font-medium mb-4 min-h-[80px]">
                            {record.content || 'Không có nội dung chi tiết.'}
                        </div>

                        {record.explanationPlan && (
                            <div className="mb-6">
                                <label className="text-[10px] text-purple-500 uppercase font-bold block mb-1">Phương án giải trình</label>
                                <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-purple-900 text-sm font-medium">
                                    {record.explanationPlan}
                                </div>
                            </div>
                        )}

                        {(recordTypeLower.includes('trích đo') || recordTypeLower.includes('trích lục')) && (
                            <div className="grid grid-cols-2 gap-6 mb-6">
                                {recordTypeLower.includes('trích đo') && (
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Số trích đo</label>
                                        <p className="text-sm font-bold text-gray-800">{record.measurementNumber || '---'}</p>
                                    </div>
                                )}
                                {recordTypeLower.includes('trích lục') && (
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Số trích lục</label>
                                        <p className="text-sm font-bold text-gray-800">{record.excerptNumber || '---'}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                                <div className="bg-blue-200 p-1.5 rounded text-blue-700"><Receipt size={16}/></div>
                                <div>
                                    <label className="text-[10px] text-blue-500 uppercase font-bold block">Số biên lai</label>
                                    <p className="text-sm font-bold text-blue-800">{record.receiptNumber || '---'}</p>
                                </div>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex items-center gap-3">
                                <div className="bg-green-200 p-1.5 rounded text-green-700"><DollarSign size={16}/></div>
                                <div>
                                    <label className="text-[10px] text-green-500 uppercase font-bold block">
                                        {record.returnedPrice !== undefined && record.returnedPrice !== null ? 'Số tiền thực tế thu' : (record.recordType === 'Cung cấp tài liệu đất đai' ? 'Giá trị hồ sơ' : 'Giá trị hợp đồng')}
                                    </label>
                                    <p className="text-sm font-bold text-green-800">
                                        {record.returnedPrice !== undefined && record.returnedPrice !== null
                                            ? record.returnedPrice.toLocaleString('vi-VN') + ' đ'
                                            : (record.recordType === 'Cung cấp tài liệu đất đai' 
                                                ? '310.000 đ' 
                                                : (contractPrice !== null && contractPrice !== undefined ? contractPrice.toLocaleString('vi-VN') + ' đ' : '---'))}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        {/* LIÊN KẾT HỢP ĐỒNG */}
                        {record && record.recordType && (getShortRecordType(record.recordType).startsWith('2.3') || getShortRecordType(record.recordType).startsWith('2.4')) && (
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                {matchedContract ? (
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className="bg-indigo-200 text-indigo-700 p-2 rounded-lg mt-0.5">
                                                <FileText size={16} />
                                            </div>
                                            <div className="text-left">
                                                <span className="text-[10px] text-indigo-500 uppercase font-bold block">Hợp đồng liên kết</span>
                                                <p className="text-sm font-bold text-indigo-900 leading-tight">Số HĐ: {matchedContract.code}</p>
                                                <p className="text-xs text-indigo-600 mt-0.5">{matchedContract.serviceType || matchedContract.contractType}</p>
                                            </div>
                                        </div>
                                        {onCreateContract && (
                                            <button 
                                                onClick={() => {
                                                    onCreateContract(record);
                                                    onClose();
                                                }}
                                                className="inline-flex items-center gap-1 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors duration-200 shadow-sm whitespace-nowrap"
                                            >
                                                Xem chi tiết HĐ
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className="bg-slate-200 text-slate-500 p-2 rounded-lg mt-0.5">
                                                <FileText size={16} />
                                            </div>
                                            <div className="text-left">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold block">Hợp đồng liên kết</span>
                                                <p className="text-xs text-slate-500 mt-1">Hồ sơ này chưa được lập hợp đồng đo đạc.</p>
                                            </div>
                                        </div>
                                        {onCreateContract && (
                                            <button 
                                                onClick={() => {
                                                    onCreateContract(record);
                                                    onClose();
                                                }}
                                                className="inline-flex items-center gap-1 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors duration-200 shadow-sm whitespace-nowrap"
                                            >
                                                Lập Hợp đồng mới
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* GIÁ TRỊ THANH LÝ */}
                        {liquidationInfo && (
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 flex items-center gap-3">
                                    <div className="bg-orange-200 p-1.5 rounded text-orange-700"><Calculator size={16}/></div>
                                    <div>
                                        <label className="text-[10px] text-orange-600 uppercase font-bold block">{liquidationInfo.content}</label>
                                        <p className="text-sm font-bold text-orange-800">{liquidationInfo.amount.toLocaleString('vi-VN')} đ</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Chi tiết tách thửa */}
                        {contractSplitItems && contractSplitItems.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                <span className="text-[10px] font-bold text-gray-400 block mb-2 uppercase">Chi tiết tách thửa</span>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                    {contractSplitItems.map((item, idx) => (
                                        <div key={idx} className="text-xs flex justify-between bg-gray-50 p-2 rounded border border-gray-100">
                                            <span className="text-gray-700">
                                                <span className="font-bold text-blue-600 mr-1">Thửa {idx + 1}:</span> 
                                                <span className="font-bold">{item.area || 0} m²</span>
                                                {item.serviceName ? <span className="text-gray-500 ml-1 italic truncate max-w-[150px] inline-block align-bottom">- {item.serviceName}</span> : ''}
                                            </span>
                                            <span className="font-mono font-bold text-green-700 shrink-0 ml-2">
                                                {((item.price || 0) * (item.quantity || 0)).toLocaleString('vi-VN')} đ
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Ghi chú nội bộ */}
                        {record.privateNotes && (
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
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

                {/* COLUMN 3: TIẾN ĐỘ & NHẮC VIỆC */}
                <div className="space-y-6">
                    {/* TIMELINE */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-indigo-600 px-5 py-3 flex items-center gap-2">
                            <CalendarClock size={16} className="text-white"/>
                            <span className="text-xs font-bold text-white uppercase">Tiến độ & Thời gian</span>
                        </div>
                        
                        <div className="p-6 text-center border-b border-gray-100">
                             <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Hạn trả kết quả</label>
                             <p className="text-2xl font-black text-gray-800">{formatDate(record.deadline)}</p>
                             <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded mt-2 inline-block">
                                Ngày nhận: {formatDate(record.receivedDate)}
                             </span>

                             {/* Tính năng gia hạn hạn trả cho Một cửa / Admin */}
                             {currentUser && (currentUser.role === UserRole.ONEDOOR || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN) && (
                                 <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col items-center">
                                     {!showExtendForm ? (
                                         <button 
                                             onClick={() => {
                                                 setExtendDate(record.deadline ? record.deadline.split('T')[0] : '');
                                                 setShowExtendForm(true);
                                             }}
                                             className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-bold transition-all border border-purple-200"
                                         >
                                             <CalendarClock size={14} />
                                             Gia hạn ngày hẹn
                                         </button>
                                     ) : (
                                         <div className="w-full bg-slate-50 p-3 rounded-lg border border-slate-200 text-left animate-fade-in-up">
                                             <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Gia hạn hồ sơ</h4>
                                             <div className="space-y-3">
                                                 <div>
                                                     <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Ngày hẹn mới</label>
                                                     <input 
                                                         type="date" 
                                                         value={extendDate} 
                                                         onChange={(e) => setExtendDate(e.target.value)}
                                                         className="w-full text-xs font-semibold px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                                                     />
                                                 </div>
                                                 <div>
                                                     <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Lý do gia hạn</label>
                                                     <textarea 
                                                         rows={2}
                                                         value={extendReason}
                                                         onChange={(e) => setExtendReason(e.target.value)}
                                                         placeholder="Nhập lý do gia hạn..."
                                                         className="w-full text-xs p-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                                                     />
                                                 </div>
                                                 <div className="flex gap-2 justify-end">
                                                     <button 
                                                         onClick={() => setShowExtendForm(false)}
                                                         className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 rounded text-xs font-medium"
                                                     >
                                                         Hủy
                                                     </button>
                                                     <button 
                                                         onClick={handleSaveExtension}
                                                         disabled={isExtending}
                                                         className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm"
                                                     >
                                                         {isExtending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                         Lưu
                                                     </button>
                                                 </div>
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             )}
                        </div>

                        <div className="p-6 space-y-0">
                             <TimelineItem 
                                date={record.receivedDate} 
                                label="NHẬN HỒ SƠ" 
                                icon={UserIcon}
                                colorClass={{text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
                                subText={record.receivedBy ? (() => {
                                    const receiver = users.find(u => u.employeeId === record.receivedBy);
                                    if (!receiver) return undefined;
                                    const emp = employees.find(e => e.id === receiver.employeeId);
                                    return `${receiver.name} (${emp?.position || 'Nhân viên'})`;
                                })() : undefined}
                            />

                            <TimelineItem 
                                date={record.assignedDate} 
                                label="GIAO NHÂN VIÊN" 
                                icon={UserIcon}
                                colorClass={{text: 'text-blue-700', border: 'border-blue-600', bg: 'bg-blue-600'}}
                                subText={record.assignedTo ? (() => {
                                    const emp = employees.find(e => e.id === record.assignedTo);
                                    if (!emp) return undefined;
                                    return `${emp.name} (${emp.department})`;
                                })() : undefined}
                            />
                            
                            <TimelineItem 
                                date={record.completedWorkDate} 
                                forceActive={isWorkDone}
                                label="ĐÃ THỰC HIỆN" 
                                icon={CheckSquare}
                                colorClass={{text: 'text-cyan-700', border: 'border-cyan-600', bg: 'bg-cyan-600'}}
                                subText={record.completedWorkDate ? (() => {
                                    const emp = employees.find(e => e.id === record.assignedTo);
                                    if (!emp) return undefined;
                                    return `${emp.name} (${emp.department})`;
                                })() : undefined}
                            />

                            {/* Ẩn mốc kiểm tra cho một số loại hồ sơ */}
                            {!(record.recordType === 'Cung cấp tài liệu đất đai' || record.recordType === 'Sao lục' || record.recordType === 'Công văn') && (
                                <>
                                    <TimelineItem 
                                        date={record.pendingCheckDate} 
                                        forceActive={isPendingCheckActive}
                                        label="TRÌNH KIỂM TRA" 
                                        icon={Send}
                                        colorClass={{text: 'text-orange-700', border: 'border-orange-600', bg: 'bg-orange-600'}}
                                        subText={record.checkedBy ? (() => {
                                            const checker = employees.find(e => e.id === record.checkedBy);
                                            if (!checker) return undefined;
                                            return `${checker.name} (${checker?.position || 'Người kiểm tra'})`;
                                        })() : undefined}
                                    />

                                    <TimelineItem 
                                        date={record.checkedDate} 
                                        forceActive={isCheckedActive}
                                        label="ĐÃ KIỂM TRA" 
                                        icon={CheckSquare}
                                        colorClass={{text: 'text-orange-700', border: 'border-orange-600', bg: 'bg-orange-600'}}
                                        subText={record.checkedDate && record.checkedBy ? (() => {
                                            const checker = employees.find(e => e.id === record.checkedBy);
                                            if (!checker) return undefined;
                                            return `${checker.name} (${checker?.position || 'Người kiểm tra'})`;
                                        })() : undefined}
                                    />
                                </>
                            )}

                            <TimelineItem 
                                date={record.submissionDate} 
                                forceActive={isPendingSignActive}
                                label="TRÌNH KÝ" 
                                icon={Send}
                                colorClass={{text: 'text-purple-700', border: 'border-purple-600', bg: 'bg-purple-600'}}
                                subText={record.submittedTo ? (() => {
                                    const director = users.find(u => u.employeeId === record.submittedTo);
                                    if (!director) return undefined;
                                    const emp = employees.find(e => e.id === director.employeeId);
                                    return `${director.name} (${emp?.position || (director.role === UserRole.ADMIN ? 'Giám đốc' : 'Phó giám đốc')})`;
                                })() : undefined}
                            />
                            
                            <TimelineItem 
                                date={record.approvalDate} 
                                forceActive={isSignedActive}
                                label="KÝ DUYỆT" 
                                icon={FileSignature}
                                colorClass={{text: 'text-indigo-700', border: 'border-indigo-600', bg: 'bg-indigo-600'}}
                                subText={record.approvalDate && record.submittedTo ? (() => {
                                    const director = users.find(u => u.employeeId === record.submittedTo);
                                    if (!director) return undefined;
                                    const emp = employees.find(e => e.id === director.employeeId);
                                    return `${director.name} (${emp?.position || (director.role === UserRole.ADMIN ? 'Giám đốc' : 'Phó giám đốc')})`;
                                })() : undefined}
                            />
                            
                            <TimelineItem 
                                date={record.completedDate} 
                                label={record.status === RecordStatus.REJECTED ? "HỒ SƠ TRẢ" : record.status === RecordStatus.WITHDRAWN ? "RÚT HỒ SƠ" : "HOÀN THÀNH"} 
                                icon={CheckSquare}
                                isLast={false}
                                colorClass={{text: record.status === RecordStatus.REJECTED ? 'text-red-700' : 'text-green-700', border: record.status === RecordStatus.REJECTED ? 'border-red-600' : 'border-green-600', bg: record.status === RecordStatus.REJECTED ? 'bg-red-600' : 'bg-green-600'}}
                            />
                            
                            <TimelineItem 
                                date={record.resultReturnedDate} 
                                label="TRẢ KẾT QUẢ" 
                                icon={FileCheck}
                                isLast={true}
                                colorClass={{text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
                                subText={record.resultReturnedDate && record.receiverName ? `Người nhận: ${record.receiverName}` : undefined}
                            />
                        </div>
                    </div>

                    {/* EXPORT INFO */}
                    {record.exportBatch && (
                         <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col items-center text-center">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-2">
                                <Info size={16}/>
                            </div>
                            <p className="text-sm font-bold text-green-800">Hồ sơ đã được xuất danh sách Đợt {record.exportBatch}</p>
                            <p className="text-xs text-green-600 mt-1">Ngày: {formatDate(record.exportDate)}</p>
                         </div>
                    )}
                </div>

            </div>
        </div>

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
                onCreateContract={onCreateContract}
            />
        )}

        {isAnnexModalOpen && (
            <SystemAnnexTemplate
                data={{
                    ...record,
                    code: (() => {
                        const matched = contracts.find(c => c.customerAddress === record.code);
                        return matched ? matched.code : (record.code || '');
                    })()
                }}
                employees={employees}
                onClose={() => {
                    setIsAnnexModalOpen(false);
                }}
            />
        )}
      </div>
    </div>
  );
};
