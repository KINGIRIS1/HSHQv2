import React, { useState, useEffect } from 'react';
import { RecordFile, Employee, User, UserRole, SplitItem, RecordStatus } from '../../types';
import AutoResizeTextarea from '../AutoResizeTextarea';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import StatusBadge from '../StatusBadge';
import { 
  X, MapPin, FileText, User as UserIcon, Receipt, DollarSign, 
  CheckCircle2, Circle, Send, FileSignature, CheckSquare, 
  CalendarClock, FileCheck, Calculator, Loader2, StickyNote, 
  Save, Bell, Printer, Pencil, Trash2, Info, ChevronLeft,
  Phone, Calendar, Hash, FileDown, Clock, ShieldAlert
} from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../../services/docxService';
import DocxPreviewModal from '../DocxPreviewModal';
import { updateRecordApi, fetchContracts } from '../../services/api';
import SystemReceiptTemplate from '../receive-record/SystemReceiptTemplate';
import SystemAnnexTemplate from '../receive-record/SystemAnnexTemplate';
import { cleanSyncNotes, isProcedure2_3, getPureBatchNumber } from '../../utils/appHelpers';

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

interface ParsedDocItem {
  name: string;
  type: string;
  original: number;
  copy: number;
  note?: string;
}

const parseOtherDocsForMobile = (raw: string | null | undefined): ParsedDocItem[] => {
  if (!raw) return [];
  const str = raw.trim();
  if (!str) return [];

  if (str.startsWith('[') || str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const result: ParsedDocItem[] = [];
      
      for (const item of arr) {
        if (!item) continue;
        if (typeof item === 'string') {
          if (item.trim()) result.push({ name: item.trim(), type: 'Bản chính', original: 1, copy: 0 });
          continue;
        }
        const name = (item.name || item.ten || item.title || item.docName || '').trim();
        if (!name) continue;

        const type = item.type || item.loai || item.copyType || (item.original ? 'Bản chính' : item.copy ? 'Bản sao' : 'Bản chính');
        const original = typeof item.original === 'number' ? item.original : (item.soBanChinh ? Number(item.soBanChinh) : (type === 'Bản chính' ? 1 : 0));
        const copy = typeof item.copy === 'number' ? item.copy : (item.soBanSao ? Number(item.soBanSao) : (type === 'Bản sao' ? 1 : 0));
        const note = item.note || item.ghiChu || '';

        result.push({ name, type, original, copy, note });
      }
      if (result.length > 0) return result;
    } catch {
      // JSON parse failed, fallback below
    }
  }

  const parts = str.split(/\n|\|/).map(s => s.trim()).filter(Boolean);
  return parts.map(p => ({
    name: p,
    type: 'Bản chính',
    original: 1,
    copy: 0
  }));
};

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
        const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
        setReminderDate(localIso);
      } else {
        setReminderDate('');
      }

      // Fetch Contract Price & Details
      const fetchPrice = async () => {
        const fetchedContracts = await fetchContracts();
        setContracts(fetchedContracts);
        const match = fetchedContracts.find(c => {
            if (!c || !record) return false;
            const cAddr = (c.customerAddress || '').trim().toLowerCase();
            const cCode = (c.code || '').trim().toLowerCase();
            const rCode = (record.code || '').trim().toLowerCase();
            const cName = (c.customerName || '').trim().toLowerCase();
            const rName = (record.customerName || '').trim().toLowerCase();
            const cPlot = (c.landPlot || '').trim().toLowerCase();
            const rPlot = (record.landPlot || '').trim().toLowerCase();
            const cMap = (c.mapSheet || '').trim().toLowerCase();
            const rMap = (record.mapSheet || '').trim().toLowerCase();

            const clean = (str: string) => str.replace(/[^a-z0-9]/gi, '').toLowerCase();

            if (rCode && (cAddr === rCode || cCode === rCode)) return true;
            if (rCode && cCode && clean(rCode).length >= 3 && clean(rCode) === clean(cCode)) return true;
            if (rCode && cAddr && clean(rCode).length >= 3 && clean(rCode) === clean(cAddr)) return true;
            if (rName && cName && rName === cName) {
                if (rPlot && cPlot && rPlot === cPlot) return true;
                if (rMap && cMap && rMap === cMap) return true;
            }
            return false;
        });
        
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
  }, [record?.id, isOpen]);

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
    return `${d}/${m}/${y}`;
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
      <div className="relative flex gap-3">
        <div className="flex flex-col items-center">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 z-10 bg-white ${isActive ? colorClass.border : 'border-gray-200'}`}>
            {isActive ? <CheckCircle2 size={14} className={colorClass.text} /> : <Circle size={14} className="text-gray-300" />}
          </div>
          {!isLast && <div className={`w-0.5 grow ${isActive ? colorClass.bg : 'bg-gray-100'} my-1`}></div>}
        </div>
        <div className="pb-4 flex-1">
          <p className={`text-[10px] font-bold uppercase mb-0.5 ${isActive ? colorClass.text : 'text-gray-400'}`}>{label}</p>
          <div className="flex items-center gap-1.5">
            <Icon size={13} className={isActive ? 'text-gray-500' : 'text-gray-300'} />
            <span className={`text-xs font-semibold ${isActive ? 'text-gray-800' : 'text-gray-400 italic'}`}>
              {date ? formatDate(date) : (forceActive ? 'Đã hoàn tất' : 'Chưa thực hiện')}
            </span>
          </div>
          {subText && <p className="text-[10px] text-indigo-600 mt-0.5 italic">{subText}</p>}
        </div>
      </div>
    );
  };

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
    <div className="fixed inset-0 bg-slate-50 z-[60] flex flex-col animate-slide-in-right overflow-hidden">
      {/* Compact Header & Navigation */}
      <div className="shrink-0 bg-white border-b border-slate-200 shadow-xs pt-[env(safe-area-inset-top,0px)]">
        {/* Title Bar */}
        <div className="px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button 
              onClick={onClose} 
              className="p-1 -ml-1 text-slate-600 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-colors shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label="Đóng"
            >
              <ChevronLeft size={22} />
            </button>
            <div className="min-w-0 flex flex-col">
              <span className="font-mono font-bold text-blue-700 text-sm sm:text-base leading-tight truncate">
                {record.code}
              </span>
              <span className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                {getShortRecordType(record.recordType)}
              </span>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {canPrintReceipt && (
              <button 
                onClick={handlePrintReceipt}
                disabled={isProcessing}
                className="p-1.5 text-purple-600 hover:bg-purple-50 active:bg-purple-100 rounded-lg transition-colors shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="In biên nhận"
              >
                {isProcessing ? <Loader2 size={17} className="animate-spin" /> : <Printer size={17} />}
              </button>
            )}
            {onEdit && (
              <button 
                onClick={() => { onClose(); onEdit(record); }} 
                className="p-1.5 text-blue-600 hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center" 
                title="Sửa hồ sơ"
              >
                <Pencil size={17} />
              </button>
            )}
            {onDelete && (
              <button 
                onClick={() => { onClose(); onDelete(record); }} 
                className="p-1.5 text-red-500 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center" 
                title="Xóa hồ sơ"
              >
                <Trash2 size={17} />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 active:bg-slate-100 rounded-lg transition-colors shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center ml-0.5"
              title="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-t border-slate-100 bg-white px-2">
          <div className="flex text-center">
            <button 
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'info' ? 'text-blue-600 border-blue-600 bg-blue-50/30' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
            >
              Thông tin
            </button>
            <button 
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'timeline' ? 'text-blue-600 border-blue-600 bg-blue-50/30' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
            >
              Tiến độ
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${activeTab === 'notes' ? 'text-blue-600 border-blue-600 bg-blue-50/30' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
            >
              Ghi chú & Đính kèm
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-100/70 p-2.5 sm:p-4 space-y-2.5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        {activeTab === 'info' && (
          <div className="space-y-2.5">
            {/* Status & Timing Banner */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Trạng thái hồ sơ</span>
                <StatusBadge status={record.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/60">
                  <span className="text-[10px] text-blue-600 font-bold uppercase block">Ngày nhận</span>
                  <span className="font-semibold text-slate-800">{formatDate(record.receivedDate)}</span>
                </div>
                <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100/60">
                  <span className="text-[10px] text-amber-700 font-bold uppercase block">Hạn trả</span>
                  <span className="font-bold text-amber-900">{formatDate(record.deadline)}</span>
                </div>
              </div>
            </div>

            {/* Customer Info Card */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs uppercase">
                <UserIcon size={14} />
                <span>Khách hàng</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-start justify-between">
                  <span className="text-slate-400 font-medium">Họ & tên:</span>
                  <span className="font-bold text-slate-900 text-right uppercase">{record.customerName}</span>
                </div>
                {record.phoneNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Điện thoại:</span>
                    <a href={`tel:${record.phoneNumber}`} className="font-bold text-blue-600 flex items-center gap-1 hover:underline">
                      <Phone size={12} />
                      {record.phoneNumber}
                    </a>
                  </div>
                )}
                {record.cccd && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">CCCD/CMND:</span>
                    <span className="font-mono font-medium text-slate-800">{record.cccd}</span>
                  </div>
                )}
                {record.customerAddress && (
                  <div className="flex items-start justify-between pt-1 border-t border-slate-100">
                    <span className="text-slate-400 font-medium shrink-0 mr-2">Địa chỉ khách:</span>
                    <span className="text-slate-700 text-right leading-snug">{record.customerAddress}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Land Info Card */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs uppercase">
                <MapPin size={14} />
                <span>Thửa đất & Địa chỉ</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="col-span-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Xã / Phường</span>
                  <span className="font-bold text-slate-800">{getNormalizedWard(record.ward)}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Tờ bản đồ</span>
                  <span className="font-bold text-base text-slate-800 font-mono">{record.mapSheet || '-'}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Thửa đất</span>
                  <span className="font-bold text-base text-slate-800 font-mono">{record.landPlot || '-'}</span>
                </div>
                {record.area && (
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Diện tích</span>
                    <span className="font-bold text-slate-800">{record.area} m²</span>
                  </div>
                )}
                {record.measurementNumber && (
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Số trích đo</span>
                    <span className="font-bold text-blue-700">{record.measurementNumber}</span>
                  </div>
                )}
                {record.excerptNumber && (
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Số trích lục</span>
                    <span className="font-bold text-blue-700">{record.excerptNumber}</span>
                  </div>
                )}
              </div>
              {record.address && (
                <div className="text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-400 font-medium">Vị trí thửa đất: </span>
                  <span className="text-slate-700 font-medium">{record.address}</span>
                </div>
              )}
            </div>

            {/* Financial Info Card */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs uppercase">
                <DollarSign size={14} />
                <span>Tài chính & Biên lai</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2 bg-blue-50/60 rounded-lg border border-blue-100">
                  <span className="font-bold text-blue-800 text-[11px]">
                    {record.receiptType === 'Biên Lai' ? 'SỐ BIÊN LAI' : record.receiptType === 'Hóa Đơn' ? 'SỐ HÓA ĐƠN' : 'BIÊN LAI / HÓA ĐƠN'}
                  </span>
                  <span className="font-bold font-mono text-blue-900">{record.receiptNumber || 'Chưa lập'}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-emerald-50/60 rounded-lg border border-emerald-100">
                  <span className="font-bold text-emerald-800 text-[11px]">Số tiền phí</span>
                  <span className="font-bold font-mono text-emerald-900">
                    {record.returnedPrice !== undefined && record.returnedPrice !== null
                      ? record.returnedPrice.toLocaleString('vi-VN') + ' đ'
                      : (record.recordType === 'Cung cấp tài liệu đất đai'
                          ? (record.price ? record.price.toLocaleString('vi-VN') + ' đ' : '310.000 đ')
                          : (contractPrice !== null ? contractPrice.toLocaleString('vi-VN') + ' đ' : '---'))}
                  </span>
                </div>
                {liquidationInfo && (
                  <div className="flex justify-between items-center p-2 bg-orange-50/60 rounded-lg border border-orange-100">
                    <span className="font-bold text-orange-800 text-[11px]">{liquidationInfo.content}</span>
                    <span className="font-bold font-mono text-orange-900">{liquidationInfo.amount.toLocaleString('vi-VN')} đ</span>
                  </div>
                )}
              </div>

              {/* Hợp đồng liên kết */}
              {record.recordType && (getShortRecordType(record.recordType).startsWith('2.2') || getShortRecordType(record.recordType).startsWith('2.4')) && (
                <div className="pt-2 border-t border-slate-100">
                  {matchedContract ? (
                    <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] text-indigo-500 font-bold uppercase block">Hợp đồng: {matchedContract.code}</span>
                        <span className="text-[11px] font-bold text-indigo-900 truncate block">{matchedContract.serviceType || matchedContract.contractType}</span>
                      </div>
                      {onCreateLiquidation && (
                        <button 
                          onClick={() => { onCreateLiquidation(record); onClose(); }}
                          className="px-2.5 py-1 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:scale-95 shrink-0"
                        >
                          Thanh lý
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">Chưa có hợp đồng</span>
                      <div className="flex gap-1.5 shrink-0">
                        {onCreateContract && (
                          <button 
                            onClick={() => { onCreateContract(record); onClose(); }}
                            className="px-2.5 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95"
                          >
                            Lập HĐ
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions Bar */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Thao tác nhanh</span>
              <div className="grid grid-cols-2 gap-2">
                {canPrintReceipt && (
                  <button 
                    onClick={handlePrintReceipt}
                    disabled={isProcessing}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-purple-600 text-white font-bold text-xs rounded-lg hover:bg-purple-700 active:scale-95 transition-all shadow-xs"
                  >
                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                    <span>In biên nhận</span>
                  </button>
                )}
                {canPerformAction && (
                  <button 
                    onClick={() => setShowExtendForm(!showExtendForm)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-600 text-white font-bold text-xs rounded-lg hover:bg-amber-700 active:scale-95 transition-all shadow-xs"
                  >
                    <CalendarClock size={14} />
                    <span>Gia hạn ngày hẹn</span>
                  </button>
                )}
              </div>

              {/* Form Gia Hạn Ngày Hẹn */}
              {showExtendForm && (
                <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200 space-y-2 mt-2 animate-fade-in-down">
                  <span className="text-xs font-bold text-amber-900 block">Gia hạn ngày hẹn trả kết quả</span>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Ngày hẹn mới</label>
                    <input 
                      type="date"
                      value={extendDate}
                      onChange={(e) => setExtendDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Lý do gia hạn</label>
                    <input 
                      type="text"
                      placeholder="Ví dụ: Đo đạc lại hiện trường..."
                      value={extendReason}
                      onChange={(e) => setExtendReason(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button 
                      onClick={() => setShowExtendForm(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-medium"
                    >
                      Hủy
                    </button>
                    <button 
                      onClick={handleSaveExtension}
                      disabled={isExtending}
                      className="px-3 py-1.5 text-xs bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 active:scale-95 flex items-center gap-1"
                    >
                      {isExtending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Lưu gia hạn
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Timeline */}
        {activeTab === 'timeline' && (
          <div className="space-y-2.5">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
              <div className="text-center pb-3 mb-3 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Hạn trả kết quả</span>
                <span className="text-xl font-bold text-blue-700 block font-mono mt-0.5">{formatDate(record.deadline)}</span>
                <span className="text-[11px] text-slate-500 font-medium inline-flex items-center gap-1 mt-1 bg-slate-50 px-2 py-0.5 rounded-full">
                  <Calendar size={11} /> Tiếp nhận: {formatDate(record.receivedDate)}
                </span>
              </div>

              <div className="space-y-0 pt-1">
                <TimelineItem 
                  date={record.receivedDate} 
                  label="1. TIẾP NHẬN MỚI" 
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
                  date={record.assignedDate || record.completedWorkDate} 
                  forceActive={isWorkDone || !!record.assignedDate}
                  label="2. ĐANG THỰC HIỆN" 
                  icon={UserIcon}
                  colorClass={{text: 'text-blue-600', border: 'border-blue-600', bg: 'bg-blue-600'}}
                  subText={record.assignedTo ? (() => {
                      const emp = employees.find(e => e.id === record.assignedTo);
                      if (!emp) return undefined;
                      return `${emp.name} (${emp.position || 'Chuyên viên'})`;
                  })() : undefined}
                />

                {!(record.recordType === 'Cung cấp tài liệu đất đai' || record.recordType === 'Sao lục' || record.recordType === 'Công văn') && (
                  <TimelineItem 
                    date={record.pendingCheckDate || record.checkedDate} 
                    forceActive={isPendingCheckActive || isCheckedActive}
                    label="3. TRÌNH KIỂM TRA" 
                    icon={Send}
                    colorClass={{text: 'text-orange-600', border: 'border-orange-600', bg: 'bg-orange-600'}}
                    subText={record.checkedBy ? (() => {
                        const checker = employees.find(e => e.id === record.checkedBy);
                        if (!checker) return undefined;
                        return `${checker.name} (${checker?.position || 'Người kiểm tra'})`;
                    })() : undefined}
                  />
                )}

                <TimelineItem 
                  date={record.submissionDate || record.approvalDate} 
                  forceActive={isPendingSignActive || isSignedActive}
                  label="4. TRÌNH KÝ DUYỆT" 
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
                  date={record.completedDate} 
                  label={record.status === RecordStatus.REJECTED ? "5. TRẢ HỒ SƠ" : record.status === RecordStatus.WITHDRAWN ? "5. CSD RÚT HỒ SƠ" : "5. HOÀN THÀNH"} 
                  icon={CheckSquare}
                  isLast={false}
                  colorClass={{text: record.status === RecordStatus.REJECTED ? 'text-red-700' : 'text-green-700', border: record.status === RecordStatus.REJECTED ? 'border-red-600' : 'border-green-600', bg: record.status === RecordStatus.REJECTED ? 'bg-red-600' : 'bg-green-600'}}
                  subText={record.exportBatch ? `Đợt xuất: ${getPureBatchNumber(record.exportBatch)}` : undefined}
                />

                <TimelineItem 
                  date={record.resultReturnedDate} 
                  label="6. TRẢ KẾT QUẢ" 
                  icon={FileCheck}
                  isLast={true}
                  colorClass={{text: 'text-emerald-600', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Notes & Attachments */}
        {activeTab === 'notes' && (
          <div className="space-y-2.5">
            {/* Nội dung chi tiết / Trích yếu */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-1.5">
              <span className="text-[10px] font-bold text-purple-700 uppercase flex items-center gap-1.5">
                <FileText size={13} />
                <span>Nội dung chi tiết (Trích yếu)</span>
              </span>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-slate-800 text-xs font-medium leading-relaxed whitespace-pre-line">
                {cleanSyncNotes(record.content) || 'Không có nội dung chi tiết.'}
              </div>
            </div>

            {/* Ghi chú hồ sơ */}
            {cleanSyncNotes(record.notes) && (
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-1.5">
                <span className="text-[10px] font-bold text-blue-700 uppercase flex items-center gap-1.5">
                  <StickyNote size={13} />
                  <span>Ghi chú hồ sơ</span>
                </span>
                <div className="bg-blue-50/40 p-2.5 rounded-lg border border-blue-100 text-slate-800 text-xs font-medium leading-relaxed whitespace-pre-line">
                  {cleanSyncNotes(record.notes)}
                </div>
              </div>
            )}

            {/* Giấy tờ kèm theo */}
            {record.otherDocs && (() => {
              const docList = parseOtherDocsForMobile(record.otherDocs);
              if (docList.length === 0) return null;
              return (
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1.5">
                    <FileDown size={13} />
                    <span>Giấy tờ kèm theo ({docList.length})</span>
                  </span>
                  <div className="space-y-1.5">
                    {docList.map((doc, idx) => (
                      <div key={idx} className="bg-emerald-50/40 p-2 rounded-lg border border-emerald-100/70 text-slate-800 text-xs space-y-1">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="font-semibold text-slate-900 leading-snug flex-1">
                            {idx + 1}. {doc.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-full font-bold text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                            {doc.type}
                          </span>
                        </div>
                        {(doc.original > 0 || doc.copy > 0 || doc.note) && (
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600 pt-1 border-t border-emerald-100/60">
                            {doc.original > 0 && <span>Bản chính: <strong>{doc.original}</strong></span>}
                            {doc.copy > 0 && <span>Bản sao: <strong>{doc.copy}</strong></span>}
                            {doc.note && <span className="italic text-slate-500">Ghi chú: {doc.note}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Ghi chú nội bộ */}
            {record.privateNotes && (
              <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[10px] uppercase">
                  <Info size={12} />
                  <span>Ghi chú nội bộ</span>
                </div>
                <p className="text-amber-900 text-xs italic leading-relaxed whitespace-pre-line">
                  {record.privateNotes}
                </p>
              </div>
            )}

            {/* Nhắc nhở công việc */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-blue-700 uppercase flex items-center gap-1.5">
                  <Bell size={13} />
                  <span>Nhắc nhở công việc</span>
                </span>
                <button 
                  onClick={handleSaveReminder} 
                  disabled={isSavingReminder}
                  className="text-[11px] bg-blue-600 text-white px-2.5 py-1 rounded-lg font-bold active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSavingReminder ? <Loader2 size={11} className="animate-spin" /> : 'Lưu'}
                </button>
              </div>
              <input 
                type="date" 
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
              />
            </div>

            {/* Ghi chú cá nhân */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-blue-700 uppercase flex items-center gap-1.5">
                  <StickyNote size={13} />
                  <span>Ghi chú cá nhân (riêng tư)</span>
                </span>
                <button 
                  onClick={handleSavePersonalNote} 
                  disabled={isSavingNote}
                  className="text-[11px] bg-blue-600 text-white px-2.5 py-1 rounded-lg font-bold active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSavingNote ? <Loader2 size={11} className="animate-spin" /> : 'Lưu'}
                </button>
              </div>
              <AutoResizeTextarea
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Nhập ghi chú riêng của bạn..."
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
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
              const matched = matchedContract || contracts.find(c => {
                  const cAddr = (c.customerAddress || '').trim().toLowerCase();
                  const rCode = (record.code || '').trim().toLowerCase();
                  return cAddr === rCode || (rCode && cAddr.includes(rCode));
              });
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

export default MobileDetailModal;
