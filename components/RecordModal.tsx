
import React, { useState, useEffect, useMemo } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole } from '../types';
import { GROUPS, EXTENDED_RECORD_TYPES, CAP_GIAY_RECORD_TYPES, STATUS_LABELS, getShortRecordType, getWardLabel, getNormalizedWard, isCapGiayRecord, isTaxDefaultRecordType, getDefaultCapGiaySubStep } from '../constants';
import { X, Save, Lock, User as UserIcon, MapPin, FileText, Calendar, FileCheck, ChevronDown, ChevronUp, History } from 'lucide-react';
import { calculateDeadlineHelper } from '../utils/appHelpers';

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
}

const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSubmit, initialData, employees, currentUser, wards, currentView, holidays }) => {
  const defaultState: Partial<RecordFile> = {
    code: '', customerName: '', phoneNumber: '', cccd: '', customerAddress: '', content: '', otherDocs: '',
    receivedDate: new Date().toISOString(), deadline: '', assignedTo: '',
    group: GROUPS[0], ward: '', landPlot: '', mapSheet: '', area: 0, address: '',
    recordType: EXTENDED_RECORD_TYPES[0], measurementNumber: '', excerptNumber: '',
    privateNotes: '', authorizedBy: '', authDocType: '', receiptNumber: '', resultReturnedDate: '', explanationPlan: '',
    taxTransferDate: '', taxNoticeDate: '', taxPaidDate: '', printedDate: '', checkedBy: ''
  };

  const [formData, setFormData] = useState<Partial<RecordFile>>(defaultState);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDocItem[]>([]);
  const [authCccd, setAuthCccd] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  const hasAdminRights = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN || currentUser.role === UserRole.TEAM_LEADER;
  const isOneDoor = currentUser.role === UserRole.ONEDOOR;
  const canEditResult = hasAdminRights || isOneDoor;

  const isOtherView = currentView?.startsWith('other_') || currentView === 'other_records' || currentView === 'registration_records';

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

  const isProfessionalReceptionTab = [
    'receive_record',
    'dangky_tiep_nhan_giao_viec',
    'assign_tasks',
    'archive_assign_tasks',
    'other_assign_tasks',
    'capgiay_assign_tasks'
  ].includes(currentView || '') || formData.capGiaySubStep === 'tiep_nhan' || (!initialData && [
    'receive_record',
    'dangky_tiep_nhan_giao_viec',
    'assign_tasks',
    'archive_assign_tasks',
    'other_assign_tasks',
    'capgiay_assign_tasks'
  ].includes(currentView || ''));

  const isCapGiayView = [
    "capgiay_records",
    "capgiay_assign_tasks",
    "capgiay_completed_list",
    "capgiay_pending_check_list",
    "capgiay_check_list",
    "capgiay_handover_list",
    "capgiay_director_completed",
  ].includes(currentView || "");

  let allowedRecordTypes: string[] = [];
  if (isOtherView || isCapGiayView || isCapGiayRecord(formData) || isCapGiayRecord(initialData) || currentView === 'dangky_records' || currentView?.startsWith('dangky_')) {
    allowedRecordTypes = CAP_GIAY_RECORD_TYPES;
  } else if (isArchiveView) {
    allowedRecordTypes = [
      '1.1 Sao lục',
      '1.2 Công văn'
    ];
  } else if (isMeasurementView) {
    allowedRecordTypes = [
      '2.1 Trích lục',
      '2.2 Trích đo',
      '2.4 Cắm mốc',
      '2.5 Tách-Hợp thửa',
      '2.3 CC số thửa'
    ];
  } else {
    allowedRecordTypes = EXTENDED_RECORD_TYPES;
  }

  const targetDept = useMemo(() => {
    if (
      isCapGiayRecord(formData) || 
      isCapGiayView || 
      currentView?.startsWith('capgiay_') || 
      formData.group === 'cap_giay' || 
      formData.group === 'Cấp giấy' ||
      (initialData && (isCapGiayRecord(initialData) || initialData.group === 'cap_giay' || initialData.group === 'Cấp giấy'))
    ) {
      return 'Tổ Cấp giấy';
    }

    const rType = String(formData.recordType || '').toLowerCase();
    const rCode = String(formData.code || '').toLowerCase();
    const shortType = getShortRecordType(formData.recordType).toLowerCase();

    // 1. Tổ Lưu trữ / Cung cấp thông tin (nhóm 1.*, công văn, sao lục)
    if (
      rType.includes('1.1') || 
      rType.includes('1.2') || 
      rType.includes('công văn') || 
      rType.includes('sao lục') || 
      rCode.startsWith('1.') ||
      shortType.startsWith('1.')
    ) {
      return 'Tổ Lưu trữ';
    }

    // 2. Tổ Cấp giấy (Chính xác là các thủ tục nhóm 3.*, cấp giấy, GCN, biến động...)
    const isCapGiayGroup = 
      rType.startsWith('3.') || 
      rCode.startsWith('3.') || 
      shortType.startsWith('3.') || 
      rType.includes('3.4.1') ||
      rType.includes('cấp giấy') ||
      rType.includes('gcn') ||
      rType.includes('đăng ký') ||
      rType.includes('cấp đổi') ||
      rType.includes('cấp lại') ||
      rType.includes('biến động');

    if (isCapGiayGroup && !rType.includes('2.5') && !rType.includes('đo đạc') && !rType.includes('trích đo')) {
      return 'Tổ Cấp giấy';
    }

    // 3. Tổ Đo đạc (nhóm 2.*, trích đo, đo đạc, cắm mốc, số thửa, chỉnh lý, tách thửa đo đạc...)
    if (
      rType.startsWith('2.') || 
      rCode.startsWith('2.') || 
      shortType.startsWith('2.') || 
      rType.includes('2.1') || rType.includes('2.2') || rType.includes('2.3') || rType.includes('2.4') || rType.includes('2.5') || rType.includes('2.6') || 
      rType.includes('đo đạc') || 
      rType.includes('trích đo') || 
      rType.includes('cắm mốc') || 
      rType.includes('chỉnh lý') || 
      rType.includes('số thửa') ||
      rType.includes('tách thửa') ||
      rType.includes('tách-hợp thửa')
    ) {
      return 'Tổ Đo đạc';
    }

    return 'Tổ Cấp giấy';
  }, [formData.recordType, formData.code]);

  const filteredEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    
    // X определяем bộ phận theo currentView hoặc recordType
    let targetKey = 'tổ cấp giấy';
    if (isCapGiayRecord(formData) || targetDept === 'Tổ Cấp giấy') {
      targetKey = 'tổ cấp giấy';
    } else if (isMeasurementView) {
      targetKey = 'tổ đo đạc';
    } else if (isArchiveView) {
      targetKey = 'tổ lưu trữ';
    } else if (isOtherView || isCapGiayView) {
      targetKey = 'tổ cấp giấy';
    } else {
      const deptLower = targetDept.toLowerCase();
      if (deptLower.includes('đo đạc') || deptLower.includes('đo dạc') || deptLower.includes('kỹ thuật') || deptLower.includes('nội nghiệp') || deptLower.includes('ngoại nghiệp')) {
        targetKey = 'tổ đo đạc';
      } else if (deptLower.includes('lưu trữ') || deptLower.includes('thông tin') || deptLower.includes('sao lục') || deptLower.includes('công văn')) {
        targetKey = 'tổ lưu trữ';
      } else if (deptLower.includes('hành chính') || deptLower.includes('một cửa')) {
        targetKey = 'tổ hành chính';
      }
    }
    
    const DEPT_KEYS: Record<string, string[]> = {
      'tổ cấp giấy': ['tổ cấp giấy', 'tổ đăng ký cấp giấy', 'đăng ký cấp giấy', 'tổ đăng ký', 'cấp giấy', 'đăng ký', 'biến động', 'cấp gcn', 'gcn', 'đăng ký & cấp giấy', 'bộ phận cấp giấy'],
      'tổ đo đạc': ['tổ đo đạc', 'đo đạc', 'đo dạc', 'kỹ thuật', 'bản đồ', 'tổ đo', 'nội nghiệp', 'ngoại nghiệp', 'địa chính', 'bản đồ địa chính'],
      'tổ lưu trữ': ['tổ thông tin lưu trữ', 'tổ lưu trữ', 'thông tin lưu trữ', 'lưu trữ', 'thông tin', 'sao lục', 'công văn', 'tổ ttltr', 'ttltr'],
      'tổ hành chính': ['tổ hành chính', 'một cửa', 'quản trị hệ thống', 'hành chính', 'tổng hợp', 'bộ phận tiếp nhận'],
    };

    const validKeys = DEPT_KEYS[targetKey] || DEPT_KEYS['tổ cấp giấy'];

    let matched = employees.filter(emp => {
      const empDept = (emp.department || '').toLowerCase();
      // Bỏ Ban Giám Đốc khỏi danh sách chọn người xử lý
      const isBgd = empDept.includes('ban giám đốc') || empDept.includes('giám đốc') || empDept.includes('ban lãnh đạo');
      if (isBgd) return false;
      return validKeys.some(k => empDept.includes(k));
    });

    // Dự phòng: nếu lọc quá hẹp dẫn tới rỗng, lấy tất cả nhân viên không phải Giám đốc
    if (matched.length === 0) {
      matched = employees.filter(emp => {
        const empDept = (emp.department || '').toLowerCase();
        return !empDept.includes('ban giám đốc') && !empDept.includes('giám đốc') && !empDept.includes('ban lãnh đạo');
      });
    }

    if (formData.assignedTo && !matched.some(e => e.id === formData.assignedTo)) {
      const assignedEmp = employees.find(e => e.id === formData.assignedTo);
      if (assignedEmp) matched.push(assignedEmp);
    }
    return matched;
  }, [employees, targetDept, formData.assignedTo, currentView, isMeasurementView, isArchiveView, isOtherView, isCapGiayView]);

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
        } else {
            const defaultRecType = '';
            const recDate = new Date().toISOString();
            const initDeadline = '';
            let initPrice: number | undefined = undefined;

            const currentEmp = employees.find(e => e.id === currentUser.employeeId || e.name?.toLowerCase() === currentUser.name?.toLowerCase());

            setFormData({
              ...defaultState,
              recordType: defaultRecType,
              receivedDate: recDate,
              deadline: initDeadline,
              price: initPrice,
              code: `HS-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
              status: RecordStatus.RECEIVED,
              capGiaySubStep: 'tiep_nhan',
              assignedTo: currentEmp ? currentEmp.id : (currentUser.employeeId || '')
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
    const finalData = { ...formData };

    const explicitCleared = {
        assignedDate: initialData?.assignedDate && !finalData.assignedDate,
        completedWorkDate: initialData?.completedWorkDate && !finalData.completedWorkDate,
        pendingCheckDate: initialData?.pendingCheckDate && !finalData.pendingCheckDate,
        checkedDate: initialData?.checkedDate && !finalData.checkedDate,
        submissionDate: initialData?.submissionDate && !finalData.submissionDate,
        approvalDate: initialData?.approvalDate && !finalData.approvalDate,
        completedDate: initialData?.completedDate && !finalData.completedDate,
    };
    
    // Logic tự động set ngày khi trạng thái thay đổi hoặc xóa ngày khi quay lui
    // Chỉ áp dụng logic này nếu trạng thái khác với ban đầu (hoặc là tạo mới)
    // Hoặc user admin ép kiểu
    if (hasAdminRights && finalData.status) {
        const now = new Date().toISOString();
        
        // BACKFILL LOGIC: Nếu thay đổi trạng thái, đảm bảo các ngày của tiến trình trước đó (hoặc trạng thái cũ) 
        // được chốt lại để không bị mất màu trên Timeline do thiếu Date.
        if (initialData?.status && finalData.status !== initialData?.status) {
            const flow = [
                RecordStatus.RECEIVED, RecordStatus.IN_PROGRESS, RecordStatus.PENDING_CHECK, 
                RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER
            ];
            // Tạm dùng initialData.status để lấp ngày (để đóng băng tiến độ cũ)
            const prevIdx = flow.indexOf(initialData.status);
            if (prevIdx >= 0) {
                if (prevIdx >= flow.indexOf(RecordStatus.IN_PROGRESS) && !finalData.assignedDate && !explicitCleared.assignedDate) finalData.assignedDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.IN_PROGRESS) && !finalData.completedWorkDate && !explicitCleared.completedWorkDate) finalData.completedWorkDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !finalData.pendingCheckDate && !explicitCleared.pendingCheckDate) finalData.pendingCheckDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !finalData.checkedDate && !explicitCleared.checkedDate) finalData.checkedDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !finalData.submissionDate && !explicitCleared.submissionDate) finalData.submissionDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.SIGNED) && !finalData.approvalDate && !explicitCleared.approvalDate) finalData.approvalDate = now;
            }
            // Auto fill current forward progress as well if going forward
            const newIdx = flow.indexOf(finalData.status);
            if (newIdx >= 0) {
                if (newIdx >= flow.indexOf(RecordStatus.IN_PROGRESS) && !finalData.assignedDate && !explicitCleared.assignedDate) finalData.assignedDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.IN_PROGRESS) && !finalData.completedWorkDate && !explicitCleared.completedWorkDate) finalData.completedWorkDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !finalData.pendingCheckDate && !explicitCleared.pendingCheckDate) finalData.pendingCheckDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !finalData.checkedDate && !explicitCleared.checkedDate) finalData.checkedDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !finalData.submissionDate && !explicitCleared.submissionDate) finalData.submissionDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.SIGNED) && !finalData.approvalDate && !explicitCleared.approvalDate) finalData.approvalDate = now;
            }
        }

        // Logic làm sạch dữ liệu cũ khi quay lui trạng thái chỉ khi CÓ THAY ĐỔI TRẠNG THÁI
        if (initialData?.status && finalData.status !== initialData?.status) {
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
            else if (finalData.status === RecordStatus.PENDING_CHECK) {
                finalData.submissionDate = undefined;
                finalData.approvalDate = undefined;
                finalData.completedDate = undefined;
                finalData.resultReturnedDate = undefined;
            }
            // 3. Nếu quay về PENDING_SIGN (Chờ ký) -> Xóa bước Trả
            else if (finalData.status === RecordStatus.PENDING_SIGN) {
                finalData.approvalDate = undefined;
                finalData.completedDate = undefined;
                finalData.resultReturnedDate = undefined;
            }
        }
    }

    if (finalData.status === RecordStatus.WITHDRAWN && !finalData.completedDate) finalData.completedDate = new Date().toISOString();
    if (finalData.status === RecordStatus.REJECTED && !finalData.completedDate) finalData.completedDate = new Date().toISOString();
    
    if (finalData.resultReturnedDate && finalData.status !== RecordStatus.RETURNED) {
        finalData.status = RecordStatus.RETURNED;
        if (!finalData.completedDate) finalData.completedDate = finalData.resultReturnedDate;
    }
    
    // LOGIC QUAN TRỌNG: Nếu có Đợt xuất hoặc Ngày xuất thì phải là HANDOVER (trừ khi Đã rút, Đã trả hoặc Bị từ chối)
    if ((finalData.exportBatch || finalData.exportDate) && finalData.status !== RecordStatus.WITHDRAWN && finalData.status !== RecordStatus.RETURNED && finalData.status !== RecordStatus.REJECTED) {
        finalData.status = RecordStatus.HANDOVER;
        // Nếu chưa có completedDate, lấy luôn ngày xuất (nếu có) hoặc hôm nay
        if (!finalData.completedDate) {
            finalData.completedDate = finalData.exportDate ? finalData.exportDate : new Date().toISOString();
        }
    }

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
    }

    if (explicitCleared.assignedDate) finalData.assignedDate = null;
    if (explicitCleared.completedWorkDate) finalData.completedWorkDate = null;
    if (explicitCleared.pendingCheckDate) finalData.pendingCheckDate = null;
    if (explicitCleared.checkedDate) { finalData.checkedDate = null; finalData.pendingCheckDate = null; }
    if (explicitCleared.submissionDate) finalData.submissionDate = null;
    if (explicitCleared.approvalDate) finalData.approvalDate = null;
    if (explicitCleared.completedDate) finalData.completedDate = null;

    // Khi xóa các bước / ngày tháng thì tự động đưa về đúng bộ lọc trạng thái của bước đó
    if (finalData.status) {
        if (explicitCleared.submissionDate || (!finalData.submissionDate && initialData?.submissionDate)) {
            if ([RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER].includes(finalData.status)) {
                finalData.status = finalData.checkedDate ? RecordStatus.PENDING_CHECK : (finalData.assignedDate ? RecordStatus.IN_PROGRESS : RecordStatus.RECEIVED);
            }
        }
        if (explicitCleared.checkedDate || (!finalData.checkedDate && initialData?.checkedDate)) {
            if ([RecordStatus.PENDING_CHECK, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER].includes(finalData.status)) {
                finalData.status = finalData.assignedDate ? RecordStatus.IN_PROGRESS : RecordStatus.RECEIVED;
            }
        }
        if (explicitCleared.assignedDate || (!finalData.assignedDate && initialData?.assignedDate)) {
            if (finalData.status !== RecordStatus.RECEIVED) {
                finalData.status = RecordStatus.RECEIVED;
            }
        }
    }

    // Để đảm bảo gửi null thay vì undefined cho API nếu cần xóa
    const cleanData = JSON.parse(JSON.stringify(finalData));
    if(finalData.status === RecordStatus.RECEIVED) {
        cleanData.assignedDate = null;
        cleanData.submissionDate = null;
        cleanData.approvalDate = null;
        cleanData.completedDate = null;
        cleanData.resultReturnedDate = null;
        cleanData.exportBatch = null;
        cleanData.exportDate = null;
    } else if (finalData.status === RecordStatus.ASSIGNED || finalData.status === RecordStatus.IN_PROGRESS) {
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
      if (field === 'assignedTo' && value) {
        const emp = employees.find(e => e.id === value);
        const firstWard = emp?.managedWards?.[0];
        if (firstWard) {
          updated.ward = firstWard;
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
        }
        if (field === 'recordType') {
          const rLower = String(value || '').toLowerCase();
          if (rLower.includes('1.2') || rLower.includes('công văn') || rLower.includes('cong van') || rLower.includes('sao lục') || value === '1.1 Sao lục' || value === '1.1 CC DL ĐĐ' || value === '1.1 Sao lục hồ sơ' || value === '1.1 Cung cấp dữ liệu đất đai') {
            updated.price = 310000;
          }
          if (isCapGiayRecord({ recordType: value })) {
            updated.capGiaySubStep = getDefaultCapGiaySubStep(value);
          }
        }
      }
      return updated;
    });
  };
  const val = (v: any) => v === undefined || v === null ? '' : v;
  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

  const isCongVan = formData.recordType ? getShortRecordType(formData.recordType) === '1.2 Công văn' : false;
  const isCGModal = isCapGiayRecord(formData);
  const recTypeLower = (formData.recordType || '').toLowerCase();
  const showMsr = !isCGModal && (recTypeLower.includes('trích đo') || recTypeLower.includes('đo đạc') || recTypeLower.includes('đo') || recTypeLower.includes('tách thửa') || (!recTypeLower.includes('trích đo') && !recTypeLower.includes('trích lục')));
  const showExc = !isCGModal && (recTypeLower.includes('trích lục') || (!recTypeLower.includes('trích đo') && !recTypeLower.includes('trích lục')));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-0 md:p-4 backdrop-blur-sm">
      <div className="bg-white md:rounded-xl shadow-2xl w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl h-full md:max-h-[95vh] flex flex-col animate-fade-in-up">
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
                    {isProfessionalReceptionTab ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Mã hồ sơ <span className="text-red-500">*</span></label>
                                <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-bold text-blue-700" value={val(formData.code)} onChange={(e) => handleChange('code', e.target.value)} />
                            </div>
                            <div className={isCongVan ? "md:col-span-2" : "md:col-span-1"}>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Loại hồ sơ</label>
                                <select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" value={formData.recordType ? getShortRecordType(formData.recordType) : ''} onChange={(e) => handleChange('recordType', e.target.value)}>
                                    <option value="">-- Chọn loại hồ sơ --</option>
                                    {allowedRecordTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Ngày nhận</label>
                                <input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} />
                            </div>
                            {!isCongVan && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Hẹn trả <span className="text-red-500">*</span></label>
                                    <input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-semibold text-red-600 bg-red-50" value={dateVal(formData.deadline)} onChange={(e) => handleChange('deadline', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-700 mb-1">Mã hồ sơ <span className="text-red-500">*</span></label>
                                <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-bold text-blue-700" value={val(formData.code)} onChange={(e) => handleChange('code', e.target.value)} />
                            </div>
                            <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-gray-700 mb-1">Loại hồ sơ</label>
                                <select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" value={formData.recordType ? getShortRecordType(formData.recordType) : ''} onChange={(e) => handleChange('recordType', e.target.value)}>
                                    <option value="">-- Chọn loại hồ sơ --</option>
                                    {allowedRecordTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái</label><select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-yellow-50 font-medium" value={val(formData.status)} onChange={(e) => handleChange('status', e.target.value)}>{Object.values(RecordStatus).filter(s => s !== RecordStatus.ASSIGNED).map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}</select></div>
                            
                            {targetDept === 'Tổ Cấp giấy' && (
                                <div>
                                    <label className="block text-xs font-bold text-teal-800 mb-1">Trạng thái Cấp Giấy (Bước quy trình)</label>
                                    <select 
                                        className="w-full border border-teal-300 rounded-md px-3 py-2 bg-teal-50 font-bold text-teal-900 text-xs" 
                                        value={val(formData.capGiaySubStep || 'tham_dinh')} 
                                        onChange={(e) => handleChange('capGiaySubStep', e.target.value)}
                                    >
                                        <option value="tiep_nhan">1. Tiếp nhận mới</option>
                                        <option value="tham_dinh">2. Chờ thẩm định</option>
                                        <option value="phieu_chuyen_thue">3. Chờ chuyển thuế</option>
                                        <option value="cho_tbt">4. Chờ Thuế KV7</option>
                                        <option value="cho_nop_thue">5. Chờ Giấy nộp tiền</option>
                                        <option value="hoan_thien_trinh_duyet">6. Chờ In & hoàn thiện</option>
                                        <option value="trinh_kiem_tra">7. Chờ kiểm tra</option>
                                        <option value="trinh_ky">8. Chờ ký duyệt</option>
                                        <option value="cho_ban_giao">9. Chờ bàn giao</option>
                                        <option value="cho_bo_sung">10. Chờ bổ sung</option>
                                        <option value="giao_mot_cua">11. Đã giao kết quả</option>
                                        <option value="da_tra_ket_qua">12. Đã trả kết quả</option>
                                    </select>
                                </div>
                            )}
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày nhận</label><input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>
                            {!isCongVan && (
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Hẹn trả <span className="text-red-500">*</span></label><input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-semibold text-red-600 bg-red-50" value={dateVal(formData.deadline)} onChange={(e) => handleChange('deadline', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>
                            )}
                            {targetDept !== 'Tổ Cấp giấy' && (
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày giao NV</label><input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.assignedDate)} onChange={(e) => handleChange('assignedDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>
                            )}
                            
                            {targetDept === 'Tổ Cấp giấy' && (
                                <div><label className="block text-xs font-bold text-indigo-700 mb-1">Ngày thẩm định</label><input type="date" className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-indigo-50 text-indigo-900 font-medium" value={dateVal(formData.completedWorkDate)} onChange={(e) => handleChange('completedWorkDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>
                            )}
                            
                            {targetDept === 'Tổ Cấp giấy' && (
                                <>
                                    <div><label className="block text-xs font-bold text-amber-700 mb-1">Ngày chuyển thuế</label><input type="date" className="w-full border border-amber-300 rounded-md px-3 py-2 bg-amber-50 text-amber-900 font-medium" value={dateVal(formData.taxTransferDate)} onChange={(e) => handleChange('taxTransferDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>
                                    <div><label className="block text-xs font-bold text-orange-700 mb-1">Ngày nhận TB Thuế KV7</label><input type="date" className="w-full border border-orange-300 rounded-md px-3 py-2 bg-orange-50 text-orange-900 font-medium" value={dateVal(formData.taxNoticeDate)} onChange={(e) => handleChange('taxNoticeDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>
                                    <div><label className="block text-xs font-bold text-yellow-700 mb-1">Ngày nộp thuế / GNT</label><input type="date" className="w-full border border-yellow-300 rounded-md px-3 py-2 bg-yellow-50 text-yellow-900 font-medium" value={dateVal(formData.taxPaidDate)} onChange={(e) => handleChange('taxPaidDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>
                                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">Ngày in & hoàn thiện</label><input type="date" className="w-full border border-emerald-300 rounded-md px-3 py-2 bg-emerald-50 text-emerald-900 font-medium" value={dateVal(formData.printedDate)} onChange={(e) => handleChange('printedDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>
                                </>
                            )}

                            {targetDept !== 'Tổ Lưu trữ' && (
                                <div><label className="block text-xs font-bold text-teal-700 mb-1">Ngày kiểm tra</label><input type="date" className="w-full border border-teal-300 rounded-md px-3 py-2 bg-teal-50 text-teal-900 font-medium" value={dateVal(formData.checkedDate || formData.pendingCheckDate)} onChange={(e) => { const iso = e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : ''; handleChange('checkedDate', iso); handleChange('pendingCheckDate', iso); }} /></div>
                            )}

                            <div><label className="block text-xs font-bold text-purple-700 mb-1">Ngày trình ký</label><input type="date" className="w-full border border-purple-300 rounded-md px-3 py-2 bg-purple-50 text-purple-900 font-medium" value={dateVal(formData.submissionDate)} onChange={(e) => handleChange('submissionDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>

                            {targetDept === 'Tổ Cấp giấy' && (
                                <div><label className="block text-xs font-bold text-blue-700 mb-1">Ngày ký duyệt</label><input type="date" className="w-full border border-blue-300 rounded-md px-3 py-2 bg-blue-50 text-blue-900 font-medium" value={dateVal(formData.approvalDate)} onChange={(e) => handleChange('approvalDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>
                            )}

                            <div><label className="block text-xs font-bold text-green-700 mb-1">Ngày hoàn thành</label><input type="date" className="w-full border border-green-300 rounded-md px-3 py-2 bg-green-50 font-semibold text-green-900" value={dateVal(formData.completedDate)} onChange={(e) => handleChange('completedDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>
                            <div><label className="block text-xs font-bold text-emerald-700 mb-1">Ngày trả KQ</label><input type="date" className="w-full border border-emerald-300 rounded-md px-3 py-2 bg-emerald-50 text-emerald-900 font-medium" value={dateVal(formData.resultReturnedDate)} onChange={(e) => handleChange('resultReturnedDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>
                        </div>
                    )}
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
                            {isCGModal && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:col-span-2 bg-teal-50/60 p-3 rounded-lg border border-teal-200">
                                    <div><label className="block text-xs font-bold text-teal-800 mb-1">Số phát hành GCN</label><input type="text" className="w-full border border-teal-300 rounded-md px-2.5 py-1.5 bg-white text-teal-900 font-bold text-xs" placeholder="VD: CD 123456" value={val(formData.issueNumber)} onChange={(e) => handleChange('issueNumber', e.target.value)} /></div>
                                    <div><label className="block text-xs font-bold text-teal-800 mb-1">Số vào sổ GCN</label><input type="text" className="w-full border border-teal-300 rounded-md px-2.5 py-1.5 bg-white text-teal-900 font-bold text-xs" placeholder="VD: CH 01234" value={val(formData.entryNumber)} onChange={(e) => handleChange('entryNumber', e.target.value)} /></div>
                                    <div><label className="block text-xs font-bold text-teal-800 mb-1">Ngày cấp GCN</label><input type="date" className="w-full border border-teal-300 rounded-md px-2.5 py-1.5 bg-white text-teal-900 font-medium text-xs" value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} /></div>
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Tờ bản đồ</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.mapSheet)} onChange={(e) => handleChange('mapSheet', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Thửa đất</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.landPlot)} onChange={(e) => handleChange('landPlot', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Diện tích (m2)</label><input type="number" className="w-full border border-gray-300 rounded-md px-3 py-2 text-right" value={formData.area || 0} onChange={(e) => handleChange('area', parseFloat(e.target.value))} /></div>
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
                                <textarea rows={1} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" value={val(formData.content)} onChange={(e) => handleChange('content', e.target.value)} placeholder={isCongVan ? 'Nhập trích yếu nội dung công văn...' : ''} />
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
                                <div className="p-4 flex items-center justify-between gap-4 border-b border-gray-100 bg-gray-50/50">
                                    <h3 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-2">
                                        <UserIcon size={14} className="text-indigo-600" />
                                        Thông tin người được ủy quyền (nếu có)
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsAuthOpen(!isAuthOpen)}
                                        className="flex items-center gap-1 text-[10px] font-bold uppercase rounded border border-gray-300 hover:bg-white transition-all px-2 py-1 text-gray-600 bg-gray-50 shadow-sm"
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
                        </div>

                                                {!isProfessionalReceptionTab && (
                            <>
                                <div className={`grid gap-4 bg-gray-50 p-3.5 rounded-lg border border-gray-200 ${(!isCongVan && (showMsr || showExc)) ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                                    {!isCongVan && (
                                        <>
                                            {showMsr && (
                                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Số Trích đo</label><input type="text" className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm bg-white" value={val(formData.measurementNumber)} onChange={(e) => handleChange('measurementNumber', e.target.value)} placeholder="Nhập số trích đo..." /></div>
                                            )}
                                            {showExc && (
                                                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Số Trích lục</label><input type="text" className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm bg-white" value={val(formData.excerptNumber)} onChange={(e) => handleChange('excerptNumber', e.target.value)} placeholder="Nhập số trích lục..." /></div>
                                            )}
                                        </>
                                    )}
                                    <div className="w-full">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Giao nhân viên xử lý</label>
                                        <select className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm bg-white" value={val(formData.assignedTo)} onChange={(e) => handleChange('assignedTo', e.target.value)}>
                                            <option value="">-- Chưa giao --</option>
                                            {filteredEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {hasAdminRights && (
                                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                        <div className="flex items-center gap-2 mb-1"><Lock size={14} className="text-yellow-600" /><label className="text-xs font-bold text-yellow-800 uppercase">Ghi chú nội bộ</label></div>
                                        <textarea rows={2} className="w-full border border-yellow-300 rounded-md px-3 py-2 bg-white text-sm" value={val(formData.privateNotes)} onChange={(e) => handleChange('privateNotes', e.target.value)} placeholder="Nhập ghi chú nội bộ..." />
                                    </div>
                                )}

                                {/* HIỂN THỊ ĐỢT XUẤT, NGÀY XUẤT VÀ PHI ĐỊA GIỚI */}
                                {hasAdminRights && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50/80 p-3.5 rounded-lg border border-indigo-200/80">
                                        <div>
                                            <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Đợt xuất (Batch)</label>
                                            <div className="flex gap-1">
                                                <input type="text" className="w-full border border-indigo-200 rounded-md px-2.5 py-1.5 text-sm bg-white font-medium" value={val(formData.exportBatch)} onChange={(e) => handleChange('exportBatch', e.target.value)} placeholder="VD: CG - Đợt 01 - 29/07/26..." />
                                                {formData.exportBatch && <button type="button" onClick={() => handleChange('exportBatch', '')} className="px-2 bg-red-100 text-red-600 rounded text-xs font-bold hover:bg-red-200" title="Xóa đợt xuất">Xóa</button>}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Ngày xuất</label>
                                            <div className="flex gap-1">
                                                <input type="date" className="w-full border border-indigo-200 rounded-md px-2.5 py-1.5 text-sm bg-white" value={val(formData.exportDate ? formData.exportDate.split('T')[0] : '')} onChange={(e) => handleChange('exportDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : '')} />
                                                {formData.exportDate && <button type="button" onClick={() => handleChange('exportDate', '')} className="px-2 bg-red-100 text-red-600 rounded text-xs font-bold hover:bg-red-200" title="Xóa ngày xuất">Xóa</button>}
                                            </div>
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
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-emerald-700 mb-1">Ngày trả kết quả</label>
                                                <input type="date" className="w-full border border-emerald-300 rounded-md px-3 py-2 bg-white font-bold text-emerald-800" value={dateVal(formData.resultReturnedDate)} onChange={(e) => handleChange('resultReturnedDate', e.target.value)} />
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="block text-xs font-bold text-emerald-700">
                                                        {formData.receiptType === 'Biên Lai' ? 'Số Biên lai' : formData.receiptType === 'Hóa Đơn' ? 'Số Hóa đơn' : 'Số Chứng từ'}
                                                    </label>
                                                    <select 
                                                        className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded px-1 py-0.5 outline-none cursor-pointer"
                                                        value={formData.receiptType || 'Biên Lai'}
                                                        onChange={(e) => handleChange('receiptType', e.target.value)}
                                                    >
                                                        <option value="Biên Lai">Biên Lai</option>
                                                        <option value="Hóa Đơn">Hóa Đơn</option>
                                                    </select>
                                                </div>
                                                <input type="text" className="w-full border border-emerald-300 rounded-md px-3 py-2 font-mono text-center font-bold bg-white" value={val(formData.receiptNumber)} onChange={(e) => handleChange('receiptNumber', e.target.value)} placeholder={`Nhập số ${formData.receiptType === 'Hóa Đơn' ? 'hóa đơn' : 'biên lai'}...`} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-emerald-700 mb-1">Số tiền</label>
                                                <input type="number" className="w-full border border-emerald-300 rounded-md px-3 py-2 font-bold text-center text-emerald-900 bg-white" value={formData.returnedPrice !== undefined && formData.returnedPrice !== null ? formData.returnedPrice : ''} onChange={(e) => handleChange('returnedPrice', parseFloat(e.target.value) || 0)} placeholder="Nhập số tiền..." />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* 5. LỊCH SỬ THAY ĐỔI TRẠNG THÁI (LOG) */}
                        {formData.statusLogs && formData.statusLogs.length > 0 && (
                            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mt-4">
                                <h3 className="text-xs font-bold text-gray-700 uppercase mb-3 flex items-center gap-2 border-b pb-2">
                                    <History size={16} className="text-blue-600" /> Bảng Log lịch sử thay đổi trạng thái ({formData.statusLogs.length})
                                </h3>
                                <div className="overflow-x-auto max-h-60">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-600 border-b">
                                                <th className="p-2 font-semibold">Thời gian</th>
                                                <th className="p-2 font-semibold">Người thay đổi</th>
                                                <th className="p-2 font-semibold">Trạng thái cũ</th>
                                                <th className="p-2 font-semibold">Trạng thái mới</th>
                                                <th className="p-2 font-semibold">Ghi chú</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {formData.statusLogs.map((log, idx) => (
                                                <tr key={log.id || idx} className="hover:bg-gray-50">
                                                    <td className="p-2 whitespace-nowrap text-gray-500 font-mono">
                                                        {log.changedAt ? new Date(log.changedAt).toLocaleString('vi-VN') : '—'}
                                                    </td>
                                                    <td className="p-2 font-medium text-gray-800">{log.changedBy || 'Hệ thống'}</td>
                                                    <td className="p-2">
                                                        {log.previousStatus ? (
                                                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                                                                {STATUS_LABELS[log.previousStatus as RecordStatus] || log.previousStatus}
                                                            </span>
                                                        ) : <span className="text-gray-400 italic">Mới tạo</span>}
                                                    </td>
                                                    <td className="p-2">
                                                        <span className="px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                                            {STATUS_LABELS[log.newStatus as RecordStatus] || log.newStatus}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 text-gray-600 italic">{log.note || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </form>
        </div>

        {/* FOOTER */}
        <div className="p-4 md:p-5 border-t bg-gray-50 flex justify-end gap-3 shrink-0 rounded-b-none md:rounded-b-xl sticky bottom-0 z-10">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 font-medium transition-colors text-sm">Hủy bỏ</button>
            <button type="submit" form="record-form" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md font-bold transition-transform active:scale-95 text-sm"><Save size={18} /> {initialData ? 'Cập nhật' : 'Lưu hồ sơ'}</button>
        </div>
      </div>
    </div>
  );
};

export default RecordModal;
