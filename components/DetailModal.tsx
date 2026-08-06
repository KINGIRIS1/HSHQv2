
import React, { useState, useEffect } from 'react';
import { RecordFile, Employee, User, UserRole, SplitItem, RecordStatus } from '../types';
import { getNormalizedWard, getShortRecordType, isCapGiayRecord, CAP_GIAY_SUB_STEPS, getCapGiaySubStepLabel, getCapGiaySubStepBadgeColor } from '../constants';
import StatusBadge from './StatusBadge';
import { X, MapPin, FileText, User as UserIcon, Receipt, DollarSign, CheckCircle2, Circle, Send, FileSignature, CheckSquare, CalendarClock, FileCheck, Calculator, Loader2, StickyNote, Save, Bell, Printer, Pencil, Trash2, Info, FileDown, Undo2, Check } from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import DocxPreviewModal from './DocxPreviewModal';
import { updateRecordApi, fetchContracts, fetchExcerptHistory, saveExcerptRecord, fetchExcerptCounters, saveExcerptCounters, fetchTrichDoHistory, saveTrichDoRecord, fetchTrichDoCounters, saveTrichDoCounters } from '../services/api';
import SystemReceiptTemplate from './receive-record/SystemReceiptTemplate';
import SystemAnnexTemplate from './receive-record/SystemAnnexTemplate';
import { getBatchDisplayParts, calculateDeadlineHelperByDays, cleanNoteText } from '../utils/appHelpers';
import { RecordTimelineProgress } from './RecordTimelineProgress';

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
  onOpenRejectReturnModal?: (record: RecordFile) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, record, employees, users, currentUser, onEdit, onDelete, onCreateLiquidation, onCreateContract, onRefreshData, onOpenRejectReturnModal }) => {
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

  // State cho Vô Số GCN
  const [voSoIssueNumber, setVoSoIssueNumber] = useState('');
  const [voSoEntryNumber, setVoSoEntryNumber] = useState('');
  const [voSoIssueDate, setVoSoIssueDate] = useState('');

  // State cho Tự động lấy số Trích lục / Trích đo
  const [isGettingAutoNumber, setIsGettingAutoNumber] = useState(false);

  useEffect(() => {
      if (record) {
          setPersonalNote(record.personalNotes || '');
          setVoSoIssueNumber(record.issueNumber || '');
          setVoSoEntryNumber(record.entryNumber || '');
          setVoSoIssueDate(record.issueDate ? record.issueDate.split('T')[0] : '');
          // Set reminder date (yyyy-MM-dd)
          if (record.reminderDate) {
              setReminderDate(record.reminderDate.split('T')[0]);
          } else {
              setReminderDate('');
          }

          // Fetch Contract Price & Details
          const fetchPrice = async () => {
              const fetchedContracts = await fetchContracts();
              setContracts(fetchedContracts);
              // Tìm hợp đồng có cùng mã hồ sơ (qua customerAddress hoặc trường code kế thừa) - Match chính xác
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

  const handleAutoGetNumber = async () => {
    if (!record) return;
    setIsGettingAutoNumber(true);
    try {
        const recordTypeLower = (record.recordType || '').toLowerCase();
        const isTrichLuc = recordTypeLower.includes('trích lục') || recordTypeLower.includes('tl');
        const currentYear = new Date().getFullYear();
        const getCounterKey = (yr: number) => yr <= 2025 ? 'GLOBAL' : `GLOBAL_${yr}`;

        const serverHistory = isTrichLuc ? await fetchExcerptHistory() : await fetchTrichDoHistory();
        let maxNumberInHistory = 0;
        serverHistory.forEach((r: any) => {
            const itemYear = new Date(r.createdAt).getFullYear();
            const yearMatch = currentYear <= 2025 ? itemYear <= 2025 : itemYear === currentYear;
            if (yearMatch && r.excerptNumber > maxNumberInHistory) {
                maxNumberInHistory = r.excerptNumber;
            }
        });

        const serverCounters = isTrichLuc ? await fetchExcerptCounters() : await fetchTrichDoCounters();
        const counterKey = getCounterKey(currentYear);
        const currentCountOnServer = serverCounters[counterKey] || 0;
        const nextCount = Math.max(currentCountOnServer, maxNumberInHistory) + 1;

        const newExcerptRecord = {
            id: Math.random().toString(36).substr(2, 9),
            ward: record.ward || 'Chưa xác định',
            mapSheet: record.mapSheet || '---',
            landPlot: record.landPlot || '---',
            excerptNumber: nextCount,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.name || 'Hệ thống',
            linkedRecordCode: record.code,
            ownerName: (record as any).ownerName || record.customerName,
            address: (record as any).address || record.customerAddress,
            assignedTo: record.assignedTo || undefined
        };

        if (isTrichLuc) {
            await saveExcerptRecord(newExcerptRecord);
            await saveExcerptCounters({ ...serverCounters, [counterKey]: nextCount });
        } else {
            await saveTrichDoRecord(newExcerptRecord);
            await saveTrichDoCounters({ ...serverCounters, [counterKey]: nextCount });
        }

        const numStr = nextCount.toString();
        const updatedRecord: RecordFile = {
            ...record,
            excerptNumber: isTrichLuc ? numStr : (record.excerptNumber || numStr),
            measurementNumber: !isTrichLuc ? numStr : (record.measurementNumber || numStr)
        };

        const res = await updateRecordApi(updatedRecord);
        if (res) {
            if (isTrichLuc) record.excerptNumber = numStr;
            else record.measurementNumber = numStr;
            if (onRefreshData) onRefreshData();
            alert(`Đã cấp thành công ${isTrichLuc ? 'Số trích lục' : 'Số trích đo'}: ${numStr}`);
        } else {
            alert('Không thể lưu số vào hồ sơ. Vui lòng thử lại.');
        }
    } catch (error) {
        console.error('Lỗi lấy số tự động:', error);
        alert('Không thể lấy số tự động. Vui lòng thử lại!');
    } finally {
        setIsGettingAutoNumber(false);
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
                          {date ? formatDate(date) : (isActive ? 'Đang thực hiện' : 'Chưa thực hiện')}
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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-7xl 2xl:max-w-[1700px] max-h-[95vh] overflow-hidden flex flex-col animate-fade-in-up">
        
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
                {onOpenRejectReturnModal && record && (record.status === RecordStatus.PENDING_CHECK || record.status === RecordStatus.CHECKED || record.status === RecordStatus.PENDING_SIGN || record.status === RecordStatus.SIGNED) && (
                    <button
                        onClick={() => { onClose(); onOpenRejectReturnModal(record); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded hover:bg-rose-100 transition-colors text-sm font-bold shadow-sm"
                        title="Trả hồ sơ về bước trước (Yêu cầu sửa)"
                    >
                        <Undo2 size={16} /> Trả lại / Yêu cầu sửa
                    </button>
                )}

                {onCreateLiquidation && record && record.recordType && (getShortRecordType(record.recordType).startsWith('2.2') || getShortRecordType(record.recordType).startsWith('2.4')) && (
                    <button
                        onClick={() => { onClose(); onCreateLiquidation(record); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded hover:bg-gray-50 transition-colors text-sm font-medium"
                        title="Thanh lý HĐ"
                    >
                        <FileCheck size={16} /> Thanh lý HĐ
                    </button>
                )}

                {record && record.recordType && (getShortRecordType(record.recordType).startsWith('2.2') || getShortRecordType(record.recordType).startsWith('2.4')) && (
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
                
                {canPerformAction && onDelete && (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUBADMIN || currentUser?.role === UserRole.TEAM_LEADER) && (
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
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-3">
                        {record.assignedTo && (
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Cán bộ thụ lý / thực hiện</label>
                                <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0 font-bold">
                                        <UserIcon size={16}/>
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-sm text-gray-800 truncate">{getEmployeeName(record.assignedTo)}</span>
                                        {record.assignedDate && (
                                            <span className="text-[11px] text-gray-500">Ngày giao: {formatDate(record.assignedDate)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {record.checkedBy && (
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Cán bộ kiểm tra</label>
                                <div className="flex items-center gap-3 bg-orange-50 p-2.5 rounded-lg border border-orange-100">
                                    <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 shrink-0 font-bold">
                                        <UserIcon size={16}/>
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-sm text-orange-900 truncate">{getEmployeeName(record.checkedBy)}</span>
                                        {record.pendingCheckDate && (
                                            <span className="text-[11px] text-orange-600">Ngày trình: {formatDate(record.pendingCheckDate)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {record.submittedTo && (
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Lãnh đạo ký duyệt</label>
                                <div className="flex items-center gap-3 bg-indigo-50 p-2.5 rounded-lg border border-indigo-100">
                                    <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 shrink-0 font-bold">
                                        <UserIcon size={16}/>
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-sm text-indigo-900 truncate">{getEmployeeName(record.submittedTo)}</span>
                                        {record.submissionDate && (
                                            <span className="text-[11px] text-indigo-600">Ngày trình: {formatDate(record.submissionDate)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
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
                            type="date" 
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
                        {/* HÀNG BÁO HỢP ĐỒNG (CHỈ ÁP DỤNG CHO 2.3 VÀ 2.4) & SỐ TRÍCH ĐO / TRÍCH LỤC */}
                        {(() => {
                            const isContractProcedure = !!(record?.recordType && (getShortRecordType(record.recordType).startsWith('2.2') || getShortRecordType(record.recordType).startsWith('2.4')));
                            const hasExcerptOrMeasurement = !isCapGiayRecord(record) && !!(recordTypeLower.includes('trích đo') || recordTypeLower.includes('trích lục') || record?.measurementNumber || record?.excerptNumber);

                            if (!isContractProcedure && !hasExcerptOrMeasurement) return null;

                            return (
                                <div className={`grid grid-cols-1 ${isContractProcedure && hasExcerptOrMeasurement ? 'sm:grid-cols-2' : ''} gap-3 mb-4`}>
                                    {/* CỘT HỢP ĐỒNG LIÊN KẾT - CHỈ XUẤT HIỆN CHO THỦ TỤC 2.2 & 2.4 */}
                                    {isContractProcedure && (
                                        <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-3 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="bg-indigo-200 text-indigo-700 p-2 rounded-lg shrink-0">
                                                    <FileText size={16} />
                                                </div>
                                                <div className="text-left truncate">
                                                    <span className="text-[10px] text-indigo-600 uppercase font-bold block">Hợp đồng số :</span>
                                                    <p className="text-xs font-bold text-indigo-950 truncate">
                                                        {matchedContract ? matchedContract.code : 'Chưa có HĐ'}
                                                    </p>
                                                </div>
                                            </div>

                                            {onCreateContract && !matchedContract && (
                                                <button 
                                                    onClick={() => {
                                                        onCreateContract(record);
                                                        onClose();
                                                    }}
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 px-2.5 py-1.5 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0"
                                                >
                                                    Lập HĐ mới
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* CỘT SỐ TRÍCH ĐO / SỐ TRÍCH LỤC */}
                                    {hasExcerptOrMeasurement && (() => {
                                        const isTrichLuc = recordTypeLower.includes('trích lục') || recordTypeLower.includes('tl');
                                        const existingNum = isTrichLuc 
                                            ? record.excerptNumber 
                                            : (record.measurementNumber || record.excerptNumber);
                                        const hasNumber = !!(existingNum && existingNum !== '---' && existingNum !== '');

                                        return (
                                            <div className="bg-purple-50/80 border border-purple-100 rounded-xl p-3 flex items-center justify-between gap-2 min-w-0">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="bg-purple-200 text-purple-700 p-2 rounded-lg shrink-0">
                                                        <FileCheck size={16} />
                                                    </div>
                                                    <div className="text-left truncate">
                                                        <span className="text-[10px] text-purple-600 uppercase font-bold block">
                                                            {isTrichLuc ? 'Số trích lục' : 'Số trích đo'}
                                                        </span>
                                                        <p className="text-xs font-bold text-purple-950 truncate">
                                                            {hasNumber ? existingNum : 'Chưa có số'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {!hasNumber && (
                                                    <button
                                                        onClick={handleAutoGetNumber}
                                                        disabled={isGettingAutoNumber}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-purple-600 text-white hover:bg-purple-700 px-2.5 py-1.5 rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0 disabled:opacity-50"
                                                        title="Cấp số trích lục/trích đo tự động tiếp theo"
                                                    >
                                                        {isGettingAutoNumber ? <Loader2 size={13} className="animate-spin" /> : <Calculator size={13} />}
                                                        <span>Lấy số tự động</span>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })()}

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

                        {/* KHU VỰC THÔNG TIN THU PHÍ & TRẢ KẾT QUẢ */}
                        <div className="border-t border-gray-100 pt-4 mt-2">
                            <label className="text-[11px] font-bold text-slate-700 uppercase block mb-2.5 flex items-center gap-1.5">
                                <Receipt size={15} className="text-emerald-600" />
                                <span>Thông tin Trả kết quả & Thu phí / Lệ phí</span>
                            </label>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Thẻ Số tiền */}
                                <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200/80 flex flex-col items-center justify-center text-center min-w-0">
                                    <label className="text-[10px] text-emerald-700 uppercase font-bold block whitespace-nowrap truncate text-center">
                                        Số tiền thu
                                    </label>
                                    <p className="text-sm font-black text-emerald-800 whitespace-nowrap truncate mt-0.5 text-center">
                                        {record.returnedPrice !== undefined && record.returnedPrice !== null
                                            ? record.returnedPrice.toLocaleString('vi-VN')
                                            : (record.recordType === 'Cung cấp tài liệu đất đai' 
                                                ? '310.000' 
                                                : (contractPrice !== null && contractPrice !== undefined ? contractPrice.toLocaleString('vi-VN') : '---'))}
                                    </p>
                                </div>

                                {/* Thẻ Số BL/HĐ */}
                                <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200/80 flex flex-col items-center justify-center text-center min-w-0">
                                    <label className="text-[10px] text-blue-700 uppercase font-bold block whitespace-nowrap truncate text-center">
                                        {record.receiptType === 'Biên Lai' ? 'SỐ BIÊN LAI' : record.receiptType === 'Hóa Đơn' ? 'SỐ HÓA ĐƠN' : 'SỐ BIÊN LAI / HÓA ĐƠN'}
                                    </label>
                                    <p className="text-xs font-black text-blue-900 font-mono whitespace-nowrap truncate mt-0.5 text-center">
                                        {record.receiptNumber || '---'}
                                    </p>
                                </div>
                            </div>
                        </div>

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
                        {cleanNoteText(record.privateNotes) && (
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                    <div className="flex items-center gap-2 mb-1 text-yellow-800 font-bold text-xs">
                                        <Info size={14} />
                                        <span>Ghi chú nội bộ</span>
                                    </div>
                                    <p className="text-yellow-900 text-xs italic">"{cleanNoteText(record.privateNotes)}"</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUMN 3: TIẾN ĐỘ & NHẮC VIỆC */}
                <div className="space-y-6">
                    {/* KHU VỰC NHẬP THÔNG TIN VÔ SỔ GCN KHI KÝ XONG */}
                    {isCapGiayRecord(record) && (record.capGiaySubStep === 'vo_so_gcn' || record.status === RecordStatus.SIGNED) && (
                        <div className="bg-white rounded-xl border border-teal-200 shadow-sm overflow-hidden p-3 bg-gradient-to-br from-teal-50/50 to-white flex flex-col gap-3 animate-fade-in">
                            <div className="text-xs font-bold text-teal-900 flex items-center justify-between">
                                <span className="flex items-center gap-1.5"><FileCheck size={16} className="text-teal-600" /> Nhập thông tin Vô sổ GCN & Chuyển Chờ bàn giao</span>
                                <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-bold">Vô sổ GCN</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-teal-800 block mb-1">Số phát hành GCN</label>
                                    <input 
                                        type="text" 
                                        placeholder="VD: CD 123456" 
                                        className="w-full text-xs font-bold border border-teal-300 rounded px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                        value={voSoIssueNumber}
                                        onChange={(e) => setVoSoIssueNumber(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-teal-800 block mb-1">Số vào sổ GCN</label>
                                    <input 
                                                type="text" 
                                                placeholder="VD: CH 01234" 
                                                className="w-full text-xs font-bold border border-teal-300 rounded px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                                value={voSoEntryNumber}
                                                onChange={(e) => setVoSoEntryNumber(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-teal-800 block mb-1">Ngày ký GCN</label>
                                            <input 
                                                type="date" 
                                                className="w-full text-xs font-bold border border-teal-300 rounded px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                                value={voSoIssueDate}
                                                onChange={(e) => setVoSoIssueDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!canPerformAction}
                                        onClick={async () => {
                                            if (!canPerformAction) return;
                                            const updated = { 
                                                ...record, 
                                                issueNumber: voSoIssueNumber || record.issueNumber,
                                                entryNumber: voSoEntryNumber || record.entryNumber,
                                                issueDate: voSoIssueDate || record.issueDate,
                                                capGiaySubStep: 'cho_ban_giao', 
                                                status: RecordStatus.HANDOVER
                                            };
                                            const res = await updateRecordApi(updated);
                                            if (res) {
                                                record.issueNumber = updated.issueNumber;
                                                record.entryNumber = updated.entryNumber;
                                                record.issueDate = updated.issueDate;
                                                record.capGiaySubStep = 'cho_ban_giao';
                                                record.status = RecordStatus.HANDOVER;
                                                if (onRefreshData) onRefreshData();
                                            }
                                        }}
                                        className="w-full py-2 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-lg text-xs font-black shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Check size={16} className="stroke-[3]" />
                                        <span>Hoàn tất Vô sổ GCN → Chuyển sang Chờ bàn giao (1 cửa)</span>
                                    </button>
                                </div>
                            )}

                    {/* TIMELINE */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <RecordTimelineProgress 
                            record={record}
                            employees={employees}
                            users={users}
                            formatDate={formatDate}
                        />
                    </div>
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
                        const matched = matchedContract || contracts.find(c => {
                            const cAddr = (c.customerAddress || '').trim().toLowerCase();
                            const rCode = (record.code || '').trim().toLowerCase();
                            return rCode && cAddr === rCode;
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
    </div>
  );
};
