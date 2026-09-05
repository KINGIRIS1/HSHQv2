
import React, { useState, useEffect, useMemo } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole } from '../types';
import AutoResizeTextarea from './AutoResizeTextarea';
import { GROUPS, EXTENDED_RECORD_TYPES, STATUS_LABELS, SELECTABLE_STATUSES, getShortRecordType, getWardLabel, getNormalizedWard, isArchiveRecordType } from '../constants';
import { X, Save, Lock, User as UserIcon, MapPin, FileText, Calendar, FileCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateDeadlineHelper, getDepartmentForRecord, isProcedure2_3, syncRecordStatusTransition, getPureBatchNumber, groupEmployeesByDepartment } from '../utils/appHelpers';
import { fetchContracts } from '../services/api';

interface AttachedDocItem {
  id: string;
  name: string;
  type: 'Bản chính' | 'Bản sao';
}

const parseAttachedDocs = (otherDocsStr: string | null | undefined): AttachedDocItem[] => {
    if (!otherDocsStr) return [];
    try {
        const parsed = JSON.parse(otherDocsStr);
        if (Array.isArray(parsed)) {
            return parsed.map((item: any, idx: number) => ({
                id: item.id || String(idx + 1),
                name: item.name || '',
                type: item.type === 'Bản sao' ? 'Bản sao' : 'Bản chính'
            }));
        }
    } catch (e) {
        const parts = otherDocsStr.split('|');
        if (parts[0]) {
            return [{
                id: '1',
                name: parts[0],
                type: parts[1] === 'Bản sao' ? 'Bản sao' : 'Bản chính'
            }];
        }
    }
    return [];
};

const parseAuthDocType = (str: string | null | undefined) => {
    if (!str) return { cccd: '', address: '' };
    const parts = str.split('|');
    const firstPart = parts[0] || '';
    const secondPart = parts[1] || '';
    
    // Check if first part is an old document type
    const knownDocTypes = ['Hợp đồng ủy quyền', 'Giấy ủy quyền', 'Văn bản ủy quyền', 'Hợp đồng uỷ quyền', 'Giấy uỷ quyền', 'Văn bản uỷ quyền', 'Khác'];
    const isDocType = knownDocTypes.some(type => firstPart.toLowerCase().includes(type.toLowerCase()));
    
    if (isDocType) {
        if (parts.length >= 4) {
            // Old format proposal: Loại|Hình thức|CCCD|SĐT
            return { cccd: parts[2] || '', address: parts[3] || '' };
        }
        return { cccd: '', address: '' };
    } else {
        // New format: CCCD|Address
        return {
            cccd: firstPart,
            address: secondPart
        };
    }
};

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (record: Omit<RecordFile, 'id' | 'status'> & { id?: string, status?: RecordStatus }) => void;
  initialData?: RecordFile | null;
  employees: Employee[];
  currentUser: User;
  wards: string[];
  currentView?: string;
  holidays?: any[];
  records?: RecordFile[];
}

const generateHQCode = (dateStr: string, recordsList: RecordFile[] = []) => {
    const d = new Date(dateStr || new Date());
    const year = d.getFullYear().toString();
    const yy = year.slice(-2);
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const datePrefix = `${yy}${mm}${dd}`;

    let maxSeq = 0;
    recordsList.forEach((r) => {
        if (!r.code) return;
        const parts = r.code.split('-');
        if (parts.length >= 2) {
            const rDate = parts.length === 3 ? parts[1] : parts[0];
            const rSeq = parts.length === 3 ? parts[2] : parts[1];
            if (rDate && rDate.substring(0, 2) === yy) {
                const seqNum = parseInt(rSeq, 10);
                if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
            }
        }
    });

    const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
    return `HQ-${datePrefix}-${nextSeq}`;
};

const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSubmit, initialData, employees, currentUser, wards, currentView, holidays, records }) => {
  const defaultState: Partial<RecordFile> = {
    code: '', customerName: '', phoneNumber: '', cccd: '', customerAddress: '', content: '', otherDocs: '',
    receivedDate: new Date().toISOString(), deadline: '', assignedTo: '', status: RecordStatus.RECEIVED,
    group: GROUPS[0], ward: '', landPlot: '', mapSheet: '', area: 0, address: '',
    recordType: '', measurementNumber: '', excerptNumber: '',
    issueNumber: '', entryNumber: '', issueDate: '',
    privateNotes: '', authorizedBy: '', authDocType: '', receiptNumber: '', resultReturnedDate: '', explanationPlan: ''
  };

  const [formData, setFormData] = useState<Partial<RecordFile>>(defaultState);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDocItem[]>([]);
  const [authCccd, setAuthCccd] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  const isEdit = !!initialData && !!initialData.id;
  const hasAdminRights = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN || currentUser.role === UserRole.TEAM_LEADER;
  const isOneDoor = currentUser.role === UserRole.ONEDOOR;
  const canEditResult = (hasAdminRights || isOneDoor) && isEdit;

  const isExemptReceipt = Boolean(
    isProcedure2_3(formData.recordType) ||
    formData.status === RecordStatus.WITHDRAWN ||
    formData.status === RecordStatus.REJECTED ||
    (initialData?.statusLogs && initialData.statusLogs.some(l => 
        l.newStatus === RecordStatus.REJECTED || 
        l.newStatus === RecordStatus.WITHDRAWN || 
        l.note?.includes('Trả hủy') || 
        l.note?.includes('rút hồ sơ') || 
        l.note?.includes('Miễn thu phí') ||
        l.note?.includes('Thủ tục 2.3')
    ))
  );
  
  const isArchiveView = [
    "archive_records",
    "archive_assign_tasks",
    "archive_completed_list",
    "archive_pending_check_list",
    "archive_check_list",
    "archive_handover_list",
    "archive_director_completed",
  ].includes(currentView || "");

  const isMeasurementView = [
    "all_records",
    "assign_tasks",
    "completed_list",
    "pending_check_list",
    "check_list",
    "handover_list",
    "director_completed",
  ].includes(currentView || "");

  // Tất cả các thủ tục / loại hồ sơ khi nhập mới hoặc cập nhật
  let allowedRecordTypes: string[] = EXTENDED_RECORD_TYPES;

  const groupedEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return {};
    return groupEmployeesByDepartment(employees);
  }, [employees]);

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            const dataToSet = { ...initialData };
            const rLower = String(dataToSet.recordType || '').toLowerCase();
            if ((rLower.includes('1.2') || rLower.includes('công văn') || rLower.includes('cong van') || rLower.includes('sao lục') || dataToSet.recordType === '1.1 Sao lục' || dataToSet.recordType === '1.1 CC DL ĐĐ' || dataToSet.recordType === '1.1 Sao lục hồ sơ' || dataToSet.recordType === '1.1 Cung cấp dữ liệu đất đai') && !dataToSet.price) {
                dataToSet.price = 310000;
            }
            setFormData(dataToSet);
            setAttachedDocs(parseAttachedDocs(initialData.otherDocs));
            const parsed = parseAuthDocType(initialData.authDocType);
            setAuthCccd(parsed.cccd);
            setAuthAddress(parsed.address);
            setIsAuthOpen(!!(initialData.authorizedBy || parsed.cccd || parsed.address));

            // Tự động đồng bộ số tiền (returnedPrice) nếu chưa có giống như màn hình Chi tiết và Trả kết quả
            const determinePrice = async () => {
                if (isProcedure2_3(dataToSet.recordType)) {
                    setFormData(prev => ({ ...prev, returnedPrice: 0, price: 0 }));
                    return;
                }
                if (dataToSet.returnedPrice !== undefined && dataToSet.returnedPrice !== null) {
                    return;
                }
                
                // 1. Kiểm tra price lưu sẵn
                if (dataToSet.price && dataToSet.price > 0) {
                    setFormData(prev => ({ ...prev, returnedPrice: dataToSet.price }));
                    return;
                }

                // 2. Cung cấp tài liệu đất đai hoặc 1.2 Công văn
                if (rLower.includes('cung cấp tài liệu') || rLower.includes('cung cấp tldđ') || rLower.includes('cung cấp tlđđ') || rLower.includes('1.2') || rLower.includes('công văn') || rLower.includes('cong van')) {
                    setFormData(prev => ({ ...prev, returnedPrice: 310000 }));
                    return;
                }

                // 3. Tra cứu hợp đồng giống DetailModal
                try {
                    const fetchedContracts = await fetchContracts();
                    const match = fetchedContracts.find(c => {
                        if (!c) return false;
                        const cAddr = (c.customerAddress || '').trim().toLowerCase();
                        const cCode = (c.code || '').trim().toLowerCase();
                        const rCode = (dataToSet.code || '').trim().toLowerCase();
                        const cName = (c.customerName || '').trim().toLowerCase();
                        const rName = (dataToSet.customerName || '').trim().toLowerCase();
                        const cPlot = (c.landPlot || '').trim().toLowerCase();
                        const rPlot = (dataToSet.landPlot || '').trim().toLowerCase();
                        const cMap = (c.mapSheet || '').trim().toLowerCase();
                        const rMap = (dataToSet.mapSheet || '').trim().toLowerCase();

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
                        const priceVal = match.liquidationAmount !== null && match.liquidationAmount !== undefined
                            ? match.liquidationAmount
                            : (match.totalAmount ?? 0);
                        setFormData(prev => ({ ...prev, returnedPrice: priceVal }));
                        return;
                    }
                } catch (err) {
                    console.error("Error loading contract price in RecordModal:", err);
                }

                // 4. Trích lục bản đồ địa chính
                if (rLower.includes('trích lục')) {
                    setFormData(prev => ({ ...prev, returnedPrice: 53163 }));
                    return;
                }
            };
            determinePrice();
        } else {
            setFormData({
              ...defaultState,
              recordType: '',
              receivedDate: new Date().toISOString(),
              deadline: '',
              price: undefined,
              status: RecordStatus.RECEIVED,
              code: generateHQCode(new Date().toISOString(), records),
              receivedBy: currentUser?.employeeId || ''
            });
            setAttachedDocs([]);
            setAuthCccd('');
            setAuthAddress('');
            setIsAuthOpen(false);
        }
    }
  }, [initialData, isOpen, currentView]);

  const handleAddDoc = () => {
      const nextNum = attachedDocs.length + 1;
      const newDoc: AttachedDocItem = {
          id: String(nextNum),
          name: '',
          type: 'Bản chính'
      };
      const updatedDocs = [...attachedDocs, newDoc];
      setAttachedDocs(updatedDocs);
      setFormData(prev => ({ ...prev, otherDocs: JSON.stringify(updatedDocs) }));
  };

  const handleUpdateDoc = (index: number, field: keyof AttachedDocItem, value: string) => {
      const updatedDocs = attachedDocs.map((doc, idx) => {
          if (idx === index) {
              return { ...doc, [field]: value };
          }
          return doc;
      });
      setAttachedDocs(updatedDocs);
      setFormData(prev => ({ ...prev, otherDocs: JSON.stringify(updatedDocs) }));
  };

  const handleDeleteDoc = (index: number) => {
      const filteredDocs = attachedDocs.filter((_, idx) => idx !== index);
      const updatedDocs = filteredDocs.map((doc, idx) => ({
          ...doc,
          id: String(idx + 1)
      }));
      setAttachedDocs(updatedDocs);
      setFormData(prev => ({ ...prev, otherDocs: JSON.stringify(updatedDocs) }));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.recordType || !formData.recordType.trim()) {
      alert("Vui lòng chọn loại hồ sơ / thủ tục trước khi lưu!");
      return;
    }
    const finalData = { ...formData };
    if (!finalData.receivedBy && currentUser?.employeeId) {
        finalData.receivedBy = currentUser.employeeId;
    }
    
    // Logic tự động set ngày khi trạng thái thay đổi hoặc xóa ngày khi quay lui
    // Chỉ áp dụng logic này nếu trạng thái khác với ban đầu (hoặc là tạo mới)
    // Hoặc user admin ép kiểu
    if (hasAdminRights && finalData.status) {
        const now = new Date().toISOString();
        
        // BACKFILL LOGIC: Nếu thay đổi trạng thái, đảm bảo các ngày của tiến trình trước đó (hoặc trạng thái cũ) 
        // được chốt lại để không bị mất màu trên Timeline do thiếu Date.
        if (initialData?.status && finalData.status !== initialData?.status) {
            const flow = [
                RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, 
                RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, 
                RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER
            ];
            const prevIdx = flow.indexOf(initialData.status);
            const newIdx = flow.indexOf(finalData.status);

            if (newIdx >= 0 && prevIdx >= 0 && newIdx < prevIdx) {
                // Quay lùi bước -> Làm sạch mốc thời gian cũ của các bước sau
                if (newIdx < flow.indexOf(RecordStatus.ASSIGNED)) finalData.assignedDate = undefined;
                if (newIdx < flow.indexOf(RecordStatus.COMPLETED_WORK)) finalData.completedWorkDate = undefined;
                if (newIdx < flow.indexOf(RecordStatus.PENDING_CHECK)) finalData.pendingCheckDate = undefined;
                if (newIdx < flow.indexOf(RecordStatus.CHECKED)) finalData.checkedDate = undefined;
                if (newIdx < flow.indexOf(RecordStatus.PENDING_SIGN)) finalData.submissionDate = undefined;
                if (newIdx < flow.indexOf(RecordStatus.SIGNED)) finalData.approvalDate = undefined;
                if (newIdx < flow.indexOf(RecordStatus.HANDOVER)) {
                    finalData.completedDate = undefined;
                    finalData.exportBatch = undefined;
                    finalData.exportDate = undefined;
                }
            } else if (newIdx >= 0 && prevIdx >= 0 && newIdx > prevIdx) {
                // Tiến tới bước mới -> Auto fill nếu thiếu
                if (newIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !finalData.assignedDate) finalData.assignedDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !finalData.completedWorkDate) finalData.completedWorkDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !finalData.pendingCheckDate) finalData.pendingCheckDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.CHECKED) && !finalData.checkedDate) finalData.checkedDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !finalData.submissionDate) finalData.submissionDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.SIGNED) && !finalData.approvalDate) finalData.approvalDate = now;
            }
        }

        // Logic làm sạch dữ liệu cũ khi quay lui trạng thái
        // 1. Nếu quay về RECEIVED (Tiếp nhận) -> Xóa hết các bước sau
        if (finalData.status === RecordStatus.RECEIVED) {
            finalData.assignedDate = undefined;
            finalData.completedWorkDate = undefined;
            finalData.pendingCheckDate = undefined;
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
            finalData.exportBatch = undefined;
            finalData.exportDate = undefined;
        } 
        // 2. Nếu quay về ASSIGNED (Đang thực hiện) -> Xóa bước quá trình sau
        else if (finalData.status === RecordStatus.ASSIGNED || finalData.status === RecordStatus.IN_PROGRESS) {
            finalData.completedWorkDate = undefined;
            finalData.pendingCheckDate = undefined;
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
            finalData.exportBatch = undefined;
            finalData.exportDate = undefined;
        }
        else if (finalData.status === RecordStatus.COMPLETED_WORK) {
            finalData.pendingCheckDate = undefined;
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
        else if (finalData.status === RecordStatus.PENDING_CHECK) {
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
        else if (finalData.status === RecordStatus.CHECKED) {
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
        // 3. Nếu quay về PENDING_SIGN (Chờ ký) -> Xóa bước Xong, Trả
        else if (finalData.status === RecordStatus.PENDING_SIGN) {
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
        // 4. Nếu quay về SIGNED (Đã ký) -> Xóa bước Hoàn thành/Trả
        else if (finalData.status === RecordStatus.SIGNED) {
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
    }

    if (finalData.status === RecordStatus.WITHDRAWN && !finalData.completedDate) finalData.completedDate = new Date().toISOString();
    if (finalData.status === RecordStatus.REJECTED && !finalData.completedDate) finalData.completedDate = new Date().toISOString();
    
    if (finalData.resultReturnedDate && finalData.status !== RecordStatus.RETURNED) {
        finalData.status = RecordStatus.RETURNED;
        if (!finalData.completedDate) finalData.completedDate = finalData.resultReturnedDate;
    }
    
    if (finalData.exportBatch !== undefined && finalData.exportBatch !== null) {
        finalData.exportBatch = getPureBatchNumber(finalData.exportBatch) || undefined;
    }

    // LOGIC QUAN TRỌNG: Nếu có Đợt xuất hoặc Ngày xuất thì phải là HANDOVER (trừ khi Đã rút, Đã trả hoặc Bị từ chối)
    if ((finalData.exportBatch || finalData.exportDate) && finalData.status !== RecordStatus.WITHDRAWN && finalData.status !== RecordStatus.RETURNED && finalData.status !== RecordStatus.REJECTED) {
        finalData.status = RecordStatus.HANDOVER;
        if (!finalData.completedDate) {
            finalData.completedDate = finalData.exportDate ? finalData.exportDate : new Date().toISOString();
        }
    }

    if (isExemptReceipt) {
        finalData.receiptNumber = '';
        finalData.returnedPrice = 0;
    }

    // Áp dụng đồng bộ trạng thái trung tâm
    const targetStatus = finalData.status || RecordStatus.RECEIVED;
    const syncedUpdates = syncRecordStatusTransition(initialData || {}, targetStatus, {
        userName: currentUser.name || currentUser.username || 'Hệ thống',
        userId: currentUser.id,
        customDates: {
            receivedDate: finalData.receivedDate,
            assignedDate: finalData.assignedDate,
            completedWorkDate: finalData.completedWorkDate,
            pendingCheckDate: finalData.pendingCheckDate,
            checkedDate: finalData.checkedDate,
            submissionDate: finalData.submissionDate,
            approvalDate: finalData.approvalDate,
            completedDate: finalData.completedDate,
            exportDate: finalData.exportDate,
            resultReturnedDate: finalData.resultReturnedDate
        },
        exportBatch: finalData.exportBatch,
        exportDate: finalData.exportDate,
        resultReturnedDate: finalData.resultReturnedDate,
        receiverName: finalData.receiverName,
        receiptNumber: finalData.receiptNumber,
        returnedPrice: finalData.returnedPrice
    });

    const cleanData = JSON.parse(JSON.stringify({ ...finalData, ...syncedUpdates }));

    onSubmit(cleanData as any);
    onClose();
  };

  const handleChange = (field: keyof RecordFile, value: any) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value };
      
      if (field === 'status') {
        const newStatus = value as RecordStatus;
        const synced = syncRecordStatusTransition(prev, newStatus, {
          userName: currentUser.name || currentUser.username || 'Hệ thống',
          userId: currentUser.id
        });
        updated = { ...updated, ...synced };
      }

      if (field === 'assignedTo') {
        if (value) {
          const emp = employees.find(e => e.id === value || e.name === value);
          const firstWard = emp?.managedWards?.[0];
          if (firstWard && !prev.ward) {
            updated.ward = firstWard;
          }
          if (!updated.assignedDate) {
            updated.assignedDate = new Date().toISOString().split('T')[0];
          }
        }
      }
      if (updated.ward) {
        const norm = getNormalizedWard(updated.ward);
        if (GROUPS.includes(norm)) {
          updated.group = norm;
        }
      }
      if (field === 'recordType' || field === 'receivedDate') {
        const rType = field === 'recordType' ? value : prev.recordType;
        const rDate = field === 'receivedDate' ? value : prev.receivedDate;
        if (rType && rDate) {
          updated.deadline = calculateDeadlineHelper(rType, String(rDate).split('T')[0], holidays || []);
        } else if (!rType) {
          updated.deadline = '';
          updated.price = undefined;
          updated.returnedPrice = undefined;
        }
        if (field === 'recordType') {
          if (!value) {
            updated.price = undefined;
            updated.returnedPrice = undefined;
          } else if (isProcedure2_3(value)) {
            updated.price = 0;
            updated.returnedPrice = 0;
          } else {
            const rLower = String(value || '').toLowerCase();
            if (rLower.includes('1.2') || rLower.includes('công văn') || rLower.includes('cong van') || rLower.includes('sao lục') || value === '1.1 Sao lục' || value === '1.1 CC DL ĐĐ' || value === '1.1 Sao lục hồ sơ' || value === '1.1 Cung cấp dữ liệu đất đai') {
              updated.price = 310000;
            }
          }
        }
      }
      return updated;
    });
  };
  const val = (v: any) => v === undefined || v === null ? '' : v;
  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const isArchive = isArchiveRecordType(formData.recordType || '') || (getDepartmentForRecord(formData as RecordFile).toLowerCase().includes('lưu trữ'));
  const isCongVan = formData.recordType ? getShortRecordType(formData.recordType) === '1.2 Công văn' : false;
  const recTypeLower = (formData.recordType || '').toLowerCase();
  const showMsr = !isArchive && (recTypeLower.includes('trích đo') || recTypeLower.includes('đo đạc') || recTypeLower.includes('đo') || recTypeLower.includes('tách thửa') || (!recTypeLower.includes('trích đo') && !recTypeLower.includes('trích lục')));
  const showExc = !isArchive && (recTypeLower.includes('trích lục') || (!recTypeLower.includes('trích đo') && !recTypeLower.includes('trích lục')));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-0 md:p-4 backdrop-blur-sm">
      <div className="bg-white md:rounded-xl shadow-2xl w-full max-w-4xl h-full md:max-h-[95vh] flex flex-col animate-fade-in-up">
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 md:p-5 border-b bg-gray-50 rounded-t-none md:rounded-t-xl shrink-0">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 truncate pr-2">
            {initialData ? 'Cập nhật thông tin hồ sơ' : 'Tiếp nhận hồ sơ mới'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-gray-200">
            <X size={24} />
          </button>
        </div>
        
        {/* BODY - SCROLLABLE */}
        <div className="overflow-y-auto p-4 md:p-6 flex-1 bg-gray-100">
            <form id="record-form" onSubmit={handleSubmit} className="space-y-6">
                {/* 1. THÔNG TIN CHUNG */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2"><Calendar size={16} /> Thông tin chung</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Mã hồ sơ <span className="text-red-500">*</span></label>
                            <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-bold text-blue-700" value={val(formData.code)} onChange={(e) => handleChange('code', e.target.value)} />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                Loại hồ sơ <span className="text-red-500">*</span>
                            </label>
                            <select 
                                required
                                className={`w-full border rounded-md px-3 py-2 bg-white ${!formData.recordType ? 'border-amber-400 bg-amber-50/40 text-amber-900 font-semibold ring-1 ring-amber-300' : 'border-gray-300'}`} 
                                value={formData.recordType ? getShortRecordType(formData.recordType) : ''} 
                                onChange={(e) => handleChange('recordType', e.target.value)}
                            >
                                <option value="">-- Chọn loại hồ sơ / thủ tục --</option>
                                {allowedRecordTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            {!formData.recordType && (
                                <p className="text-[11px] text-amber-600 mt-1 font-medium">* Bắt buộc chọn loại hồ sơ để kích hoạt chức năng lưu</p>
                            )}
                        </div>
                        {hasAdminRights ? (
                            <>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái</label><select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-yellow-50 font-medium" value={val(formData.status)} onChange={(e) => handleChange('status', e.target.value)}>{SELECTABLE_STATUSES.filter(item => !isArchive || (item.key !== RecordStatus.PENDING_CHECK && item.key !== RecordStatus.CHECKED)).map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày nhận</label><input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value)} /></div>
                                {!isCongVan && (
                                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Hẹn trả <span className="text-red-500">*</span></label><input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-semibold text-red-600 bg-red-50" value={dateVal(formData.deadline)} onChange={(e) => handleChange('deadline', e.target.value)} /></div>
                                )}
                                {(() => {
                                    const statusFlow = [
                                        RecordStatus.RECEIVED,
                                        RecordStatus.ASSIGNED,
                                        RecordStatus.IN_PROGRESS,
                                        RecordStatus.COMPLETED_WORK,
                                        RecordStatus.PENDING_CHECK,
                                        RecordStatus.CHECKED,
                                        RecordStatus.PENDING_SIGN,
                                        RecordStatus.SIGNED,
                                        RecordStatus.HANDOVER,
                                        RecordStatus.RETURNED
                                    ];
                                    const currentIdx = formData.status ? statusFlow.indexOf(formData.status) : -1;
                                    const hasAssigned = isEdit || currentIdx >= statusFlow.indexOf(RecordStatus.ASSIGNED) || !!formData.assignedDate || !!formData.assignedTo;
                                    const hasPendingCheck = !isArchive && (currentIdx >= statusFlow.indexOf(RecordStatus.PENDING_CHECK) || !!formData.pendingCheckDate);
                                    const hasSubmission = currentIdx >= statusFlow.indexOf(RecordStatus.PENDING_SIGN) || !!formData.submissionDate;
                                    const hasHandover = currentIdx >= statusFlow.indexOf(RecordStatus.SIGNED) || formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.RETURNED || !!formData.completedDate;

                                    return (
                                        <>
                                            {hasAssigned && (
                                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày giao NV</label><input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.assignedDate)} onChange={(e) => handleChange('assignedDate', e.target.value)} /></div>
                                            )}
                                            {hasPendingCheck && (
                                                <div><label className="block text-xs font-bold text-blue-700 mb-1">Ngày trình kiểm tra</label><input type="date" className="w-full border border-blue-300 rounded-md px-3 py-2 bg-blue-50/50 text-blue-800" value={dateVal(formData.pendingCheckDate)} onChange={(e) => handleChange('pendingCheckDate', e.target.value)} /></div>
                                            )}
                                            {hasSubmission && (
                                                <div><label className="block text-xs font-bold text-purple-700 mb-1">Ngày trình ký</label><input type="date" className="w-full border border-purple-300 rounded-md px-3 py-2 bg-purple-50/50 text-purple-800" value={dateVal(formData.submissionDate)} onChange={(e) => handleChange('submissionDate', e.target.value)} /></div>
                                            )}
                                            {hasHandover && (
                                                <div><label className="block text-xs font-bold text-green-700 mb-1">Ngày hoàn thành (Giao 1 cửa)</label><input type="date" className="w-full border border-green-300 rounded-md px-3 py-2 bg-green-50/50 font-semibold text-green-800" value={dateVal(formData.completedDate)} onChange={(e) => handleChange('completedDate', e.target.value)} /></div>
                                            )}
                                        </>
                                    );
                                })()}
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Trạng thái</label>
                                    <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700">
                                        {SELECTABLE_STATUSES.find(s => s.key === formData.status)?.label || formData.status || 'Chưa xác định'}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Ngày nhận</label>
                                    <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700">
                                        {formData.receivedDate ? formatDate(formData.receivedDate) : '--'}
                                    </div>
                                </div>
                                {!isCongVan && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Hẹn trả</label>
                                        <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-sm font-semibold text-red-600">
                                            {formData.deadline ? formatDate(formData.deadline) : '--'}
                                        </div>
                                    </div>
                                )}
                                {formData.assignedDate && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Ngày giao NV</label>
                                        <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700">
                                            {formatDate(formData.assignedDate)}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* 2. CHỦ SỬ DỤNG HOẶC THÔNG TIN GỬI NHẬN */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                        <UserIcon size={16} /> {isCongVan ? 'Thông tin gửi / nhận' : 'Chủ sử dụng'}
                    </h3>
                    {isCongVan ? (
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Số, ký hiệu Công văn <span className="text-red-500">*</span></label>
                                <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-medium" value={val(formData.customerName)} onChange={(e) => handleChange('customerName', e.target.value)} placeholder="VD: 123/UBND-TH..." />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Tên chủ sử dụng <span className="text-red-500">*</span></label><input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-medium" value={val(formData.customerName)} onChange={(e) => handleChange('customerName', e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Số điện thoại</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.phoneNumber)} onChange={(e) => handleChange('phoneNumber', e.target.value)} /></div>
                            <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Địa chỉ chủ sử dụng</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.customerAddress)} onChange={(e) => handleChange('customerAddress', e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">CCCD</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.cccd)} onChange={(e) => handleChange('cccd', e.target.value)} /></div>
                        </div>
                    )}
                </div>

                {/* 3. Vị Trí & Thửa Đất HOẶC VĂN BẢN CÔNG VĂN */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                        <MapPin size={16} /> {isCongVan ? 'Văn bản Công văn' : 'Vị trí & Thửa đất'}
                    </h3>
                    {isCongVan ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Cơ quan ban hành / Nơi gửi</label>
                                <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.issueNumber)} onChange={(e) => handleChange('issueNumber', e.target.value)} placeholder="VD: UBND huyện, Tòa án..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Ngày Công văn</label>
                                <input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Xã / Phường liên quan</label>
                                <select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" value={val(formData.ward)} onChange={(e) => handleChange('ward', e.target.value)}>
                                    <option value="">-- Chọn Xã/Phường --</option>
                                    {wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-700 mb-1">Xã / Phường</label>
                                <select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" value={val(formData.ward)} onChange={(e) => handleChange('ward', e.target.value)}>
                                    <option value="">-- Chọn Xã/Phường --</option>
                                    {wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Tờ bản đồ</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.mapSheet)} onChange={(e) => handleChange('mapSheet', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Thửa đất</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.landPlot)} onChange={(e) => handleChange('landPlot', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Diện tích (m2)</label><input type="number" className="w-full border border-gray-300 rounded-md px-3 py-2 text-right" value={formData.area || 0} onChange={(e) => handleChange('area', parseFloat(e.target.value))} /></div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Số phát hành</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="VD: CD 123456" value={val(formData.issueNumber)} onChange={(e) => handleChange('issueNumber', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Số vào sổ</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="VD: CH 01234" value={val(formData.entryNumber)} onChange={(e) => handleChange('entryNumber', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày cấp</label><input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value)} /></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. NỘI DUNG & KỸ THUẬT */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                        <FileText size={16} /> {isCongVan ? 'Nội dung Công văn & Xử lý' : 'Nội dung & Kỹ thuật'}
                    </h3>
                    <div className="space-y-4">
                        <div className="flex flex-col gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">{isCongVan ? 'Trích yếu nội dung công văn' : 'Nội dung yêu cầu'}</label>
                                <AutoResizeTextarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" value={val(formData.content)} onChange={(e) => handleChange('content', e.target.value)} placeholder={isCongVan ? 'Nhập trích yếu nội dung công văn...' : ''} />
                            </div>
                            
                            {/* Dynamic Attached Documents List */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-bold text-gray-700">{isCongVan ? 'Giấy tờ, văn bản kèm theo' : 'Giấy tờ kèm theo'}</label>
                                    <button
                                        type="button"
                                        onClick={handleAddDoc}
                                        className="text-[11px] bg-blue-50 text-blue-600 px-2.5 py-1 rounded border border-blue-200 hover:bg-blue-100 font-bold transition-all"
                                    >
                                        + THÊM GIẤY TỜ
                                    </button>
                                </div>
                                
                                {attachedDocs.length === 0 ? (
                                    <div className="text-center py-5 text-xs text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                        Không có giấy tờ kèm theo. Bấm nút Thêm giấy tờ để thêm.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                                        <table className="w-full text-left border-collapse bg-white">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                                    <th className="py-2 px-2 text-center w-8">#</th>
                                                    <th className="py-2 px-2">Tên giấy tờ</th>
                                                    <th className="py-2 px-2 w-32 text-center">Hình thức</th>
                                                    <th className="py-2 px-2 w-8 text-center">Xóa</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs">
                                                {attachedDocs.map((doc, idx) => (
                                                    <tr key={doc.id} className="hover:bg-slate-50/50">
                                                        <td className="py-1 px-2 text-center font-bold text-slate-400">{idx + 1}</td>
                                                        <td className="py-1 px-2">
                                                            <input
                                                                type="text"
                                                                required
                                                                className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded outline-none focus:border-blue-500"
                                                                placeholder="Nhập tên..."
                                                                value={doc.name}
                                                                onChange={(e) => handleUpdateDoc(idx, 'name', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="py-1 px-2">
                                                            <div className="flex items-center justify-center gap-2 text-[10px]">
                                                                <label className="flex items-center gap-0.5 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        name={`modal-docType-${doc.id}`}
                                                                        value="Bản chính"
                                                                        checked={doc.type === 'Bản chính'}
                                                                        onChange={() => handleUpdateDoc(idx, 'type', 'Bản chính')}
                                                                    />
                                                                    Chính
                                                                </label>
                                                                <label className="flex items-center gap-0.5 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        name={`modal-docType-${doc.id}`}
                                                                        value="Bản sao"
                                                                        checked={doc.type === 'Bản sao'}
                                                                        onChange={() => handleUpdateDoc(idx, 'type', 'Bản sao')}
                                                                    />
                                                                    Sao
                                                                </label>
                                                            </div>
                                                        </td>
                                                        <td className="py-1 px-2 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteDoc(idx)}
                                                                className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN (NẾU CÓ) */}
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                <div 
                                    onClick={() => setIsAuthOpen(!isAuthOpen)}
                                    className="p-4 flex items-center justify-between gap-4 border-b border-gray-100 bg-gray-50/50 cursor-pointer hover:bg-gray-100/80 select-none"
                                >
                                    <h3 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-2">
                                        <UserIcon size={14} className="text-indigo-600" />
                                        Thông tin người được ủy quyền (nếu có)
                                    </h3>
                                    <button
                                        type="button"
                                        className="flex items-center gap-1 text-[10px] font-bold uppercase rounded border border-gray-300 px-2 py-1 text-gray-600 bg-gray-50 shadow-sm pointer-events-none"
                                    >
                                        {isAuthOpen ? '▲ ẨN NHẬP LIỆU' : '▼ HIỆN NHẬP LIỆU'}
                                    </button>
                                </div>

                                {isAuthOpen && (
                                    <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-100">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Họ và tên</label>
                                            <input
                                                type="text"
                                                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                                placeholder="Họ tên..."
                                                value={formData.authorizedBy || ''}
                                                onChange={(e) => handleChange('authorizedBy', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Số CCCD</label>
                                            <input
                                                type="text"
                                                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                                placeholder="Số CCCD..."
                                                value={authCccd}
                                                onChange={(e) => {
                                                    setAuthCccd(e.target.value);
                                                    setFormData(prev => ({ ...prev, authDocType: `${e.target.value}|${authAddress}` }));
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Địa chỉ</label>
                                            <input
                                                type="text"
                                                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                                placeholder="Địa chỉ..."
                                                value={authAddress}
                                                onChange={(e) => {
                                                    setAuthAddress(e.target.value);
                                                    setFormData(prev => ({ ...prev, authDocType: `${authCccd}|${e.target.value}` }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* NGƯỜI GIAO XỬ LÝ (1 HÀNG ĐẶT DƯỚI THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN) */}
                            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <UserIcon size={14} className="text-indigo-600" />
                                        Người giao xử lý
                                    </span>
                                    {formData.assignedTo && (
                                        <span className="text-[11px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                            Đã phân công
                                        </span>
                                    )}
                                </label>
                                {hasAdminRights ? (
                                    <select
                                        id="record-assignedTo-select"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white text-sm font-medium text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-xs"
                                        value={formData.assignedTo ? (employees.find(e => e.id === formData.assignedTo || e.name === formData.assignedTo)?.id || formData.assignedTo) : ''}
                                        onChange={(e) => handleChange('assignedTo', e.target.value)}
                                    >
                                        <option value="">-- Chưa giao / Chọn cán bộ xử lý --</option>
                                        {Object.entries(groupedEmployees).map(([dept, emps]) => (
                                            <optgroup key={dept} label={dept}>
                                                {emps.map(emp => (
                                                    <option key={emp.id} value={emp.id}>
                                                        {emp.name} ({emp.position || 'Cán bộ'})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-sm font-semibold text-indigo-800">
                                        {(() => {
                                            const emp = employees.find(e => e.id === formData.assignedTo || e.name === formData.assignedTo);
                                            return emp ? `${emp.name} (${emp.position || 'Cán bộ'})` : (formData.assignedTo || 'Chưa phân công');
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>

                         {hasAdminRights && isEdit && (
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                <div className="flex items-center gap-2 mb-1"><Lock size={14} className="text-yellow-600" /><label className="text-xs font-bold text-yellow-800 uppercase">Ghi chú nội bộ</label></div>
                                <AutoResizeTextarea className="w-full border border-yellow-300 rounded-md px-3 py-2 bg-white text-sm" value={val(formData.privateNotes)} onChange={(e) => handleChange('privateNotes', e.target.value)} placeholder="Nhập ghi chú nội bộ..." />
                            </div>
                        )}

                        {/* HIỂN THỊ ĐỢT XUẤT, NGÀY XUẤT VÀ PHI ĐỊA GIỚI */}
                        {hasAdminRights && isEdit && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50/80 p-3.5 rounded-lg border border-indigo-200/80">
                                <div>
                                    <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Đợt xuất (Batch)</label>
                                    <input type="text" className="w-full border border-indigo-200 rounded-md px-2.5 py-1.5 text-sm bg-white font-medium" value={val(getPureBatchNumber(formData.exportBatch))} onChange={(e) => handleChange('exportBatch', getPureBatchNumber(e.target.value))} placeholder="VD: 1, 2, 3..." />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Ngày xuất</label>
                                    <input type="date" className="w-full border border-indigo-200 rounded-md px-2.5 py-1.5 text-sm bg-white" value={val(formData.exportDate ? formData.exportDate.split('T')[0] : '')} onChange={(e) => { const v = e.target.value; if (!v) { handleChange('exportDate', null); return; } const d = new Date(v); if (!isNaN(d.getTime())) { handleChange('exportDate', d.toISOString()); } }} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-purple-900 uppercase mb-1">Phi địa giới</label>
                                    <select 
                                        className="w-full border border-indigo-200 rounded-md px-2.5 py-1.5 text-sm bg-white font-semibold text-purple-900"
                                        value={val(formData.handoverWard)} 
                                        onChange={(e) => handleChange('handoverWard', e.target.value || null)}
                                    >
                                        <option value="">-- Không (Theo địa chỉ thửa đất) --</option>
                                        {wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        {canEditResult && (
                            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                                <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2 mb-3"><FileCheck size={16} /> TRẢ KẾT QUẢ CHO DÂN</h4>
                                {isExemptReceipt ? (
                                    <div className="w-full">
                                        <label className="block text-xs font-bold text-emerald-700 mb-1">Ngày trả kết quả</label>
                                        <input type="date" className="w-full border border-emerald-300 rounded-md px-3 py-2 bg-white font-bold text-emerald-800" value={dateVal(formData.resultReturnedDate)} onChange={(e) => handleChange('resultReturnedDate', e.target.value)} />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-700 mb-1">Ngày trả kết quả</label>
                                            <input type="date" className="w-full border border-emerald-300 rounded-md px-3 py-2 bg-white font-bold text-emerald-800" value={dateVal(formData.resultReturnedDate)} onChange={(e) => handleChange('resultReturnedDate', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-700 mb-1">
                                                {formData.receiptType === 'Biên Lai' ? 'Số Biên lai' : formData.receiptType === 'Hóa Đơn' ? 'Số Hóa đơn' : 'Số Biên lai / Hóa đơn'}
                                            </label>
                                            <input type="text" className="w-full border border-emerald-300 rounded-md px-3 py-2 font-mono bg-white" value={val(formData.receiptNumber)} onChange={(e) => handleChange('receiptNumber', e.target.value)} placeholder="Nhập số biên lai/hóa đơn..." />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-700 mb-1">Số tiền (VNĐ)</label>
                                            <input type="number" className="w-full border border-emerald-300 rounded-md px-3 py-2 font-bold text-emerald-900 bg-white" value={formData.returnedPrice !== undefined && formData.returnedPrice !== null ? formData.returnedPrice : ''} onChange={(e) => handleChange('returnedPrice', parseFloat(e.target.value) || 0)} placeholder="Nhập số tiền..." />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </form>
        </div>

        {/* FOOTER */}
        <div className="p-4 md:p-5 border-t bg-gray-50 flex justify-end gap-3 shrink-0 rounded-b-none md:rounded-b-xl sticky bottom-0 z-10">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 font-medium transition-colors text-sm">Hủy bỏ</button>
            <button 
                type="submit" 
                form="record-form" 
                disabled={!formData.recordType || !formData.recordType.trim()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg shadow-md font-bold transition-all text-sm ${
                    !formData.recordType || !formData.recordType.trim() 
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-70' 
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                }`}
            >
                <Save size={18} /> {initialData ? 'Cập nhật' : 'Lưu hồ sơ'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default RecordModal;
