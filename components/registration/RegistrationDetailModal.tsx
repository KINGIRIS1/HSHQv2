import React, { useState } from 'react';
import {
  X,
  FileText,
  Save,
  AlertCircle,
  Paperclip,
  Clock,
  CheckCircle2,
  Send,
  Building,
  DollarSign,
  Printer,
  FileCheck,
  Pause,
} from 'lucide-react';
import { RecordFile, Employee, User as AppUser, RecordStatus, RecordStatusLog, AttachedFileMeta, DossierComponentItem } from '../../types';
import { RegistrationWorkflowStepper } from './RegistrationWorkflowStepper';
import { RegistrationStepHandoverModal, getStepHandoverConfig, StepHandoverConfig } from './RegistrationStepHandoverModal';
import { RegistrationWorkflowConfigModal } from './RegistrationWorkflowConfigModal';
import { validateCapGiayTransition } from '../../utils/capGiayStateMachine';
import { triggerGlobalAlert } from '../GlobalAlertModal';
import { cleanFutureMilestoneDates } from '../../utils/appHelpers';
import {
  getAppointmentInfo,
  calculateRegistrationDeadline,
  getRegistrationWorkflow,
} from '../../utils/registrationWorkflows';

interface RegistrationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  onSave: (updatedRecord: RecordFile) => Promise<void>;
  employees: Employee[];
  currentUser?: AppUser | null;
}

export const RegistrationDetailModal: React.FC<RegistrationDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  onSave,
  employees,
  currentUser,
}) => {
  if (!isOpen || !record) return null;

  const [formData, setFormData] = useState<RecordFile>({ ...record });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'info' | 'status' | 'milestones' | 'attachments'>('status');

  // Hộp thoại chuyển giao chuyên nghiệp với thanh tìm kiếm và đính kèm thành phần hồ sơ
  const [handoverConfig, setHandoverConfig] = useState<StepHandoverConfig | null>(null);
  const [isWorkflowConfigOpen, setIsWorkflowConfigOpen] = useState<boolean>(false);

  React.useEffect(() => {
    const next = { ...record };
    if (!next.deadline && next.receivedDate) {
      const calc = calculateRegistrationDeadline(next);
      if (calc.deadline) next.deadline = calc.deadline;
    }
    setFormData(next);
  }, [record]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (handoverConfig) {
          setHandoverConfig(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handoverConfig]);

  const handleChange = (field: keyof RecordFile, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (['receivedDate', 'recordType', 'postingDate', 'taxPaymentDate'].includes(field as string)) {
        const calc = calculateRegistrationDeadline(next);
        if (calc.deadline) {
          next.deadline = calc.deadline;
        }
      }
      return next;
    });
  };

  const handleStatusChange = (
    newStatus: RecordStatus,
    updatedFields?: Partial<RecordFile>,
    note?: string
  ) => {
    setErrorMsg('');
    const val = validateCapGiayTransition(
      formData.status,
      newStatus,
      formData.previousStatus || formData.supplementReturnStatus,
      formData.recordType
    );
    if (!val.valid) {
      setErrorMsg(val.reason || 'Chuyển trạng thái không hợp lệ theo quy trình Cấp giấy.');
      return;
    }

    const now = new Date().toISOString();
    const today = now.substring(0, 10);
    const newLog: RecordStatusLog = {
      id: crypto.randomUUID(),
      recordId: formData.id,
      previousStatus: formData.status,
      newStatus,
      changedBy: currentUser?.name || formData.assignedTo || 'Cán bộ Cấp giấy',
      changedAt: now,
      note: note || undefined,
    };

    const autoDates: Partial<RecordFile> = {};

    // 1. Luôn chốt và bảo toàn Cán bộ thẩm định nếu đã có hoặc đang ở Bước Thẩm định
    const fixedAppraiser = formData.appraisalStaff || formData.assignedTo || '';
    if (fixedAppraiser) {
      autoDates.appraisalStaff = fixedAppraiser;
    }

    if (newStatus === RecordStatus.APPRAISAL && !formData.appraisalDate) autoDates.appraisalDate = today;
    if (newStatus === RecordStatus.TAX_TRANSFER) {
      if (!formData.taxTransferDate) autoDates.taxTransferDate = today;
      if (!formData.taxStaff && updatedFields?.taxStaff) autoDates.taxStaff = updatedFields.taxStaff;
      if (!formData.taxTransferStaff && updatedFields?.taxTransferStaff) autoDates.taxTransferStaff = updatedFields.taxTransferStaff;
    }
    if (newStatus === RecordStatus.PENDING_TAX_KV7 && !formData.taxKv7Date) autoDates.taxKv7Date = today;
    if (newStatus === RecordStatus.PENDING_TAX_PAYMENT && !formData.taxPaymentDate) autoDates.taxPaymentDate = today;
    if (newStatus === RecordStatus.PENDING_PRINT_CERT && !formData.printCertDate) autoDates.printCertDate = today;
    if (newStatus === RecordStatus.PENDING_CHECK && !formData.pendingCheckDate) autoDates.pendingCheckDate = today;
    if (newStatus === RecordStatus.PENDING_SIGN && !formData.submissionDate) autoDates.submissionDate = today;
    if ((newStatus === RecordStatus.SIGNED || newStatus === RecordStatus.PENDING_HANDOVER) && !formData.approvalDate) {
      autoDates.approvalDate = today;
    }
    if (newStatus === RecordStatus.HANDOVER) {
      if (!formData.completedDate) autoDates.completedDate = today;
      autoDates.isHandedOver = true;
    }
    if (newStatus === RecordStatus.RETURNED && !formData.resultReturnedDate) {
      autoDates.resultReturnedDate = today;
    }

    // Dọn dẹp triệt để các mốc ngày tháng và phân công của các bước sau khi chuyển về bước trước
    const cleanedMilestones = cleanFutureMilestoneDates(formData, newStatus);
    const rollbackClearedFields: Record<string, any> = {};
    Object.keys(cleanedMilestones).forEach(k => {
      if ((cleanedMilestones as any)[k] === null || (cleanedMilestones as any)[k] === false) {
        rollbackClearedFields[k] = (cleanedMilestones as any)[k];
      }
    });

    const updatedRecordData: RecordFile = {
      ...formData,
      ...rollbackClearedFields,
      status: newStatus,
      statusLogs: [...(formData.statusLogs || []), newLog],
      ...autoDates,
      ...(updatedFields || {}),
    };
    const calc = calculateRegistrationDeadline(updatedRecordData);
    if (calc.deadline) {
      updatedRecordData.deadline = calc.deadline;
    }

    setFormData(updatedRecordData);
    return updatedRecordData;
  };

  // Kích hoạt khi người dùng bấm nút chuyển bước trên Stepper
  const handleRequestStatusChange = (newStatus: RecordStatus) => {
    // Luôn mở Hộp thoại giao việc chuyên nghiệp cho mọi bước (không nhảy thẳng)
    setHandoverConfig(getStepHandoverConfig(newStatus));
  };

  const handleConfirmStepHandover = async ({
    targetStatus,
    selectedStaff,
    extraFields,
    newAttachments,
    newComponents,
    note,
  }: {
    targetStatus: RecordStatus;
    selectedStaff: string;
    extraFields: Partial<RecordFile>;
    newAttachments?: AttachedFileMeta[];
    newComponents?: DossierComponentItem[];
    note?: string;
  }) => {
    const updatedData: Partial<RecordFile> = {
      ...extraFields,
      ...(newAttachments ? { attachedFiles: newAttachments } : {}),
      ...(newComponents ? { dossierComponents: newComponents } : {}),
    };
    const updatedRecordData = handleStatusChange(targetStatus, updatedData, note);
    if (!updatedRecordData) return;

    // TỰ ĐỘNG LƯU NGAY VÀO CSDL VÀ KIỂM TRA BẢO TỒN DỮ LIỆU
    try {
      setIsSaving(true);
      setErrorMsg('');
      await onSave(updatedRecordData);
      setHandoverConfig(null);
    } catch (err: any) {
      console.error('Lỗi khi lưu chuyển bước vào CSDL:', err);
      const errMsg = err?.message || 'Lỗi mạng hoặc CSDL từ chối lưu.';
      setErrorMsg(`Lỗi lưu CSDL: ${errMsg}`);
      triggerGlobalAlert(
        `⚠️ CẢNH BÁO LỖI BẢO TỒN DỮ LIỆU CSDL:\nKhông thể lưu thông tin chuyển bước vào Cơ sở dữ liệu cho hồ sơ ${formData.code}!\n\nChi tiết lỗi: ${errMsg}\n\n👉 Dữ liệu CHƯA ĐƯỢC LƯU vào hệ thống. Vui lòng kiểm tra lại kết nối mạng và thử lại.`,
        'LỖI LƯU CƠ SỞ DỮ LIỆU'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setErrorMsg('');
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra khi lưu hồ sơ.');
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <FileText size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{formData.code}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white">
                  {formData.recordType || formData.group || '3. Đăng ký đất đai'}
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">
                Chủ sử dụng: <strong className="text-white">{formData.customerName || 'Chưa có tên chủ'}</strong>
                {formData.ward ? ` — ${formData.ward}` : ''}
                {formData.landPlot ? ` (Thửa ${formData.landPlot}, TBĐ ${formData.mapSheet || '—'})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thanh Stepper Tiến trình chuẩn theo mã thủ tục */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <RegistrationWorkflowStepper
            record={formData}
            onChangeStatus={handleRequestStatusChange}
            currentUser={currentUser}
            onOpenWorkflowConfig={() => setIsWorkflowConfigOpen(true)}
            onTogglePauseSla={(isPaused) => {
              handleChange('isSlaPaused', isPaused);
              if (isPaused) {
                handleChange('slaPausedAt', new Date().toISOString());
                if (!formData.slaPausedReason) {
                  handleChange('slaPausedReason', 'Tạm dừng SLA theo yêu cầu');
                }
              } else {
                handleChange('slaResumeAt', new Date().toISOString());
              }
            }}
          />
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center px-6 border-b border-slate-200 bg-white gap-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'status'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Tiến độ & Phân công các khâu
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('milestones')}
            className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'milestones'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Mốc thời gian chuyên môn
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Thông tin hồ sơ & Thửa đất
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attachments')}
            className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'attachments'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Tệp đính kèm ({formData.attachedFiles?.length || 0})
          </button>
        </div>

        {/* Body Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: TIẾN ĐỘ & PHÂN CÔNG TỪNG KHÂU */}
          {activeTab === 'status' && (
            <div className="space-y-5">
              {/* KHỐI TÍCH CHỌN TẠM DỪNG TÍNH SLA */}
              <div className={`p-4 rounded-2xl border transition-all ${formData.isSlaPaused ? 'bg-amber-50/80 border-amber-300 shadow-xs' : 'bg-slate-50/80 border-slate-200'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="flex items-start sm:items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.isSlaPaused)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        handleChange('isSlaPaused', checked);
                        if (checked) {
                          handleChange('slaPausedAt', new Date().toISOString());
                          if (!formData.slaPausedReason) {
                            handleChange('slaPausedReason', 'Tạm dừng SLA theo yêu cầu');
                          }
                        } else {
                          handleChange('slaResumeAt', new Date().toISOString());
                        }
                      }}
                      className="w-5 h-5 mt-0.5 sm:mt-0 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Pause size={15} className={formData.isSlaPaused ? "text-amber-600 animate-pulse shrink-0" : "text-slate-400 shrink-0"} />
                        <span>Tích chọn Tạm dừng tính SLA cho hồ sơ này</span>
                      </span>
                      <span className="text-xs text-slate-500 block">
                        Khi tích chọn, đồng hồ đếm ngược và kiểm soát hạn SLA của hồ sơ sẽ được đóng băng (không bị tính quá hạn).
                      </span>
                    </div>
                  </label>
                  {formData.isSlaPaused && (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 shrink-0 flex items-center gap-1">
                      <Pause size={12} className="animate-pulse" />
                      <span>ĐANG TẠM DỪNG SLA</span>
                    </span>
                  )}
                </div>
                {formData.isSlaPaused && (
                  <div className="mt-3 pt-3 border-t border-amber-200/70 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Lý do tạm dừng SLA:
                      </label>
                      <input
                        type="text"
                        value={formData.slaPausedReason || ''}
                        onChange={(e) => handleChange('slaPausedReason', e.target.value)}
                        placeholder="VD: Chờ bổ sung hồ sơ, chờ giải quyết tranh chấp, ý kiến chuyên môn..."
                        className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Thời điểm bắt đầu tạm dừng:
                      </label>
                      <input
                        type="text"
                        value={formData.slaPausedAt ? formData.slaPausedAt.substring(0, 19).replace('T', ' ') : '—'}
                        readOnly
                        className="w-full px-3 py-1.5 bg-amber-100/40 border border-amber-200 rounded-lg text-xs font-medium text-slate-600 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* KHỐI 1: PHÂN CÔNG CÁN BỘ THEO TỪNG BƯỚC NGHIỆP VỤ */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-blue-600 text-white rounded-lg shadow-xs">
                      <FileCheck size={16} />
                    </span>
                    <div>
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                        Phân công cán bộ theo từng khâu nghiệp vụ
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Lưu giữ độc lập từng bước, không bị ghi đè hay thay đổi người thẩm định ban đầu
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                    Bóc tách chuyên trách
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* Bước 2: Cán bộ thẩm định */}
                  <div className="p-3 bg-white border border-blue-200 rounded-xl shadow-2xs space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-blue-700">
                        <FileCheck size={14} />
                        <span>Bước 2: Cán bộ thẩm định</span>
                      </span>
                      {formData.appraisalDate && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formData.appraisalDate}
                        </span>
                      )}
                    </label>
                    <select
                      value={formData.appraisalStaff || formData.assignedTo || ''}
                      onChange={(e) => {
                        handleChange('appraisalStaff', e.target.value);
                        if (!formData.assignedTo) handleChange('assignedTo', e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 bg-blue-50/40 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                    >
                      <option value="">-- Chọn cán bộ thẩm định --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} {emp.department ? `(${emp.department})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bước 3: Cán bộ lập phiếu chuyển thuế */}
                  <div className="p-3 bg-white border border-indigo-200 rounded-xl shadow-2xs space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-indigo-700">
                        <Send size={14} />
                        <span>Bước 3: Cán bộ chuyển thuế</span>
                      </span>
                      {formData.taxTransferDate && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formData.taxTransferDate}
                        </span>
                      )}
                    </label>
                    <select
                      value={formData.taxStaff || formData.taxTransferStaff || ''}
                      onChange={(e) => {
                        handleChange('taxStaff', e.target.value);
                        handleChange('taxTransferStaff', e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 bg-indigo-50/40 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="">-- Chọn cán bộ làm thuế --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} {emp.department ? `(${emp.department})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bước 6: Cán bộ In GCN */}
                  <div className="p-3 bg-white border border-teal-200 rounded-xl shadow-2xs space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-teal-700">
                        <Printer size={14} />
                        <span>Bước 6: Cán bộ In GCN</span>
                      </span>
                      {formData.printCertDate && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formData.printCertDate}
                        </span>
                      )}
                    </label>
                    <select
                      value={formData.printStaff || formData.printStaffId || ''}
                      onChange={(e) => {
                        handleChange('printStaff', e.target.value);
                        handleChange('printStaffId', e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 bg-teal-50/40 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
                    >
                      <option value="">-- Chọn cán bộ In GCN --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} {emp.department ? `(${emp.department})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bước 7: Cán bộ kiểm tra */}
                  <div className="p-3 bg-white border border-orange-200 rounded-xl shadow-2xs space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-orange-700">
                        <CheckCircle2 size={14} />
                        <span>Bước 7: Cán bộ kiểm tra</span>
                      </span>
                      {formData.pendingCheckDate && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formData.pendingCheckDate}
                        </span>
                      )}
                    </label>
                    <select
                      value={formData.checkedBy || ''}
                      onChange={(e) => handleChange('checkedBy', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-orange-50/40 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
                    >
                      <option value="">-- Chọn cán bộ kiểm tra --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} {emp.department ? `(${emp.department})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bước 8: Lãnh đạo ký duyệt */}
                  <div className="p-3 bg-white border border-purple-200 rounded-xl shadow-2xs space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-purple-700">
                        <Send size={14} />
                        <span>Bước 8: Lãnh đạo ký duyệt</span>
                      </span>
                      {formData.submissionDate && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formData.submissionDate}
                        </span>
                      )}
                    </label>
                    <select
                      value={formData.submittedTo || ''}
                      onChange={(e) => handleChange('submittedTo', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-purple-50/40 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer"
                    >
                      <option value="">-- Chọn lãnh đạo ký duyệt --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} {emp.position ? `(${emp.position})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bước 10: Cán bộ trả kết quả */}
                  <div className="p-3 bg-white border border-emerald-200 rounded-xl shadow-2xs space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 size={14} />
                        <span>Bước 10: Cán bộ trả kết quả</span>
                      </span>
                      {formData.resultReturnedDate && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          {formData.resultReturnedDate}
                        </span>
                      )}
                    </label>
                    <select
                      value={formData.returnedBy || ''}
                      onChange={(e) => handleChange('returnedBy', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-emerald-50/40 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                    >
                      <option value="">-- Chọn cán bộ trả kết quả --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* KHỐI 2: THỜI HẠN VÀ NHẬT KÝ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                    Thời hạn giải quyết & Hẹn trả
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Ngày tiếp nhận</label>
                      <input
                        type="date"
                        value={formData.receivedDate || ''}
                        onChange={(e) => handleChange('receivedDate', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Hạn xử lý (Deadline)</label>
                      <input
                        type="date"
                        value={formData.deadline || ''}
                        onChange={(e) => handleChange('deadline', e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Thẻ thông tin Ngày hẹn trả theo giai đoạn quy trình */}
                  {(() => {
                    const appInfo = getAppointmentInfo(formData);
                    return (
                      <div className={`p-3 rounded-xl border flex flex-col gap-1 ${
                        appInfo.phase === 'tax_notice'
                          ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
                          : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center gap-1.5">
                            <Clock size={14} className={appInfo.phase === 'tax_notice' ? 'text-indigo-600' : 'text-emerald-600'} />
                            <span>{appInfo.label}</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            appInfo.phase === 'tax_notice' ? 'bg-indigo-200 text-indigo-900' : 'bg-emerald-200 text-emerald-900'
                          }`}>
                            {appInfo.formattedAppointmentDate}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">{appInfo.description}</p>
                      </div>
                    );
                  })()}
                </div>

                {/* Nhật ký trạng thái */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                    Nhật ký luân chuyển hồ sơ
                  </span>
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                    {formData.statusLogs && formData.statusLogs.length > 0 ? (
                      formData.statusLogs.map((log) => (
                        <div key={log.id} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs shadow-2xs">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span className="text-blue-700">{log.newStatus}</span>
                            <span className="text-[11px] text-slate-500">
                              {log.changedAt ? log.changedAt.substring(0, 16).replace('T', ' ') : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1">
                            Người thực hiện: <strong className="text-slate-700">{log.changedBy}</strong>
                          </p>
                          {log.note && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5">
                              Ghi chú: {log.note}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic text-center py-4">
                        Chưa có nhật ký luân chuyển.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MỐC THỜI GIAN CHUYÊN MÔN CỦA MODULE CẤP GIẤY */}
          {activeTab === 'milestones' && (
            <div className="space-y-4">
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
                <Clock size={16} className="shrink-0 text-blue-600" />
                <span>
                  Các mốc thời gian này được tự động cập nhật khi chuyển trạng thái hoặc người dùng có thể chỉnh sửa thủ công khi cần khớp sổ bộ.
                </span>
              </div>

              {/* Lấy quy trình chuẩn tương ứng loại hồ sơ */}
              {(() => {
                const wf = getRegistrationWorkflow(formData.recordType);
                const steps = wf.steps || [];

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Ngày tiếp nhận */}
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                      <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <FileCheck size={14} className="text-gray-600" />
                        <span>Bước 1: Tiếp nhận</span>
                      </label>
                      <input
                        type="date"
                        value={formData.receivedDate || ''}
                        onChange={(e) => handleChange('receivedDate', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {/* Hiển thị động các mốc tùy thuộc thủ tục */}
                    {steps.some(s => s.key === RecordStatus.APPRAISAL) && (
                      <div className="p-3 bg-white border border-blue-200 rounded-xl space-y-2">
                        <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-blue-700">
                            <FileCheck size={14} />
                            <span>Bước 2: Thẩm định</span>
                          </span>
                        </label>
                        <input
                          type="date"
                          value={formData.appraisalDate || ''}
                          onChange={(e) => handleChange('appraisalDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <div className="pt-1">
                          <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Cán bộ thẩm định:</label>
                          <select
                            value={formData.appraisalStaff || formData.assignedTo || ''}
                            onChange={(e) => {
                              handleChange('appraisalStaff', e.target.value);
                              if (!formData.assignedTo) handleChange('assignedTo', e.target.value);
                            }}
                            className="w-full px-2 py-1 bg-blue-50/50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                          >
                            <option value="">-- Chưa chọn cán bộ --</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.name}>
                                {emp.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {steps.some(s => s.key === RecordStatus.TAX_TRANSFER) && (
                      <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2">
                        <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-indigo-700">
                            <Send size={14} />
                            <span>Bước 3: Phiếu chuyển thuế</span>
                          </span>
                        </label>
                        <input
                          type="date"
                          value={formData.taxTransferDate || ''}
                          onChange={(e) => handleChange('taxTransferDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <div className="pt-1">
                          <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Cán bộ lập phiếu thuế:</label>
                          <select
                            value={formData.taxStaff || formData.taxTransferStaff || ''}
                            onChange={(e) => {
                              handleChange('taxStaff', e.target.value);
                              handleChange('taxTransferStaff', e.target.value);
                            }}
                            className="w-full px-2 py-1 bg-indigo-50/50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                          >
                            <option value="">-- Chưa chọn cán bộ thuế --</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.name}>
                                {emp.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {steps.some(s => s.key === RecordStatus.PENDING_TAX_KV7) && (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Building size={14} className="text-violet-600" />
                          <span>Bước 4: Thuế Khu vực 7 (Ngoài SLA)</span>
                        </label>
                        <input
                          type="date"
                          value={formData.taxKv7Date || ''}
                          onChange={(e) => handleChange('taxKv7Date', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}

                    {steps.some(s => s.key === RecordStatus.PENDING_TAX_PAYMENT) && (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <DollarSign size={14} className="text-amber-600" />
                          <span>Bước 5: Thông báo thuế (Tạm dừng)</span>
                        </label>
                        <input
                          type="date"
                          value={formData.taxPaymentDate || ''}
                          onChange={(e) => handleChange('taxPaymentDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}

                    {steps.some(s => s.key === RecordStatus.PENDING_PRINT_CERT) && (
                      <div className="p-3 bg-white border border-teal-200 rounded-xl space-y-2">
                        <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-teal-700">
                            <Printer size={14} />
                            <span>
                              {wf.category === 'correction' ? 'Bước 2: In Giấy chứng nhận' : 'Bước 6: In Giấy chứng nhận'}
                            </span>
                          </span>
                        </label>
                        <input
                          type="date"
                          value={formData.printCertDate || ''}
                          onChange={(e) => handleChange('printCertDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <div className="pt-1">
                          <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Cán bộ In GCN:</label>
                          <select
                            value={formData.printStaff || formData.printStaffId || ''}
                            onChange={(e) => {
                              handleChange('printStaff', e.target.value);
                              handleChange('printStaffId', e.target.value);
                            }}
                            className="w-full px-2 py-1 bg-teal-50/50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                          >
                            <option value="">-- Chưa chọn cán bộ In --</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.name}>
                                {emp.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {steps.some(s => s.key === RecordStatus.PENDING_CHECK) && (
                      <div className="p-3 bg-white border border-orange-200 rounded-xl space-y-2">
                        <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-orange-700">
                            <CheckCircle2 size={14} />
                            <span>
                              {wf.category === 'correction' ? 'Bước 3: Trình kiểm tra' : 'Bước 7: Trình kiểm tra'}
                            </span>
                          </span>
                        </label>
                        <input
                          type="date"
                          value={formData.pendingCheckDate || ''}
                          onChange={(e) => handleChange('pendingCheckDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <div className="pt-1">
                          <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Cán bộ kiểm tra:</label>
                          <select
                            value={formData.checkedBy || ''}
                            onChange={(e) => handleChange('checkedBy', e.target.value)}
                            className="w-full px-2 py-1 bg-orange-50/50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                          >
                            <option value="">-- Chọn cán bộ kiểm tra --</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.name}>
                                {emp.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {steps.some(s => s.key === RecordStatus.PENDING_SIGN) && (
                      <div className="p-3 bg-white border border-purple-200 rounded-xl space-y-2">
                        <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-purple-700">
                            <Send size={14} />
                            <span>
                              {wf.category === 'correction' ? 'Bước 4: Trình ký duyệt' : 'Bước 8: Trình ký duyệt'}
                            </span>
                          </span>
                        </label>
                        <input
                          type="date"
                          value={formData.submissionDate || ''}
                          onChange={(e) => handleChange('submissionDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <div className="pt-1">
                          <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Lãnh đạo ký duyệt:</label>
                          <select
                            value={formData.submittedTo || ''}
                            onChange={(e) => handleChange('submittedTo', e.target.value)}
                            className="w-full px-2 py-1 bg-purple-50/50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                          >
                            <option value="">-- Chọn lãnh đạo ký --</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.name}>
                                {emp.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {steps.some(s => s.key === RecordStatus.PENDING_HANDOVER) && (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span>
                            {wf.category === 'correction' ? 'Bước 5: Hoàn thành' : 'Bước 9: Hoàn thành'}
                          </span>
                        </label>
                        <input
                          type="date"
                          value={formData.approvalDate || ''}
                          onChange={(e) => handleChange('approvalDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}

                    {steps.some(s => s.key === RecordStatus.RETURNED) && (
                      <div className="p-3 bg-white border border-emerald-200 rounded-xl space-y-2">
                        <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 size={14} />
                            <span>
                              {wf.category === 'correction' ? 'Bước 6: Trả kết quả' : 'Bước 10: Trả kết quả'}
                            </span>
                          </span>
                        </label>
                        <input
                          type="date"
                          value={formData.resultReturnedDate || ''}
                          onChange={(e) => handleChange('resultReturnedDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <div className="pt-1">
                          <label className="block text-[11px] font-bold text-slate-500 mb-0.5">Cán bộ trả kết quả:</label>
                          <select
                            value={formData.returnedBy || ''}
                            onChange={(e) => handleChange('returnedBy', e.target.value)}
                            className="w-full px-2 py-1 bg-emerald-50/50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none"
                          >
                            <option value="">-- Chọn cán bộ trả kết quả --</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.name}>
                                {emp.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Niêm yết công khai nếu có */}
                    {steps.some(s => s.key === RecordStatus.PENDING_POSTING) && (
                      <div className="p-3 bg-white border border-amber-200 rounded-xl space-y-2 bg-amber-50/30">
                        <label className="block text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          <Building size={14} className="text-amber-600" />
                          <span>Niêm yết tại UBND xã (30 ngày)</span>
                        </label>
                        <input
                          type="date"
                          value={formData.postingDate || ''}
                          onChange={(e) => handleChange('postingDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Thông tin số phát hành và số vào sổ GCN */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3 mt-4">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                  Thông tin Giấy chứng nhận đã cấp
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Số phát hành GCN</label>
                    <input
                      type="text"
                      placeholder="VD: CN 123456"
                      value={formData.issueNumber || ''}
                      onChange={(e) => handleChange('issueNumber', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Số vào sổ cấp GCN</label>
                    <input
                      type="text"
                      placeholder="VD: CS 00123"
                      value={formData.entryNumber || ''}
                      onChange={(e) => handleChange('entryNumber', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Ngày cấp GCN</label>
                    <input
                      type="date"
                      value={formData.issueDate || ''}
                      onChange={(e) => handleChange('issueDate', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: THÔNG TIN HỒ SƠ & THỬA ĐẤT */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* Khối 1: Thông tin người sử dụng đất */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                  1. Thông tin người sử dụng đất
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Chủ sử dụng / Đại diện</label>
                    <input
                      type="text"
                      value={formData.customerName || ''}
                      onChange={(e) => handleChange('customerName', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Số điện thoại</label>
                    <input
                      type="text"
                      value={formData.phoneNumber || ''}
                      onChange={(e) => handleChange('phoneNumber', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Số CCCD / CMND</label>
                    <input
                      type="text"
                      value={formData.cccd || ''}
                      onChange={(e) => handleChange('cccd', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Địa chỉ thường trú</label>
                  <input
                    type="text"
                    value={formData.customerAddress || ''}
                    onChange={(e) => handleChange('customerAddress', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Khối 2: Thông tin thửa đất */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                  2. Thông tin thửa đất
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Xã / Phường</label>
                    <input
                      type="text"
                      value={formData.ward || ''}
                      onChange={(e) => handleChange('ward', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Số thửa</label>
                    <input
                      type="text"
                      value={formData.landPlot || ''}
                      onChange={(e) => handleChange('landPlot', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tờ bản đồ số</label>
                    <input
                      type="text"
                      value={formData.mapSheet || ''}
                      onChange={(e) => handleChange('mapSheet', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Diện tích (m²)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.area || ''}
                      onChange={(e) => handleChange('area', Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Địa chỉ thửa đất / Vị trí</label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Khối 3: Nội dung & Ghi chú */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                  3. Nội dung thực hiện & Ghi chú
                </span>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nội dung yêu cầu</label>
                  <textarea
                    rows={2}
                    value={formData.content || ''}
                    onChange={(e) => handleChange('content', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Ghi chú chung</label>
                  <textarea
                    rows={2}
                    value={formData.notes || ''}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TỆP ĐÍNH KÈM */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <Paperclip size={28} className="mx-auto text-slate-400 mb-2" />
                <p className="text-xs font-bold text-slate-700">Tệp đính kèm hồ sơ Đăng ký</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tổng cộng: {formData.attachedFiles?.length || 0} tệp
                </p>
              </div>

              {formData.attachedFiles && formData.attachedFiles.length > 0 ? (
                <div className="space-y-2">
                  {formData.attachedFiles.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-blue-600 shrink-0" />
                        <span className="font-bold text-slate-800">{f.fileName}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {f.fileSize ? `${Math.round(f.fileSize / 1024)} KB` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center italic py-6">
                  Hồ sơ chưa có tệp đính kèm.
                </p>
              )}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* MODAL XÁC NHẬN CHUYỂN BƯỚC & GIAO CÁN BỘ KHÂU TIẾP THEO (VỚI TÌM KIẾM TỔ CẤP GIẤY VÀ ĐÍNH KÈM FILE) */}
      {handoverConfig && (
        <RegistrationStepHandoverModal
          isOpen={!!handoverConfig}
          onClose={() => setHandoverConfig(null)}
          record={formData}
          config={handoverConfig}
          employees={employees}
          currentUser={currentUser}
          onConfirm={handleConfirmStepHandover}
        />
      )}

      {/* MODAL CẤU HÌNH QUY TRÌNH & SLA CẤP GIẤY */}
      <RegistrationWorkflowConfigModal
        isOpen={isWorkflowConfigOpen}
        onClose={() => setIsWorkflowConfigOpen(false)}
        initialProcedureCode={formData.recordType || undefined}
      />
    </div>
  );
};
