import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  CheckCircle2,
  Clock,
  Settings,
  HelpCircle,
  FileText,
  Building,
  AlertTriangle,
  Play,
  Pause,
  Layers,
  ChevronRight,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { RecordStatus } from '../../types';
import { CAP_GIAY_SELECTABLE_STATUSES } from '../../constants';
import {
  RegistrationProcedureConfig,
  RegistrationStepConfig,
  WorkingHoursConfig,
  loadProceduresConfig,
  saveProceduresConfig,
  resetProceduresToDefault,
  loadWorkingHoursConfig,
  saveWorkingHoursConfig,
  DEFAULT_PROCEDURES,
  formatDurationShort,
  formatMinutesToVietnamese,
} from '../../utils/registrationWorkflows';

interface RegistrationWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const RegistrationWorkflowModal: React.FC<RegistrationWorkflowModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen) return null;

  const [procedures, setProcedures] = useState<RegistrationProcedureConfig[]>([]);
  const [selectedProcId, setSelectedProcId] = useState<string>('');
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig>(loadWorkingHoursConfig());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Nạp dữ liệu cấu hình khi mở modal
  useEffect(() => {
    const loaded = loadProceduresConfig();
    setProcedures(loaded);
    if (loaded.length > 0) {
      setSelectedProcId(loaded[0].id);
    }
    setWorkingHours(loadWorkingHoursConfig());
    setHasChanges(false);
  }, [isOpen]);

  const selectedProcedure = procedures.find((p) => p.id === selectedProcId) || procedures[0];

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Cập nhật thông tin thủ tục đang chọn
  const handleUpdateProcedure = (fields: Partial<RegistrationProcedureConfig>) => {
    setProcedures((prev) =>
      prev.map((p) => (p.id === selectedProcId ? { ...p, ...fields } : p))
    );
    setHasChanges(true);
  };

  // Thêm thủ tục mới
  const handleAddProcedure = () => {
    const newCode = `3.${procedures.length + 1}.1`;
    const newProc: RegistrationProcedureConfig = {
      id: `proc-${Date.now()}`,
      code: newCode,
      name: `${newCode} Thủ tục mới`,
      totalDays: 10,
      steps: [
        {
          id: `step-${Date.now()}-1`,
          name: 'Tiếp nhận hồ sơ',
          statusKey: RecordStatus.RECEIVED,
          durationHours: 4,
          durationMinutes: 0,
          totalMinutes: 240,
          department: 'Tổ Hành chính',
        },
        {
          id: `step-${Date.now()}-2`,
          name: 'Thẩm định hồ sơ',
          statusKey: RecordStatus.APPRAISAL,
          durationHours: 16,
          durationMinutes: 0,
          totalMinutes: 960,
          department: 'Tổ Cấp giấy',
        },
        {
          id: `step-${Date.now()}-3`,
          name: 'Ký duyệt & Trả kết quả',
          statusKey: RecordStatus.RETURNED,
          durationHours: 8,
          durationMinutes: 0,
          totalMinutes: 480,
          department: 'Ban Giám đốc',
        },
      ],
    };
    setProcedures((prev) => [...prev, newProc]);
    setSelectedProcId(newProc.id);
    setHasChanges(true);
    showToast('success', `Đã tạo thủ tục mới: ${newProc.code}`);
  };

  // Xóa thủ tục
  const handleDeleteProcedure = (procId: string) => {
    if (procedures.length <= 1) {
      showToast('error', 'Phải giữ lại ít nhất 1 thủ tục trong hệ thống.');
      return;
    }
    const target = procedures.find((p) => p.id === procId);
    if (!target) return;
    if (confirm(`Anh/Chị có chắc chắn muốn xóa thủ tục "${target.name}" không?`)) {
      const remaining = procedures.filter((p) => p.id !== procId);
      setProcedures(remaining);
      setSelectedProcId(remaining[0].id);
      setHasChanges(true);
      showToast('success', `Đã xóa thủ tục ${target.code}`);
    }
  };

  // Khôi phục bộ mẫu chuẩn 15 thủ tục
  const handleResetDefaults = () => {
    if (confirm('Khôi phục toàn bộ 15 quy trình chuẩn 3.x và khung giờ làm việc mặc định? Các tùy biến chưa lưu sẽ bị xóa.')) {
      const defs = resetProceduresToDefault();
      setProcedures(defs);
      setSelectedProcId(defs[0].id);
      setWorkingHours(loadWorkingHoursConfig());
      setHasChanges(false);
      showToast('success', 'Đã nạp lại toàn bộ 15 quy trình chuẩn 3.x!');
    }
  };

  // Cập nhật 1 bước trong thủ tục đang chọn
  const handleUpdateStep = (stepId: string, fields: Partial<RegistrationStepConfig>) => {
    if (!selectedProcedure) return;
    const updatedSteps = selectedProcedure.steps.map((step) => {
      if (step.id !== stepId) return step;
      const updated = { ...step, ...fields };
      const hours = Number(updated.durationHours) || 0;
      const mins = Number(updated.durationMinutes) || 0;
      updated.totalMinutes = hours * 60 + mins;
      return updated;
    });

    handleUpdateProcedure({ steps: updatedSteps });
  };

  // Thêm bước mới vào thủ tục đang chọn
  const handleAddStep = () => {
    if (!selectedProcedure) return;
    const newStep: RegistrationStepConfig = {
      id: `step-${Date.now()}`,
      name: `Bước ${selectedProcedure.steps.length + 1}`,
      statusKey: RecordStatus.APPRAISAL,
      durationHours: 8,
      durationMinutes: 0,
      totalMinutes: 480,
      department: 'Tổ Cấp giấy',
    };
    handleUpdateProcedure({ steps: [...selectedProcedure.steps, newStep] });
  };

  // Xóa bước
  const handleDeleteStep = (stepId: string) => {
    if (!selectedProcedure) return;
    if (selectedProcedure.steps.length <= 1) {
      showToast('error', 'Một quy trình phải có tối thiểu 1 bước.');
      return;
    }
    const updatedSteps = selectedProcedure.steps.filter((s) => s.id !== stepId);
    handleUpdateProcedure({ steps: updatedSteps });
  };

  // Di chuyển thứ tự bước lên / xuống
  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (!selectedProcedure) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedProcedure.steps.length) return;

    const list = [...selectedProcedure.steps];
    const [moved] = list.splice(index, 1);
    list.splice(newIndex, 0, moved);
    handleUpdateProcedure({ steps: list });
  };

  // Lưu toàn bộ cấu hình
  const handleSaveAll = () => {
    saveProceduresConfig(procedures);
    saveWorkingHoursConfig(workingHours);
    setHasChanges(false);
    showToast('success', 'Đã lưu thành công cấu hình Trạng thái & SLA!');
    if (onSaved) onSaved();
  };

  // Lọc danh sách thủ tục
  const filteredProcedures = procedures.filter((p) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase().trim();
    return p.code.toLowerCase().includes(s) || p.name.toLowerCase().includes(s);
  });

  // Tính tổng thời gian các bước của thủ tục hiện tại
  const totalStepMinutes = selectedProcedure
    ? selectedProcedure.steps.reduce((acc, s) => acc + (s.isSlaPaused ? 0 : s.totalMinutes), 0)
    : 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl shadow-xs">
              <Settings size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg tracking-tight">
                  Cấu hình Trạng thái, Quy trình & Thiết lập SLA
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Toàn bộ Thủ tục 3.x
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Thiết lập động các bước, trạng thái, định mức giờ làm việc và quy tắc SLA cho Module Cấp giấy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              title="Khôi phục toàn bộ mẫu chuẩn"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
            >
              <RotateCcw size={13} />
              <span>Nạp mẫu chuẩn</span>
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:shadow-md"
            >
              <Save size={14} />
              <span>Lưu cấu hình</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* FEEDBACK TOAST */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-0.5 hover:bg-black/5 rounded cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* MODAL BODY (2-COLUMN LAYOUT) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 bg-slate-50">
          {/* CỘT TRÁI: DANH SÁCH THỦ TỤC 3.X */}
          <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
            {/* Header Cột Trái & Tìm kiếm */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} className="text-blue-600" />
                  <span>Danh mục Thủ tục ({procedures.length})</span>
                </span>
                <button
                  type="button"
                  onClick={handleAddProcedure}
                  className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer border border-blue-200"
                >
                  <Plus size={13} />
                  <span>Thêm</span>
                </button>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm thủ tục 3.x..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* List Thủ tục */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredProcedures.map((proc) => {
                const isSelected = proc.id === selectedProcId;
                return (
                  <div
                    key={proc.id}
                    onClick={() => setSelectedProcId(proc.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-300 text-blue-900 shadow-2xs font-bold'
                        : 'bg-white border-slate-100 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-blue-600 text-white">
                          {proc.code}
                        </span>
                        <span className="text-xs truncate font-bold text-slate-900" title={proc.name}>
                          {proc.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        {proc.steps.length} bước • {proc.totalDays} ngày định mức
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {procedures.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProcedure(proc.id);
                          }}
                          title="Xóa thủ tục"
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      <ChevronRight
                        size={14}
                        className={isSelected ? 'text-blue-600' : 'text-slate-300'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Khung giờ hành chính tóm tắt ở đáy */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1">
                <Clock size={12} className="text-blue-600" />
                <span>Khung giờ hành chính:</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 pl-4">
                <span>Sáng: <strong>{workingHours.morningStart} - {workingHours.morningEnd}</strong> (4h)</span>
                <span>Chiều: <strong>{workingHours.afternoonStart} - {workingHours.afternoonEnd}</strong> (4h)</span>
              </div>
              <p className="text-[10px] text-slate-400 italic pl-4">
                * Nghỉ trưa 11:30 - 13:30, T7, CN và Lễ không tính vào SLA.
              </p>
            </div>
          </div>

          {/* CỘT PHẢI: CẤU HÌNH CHI TIẾT THỦ TỤC & CÁC BƯỚC */}
          <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 space-y-5">
            {selectedProcedure ? (
              <>
                {/* THÔNG TIN CHUNG THỦ TỤC */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={15} className="text-blue-600" />
                      <span>Thông tin chung của Thủ tục</span>
                    </span>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      Mã thủ tục: {selectedProcedure.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Tên đầy đủ của thủ tục:
                      </label>
                      <input
                        type="text"
                        value={selectedProcedure.name}
                        onChange={(e) => handleUpdateProcedure({ name: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Tổng thời hạn hẹn trả (Ngày):
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={selectedProcedure.totalDays}
                        onChange={(e) =>
                          handleUpdateProcedure({ totalDays: Number(e.target.value) || 10 })
                        }
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* DANH SÁCH CÁC BƯỚC QUY TRÌNH & THIẾT LẬP SLA */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock size={15} className="text-blue-600" />
                        <span>Các bước Tiến độ, Trạng thái & Định mức SLA ({selectedProcedure.steps.length} bước)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tổng thời gian các bước tính SLA: <strong>{formatMinutesToVietnamese(totalStepMinutes)}</strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Thêm bước mới</span>
                    </button>
                  </div>

                  {/* VÒNG LẶP CÁC BƯỚC */}
                  <div className="space-y-3">
                    {selectedProcedure.steps.map((step, idx) => {
                      const isPaused = Boolean(step.isSlaPaused);

                      return (
                        <div
                          key={step.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isPaused
                              ? 'bg-amber-50/40 border-amber-200'
                              : 'bg-white border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          {/* Dòng 1: STT, Tên bước, Nút Di chuyển, Nút Xóa */}
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <input
                                type="text"
                                value={step.name}
                                onChange={(e) => handleUpdateStep(step.id, { name: e.target.value })}
                                placeholder="Tên bước luân chuyển..."
                                className="flex-1 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:bg-white focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            {/* Nút điều hướng thứ tự */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveStep(idx, 'up')}
                                title="Di chuyển lên trên"
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === selectedProcedure.steps.length - 1}
                                onClick={() => handleMoveStep(idx, 'down')}
                                title="Di chuyển xuống dưới"
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <ArrowDown size={14} />
                              </button>
                              {selectedProcedure.steps.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStep(step.id)}
                                  title="Xóa bước này"
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer ml-1"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Dòng 2: Cấu hình Trạng thái, Định mức Giờ & Phút, Phòng ban & Cơ chế Tạm dừng */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center text-xs">
                            {/* Trạng thái liên kết (4 cột) */}
                            <div className="sm:col-span-4">
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                Trạng thái hồ sơ tương ứng:
                              </label>
                              <select
                                value={step.statusKey}
                                onChange={(e) =>
                                  handleUpdateStep(step.id, { statusKey: e.target.value as RecordStatus })
                                }
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:bg-white"
                              >
                                {CAP_GIAY_SELECTABLE_STATUSES.map((st) => (
                                  <option key={st.key} value={st.key}>
                                    {st.label} ({st.key})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Định mức thời gian (Giờ & Phút) (4 cột) */}
                            <div className="sm:col-span-4">
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                Định mức thời gian giải quyết:
                              </label>
                              <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1 flex-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="240"
                                    value={step.durationHours}
                                    onChange={(e) =>
                                      handleUpdateStep(step.id, { durationHours: Number(e.target.value) || 0 })
                                    }
                                    disabled={isPaused}
                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:bg-white disabled:opacity-40"
                                  />
                                  <span className="text-[11px] font-bold text-slate-500">Giờ</span>
                                </div>

                                <div className="flex items-center gap-1 flex-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    step="5"
                                    value={step.durationMinutes || 0}
                                    onChange={(e) =>
                                      handleUpdateStep(step.id, { durationMinutes: Number(e.target.value) || 0 })
                                    }
                                    disabled={isPaused}
                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:bg-white disabled:opacity-40"
                                  />
                                  <span className="text-[11px] font-bold text-slate-500">Phút</span>
                                </div>
                              </div>
                            </div>

                            {/* Phòng ban phụ trách (2 cột) */}
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                Bộ phận phụ trách:
                              </label>
                              <input
                                type="text"
                                value={step.department || ''}
                                onChange={(e) => handleUpdateStep(step.id, { department: e.target.value })}
                                placeholder="Tổ Cấp giấy..."
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:bg-white"
                              />
                            </div>

                            {/* Cờ Tạm dừng SLA (2 cột) */}
                            <div className="sm:col-span-2 flex flex-col justify-end">
                              <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={isPaused}
                                  onChange={(e) =>
                                    handleUpdateStep(step.id, {
                                      isSlaPaused: e.target.checked,
                                      pauseReason: e.target.checked ? 'Chờ thực hiện nghĩa vụ' : undefined,
                                    })
                                  }
                                  className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-gray-300 cursor-pointer"
                                />
                                <span>⏸️ Tạm dừng SLA</span>
                              </label>
                            </div>
                          </div>

                          {/* Mẫu Xem Trước Tiêu Đề Cùng Hàng (Preview) */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-700">
                              <span className="text-slate-400">Xem trước Tiêu đề Bước:</span>
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-900 border border-slate-200">
                                Bước {idx + 1}: {step.name.toUpperCase()} | Định mức: {formatDurationShort(step.totalMinutes || 0)} | {isPaused ? '[⏸️ Tạm dừng tính SLA (Chờ nộp tiền)]' : '[⏱️ Còn lại 3 giờ 45 phút]'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {hasChanges ? (
              <span className="text-amber-600 font-bold flex items-center gap-1">
                <AlertTriangle size={13} />
                <span>Có thay đổi chưa được lưu vào hệ thống</span>
              </span>
            ) : (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 size={13} />
                <span>Toàn bộ cấu hình đã được đồng bộ hóa</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Save size={14} />
              <span>Lưu và Áp dụng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
