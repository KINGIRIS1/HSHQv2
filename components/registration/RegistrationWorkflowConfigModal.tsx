import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, ArrowUp, ArrowDown, Save, RotateCcw, 
  Settings, CheckCircle2, AlertTriangle, Clock, Layers, 
  Copy, Search, Sparkles, FileText, Check, Sliders, Pause
} from 'lucide-react';
import { RecordStatus } from '../../types';
import { CAP_GIAY_SELECTABLE_STATUSES, STATUS_LABELS } from '../../constants';
import { 
  CustomRegistrationProcedure, 
  WorkflowStep, 
  loadCustomProceduresSync, 
  fetchProceduresConfigFromCloud, 
  saveProceduresConfig, 
  resetProceduresToDefault,
  DEFAULT_REGISTRATION_PROCEDURES,
  compareProcedureCodesAscending
} from '../../utils/registrationWorkflows';
import { confirmAction } from '../../utils/appHelpers';

interface RegistrationWorkflowConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialProcedureCode?: string;
}

export const RegistrationWorkflowConfigModal: React.FC<RegistrationWorkflowConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialProcedureCode,
}) => {
  const [procedures, setProcedures] = useState<CustomRegistrationProcedure[]>([]);
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load procedures on open
  useEffect(() => {
    if (isOpen) {
      loadProcedures();
    }
  }, [isOpen]);

  const loadProcedures = async () => {
    setIsLoading(true);
    try {
      // 1. Tải từ memory/localStorage
      const local = [...loadCustomProceduresSync()].sort(compareProcedureCodesAscending);
      setProcedures(local);
      
      // Chọn thủ tục khởi tạo hoặc thủ tục đầu tiên
      if (initialProcedureCode) {
        const found = local.find(p => p.code === initialProcedureCode || initialProcedureCode.includes(p.code));
        setSelectedProcedureId(found ? found.id : (local[0]?.id || ''));
      } else if (local.length > 0) {
        setSelectedProcedureId(local[0].id);
      }

      // 2. Tải đồng bộ mới nhất từ Cloud Supabase
      const cloud = await fetchProceduresConfigFromCloud();
      if (cloud && cloud.length > 0) {
        const sortedCloud = [...cloud].sort(compareProcedureCodesAscending);
        setProcedures(sortedCloud);
        if (initialProcedureCode) {
          const found = sortedCloud.find(p => p.code === initialProcedureCode || initialProcedureCode.includes(p.code));
          if (found) setSelectedProcedureId(found.id);
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải cấu hình quy trình Cấp giấy:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentProcedure = procedures.find(p => p.id === selectedProcedureId) || procedures[0];

  // Lọc và sắp xếp danh sách thủ tục cố định theo thứ tự tăng dần chuẩn (3.1.1 -> 3.8.2)
  const filteredProcedures = procedures
    .filter(p => {
      if (!searchKeyword.trim()) return true;
      const kw = searchKeyword.toLowerCase();
      return p.code.toLowerCase().includes(kw) || p.name.toLowerCase().includes(kw);
    })
    .sort(compareProcedureCodesAscending);

  // Cập nhật thông tin thủ tục đang chọn
  const handleUpdateProcedureField = (field: keyof CustomRegistrationProcedure, value: any) => {
    if (!currentProcedure) return;
    setProcedures(prev => prev.map(p => {
      if (p.id === currentProcedure.id) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  // Thêm thủ tục mới
  const handleAddNewProcedure = () => {
    const newId = `proc_${Date.now()}`;
    const newCode = `3.${procedures.length + 1}.1`;
    const newProc: CustomRegistrationProcedure = {
      id: newId,
      code: newCode,
      name: `Thủ tục Cấp giấy ${newCode}`,
      standardDays: 10,
      description: 'Quy trình giải quyết hồ sơ cấp giấy chứng nhận',
      steps: [
        {
          key: RecordStatus.RECEIVED,
          label: 'Tiếp nhận',
          shortLabel: 'Tiếp nhận',
          description: 'Bộ phận Tiếp nhận và Trả kết quả',
          badgeColor: 'bg-gray-100 text-gray-800',
          durationHours: 8,
          durationDays: 1,
          durationLabel: '1 ngày (8h)'
        },
        {
          key: RecordStatus.APPRAISAL,
          label: 'Thẩm định hồ sơ',
          shortLabel: 'Thẩm định',
          description: 'Cán bộ thụ lý thẩm định hồ sơ',
          badgeColor: 'bg-blue-100 text-blue-800',
          durationHours: 24,
          durationDays: 3,
          durationLabel: '3 ngày (24h)'
        },
        {
          key: RecordStatus.PENDING_PRINT_CERT,
          label: 'In Giấy chứng nhận',
          shortLabel: 'In GCN',
          description: 'In phôi Giấy chứng nhận mới',
          badgeColor: 'bg-teal-100 text-teal-800',
          durationHours: 24,
          durationDays: 3,
          durationLabel: '3 ngày (24h)'
        },
        {
          key: RecordStatus.PENDING_CHECK,
          label: 'Trình kiểm tra',
          shortLabel: 'Trình kiểm tra',
          description: 'Tổ trưởng / Lãnh đạo phòng kiểm tra',
          badgeColor: 'bg-orange-100 text-orange-800',
          durationHours: 8,
          durationDays: 1,
          durationLabel: '1 ngày (8h)'
        },
        {
          key: RecordStatus.PENDING_SIGN,
          label: 'Trình ký duyệt',
          shortLabel: 'Trình ký duyệt',
          description: 'Trình Lãnh đạo Chi nhánh ký duyệt',
          badgeColor: 'bg-purple-100 text-purple-800',
          durationHours: 8,
          durationDays: 1,
          durationLabel: '1 ngày (8h)'
        },
        {
          key: RecordStatus.PENDING_HANDOVER,
          label: 'Hoàn thành',
          shortLabel: 'Hoàn thành',
          description: 'Vào sổ cấp GCN và chuyển Bộ phận Một cửa',
          badgeColor: 'bg-cyan-100 text-cyan-800',
          durationHours: 8,
          durationDays: 1,
          durationLabel: '1 ngày (8h)'
        },
        {
          key: RecordStatus.RETURNED,
          label: 'Trả kết quả',
          shortLabel: 'Trả kết quả',
          description: 'Đã trả kết quả cho người dân (Tạm dừng / Hoàn thành)',
          badgeColor: 'bg-emerald-100 text-emerald-800',
          durationHours: 0,
          durationDays: 0,
          durationLabel: 'Tạm dừng (Hoàn tất)'
        }
      ]
    };

    setProcedures(prev => [...prev, newProc]);
    setSelectedProcedureId(newId);
    setFeedback({ type: 'success', message: `Đã tạo thủ tục mới "${newCode}". Hãy chỉnh sửa các bước và bấm Lưu CSDL.` });
  };

  // Nhân bản thủ tục
  const handleDuplicateProcedure = () => {
    if (!currentProcedure) return;
    const newId = `proc_${Date.now()}`;
    const newCode = `${currentProcedure.code}_copy`;
    const cloned: CustomRegistrationProcedure = {
      ...JSON.parse(JSON.stringify(currentProcedure)),
      id: newId,
      code: newCode,
      name: `${currentProcedure.name} (Bản sao)`,
    };
    setProcedures(prev => [...prev, cloned]);
    setSelectedProcedureId(newId);
    setFeedback({ type: 'success', message: `Đã nhân bản thủ tục thành "${newCode}".` });
  };

  // Xóa thủ tục
  const handleDeleteProcedure = async () => {
    if (!currentProcedure) return;
    if (procedures.length <= 1) {
      setFeedback({ type: 'error', message: 'Hệ thống cần ít nhất một quy trình thủ tục cấp giấy.' });
      return;
    }
    const ok = await confirmAction(
      `Bạn có chắc chắn muốn xóa thủ tục "${currentProcedure.code} - ${currentProcedure.name}" không?\nThao tác này sẽ loại bỏ quy trình khỏi danh sách áp dụng.`,
      'Xác nhận xóa thủ tục'
    );
    if (!ok) return;

    const remaining = procedures.filter(p => p.id !== currentProcedure.id);
    setProcedures(remaining);
    setSelectedProcedureId(remaining[0]?.id || '');
    setFeedback({ type: 'success', message: `Đã xóa thủ tục "${currentProcedure.code}". Bấm "Lưu CSDL Supabase" để hoàn tất.` });
  };

  // Cập nhật thông tin một bước
  const handleUpdateStep = (stepIndex: number, field: keyof WorkflowStep, value: any) => {
    if (!currentProcedure) return;
    const updatedSteps = [...currentProcedure.steps];
    const targetStep = { ...updatedSteps[stepIndex], [field]: value };

    // Tự động đồng bộ giờ khi đổi ngày
    if (field === 'durationDays') {
      const numDays = parseFloat(value) || 0;
      targetStep.durationHours = Math.round(numDays * 8);
      targetStep.durationLabel = numDays === 0 ? 'Tạm dừng (Ngoài SLA)' : `${numDays} ngày (${targetStep.durationHours}h)`;
      if (numDays > 0) {
        targetStep.isPaused = false;
      }
    } else if (field === 'durationHours') {
      const numHours = parseFloat(value) || 0;
      targetStep.durationDays = parseFloat((numHours / 8).toFixed(2));
      targetStep.durationLabel = numHours === 0 ? 'Tạm dừng (Ngoài SLA)' : `${targetStep.durationDays} ngày (${numHours}h)`;
      if (numHours > 0) {
        targetStep.isPaused = false;
      }
    }

    // Nếu đổi key (status), cập nhật label mặc định nếu chưa nhập
    if (field === 'key') {
      const foundLabel = STATUS_LABELS[value as RecordStatus] || value;
      if (!targetStep.label || targetStep.label === 'Bước mới') {
        targetStep.label = foundLabel;
        targetStep.shortLabel = foundLabel;
      }
    }

    updatedSteps[stepIndex] = targetStep;
    handleUpdateProcedureField('steps', updatedSteps);
  };

  // Cập nhật nhiều thuộc tính của một bước cùng lúc (tránh lỗi race condition state)
  const handleUpdateStepFields = (stepIndex: number, updates: Partial<WorkflowStep>) => {
    if (!currentProcedure) return;
    const updatedSteps = currentProcedure.steps.map((st, idx) => {
      if (idx !== stepIndex) return st;
      const targetStep = { ...st, ...updates };
      if ('durationDays' in updates) {
        const numDays = parseFloat(updates.durationDays as any) || 0;
        targetStep.durationHours = Math.round(numDays * 8);
        targetStep.durationLabel = numDays === 0 ? 'Tạm dừng (Ngoài SLA)' : `${numDays} ngày (${targetStep.durationHours}h)`;
      } else if ('durationHours' in updates) {
        const numHours = parseFloat(updates.durationHours as any) || 0;
        targetStep.durationDays = parseFloat((numHours / 8).toFixed(2));
        targetStep.durationLabel = numHours === 0 ? 'Tạm dừng (Ngoài SLA)' : `${targetStep.durationDays} ngày (${numHours}h)`;
      }
      return targetStep;
    });
    handleUpdateProcedureField('steps', updatedSteps);
  };

  // Thêm bước mới vào quy trình
  const handleAddStep = () => {
    if (!currentProcedure) return;
    const newStepIndex = currentProcedure.steps.length + 1;
    const newStep: WorkflowStep = {
      key: RecordStatus.APPRAISAL,
      label: `Bước ${newStepIndex}: Xử lý nghiệp vụ`,
      shortLabel: `Bước ${newStepIndex}`,
      description: 'Cán bộ thực hiện xử lý chuyên môn',
      badgeColor: 'bg-blue-100 text-blue-800',
      durationHours: 8,
      durationDays: 1,
      durationLabel: '1 ngày (8h)'
    };
    handleUpdateProcedureField('steps', [...currentProcedure.steps, newStep]);
  };

  // Xóa bước
  const handleDeleteStep = (stepIndex: number) => {
    if (!currentProcedure) return;
    if (currentProcedure.steps.length <= 1) {
      setFeedback({ type: 'error', message: 'Quy trình phải có ít nhất 1 bước.' });
      return;
    }
    const updatedSteps = currentProcedure.steps.filter((_, idx) => idx !== stepIndex);
    handleUpdateProcedureField('steps', updatedSteps);
  };

  // Di chuyển bước lên
  const handleMoveStepUp = (stepIndex: number) => {
    if (!currentProcedure || stepIndex <= 0) return;
    const updatedSteps = [...currentProcedure.steps];
    const temp = updatedSteps[stepIndex];
    updatedSteps[stepIndex] = updatedSteps[stepIndex - 1];
    updatedSteps[stepIndex - 1] = temp;
    handleUpdateProcedureField('steps', updatedSteps);
  };

  // Di chuyển bước xuống
  const handleMoveStepDown = (stepIndex: number) => {
    if (!currentProcedure || stepIndex >= currentProcedure.steps.length - 1) return;
    const updatedSteps = [...currentProcedure.steps];
    const temp = updatedSteps[stepIndex];
    updatedSteps[stepIndex] = updatedSteps[stepIndex + 1];
    updatedSteps[stepIndex + 1] = temp;
    handleUpdateProcedureField('steps', updatedSteps);
  };

  // Khôi phục mặc định
  const handleResetToDefault = async () => {
    const ok = await confirmAction(
      'Bạn có chắc chắn muốn KHÔI PHỤC TOÀN BỘ quy trình Cấp giấy về mẫu chuẩn mặc định của hệ thống không?\n\nMọi thay đổi tùy biến chưa lưu sẽ bị ghi đè.',
      'Khôi phục quy trình chuẩn'
    );
    if (!ok) return;

    setIsSaving(true);
    try {
      const defaults = await resetProceduresToDefault();
      setProcedures(defaults);
      setSelectedProcedureId(defaults[0]?.id || '');
      setFeedback({ type: 'success', message: 'Đã khôi phục toàn bộ quy trình và SLA Cấp giấy về chuẩn mặc định!' });
      if (onSaved) onSaved();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Không thể khôi phục mặc định.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Lưu toàn bộ cấu hình lên Supabase
  const handleSaveToCloud = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const ok = await saveProceduresConfig(procedures);
      if (ok) {
        setFeedback({ type: 'success', message: 'Đã lưu thành công toàn bộ quy trình & các bước vào CSDL Supabase!' });
        if (onSaved) onSaved();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setFeedback({ type: 'error', message: 'Lỗi khi lưu vào Supabase. Đã lưu tạm bộ nhớ trình duyệt.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Lỗi: ${err?.message || 'Không thể lưu CSDL'}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Tính tổng giờ làm việc thực tế trong SLA của thủ tục hiện tại
  const totalWorkingHours = currentProcedure?.steps.reduce((sum, s) => {
    return sum + (s.durationHours || 0);
  }, 0) || 0;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl">
              <Sliders className="text-blue-400" size={24} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
                <span>Thiết lập Quy trình & Các bước áp dụng - Module Cấp giấy</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  Nhóm 3.x
                </span>
              </h2>
              <p className="text-xs text-blue-200/80 font-medium">
                Cấu hình danh mục thủ tục, thứ tự các bước, thời hạn định mức (SLA) và trạng thái hệ thống tương ứng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div className={`px-5 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <span className="flex items-center gap-1.5">
              {feedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              {feedback.message}
            </span>
            <button onClick={() => setFeedback(null)} className="p-1 hover:bg-black/5 rounded">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Body Container */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-100">
          {/* CỘT TRÁI: DANH SÁCH THỦ TỤC */}
          <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
            {/* Thanh tìm kiếm & nút thêm thủ tục */}
            <div className="p-3 border-b border-slate-200 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm mã hoặc tên thủ tục..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <button
                type="button"
                onClick={handleAddNewProcedure}
                className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={15} />
                <span>Thêm thủ tục mới</span>
              </button>
            </div>

            {/* Danh sách thủ tục */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredProcedures.map((proc) => {
                const isSelected = proc.id === currentProcedure?.id;
                return (
                  <div
                    key={proc.id}
                    onClick={() => setSelectedProcedureId(proc.id)}
                    className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-semibold'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-blue-700'
                      }`}>
                        {proc.code}
                      </span>
                      <span className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {proc.steps.length} bước • {proc.standardDays} ngày
                      </span>
                    </div>
                    <div className="line-clamp-2 leading-relaxed">
                      {proc.name}
                    </div>
                  </div>
                );
              })}
              {filteredProcedures.length === 0 && (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Không tìm thấy thủ tục nào khớp từ khóa.
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: THIẾT LẬP CHI TIẾT THỦ TỤC & CÁC BƯỚC */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {currentProcedure ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header chi tiết thủ tục */}
                <div className="p-4 bg-white border-b border-slate-200 space-y-3 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mã thủ tục:</span>
                      <input
                        type="text"
                        value={currentProcedure.code}
                        onChange={(e) => handleUpdateProcedureField('code', e.target.value)}
                        className="px-2.5 py-1 text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg w-28 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        title="Mã định danh thủ tục (VD: 3.1.1, 3.2.1, 3.7.1...)"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDuplicateProcedure}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Tạo bản sao thủ tục này"
                      >
                        <Copy size={13} />
                        <span>Nhân bản</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteProcedure}
                        className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Xóa thủ tục này"
                      >
                        <Trash2 size={13} />
                        <span>Xóa thủ tục</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                        Tên thủ tục
                      </label>
                      <input
                        type="text"
                        value={currentProcedure.name}
                        onChange={(e) => handleUpdateProcedureField('name', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        placeholder="Nhập tên thủ tục..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                        Tổng ngày chuẩn (SLA)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={currentProcedure.standardDays}
                          onChange={(e) => handleUpdateProcedureField('standardDays', parseFloat(e.target.value) || 0)}
                          className="w-24 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <span className="text-xs text-slate-500 font-medium">ngày làm việc</span>
                      </div>
                    </div>
                  </div>

                  {/* Thanh tóm tắt SLA các bước */}
                  <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-blue-900 font-medium">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Layers size={14} className="text-blue-600" />
                        <span>Tổng số bước: <strong>{currentProcedure.steps.length} bước</strong></span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-blue-600" />
                        <span>Tổng định mức các bước: <strong>{totalWorkingHours} giờ ({parseFloat((totalWorkingHours / 8).toFixed(1))} ngày)</strong></span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Thêm bước mới</span>
                    </button>
                  </div>
                </div>

                {/* Danh sách các bước trong quy trình (Steps) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Thứ tự các bước thực hiện & Phân bổ thời gian:</span>
                    <span className="text-[11px] font-normal text-slate-400">Dùng mũi tên ↑ ↓ để thay đổi thứ tự bước</span>
                  </div>

                  {currentProcedure.steps.map((step, idx) => {
                    const isPausedStep = step.durationHours === 0;

                    return (
                      <div
                        key={step.id || `step_${idx}`}
                        className={`bg-white rounded-xl border p-3.5 shadow-2xs transition-all space-y-3 ${
                          isPausedStep ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Hàng 1: Số thứ tự, Tên bước, Nút di chuyển & Xóa */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={step.label || step.name || ''}
                              onChange={(e) => handleUpdateStep(idx, 'label', e.target.value)}
                              placeholder={`Tên bước ${idx + 1}...`}
                              className="w-full max-w-md px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                            {isPausedStep && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 shrink-0">
                                <Pause size={10} />
                                <span>Tạm dừng / Ngoài SLA</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveStepUp(idx)}
                              disabled={idx === 0}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
                              title="Di chuyển lên trên"
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStepDown(idx)}
                              disabled={idx === currentProcedure.steps.length - 1}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
                              title="Di chuyển xuống dưới"
                            >
                              <ArrowDown size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStep(idx)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-1"
                              title="Xóa bước này"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Hàng 2: Trạng thái hệ thống tương ứng & Định mức thời gian */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
                          {/* Trạng thái hệ thống */}
                          <div className="lg:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Trạng thái hệ thống liên kết:
                            </label>
                            <select
                              value={step.key}
                              onChange={(e) => handleUpdateStep(idx, 'key', e.target.value as RecordStatus)}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                              {CAP_GIAY_SELECTABLE_STATUSES.map((st) => (
                                <option key={st.key} value={st.key}>
                                  {st.label} ({st.key})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Định mức ngày */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Định mức (Ngày):
                            </label>
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={step.durationDays || 0}
                              onChange={(e) => handleUpdateStep(idx, 'durationDays', parseFloat(e.target.value) || 0)}
                              className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </div>

                          {/* Định mức giờ */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Định mức (Giờ):
                            </label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={step.durationHours || 0}
                              onChange={(e) => handleUpdateStep(idx, 'durationHours', parseFloat(e.target.value) || 0)}
                              className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </div>
                        </div>

                        {/* Tích chọn Tạm dừng SLA cho bước này */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={Boolean(step.isPaused)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                if (checked) {
                                  handleUpdateStepFields(idx, {
                                    isPaused: true,
                                    durationDays: 0,
                                    durationHours: 0,
                                    durationLabel: 'Tạm dừng (Ngoài SLA)',
                                  });
                                } else {
                                  const restoredDays = (step.durationDays && step.durationDays > 0) ? step.durationDays : 1;
                                  const restoredHours = Math.round(restoredDays * 8);
                                  handleUpdateStepFields(idx, {
                                    isPaused: false,
                                    durationDays: restoredDays,
                                    durationHours: restoredHours,
                                    durationLabel: `${restoredDays} ngày (${restoredHours}h)`,
                                  });
                                }
                              }}
                              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Pause size={12} className="text-amber-600" />
                              <span>Tạm dừng tính SLA cho bước này (Không tính vào tổng SLA)</span>
                            </span>
                          </label>
                          {Boolean(step.isPaused) && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Ngoài SLA
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Sliders size={48} className="text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-600">Vui lòng chọn hoặc thêm một thủ tục ở danh sách bên trái.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Toolbar */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={isSaving}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Khôi phục toàn bộ các thủ tục và bước về mặc định chuẩn"
            >
              <RotateCcw size={14} />
              <span>Khôi phục mặc định</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleSaveToCloud}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save size={15} />
              <span>{isSaving ? 'Đang lưu vào CSDL...' : 'Lưu CSDL Supabase'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
