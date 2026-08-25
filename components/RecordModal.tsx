
import React, { useState, useEffect, useMemo } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole } from '../types';
import { GROUPS, EXTENDED_RECORD_TYPES, STATUS_LABELS, SELECTABLE_STATUSES, getShortRecordType, getWardLabel, getNormalizedWard, isArchiveRecordType, getCanonicalRecordType, detectProcedureId, RECORD_TYPES_LuuTru, RECORD_TYPES_DoDac } from '../constants';
import { X, Save, Lock, User as UserIcon, MapPin, FileText, Calendar, FileCheck, ChevronDown, ChevronUp, XCircle, ClipboardList } from 'lucide-react';
import { calculateDeadlineHelper, getDepartmentForRecord, extractBatchOnly } from '../utils/appHelpers';
import { fetchContracts } from '../services/api';
import { addActivityLog } from '../services/activityLogService';
import { AutoResizeTextarea } from './AutoResizeTextarea';

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
    if (!str) return { cccd: '', address: '', phone: '' };
    const parts = str.split('|');
    const firstPart = parts[0] || '';
    const secondPart = parts[1] || '';
    const thirdPart = parts[2] || '';
    
    // Check if first part is an old document type
    const knownDocTypes = ['Hợp đồng ủy quyền', 'Giấy ủy quyền', 'Văn bản ủy quyền', 'Hợp đồng uỷ quyền', 'Giấy uỷ quyền', 'Văn bản uỷ quyền', 'Khác'];
    const isDocType = knownDocTypes.some(type => firstPart.toLowerCase().includes(type.toLowerCase()));
    
    if (isDocType) {
        if (parts.length >= 4) {
            // Old format: Loại|Hình thức|CCCD|Địa chỉ/SĐT
            return { cccd: parts[2] || '', address: parts[3] || '', phone: parts[4] || '' };
        }
        return { cccd: '', address: '', phone: '' };
    } else {
        // New format: CCCD|Address|Phone
        return {
            cccd: firstPart,
            address: secondPart,
            phone: thirdPart
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
}

const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSubmit, initialData, employees, currentUser, wards, currentView, holidays }) => {
  const defaultState: Partial<RecordFile> = {
    code: '', customerName: '', phoneNumber: '', cccd: '', customerAddress: '', content: '', otherDocs: '',
    receivedDate: new Date().toISOString(), deadline: '', assignedTo: '',
    group: GROUPS[0], ward: '', landPlot: '', mapSheet: '', area: 0, address: '',
    recordType: '', measurementNumber: '', excerptNumber: '',
    issueNumber: '', entryNumber: '', issueDate: '',
    privateNotes: '', authorizedBy: '', authDocType: '', receiptNumber: '', resultReturnedDate: '', explanationPlan: ''
  };

  const [formData, setFormData] = useState<Partial<RecordFile>>(defaultState);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDocItem[]>([]);
  const [authCccd, setAuthCccd] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  const isEdit = !!initialData && !!initialData.id;
  const hasAdminRights = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;
  const isOneDoor = currentUser.role === UserRole.ONEDOOR;
  const canEditResult = (hasAdminRights || isOneDoor) && isEdit;

  const isOtherView = currentView?.startsWith('other_') || currentView === 'other_records';
  
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

  let allowedRecordTypes: string[] = [];
  if (isOtherView) {
    allowedRecordTypes = ['CMD', 'Thi hành án', 'Tòa án'];
  } else if (isArchiveView) {
    allowedRecordTypes = [...RECORD_TYPES_LuuTru];
  } else if (isMeasurementView) {
    allowedRecordTypes = [...RECORD_TYPES_DoDac];
  } else {
    allowedRecordTypes = [
      ...RECORD_TYPES_LuuTru,
      ...RECORD_TYPES_DoDac,
      'CMD',
      'Thi hành án',
      'Tòa án'
    ];
  }

  if (formData.recordType) {
    const currentCanonical = getCanonicalRecordType(formData.recordType, formData.code);
    if (currentCanonical && !allowedRecordTypes.includes(currentCanonical)) {
      allowedRecordTypes = [currentCanonical, ...allowedRecordTypes];
    }
  }

  const filteredEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    
    // Xác định tổ xử lý chuyên môn dựa theo hàm helper trung tâm (đã đồng bộ loại bỏ Tổ Cấp giấy)
    const targetDept = getDepartmentForRecord(formData as RecordFile);
    const targetDeptLower = targetDept.toLowerCase();
    
    const isArchive = targetDeptLower.includes('lưu trữ');
    const isMeasurement = targetDeptLower.includes('đo đạc') || targetDeptLower.includes('kỹ thuật');

    const sameDept = employees.filter(emp => {
      const empDept = (emp.department || '').toLowerCase().trim();
      if (isArchive) return empDept.includes('lưu trữ');
      if (isMeasurement) return empDept.includes('đo đạc') || empDept.includes('kỹ thuật');
      return empDept.includes(targetDeptLower);
    });

    const result = sameDept.length > 0 ? sameDept : employees;

    if (formData.assignedTo && !result.some(e => e.id === formData.assignedTo)) {
      const assignedEmp = employees.find(e => e.id === formData.assignedTo);
      if (assignedEmp) return [assignedEmp, ...result];
    }
    return result;
  }, [employees, formData.recordType, formData.code, formData.assignedTo]);

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            const dataToSet = { ...initialData };
            dataToSet.procedureId = dataToSet.procedureId || detectProcedureId(dataToSet.code, dataToSet.recordType);
            const rLower = String(dataToSet.recordType || '').toLowerCase();
            if (dataToSet.exportBatch) {
                dataToSet.exportBatch = extractBatchOnly(dataToSet.exportBatch);
            }
            setFormData(dataToSet);
            setAttachedDocs(parseAttachedDocs(initialData.otherDocs));
            const parsed = parseAuthDocType(initialData.authDocType);
            setAuthCccd(parsed.cccd || initialData.authorizedPersonId || '');
            setAuthAddress(parsed.address || initialData.authorizedPersonAddress || '');
            setAuthPhone(parsed.phone || initialData.authorizedPersonPhone || '');
            setIsAuthOpen(!!(initialData.authorizedBy || initialData.authorizedPersonName || parsed.cccd || parsed.address || parsed.phone || initialData.authorizedPersonId || initialData.authorizedPersonPhone));

            // Tự động đồng bộ số tiền (returnedPrice) nếu chưa có giống như màn hình Chi tiết và Trả kết quả
            const determinePrice = async () => {
                if (dataToSet.returnedPrice !== undefined && dataToSet.returnedPrice !== null) {
                    return;
                }
                
                // 1. Kiểm tra price lưu sẵn
                if (dataToSet.price && dataToSet.price > 0) {
                    setFormData(prev => ({ ...prev, returnedPrice: dataToSet.price }));
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
            };
            determinePrice();
        } else {
            const recDate = new Date().toISOString();

            setFormData({
              ...defaultState,
              recordType: '',
              receivedDate: recDate,
              deadline: '',
              price: undefined,
              code: `HS-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`
            });
            setAttachedDocs([]);
            setAuthCccd('');
            setAuthAddress('');
            setAuthPhone('');
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
    const finalData = { ...formData };
    
    if (!finalData.recordType) {
        alert("Vui lòng chọn Loại hồ sơ trước khi lưu.");
        return;
    }

    if (!finalData.ward || !finalData.ward.trim()) {
        alert("Vui lòng chọn Xã / Phường trước khi lưu.");
        return;
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
            // Tạm dùng initialData.status để lấp ngày (để đóng băng tiến độ cũ)
            const prevIdx = flow.indexOf(initialData.status);
            if (prevIdx >= 0) {
                if (prevIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !finalData.assignedDate) finalData.assignedDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !finalData.completedWorkDate) finalData.completedWorkDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !finalData.pendingCheckDate) finalData.pendingCheckDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.CHECKED) && !finalData.checkedDate) finalData.checkedDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !finalData.submissionDate) finalData.submissionDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.SIGNED) && !finalData.approvalDate) finalData.approvalDate = now;
            }
            // Auto fill current forward progress as well if going forward
            const newIdx = flow.indexOf(finalData.status);
            if (newIdx >= 0) {
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
            finalData.exportBatch = undefined;
            finalData.exportDate = undefined;
        }
        else if (finalData.status === RecordStatus.PENDING_CHECK) {
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
            finalData.exportBatch = undefined;
            finalData.exportDate = undefined;
        }
        else if (finalData.status === RecordStatus.CHECKED) {
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
            finalData.exportBatch = undefined;
            finalData.exportDate = undefined;
        }
        // 3. Nếu quay về PENDING_SIGN (Chờ ký) -> Xóa bước Xong, Trả
        else if (finalData.status === RecordStatus.PENDING_SIGN) {
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
            finalData.exportBatch = undefined;
            finalData.exportDate = undefined;
        }
        // 4. Nếu quay về SIGNED (Đã ký) -> Xóa bước Hoàn thành/Trả
        else if (finalData.status === RecordStatus.SIGNED) {
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
            finalData.exportBatch = undefined;
            finalData.exportDate = undefined;
        }
    }

    if (finalData.status === RecordStatus.WITHDRAWN && !finalData.completedDate) finalData.completedDate = new Date().toISOString();
    if (finalData.status === RecordStatus.REJECTED && !finalData.completedDate) finalData.completedDate = new Date().toISOString();
    
    // Nếu người dùng chọn trạng thái khác RETURNED, xóa bỏ ngày trả kết quả và thông tin liên quan
    if (finalData.status !== RecordStatus.RETURNED) {
        finalData.resultReturnedDate = undefined;
        finalData.receiptNumber = undefined;
        finalData.receiverName = undefined;
        finalData.returnedPrice = undefined;
    } else {
        if (!finalData.completedDate && finalData.resultReturnedDate) {
            finalData.completedDate = finalData.resultReturnedDate;
        }
        if (formData.returnedPrice !== undefined && formData.returnedPrice !== null && !isNaN(Number(formData.returnedPrice))) {
            finalData.returnedPrice = Number(formData.returnedPrice);
            finalData.price = Number(formData.returnedPrice);
        } else if (formData.price !== undefined && formData.price !== null && !isNaN(Number(formData.price))) {
            finalData.returnedPrice = Number(formData.price);
            finalData.price = Number(formData.price);
        }
    }
    
    // Nếu trạng thái là HANDOVER (Đã giao 1 cửa), bổ sung completedDate nếu chưa có
    if (finalData.status === RecordStatus.HANDOVER) {
        if (!finalData.completedDate) {
            finalData.completedDate = finalData.exportDate ? finalData.exportDate : new Date().toISOString();
        }
    } else if (finalData.status !== RecordStatus.WITHDRAWN && finalData.status !== RecordStatus.RETURNED && finalData.status !== RecordStatus.REJECTED) {
        // Nếu người dùng chọn trạng thái khác (Đã ký, Chờ ký, Đã kiểm tra...), tôn trọng trạng thái đã chọn
        // Nếu trước đó là HANDOVER hoặc người dùng xóa thông tin xuất, làm sạch exportBatch và exportDate
        if (!formData.exportBatch && !formData.exportDate) {
            finalData.exportBatch = undefined;
            finalData.exportDate = undefined;
        }
    }

    if (finalData.exportBatch) {
        finalData.exportBatch = extractBatchOnly(finalData.exportBatch);
    }

    finalData.authorizedPersonName = formData.authorizedBy || formData.authorizedPersonName || undefined;
    finalData.authorizedPersonId = authCccd || formData.authorizedPersonId || undefined;
    finalData.authorizedPersonPhone = authPhone || formData.authorizedPersonPhone || undefined;
    finalData.authorizedPersonAddress = authAddress || formData.authorizedPersonAddress || undefined;
    finalData.authDocType = `${authCccd}|${authAddress}|${authPhone}`;

    // Tự động ghi Log lịch sử thay đổi trạng thái
    const prevStatus = initialData ? initialData.status : null;
    const newStatus = finalData.status || RecordStatus.RECEIVED;
    if (prevStatus !== newStatus || !initialData) {
        const existingLogs = Array.isArray(initialData?.statusLogs) ? initialData.statusLogs : [];
        const newLog = {
            id: 'LOG_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            recordId: initialData?.id || '',
            previousStatus: prevStatus,
            newStatus: newStatus,
            changedBy: currentUser.name || currentUser.username || 'Hệ thống',
            changedAt: new Date().toISOString(),
            note: initialData ? 'Cập nhật từ biểu mẫu hồ sơ' : 'Tạo mới hồ sơ'
        };
        finalData.statusLogs = [newLog, ...existingLogs];

        addActivityLog({
            performerName: currentUser.name || currentUser.username || 'Hệ thống',
            performerRole: currentUser.role || 'ONEDOOR',
            actionType: initialData ? 'UPDATE' : 'CREATE',
            actionLabel: initialData ? 'Cập nhật' : 'Thêm mới',
            targetType: 'Hồ sơ',
            referenceCode: finalData.code || initialData?.code || '-',
            details: initialData 
                ? `Cập nhật hồ sơ ${finalData.code} - Khách hàng: ${finalData.customerName} (Trạng thái: ${STATUS_LABELS[newStatus] || newStatus})`
                : `Thêm mới hồ sơ ${finalData.code} - Khách hàng: ${finalData.customerName}`,
            recordId: initialData?.id
        });
    }

    // Để đảm bảo gửi null thay vì undefined cho API nếu cần xóa
    const cleanData: any = { ...finalData };
    const nullableFields: (keyof RecordFile)[] = [
        'assignedDate', 'completedWorkDate', 'pendingCheckDate', 'checkedDate',
        'submissionDate', 'approvalDate', 'completedDate', 'resultReturnedDate',
        'exportDate', 'exportBatch', 'handoverWard', 'receiptNumber', 'returnedPrice',
        'advancePayment', 'price', 'issueDate', 'reminderDate', 'archiveHandoverDate'
    ];
    nullableFields.forEach(f => {
        if (cleanData[f] === undefined || cleanData[f] === '') {
            cleanData[f] = null;
        }
    });

    if(finalData.status === RecordStatus.RECEIVED) {
        cleanData.assignedDate = null;
        cleanData.submissionDate = null;
        cleanData.approvalDate = null;
        cleanData.completedDate = null;
        cleanData.resultReturnedDate = null;
        cleanData.exportBatch = null;
        cleanData.exportDate = null;
    } else if (finalData.status === RecordStatus.ASSIGNED) {
        cleanData.submissionDate = null;
        cleanData.approvalDate = null;
        cleanData.completedDate = null;
        cleanData.resultReturnedDate = null;
        cleanData.exportBatch = null;
        cleanData.exportDate = null;
    }

    onSubmit(cleanData as any);
    onClose();
  };

  const handleChange = (field: keyof RecordFile, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (updated.ward) {
        const norm = getNormalizedWard(updated.ward);
        if (GROUPS.includes(norm)) {
          updated.group = norm;
        }
      }
      if (field === 'recordType' || field === 'code' || field === 'receivedDate') {
        const rCode = field === 'code' ? value : prev.code;
        const rType = field === 'recordType' ? value : prev.recordType;
        const rDate = field === 'receivedDate' ? value : prev.receivedDate;
        
        const procId = detectProcedureId(rCode, rType);
        updated.procedureId = procId;

        if (rType && rDate) {
          updated.deadline = calculateDeadlineHelper(rType, String(rDate).split('T')[0], holidays || [], rCode, procId);
        }
      }
      return updated;
    });
  };
  const val = (v: any) => v === undefined || v === null ? '' : v;
  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

  const isArchive = isArchiveRecordType(formData.recordType || '') || (getDepartmentForRecord(formData as RecordFile).toLowerCase().includes('lưu trữ'));
  const isCongVan = formData.recordType ? getShortRecordType(formData.recordType) === '1.2 Công văn' : false;
  const is23Procedure = (formData.recordType || '').toLowerCase().includes('2.3') || (formData.recordType || '').toLowerCase().includes('dđ & cc số thửa') || (formData.recordType || '').toLowerCase().includes('dd & cc so thua');
  const recTypeLower = (formData.recordType || '').toLowerCase();
  const showMsr = !isArchive && !is23Procedure && (recTypeLower.includes('trích đo') || recTypeLower.includes('đo đạc') || recTypeLower.includes('đo') || recTypeLower.includes('tách thửa') || (!recTypeLower.includes('trích đo') && !recTypeLower.includes('trích lục')));
  const showExc = !isArchive && !is23Procedure && (recTypeLower.includes('trích lục') || (!recTypeLower.includes('trích đo') && !recTypeLower.includes('trích lục')));

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 backdrop-blur-xs animate-fade-in">
      <div className="bg-slate-100 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
        {/* HEADER */}
        <div className="px-5 sm:px-6 py-3.5 bg-white text-slate-900 flex justify-between items-center shrink-0 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <ClipboardList size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 tracking-wide uppercase">
                {initialData ? `CẬP NHẬT HỒ SƠ: ${initialData.code}` : `TIẾP NHẬN HỒ SƠ MỚI (${isArchive ? 'LƯU TRỮ' : 'ĐO ĐẠC'})`}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Nhập đầy đủ các thông tin bên dưới để lưu hồ sơ vào hệ thống</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* BODY - SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 sm:space-y-5 bg-slate-50">
            <form id="record-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                {/* 1. THÔNG TIN CHUNG */}
                <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-3 sm:mb-4 flex items-center gap-2 border-b border-slate-100 pb-2.5"><Calendar size={16} className="text-blue-600" /> Thông tin chung</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
                        <div className="md:col-span-1">
                            <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Mã hồ sơ <span className="text-red-500">*</span></label>
                            <input type="text" required className="w-full px-3 py-2 bg-blue-50/20 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono font-bold text-blue-700 focus:border-blue-500 outline-none shadow-2xs transition-all" value={val(formData.code)} onChange={(e) => handleChange('code', e.target.value)} />
                        </div>
                        <div className="md:col-span-3">
                            <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Loại hồ sơ</label>
                            <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-semibold text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={formData.recordType ? getCanonicalRecordType(formData.recordType) : ''} onChange={(e) => handleChange('recordType', e.target.value)}>
                                <option value="">-- Chọn loại hồ sơ --</option>
                                {allowedRecordTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        {hasAdminRights && (
                            <>
                                <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Trạng thái</label><select className="w-full px-3 py-2 bg-amber-50/80 border border-amber-300 rounded-lg text-xs sm:text-sm font-bold text-amber-900 focus:border-amber-500 outline-none shadow-2xs transition-all" value={val(formData.status)} onChange={(e) => handleChange('status', e.target.value)}>{SELECTABLE_STATUSES.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
                                <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Ngày nhận</label><input type="date" required className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={dateVal(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value)} /></div>
                                {!isCongVan && (
                                    <div><label className="text-[11px] sm:text-xs font-bold text-red-600 uppercase mb-1.5 block">Hẹn trả <span className="text-red-500">*</span></label><input type="date" required className="w-full px-3 py-2 bg-pink-50/90 border border-pink-200 rounded-lg text-xs sm:text-sm font-bold text-red-600 focus:border-red-400 outline-none shadow-2xs transition-all" value={dateVal(formData.deadline)} onChange={(e) => handleChange('deadline', e.target.value)} /></div>
                                )}
                                <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Ngày giao NV</label><input type="date" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={dateVal(formData.assignedDate)} onChange={(e) => handleChange('assignedDate', e.target.value)} /></div>
                                
                                {(formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.WITHDRAWN || formData.status === RecordStatus.RETURNED || formData.status === RecordStatus.REJECTED || formData.exportBatch) && (
                                    <div><label className="text-[11px] sm:text-xs font-bold text-emerald-700 uppercase mb-1.5 block">{formData.status === RecordStatus.WITHDRAWN ? 'Ngày rút hồ sơ' : formData.status === RecordStatus.REJECTED ? 'Ngày trả hồ sơ' : 'Ngày hoàn thành'}</label><input type="date" className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-lg text-xs sm:text-sm font-bold text-emerald-800 focus:border-emerald-500 outline-none shadow-2xs transition-all" value={dateVal(formData.completedDate)} onChange={(e) => handleChange('completedDate', e.target.value)} /></div>
                                )}
                                
                                {(formData.status === RecordStatus.PENDING_CHECK || formData.status === RecordStatus.CHECKED || formData.status === RecordStatus.PENDING_SIGN || formData.status === RecordStatus.SIGNED || formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.REJECTED || formData.status === RecordStatus.WITHDRAWN || !!formData.pendingCheckDate) && (
                                    <div><label className="text-[11px] sm:text-xs font-bold text-blue-700 uppercase mb-1.5 block">Ngày trình kiểm tra</label><input type="date" className="w-full px-3 py-2 bg-blue-50 border border-blue-300 rounded-lg text-xs sm:text-sm font-semibold text-blue-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={dateVal(formData.pendingCheckDate)} onChange={(e) => handleChange('pendingCheckDate', e.target.value)} /></div>
                                )}
                                {(formData.status === RecordStatus.PENDING_SIGN || formData.status === RecordStatus.SIGNED || formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.REJECTED || formData.status === RecordStatus.WITHDRAWN || !!formData.submissionDate) && (
                                    <div><label className="text-[11px] sm:text-xs font-bold text-purple-700 uppercase mb-1.5 block">Ngày trình ký</label><input type="date" className="w-full px-3 py-2 bg-purple-50 border border-purple-300 rounded-lg text-xs sm:text-sm font-semibold text-purple-800 focus:border-purple-500 outline-none shadow-2xs transition-all" value={dateVal(formData.submissionDate)} onChange={(e) => handleChange('submissionDate', e.target.value)} /></div>
                                )}
                                {(formData.status === RecordStatus.SIGNED || formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.REJECTED || formData.status === RecordStatus.WITHDRAWN || !!formData.approvalDate) && (
                                    <div><label className="text-[11px] sm:text-xs font-bold text-indigo-700 uppercase mb-1.5 block">Ngày ký duyệt</label><input type="date" className="w-full px-3 py-2 bg-indigo-50 border border-indigo-300 rounded-lg text-xs sm:text-sm font-semibold text-indigo-800 focus:border-indigo-500 outline-none shadow-2xs transition-all" value={dateVal(formData.approvalDate)} onChange={(e) => handleChange('approvalDate', e.target.value)} /></div>
                                )}
                            </>
                        )}
                        {!hasAdminRights && <div className="col-span-full p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 italic text-center">* Ngày tháng và trạng thái chỉ Admin/Subadmin được chỉnh sửa.</div>}
                    </div>
                </div>

                {/* 2. CHỦ SỬ DỤNG HOẶC THÔNG TIN GỬI NHẬN */}
                <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-3 sm:mb-4 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                        <UserIcon size={16} className="text-blue-600" /> {isCongVan ? 'Thông tin gửi / nhận' : 'Thông tin khách hàng'}
                    </h3>
                    {isCongVan ? (
                        <div className="grid grid-cols-1 gap-3.5">
                            <div>
                                <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Số, ký hiệu Công văn <span className="text-red-500">*</span></label>
                                <input type="text" required className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={val(formData.customerName)} onChange={(e) => handleChange('customerName', e.target.value)} placeholder="VD: 123/UBND-TH..." />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                            <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Tên chủ sử dụng <span className="text-red-500">*</span></label><input type="text" required className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={val(formData.customerName)} onChange={(e) => handleChange('customerName', e.target.value)} /></div>
                            <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">CCCD / Số Giấy</label><input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-mono text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={val(formData.cccd)} onChange={(e) => handleChange('cccd', e.target.value)} /></div>
                            <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Số điện thoại</label><input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={val(formData.phoneNumber)} onChange={(e) => handleChange('phoneNumber', e.target.value)} /></div>
                            <div className="md:col-span-3"><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Địa chỉ thường trú / Nơi ở hiện nay</label><input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={val(formData.customerAddress)} onChange={(e) => handleChange('customerAddress', e.target.value)} /></div>
                        </div>
                    )}
                </div>

                {/* 3. Vị Trí & Thửa Đất HOẶC VĂN BẢN CÔNG VĂN */}
                <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-3 sm:mb-4 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                        <MapPin size={16} className="text-blue-600" /> {isCongVan ? 'Văn bản Công văn' : 'Vị trí & Thửa đất'}
                    </h3>
                    {isCongVan ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                            <div>
                                <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Cơ quan ban hành / Nơi gửi</label>
                                <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={val(formData.issueNumber)} onChange={(e) => handleChange('issueNumber', e.target.value)} placeholder="VD: UBND huyện, Tòa án..." />
                            </div>
                            <div>
                                <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Ngày Công văn</label>
                                <input type="date" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Xã / Phường liên quan</label>
                                <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={val(formData.ward)} onChange={(e) => handleChange('ward', e.target.value)}>
                                    <option value="">-- Chọn Xã/Phường --</option>
                                    {wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                                <div>
                                    <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Xã / Phường <span className="text-red-500">*</span></label>
                                    <select className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={val(formData.ward)} onChange={(e) => handleChange('ward', e.target.value)}>
                                        <option value="">-- Chọn Xã/Phường --</option>
                                        {wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}
                                    </select>
                                </div>
                                <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Số phát hành</label><input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" placeholder="VD: CD 123456" value={val(formData.issueNumber)} onChange={(e) => handleChange('issueNumber', e.target.value)} /></div>
                                <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Số vào sổ</label><input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" placeholder="VD: CH 01234" value={val(formData.entryNumber)} onChange={(e) => handleChange('entryNumber', e.target.value)} /></div>
                                <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Ngày cấp</label><input type="date" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value)} /></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                                <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Tờ bản đồ</label><input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-mono text-center text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={val(formData.mapSheet)} onChange={(e) => handleChange('mapSheet', e.target.value)} /></div>
                                <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Thửa đất</label><input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-mono text-center text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={val(formData.landPlot)} onChange={(e) => handleChange('landPlot', e.target.value)} /></div>
                                <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">Tổng diện tích (m²)</label><input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-right text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={formData.area || 0} onChange={(e) => handleChange('area', parseFloat(e.target.value))} /></div>
                                <div><label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">ONT/ODT (m²)</label><input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-right text-slate-800 focus:border-blue-500 outline-none shadow-2xs transition-all" value={formData.residentialArea || 0} onChange={(e) => handleChange('residentialArea', parseFloat(e.target.value))} /></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. NỘI DUNG & KỸ THUẬT */}
                <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-3 sm:mb-4 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                        <FileText size={16} className="text-blue-600" /> {isCongVan ? 'Nội dung Công văn & Xử lý' : 'Nội dung & Kỹ thuật'}
                    </h3>
                    <div className="space-y-4">
                        <div className="flex flex-col gap-5">
                            <div>
                                <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase mb-1.5 block">{isCongVan ? 'Trích yếu nội dung công văn' : 'Nội dung yêu cầu'}</label>
                                <AutoResizeTextarea
                                    minRows={1}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm focus:border-blue-500 outline-none leading-relaxed shadow-2xs transition-all"
                                    value={val(formData.content)}
                                    onChange={(e) => handleChange('content', e.target.value)}
                                    placeholder={isCongVan ? 'Nhập trích yếu nội dung công văn...' : 'Nhập nội dung yêu cầu...'}
                                />
                            </div>
                            
                            {/* Dynamic Attached Documents List */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase block">{isCongVan ? 'Giấy tờ, văn bản kèm theo' : 'Giấy tờ kèm theo'}</label>
                                    <button
                                        type="button"
                                        onClick={handleAddDoc}
                                        className="text-[11px] bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-100 font-bold transition-all cursor-pointer"
                                    >
                                        + THÊM GIẤY TỜ
                                    </button>
                                </div>
                                
                                {attachedDocs.length === 0 ? (
                                    <div className="text-center py-4 text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        Không có giấy tờ kèm theo. Bấm nút Thêm giấy tờ để thêm.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                                        <table className="w-full text-left border-collapse bg-white">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
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
                                                                className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md outline-none focus:border-blue-500"
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
                                                                className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 cursor-pointer"
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
                            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                                <div className="p-3.5 flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50">
                                    <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                                        <UserIcon size={14} className="text-indigo-600" />
                                        Thông tin người được ủy quyền (nếu có)
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsAuthOpen(!isAuthOpen)}
                                        className="flex items-center gap-1 text-[10px] font-bold uppercase rounded-lg border border-slate-200 hover:bg-white transition-all px-2.5 py-1 text-slate-600 bg-white shadow-2xs cursor-pointer"
                                    >
                                        {isAuthOpen ? '▲ ẨN NHẬP LIỆU' : '▼ HIỆN NHẬP LIỆU'}
                                    </button>
                                </div>

                                {isAuthOpen && (
                                    <div className="p-3.5 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 border-t border-slate-100">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">Họ và tên</label>
                                            <input
                                                type="text"
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                                placeholder="Họ tên người UQ..."
                                                value={formData.authorizedBy || ''}
                                                onChange={(e) => {
                                                    handleChange('authorizedBy', e.target.value);
                                                    handleChange('authorizedPersonName', e.target.value);
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">Số điện thoại</label>
                                            <input
                                                type="text"
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                                placeholder="Số điện thoại..."
                                                value={authPhone}
                                                onChange={(e) => {
                                                    setAuthPhone(e.target.value);
                                                    handleChange('authorizedPersonPhone', e.target.value);
                                                    setFormData(prev => ({ ...prev, authDocType: `${authCccd}|${authAddress}|${e.target.value}` }));
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">Số CCCD</label>
                                            <input
                                                type="text"
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                                placeholder="Số CCCD..."
                                                value={authCccd}
                                                onChange={(e) => {
                                                    setAuthCccd(e.target.value);
                                                    handleChange('authorizedPersonId', e.target.value);
                                                    setFormData(prev => ({ ...prev, authDocType: `${e.target.value}|${authAddress}|${authPhone}` }));
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">Địa chỉ thường trú</label>
                                            <input
                                                type="text"
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                                placeholder="Địa chỉ..."
                                                value={authAddress}
                                                onChange={(e) => {
                                                    setAuthAddress(e.target.value);
                                                    handleChange('authorizedPersonAddress', e.target.value);
                                                    setFormData(prev => ({ ...prev, authDocType: `${authCccd}|${e.target.value}|${authPhone}` }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={`grid gap-3.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 ${(!isCongVan && (showMsr || showExc)) ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                            {!isCongVan && (
                                <>
                                    {showMsr && (
                                        <div><label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">Số Trích đo</label><input type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white outline-none focus:border-blue-500" value={val(formData.measurementNumber)} onChange={(e) => handleChange('measurementNumber', e.target.value)} placeholder="Nhập số trích đo..." /></div>
                                    )}
                                    {showExc && (
                                        <div><label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">Số Trích lục</label><input type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white outline-none focus:border-blue-500" value={val(formData.excerptNumber)} onChange={(e) => handleChange('excerptNumber', e.target.value)} placeholder="Nhập số trích lục..." /></div>
                                    )}
                                </>
                            )}
                            <div className="w-full">
                                <label className="text-[11px] font-bold text-slate-600 uppercase mb-1 block">Giao nhân viên xử lý</label>
                                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs sm:text-sm bg-white outline-none focus:border-blue-500 font-medium text-slate-800" value={val(formData.assignedTo)} onChange={(e) => handleChange('assignedTo', e.target.value)}>
                                    <option value="">-- Chưa giao --</option>
                                    {filteredEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>)}
                                </select>
                            </div>
                        </div>

                        {hasAdminRights && isEdit && (
                            <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80">
                                <div className="flex items-center gap-2 mb-1.5"><Lock size={14} className="text-amber-600" /><label className="text-xs font-bold text-amber-800 uppercase">Ghi chú nội bộ</label></div>
                                <AutoResizeTextarea
                                    minRows={1}
                                    className="w-full border border-amber-200 rounded-lg px-3 py-2 bg-white text-xs sm:text-sm leading-relaxed outline-none focus:border-amber-400"
                                    value={val(formData.privateNotes)}
                                    onChange={(e) => handleChange('privateNotes', e.target.value)}
                                    placeholder="Nhập ghi chú nội bộ..."
                                />
                            </div>
                        )}

                        {/* HIỂN THỊ ĐỢT XUẤT, NGÀY XUẤT VÀ PHI ĐỊA GIỚI */}
                        {hasAdminRights && isEdit && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-200/80">
                                <div>
                                    <label className="text-[11px] font-bold text-indigo-900 uppercase mb-1 block">Đợt xuất (Batch)</label>
                                    <input type="text" className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white font-medium outline-none focus:border-indigo-400" value={val(formData.exportBatch ? extractBatchOnly(formData.exportBatch) : '')} onChange={(e) => handleChange('exportBatch', e.target.value)} placeholder="VD: 1, 2, 3..." />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-indigo-900 uppercase mb-1 block">Ngày xuất</label>
                                    <input type="date" className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white outline-none focus:border-indigo-400" value={dateVal(formData.exportDate)} onChange={(e) => handleChange('exportDate', e.target.value ? e.target.value : null)} />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-purple-900 uppercase mb-1 block">Phi địa giới</label>
                                    <select 
                                        className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white font-semibold text-purple-900 outline-none focus:border-indigo-400"
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
                            <div className="bg-emerald-50/60 p-3.5 sm:p-4 rounded-xl border border-emerald-200">
                                <h4 className="text-xs sm:text-sm font-bold text-emerald-800 flex items-center gap-2 mb-3 uppercase"><FileCheck size={16} /> TRẢ KẾT QUẢ CHO DÂN</h4>
                                <div className={`grid grid-cols-1 ${is23Procedure ? 'md:grid-cols-1' : 'md:grid-cols-3'} gap-3.5`}>
                                    <div>
                                        <label className="text-[11px] font-bold text-emerald-800 uppercase mb-1 block">Ngày trả kết quả</label>
                                        <input type="date" className="w-full border border-emerald-300 rounded-lg px-3 py-2 bg-white font-bold text-emerald-800 outline-none text-xs sm:text-sm focus:border-emerald-500" value={dateVal(formData.resultReturnedDate)} onChange={(e) => handleChange('resultReturnedDate', e.target.value)} />
                                    </div>
                                    {!is23Procedure && (
                                        <>
                                            <div>
                                                <label className="text-[11px] font-bold text-emerald-800 uppercase mb-1 block">
                                                    {formData.receiptType === 'Biên Lai' ? 'Số Biên lai' : formData.receiptType === 'Hóa Đơn' ? 'Số Hóa đơn' : 'Số Biên lai / Hóa đơn'}
                                                </label>
                                                <input type="text" className="w-full border border-emerald-300 rounded-lg px-3 py-2 font-mono bg-white text-xs sm:text-sm outline-none focus:border-emerald-500" value={val(formData.receiptNumber)} onChange={(e) => handleChange('receiptNumber', e.target.value)} placeholder="Nhập số biên lai/hóa đơn..." />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-bold text-emerald-800 uppercase mb-1 block">Số tiền (VNĐ)</label>
                                                <input 
                                                    type="number" 
                                                    className="w-full border border-emerald-300 rounded-lg px-3 py-2 font-bold text-emerald-950 bg-white text-xs sm:text-sm outline-none focus:border-emerald-500" 
                                                    value={formData.returnedPrice !== undefined && formData.returnedPrice !== null ? formData.returnedPrice : (formData.price !== undefined && formData.price !== null ? formData.price : '')} 
                                                    onChange={(e) => {
                                                        const parsed = e.target.value === '' ? undefined : (parseFloat(e.target.value) || 0);
                                                        setFormData(prev => ({ ...prev, returnedPrice: parsed, price: parsed }));
                                                    }} 
                                                    placeholder="Nhập số tiền..." 
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </form>
        </div>

        {/* STICKY BOTTOM ACTION BAR */}
        <div className="sticky bottom-0 left-0 right-0 z-20 bg-slate-50/95 backdrop-blur-md border-t border-slate-200 py-2.5 px-4 sm:px-6 flex items-center justify-end gap-2.5 shadow-md rounded-b-2xl shrink-0">
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs text-xs sm:text-sm font-bold border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
                <XCircle size={16} className="text-red-500" /> Hủy bỏ
            </button>
            
            <button
                type="submit"
                form="record-form"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md text-xs sm:text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
                <Save size={16} />
                {initialData ? 'CẬP NHẬT' : 'LƯU HỒ SƠ'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default RecordModal;
