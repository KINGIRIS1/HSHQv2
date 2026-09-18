import React, { useState } from 'react';
import {
  X,
  FileText,
  Save,
  AlertCircle,
  Paperclip,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building,
  DollarSign,
  Printer,
  FileCheck,
} from 'lucide-react';
import { RecordFile, Employee, User as AppUser, RecordStatus, RecordStatusLog } from '../../types';
import { RegistrationWorkflowStepper } from './RegistrationWorkflowStepper';
import {
  getRegistrationWorkflow,
  WorkflowStep,
  getAppointmentInfo,
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

  React.useEffect(() => {
    setFormData({ ...record });
  }, [record]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleChange = (field: keyof RecordFile, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleStatusChange = (
    newStatus: RecordStatus,
    updatedFields?: Partial<RecordFile>,
    note?: string
  ) => {
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
    if (newStatus === RecordStatus.APPRAISAL && !formData.appraisalDate) autoDates.appraisalDate = today;
    if (newStatus === RecordStatus.TAX_TRANSFER && !formData.taxTransferDate) autoDates.taxTransferDate = today;
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

    setFormData((prev) => ({
      ...prev,
      status: newStatus,
      statusLogs: [...(prev.statusLogs || []), newLog],
      ...autoDates,
      ...(updatedFields || {}),
    }));
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

  const workflow = getRegistrationWorkflow(formData.recordType);

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
            onChangeStatus={handleStatusChange}
            currentUser={currentUser}
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
            Tiến độ & Chuyển bước
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

          {/* TAB 1: TIẾN ĐỘ & TRẠNG THÁI */}
          {activeTab === 'status' && (
            <div className="space-y-5">
              {/* Khối các nút chuyển trạng thái của quy trình */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                    Các bước quy trình áp dụng cho hồ sơ này ({workflow.title})
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Bấm để chuyển trực tiếp đến bước tương ứng
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {workflow.steps.map((st) => {
                    const isCurrent = formData.status === st.key;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => handleStatusChange(st.key)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          isCurrent
                            ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                        }`}
                      >
                        {isCurrent && <CheckCircle2 size={13} />}
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Thông tin Cán bộ và Hạn giải quyết */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                    Phân công & Hạn giải quyết
                  </span>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Cán bộ thụ lý</label>
                    <select
                      value={formData.assignedTo || ''}
                      onChange={(e) => handleChange('assignedTo', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                    >
                      <option value="">-- Chưa phân công --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name} {emp.department ? `(${emp.department})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. Thẩm định */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileCheck size={14} className="text-blue-600" />
                    <span>Ngày hoàn thành thẩm định</span>
                  </label>
                  <input
                    type="date"
                    value={formData.appraisalDate || ''}
                    onChange={(e) => handleChange('appraisalDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* 1.1 Niêm yết tại UBND xã */}
                <div className="p-3 bg-white border border-amber-200 rounded-xl space-y-1 bg-amber-50/30">
                  <label className="block text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Building size={14} className="text-amber-600" />
                    <span>Ngày phát hành CV niêm yết xã</span>
                  </label>
                  <input
                    type="date"
                    value={formData.postingDate || ''}
                    onChange={(e) => handleChange('postingDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* 2. Chuyển thuế */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Send size={14} className="text-indigo-600" />
                    <span>Ngày chuyển thông tin thuế</span>
                  </label>
                  <input
                    type="date"
                    value={formData.taxTransferDate || ''}
                    onChange={(e) => handleChange('taxTransferDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* 3. Thuế KV7 */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Building size={14} className="text-violet-600" />
                    <span>Ngày nhận TB thuế KV7</span>
                  </label>
                  <input
                    type="date"
                    value={formData.taxKv7Date || ''}
                    onChange={(e) => handleChange('taxKv7Date', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* 4. Giấy nộp tiền */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <DollarSign size={14} className="text-amber-600" />
                    <span>Ngày nộp tiền / Nhận GNT</span>
                  </label>
                  <input
                    type="date"
                    value={formData.taxPaymentDate || ''}
                    onChange={(e) => handleChange('taxPaymentDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* 5. In GCN */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Printer size={14} className="text-teal-600" />
                    <span>Ngày in GCN / Trang 4</span>
                  </label>
                  <input
                    type="date"
                    value={formData.printCertDate || ''}
                    onChange={(e) => handleChange('printCertDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* 6. Trình kiểm tra */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-orange-600" />
                    <span>Ngày trình kiểm tra</span>
                  </label>
                  <input
                    type="date"
                    value={formData.pendingCheckDate || ''}
                    onChange={(e) => handleChange('pendingCheckDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* 7. Trình ký */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Send size={14} className="text-purple-600" />
                    <span>Ngày trình ký duyệt</span>
                  </label>
                  <input
                    type="date"
                    value={formData.submissionDate || ''}
                    onChange={(e) => handleChange('submissionDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* 8. Ký duyệt */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Ngày lãnh đạo ký duyệt</span>
                  </label>
                  <input
                    type="date"
                    value={formData.approvalDate || ''}
                    onChange={(e) => handleChange('approvalDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* 9. Trả kết quả */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-green-600" />
                    <span>Ngày trả kết quả cho dân</span>
                  </label>
                  <input
                    type="date"
                    value={formData.resultReturnedDate || ''}
                    onChange={(e) => handleChange('resultReturnedDate', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

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
    </div>
  );
};
