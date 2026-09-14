import React, { useState } from 'react';
import {
  X,
  FileText,
  Save,
  AlertCircle,
  Paperclip,
} from 'lucide-react';
import { RecordFile, Employee, RecordStatus, RecordStatusLog } from '../../types';

interface RegistrationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  onSave: (updatedRecord: RecordFile) => Promise<void>;
  employees: Employee[];
}

export const RegistrationDetailModal: React.FC<RegistrationDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  onSave,
  employees,
}) => {
  if (!isOpen || !record) return null;

  const [formData, setFormData] = useState<RecordFile>({ ...record });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'info' | 'status' | 'attachments'>('info');

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

  const handleStatusChange = (newStatus: RecordStatus) => {
    const now = new Date().toISOString();
    const newLog: RecordStatusLog = {
      id: crypto.randomUUID(),
      recordId: formData.id,
      previousStatus: formData.status,
      newStatus,
      changedBy: formData.assignedTo || 'Người dùng',
      changedAt: now,
    };

    setFormData((prev) => ({
      ...prev,
      status: newStatus,
      statusLogs: [...(prev.statusLogs || []), newLog],
      ...(newStatus === RecordStatus.PENDING_CHECK && !prev.pendingCheckDate ? { pendingCheckDate: now.substring(0, 10) } : {}),
      ...(newStatus === RecordStatus.PENDING_SIGN && !prev.submissionDate ? { submissionDate: now.substring(0, 10) } : {}),
      ...(newStatus === RecordStatus.SIGNED && !prev.approvalDate ? { approvalDate: now.substring(0, 10) } : {}),
      ...(newStatus === RecordStatus.RETURNED && !prev.resultReturnedDate ? { resultReturnedDate: now.substring(0, 10) } : {}),
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

  const statusButtons: { key: RecordStatus; label: string }[] = [
    { key: RecordStatus.RECEIVED, label: 'Tiếp nhận / Chờ phân công' },
    { key: RecordStatus.IN_PROGRESS, label: 'Đang thực hiện' },
    { key: RecordStatus.PENDING_CHECK, label: 'Chờ kiểm tra' },
    { key: RecordStatus.PENDING_SIGN, label: 'Chờ ký duyệt' },
    { key: RecordStatus.SIGNED, label: 'Đã ký duyệt / Chờ bàn giao' },
    { key: RecordStatus.HANDOVER, label: 'Đã giao 1 cửa' },
    { key: RecordStatus.RETURNED, label: 'Đã trả kết quả' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <FileText size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{formData.code}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white">
                  {formData.group || '3. Đăng ký đất đai'}
                </span>
              </div>
              <p className="text-xs text-blue-100 mt-0.5">{formData.customerName || 'Chưa có tên chủ'}</p>
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

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center px-6 border-b border-slate-200 bg-slate-50 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-700 bg-white px-3 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Thông tin hồ sơ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'status'
                ? 'border-blue-600 text-blue-700 bg-white px-3 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Tiến độ & Trạng thái
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attachments')}
            className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'attachments'
                ? 'border-blue-600 text-blue-700 bg-white px-3 rounded-t-lg'
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

          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* Khối 1: Thông tin chủ sử dụng */}
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
                  2. Thông tin thửa đất & Địa chỉ
                </span>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tờ bản đồ</label>
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
                      value={formData.area || 0}
                      onChange={(e) => handleChange('area', Number(e.target.value))}
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

          {activeTab === 'status' && (
            <div className="space-y-4">
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                  Chuyển trạng thái xử lý
                </span>
                <div className="flex flex-wrap gap-2">
                  {statusButtons.map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => handleStatusChange(st.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        formData.status === st.key
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                    Cán bộ & Hạn giải quyết
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
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  </div>
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

                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                    Lịch sử trạng thái
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {formData.statusLogs && formData.statusLogs.length > 0 ? (
                      formData.statusLogs.map((log) => (
                        <div key={log.id} className="p-2 bg-white rounded-lg border border-slate-200 text-xs">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span>{log.newStatus}</span>
                            <span className="text-[11px] text-slate-500">
                              {log.changedAt ? log.changedAt.substring(0, 10) : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            Bởi: {log.changedBy}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">Chưa có lịch sử trạng thái.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

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
