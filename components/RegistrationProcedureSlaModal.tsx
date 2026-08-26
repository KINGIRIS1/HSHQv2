import React, { useState, useEffect, useMemo } from 'react';
import { 
  WorkflowStep, 
  STANDARD_AVAILABLE_STEPS, 
  getProcedureWorkflow, 
  saveProcedureWorkflow, 
  resetProcedureWorkflow, 
  calculateTotalSlaHours,
  getRegistrationProceduresList,
  StandardStepTemplate,
  formatHoursToSlaLabel,
  parseSlaLabelToHours,
  WORKING_HOURS_PER_DAY,
  WORKING_TIME_CONFIG
} from '../constants/procedureWorkflows';
import { ProcedureDefinition } from '../constants/procedures';
import { 
  GitFork, 
  Clock, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  Save, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Info, 
  PauseCircle, 
  CalendarClock,
  Building2,
  Receipt,
  Printer,
  ShieldCheck,
  Send,
  CheckSquare,
  FileCheck,
  UserCheck
} from 'lucide-react';

interface RegistrationProcedureSlaModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProcedureId?: string;
  isEmbedded?: boolean; // When rendered directly inside SystemSettingsView/SystemView tab
}

const STEP_ICONS: Record<string, any> = {
  tiep_nhan: UserCheck,
  tham_dinh: UserCheck,
  phieu_chuyen_thue: Send,
  thue_kv7: Building2,
  thong_bao_thue: Receipt,
  in_gcn: Printer,
  trinh_kiem_tra: ShieldCheck,
  trinh_ky: Send,
  hoan_thanh: CheckSquare,
  tra_ket_qua: FileCheck
};

export const RegistrationProcedureSlaModal: React.FC<RegistrationProcedureSlaModalProps> = ({
  isOpen,
  onClose,
  initialProcedureId = '3.1.1',
  isEmbedded = false
}) => {
  const proceduresList: ProcedureDefinition[] = useMemo(() => {
    return getRegistrationProceduresList();
  }, []);

  const [selectedProcedureId, setSelectedProcedureId] = useState<string>(initialProcedureId);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  // Load steps whenever procedure selection changes
  useEffect(() => {
    if (selectedProcedureId) {
      const loaded = getProcedureWorkflow(selectedProcedureId);
      setSteps(JSON.parse(JSON.stringify(loaded)));
      setHasChanges(false);
      setSaveSuccessMsg('');
    }
  }, [selectedProcedureId, isOpen]);

  const currentProcedure = useMemo(() => {
    return proceduresList.find(p => p.id === selectedProcedureId) || proceduresList[0];
  }, [proceduresList, selectedProcedureId]);

  const slaSummary = useMemo(() => {
    return calculateTotalSlaHours(steps);
  }, [steps]);

  const handleStepChange = (index: number, field: keyof WorkflowStep, value: any) => {
    setSteps(prev => {
      const next = [...prev];
      const step = { ...next[index], [field]: value };
      
      // If code changed, update default metadata if matched standard
      if (field === 'code') {
        const std = STANDARD_AVAILABLE_STEPS.find(s => s.code === value);
        if (std) {
          step.name = std.defaultName;
          step.slaLabel = std.defaultSlaLabel;
          step.slaHours = std.defaultSlaHours;
          step.isExcludedFromTotalSla = std.isExcludedFromTotalSla;
          step.dateField = std.dateField;
          step.staffField = std.staffField;
          step.statusMatch = std.statusMatch;
          step.colorScheme = std.colorScheme;
          step.description = std.description;
        }
      }

      // Bi-directional conversion 1: When slaHours changes -> auto sync slaLabel
      if (field === 'slaHours') {
        const num = Number(value) || 0;
        step.slaHours = num;
        step.slaLabel = formatHoursToSlaLabel(num);
      }

      // Bi-directional conversion 2: When slaLabel changes -> auto parse and sync slaHours
      if (field === 'slaLabel') {
        step.slaLabel = value;
        const parsed = parseSlaLabelToHours(value);
        if (parsed !== null && !isNaN(parsed) && parsed >= 0) {
          step.slaHours = parsed;
        }
      }

      next[index] = step;
      return next;
    });
    setHasChanges(true);
    setSaveSuccessMsg('');
  };

  const handleAddStep = (templateCode?: string) => {
    const std = STANDARD_AVAILABLE_STEPS.find(s => s.code === templateCode) || STANDARD_AVAILABLE_STEPS[1];
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: std.code,
      name: std.defaultName,
      slaLabel: std.defaultSlaLabel,
      slaHours: std.defaultSlaHours,
      isExcludedFromTotalSla: std.isExcludedFromTotalSla,
      dateField: std.dateField,
      staffField: std.staffField,
      statusMatch: std.statusMatch,
      colorScheme: std.colorScheme,
      description: std.description
    };

    setSteps(prev => [...prev, newStep]);
    setHasChanges(true);
    setSaveSuccessMsg('');
  };

  const handleDeleteStep = (index: number) => {
    if (steps.length <= 1) {
      alert('Quy trình phải có ít nhất 1 bước tiến độ.');
      return;
    }
    setSteps(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
    setSaveSuccessMsg('');
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;

    setSteps(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
    setHasChanges(true);
    setSaveSuccessMsg('');
  };

  const handleResetDefault = () => {
    if (window.confirm(`Bạn có chắc muốn khôi phục quy trình & SLA mặc định cho thủ tục "${currentProcedure?.name}"?`)) {
      const defaults = resetProcedureWorkflow(selectedProcedureId);
      setSteps(JSON.parse(JSON.stringify(defaults)));
      setHasChanges(false);
      setSaveSuccessMsg('Đã khôi phục về quy trình mặc định thành công!');
      setTimeout(() => setSaveSuccessMsg(''), 3500);
    }
  };

  const handleSave = () => {
    if (steps.length === 0) {
      alert('Vui lòng thêm ít nhất 1 bước tiến độ.');
      return;
    }

    saveProcedureWorkflow(selectedProcedureId, steps);
    setHasChanges(false);
    setSaveSuccessMsg(`Đã lưu cấu hình Quy trình & SLA cho thủ tục "${currentProcedure?.shortName || selectedProcedureId}" thành công!`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  if (!isOpen && !isEmbedded) return null;

  const content = (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      
      {/* HEADER CONTROLS: PROCEDURE SELECTOR & STATS */}
      <div className="p-4 sm:p-5 bg-white border-b border-gray-200 shrink-0 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* PROCEDURE SELECTOR (Clean name, no duplicated code, no static default deadline) */}
          <div className="flex-1 max-w-2xl">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <Layers size={15} className="text-blue-600" />
              <span>Chọn Loại thủ tục Đăng ký:</span>
            </label>
            <div className="relative">
              <select
                value={selectedProcedureId}
                onChange={(e) => setSelectedProcedureId(e.target.value)}
                className="w-full bg-slate-50 border-2 border-blue-200 hover:border-blue-400 focus:border-blue-600 focus:bg-white text-gray-900 font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all cursor-pointer shadow-xs"
              >
                {proceduresList.map(proc => {
                  const moduleLabel = '📝 [Đăng ký]';
                  const displayName = `${moduleLabel} ${proc.shortName || proc.name}`;
                  return (
                    <option key={proc.id} value={proc.id} className="py-1 font-medium">
                      {displayName}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* SLA SUMMARY BADGES & WORKING TIME INFO */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-lg shadow-xs">
                <Clock size={16} />
              </div>
              <div>
                <span className="text-[10px] text-blue-700 font-bold uppercase block tracking-wider">Tổng SLA Cơ quan</span>
                <p className="text-sm font-black text-blue-950 font-mono">
                  {slaSummary.totalHours} giờ <span className="text-xs font-normal text-blue-700 font-sans">({slaSummary.totalDays} ngày làm việc)</span>
                </p>
              </div>
            </div>

            {slaSummary.excludedHours > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex items-center gap-3">
                <div className="bg-amber-600 text-white p-2 rounded-lg shadow-xs">
                  <PauseCircle size={16} />
                </div>
                <div>
                  <span className="text-[10px] text-amber-700 font-bold uppercase block tracking-wider">Tạm dừng SLA / Ngoài</span>
                  <p className="text-sm font-black text-amber-950 font-mono">
                    {slaSummary.excludedHours} giờ <span className="text-xs font-normal text-amber-700 font-sans">({slaSummary.excludedDays} ngày)</span>
                  </p>
                </div>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2">
              <CalendarClock size={15} className="text-slate-500 shrink-0" />
              <div>
                <span className="font-bold text-slate-800 block">Quy chuẩn 8h/ngày:</span>
                <span className="text-slate-500">Sáng 7h30-11h30 • Chiều 13h30-17h30</span>
              </div>
            </div>
          </div>
        </div>

        {/* SAVE SUCCESS BANNER */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* BODY: STEPS TABLE WITH STICKY COLUMNS */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
          
          <div className="overflow-x-auto relative">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/95 border-b border-gray-200 text-[11px] font-bold text-gray-700 uppercase tracking-wider sticky top-0 z-30">
                  {/* STICKY COL 1: SỐ TT */}
                  <th className="py-3 px-3 text-center w-16 sticky left-0 bg-slate-100 z-20 shadow-[1px_0_0_0_#e2e8f0]">
                    Số TT
                  </th>
                  {/* STICKY COL 2: TÊN TIẾN ĐỘ */}
                  <th className="py-3 px-4 min-w-[260px] sticky left-16 bg-slate-100 z-20 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                    Tên Tiến độ (Bước thực hiện)
                  </th>
                  <th className="py-3 px-3 w-36 text-center">SLA Hiển thị</th>
                  <th className="py-3 px-3 w-28 text-center">Số giờ (h)</th>
                  <th className="py-3 px-4 min-w-[190px] text-center">
                    <div className="flex items-center justify-center gap-1.5 text-amber-900" title="Nếu chọn sẽ không tính vào tổng thời gian giải quyết cơ quan">
                      <PauseCircle size={14} className="text-amber-600" />
                      <span>Không tính vào tổng SLA</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 w-24 text-center">Thứ tự</th>
                  <th className="py-3 px-3 w-16 text-center">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/70 font-medium">
                {steps.map((step, idx) => {
                  const StepIcon = STEP_ICONS[step.code] || CalendarClock;
                  const isExcluded = !!step.isExcludedFromTotalSla;

                  return (
                    <tr 
                      key={step.id || idx} 
                      className={`hover:bg-blue-50/40 transition-colors group ${isExcluded ? 'bg-amber-50/30' : ''}`}
                    >
                      {/* CỘT 1 (CỐ ĐỊNH): SỐ TT */}
                      <td className={`py-3 px-3 text-center font-bold text-gray-700 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] ${isExcluded ? 'bg-amber-50/90' : 'bg-white group-hover:bg-blue-50/60'}`}>
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mx-auto text-xs font-mono font-bold border border-slate-300">
                          {idx + 1}
                        </span>
                      </td>

                      {/* CỘT 2 (CỐ ĐỊNH): TÊN TIẾN ĐỘ (ĐÃ BỎ MẪU CHUẨN DƯỚI TÊN) */}
                      <td className={`py-3 px-4 sticky left-16 z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] ${isExcluded ? 'bg-amber-50/90' : 'bg-white group-hover:bg-blue-50/60'}`}>
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-md ${isExcluded ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'} shrink-0`}>
                            <StepIcon size={15} />
                          </div>
                          <input
                            type="text"
                            value={step.name}
                            onChange={(e) => handleStepChange(idx, 'name', e.target.value)}
                            placeholder="Nhập tên bước..."
                            className="w-full font-bold text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:bg-white focus:border-blue-500 focus:outline-none uppercase shadow-2xs"
                          />
                        </div>
                      </td>

                      {/* CỘT 3: SLA HIỂN THỊ (QUY ĐỔI 2 CHIỀU) */}
                      <td className="py-3 px-3">
                        <input
                          type="text"
                          value={step.slaLabel}
                          onChange={(e) => handleStepChange(idx, 'slaLabel', e.target.value)}
                          placeholder="VD: 2 ngày, 4 giờ..."
                          className="w-full font-semibold text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-center focus:bg-white focus:border-blue-500 focus:outline-none shadow-2xs"
                        />
                      </td>

                      {/* CỘT 4: SỐ GIỜ (QUY ĐỔI 2 CHIỀU) */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={step.slaHours}
                            onChange={(e) => handleStepChange(idx, 'slaHours', Number(e.target.value))}
                            className="w-18 font-mono font-bold text-gray-900 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:bg-white focus:border-blue-500 focus:outline-none shadow-2xs"
                          />
                          <span className="text-gray-500 font-mono text-[11px]">h</span>
                        </div>
                      </td>

                      {/* CỘT 5: KHÔNG TÍNH VÀO TỔNG QUY TRÌNH (DỪNG SLA) */}
                      <td className="py-3 px-4 text-center">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-1.5 rounded-lg border border-gray-200 hover:border-amber-400 transition-all shadow-2xs">
                          <input
                            type="checkbox"
                            checked={isExcluded}
                            onChange={(e) => handleStepChange(idx, 'isExcludedFromTotalSla', e.target.checked)}
                            className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
                          />
                          <span className={`text-[11px] font-bold ${isExcluded ? 'text-amber-800' : 'text-gray-500'}`}>
                            {isExcluded ? 'Dừng tính SLA' : 'Tính vào SLA'}
                          </span>
                        </label>
                      </td>

                      {/* CỘT 6: THỨ TỰ DI CHUYỂN */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveStep(idx, 'up')}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                            title="Di chuyển lên"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === steps.length - 1}
                            onClick={() => handleMoveStep(idx, 'down')}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                            title="Di chuyển xuống"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </td>

                      {/* CỘT 7: NÚT XÓA */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteStep(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa bước này khỏi quy trình"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ADD STEP BUTTON BAR */}
          <div className="p-3 bg-slate-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleAddStep()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 font-bold rounded-lg text-xs shadow-2xs transition-all cursor-pointer"
              >
                <Plus size={15} />
                Thêm bước tiến độ
              </button>

              <span className="text-[11px] text-gray-400">hoặc thêm nhanh mẫu:</span>
              
              {STANDARD_AVAILABLE_STEPS.slice(2, 6).map(s => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => handleAddStep(s.code)}
                  className="px-2.5 py-1 bg-white border border-gray-200 hover:border-gray-400 text-gray-600 rounded text-[11px] font-medium transition-all cursor-pointer"
                >
                  + {s.defaultName}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-gray-500 italic">
              Hiện có <strong className="text-gray-800 font-mono">{steps.length}</strong> bước trong quy trình
            </div>
          </div>

        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="p-4 sm:p-5 bg-white border-t border-gray-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefault}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            title="Đưa về quy trình & SLA chuẩn ban đầu của thủ tục này"
          >
            <RotateCcw size={14} />
            Khôi phục mặc định
          </button>
        </div>

        <div className="flex items-center gap-3">
          {!isEmbedded && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Đóng
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer ${
              hasChanges 
                ? 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <Save size={15} />
            Lưu cấu hình quy trình
          </button>
        </div>
      </div>

    </div>
  );

  if (isEmbedded) {
    return (
      <div className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-6 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col border border-gray-200">
        {/* MODAL TITLE HEADER */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-4 flex justify-between items-center text-white shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/15 rounded-lg">
              <GitFork size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-wide">
                Cấu hình Quy trình & SLA
              </h2>
              <p className="text-xs text-blue-100">
                Tùy biến các bước tiến độ, phân bổ thời gian (SLA) và đồng bộ thao tác chuyển giao việc
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        {/* MODAL MAIN CONTENT */}
        <div className="flex-1 overflow-hidden">
          {content}
        </div>
      </div>
    </div>
  );
};

export default RegistrationProcedureSlaModal;
