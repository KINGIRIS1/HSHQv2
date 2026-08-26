import React, { useState, useEffect } from 'react';
import { DangKyRecord, DangKyStatusType, DangKyParty, Employee, User, DANG_KY_STATUS_LIST, DANG_KY_RECORD_TYPES } from '../types';
import { 
  X, Save, FileText, Users, UserPlus, Shield, 
  Calendar, Plus, Trash2, MapPin, FileCheck,
  ClipboardList, User as UserIcon, ChevronUp, ChevronDown, RefreshCw, XCircle
} from 'lucide-react';
import { calculateDeadlineHelper } from '../utils/appHelpers';
import { detectProcedureId, getShortRecordType, getDefaultDocsForProcedure } from '../constants/procedures';
import { addActivityLog } from '../services/activityLogService';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { isStepActiveInProcedure, getValidStatusesForDangKyRecord } from '../constants/procedureWorkflows';
import { parseAttachedDocs } from './DangKyDetailModal';

interface DangKyRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: DangKyRecord) => Promise<void> | void;
  initialData?: DangKyRecord | null;
  employees: Employee[];
  currentUser: User | null;
  wards: string[];
  holidays?: any[];
}

interface AttachedDoc {
  name: string;
  type: string;
}

export const DangKyRecordModal: React.FC<DangKyRecordModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  employees,
  currentUser,
  wards,
  holidays = []
}) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showAuthorizedSection, setShowAuthorizedSection] = useState<boolean>(true);
  const [showWorkflowSection, setShowWorkflowSection] = useState<boolean>(false);

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-1.5 2xl:py-2 text-xs sm:text-sm 2xl:text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-medium text-slate-700 bg-white hover:border-gray-400 shadow-2xs";
  const labelClass = "block text-xs 2xl:text-sm font-bold text-slate-700 mb-1 2xl:mb-1.5";

  // Danh sách các thủ tục đơn phương / không có bên nhận chuyển nhượng (mặc định người nộp là chủ hồ sơ, ẩn bên nhận)
  const isNoTransfereeProcedure = (rType?: string, code?: string) => {
    const procId = detectProcedureId(code, rType);
    const noTransfereeIds = ['3.2.1', '3.3.1', '3.4.1', '3.6.1', '3.7.2', '3.8.1', '3.8.2'];
    if (procId && noTransfereeIds.includes(procId)) return true;
    const lower = (rType || '').toLowerCase();
    if (lower.includes('3.2.1') || lower.includes('3.3.1') || lower.includes('3.4.1') || lower.includes('3.6.1') || lower.includes('3.7.2') || lower.includes('3.8.1') || lower.includes('3.8.2')) return true;
    if (lower.includes('cấp đổi gcn (ố nhòe') || lower.includes('cấp lại giấy chứng nhận do bị mất') || lower.includes('không đổi người sử dụng đất') || lower.includes('chuyển mục đích sử dụng đất không phải xin phép') || lower.includes('thay đổi thông tin cá nhân') || lower.includes('đăng ký gdbd') || lower.includes('xóa đk gdbd')) return true;
    return false;
  };

  const createFreshRecord = (): DangKyRecord => {
    const todayStr = new Date().toISOString().split('T')[0];
    const defaultType = '3.1.1 Chuyển quyền';
    const initialDeadline = calculateDeadlineHelper(defaultType, todayStr, holidays || []);
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : ((r & 0x3) | 0x8);
          return v.toString(16);
        });
    
    return {
      id: newId,
      code: `HS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      owners: [{ name: '', cccd: '', address: '', phone: '' }],
      transferees: [],
      applicantIsOwner: false,
      applicantName: '',
      applicantCccd: '',
      applicantPhone: '',
      applicantAddress: '',
      authorizedPersonName: '',
      authorizedPersonId: '',
      authorizedPersonPhone: '',
      authorizedPersonAddress: '',
      landPlot: '',
      mapSheet: '',
      issueNumber: '',
      entryNumber: '',
      issueDate: '',
      totalArea: 0,
      residentialArea: 0,
      ward: '',
      recordType: defaultType,
      receivedDate: todayStr,
      assignedDate: todayStr,
      deadline: initialDeadline,
      receivedBy: currentUser?.fullName || currentUser?.name || currentUser?.username || '',
      appraisalDate: '',
      appraisalStaff: '',
      taxFormDate: '',
      taxFormNumber: '',
      taxFormStaff: '',
      taxKV7TransferDate: '',
      taxKV7Staff: '',
      taxNoticeDate: '',
      taxNoticeStaff: '',
      taxPaymentReceiptDate: '',
      printDate: '',
      printStaff: '',
      pendingCheckDate: '',
      checkedBy: '',
      submissionDate: '',
      submittedTo: '',
      completedDate: '',
      exportBatch: '',
      resultReturnedDate: '',
      receiptNumber: '',
      invoiceNumber: '',
      feeAmount: 0,
      status: 'Tiếp nhận mới',
      notes: '',
      attachedDocuments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  const [formData, setFormData] = useState<DangKyRecord>(createFreshRecord());
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        owners: initialData.owners && initialData.owners.length > 0 ? initialData.owners : [{ name: '', cccd: '', address: '', phone: '' }],
        transferees: initialData.transferees || []
      });
      const initialDocs = parseAttachedDocs(initialData.attachedDocs, initialData.otherDocs, initialData.attachedDocuments).map(d => ({
        name: d.name || '',
        type: d.type || 'Bản chính'
      }));
      setAttachedDocs(initialDocs);
      if (initialData.authorizedPersonName || initialData.authorizedPersonId) {
        setShowAuthorizedSection(true);
      }
    } else {
      const fresh = createFreshRecord();
      setFormData(fresh);
      const defDocs = getDefaultDocsForProcedure(fresh.recordType, fresh.code);
      setAttachedDocs(defDocs.map(d => ({ name: d.name, type: d.type })));
    }
  }, [initialData, isOpen]);

  const STATUS_STEP_ORDER: Record<string, number> = {
    'Tiếp nhận mới': 0,
    'Thẩm định': 1,
    'Phiếu chuyển thuế': 2,
    'Chờ Thuế KV7': 3,
    'Chờ giấy nộp tiền': 4,
    'Chờ In GCN': 5,
    'Chờ kiểm tra': 6,
    'Chờ ký duyệt': 7,
    'Chờ bàn giao': 8,
    'Đã giao 1 cửa': 9,
    'Đã trả kết quả': 10,
    'Chờ bổ sung': 1,
    'CSD rút HS': 10,
    'Trả hủy hồ sơ': 10
  };

  const getStepLevel = (st?: string): number => {
    if (!st) return 0;
    return STATUS_STEP_ORDER[st] ?? 0;
  };

  const handleFieldChange = (field: keyof DangKyRecord, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'recordType' || field === 'code' || field === 'receivedDate') {
        const rCode = field === 'code' ? value : prev.code;
        const rType = field === 'recordType' ? value : prev.recordType;
        const rDate = field === 'receivedDate' ? value : prev.receivedDate;
        
        const procId = detectProcedureId(rCode, rType);
        (updated as any).procedureId = procId;

        // Nếu là thủ tục đơn phương / không có bên nhận:
        if (field === 'recordType' && isNoTransfereeProcedure(rType, rCode)) {
          updated.applicantIsOwner = false; // Ở chế độ đồng bộ chủ sở hữu (owners[0])
          updated.transferees = []; // Xóa danh sách người nhận
          const firstOwner = (prev.owners && prev.owners[0]) || { name: '', cccd: '', phone: '', address: '' };
          if (firstOwner.name) updated.applicantName = firstOwner.name;
          if (firstOwner.cccd) updated.applicantCccd = firstOwner.cccd;
          if (firstOwner.phone) updated.applicantPhone = firstOwner.phone;
          if (firstOwner.address) updated.applicantAddress = firstOwner.address;
        }

        if (field === 'recordType' && !initialData) {
          const defDocs = getDefaultDocsForProcedure(rType, rCode);
          if (defDocs.length > 0) {
            setAttachedDocs(defDocs.map(d => ({ name: d.name, type: d.type })));
          }
        }

        if (rType && rDate) {
          updated.deadline = calculateDeadlineHelper(rType, String(rDate).split('T')[0], holidays || [], rCode, procId);
        }
      }

      if (field === 'status') {
        const currentStep = getStepLevel(value);
        const todayStr = new Date().toISOString().split('T')[0];

        // Reset/Clear step dates for steps that are AFTER currentStep
        if (currentStep < 1) updated.appraisalDate = '';
        if (currentStep < 2) updated.taxFormDate = '';
        if (currentStep < 3) updated.taxKV7TransferDate = '';
        if (currentStep < 4) updated.taxNoticeDate = '';
        if (currentStep < 5) updated.printDate = '';
        if (currentStep < 6) updated.pendingCheckDate = '';
        if (currentStep < 7) updated.submissionDate = '';
        if (currentStep < 8) {
          updated.completedDate = '';
          updated.approvalDate = '';
        }
        if (currentStep < 9) {
          updated.exportDate = '';
          updated.exportBatch = '';
        }
        if (currentStep < 10) {
          updated.resultReturnedDate = '';
          updated.receiptNumber = '';
          updated.invoiceNumber = '';
          updated.feeAmount = 0;
        }

        // Set default date for current step if empty
        if (currentStep >= 1 && !updated.appraisalDate) updated.appraisalDate = todayStr;
        if (currentStep >= 2 && !updated.taxFormDate) updated.taxFormDate = todayStr;
        if (currentStep >= 3 && !updated.taxKV7TransferDate) updated.taxKV7TransferDate = todayStr;
        if (currentStep >= 4 && !updated.taxNoticeDate) updated.taxNoticeDate = todayStr;
        if (currentStep >= 5 && !updated.printDate) updated.printDate = todayStr;
        if (currentStep >= 6 && !updated.pendingCheckDate) updated.pendingCheckDate = todayStr;
        if (currentStep >= 7 && !updated.submissionDate) updated.submissionDate = todayStr;
        if (currentStep >= 8 && !updated.completedDate) updated.completedDate = todayStr;
        if (currentStep >= 9 && !updated.exportDate) updated.exportDate = todayStr;
        if (currentStep >= 10 && !updated.resultReturnedDate) updated.resultReturnedDate = todayStr;
      }

      return updated;
    });
  };

  // Sync applicant with Transferee (if checked) or Owner (if unchecked)
  const handleApplicantIsOwnerToggle = (checked: boolean) => {
    setFormData(prev => {
      const updated: DangKyRecord = {
        ...prev,
        applicantIsOwner: checked,
      };

      const curApplicantName = prev.applicantName || '';
      const curApplicantCccd = prev.applicantCccd || '';
      const curApplicantPhone = prev.applicantPhone || '';
      const curApplicantAddress = prev.applicantAddress || '';

      if (checked) {
        // TÍCH CHỌN: Đưa thông tin nhập vào NGƯỜI NHẬN (CHUYỂN NHƯỢNG, THỪA KẾ, TẶNG CHO, THỎA THUẬN)
        const nextTf = [...(prev.transferees || [])];
        if (nextTf.length === 0) {
          nextTf.push({
            name: curApplicantName,
            cccd: curApplicantCccd,
            phone: curApplicantPhone,
            address: curApplicantAddress
          });
        } else {
          nextTf[0] = {
            ...nextTf[0],
            name: curApplicantName || nextTf[0].name || '',
            cccd: curApplicantCccd || nextTf[0].cccd || '',
            phone: curApplicantPhone || nextTf[0].phone || '',
            address: curApplicantAddress || nextTf[0].address || ''
          };
        }
        updated.transferees = nextTf;

        // Nếu người nộp trống mà người nhận đã có thông tin, kéo về người nộp
        if (!curApplicantName && nextTf[0].name) updated.applicantName = nextTf[0].name;
        if (!curApplicantCccd && nextTf[0].cccd) updated.applicantCccd = nextTf[0].cccd;
        if (!curApplicantPhone && nextTf[0].phone) updated.applicantPhone = nextTf[0].phone;
        if (!curApplicantAddress && nextTf[0].address) updated.applicantAddress = nextTf[0].address;
      } else {
        // KHÔNG TÍCH: Đưa thông tin vào Người đứng tên GCN (owners[0])
        const nextOwners = [...(prev.owners || [{ name: '', cccd: '', address: '', phone: '' }])];
        if (nextOwners.length === 0) {
          nextOwners.push({
            name: curApplicantName,
            cccd: curApplicantCccd,
            phone: curApplicantPhone,
            address: curApplicantAddress
          });
        } else {
          nextOwners[0] = {
            ...nextOwners[0],
            name: curApplicantName || nextOwners[0].name || '',
            cccd: curApplicantCccd || nextOwners[0].cccd || '',
            phone: curApplicantPhone || nextOwners[0].phone || '',
            address: curApplicantAddress || nextOwners[0].address || ''
          };
        }
        updated.owners = nextOwners;

        // Nếu người nộp trống mà chủ GCN đã có thông tin, kéo về người nộp
        if (!curApplicantName && nextOwners[0].name) updated.applicantName = nextOwners[0].name;
        if (!curApplicantCccd && nextOwners[0].cccd) updated.applicantCccd = nextOwners[0].cccd;
        if (!curApplicantPhone && nextOwners[0].phone) updated.applicantPhone = nextOwners[0].phone;
        if (!curApplicantAddress && nextOwners[0].address) updated.applicantAddress = nextOwners[0].address;
      }

      return updated;
    });
  };

  // Xử lý thay đổi thông tin người nộp hồ sơ (Real-time auto-sync)
  const handleApplicantFieldChange = (field: 'applicantName' | 'applicantCccd' | 'applicantPhone' | 'applicantAddress', value: string) => {
    setFormData(prev => {
      const updated: DangKyRecord = {
        ...prev,
        [field]: value
      };

      if (prev.applicantIsOwner) {
        // TÍCH CHỌN: Đưa thông tin vào NGƯỜI NHẬN (transferees[0])
        const nextTf = [...(prev.transferees || [])];
        const tfField: keyof DangKyParty = field === 'applicantName' ? 'name' : field === 'applicantCccd' ? 'cccd' : field === 'applicantPhone' ? 'phone' : 'address';
        if (nextTf.length === 0) {
          nextTf.push({ name: '', cccd: '', phone: '', address: '', [tfField]: value });
        } else {
          nextTf[0] = { ...nextTf[0], [tfField]: value };
        }
        updated.transferees = nextTf;
      } else {
        // KHÔNG TÍCH: Đưa thông tin vào NGƯỜI ĐỨNG TÊN GCN (owners[0])
        const nextOwners = [...(prev.owners || [{ name: '', cccd: '', address: '', phone: '' }])];
        const ownerField: keyof DangKyParty = field === 'applicantName' ? 'name' : field === 'applicantCccd' ? 'cccd' : field === 'applicantPhone' ? 'phone' : 'address';
        if (nextOwners.length === 0) {
          nextOwners.push({ name: '', cccd: '', phone: '', address: '', [ownerField]: value });
        } else {
          nextOwners[0] = { ...nextOwners[0], [ownerField]: value };
        }
        updated.owners = nextOwners;
      }

      return updated;
    });
  };

  if (!isOpen) return null;

  // Owners Handlers
  const addOwner = () => {
    setFormData(prev => ({
      ...prev,
      owners: [...(prev.owners || []), { name: '', cccd: '', address: '', phone: '' }]
    }));
  };

  const removeOwner = (index: number) => {
    setFormData(prev => ({
      ...prev,
      owners: prev.owners.filter((_, idx) => idx !== index)
    }));
  };

  const updateOwner = (index: number, field: keyof DangKyParty, value: string) => {
    setFormData(prev => {
      const nextOwners = [...prev.owners];
      nextOwners[index] = { ...nextOwners[index], [field]: value };
      const updated = { ...prev, owners: nextOwners };
      // Nếu KHÔNG tích chọn "Người nộp là chủ" -> người nộp chính là người đứng tên GCN
      if (index === 0 && !prev.applicantIsOwner) {
        if (field === 'name') updated.applicantName = value;
        if (field === 'cccd') updated.applicantCccd = value;
        if (field === 'phone') updated.applicantPhone = value;
        if (field === 'address') updated.applicantAddress = value;
      }
      return updated;
    });
  };

  // Transferees Handlers
  const addTransferee = () => {
    setFormData(prev => ({
      ...prev,
      transferees: [...(prev.transferees || []), { name: '', cccd: '', address: '', phone: '' }]
    }));
  };

  const removeTransferee = (index: number) => {
    setFormData(prev => ({
      ...prev,
      transferees: (prev.transferees || []).filter((_, idx) => idx !== index)
    }));
  };

  const updateTransferee = (index: number, field: keyof DangKyParty, value: string) => {
    setFormData(prev => {
      const nextTf = [...(prev.transferees || [])];
      nextTf[index] = { ...nextTf[index], [field]: value };
      const updated = { ...prev, transferees: nextTf };
      // Nếu ĐANG TÍCH "Người nộp là chủ" -> người nộp chính là người nhận quyền đầu tiên
      if (index === 0 && prev.applicantIsOwner) {
        if (field === 'name') updated.applicantName = value;
        if (field === 'cccd') updated.applicantCccd = value;
        if (field === 'phone') updated.applicantPhone = value;
        if (field === 'address') updated.applicantAddress = value;
      }
      return updated;
    });
  };

  // Attached Documents Handlers
  const addAttachedDoc = () => {
    setAttachedDocs(prev => [...prev, { name: '', type: 'Bản chính' }]);
  };

  const removeAttachedDoc = (index: number) => {
    setAttachedDocs(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateAttachedDoc = (index: number, field: keyof AttachedDoc, value: string) => {
    setAttachedDocs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Submit Handler
  const executeSave = async () => {
    if (!formData.code.trim()) {
      alert('Vui lòng nhập Mã hồ sơ!');
      return;
    }
    if (!formData.ward || !formData.ward.trim()) {
      alert('Vui lòng chọn Xã / Phường cho hồ sơ!');
      return;
    }

    setIsSubmitting(true);
    try {
      const isSingleParty = isNoTransfereeProcedure(formData.recordType, formData.code);
      const recordToSave: DangKyRecord = {
        ...formData,
        transferees: isSingleParty ? [] : (formData.transferees || []),
        applicantIsOwner: isSingleParty ? false : !!formData.applicantIsOwner,
        attachedDocs: attachedDocs,
        attachedDocuments: attachedDocs,
        updatedAt: new Date().toISOString()
      };

      // Nếu người nộp trống ở thủ tục đơn phương, tự lấy theo chủ hồ sơ
      if (isSingleParty && !recordToSave.applicantName && recordToSave.owners?.[0]?.name) {
        recordToSave.applicantName = recordToSave.owners[0].name;
        recordToSave.applicantCccd = recordToSave.owners[0].cccd || '';
        recordToSave.applicantPhone = recordToSave.owners[0].phone || '';
        recordToSave.applicantAddress = recordToSave.owners[0].address || '';
      }

      // Gán cán bộ tiếp nhận nếu là thêm mới hoặc chưa có
      if (!initialData || !recordToSave.receivedBy) {
        recordToSave.receivedBy = recordToSave.receivedBy || currentUser?.fullName || currentUser?.name || currentUser?.username || '';
      }

      await onSave(recordToSave);
      const ownerNames = recordToSave.owners?.map(o => o.name).filter(Boolean).join(', ') || recordToSave.owners?.[0]?.name || '';
      addActivityLog({
        performerName: currentUser?.fullName || currentUser?.name || currentUser?.username || 'Cán bộ Đăng ký',
        performerRole: currentUser?.role || 'DANGKY',
        actionType: initialData ? 'UPDATE' : 'CREATE',
        actionLabel: initialData ? 'Cập nhật' : 'Tiếp nhận mới',
        targetType: 'Đăng ký',
        referenceCode: recordToSave.code,
        details: `${initialData ? 'Cập nhật thông tin' : 'Tiếp nhận mới'} hồ sơ Đăng ký ${recordToSave.code}${ownerNames ? ` - ${ownerNames}` : ''}`,
        recordId: recordToSave.id
      });
      onClose();
    } catch (err) {
      console.error('Error saving record:', err);
      alert('Có lỗi xảy ra khi lưu hồ sơ!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-xs animate-fade-in">
      <div className="bg-slate-100 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-3.5 bg-white text-slate-900 flex justify-between items-center shrink-0 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ClipboardList size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 tracking-wide">
                {initialData ? `CẬP NHẬT HỒ SƠ: ${initialData.code}` : 'TIẾP NHẬN HỒ SƠ MỚI (ĐĂNG KÝ)'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Nhập đầy đủ các thông tin bên dưới để lưu hồ sơ vào hệ thống</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 sm:space-y-5 bg-slate-50">

          {/* 1. THÔNG TIN CHUNG */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5 border-b pb-2 border-slate-100">
              <span className="p-1 bg-blue-100 text-blue-600 rounded-md">
                <Calendar size={14} />
              </span>
              THÔNG TIN CHUNG
            </h3>
            
            <div className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-end">
                <div>
                  <label className={labelClass}>
                    Mã hồ sơ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code || ''}
                    onChange={e => handleFieldChange('code', e.target.value)}
                    className={`${inputClass} font-mono font-bold text-blue-700 bg-blue-50/20`}
                    placeholder="HS-2026-985"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className={`${labelClass} flex items-center gap-1`}>
                    Loại hồ sơ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={getShortRecordType(formData.recordType, formData.code) || ''}
                    onChange={e => handleFieldChange('recordType', e.target.value)}
                    className={`${inputClass} font-semibold`}
                  >
                    <option value="">-- Chọn loại hồ sơ --</option>
                    {DANG_KY_RECORD_TYPES.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className={labelClass}>Trạng thái</label>
                  <select
                    value={formData.status || 'Tiếp nhận mới'}
                    onChange={e => handleFieldChange('status', e.target.value as DangKyStatusType)}
                    className={`${inputClass} font-bold bg-amber-50/80 border-amber-300 text-amber-900`}
                  >
                    {getValidStatusesForDangKyRecord(formData.recordType, formData.code).map(st => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Ngày nhận</label>
                  <input
                    type="date"
                    value={formData.receivedDate ? formData.receivedDate.split('T')[0] : ''}
                    onChange={e => handleFieldChange('receivedDate', e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={`${labelClass} text-red-600 font-bold`}>
                    Hẹn trả <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.deadline ? formData.deadline.split('T')[0] : ''}
                    onChange={e => handleFieldChange('deadline', e.target.value)}
                    className={`${inputClass} bg-pink-50/90 border-pink-200 text-red-600 font-bold`}
                  />
                </div>
              </div>
            </div>

            {/* Các mốc ngày tháng theo trạng thái xử lý (Chỉ hiển thị khi đến hoặc qua bước VÀ quy trình có bước đó) */}
            {(() => {
              const currentStepLevel = getStepLevel(formData.status);
              if (currentStepLevel < 1) return null;

              const procKey = formData.recordType;
              const hasThamDinh = isStepActiveInProcedure(procKey, 'tham_dinh');
              const hasPhieuChuyen = isStepActiveInProcedure(procKey, 'phieu_chuyen') || isStepActiveInProcedure(procKey, 'phieu_chuyen_thue');
              const hasThueKV7 = isStepActiveInProcedure(procKey, 'chuyen_thue_kv7') || isStepActiveInProcedure(procKey, 'thue_kv7');
              const hasGiayNopTien = isStepActiveInProcedure(procKey, 'giay_nop_tien') || isStepActiveInProcedure(procKey, 'thong_bao_thue');
              const hasInGCN = isStepActiveInProcedure(procKey, 'in_gcn');
              const hasKiemTra = isStepActiveInProcedure(procKey, 'kiem_tra');
              const hasTrinhKy = isStepActiveInProcedure(procKey, 'trinh_ky');

              return (
                <div className="pt-3 border-t border-slate-100 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                    {/* Step 1: Ngày thẩm định */}
                    {hasThamDinh && currentStepLevel >= 1 && (
                      <div>
                        <label className="block text-xs font-bold text-teal-800 mb-1">Ngày thẩm định</label>
                        <input
                          type="date"
                          value={formData.appraisalDate ? formData.appraisalDate.split('T')[0] : ''}
                          onChange={e => handleFieldChange('appraisalDate', e.target.value)}
                          className="w-full border border-teal-300 bg-teal-50/80 text-teal-800 font-medium rounded-lg px-3 py-1.5 text-xs sm:text-sm outline-none shadow-2xs"
                        />
                      </div>
                    )}

                    {/* Step 2: Ngày phiếu chuyển thuế */}
                    {hasPhieuChuyen && currentStepLevel >= 2 && (
                      <div>
                        <label className="block text-xs font-bold text-amber-800 mb-1">Ngày phiếu chuyển thuế</label>
                        <input
                          type="date"
                          value={formData.taxFormDate ? formData.taxFormDate.split('T')[0] : ''}
                          onChange={e => handleFieldChange('taxFormDate', e.target.value)}
                          className="w-full border border-amber-300 bg-amber-50/80 text-amber-800 font-medium rounded-lg px-3 py-1.5 text-xs sm:text-sm outline-none shadow-2xs"
                        />
                      </div>
                    )}

                    {/* Step 3: Ngày chuyển Thuế KV7 */}
                    {hasThueKV7 && currentStepLevel >= 3 && (
                      <div>
                        <label className="block text-xs font-bold text-orange-800 mb-1">Ngày chuyển Thuế KV7</label>
                        <input
                          type="date"
                          value={formData.taxKV7TransferDate ? formData.taxKV7TransferDate.split('T')[0] : ''}
                          onChange={e => handleFieldChange('taxKV7TransferDate', e.target.value)}
                          className="w-full border border-orange-300 bg-orange-50/80 text-orange-800 font-medium rounded-lg px-3 py-1.5 text-xs sm:text-sm outline-none shadow-2xs"
                        />
                      </div>
                    )}

                    {/* Step 4: Ngày giấy nộp tiền / TBT */}
                    {hasGiayNopTien && currentStepLevel >= 4 && (
                      <div>
                        <label className="block text-xs font-bold text-rose-800 mb-1">Ngày giấy nộp tiền</label>
                        <input
                          type="date"
                          value={formData.taxNoticeDate ? formData.taxNoticeDate.split('T')[0] : (formData.taxPaymentReceiptDate ? formData.taxPaymentReceiptDate.split('T')[0] : '')}
                          onChange={e => {
                            handleFieldChange('taxNoticeDate', e.target.value);
                            handleFieldChange('taxPaymentReceiptDate', e.target.value);
                          }}
                          className="w-full border border-rose-300 bg-rose-50/80 text-rose-800 font-medium rounded-lg px-3 py-1.5 text-xs sm:text-sm outline-none shadow-2xs"
                        />
                      </div>
                    )}

                    {/* Step 5: Ngày in GCN */}
                    {hasInGCN && currentStepLevel >= 5 && (
                      <div>
                        <label className="block text-xs font-bold text-purple-800 mb-1">Ngày in GCN</label>
                        <input
                          type="date"
                          value={formData.printDate ? formData.printDate.split('T')[0] : ''}
                          onChange={e => handleFieldChange('printDate', e.target.value)}
                          className="w-full border border-purple-300 bg-purple-50/80 text-purple-800 font-medium rounded-lg px-3 py-1.5 text-xs sm:text-sm outline-none shadow-2xs"
                        />
                      </div>
                    )}

                    {/* Step 6: Ngày trình kiểm tra */}
                    {hasKiemTra && currentStepLevel >= 6 && (
                      <div>
                        <label className="block text-xs font-bold text-blue-800 mb-1">Ngày trình kiểm tra</label>
                        <input
                          type="date"
                          value={formData.pendingCheckDate ? formData.pendingCheckDate.split('T')[0] : ''}
                          onChange={e => handleFieldChange('pendingCheckDate', e.target.value)}
                          className="w-full border border-blue-300 bg-blue-50/80 text-blue-800 font-medium rounded-lg px-3 py-1.5 text-xs sm:text-sm outline-none shadow-2xs"
                        />
                      </div>
                    )}

                    {/* Step 7: Ngày trình ký */}
                    {hasTrinhKy && currentStepLevel >= 7 && (
                      <div>
                        <label className="block text-xs font-bold text-purple-800 mb-1">Ngày trình ký</label>
                        <input
                          type="date"
                          value={formData.submissionDate ? formData.submissionDate.split('T')[0] : ''}
                          onChange={e => handleFieldChange('submissionDate', e.target.value)}
                          className="w-full border border-purple-300 bg-purple-50/80 text-purple-800 font-medium rounded-lg px-3 py-1.5 text-xs sm:text-sm outline-none shadow-2xs"
                        />
                      </div>
                    )}

                    {/* Step 8: Ngày ký duyệt */}
                    {currentStepLevel >= 8 && (
                      <div>
                        <label className="block text-xs font-bold text-indigo-800 mb-1">Ngày ký duyệt</label>
                        <input
                          type="date"
                          value={formData.approvalDate ? formData.approvalDate.split('T')[0] : ''}
                          onChange={e => handleFieldChange('approvalDate', e.target.value)}
                          className="w-full border border-indigo-300 bg-indigo-50/80 text-indigo-800 font-medium rounded-lg px-3 py-1.5 text-xs sm:text-sm outline-none shadow-2xs"
                        />
                      </div>
                    )}

                    {/* Step 8: Ngày hoàn thành */}
                    {currentStepLevel >= 8 && (
                      <div>
                        <label className="block text-xs font-bold text-emerald-800 mb-1">Ngày hoàn thành</label>
                        <input
                          type="date"
                          value={formData.completedDate ? formData.completedDate.split('T')[0] : ''}
                          onChange={e => handleFieldChange('completedDate', e.target.value)}
                          className="w-full border border-emerald-300 bg-emerald-50/80 text-emerald-800 font-bold rounded-lg px-3 py-1.5 text-xs sm:text-sm outline-none shadow-2xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ĐỢT XUẤT (BATCH), NGÀY XUẤT, PHI ĐỊA GIỚI (Image 3) */}
          {(getStepLevel(formData.status) >= 9 || formData.exportBatch) && (
            <div className="bg-indigo-50/50 p-3.5 sm:p-4 rounded-xl border border-indigo-200/80 shadow-2xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-indigo-900 mb-1 uppercase">ĐỢT XUẤT (BATCH)</label>
                  <input
                    type="text"
                    value={formData.exportBatch || ''}
                    onChange={e => handleFieldChange('exportBatch', e.target.value)}
                    className="w-full border border-indigo-200 rounded-lg px-3 py-1.5 text-xs sm:text-sm outline-none font-bold text-indigo-900 bg-white"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-900 mb-1 uppercase">NGÀY XUẤT</label>
                  <input
                    type="date"
                    value={formData.exportDate ? formData.exportDate.split('T')[0] : ''}
                    onChange={e => handleFieldChange('exportDate', e.target.value)}
                    className="w-full border border-indigo-200 rounded-lg px-3 py-1.5 text-xs sm:text-sm outline-none font-medium text-indigo-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-indigo-900 mb-1 uppercase">PHI ĐỊA GIỚI</label>
                  <select
                    value={formData.handoverWard || formData.ward || ''}
                    onChange={e => handleFieldChange('handoverWard', e.target.value)}
                    className="w-full border border-indigo-200 rounded-lg px-3 py-1.5 text-xs sm:text-sm outline-none font-medium text-indigo-900 bg-white cursor-pointer"
                  >
                    <option value="">-- Chọn Phi địa giới --</option>
                    {wards.map(w => (
                      <option key={w} value={w}>{w.replace(/^Xã\s+/i, '')}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TRẢ KẾT QUẢ CHO DÂN (Image 3) */}
          {(getStepLevel(formData.status) >= 10 || formData.resultReturnedDate) && (
            <div className="bg-emerald-50/50 p-3.5 sm:p-4 rounded-xl border border-emerald-300/80 shadow-2xs">
              <label className="text-xs sm:text-sm font-bold text-emerald-900 uppercase mb-2 flex items-center gap-1.5">
                <span className="p-1 bg-emerald-100 text-emerald-700 rounded-md"><FileCheck size={14} /></span>
                TRẢ KẾT QUẢ CHO DÂN
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">Ngày trả kết quả</label>
                  <input
                    type="date"
                    value={formData.resultReturnedDate ? formData.resultReturnedDate.split('T')[0] : ''}
                    onChange={e => handleFieldChange('resultReturnedDate', e.target.value)}
                    className="w-full border border-emerald-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold text-emerald-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">Số Biên lai / Hóa đơn</label>
                  <input
                    type="text"
                    value={formData.receiptNumber || formData.invoiceNumber || ''}
                    onChange={e => handleFieldChange('receiptNumber', e.target.value)}
                    className="w-full border border-emerald-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold text-emerald-900 bg-white font-mono"
                    placeholder="000112006"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">Số tiền (VNĐ)</label>
                  <input
                    type="number"
                    value={formData.feeAmount || 0}
                    onChange={e => handleFieldChange('feeAmount', e.target.value ? Number(e.target.value) : 0)}
                    className="w-full border border-emerald-300 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-bold text-emerald-900 bg-white font-mono"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. THÔNG TIN NGƯỜI NỘP HỒ SƠ */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between border-b pb-2 mb-3 border-slate-100">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <span className="p-1 bg-blue-100 text-blue-600 rounded-md">
                  <UserIcon size={14} />
                </span>
                THÔNG TIN NGƯỜI NỘP HỒ SƠ
              </h3>
              {!isNoTransfereeProcedure(formData.recordType, formData.code) && (
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-blue-700 hover:text-blue-900 select-none">
                  <input
                    type="checkbox"
                    checked={!!formData.applicantIsOwner}
                    onChange={e => handleApplicantIsOwnerToggle(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  Người nộp là chủ hồ sơ
                </label>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>
                  Họ và tên người nộp <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.applicantName || ''}
                  onChange={e => handleApplicantFieldChange('applicantName', e.target.value)}
                  className={inputClass}
                  placeholder="Họ và tên..."
                />
              </div>

              <div>
                <label className={labelClass}>
                  CCCD/Số Giấy <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.applicantCccd || ''}
                  onChange={e => handleApplicantFieldChange('applicantCccd', e.target.value)}
                  className={`${inputClass} font-mono`}
                  placeholder="CCCD..."
                />
              </div>

              <div>
                <label className={labelClass}>
                  SĐT người nộp <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.applicantPhone || ''}
                  onChange={e => handleApplicantFieldChange('applicantPhone', e.target.value)}
                  className={inputClass}
                  placeholder="Số điện thoại..."
                />
              </div>

              <div className="md:col-span-3">
                <label className={labelClass}>
                  Địa chỉ thường trú <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.applicantAddress || ''}
                  onChange={e => handleApplicantFieldChange('applicantAddress', e.target.value)}
                  className={inputClass}
                  placeholder="Nhập địa chỉ thường trú..."
                />
              </div>
            </div>
          </div>

          {/* 3. VỊ TRÍ & THỬA ĐẤT */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-3 flex items-center gap-1.5 border-b pb-2 border-slate-100">
              <span className="p-1 bg-green-100 text-green-600 rounded-md">
                <MapPin size={14} />
              </span>
              VỊ TRÍ & THỬA ĐẤT
            </h3>
            
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className={labelClass}>
                    Xã / Phường <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.ward || ''}
                    onChange={e => handleFieldChange('ward', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">-- Chọn Xã/Phường --</option>
                    {wards.map(w => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`${labelClass} text-purple-700`}>Số seri GCN</label>
                  <input
                    type="text"
                    value={formData.issueNumber || ''}
                    onChange={e => handleFieldChange('issueNumber', e.target.value)}
                    className={`${inputClass} font-mono font-bold text-purple-900 bg-purple-50/30`}
                    placeholder="VD: CP 123456"
                  />
                </div>

                <div>
                  <label className={labelClass}>Số vào sổ</label>
                  <input
                    type="text"
                    value={formData.entryNumber || ''}
                    onChange={e => handleFieldChange('entryNumber', e.target.value)}
                    className={inputClass}
                    placeholder="VD: CH 01234"
                  />
                </div>

                <div>
                  <label className={labelClass}>Ngày cấp</label>
                  <input
                    type="date"
                    value={formData.issueDate ? formData.issueDate.split('T')[0] : ''}
                    onChange={e => handleFieldChange('issueDate', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className={labelClass}>Tờ bản đồ</label>
                  <input
                    type="text"
                    value={formData.mapSheet || ''}
                    onChange={e => handleFieldChange('mapSheet', e.target.value)}
                    className={`${inputClass} font-mono`}
                    placeholder="Tờ bản đồ"
                  />
                </div>

                <div>
                  <label className={labelClass}>Thửa đất</label>
                  <input
                    type="text"
                    value={formData.landPlot || ''}
                    onChange={e => handleFieldChange('landPlot', e.target.value)}
                    className={`${inputClass} font-mono`}
                    placeholder="Thửa đất"
                  />
                </div>

                <div>
                  <label className={labelClass}>Diện tích (m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.totalArea ?? 0}
                    onChange={e => handleFieldChange('totalArea', e.target.value ? Number(e.target.value) : 0)}
                    className={`${inputClass} font-mono text-right`}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className={labelClass}>ONT/ODT (m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.residentialArea ?? 0}
                    onChange={e => handleFieldChange('residentialArea', e.target.value ? Number(e.target.value) : 0)}
                    className={`${inputClass} font-mono text-right`}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. NGƯỜI ĐỨNG TÊN GCN */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between border-b pb-2 mb-3 border-slate-100">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <span className="p-1 bg-blue-100 text-blue-600 rounded-md">
                  <Users size={14} />
                </span>
                NGƯỜI ĐỨNG TÊN GCN
              </h3>
              <button
                type="button"
                onClick={addOwner}
                className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md border border-blue-200 hover:bg-blue-100 font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                <Plus size={14} /> THÊM MỚI
              </button>
            </div>
            
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse bg-white text-xs sm:text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2 px-2.5 w-10 text-center">#</th>
                    <th className="py-2 px-2.5">HỌ TÊN NGƯỜI ĐỨNG TÊN GCN <span className="text-red-500">*</span></th>
                    <th className="py-2 px-2.5">GIẤY CMND/ CCCD <span className="text-red-500">*</span></th>
                    <th className="py-2 px-2.5">SỐ ĐIỆN THOẠI</th>
                    <th className="py-2 px-2.5 w-10 text-center">XÓA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {formData.owners.map((owner, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-1.5 px-2.5">
                        <input
                          type="text"
                          required
                          value={owner.name}
                          onChange={e => updateOwner(idx, 'name', e.target.value)}
                          className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none text-slate-800 font-medium"
                          placeholder="Họ tên..."
                        />
                      </td>
                      <td className="py-1.5 px-2.5">
                        <input
                          type="text"
                          value={owner.cccd || ''}
                          onChange={e => updateOwner(idx, 'cccd', e.target.value)}
                          className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none font-mono text-slate-800"
                          placeholder="CCCD..."
                        />
                      </td>
                      <td className="py-1.5 px-2.5">
                        <input
                          type="text"
                          value={owner.phone || ''}
                          onChange={e => updateOwner(idx, 'phone', e.target.value)}
                          className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none text-slate-800"
                          placeholder="SĐT..."
                        />
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeOwner(idx)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Xóa dòng"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. NGƯỜI NHẬN (CHUYỂN NHƯỢNG, THỪA KẾ, TẶNG CHO, THỎA THUẬN) (NẾU CÓ) - Ẩn đối với các thủ tục không có bên nhận */}
          {!isNoTransfereeProcedure(formData.recordType, formData.code) && (
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between border-b pb-2 mb-3 border-slate-100">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <span className="p-1 bg-blue-100 text-blue-600 rounded-md">
                    <UserPlus size={14} />
                  </span>
                  NGƯỜI NHẬN (CHUYỂN NHƯỢNG, THỪA KẾ, TẶNG CHO, THỎA THUẬN) (NẾU CÓ)
                </h3>
                <button
                  type="button"
                  onClick={addTransferee}
                  className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md border border-blue-200 hover:bg-blue-100 font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                >
                  <Plus size={14} /> THÊM MỚI
                </button>
              </div>
              
              {(formData.transferees || []).length === 0 ? (
                <div className="text-center py-3 text-xs text-slate-400 italic bg-slate-50/80 rounded-lg border border-dashed border-slate-200">
                  Không có người nhận (Click nút "+ THÊM MỚI" để nhập liệu).
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse bg-white text-xs sm:text-sm min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-2 px-2.5 w-10 text-center">#</th>
                        <th className="py-2 px-2.5">HỌ VÀ TÊN NGƯỜI NHẬN CHUYỂN NHƯỢNG</th>
                        <th className="py-2 px-2.5">GIẤY CMND/ CCCD</th>
                        <th className="py-2 px-2.5">SỐ ĐIỆN THOẠI</th>
                        <th className="py-2 px-2.5 w-10 text-center">XÓA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {formData.transferees.map((tf, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-1.5 px-2.5">
                            <input
                              type="text"
                              value={tf.name}
                              onChange={e => updateTransferee(idx, 'name', e.target.value)}
                              className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none text-slate-800 font-medium"
                              placeholder="Họ tên..."
                            />
                          </td>
                          <td className="py-1.5 px-2.5">
                            <input
                              type="text"
                              value={tf.cccd || ''}
                              onChange={e => updateTransferee(idx, 'cccd', e.target.value)}
                              className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none font-mono text-slate-800"
                              placeholder="CCCD..."
                            />
                          </td>
                          <td className="py-1.5 px-2.5">
                            <input
                              type="text"
                              value={tf.phone || ''}
                              onChange={e => updateTransferee(idx, 'phone', e.target.value)}
                              className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none text-slate-800"
                              placeholder="SĐT..."
                            />
                          </td>
                          <td className="py-1.5 px-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeTransferee(idx)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Xóa dòng"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* NỘI DUNG YÊU CẦU CHI TIẾT */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-2 flex items-center gap-1.5 border-b pb-2 border-slate-100">
              <span className="p-1 bg-purple-100 text-purple-600 rounded-md">
                <FileText size={14} />
              </span>
              NỘI DUNG YÊU CẦU CHI TIẾT
            </h3>
            <AutoResizeTextarea
              value={formData.notes || ''}
              onChange={e => handleFieldChange('notes', e.target.value)}
              className={`${inputClass} font-medium leading-relaxed`}
              minRows={1}
              placeholder="Nhập nội dung yêu cầu chi tiết của hồ sơ..."
            />
          </div>

          {/* 6. GIẤY TỜ KÈM THEO */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between border-b pb-2 mb-3 border-slate-100">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <span className="p-1 bg-teal-100 text-teal-600 rounded-md">
                  <FileText size={14} />
                </span>
                Giấy tờ kèm theo
              </h3>
              <button
                type="button"
                onClick={addAttachedDoc}
                className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-md border border-blue-200 hover:bg-blue-100 font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                + THÊM GIẤY TỜ
              </button>
            </div>
            
            {attachedDocs.length === 0 ? (
              <div className="text-center py-3 text-xs text-slate-400 italic bg-slate-50/80 rounded-lg border border-dashed border-slate-200">
                Chưa có giấy tờ kèm theo nào. (Nhấn "+ THÊM GIẤY TỜ" để thêm)
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse bg-white text-xs sm:text-sm min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3">TÊN GIẤY TỜ</th>
                      <th className="py-2 px-3 w-44 text-center">HÌNH THỨC</th>
                      <th className="py-2 px-3 w-12 text-center">XÓA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                    {attachedDocs.map((doc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={doc.name}
                            onChange={e => updateAttachedDoc(idx, 'name', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none text-slate-800 font-medium bg-white"
                            placeholder="Nhập tên giấy tờ..."
                          />
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-700">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`attachedDocType-${idx}`}
                                checked={doc.type === 'Bản chính' || doc.type === 'Chính'}
                                onChange={() => updateAttachedDoc(idx, 'type', 'Bản chính')}
                                className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              Chính
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`attachedDocType-${idx}`}
                                checked={doc.type === 'Bản sao' || doc.type === 'Sao' || doc.type === 'Bản sao công chứng' || doc.type === 'Bản photo'}
                                onChange={() => updateAttachedDoc(idx, 'type', 'Bản sao')}
                                className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              Sao
                            </label>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeAttachedDoc(idx)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Xóa dòng"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 7. THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN (NẾU CÓ) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
            <div 
              onClick={() => setShowAuthorizedSection(!showAuthorizedSection)}
              className="p-3.5 sm:p-4 flex items-center justify-between gap-2 bg-white rounded-xl cursor-pointer select-none hover:bg-slate-50/80 transition-colors"
            >
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5 cursor-pointer">
                <span className="p-1 bg-indigo-100 text-indigo-600 rounded-md">
                  <Shield size={14} />
                </span>
                THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN (NẾU CÓ)
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAuthorizedSection(!showAuthorizedSection);
                }}
                className="text-xs font-bold uppercase rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 py-1 text-slate-600 bg-white shadow-xs cursor-pointer"
              >
                {showAuthorizedSection ? '▲ ẨN' : '▼ HIỆN'}
              </button>
            </div>
            
            {showAuthorizedSection && (
              <div className="p-3.5 sm:p-4 bg-slate-50/50 space-y-3 animate-fade-in border-t border-slate-100 rounded-b-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className={labelClass}>Người được ủy quyền</label>
                    <input
                      type="text"
                      value={formData.authorizedPersonName || ''}
                      onChange={e => handleFieldChange('authorizedPersonName', e.target.value)}
                      className={inputClass}
                      placeholder="Họ tên người được ủy quyền..."
                    />
                  </div>

                  <div>
                    <label className={labelClass}>SĐT người được ủy quyền</label>
                    <input
                      type="text"
                      value={formData.authorizedPersonPhone || ''}
                      onChange={e => handleFieldChange('authorizedPersonPhone', e.target.value)}
                      className={inputClass}
                      placeholder="Số điện thoại..."
                    />
                  </div>

                  <div>
                    <label className={labelClass}>CCCD/Số Giấy</label>
                    <input
                      type="text"
                      value={formData.authorizedPersonId || ''}
                      onChange={e => handleFieldChange('authorizedPersonId', e.target.value)}
                      className={`${inputClass} font-mono`}
                      placeholder="Số CCCD..."
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Địa chỉ thường trú</label>
                    <input
                      type="text"
                      value={formData.authorizedPersonAddress || ''}
                      onChange={e => handleFieldChange('authorizedPersonAddress', e.target.value)}
                      className={inputClass}
                      placeholder="Địa chỉ thường trú..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* THÔNG TIN XỬ LÝ & TRẢ KẾT QUẢ THEO GIAO DIỆN MỚI */}
          <div className="space-y-3.5 pt-2">
            {/* HÀNG 2 CỘT: GIAO NHÂN VIÊN XỬ LÝ & SỐ PHIẾU BÁO */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">
                    GIAO NHÂN VIÊN XỬ LÝ (TỔ CẤP GIẤY)
                  </label>
                  <select
                    value={formData.assignedTo || ''}
                    onChange={e => handleFieldChange('assignedTo', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none shadow-2xs"
                  >
                    <option value="">-- Chưa giao --</option>
                    {(
                      employees.filter(e => !e.department || e.department.toLowerCase().includes('cấp giấy') || e.department.toLowerCase().includes('cap giay') || e.department.toLowerCase().includes('đăng ký') || e.department.toLowerCase().includes('dang ky')).length > 0
                        ? employees.filter(e => !e.department || e.department.toLowerCase().includes('cấp giấy') || e.department.toLowerCase().includes('cap giay') || e.department.toLowerCase().includes('đăng ký') || e.department.toLowerCase().includes('dang ky'))
                        : employees
                    ).map(e => (
                      <option key={e.id} value={e.name}>{e.name} {e.department ? `(${e.department})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-amber-900 uppercase mb-1.5 block">
                    SỐ PHIẾU BÁO
                  </label>
                  <input
                    type="text"
                    value={formData.taxFormNumber || ''}
                    onChange={e => handleFieldChange('taxFormNumber', e.target.value)}
                    className="w-full px-3 py-2 bg-amber-50/30 border border-amber-300 rounded-lg text-xs sm:text-sm font-mono font-bold text-amber-950 focus:border-amber-500 outline-none"
                    placeholder="VD: 123/PCTT"
                  />
                </div>
              </div>
            </div>

            {/* CHỈ HIỂN THỊ CÁC KHỐI THÔNG TIN MỞ RỘNG KHI CẬP NHẬT HỒ SƠ (KHÔNG HIỆN Ở TIẾP NHẬN MỚI) */}
            {initialData && (
              <>
                {/* GHI CHÚ NỘI BỘ (Khung viền vàng nổi bật) */}
                <div className="bg-amber-50/40 p-3.5 sm:p-4 rounded-xl border border-amber-200 shadow-2xs">
                  <label className="text-xs sm:text-sm font-bold text-amber-900 uppercase mb-2 flex items-center gap-1.5">
                    <span className="text-amber-600">🔒</span> GHI CHÚ NỘI BỘ
                  </label>
                  <AutoResizeTextarea
                    value={formData.privateNotes || ''}
                    onChange={e => {
                      handleFieldChange('privateNotes', e.target.value);
                    }}
                    className="w-full p-2.5 border border-amber-300/80 rounded-lg text-xs sm:text-sm outline-none focus:border-amber-500 font-medium text-slate-800 bg-white leading-relaxed"
                    minRows={1}
                    placeholder="Nhập ghi chú nội bộ..."
                  />
                </div>

                {/* HÀNG 3 CỘT: ĐỢT XUẤT, NGÀY XUẤT, PHI ĐỊA GIỚI */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-blue-100/80 shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] sm:text-xs font-bold text-blue-900 uppercase mb-1.5 block">
                        ĐỢT XUẤT (BATCH)
                      </label>
                      <input
                        type="text"
                        value={formData.exportBatch || ''}
                        onChange={e => handleFieldChange('exportBatch', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs sm:text-sm font-semibold text-blue-900 focus:border-blue-500 outline-none"
                        placeholder="VD: 1, 2, 3..."
                      />
                    </div>

                    <div>
                      <label className="text-[11px] sm:text-xs font-bold text-blue-900 uppercase mb-1.5 block">
                        NGÀY XUẤT
                      </label>
                      <input
                        type="date"
                        value={formData.exportDate ? formData.exportDate.split('T')[0] : ''}
                        onChange={e => handleFieldChange('exportDate', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] sm:text-xs font-bold text-blue-900 uppercase mb-1.5 block">
                        PHI ĐỊA GIỚI
                      </label>
                      <select
                        value={formData.handoverWard || formData.nonBoundaryWard || ''}
                        onChange={e => {
                          const val = e.target.value;
                          if (!val) {
                            handleFieldChange('isNonBoundary', false);
                            handleFieldChange('nonBoundaryWard', '');
                            handleFieldChange('handoverWard', '');
                          } else {
                            handleFieldChange('isNonBoundary', true);
                            handleFieldChange('nonBoundaryWard', val);
                            handleFieldChange('handoverWard', val);
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-xs sm:text-sm font-semibold text-blue-900 focus:border-blue-500 outline-none"
                      >
                        <option value="">-- Không (Theo địa chỉ thửa đất) --</option>
                        {wards.map(w => (
                          <option key={w} value={w}>
                            {w.replace(/^Xã\s+/i, '')}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* TRẢ KẾT QUẢ CHO DÂN (Khung xanh lá) */}
                <div className="bg-emerald-50/40 p-3.5 sm:p-4 rounded-xl border border-emerald-200 shadow-2xs">
                  <label className="text-xs sm:text-sm font-bold text-emerald-900 uppercase mb-3 flex items-center gap-1.5">
                    <span className="text-emerald-600">📄</span> TRẢ KẾT QUẢ CHO DÂN
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] sm:text-xs font-bold text-emerald-800 mb-1.5 block">
                        Ngày trả kết quả
                      </label>
                      <input
                        type="date"
                        value={formData.deliveryDate ? formData.deliveryDate.split('T')[0] : ''}
                        onChange={e => handleFieldChange('deliveryDate', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-emerald-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] sm:text-xs font-bold text-emerald-800 mb-1.5 block">
                        Số Biên lai / Hóa đơn
                      </label>
                      <input
                        type="text"
                        value={formData.receiptNumber || ''}
                        onChange={e => handleFieldChange('receiptNumber', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:border-emerald-500 outline-none"
                        placeholder="Nhập số biên lai/hóa đơn..."
                      />
                    </div>

                    <div>
                      <label className="text-[11px] sm:text-xs font-bold text-emerald-800 mb-1.5 block">
                        Số tiền (VNĐ)
                      </label>
                      <input
                        type="number"
                        value={formData.feeAmount ?? ''}
                        onChange={e => handleFieldChange('feeAmount', e.target.value ? Number(e.target.value) : 0)}
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs sm:text-sm font-mono font-bold text-emerald-950 focus:border-emerald-500 outline-none"
                        placeholder="Số tiền..."
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>

        {/* STICKY BOTTOM ACTION BAR */}
        <div className="sticky bottom-0 left-0 right-0 z-20 bg-slate-50/95 backdrop-blur-md border-t border-slate-200 py-2.5 px-4 sm:px-6 flex items-center justify-end gap-2.5 shadow-md rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shadow-xs text-xs sm:text-sm font-bold border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <XCircle size={16} className="text-red-500" /> Hủy bỏ
          </button>
          
          <button
            type="button"
            disabled={isSubmitting}
            onClick={executeSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md text-xs sm:text-sm font-bold transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Save size={16} />
            {isSubmitting ? 'Đang lưu...' : 'LƯU HỒ SƠ'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default DangKyRecordModal;
