
import React, { useState, useEffect } from 'react';
import { RecordFile, Employee, User, UserRole, SplitItem, RecordStatus } from '../../types';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import StatusBadge from '../StatusBadge';
import { 
  X, MapPin, FileText, User as UserIcon, Receipt, DollarSign, 
  CheckCircle2, Circle, Send, FileSignature, CheckSquare, 
  CalendarClock, FileCheck, Calculator, Loader2, StickyNote, 
  Save, Bell, Printer, Pencil, Trash2, Info, ChevronLeft,
  Phone, Calendar, Hash, FileDown
} from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../../services/docxService';
import DocxPreviewModal from '../DocxPreviewModal';
import { updateRecordApi, fetchContracts } from '../../services/api';
import SystemReceiptTemplate from '../receive-record/SystemReceiptTemplate';
import SystemAnnexTemplate from '../receive-record/SystemAnnexTemplate';

interface MobileDetailModalProps {
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

export const MobileDetailModal: React.FC<MobileDetailModalProps> = ({ 
  isOpen, onClose, record, employees, users, currentUser, onEdit, onDelete, onCreateLiquidation, onCreateContract, onRefreshData
}) => {
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

  const [personalNote, setPersonalNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [contractPrice, setContractPrice] = useState<number | null>(null);
  const [contractSplitItems, setContractSplitItems] = useState<SplitItem[] | null>(null);
  const [liquidationInfo, setLiquidationInfo] = useState<{ amount: number, content: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'info' | 'timeline' | 'notes'>('info');

  // State cho Phụ lục
  const [isAnnexModalOpen, setIsAnnexModalOpen] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [matchedContract, setMatchedContract] = useState<any | null>(null);

  useEffect(() => {
    if (record) {
      setPersonalNote(record.personalNotes || '');
      if (record.reminderDate) {
        const d = new Date(record.reminderDate);
        const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setReminderDate(localIso);
      } else {
        setReminderDate('');
      }

      const fetchPrice = async () => {
        const fetchedContracts = await fetchContracts();
        setContracts(fetchedContracts);
        const match = fetchedContracts.find(c => 
            (c.customerAddress && record.code && c.customerAddress.trim().toLowerCase() === record.code.trim().toLowerCase()) ||
            (c.code && record.code && c.code.trim().toLowerCase() === record.code.trim().toLowerCase())
        );
        
        if (match) {
          setMatchedContract(match);
          setContractPrice(match.totalAmount ?? null);
          setContractSplitItems(match.splitItems || null);
          if (match.liquidationAmount !== null && match.liquidationAmount !== undefined) {
            let liquidationLabel = 'Thanh lý hợp đồng';
            const cType = (match.contractType || '').toLowerCase();
            const sType = (match.serviceType || '').toLowerCase();
            if (cType.includes('trích lục') || sType.includes('trích lục')) liquidationLabel = 'Thanh lý trích lục';
            else if (cType.includes('cắm mốc') || sType.includes('cắm mốc')) liquidationLabel = 'Thanh lý cắm mốc';
            else if (cType.includes('tách thửa') || sType.includes('tách thửa')) liquidationLabel = 'Thanh lý tách thửa';
            else if (cType.includes('đo đạc') || sType.includes('đo đạc')) liquidationLabel = 'Thanh lý đo đạc';
            setLiquidationInfo({ amount: match.liquidationAmount, content: liquidationLabel });
          } else {
            setLiquidationInfo(null);
          }
        } else {
          setMatchedContract(null);
          const type = (record.recordType || '').toLowerCase();
          if (type.includes('trích lục')) setContractPrice(53163);
          else setContractPrice(null);
          setContractSplitItems(null);
          setLiquidationInfo(null);
        }
      };
      fetchPrice();
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
  const isOneDoor = currentUser?.role === UserRole.ONEDOOR;
  const canPerformAction = isAdmin || isSubadmin || isOneDoor;
  const canPrintReceipt = isAdmin || isOneDoor;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    
    if (dateStr.includes('T')) {
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${min} - ${d}/${m}/${y}`;
    }
    return `${d}/${m}/${y}`;
  };

  const getEmployeeName = (id?: string | null) => {
    if (!id) return 'Chưa giao';
    const emp = employees.find(e => e.id === id);
    return emp ? emp.name : 'Không xác định';
  };

  const handleSavePersonalNote = async () => {
    setIsSavingNote(true);
    const result = await updateRecordApi({ ...record, personalNotes: personalNote });
    setIsSavingNote(false);
    alert(result ? 'Đã lưu ghi chú!' : 'Lỗi khi lưu.');
  };

  const handleSaveReminder = async () => {
    setIsSavingReminder(true);
    const newReminderDate = reminderDate ? new Date(reminderDate).toISOString() : null;
    const result = await updateRecordApi({ ...record, reminderDate: newReminderDate as string, lastRemindedAt: null as any });
    setIsSavingReminder(false);
    alert(result ? 'Đã lưu nhắc nhở!' : 'Lỗi khi lưu.');
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
    if (type.includes('trích lục')) standardDays = "10";
    else if (type.includes('trích đo chỉnh lý')) standardDays = "15"; 
    else if (type.includes('trích đo') || type.includes('đo đạc') || type.includes('cắm mốc')) standardDays = "30";

    let tp1Value = 'Phiếu yêu cầu';
    if (type.includes('chỉnh lý') || type.includes('trích đo') || type.includes('trích lục')) tp1Value = 'Phiếu yêu cầu trích lục, trích đo';
    else if (type.includes('đo đạc') || type.includes('cắm mốc')) tp1Value = 'Phiếu yêu cầu Đo đạc, cắm mốc';
    if (record.ward) tp1Value += ` tại ${getNormalizedWard(record.ward)}`;
    
    let sdtLienHe = "";
    const wRaw = (record.ward || "").toLowerCase();
    if (wRaw.includes("minh hưng") || wRaw.includes("minh hung")) sdtLienHe = "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757";
    else if (wRaw.includes("nha bích") || wRaw.includes("nha bich")) sdtLienHe = "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344";
    else if (wRaw.includes("chơn thành") || wRaw.includes("chon thanh")) sdtLienHe = "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691";

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
        <div className="pb-6 flex-1">
          <p className={`text-[10px] font-bold uppercase mb-0.5 ${isActive ? colorClass.text : 'text-gray-400'}`}>{label}</p>
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

  // LOGIC CHECK NẾU ĐÃ THỰC HIỆN XONG (Để hiển thị bước "Đã thực hiện")
  const isWorkDone = [
    RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, 
    RecordStatus.HANDOVER, RecordStatus.RETURNED
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

  const recordTypeLower = (record?.recordType || '').toLowerCase();


  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1 -ml-1 text-slate-500 active:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="font-bold text-slate-800 text-sm truncate max-w-[180px]">{record.customerName}</h2>
            <p className="text-[10px] text-slate-400 font-mono">{record.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canPerformAction && onEdit && (
            <button onClick={() => { onClose(); onEdit(record); }} className="p-2 text-slate-400 active:text-blue-600">
              <Pencil size={20} />
            </button>
          )}
          {canPerformAction && onDelete && (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUBADMIN') && (
            <button onClick={() => { onClose(); onDelete(record); }} className="p-2 text-slate-400 active:text-red-600">
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 bg-white sticky top-[53px] z-10">
        <button 
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'info' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'}`}
        >
          Thông tin
        </button>
        <button 
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'timeline' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'}`}
        >
          Tiến độ
        </button>
        <button 
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'notes' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent'}`}
        >
          Ghi chú
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50 pb-24">
        {activeTab === 'info' && (
          <div className="p-4 space-y-4">
            {/* Status & Type */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái</span>
                <StatusBadge status={record.status} />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Loại hồ sơ</p>
                  <p className="text-sm font-bold text-slate-800">{record.recordType}</p>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2">
                <UserIcon size={16} /> Thông tin khách hàng
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    <UserIcon size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Họ và tên</p>
                    <p className="text-sm font-bold text-slate-800">{record.customerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Số điện thoại</p>
                    <p className="text-sm font-bold text-slate-800">{record.phoneNumber || '---'}</p>
                  </div>
                </div>
                {record.cccd && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                      <Hash size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">CCCD/CMND</p>
                      <p className="text-sm font-bold text-slate-800">{record.cccd}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Land Info */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-green-600 uppercase flex items-center gap-2">
                <MapPin size={16} /> Thông tin thửa đất
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Xã/Phường</p>
                    <p className="text-sm font-bold text-slate-800">{getNormalizedWard(record.ward)}</p>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Tờ bản đồ</p>
                  <p className="text-base font-bold text-slate-800">{record.mapSheet || '-'}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Thửa đất</p>
                  <p className="text-base font-bold text-slate-800">{record.landPlot || '-'}</p>
                </div>
                
                {/* Số trích đo & trích lục */}
                {recordTypeLower.includes('trích đo') && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Số trích đo</p>
                    <p className="text-sm font-bold text-slate-800">{record.measurementNumber || '---'}</p>
                  </div>
                )}
                {recordTypeLower.includes('trích lục') && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Số trích lục</p>
                    <p className="text-sm font-bold text-slate-800">{record.excerptNumber || '---'}</p>
                  </div>
                )}
              </div>
              {record.address && (
                <div className="pt-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Địa chỉ chi tiết</p>
                  <p className="text-sm font-medium text-slate-700">{record.address}</p>
                </div>
              )}
            </div>

            {/* Financial Info */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-orange-600 uppercase flex items-center gap-2">
                <DollarSign size={16} /> Tài chính & Biên lai
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2">
                    <Receipt size={16} className="text-blue-600" />
                    <span className="text-xs font-bold text-blue-700">Số biên lai</span>
                  </div>
                  <span className="text-sm font-bold text-blue-800">{record.receiptNumber || '---'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-100">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-green-600" />
                    <span className="text-xs font-bold text-green-700">
                      {record.returnedPrice !== undefined && record.returnedPrice !== null ? "Thực tế thu" : (record.recordType === 'Cung cấp tài liệu đất đai' ? 'Giá trị hồ sơ' : 'Giá trị HĐ')}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-green-800">
                    {record.returnedPrice !== undefined && record.returnedPrice !== null
                      ? record.returnedPrice.toLocaleString('vi-VN') + ' đ'
                      : (record.recordType === 'Cung cấp tài liệu đất đai'
                          ? (record.price ? record.price.toLocaleString('vi-VN') + ' đ' : '310.000 đ')
                          : (contractPrice !== null ? contractPrice.toLocaleString('vi-VN') + ' đ' : '---'))}
                  </span>
                </div>
                {liquidationInfo && (
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <div className="flex items-center gap-2">
                      <Calculator size={16} className="text-orange-600" />
                      <span className="text-xs font-bold text-orange-700">{liquidationInfo.content}</span>
                    </div>
                    <span className="text-sm font-bold text-orange-800">{liquidationInfo.amount.toLocaleString('vi-VN')} đ</span>
                  </div>
                )}

                {/* LIÊN KẾT HỢP ĐỒNG */}
                {record && record.recordType && (getShortRecordType(record.recordType).startsWith('2.3') || getShortRecordType(record.recordType).startsWith('2.4')) && (
                  <div className="pt-3 border-t border-dashed border-slate-100">
                    {matchedContract ? (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex flex-col gap-2.5">
                        <div className="flex items-start gap-2.5">
                          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-lg shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] text-indigo-500 uppercase font-bold block">Hợp đồng liên kết</span>
                            <p className="text-xs font-bold text-indigo-900 leading-tight">Số HĐ: {matchedContract.code}</p>
                            <p className="text-[11px] text-indigo-600 mt-0.5 leading-tight">{matchedContract.serviceType || matchedContract.contractType}</p>
                          </div>
                        </div>
                        {onCreateContract && (
                          <button 
                            onClick={() => {
                              onCreateContract(record);
                              onClose();
                            }}
                            className="w-full text-center text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 py-2 rounded-lg transition-colors duration-200 shadow-sm"
                          >
                            Xem chi tiết HĐ
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2.5">
                        <div className="flex items-start gap-2.5">
                          <div className="bg-slate-200 text-slate-500 p-2 rounded-lg shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="text-left">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Hợp đồng liên kết</span>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">Hồ sơ này chưa được lập hợp đồng đo đạc.</p>
                          </div>
                        </div>
                        {onCreateContract && (
                          <button 
                            onClick={() => {
                              onCreateContract(record);
                              onClose();
                            }}
                            className="w-full text-center text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 py-2 rounded-lg transition-colors duration-200 shadow-sm"
                          >
                            Lập Hợp đồng mới
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Chi tiết tách thửa */}
                {contractSplitItems && contractSplitItems.length > 0 && (
                  <div className="pt-3 border-t border-dashed border-slate-100 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Chi tiết tách thửa</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {contractSplitItems.map((item, idx) => (
                        <div key={idx} className="text-xs flex justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-600 text-[11px]">
                            <span className="font-bold text-blue-600 mr-1">Thửa {idx + 1}:</span> 
                            <span className="font-bold text-slate-700">{item.area || 0} m²</span>
                            {item.serviceName ? <span className="text-slate-400 ml-1 italic truncate max-w-[120px] inline-block align-bottom">- {item.serviceName}</span> : ''}
                          </span>
                          <span className="font-mono font-bold text-green-700 text-[11px] shrink-0 ml-2">
                            {((item.price || 0) * (item.quantity || 0)).toLocaleString('vi-VN')} đ
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="p-4 space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex flex-col items-center text-center mb-8 pb-6 border-b border-slate-50">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Hạn trả kết quả</p>
                <p className="text-3xl font-black text-slate-800">{formatDate(record.deadline)}</p>
                <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-full">
                  <Calendar size={12} /> Ngày nhận: {formatDate(record.receivedDate)}
                </div>

                {/* Tính năng gia hạn ngày hẹn cho Một cửa / Admin */}
                {currentUser && (currentUser.role === UserRole.ONEDOOR || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN) && (
                    <div className="mt-4 w-full flex flex-col items-center">
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
                            <div className="w-full bg-slate-50 p-3 rounded-lg border border-slate-200 text-left animate-fade-in-up mt-3">
                                <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Gia hạn hồ sơ</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Ngày hẹn mới</label>
                                        <input 
                                            type="date" 
                                            value={extendDate} 
                                            onChange={(e) => setExtendDate(e.target.value)}
                                            className="w-full text-xs font-semibold px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Lý do gia hạn</label>
                                        <textarea 
                                            rows={2}
                                            value={extendReason}
                                            onChange={(e) => setExtendReason(e.target.value)}
                                            placeholder="Nhập lý do gia hạn..."
                                            className="w-full text-xs p-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none resize-none bg-white"
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

              <div className="space-y-0">
                <TimelineItem 
                  date={record.receivedDate} 
                  label="NHẬN HỒ SƠ" 
                  icon={UserIcon}
                  colorClass={{text: 'text-emerald-600', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
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
                  colorClass={{text: 'text-blue-600', border: 'border-blue-600', bg: 'bg-blue-600'}}
                />
                <TimelineItem 
                  date={record.completedWorkDate} 
                  forceActive={isWorkDone}
                  label="ĐÃ THỰC HIỆN" 
                  icon={CheckSquare}
                  colorClass={{text: 'text-cyan-600', border: 'border-cyan-600', bg: 'bg-cyan-600'}}
                />

                {/* Ẩn mốc kiểm tra cho một số loại hồ sơ */}
                {!(record.recordType === 'Cung cấp tài liệu đất đai' || record.recordType === 'Sao lục' || record.recordType === 'Công văn') && (
                  <>
                    <TimelineItem 
                      date={record.pendingCheckDate} 
                      forceActive={isPendingCheckActive}
                      label="TRÌNH KIỂM TRA" 
                      icon={Send}
                      colorClass={{text: 'text-orange-600', border: 'border-orange-600', bg: 'bg-orange-600'}}
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
                      colorClass={{text: 'text-orange-600', border: 'border-orange-600', bg: 'bg-orange-600'}}
                    />
                  </>
                )}

                <TimelineItem 
                  date={record.submissionDate} 
                  forceActive={isPendingSignActive}
                  label="TRÌNH KÝ" 
                  icon={Send}
                  colorClass={{text: 'text-purple-600', border: 'border-purple-600', bg: 'bg-purple-600'}}
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
                  colorClass={{text: 'text-indigo-600', border: 'border-indigo-600', bg: 'bg-indigo-600'}}
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
                  colorClass={{text: 'text-emerald-600', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                <UserIcon size={24} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Nhân viên xử lý</p>
                <p className="text-sm font-bold text-slate-800">{getEmployeeName(record.assignedTo)}</p>
              </div>
            </div>

            {(record.status === RecordStatus.PENDING_CHECK || record.status === RecordStatus.CHECKED) && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 mt-4">
                <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-400">
                  <UserIcon size={24} />
                </div>
                <div>
                  <p className="text-[10px] text-orange-400 font-bold uppercase">Người kiểm tra</p>
                  <p className="text-sm font-bold text-orange-800">{getEmployeeName(record.checkedBy)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="p-4 space-y-4">
            {/* Nội dung chi tiết */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <h3 className="text-xs font-bold text-purple-600 uppercase flex items-center gap-2">
                <FileText size={16} /> Nội dung chi tiết (Trích yếu)
              </h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-800 text-sm font-semibold leading-relaxed whitespace-pre-line">
                {record.content || 'Không có nội dung chi tiết.'}
              </div>
            </div>

            {/* Ghi chú hồ sơ */}
            {record.notes && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
                <h3 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2">
                  <StickyNote size={16} /> Ghi chú hồ sơ
                </h3>
                <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100 text-slate-800 text-sm font-medium leading-relaxed whitespace-pre-line">
                  {record.notes}
                </div>
              </div>
            )}

            {/* Giấy tờ kèm theo */}
            {record.otherDocs && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
                <h3 className="text-xs font-bold text-emerald-600 uppercase flex items-center gap-2">
                  <FileDown size={16} /> Giấy tờ kèm theo
                </h3>
                <div className="bg-emerald-50/30 p-4 rounded-xl border border-emerald-100 text-slate-800 text-sm font-medium leading-relaxed whitespace-pre-line">
                  {record.otherDocs}
                </div>
              </div>
            )}

            {/* Ghi chú nội bộ (Private notes / Read only) */}
            {record.privateNotes && (
              <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 space-y-2">
                <div className="flex items-center gap-2 text-yellow-800 font-bold text-xs uppercase">
                  <Info size={14} />
                  <span>Ghi chú nội bộ</span>
                </div>
                <p className="text-yellow-900 text-xs italic leading-relaxed whitespace-pre-line">"{record.privateNotes}"</p>
              </div>
            )}

            {/* Nhắc nhở công việc */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2">
                  <Bell size={16} /> Nhắc nhở công việc
                </h3>
                <button 
                  onClick={handleSaveReminder} 
                  disabled={isSavingReminder}
                  className="text-[10px] bg-blue-600 text-white px-4 py-2 rounded-xl font-bold active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSavingReminder ? <Loader2 size={12} className="animate-spin" /> : 'Lưu'}
                </button>
              </div>
              <input 
                type="datetime-local" 
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
              />
            </div>

            {/* Ghi chú cá nhân */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2">
                  <StickyNote size={16} /> Ghi chú cá nhân
                </h3>
                <button 
                  onClick={handleSavePersonalNote} 
                  disabled={isSavingNote}
                  className="text-[10px] bg-blue-600 text-white px-4 py-2 rounded-xl font-bold active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSavingNote ? <Loader2 size={12} className="animate-spin" /> : 'Lưu'}
                </button>
              </div>
              <textarea
                rows={5}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Nhập ghi chú riêng của bạn..."
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-white border-t border-slate-100 p-4 sticky bottom-0 z-10 flex gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
        {canPrintReceipt && (
          <button 
            onClick={handlePrintReceipt}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
            In biên nhận
          </button>
        )}
        {onCreateLiquidation && record && record.recordType && (getShortRecordType(record.recordType).startsWith('2.3') || getShortRecordType(record.recordType).startsWith('2.4')) && (
          <button
            onClick={() => { onClose(); onCreateLiquidation(record); }}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm active:scale-95 transition-all"
          >
            <FileCheck size={18} /> Thanh lý
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
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 text-rose-600 rounded-xl font-bold text-sm active:scale-95 transition-all"
          >
            <FileDown size={18} /> Phụ lục
          </button>
        )}
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
  );
};
