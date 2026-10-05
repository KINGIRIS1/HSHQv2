import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  User,
  Search,
  FileText,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  Check,
  CheckCircle2,
  Send,
  Printer,
  Shield,
  Layers,
  CreditCard,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import { RecordFile, Employee, RecordStatus, AttachedFileMeta, DossierComponentItem, User as AppUser } from '../../types';
import { removeVietnameseTones } from '../../utils/appHelpers';

export interface StepHandoverConfig {
  targetStatus: RecordStatus;
  title: string;
  subtitle: string;
  roleTitle: string;
  staffField: 'taxStaff' | 'printStaff' | 'checkedBy' | 'submittedTo' | 'returnedBy' | 'assignedTo' | 'appraisalStaff';
  departmentFilter?: string[];
  icon: React.ReactNode;
  headerBg: string;
}

export const getStepHandoverConfig = (targetStatus: RecordStatus): StepHandoverConfig => {
  switch (targetStatus) {
    case RecordStatus.RECEIVED:
    case RecordStatus.APPRAISAL:
      return {
        targetStatus,
        title: 'Giao Thẩm định hồ sơ',
        subtitle: 'Phân công cán bộ thụ lý chuyên môn thẩm định hồ sơ',
        roleTitle: 'Cán bộ thẩm định',
        staffField: 'appraisalStaff',
        icon: <User size={20} className="text-white" />,
        headerBg: 'bg-gradient-to-r from-blue-600 to-indigo-700',
      };
    case RecordStatus.TAX_TRANSFER:
      return {
        targetStatus,
        title: 'Giao chuyển thuế',
        subtitle: 'Phân công cán bộ lập phiếu chuyển thông tin nghĩa vụ tài chính',
        roleTitle: 'Cán bộ lập phiếu chuyển thuế',
        staffField: 'taxStaff',
        icon: <CreditCard size={20} className="text-white" />,
        headerBg: 'bg-gradient-to-r from-indigo-600 to-blue-700',
      };
    case RecordStatus.PENDING_TAX_KV7:
      return {
        targetStatus,
        title: 'Chuyển Thuế Khu vực 7',
        subtitle: 'Xác nhận chuyển hồ sơ sang Cơ quan Thuế KV7 tính thuế',
        roleTitle: 'Cán bộ theo dõi thuế',
        staffField: 'taxStaff',
        icon: <CreditCard size={20} className="text-white" />,
        headerBg: 'bg-gradient-to-r from-violet-600 to-purple-700',
      };
    case RecordStatus.PENDING_TAX_PAYMENT:
      return {
        targetStatus,
        title: 'Nhận Thông báo thuế (GNT)',
        subtitle: 'Ghi nhận Thông báo nộp tiền và theo dõi công dân nộp thuế',
        roleTitle: 'Cán bộ phụ trách thông báo thuế',
        staffField: 'taxStaff',
        icon: <CreditCard size={20} className="text-white" />,
        headerBg: 'bg-gradient-to-r from-amber-600 to-orange-700',
      };
    case RecordStatus.PENDING_PRINT_CERT:
      return {
        targetStatus,
        title: 'Giao In Giấy chứng nhận (GCN)',
        subtitle: 'Phân công cán bộ in và hoàn thiện phôi Giấy chứng nhận',
        roleTitle: 'Cán bộ In GCN',
        staffField: 'printStaff',
        icon: <Printer size={20} className="text-white" />,
        headerBg: 'bg-gradient-to-r from-blue-700 to-cyan-800',
      };
    case RecordStatus.PENDING_CHECK:
      return {
        targetStatus,
        title: 'Trình Kiểm tra hồ sơ',
        subtitle: 'Phân công Lãnh đạo / Tổ trưởng kiểm tra tính pháp lý hồ sơ',
        roleTitle: 'Cán bộ / Tổ trưởng kiểm tra',
        staffField: 'checkedBy',
        icon: <Shield size={20} className="text-white" />,
        headerBg: 'bg-gradient-to-r from-teal-700 to-emerald-800',
      };
    case RecordStatus.PENDING_SIGN:
      return {
        targetStatus,
        title: 'Trình Ký duyệt hồ sơ',
        subtitle: 'Trình Ban Giám đốc Chi nhánh ký duyệt hồ sơ và GCN',
        roleTitle: 'Lãnh đạo ký duyệt',
        staffField: 'submittedTo',
        departmentFilter: ['Ban Giám đốc', 'Lãnh đạo', 'Giám đốc', 'Phó Giám đốc', 'Cấp giấy'],
        icon: <FileCheck size={20} className="text-white" />,
        headerBg: 'bg-gradient-to-r from-slate-800 to-indigo-900',
      };
    case RecordStatus.SIGNED:
    case RecordStatus.PENDING_HANDOVER:
      return {
        targetStatus,
        title: 'Đã ký duyệt / Chờ bàn giao',
        subtitle: 'Ghi nhận hồ sơ đã được ký duyệt, chuyển chờ giao Một cửa',
        roleTitle: 'Cán bộ tiếp nhận kết quả',
        staffField: 'submittedTo',
        icon: <CheckCircle2 size={20} className="text-white" />,
        headerBg: 'bg-gradient-to-r from-emerald-600 to-teal-700',
      };
    case RecordStatus.RETURNED:
    case RecordStatus.HANDOVER:
      return {
        targetStatus,
        title: 'Bàn giao trả kết quả',
        subtitle: 'Bàn giao hồ sơ và GCN cho Bộ phận Một cửa để trả cho công dân',
        roleTitle: 'Cán bộ Một cửa / Trả kết quả',
        staffField: 'returnedBy',
        icon: <Send size={20} className="text-white" />,
        headerBg: 'bg-gradient-to-r from-emerald-700 to-teal-800',
      };
    case RecordStatus.PENDING_SUPPLEMENT:
      return {
        targetStatus,
        title: 'Yêu cầu bổ sung hồ sơ',
        subtitle: 'Ghi nhận lý do yêu cầu công dân / tổ chức bổ sung giấy tờ',
        roleTitle: 'Cán bộ yêu cầu bổ sung',
        staffField: 'assignedTo',
        icon: <AlertCircle size={20} className="text-white" />,
        headerBg: 'bg-gradient-to-r from-rose-600 to-amber-700',
      };
    default:
      return {
        targetStatus,
        title: 'Chuyển bước nghiệp vụ',
        subtitle: 'Phân công cán bộ thực hiện khâu tiếp theo',
        roleTitle: 'Cán bộ thực hiện',
        staffField: 'assignedTo',
        icon: <Layers size={20} className="text-white" />,
        headerBg: 'bg-gradient-to-r from-blue-600 to-indigo-700',
      };
  }
};

interface RegistrationStepHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: RecordFile | null;
  records?: RecordFile[];
  config: StepHandoverConfig;
  employees: Employee[];
  currentUser?: AppUser | null;
  onConfirm: (payload: {
    targetStatus: RecordStatus;
    selectedStaff: string;
    extraFields: Partial<RecordFile>;
    newAttachments?: AttachedFileMeta[];
    newComponents?: DossierComponentItem[];
    note?: string;
    targetRecords?: RecordFile[];
  }) => Promise<void> | void;
}

export const RegistrationStepHandoverModal: React.FC<RegistrationStepHandoverModalProps> = ({
  isOpen,
  onClose,
  record,
  records,
  config,
  employees,
  currentUser,
  onConfirm,
}) => {
  const targetList: RecordFile[] = useMemo(() => {
    if (records && records.length > 0) return records;
    if (record) return [record];
    return [];
  }, [record, records]);

  const primaryRecord = targetList[0] || null;

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStaffName, setSelectedStaffName] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [components, setComponents] = useState<DossierComponentItem[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileMeta[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Khởi tạo giá trị khi mở modal
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setNote('');
      setErrorMsg('');
      setIsSubmitting(false);

      // Mặc định chọn cán bộ đã có ở bước này hoặc cán bộ đầu tiên
      const currentVal = primaryRecord ? (primaryRecord as any)[config.staffField] || '' : '';
      setSelectedStaffName(currentVal);

      // Thừa kế thành phần hồ sơ và file đính kèm hiện có
      if (primaryRecord && Array.isArray(primaryRecord.dossierComponents)) {
        setComponents([...primaryRecord.dossierComponents]);
      } else {
        setComponents([]);
      }

      if (primaryRecord && Array.isArray(primaryRecord.attachedFiles)) {
        setAttachedFiles([...primaryRecord.attachedFiles]);
      } else {
        setAttachedFiles([]);
      }
    }
  }, [isOpen, primaryRecord, config]);

  // Đóng modal khi bấm Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lọc nhân sự theo Tổ Cấp giấy / Ban Giám đốc / Phòng ban tương ứng
  const filteredEmployees = useMemo(() => {
    const term = removeVietnameseTones(searchTerm.trim().toLowerCase());

    return employees.filter((emp) => {
      // Lọc theo bộ phận nếu có config
      if (config.departmentFilter && config.departmentFilter.length > 0) {
        const empDept = (emp.department || '').toLowerCase();
        const matchDept = config.departmentFilter.some((d) => empDept.includes(d.toLowerCase()));
        if (!matchDept) return false;
      } else {
        // Mặc định lọc Tổ Cấp giấy / Đăng ký
        const empDept = (emp.department || '').toLowerCase();
        const isCapGiay =
          !empDept ||
          empDept.includes('đăng ký') ||
          empDept.includes('cấp giấy') ||
          empDept.includes('giấy') ||
          empDept.includes('thuế');
        if (!isCapGiay && config.targetStatus !== RecordStatus.PENDING_SIGN) {
          return false;
        }
      }

      // Lọc theo từ khóa tìm kiếm
      if (term) {
        const empName = removeVietnameseTones((emp.name || '').toLowerCase());
        const empPos = removeVietnameseTones((emp.position || '').toLowerCase());
        return empName.includes(term) || empPos.includes(term);
      }

      return true;
    });
  }, [employees, searchTerm, config]);

  if (!isOpen) return null;

  // Thêm mới 1 dòng thành phần hồ sơ
  const handleAddComponent = () => {
    const newComp: DossierComponentItem = {
      id: crypto.randomUUID?.() || `comp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: '',
      isOriginal: true,
      copyCount: 1,
      pageCount: 1,
    };
    setComponents((prev) => [...prev, newComp]);
  };

  const handleUpdateComponent = (id: string, field: keyof DossierComponentItem, value: any) => {
    setComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleRemoveComponent = (id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  // Đính kèm file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Data = uploadEvent.target?.result as string;
        const newFileMeta: AttachedFileMeta = {
          id: crypto.randomUUID?.() || `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          recordCode: (records || []).map(r => r.code).filter(Boolean).join(', ') || 'CG',
          originalName: file.name,
          fileName: file.name,
          docType: 'TLKHAC',
          docTypeLabel: 'Tài liệu nghiệp vụ',
          department: 'Tổ Cấp giấy',
          fileSize: file.size,
          fileType: file.type,
          base64Data,
          uploadedAt: new Date().toISOString(),
          uploadedBy: currentUser?.name || 'Cán bộ Cấp giấy',
        };

        setAttachedFiles((prev) => [...prev, newFileMeta]);

        // Tự động tạo một thành phần hồ sơ tương ứng nếu chưa có
        setComponents((prev) => [
          ...prev,
          {
            id: crypto.randomUUID?.() || `comp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            name: file.name.replace(/\.[^/.]+$/, ''),
            isOriginal: true,
            copyCount: 1,
            pageCount: 1,
            attachedFile: newFileMeta,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileId?: string, fileName?: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId && f.fileName !== fileName));
  };

  // Xác nhận chuyển bước
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedStaffName) {
      setErrorMsg(`Vui lòng chọn cán bộ thực hiện ${config.roleTitle}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      const today = new Date().toISOString().substring(0, 10);
      const extraFields: Partial<RecordFile> = {};

      // 1. Luôn bảo toàn cán bộ thẩm định
      if (primaryRecord) {
        const currentAppraiser = primaryRecord.appraisalStaff || primaryRecord.assignedTo || currentUser?.name || '';
        if (currentAppraiser) {
          extraFields.appraisalStaff = currentAppraiser;
        }
      }

      // 2. Gán đúng trường nhân sự và ngày mốc tương ứng theo từng khâu
      if (config.targetStatus === RecordStatus.APPRAISAL || config.targetStatus === RecordStatus.RECEIVED) {
        extraFields.appraisalStaff = selectedStaffName;
        extraFields.assignedTo = selectedStaffName;
        extraFields.assignedDate = today;
        extraFields.appraisalDate = today;
      } else if (config.targetStatus === RecordStatus.TAX_TRANSFER) {
        extraFields.taxStaff = selectedStaffName;
        extraFields.taxTransferStaff = selectedStaffName;
        extraFields.taxTransferDate = today;
        extraFields.taxTransferAssignedDate = today;
      } else if (config.targetStatus === RecordStatus.PENDING_TAX_KV7) {
        extraFields.taxKv7Date = today;
      } else if (config.targetStatus === RecordStatus.PENDING_TAX_PAYMENT) {
        extraFields.taxPaymentDate = today;
      } else if (config.targetStatus === RecordStatus.PENDING_PRINT_CERT) {
        extraFields.printStaff = selectedStaffName;
        extraFields.printStaffId = selectedStaffName;
        extraFields.printCertDate = today;
      } else if (config.targetStatus === RecordStatus.PENDING_CHECK) {
        extraFields.checkedBy = selectedStaffName;
        extraFields.pendingCheckDate = today;
      } else if (config.targetStatus === RecordStatus.PENDING_SIGN) {
        extraFields.submittedTo = selectedStaffName;
        extraFields.submissionDate = today;
      } else if (config.targetStatus === RecordStatus.SIGNED || config.targetStatus === RecordStatus.PENDING_HANDOVER) {
        extraFields.approvalDate = today;
      } else if (config.targetStatus === RecordStatus.RETURNED || config.targetStatus === RecordStatus.HANDOVER) {
        extraFields.returnedBy = selectedStaffName;
        extraFields.resultReturnedDate = today;
        extraFields.completedDate = today;
        extraFields.isHandedOver = true;
      } else if (config.targetStatus === RecordStatus.PENDING_SUPPLEMENT) {
        extraFields.supplementRequestedBy = selectedStaffName;
        extraFields.supplementRequestedAt = today;
      }

      await onConfirm({
        targetStatus: config.targetStatus,
        selectedStaff: selectedStaffName,
        extraFields,
        newAttachments: attachedFiles,
        newComponents: components.filter((c) => c.name && c.name.trim() !== ''),
        note: note.trim() || undefined,
        targetRecords: targetList,
      });

      onClose();
    } catch (err: any) {
      console.error('Lỗi khi chuyển bước:', err);
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi thực hiện chuyển bước.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* HEADER BAR */}
        <div className={`px-6 py-4 ${config.headerBg} text-white flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              {config.icon}
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {config.title} {targetList.length === 1 ? `(${primaryRecord?.code})` : `(${targetList.length} hồ sơ)`}
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">{config.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* BODY (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Danh sách hồ sơ nếu chuyển hàng loạt */}
          {targetList.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Danh sách hồ sơ chuyển giao ({targetList.length})
              </label>
              <div className="max-h-28 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
                {targetList.map((rec) => (
                  <div key={rec.id} className="text-xs text-slate-700 flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                    <span className="font-semibold text-blue-700 flex items-center gap-1">
                      <FileText size={13} className="text-blue-500" />
                      {rec.code}
                    </span>
                    <span className="text-slate-500 truncate max-w-[200px]">{rec.customerName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KHỐI 1: CHỌN CHUYÊN VIÊN VỚI THANH TÌM KIẾM NHANH VÀ LỌC TỔ CẤP GIẤY */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <User size={15} className="text-blue-600" />
                <span>{config.roleTitle}: <span className="text-red-500">*</span></span>
              </label>
              <span className="text-slate-400 font-medium">
                {filteredEmployees.length} nhân sự
              </span>
            </div>

            {/* Ô tìm kiếm nhanh nhân sự */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm nhanh tên nhân sự Tổ Cấp giấy..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
            </div>

            {/* Danh sách thẻ nhân sự có nút tròn Radio */}
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => {
                  const isSelected = selectedStaffName === emp.name;
                  return (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedStaffName(emp.name)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-400'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Nút radio tròn */}
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{emp.name}</span>
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              {emp.department || 'Cấp giấy'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {emp.position || 'Nhân viên'} • {emp.department || 'Tổ Cấp giấy'}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
                          <Check size={14} />
                          <span>Đã chọn</span>
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
                  Không tìm thấy nhân sự phù hợp với từ khóa "{searchTerm}".
                </div>
              )}
            </div>
          </div>

          {/* KHỐI 2: THÀNH PHẦN HỒ SƠ & TỆP ĐÍNH KÈM */}
          <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-blue-100 text-blue-700 rounded-lg">
                  <FileText size={15} />
                </span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  THÀNH PHẦN HỒ SƠ & TỆP ĐÍNH KÈM
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Upload size={13} />
                  <span>Đính kèm tệp</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddComponent}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Thêm mới</span>
                </button>
              </div>
            </div>

            {/* Danh sách thành phần hồ sơ */}
            {components.length > 0 || attachedFiles.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {components.map((comp, idx) => (
                  <div
                    key={comp.id || idx}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs shadow-2xs"
                  >
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-slate-400 font-bold">{idx + 1}.</span>
                      <input
                        type="text"
                        placeholder="Tên loại giấy tờ / tệp đính kèm..."
                        value={comp.name || ''}
                        onChange={(e) => handleUpdateComponent(comp.id, 'name', e.target.value)}
                        className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      {comp.attachedFile && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shrink-0">
                          <Paperclip size={11} />
                          <span className="truncate max-w-[120px]">{comp.attachedFile.fileName}</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveComponent(comp.id)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {/* Tệp đính kèm độc lập nếu chưa map vào component */}
                {attachedFiles.filter(f => !components.some(c => c.attachedFile?.id === f.id)).map((f, fIdx) => (
                  <div
                    key={f.id || fIdx}
                    className="p-2.5 bg-white border border-emerald-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-emerald-600" />
                      <span className="font-bold text-slate-800">{f.fileName}</span>
                      <span className="text-[10px] text-slate-400">
                        ({f.fileSize ? `${Math.round(f.fileSize / 1024)} KB` : 'Đã tải'})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(f.id, f.fileName)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs py-5">
                Chưa có thành phần hồ sơ nào được thêm. Bấm <strong className="text-blue-600">"Thêm mới"</strong> hoặc <strong className="text-blue-600">"Đính kèm tệp"</strong> để bổ sung giấy tờ và file đính kèm.
              </div>
            )}
          </div>

          {/* Ghi chú chuyển giao (Tùy chọn) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú chuyển giao (Tùy chọn):
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Đã hoàn tất thẩm định, hồ sơ đủ điều kiện chuyển khâu tiếp theo..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </form>

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedStaffName}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={15} />
            <span>{isSubmitting ? 'Đang xử lý...' : 'Xác nhận chuyển bước'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
