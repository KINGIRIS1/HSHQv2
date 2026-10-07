import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, ArrowUp, ArrowDown, Save, RotateCcw, 
  CheckCircle2, AlertTriangle, Clock, Layers, 
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

interface RegistrationWorkflowSettingsTabProps {
  onSaved?: () => void;
  initialProcedureCode?: string;
}

export const RegistrationWorkflowSettingsTab: React.FC<RegistrationWorkflowSettingsTabProps> = ({
  onSaved,
  initialProcedureCode,
}) => {
  const [procedures, setProcedures] = useState<CustomRegistrationProcedure[]>([]);
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load procedures on mount
  useEffect(() => {
    loadProcedures();
  }, []);

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

      // 2. Tải đồng bộ mới nhất từ Supabase Cloud
      const cloudProcs = await fetchProceduresConfigFromCloud();
      if (cloudProcs && cloudProcs.length > 0) {
        const sortedCloud = [...cloudProcs].sort(compareProcedureCodesAscending);
        setProcedures(sortedCloud);
        if (initialProcedureCode) {
          const foundCloud = sortedCloud.find(p => p.code === initialProcedureCode || initialProcedureCode.includes(p.code));
          if (foundCloud) setSelectedProcedureId(foundCloud.id);
        } else if (!selectedProcedureId) {
          setSelectedProcedureId(sortedCloud[0].id);
        }
      }
    } catch (e: any) {
      console.warn('Lỗi tải cấu hình quy trình từ Cloud:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const currentProcedure = procedures.find(p => p.id === selectedProcedureId) || procedures[0];

  // Lọc và sắp xếp danh sách thủ tục cố định theo thứ tự tăng dần chuẩn (3.1.1 -> 3.8.2)
  const filteredProcedures = procedures
    .filter(p => {
      if (!searchKeyword.trim()) return true;
      const kw = searchKeyword.toLowerCase();
      return p.code.toLowerCase().includes(kw) || p.name.toLowerCase().includes(kw);
    })
    .sort(compareProcedureCodesAscending);

  // Cập nhật thông tin chung của thủ tục hiện tại
  const handleUpdateProcedureField = (field: keyof CustomRegistrationProcedure, value: any) => {
    if (!currentProcedure) return;
    setProcedures(prev => prev.map(p => {
      if (p.id !== currentProcedure.id) return p;
      return { ...p, [field]: value };
    }));
  };

  // Thêm mới một thủ tục cấp giấy
  const handleAddNewProcedure = () => {
    const newIndex = procedures.length + 1;
    const newCode = `3.${newIndex}.1`;
    const newId = `proc_${Date.now()}`;
    const newProc: CustomRegistrationProcedure = {
      id: newId,
      code: newCode,
      name: `Thủ tục cấp giấy mới (${newCode})`,
      standardDays: 10,
      description: 'Quy trình tiếp nhận và thẩm định hồ sơ đăng ký cấp GCN',
      steps: [
        {
          key: RecordStatus.RECEIVED,
          label: 'Tiếp nhận hồ sơ',
          shortLabel: 'Tiếp nhận',
          description: 'Tiếp nhận hồ sơ đầu vào từ bộ phận Một Cửa',
          badgeColor: 'bg-blue-100 text-blue-800',
          durationHours: 8,
          durationDays: 1,
          durationLabel: '1 ngày (8h)'
        },
        {
          key: RecordStatus.APPRAISAL,
          label: 'Thẩm định hồ sơ',
          shortLabel: 'Thẩm định',
          description: 'Cán bộ thụ lý kiểm tra tính pháp lý và hiện trạng',
          badgeColor: 'bg-indigo-100 text-indigo-800',
          durationHours: 24,
          durationDays: 3,
          durationLabel: '3 ngày (24h)'
        },
        {
          key: RecordStatus.PENDING_PRINT_CERT,
          label: 'In Giấy chứng nhận',
          shortLabel: 'In GCN',
          description: 'In phôi Giấy chứng nhận và hoàn thiện văn bản',
          badgeColor: 'bg-teal-100 text-teal-800',
          durationHours: 16,
          durationDays: 2,
          durationLabel: '2 ngày (16h)'
        },
        {
          key: RecordStatus.PENDING_CHECK,
          label: 'Trình kiểm tra',
          shortLabel: 'Kiểm tra',
          description: 'Trình Lãnh đạo tổ kiểm tra trước khi ký',
          badgeColor: 'bg-purple-100 text-purple-800',
          durationHours: 16,
          durationDays: 2,
          durationLabel: '2 ngày (16h)'
        },
        {
          key: RecordStatus.PENDING_SIGN,
          label: 'Trình ký duyệt',
          shortLabel: 'Trình ký',
          description: 'Trình Giám đốc / Lãnh đạo ký duyệt GCN',
          badgeColor: 'bg-cyan-100 text-cyan-800',
          durationHours: 16,
          durationDays: 2,
          durationLabel: '2 ngày (16h)'
        },
        {
          key: RecordStatus.HANDOVER,
          label: 'Bàn giao Một Cửa',
          shortLabel: 'Bàn giao 1C',
          description: 'Chuyển kết quả sang Bộ phận tiếp nhận và trả kết quả',
          badgeColor: 'bg-teal-100 text-teal-800',
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

  // Di chuyển bước lên / xuống
  const handleMoveStep = (stepIndex: number, direction: 'up' | 'down') => {
    if (!currentProcedure) return;
    const newSteps = [...currentProcedure.steps];
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;

    const temp = newSteps[stepIndex];
    newSteps[stepIndex] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;

    handleUpdateProcedureField('steps', newSteps);
  };

  // Thêm bước mới
  const handleAddStep = (insertIndex?: number) => {
    if (!currentProcedure) return;
    const newStep: WorkflowStep = {
      key: RecordStatus.APPRAISAL,
      label: 'Bước thực hiện mới',
      shortLabel: 'Bước mới',
      description: 'Mô tả công việc thực hiện trong bước này',
      badgeColor: 'bg-slate-100 text-slate-800',
      durationHours: 8,
      durationDays: 1,
      durationLabel: '1 ngày (8h)'
    };

    const newSteps = [...currentProcedure.steps];
    if (insertIndex !== undefined && insertIndex >= 0) {
      newSteps.splice(insertIndex + 1, 0, newStep);
    } else {
      newSteps.push(newStep);
    }
    handleUpdateProcedureField('steps', newSteps);
  };

  // Xóa một bước
  const handleDeleteStep = (stepIndex: number) => {
    if (!currentProcedure) return;
    if (currentProcedure.steps.length <= 2) {
      setFeedback({ type: 'error', message: 'Quy trình cần tối thiểu 2 bước (Tiếp nhận & Kết thúc).' });
      return;
    }
    const newSteps = currentProcedure.steps.filter((_, idx: number) => idx !== stepIndex);
    handleUpdateProcedureField('steps', newSteps);
  };

  // Tính tổng số ngày các bước của thủ tục hiện tại
  const computedTotalDays = (currentProcedure?.steps || []).reduce(
    (sum: number, s: WorkflowStep) => sum + (Number(s.durationDays) || 0), 0
  );

  // Tự động gán tổng ngày theo các bước
  const handleApplyComputedDays = () => {
    if (!currentProcedure) return;
    handleUpdateProcedureField('standardDays', computedTotalDays);
    setFeedback({ type: 'success', message: `Đã cập nhật tổng thời gian định mức: ${computedTotalDays} ngày.` });
  };

  // Lưu toàn bộ cấu hình lên Supabase Cloud & LocalStorage
  const handleSaveToCloud = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const success = await saveProceduresConfig(procedures);
      if (success) {
        setFeedback({ 
          type: 'success', 
          message: 'Đã lưu thiết lập quy trình & SLA lên CSDL Supabase thành công! Dữ liệu đã sẵn sàng áp dụng cho toàn bộ máy trạm.' 
        });
        if (onSaved) onSaved();
      } else {
        setFeedback({ 
          type: 'error', 
          message: 'Không thể lưu lên CSDL Supabase. Hãy kiểm tra kết nối mạng hoặc thử lại.' 
        });
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: `Lỗi khi lưu cấu hình: ${e?.message || 'Không xác định'}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Khôi phục mặc định chuẩn
  const handleResetDefaults = async () => {
    const ok = await confirmAction(
      'CẢNH BÁO: Thao tác này sẽ đặt lại TOÀN BỘ quy trình thủ tục cấp giấy (Nhóm 3.x) về chuẩn ban đầu của hệ thống.\nBạn có muốn tiếp tục?',
      'Khôi phục cấu hình mặc định'
    );
    if (!ok) return;

    setIsSaving(true);
    try {
      const resetList = await resetProceduresToDefault();
      setProcedures(resetList);
      setSelectedProcedureId(resetList[0]?.id || '');
      setFeedback({ type: 'success', message: 'Đã khôi phục danh mục quy trình & các bước về chuẩn mặc định thành công!' });
      if (onSaved) onSaved();
    } catch (e: any) {
      setFeedback({ type: 'error', message: `Lỗi khôi phục mặc định: ${e?.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner Giới thiệu & Trạng thái */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-white/10 rounded-xl">
              <Sliders size={20} className="text-blue-300" />
            </span>
            <h3 className="text-lg font-black tracking-tight">Thiết lập Quy trình & SLA Cấp giấy (Nhóm 3.x)</h3>
          </div>
          <p className="text-xs text-blue-200 font-medium mt-1.5 max-w-2xl leading-relaxed">
            Tự do cấu hình danh mục thủ tục cấp giấy, trình tự các bước thực hiện, phân bổ thời gian định mức (SLA) và trạng thái hệ thống. Tự động lưu trữ trên CSDL Supabase dùng chung. Hoàn toàn độc lập, không ảnh hưởng đến Tổ Đo đạc hoặc Tổ Lưu trữ.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isSaving}
            className="px-3.5 py-2.5 text-xs font-bold text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Khôi phục toàn bộ các thủ tục và bước về mặc định chuẩn"
          >
            <RotateCcw size={14} />
            <span>Khôi phục mặc định</span>
          </button>
          <button
            type="button"
            onClick={handleSaveToCloud}
            disabled={isSaving}
            className="px-5 py-2.5 text-xs font-bold text-blue-900 bg-white hover:bg-blue-50 rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save size={15} />
            <span>{isSaving ? 'Đang lưu vào CSDL...' : 'Lưu CSDL Supabase'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span className="flex items-center gap-1.5">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {feedback.message}
          </span>
          <button onClick={() => setFeedback(null)} className="p-1 hover:bg-black/5 rounded">
            X
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row min-h-[640px]">
        {/* CỘT TRÁI: DANH SÁCH THỦ TỤC */}
        <div className="w-full md:w-80 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
          {/* Thanh tìm kiếm & nút thêm thủ tục */}
          <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                Thủ tục cấp giấy
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                {procedures.length} thủ tục
              </span>
            </div>
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
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus size={15} />
              <span>Thêm thủ tục mới</span>
            </button>
          </div>

          {/* Danh sách thủ tục */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[560px]">
            {filteredProcedures.map((proc) => {
              const isSelected = proc.id === currentProcedure?.id;
              return (
                <div
                  key={proc.id}
                  onClick={() => setSelectedProcedureId(proc.id)}
                  className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-black text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded-md text-[11px] tracking-tight">
                      {proc.code}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Clock size={12} className="text-slate-400" />
                      {proc.standardDays} ngày
                    </span>
                  </div>
                  <div className="font-bold text-slate-800 line-clamp-2 leading-tight">
                    {proc.name}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span>{proc.steps?.length || 0} bước thực hiện</span>
                    {isSelected && <span className="text-blue-600 font-bold">Đang chọn</span>}
                  </div>
                </div>
              );
            })}

            {filteredProcedures.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-400">
                Không tìm thấy thủ tục phù hợp.
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: CHI TIẾT VÀ CẤU HÌNH CÁC BƯỚC CỦA THỦ TỤC */}
        {currentProcedure ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* THÔNG TIN CHUNG CỦA THỦ TỤC */}
            <div className="p-4 md:p-5 border-b border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">Cấu hình thủ tục:</span>
                  <span className="text-sm font-black text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-lg">
                    {currentProcedure.code}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDuplicateProcedure}
                    className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    title="Nhân bản thủ tục này để tạo quy trình biến thể"
                  >
                    <Copy size={13} />
                    <span>Nhân bản</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteProcedure}
                    className="px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    title="Xóa thủ tục này"
                  >
                    <Trash2 size={13} />
                    <span>Xóa thủ tục</span>
                  </button>
                </div>
              </div>

              {/* Form thông tin chung */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mã thủ tục *</label>
                  <input
                    type="text"
                    value={currentProcedure.code}
                    onChange={(e) => handleUpdateProcedureField('code', e.target.value)}
                    placeholder="VD: 3.1, 3.2..."
                    className="w-full px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-6">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tên thủ tục cấp giấy *</label>
                  <input
                    type="text"
                    value={currentProcedure.name}
                    onChange={(e) => handleUpdateProcedureField('name', e.target.value)}
                    placeholder="VD: Đăng ký, cấp GCN lần đầu..."
                    className="w-full px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tổng thời gian (SLA) *</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={currentProcedure.standardDays}
                      onChange={(e) => handleUpdateProcedureField('standardDays', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-xs font-black text-blue-900 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none text-right"
                    />
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">ngày</span>
                  </div>
                </div>
              </div>

              {/* So sánh tổng ngày các bước & tổng SLA quy định */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-blue-50/60 border border-blue-100 rounded-xl text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-600 font-medium">
                    Tổng thời gian phân bổ các bước: <strong className="text-blue-900 font-black">{computedTotalDays} ngày</strong>
                  </span>
                  {computedTotalDays !== currentProcedure.standardDays && (
                    <span className="text-amber-700 font-bold flex items-center gap-1 text-[11px]">
                      <AlertTriangle size={13} /> Lệch {Math.abs(computedTotalDays - currentProcedure.standardDays)} ngày so với SLA quy định ({currentProcedure.standardDays} ngày)
                    </span>
                  )}
                </div>
                {computedTotalDays !== currentProcedure.standardDays && (
                  <button
                    type="button"
                    onClick={handleApplyComputedDays}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                  >
                    Đồng bộ tổng SLA = {computedTotalDays} ngày
                  </button>
                )}
              </div>
            </div>

            {/* DANH SÁCH CÁC BƯỚC QUY TRÌNH (STEPPER) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Layers size={15} className="text-blue-600" />
                    <span>Trình tự các bước thực hiện ({currentProcedure.steps?.length || 0} bước)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Kéo chỉnh thứ tự, chọn trạng thái nghiệp vụ và phân bổ thời gian thực hiện cho từng bước.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddStep()}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Thêm bước mới</span>
                </button>
              </div>

              {/* Danh sách từng Step */}
              <div className="space-y-2.5">
                {currentProcedure.steps.map((step: WorkflowStep, idx: number) => {
                  const isFirst = idx === 0;
                  const isLast = idx === currentProcedure.steps.length - 1;
                  const isPaused = step.durationDays === 0;

                  return (
                    <div
                      key={`${step.key}_${idx}`}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-all shadow-2xs space-y-2.5"
                    >
                      {/* Dòng tiêu đề bước: Thứ tự + Tên hiển thị + Nút điều khiển */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={step.label}
                            onChange={(e) => handleUpdateStep(idx, 'label', e.target.value)}
                            placeholder="Tên bước thực hiện..."
                            className="flex-1 px-2.5 py-1 text-xs font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                          />
                        </div>

                        {/* Nút di chuyển & xóa */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveStep(idx, 'up')}
                            disabled={isFirst}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded cursor-pointer disabled:cursor-not-allowed"
                            title="Di chuyển lên"
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveStep(idx, 'down')}
                            disabled={isLast}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 hover:bg-slate-100 rounded cursor-pointer disabled:cursor-not-allowed"
                            title="Di chuyển xuống"
                          >
                            <ArrowDown size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStep(idx)}
                            className="p-1 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                            title="Xóa bước này"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Chi tiết thuộc tính: Trạng thái hệ thống + Thời gian (ngày/giờ) + Tên ngắn gọn */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
                        {/* Trạng thái hệ thống liên kết */}
                        <div className="sm:col-span-5">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Trạng thái CSDL áp dụng *
                          </label>
                          <select
                            value={step.key}
                            onChange={(e) => handleUpdateStep(idx, 'key', e.target.value as RecordStatus)}
                            className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
                          >
                            {CAP_GIAY_SELECTABLE_STATUSES.map((st) => (
                              <option key={st.key} value={st.key}>
                                {st.label} ({st.key})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Tên viết tắt hiển thị trên Stepper */}
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Tên viết tắt *
                          </label>
                          <input
                            type="text"
                            value={step.shortLabel || ''}
                            onChange={(e) => handleUpdateStep(idx, 'shortLabel', e.target.value)}
                            placeholder="VD: Tiếp nhận"
                            className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
                          />
                        </div>

                        {/* Thời gian thực hiện (Số ngày) */}
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
                            <span>Thời gian (SLA)</span>
                            {isPaused && (
                              <span className="text-amber-600 font-bold flex items-center gap-0.5 lowercase text-[10px]">
                                <Pause size={10} /> tạm dừng SLA
                              </span>
                            )}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={step.durationDays ?? 0}
                              onChange={(e) => handleUpdateStep(idx, 'durationDays', e.target.value)}
                              placeholder="0"
                              className="w-20 px-2 py-1.5 text-xs font-black text-blue-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 text-right"
                            />
                            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">ngày</span>
                            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                              ({step.durationHours || Math.round((step.durationDays || 0) * 8)}h)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Mô tả chi tiết bước */}
                      <div>
                        <input
                          type="text"
                          value={step.description || ''}
                          onChange={(e) => handleUpdateStep(idx, 'description', e.target.value)}
                          placeholder="Mô tả tóm tắt nội dung công việc và nhiệm vụ ở bước này..."
                          className="w-full px-2.5 py-1 text-[11px] text-slate-500 bg-slate-50/50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                        />
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
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                            Ngoài SLA quy trình
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Nút thêm bước cuối */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleAddStep()}
                  className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 text-slate-600 hover:text-blue-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Thêm bước tiếp theo vào quy trình</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-12 text-center text-slate-400 text-xs">
            Vui lòng chọn một thủ tục ở cột bên trái để bắt đầu thiết lập.
          </div>
        )}
      </div>
    </div>
  );
};
