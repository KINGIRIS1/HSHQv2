
import React, { useState, useEffect, useMemo } from 'react';
import { RecordFile, Employee, User, UserRole, SplitItem, RecordStatus } from '../types';
import { getNormalizedWard, getShortRecordType, isArchiveRecordType, getCanonicalRecordType } from '../constants';
import StatusBadge from './StatusBadge';
import { X, MapPin, FileText, User as UserIcon, Receipt, DollarSign, CheckCircle2, Circle, Send, FileSignature, CheckSquare, CalendarClock, FileCheck, Calculator, Loader2, StickyNote, Save, Bell, Printer, Pencil, Trash2, Info, FileDown, Undo2, Clock } from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import DocxPreviewModal from './DocxPreviewModal';
import { updateRecordApi, fetchContracts } from '../services/api';
import { getDepartmentConfigs, getCoordinationWorkflows, executeStartCoordination, executeAdvanceCoordinationStep } from '../services/apiCoordination';
import SystemReceiptTemplate from './receive-record/SystemReceiptTemplate';
import SystemAnnexTemplate from './receive-record/SystemAnnexTemplate';
import { getEmployeeName as getEmpNameHelper, extractBatchOnly, formatStaffInfoHelper, resolveRecordStatus, getDepartmentForRecord } from '../utils/appHelpers';
import { calculateRecordStepDeadlines, StepDeadlineInfo, getStepIcon, getStepPerformerInfo } from '../utils/stepDeadlineEngine';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { ArrowRight, Layers, Share2, Sparkles, Building2, Users } from 'lucide-react';


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
  onOpenExtendModal?: (record: RecordFile) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, record, employees, users, currentUser, onEdit, onDelete, onCreateLiquidation, onCreateContract, onRefreshData, onOpenRejectReturnModal, onOpenExtendModal }) => {
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

  // State cho Phối hợp liên tổ
  const [showCoordinationModal, setShowCoordinationModal] = useState(false);
  const [availableDepartments, setAvailableDepartments] = useState(getDepartmentConfigs());
  const [availableWorkflows, setAvailableWorkflows] = useState(getCoordinationWorkflows());
  const [selectedCoordWorkflowId, setSelectedCoordWorkflowId] = useState('');
  const [coordinationTargetDept, setCoordinationTargetDept] = useState('Tổ Đo đạc');
  const [coordinationNoteInput, setCoordinationNoteInput] = useState('');
  const [isSubmittingCoordination, setIsSubmittingCoordination] = useState(false);

  // State cho Modal Chuyển bước
  const [showAdvanceStepModal, setShowAdvanceStepModal] = useState(false);
  const [advanceStepNote, setAdvanceStepNote] = useState('');
  const [advanceStepDoc, setAdvanceStepDoc] = useState('');

  // Tải danh sách quy trình & tổ chuyên môn khi mở modal
  useEffect(() => {
    const depts = getDepartmentConfigs();
    const wfs = getCoordinationWorkflows();
    setAvailableDepartments(depts);
    setAvailableWorkflows(wfs);
    if (wfs.length > 0 && !selectedCoordWorkflowId) {
      setSelectedCoordWorkflowId(wfs[0].id);
      setCoordinationTargetDept(wfs[0].targetDept);
    }
  }, [showCoordinationModal]);

  const handleStartCoordination = async () => {
      if (!record) return;
      if (!coordinationNoteInput.trim()) {
          alert('Vui lòng nhập nội dung/yêu cầu phối hợp.');
          return;
      }
      setIsSubmittingCoordination(true);
      const userLabel = currentUser ? currentUser.name : 'Cán bộ thụ lý';
      const origDept = record.originalDept || getDepartmentForRecord(record);

      const res = await executeStartCoordination(record, {
        workflowId: selectedCoordWorkflowId || undefined,
        sourceDept: origDept,
        targetDept: coordinationTargetDept,
        notes: coordinationNoteInput.trim(),
        user: { name: userLabel, username: currentUser?.username, role: currentUser?.role }
      });

      setIsSubmittingCoordination(false);
      if (res.success) {
        alert(res.message);
        setShowCoordinationModal(false);
        setCoordinationNoteInput('');
        if (onRefreshData) onRefreshData();
        // Update local modal object
        Object.assign(record, res.record);
      } else {
        alert(res.message);
      }
  };

  const handleAdvanceCoordinationStep = async () => {
    if (!record) return;
    setIsSubmittingCoordination(true);
    const userLabel = currentUser ? currentUser.name : 'Cán bộ thụ lý';
    const currentIdx = record.coordinationCurrentStepIndex ?? 0;
    const nextIdx = currentIdx + 1;

    const res = await executeAdvanceCoordinationStep(record, {
      nextStepIndex: nextIdx,
      note: advanceStepNote.trim() || undefined,
      attachedDocs: advanceStepDoc.trim() ? [advanceStepDoc.trim()] : undefined,
      user: { name: userLabel, username: currentUser?.username, role: currentUser?.role }
    });

    setIsSubmittingCoordination(false);
    if (res.success) {
      alert(res.message);
      setShowAdvanceStepModal(false);
      setAdvanceStepNote('');
      setAdvanceStepDoc('');
      if (onRefreshData) onRefreshData();
      Object.assign(record, res.record);
    } else {
      alert(res.message);
    }
  };

  const handleCompleteCoordination = async () => {
      if (!record || !record.coordinationDept) return;
      if (!confirm(`Xác nhận hoàn thành phối hợp và chuyển trả hồ sơ về tổ ban đầu (${record.originalDept || 'Tổ ban đầu'})?`)) return;

      setIsSubmittingCoordination(true);
      const nowStr = new Date().toLocaleString('vi-VN');
      const userLabel = currentUser ? `${currentUser.name}` : 'Hệ thống';
      const origDept = record.originalDept || 'Tổ ban đầu';
      const coordDept = record.coordinationDept;
      const logMsg = `[Phối hợp liên tổ] ${coordDept} đã hoàn thành phối hợp và bàn giao trả về ${origDept} bởi ${userLabel} lúc ${nowStr}.`;
      const newPrivateNotes = record.privateNotes ? `${record.privateNotes}\n${logMsg}` : logMsg;

      const updatedRecord: RecordFile = {
          ...record,
          coordinationStatus: 'completed',
          coordinationDept: null as any,
          coordinationCurrentStepId: null,
          privateNotes: newPrivateNotes
      };

      try {
          const res = await updateRecordApi(updatedRecord);
          if (res) {
              alert(`Đã hoàn thành phối hợp và chuyển trả hồ sơ về ${origDept} thành công!`);
              if (onRefreshData) onRefreshData();
              record.coordinationStatus = 'completed';
              record.coordinationDept = null as any;
              record.coordinationCurrentStepId = null;
              record.privateNotes = newPrivateNotes;
          } else {
              alert('Lỗi khi hoàn thành phối hợp.');
          }
      } catch (e) {
          console.error(e);
          alert('Có lỗi xảy ra.');
      } finally {
          setIsSubmittingCoordination(false);
      }
  };

  // State to refresh SLA workflow on external changes
  const [wfVersion, setWfVersion] = useState(0);
  useEffect(() => {
    const handleWfUpdated = () => setWfVersion(v => v + 1);
    window.addEventListener('workflow_config_updated', handleWfUpdated);
    return () => window.removeEventListener('workflow_config_updated', handleWfUpdated);
  }, []);

  // Compute dynamic SLA deadlines for every step in the procedure workflow
  const stepDeadlines = useMemo(() => {
    return record ? calculateRecordStepDeadlines(record) : [];
  }, [record, wfVersion]);

  useEffect(() => {
      if (record) {
          setPersonalNote(record.personalNotes || '');
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
                  setContractPrice(null);
                  setContractSplitItems(null);
                  setLiquidationInfo(null);
              }
          };
          fetchPrice();
      }
  }, [record?.id, record?.personalNotes, record?.reminderDate, isOpen]);

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
    return getEmpNameHelper(id, employees);
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
        LOAI_HS: val(getCanonicalRecordType(record.recordType, record.code)), 
        RECORD_TYPE: val(getCanonicalRecordType(record.recordType, record.code)),
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

  // Helper cho Timeline Step Item
  const TimelineStepItem = ({ 
    step, 
    icon: Icon, 
    isLast, 
    colorClass, 
    subText 
  }: { 
    step: StepDeadlineInfo; 
    icon: any; 
    isLast: boolean; 
    colorClass: { text: string; border: string; bg: string }; 
    subText?: string; 
  }) => {
      const isCompleted = step.status === 'completed';
      const isCurrent = step.isCurrentStep;
      const isActive = isCompleted || isCurrent || !!step.endDate || !!step.startDate;

      let dateDisplay = 'Chưa thực hiện';
      if (step.endDate) {
        dateDisplay = formatDate(step.endDate);
      } else if (step.startDate && (isCurrent || isCompleted)) {
        dateDisplay = isCurrent ? `Bắt đầu: ${formatDate(step.startDate)}` : formatDate(step.startDate);
      } else if (isCurrent) {
        dateDisplay = 'Đang thực hiện';
      }

      return (
          <div className="relative flex gap-4">
              <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 bg-white transition-all ${
                      isCompleted 
                        ? `${colorClass.border} ${colorClass.text}` 
                        : isCurrent 
                          ? `${colorClass.border} ring-4 ring-indigo-50 ${colorClass.text}` 
                          : 'border-gray-200 text-gray-300'
                  }`}>
                      {isCompleted ? (
                        <CheckCircle2 size={16} className={colorClass.text} />
                      ) : isCurrent ? (
                        <Icon size={15} className={colorClass.text} />
                      ) : (
                        <Circle size={15} className="text-gray-300" />
                      )}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 grow ${isCompleted ? colorClass.bg : 'bg-gray-100'} my-1 min-h-[32px]`}></div>
                  )}
              </div>
              <div className="pb-5 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                      <p className={`text-xs font-bold uppercase tracking-wide ${isActive ? colorClass.text : 'text-gray-400'}`}>
                          {step.stepName}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${step.slaStatus.badgeClass}`}>
                          {step.slaStatus.label}
                      </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                      <Icon size={13} className={isActive ? 'text-gray-500' : 'text-gray-300'} />
                      <span className={`font-medium ${isActive ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                          {dateDisplay}
                      </span>
                  </div>

                  {/* SLA Info & Target Step Deadline */}
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-gray-500">
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium">
                          SLA: {step.slaDisplay}
                      </span>
                      {step.deadlineDate && (isCurrent || isCompleted) && (
                          <span className="text-gray-400">
                              • Hạn bước: {formatDate(step.deadlineDate)}
                          </span>
                      )}
                      {step.timeRemainingText && isCurrent && (
                          <span className={`font-semibold ${step.slaStatus.colorClass}`}>
                              ({step.timeRemainingText})
                          </span>
                      )}
                  </div>

                  {subText && <p className="text-[11px] text-indigo-600 mt-1 font-medium italic">{subText}</p>}
              </div>
          </div>
      );
  };

  // LOGIC HIỂN THỊ STATUS CHUẨN XÁC
  const displayStatus = resolveRecordStatus(record);
  const recordTypeLower = (record?.recordType || '').toLowerCase();
  const isCongVan = record?.recordType ? getShortRecordType(record.recordType) === '1.2 Công văn' : false;

  // LOGIC CHECK NẾU ĐÃ THỰC HIỆN XONG (Để hiển thị bước "Đã thực hiện")
  const isWorkDone = [
      RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(displayStatus) || !!record.completedWorkDate;
  
  const isPendingCheckActive = [
      RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(displayStatus) || !!record.pendingCheckDate;

  const isCheckedActive = [
      RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(displayStatus) || !!record.checkedDate;

  const isPendingSignActive = [
      RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(displayStatus) || !!record.submissionDate;

  const isSignedActive = [
      RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(displayStatus) || !!record.approvalDate;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col animate-fade-in-up">
        
        {/* HEADER */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded text-sm border border-blue-200">
                    {record.code}
                </span>
                <h2 className="text-lg font-bold text-gray-800 uppercase">{getShortRecordType(record.recordType, record.code)}</h2>
                <StatusBadge status={displayStatus} />
            </div>
            
            <div className="flex items-center gap-2">
                {record && (!record.coordinationDept || record.coordinationStatus === 'completed') && (
                    <button
                        onClick={() => setShowCoordinationModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded hover:bg-purple-100 transition-colors text-sm font-bold shadow-sm"
                        title="Chuyển phối hợp chuyên môn sang tổ khác"
                    >
                        <Users size={16} /> Phối hợp liên tổ
                    </button>
                )}

                {onOpenRejectReturnModal && record && (record.status === RecordStatus.PENDING_CHECK || record.status === RecordStatus.CHECKED || record.status === RecordStatus.PENDING_SIGN || record.status === RecordStatus.SIGNED) && (
                    <button
                        onClick={() => { onClose(); onOpenRejectReturnModal(record); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded hover:bg-rose-100 transition-colors text-sm font-bold shadow-sm"
                        title="Trả hồ sơ (Yêu cầu sửa / bổ sung / hủy)"
                    >
                        <Undo2 size={16} /> Trả hồ sơ
                    </button>
                )}

                {onOpenExtendModal && record && (
                    <button
                        onClick={() => { onClose(); onOpenExtendModal(record); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded hover:bg-amber-100 transition-colors text-sm font-bold shadow-sm"
                        title="Gia hạn ngày hẹn trả"
                    >
                        <CalendarClock size={16} /> Gia hạn
                    </button>
                )}

                {onCreateLiquidation && record && record.recordType && (() => {
                    const st = getShortRecordType(record.recordType);
                    const rt = (record.recordType || '').toLowerCase();
                    return st.startsWith('2.1') || st.startsWith('2.2') || st.startsWith('2.4') || st.startsWith('2.5') || rt.includes('2.1') || rt.includes('2.2') || rt.includes('2.4') || rt.includes('2.5') || rt.includes('trích lục') || rt.includes('trích đo') || rt.includes('cắm mốc') || rt.includes('tách thửa');
                })() && (
                    <button
                        onClick={() => { onClose(); onCreateLiquidation(record); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded hover:bg-gray-50 transition-colors text-sm font-medium"
                        title="Thanh lý HĐ"
                    >
                        <FileCheck size={16} /> Thanh lý HĐ
                    </button>
                )}

                {record && record.recordType && (() => {
                    const st = getShortRecordType(record.recordType);
                    const rt = (record.recordType || '').toLowerCase();
                    return st.startsWith('2.1') || st.startsWith('2.2') || st.startsWith('2.4') || st.startsWith('2.5') || rt.includes('2.1') || rt.includes('2.2') || rt.includes('2.4') || rt.includes('2.5') || rt.includes('trích lục') || rt.includes('trích đo') || rt.includes('cắm mốc') || rt.includes('tách thửa');
                })() && (
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

        {/* ACTIVE COORDINATION BANNER */}
        {record.coordinationDept && record.coordinationStatus !== 'completed' && (() => {
            const activeWf = availableWorkflows.find(w => w.id === record.coordinationWorkflowId);
            const steps = activeWf?.steps || [];
            const curStepIdx = record.coordinationCurrentStepIndex ?? 0;
            const curStep = steps[curStepIdx];

            return (
                <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-purple-50 border-b border-purple-200 px-6 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 shadow-xs">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5 shadow-xs">
                            <Layers size={18} />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded bg-purple-200 text-purple-900 border border-purple-300">
                                    Đang phối hợp
                                </span>
                                <span className="font-extrabold text-sm text-gray-900">
                                    {record.originalDept || 'Tổ ban đầu'} ➔ <span className="text-purple-700">{record.coordinationDept}</span>
                                </span>
                                {activeWf && (
                                    <span className="text-xs text-purple-600 font-semibold">({activeWf.name})</span>
                                )}
                            </div>

                            {/* STEPS TIMELINE MINI */}
                            {curStep && (
                                <div className="flex items-center gap-2 text-xs text-gray-700 pt-0.5">
                                    <span className="font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full text-[11px]">
                                        Bước {curStepIdx + 1}/{steps.length}: {curStep.name}
                                    </span>
                                    {curStep.slaDisplay && (
                                        <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                                            <Clock size={12} /> Hạn SLA: {curStep.slaDisplay}
                                        </span>
                                    )}
                                </div>
                            )}

                            {record.coordinationNotes && (
                                <p className="text-xs text-gray-600 italic">
                                    Nội dung: {record.coordinationNotes}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <button
                            onClick={() => setShowAdvanceStepModal(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-sm text-xs transition-colors"
                        >
                            <ArrowRight size={14} /> Chuyển bước tiếp theo
                        </button>
                        <button
                            onClick={handleCompleteCoordination}
                            disabled={isSubmittingCoordination}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-100 text-purple-800 border border-purple-300 font-bold rounded-lg text-xs transition-colors disabled:opacity-50"
                            title="Hoàn tất và chuyển trả ngay lập tức"
                        >
                            {isSubmittingCoordination ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                            Chuyển trả về {record.originalDept || 'Tổ ban đầu'}
                        </button>
                    </div>
                </div>
            );
        })()}

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLUMN 1: THÔNG TIN CHUNG */}
                <div className="space-y-6">
                    {/* KHÁCH HÀNG */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-xs font-bold text-blue-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-blue-600 pl-2">
                            <UserIcon size={16}/> {isCongVan ? 'Thông tin nơi gửi / nhận' : 'Thông tin khách hàng'}
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                                    {isCongVan ? 'Số, ký hiệu Công văn' : 'Thông tin khách hàng'}
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
                            {(() => {
                                const authParsed = parseAuthDocType(record.authDocType);
                                const authName = record.authorizedPersonName || record.authorizedBy;
                                const authCccd = record.authorizedPersonId || authParsed.cccd;
                                const authPhone = record.authorizedPersonPhone || authParsed.phone;
                                const authAddress = record.authorizedPersonAddress || authParsed.address;

                                if (!authName && !authCccd && !authPhone && !authAddress) return null;

                                return (
                                    <div className="border-t border-gray-100 pt-3 mt-1">
                                        <label className="text-[10px] text-indigo-500 uppercase font-bold block mb-2">Người được ủy quyền</label>
                                        <div className="space-y-1.5 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                                            {authName && (
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500">Họ tên:</span>
                                                    <span className="font-bold text-indigo-900">{authName}</span>
                                                </div>
                                            )}
                                            {authPhone && (
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500">Số điện thoại:</span>
                                                    <span className="font-bold text-emerald-700 font-mono">{authPhone}</span>
                                                </div>
                                            )}
                                            {authCccd && (
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500">CCCD:</span>
                                                    <span className="font-semibold text-gray-800 font-mono">{authCccd}</span>
                                                </div>
                                            )}
                                            {authAddress && (
                                                <div className="text-xs">
                                                    <span className="text-gray-500 block mb-0.5">Địa chỉ thường trú:</span>
                                                    <span className="font-semibold text-gray-800 block">{authAddress}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
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
                    {/* NỘI DUNG */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
                        {/* HÀNG BÁO HỢP ĐỒNG (CHỈ ÁP DỤNG CHO 2.2 VÀ 2.4) & SỐ TRÍCH ĐO / TRÍCH LỤC */}
                        {(() => {
                            const isArchive = isArchiveRecordType(record?.recordType || '');
                            const is23Procedure = (record?.recordType || '').toLowerCase().includes('2.3') || (record?.recordType || '').toLowerCase().includes('dđ & cc số thửa') || (record?.recordType || '').toLowerCase().includes('dd & cc so thua');
                            const isContractProcedure = !!(record?.recordType && (getShortRecordType(record.recordType).startsWith('2.1') || getShortRecordType(record.recordType).startsWith('2.2') || getShortRecordType(record.recordType).startsWith('2.4') || getShortRecordType(record.recordType).startsWith('2.5') || (record.recordType || '').toLowerCase().includes('2.1') || (record.recordType || '').toLowerCase().includes('2.5')));
                            const hasExcerptOrMeasurement = !isArchive && !is23Procedure && !!(recordTypeLower.includes('trích đo') || recordTypeLower.includes('trích lục') || record?.measurementNumber || record?.excerptNumber);

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
                                    {hasExcerptOrMeasurement && (
                                        <div className="bg-purple-50/80 border border-purple-100 rounded-xl p-3 flex items-center gap-2.5">
                                            <div className="bg-purple-200 text-purple-700 p-2 rounded-lg shrink-0">
                                                <FileCheck size={16} />
                                            </div>
                                            <div className="text-left truncate">
                                                <span className="text-[10px] text-purple-600 uppercase font-bold block">
                                                    {recordTypeLower.includes('trích lục') ? 'Số trích lục' : 'Số trích đo'}
                                                </span>
                                                <p className="text-xs font-bold text-purple-950 truncate">
                                                    {recordTypeLower.includes('trích lục') 
                                                        ? (record.excerptNumber || '---') 
                                                        : (record.measurementNumber || record.excerptNumber || '---')}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        <h3 className="text-xs font-bold text-purple-600 uppercase mb-2 flex items-center gap-2 border-l-4 border-purple-600 pl-2">
                            <FileText size={16}/> Nội dung chi tiết
                        </h3>
                        
                        <div className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-200/80 text-gray-800 text-sm font-medium mb-4 leading-relaxed whitespace-pre-line">
                            {record.content ? record.content : <span className="text-gray-400 italic">Không có nội dung chi tiết.</span>}
                        </div>

                        {/* GIẤY TỜ KÈM THEO */}
                        <div className="mb-4">
                            <label className="text-[10px] text-teal-600 uppercase font-bold block mb-2 flex items-center gap-1">
                                <FileText size={12} /> Giấy tờ kèm theo
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
                                                        <th className="py-1.5 px-2">Tên giấy tờ</th>
                                                        <th className="py-1.5 px-2 w-28 text-center">Hình thức</th>
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

                        {record.explanationPlan && (
                            <div className="mb-6">
                                <label className="text-[10px] text-purple-500 uppercase font-bold block mb-1">Phương án giải trình</label>
                                <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-purple-900 text-sm font-medium">
                                    {record.explanationPlan}
                                </div>
                            </div>
                        )}

                        {/* KHU VỰC THÔNG TIN THU PHÍ & TRẢ KẾT QUẢ - ẨN KHI LÀ THỦ TỤC 2.3 KHÔNG THU PHÍ */}
                        {!((record?.recordType || '').toLowerCase().includes('2.3') || (record?.recordType || '').toLowerCase().includes('dđ & cc số thửa') || (record?.recordType || '').toLowerCase().includes('dd & cc so thua')) && (
                            <div className="border-t border-gray-100 pt-4 mt-2">
                                <label className="text-[11px] font-bold text-slate-700 uppercase block mb-2.5 flex items-center gap-1.5">
                                    <Receipt size={15} className="text-emerald-600" />
                                    <span>Thông tin Trả kết quả & Thu phí / Lệ phí</span>
                                </label>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Thẻ Số tiền */}
                                    <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200/80 flex flex-col justify-center min-w-0">
                                        <label className="text-[10px] text-emerald-700 uppercase font-bold block whitespace-nowrap truncate">
                                            Số tiền thu
                                        </label>
                                        <p className="text-sm font-black text-emerald-800 whitespace-nowrap truncate mt-0.5">
                                            {record.status === RecordStatus.REJECTED || record.status === RecordStatus.WITHDRAWN || (record.notes || '').toLowerCase().includes('trả hủy') || (record.notes || '').toLowerCase().includes('rút hồ sơ')
                                                ? '0 đ (Miễn thu)'
                                                : (record.returnedPrice !== undefined && record.returnedPrice !== null
                                                    ? record.returnedPrice.toLocaleString('vi-VN') + ' đ'
                                                    : (record.price !== undefined && record.price !== null && record.price > 0
                                                        ? record.price.toLocaleString('vi-VN') + ' đ'
                                                        : (contractPrice !== null && contractPrice !== undefined ? contractPrice.toLocaleString('vi-VN') + ' đ' : '---')))}
                                        </p>
                                    </div>

                                    {/* Thẻ Số BL/HĐ */}
                                    <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200/80 flex flex-col justify-center min-w-0">
                                        <label className="text-[10px] text-blue-700 uppercase font-bold block whitespace-nowrap truncate">
                                            {record.receiptType === 'Biên Lai' ? 'SỐ BIÊN LAI' : record.receiptType === 'Hóa Đơn' ? 'SỐ HÓA ĐƠN' : 'SỐ BIÊN LAI / HÓA ĐƠN'}
                                        </label>
                                        <p className="text-xs font-black text-blue-900 font-mono whitespace-nowrap truncate mt-0.5">
                                            {record.receiptNumber 
                                                ? record.receiptNumber 
                                                : (record.status === RecordStatus.REJECTED || record.status === RecordStatus.WITHDRAWN || (record.notes || '').toLowerCase().includes('trả hủy') || (record.notes || '').toLowerCase().includes('rút hồ sơ')
                                                    ? 'Không phát hành' 
                                                    : '---')}
                                        </p>
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
                        </div>

                        <div className="p-6 space-y-0">
                            {stepDeadlines.map((step, idx) => {
                                const StepIcon = getStepIcon(step.stepCode);
                                const subText = getStepPerformerInfo(record, step.stepCode, employees, users);
                                const isLast = idx === stepDeadlines.length - 1;

                                let colorClass = { text: 'text-indigo-700', border: 'border-indigo-600', bg: 'bg-indigo-600' };
                                if (step.stepCode === 'tiep_nhan') {
                                    colorClass = { text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600' };
                                } else if (step.stepCode === 'dang_thuc_hien' || step.stepCode === 'tham_dinh') {
                                    colorClass = { text: 'text-blue-700', border: 'border-blue-600', bg: 'bg-blue-600' };
                                } else if (step.stepCode === 'trinh_kiem_tra') {
                                    colorClass = { text: 'text-orange-700', border: 'border-orange-600', bg: 'bg-orange-600' };
                                } else if (step.stepCode === 'trinh_ky') {
                                    colorClass = { text: 'text-purple-700', border: 'border-purple-600', bg: 'bg-purple-600' };
                                } else if (step.stepCode === 'hoan_thanh') {
                                    colorClass = {
                                        text: record.status === RecordStatus.REJECTED ? 'text-red-700' : 'text-green-700',
                                        border: record.status === RecordStatus.REJECTED ? 'border-red-600' : 'border-green-600',
                                        bg: record.status === RecordStatus.REJECTED ? 'bg-red-600' : 'bg-green-600'
                                    };
                                } else if (step.stepCode === 'tra_ket_qua') {
                                    colorClass = { text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600' };
                                }

                                return (
                                    <TimelineStepItem
                                        key={step.stepCode}
                                        step={step}
                                        icon={StepIcon}
                                        isLast={isLast}
                                        colorClass={colorClass}
                                        subText={subText}
                                    />
                                );
                            })}
                        </div>
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

        {/* MODAL: KHỞI TẠO PHỐI HỢP LIÊN TỔ */}
        {showCoordinationModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 p-6 animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Users size={18} className="text-purple-600" />
                            Khởi tạo Phối hợp Liên tổ Chuyên môn
                        </h3>
                        <button onClick={() => setShowCoordinationModal(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* CHỌN QUY TRÌNH MẪU NẾU CÓ */}
                        {availableWorkflows.length > 0 && (
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                    Mẫu Quy trình phối hợp (Tự động tải các bước & SLA)
                                </label>
                                <select
                                    value={selectedCoordWorkflowId}
                                    onChange={(e) => {
                                        const wfId = e.target.value;
                                        setSelectedCoordWorkflowId(wfId);
                                        const wf = availableWorkflows.find(w => w.id === wfId);
                                        if (wf) {
                                            setCoordinationTargetDept(wf.targetDept);
                                        }
                                    }}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-purple-500 bg-purple-50/50"
                                >
                                    {availableWorkflows.map(wf => (
                                        <option key={wf.id} value={wf.id}>
                                            {wf.name} ({wf.sourceDept} ➔ {wf.targetDept})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tổ Khởi tạo (Gốc)</label>
                                <div className="p-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-gray-700">
                                    {record.originalDept || getDepartmentForRecord(record)}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tổ Nhận phối hợp</label>
                                <select
                                    value={coordinationTargetDept}
                                    onChange={(e) => setCoordinationTargetDept(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg p-2 text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    {availableDepartments.map(d => (
                                        <option key={d.id} value={d.name}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* WORKFLOW STEPS PREVIEW */}
                        {(() => {
                            const selWf = availableWorkflows.find(w => w.id === selectedCoordWorkflowId);
                            if (!selWf) return null;
                            return (
                                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                                    <div className="text-[11px] font-bold text-purple-900 flex items-center justify-between">
                                        <span>Các bước trong quy trình ({selWf.steps.length} bước):</span>
                                        {selWf.autoReturnToOrigin && (
                                            <span className="text-emerald-700 font-extrabold flex items-center gap-1 text-[10px]">
                                                <CheckCircle2 size={12} /> Tự động chuyển trả về tổ gốc
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {selWf.steps.map((st, i) => (
                                            <div key={st.id || i} className="flex items-center justify-between text-[11px] text-gray-700 bg-white px-2.5 py-1 rounded border border-gray-100">
                                                <span className="font-medium">{i + 1}. {st.name}</span>
                                                <span className="text-[10px] font-bold text-gray-500">{st.slaDisplay}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nội dung / Yêu cầu phối hợp *</label>
                            <textarea
                                value={coordinationNoteInput}
                                onChange={(e) => setCoordinationNoteInput(e.target.value)}
                                placeholder="Nhập yêu cầu chuyên môn cụ thể (VD: Đo đạc kiểm tra hiện trạng ranh giới, trích lục hồ sơ địa chính năm 2015...)"
                                rows={3}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setShowCoordinationModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-xs font-medium"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleStartCoordination}
                                disabled={isSubmittingCoordination}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {isSubmittingCoordination && <Loader2 size={14} className="animate-spin" />}
                                Bắt đầu Phối hợp
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: CHUYỂN BƯỚC TIẾP THEO TRONG QUY TRÌNH PHỐI HỢP */}
        {showAdvanceStepModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 p-6 animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <ArrowRight size={18} className="text-purple-600" />
                            Chuyển bước Phối hợp tiếp theo
                        </h3>
                        <button onClick={() => setShowAdvanceStepModal(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-1">
                            <div className="font-bold text-purple-900">
                                Hồ sơ: <span className="font-mono text-purple-700">{record.code}</span> - {record.customerName}
                            </div>
                            <div className="text-purple-800">
                                Tổ phối hợp: <strong>{record.coordinationDept}</strong>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Kết quả xử lý bước / Ghi chú</label>
                            <textarea
                                value={advanceStepNote}
                                onChange={(e) => setAdvanceStepNote(e.target.value)}
                                placeholder="Ghi chú kết quả (VD: Đã đo vẽ hoàn tất bản vẽ hiện trạng, đã đối soát dữ liệu...)"
                                rows={3}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tài liệu / Bản vẽ đính kèm</label>
                            <input
                                type="text"
                                value={advanceStepDoc}
                                onChange={(e) => setAdvanceStepDoc(e.target.value)}
                                placeholder="Tên tệp đính kèm (VD: Bản vẽ trích đo 2026.pdf)"
                                className="w-full border border-gray-300 rounded-lg p-2 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 flex items-start gap-2">
                            <CheckCircle2 size={16} className="text-amber-600 shrink-0 mt-0.5" />
                            <span>
                                Khi duyệt bước cuối, hệ thống sẽ <strong>tự động bàn giao và chuyển trả hồ sơ về {record.originalDept || 'Tổ ban đầu'}</strong>.
                            </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setShowAdvanceStepModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-xs font-medium"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleAdvanceCoordinationStep}
                                disabled={isSubmittingCoordination}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {isSubmittingCoordination && <Loader2 size={14} className="animate-spin" />}
                                Xác nhận Chuyển bước
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
