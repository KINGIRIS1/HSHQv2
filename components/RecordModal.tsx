
import React, { useState, useEffect } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole } from '../types';
import { GROUPS, EXTENDED_RECORD_TYPES, STATUS_LABELS, getShortRecordType, getWardLabel, getNormalizedWard } from '../constants';
import { X, Save, Lock, User as UserIcon, MapPin, FileText, Calendar, FileCheck, ChevronDown, ChevronUp } from 'lucide-react';
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
    privateNotes: '', authorizedBy: '', authDocType: '', receiptNumber: '', resultReturnedDate: '', explanationPlan: ''
  };

  const [formData, setFormData] = useState<Partial<RecordFile>>(defaultState);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDocItem[]>([]);
  const [authCccd, setAuthCccd] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  const hasAdminRights = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;
  const isOneDoor = currentUser.role === UserRole.ONEDOOR;
  const canEditResult = hasAdminRights || isOneDoor;

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            setFormData(initialData);
            setAttachedDocs(parseAttachedDocs(initialData.otherDocs));
            const parsed = parseAuthDocType(initialData.authDocType);
            setAuthCccd(parsed.cccd);
            setAuthAddress(parsed.address);
            setIsAuthOpen(!!(initialData.authorizedBy || parsed.cccd || parsed.address));
        } else {
            setFormData({ ...defaultState, code: `HS-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}` });
            setAttachedDocs([]);
            setAuthCccd('');
            setAuthAddress('');
            setIsAuthOpen(false);
        }
    }
  }, [initialData, isOpen]);

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
    
    // LOGIC QUAN TRỌNG: Nếu có Đợt xuất hoặc Ngày xuất thì phải là HANDOVER (trừ khi Đã rút, Đã trả hoặc Bị từ chối)
    if ((finalData.exportBatch || finalData.exportDate) && finalData.status !== RecordStatus.WITHDRAWN && finalData.status !== RecordStatus.RETURNED && finalData.status !== RecordStatus.REJECTED) {
        finalData.status = RecordStatus.HANDOVER;
        // Nếu chưa có completedDate, lấy luôn ngày xuất (nếu có) hoặc hôm nay
        if (!finalData.completedDate) {
            finalData.completedDate = finalData.exportDate ? finalData.exportDate : new Date().toISOString();
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
      if (field === 'assignedTo' && value) {
        const emp = employees.find(e => e.id === value);
        const firstWard = emp?.managedWards?.[0];
        if (firstWard) {
          updated.ward = firstWard;
          updated.handoverWard = firstWard;
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
      }
      return updated;
    });
  };
  const val = (v: any) => v === undefined || v === null ? '' : v;
  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

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
    allowedRecordTypes = [
      '1.1 CC DL ĐĐ',
      '1.2 Công văn'
    ];
  } else if (isMeasurementView) {
    allowedRecordTypes = [
      '2.1 Trích lục',
      '2.2 Trích lục QH',
      '2.3 Trích đo',
      '2.4 Cắm mốc',
      '2.5 Tách-Hợp thửa',
      '2.6 CC số thửa'
    ];
  } else {
    allowedRecordTypes = [
      '1.1 CC DL ĐĐ',
      '1.2 Công văn',
      '2.1 Trích lục',
      '2.2 Trích lục QH',
      '2.3 Trích đo',
      '2.4 Cắm mốc',
      '2.5 Tách-Hợp thửa',
      '2.6 CC số thửa',
      'CMD',
      'Thi hành án',
      'Tòa án'
    ];
  }

  const isCongVan = formData.recordType ? getShortRecordType(formData.recordType) === '1.2 Công văn' : false;
  const recTypeLower = (formData.recordType || '').toLowerCase();
  const showMsr = recTypeLower.includes('trích đo') || recTypeLower.includes('đo đạc') || recTypeLower.includes('đo') || recTypeLower.includes('tách thửa') || (!recTypeLower.includes('trích đo') && !recTypeLower.includes('trích lục'));
  const showExc = recTypeLower.includes('trích lục') || (!recTypeLower.includes('trích đo') && !recTypeLower.includes('trích lục'));

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
                            <label className="block text-xs font-bold text-gray-700 mb-1">Loại hồ sơ</label>
                            <select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" value={formData.recordType ? getShortRecordType(formData.recordType) : ''} onChange={(e) => handleChange('recordType', e.target.value)}>
                                <option value="">-- Chọn loại hồ sơ --</option>
                                {allowedRecordTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        {hasAdminRights && (
                            <>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày nhận</label><input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value)} /></div>
                                {!isCongVan && (
                                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Hẹn trả <span className="text-red-500">*</span></label><input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-semibold text-red-600 bg-red-50" value={dateVal(formData.deadline)} onChange={(e) => handleChange('deadline', e.target.value)} /></div>
                                )}
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày giao NV</label><input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.assignedDate)} onChange={(e) => handleChange('assignedDate', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái</label><select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-yellow-50 font-medium" value={val(formData.status)} onChange={(e) => handleChange('status', e.target.value)}>{Object.values(RecordStatus).map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}</select></div>
                                
                                {(formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.WITHDRAWN || formData.status === RecordStatus.RETURNED || formData.status === RecordStatus.REJECTED || formData.exportBatch) && (
                                    <div><label className="block text-xs font-bold text-green-700 mb-1">{formData.status === RecordStatus.WITHDRAWN ? 'Ngày rút hồ sơ' : formData.status === RecordStatus.REJECTED ? 'Ngày trả hồ sơ' : 'Ngày hoàn thành'}</label><input type="date" className="w-full border border-green-300 rounded-md px-3 py-2 bg-green-50 font-semibold text-green-800" value={dateVal(formData.completedDate)} onChange={(e) => handleChange('completedDate', e.target.value)} /></div>
                                )}
                                
                                {/* Thêm trường hiển thị Ngày Trình Ký và Ngày Ký Duyệt nếu trạng thái tương ứng hoặc đã có giá trị */}
                                {(formData.status === RecordStatus.PENDING_SIGN || formData.status === RecordStatus.SIGNED || formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.REJECTED || formData.status === RecordStatus.WITHDRAWN || !!formData.submissionDate) && (
                                    <div><label className="block text-xs font-bold text-purple-700 mb-1">Ngày trình ký</label><input type="date" className="w-full border border-purple-300 rounded-md px-3 py-2 bg-purple-50 text-purple-800" value={dateVal(formData.submissionDate)} onChange={(e) => handleChange('submissionDate', e.target.value)} /></div>
                                )}
                                {(formData.status === RecordStatus.SIGNED || formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.REJECTED || formData.status === RecordStatus.WITHDRAWN || !!formData.approvalDate) && (
                                    <div><label className="block text-xs font-bold text-indigo-700 mb-1">Ngày ký duyệt</label><input type="date" className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-indigo-50 text-indigo-800" value={dateVal(formData.approvalDate)} onChange={(e) => handleChange('approvalDate', e.target.value)} /></div>
                                )}
                            </>
                        )}
                        {!hasAdminRights && <div className="col-span-full p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 italic text-center">* Ngày tháng và trạng thái chỉ Admin/Subadmin được chỉnh sửa.</div>}
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
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Xã / Phường thửa đất</label>
                                <select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" value={val(formData.ward)} onChange={(e) => handleChange('ward', e.target.value)}>
                                    <option value="">-- Chọn Xã/Phường --</option>
                                    {wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}
                                </select>
                            </div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Địa chỉ chi tiết</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.address)} onChange={(e) => handleChange('address', e.target.value)} placeholder="Số nhà, đường, ấp..." /></div>
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
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Họ tên người được ủy quyền</label>
                                            <input
                                                type="text"
                                                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                                placeholder="Họ tên..."
                                                value={formData.authorizedBy || ''}
                                                onChange={(e) => handleChange('authorizedBy', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">CCCD người được ủy quyền</label>
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
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Địa chỉ thường trú người được ủy quyền</label>
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

                        <div className={`grid gap-4 bg-gray-50 p-3 rounded border border-gray-200 ${isCongVan ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'}`}>
                            {!isCongVan && (
                                <>
                                    {showMsr && (
                                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Số Trích đo</label><input type="text" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={val(formData.measurementNumber)} onChange={(e) => handleChange('measurementNumber', e.target.value)} /></div>
                                    )}
                                    {showExc && (
                                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Số Trích lục</label><input type="text" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={val(formData.excerptNumber)} onChange={(e) => handleChange('excerptNumber', e.target.value)} /></div>
                                    )}
                                </>
                            )}
                            <div className={isCongVan ? 'w-full' : 'col-span-2'}>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Giao nhân viên xử lý</label>
                                <select className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={val(formData.assignedTo)} onChange={(e) => handleChange('assignedTo', e.target.value)}>
                                    <option value="">-- Chưa giao --</option>
                                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>)}
                                </select>
                            </div>
                        </div>
                        {/* QUAN TRỌNG: Hiển thị thông tin xuất đợt */}
                        {hasAdminRights && (
                            <div className="grid grid-cols-2 gap-4 bg-indigo-50 p-3 rounded border border-indigo-200">
                                <div><label className="block text-[10px] font-bold text-indigo-500 uppercase mb-1">Đợt xuất (Batch)</label><input type="number" className="w-full border border-indigo-200 rounded-md px-2 py-1.5 text-sm" value={val(formData.exportBatch)} onChange={(e) => handleChange('exportBatch', parseInt(e.target.value))} /></div>
                                <div><label className="block text-[10px] font-bold text-indigo-500 uppercase mb-1">Ngày xuất</label><input type="date" className="w-full border border-indigo-200 rounded-md px-2 py-1.5 text-sm" value={val(formData.exportDate ? formData.exportDate.split('T')[0] : '')} onChange={(e) => handleChange('exportDate', new Date(e.target.value).toISOString())} /></div>
                            </div>
                        )}
                        
                        {canEditResult && (
                            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                                <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2 mb-3"><FileCheck size={16} /> TRẢ KẾT QUẢ CHO DÂN</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">Ngày trả kết quả</label><input type="date" className="w-full border border-emerald-300 rounded-md px-3 py-2 bg-white font-bold text-emerald-800" value={dateVal(formData.resultReturnedDate)} onChange={(e) => handleChange('resultReturnedDate', e.target.value)} /></div>
                                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">Số Biên Lai</label><input type="text" className="w-full border border-emerald-300 rounded-md px-3 py-2 font-mono bg-white" value={val(formData.receiptNumber)} onChange={(e) => handleChange('receiptNumber', e.target.value)} placeholder="Nhập số biên lai..." /></div>
                                </div>
                            </div>
                        )}

                        {hasAdminRights && (
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                <div className="flex items-center gap-2 mb-1"><Lock size={14} className="text-yellow-600" /><label className="text-xs font-bold text-yellow-800 uppercase">Ghi chú nội bộ</label></div>
                                <textarea rows={2} className="w-full border border-yellow-300 rounded-md px-3 py-2 bg-white text-sm" value={val(formData.privateNotes)} onChange={(e) => handleChange('privateNotes', e.target.value)} />
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
