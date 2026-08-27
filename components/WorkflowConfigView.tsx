import React, { useState, useEffect } from 'react';
import { ProcedureWorkflow, WorkflowStep } from '../types';
import { PROCEDURE_CATALOG, ProcedureDefinition } from '../constants/procedures';
import { getProcedureWorkflow, saveProcedureWorkflow, resetProcedureWorkflowToDefault } from '../services/apiWorkflow';
import { parseSlaToHours, formatHoursToSla } from '../utils/slaEngine';
import { Settings, Plus, RotateCcw, Save, Trash2, ArrowUp, ArrowDown, CheckCircle2, AlertCircle } from 'lucide-react';

interface WorkflowConfigViewProps {
  currentUser?: any;
}

export const WorkflowConfigView: React.FC<WorkflowConfigViewProps> = ({ currentUser }) => {
  const [selectedProcId, setSelectedProcId] = useState<string>(PROCEDURE_CATALOG[0]?.id || '3.1.1');
  const [currentWorkflow, setCurrentWorkflow] = useState<ProcedureWorkflow>(getProcedureWorkflow(PROCEDURE_CATALOG[0]?.id));
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const wf = getProcedureWorkflow(selectedProcId);
    setCurrentWorkflow(JSON.parse(JSON.stringify(wf)));
  }, [selectedProcId]);

  const handleStepChange = (index: number, field: keyof WorkflowStep, value: any) => {
    const updatedSteps = [...currentWorkflow.steps];
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    
    // When slaHours is edited, auto update slaDisplay to standardized day/hour representation
    if (field === 'slaHours') {
      const hrs = parseFloat(value) || 0;
      updatedSteps[index].slaHours = hrs;
      updatedSteps[index].slaDisplay = formatHoursToSla(hrs);
    }

    setCurrentWorkflow({ ...currentWorkflow, steps: updatedSteps });
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentWorkflow.steps.length) return;
    
    const steps = [...currentWorkflow.steps];
    const temp = steps[index];
    steps[index] = steps[newIndex];
    steps[newIndex] = temp;

    // Reassign order
    steps.forEach((s, idx) => { s.order = idx + 1; });
    setCurrentWorkflow({ ...currentWorkflow, steps });
  };

  const handleDeleteStep = (index: number) => {
    if (currentWorkflow.steps.length <= 1) {
      alert('Quy trình phải có ít nhất 1 bước.');
      return;
    }
    const steps = currentWorkflow.steps.filter((_, idx) => idx !== index);
    steps.forEach((s, idx) => { s.order = idx + 1; });
    setCurrentWorkflow({ ...currentWorkflow, steps });
  };

  const handleAddStep = () => {
    const newStep: WorkflowStep = {
      id: `${selectedProcId}-step-${Date.now()}`,
      procedureId: selectedProcId,
      stepCode: `step_${currentWorkflow.steps.length + 1}`,
      stepName: 'Bước nghiệp vụ mới',
      order: currentWorkflow.steps.length + 1,
      slaHours: 8,
      slaDisplay: '1 ngày',
      excludeFromTotalSla: false,
      active: true
    };
    setCurrentWorkflow({ ...currentWorkflow, steps: [...currentWorkflow.steps, newStep] });
  };

  const handleResetDefault = () => {
    if (confirm(`Bạn có chắc muốn khôi phục quy trình mặc định cho thủ tục này?`)) {
      const resetWf = resetProcedureWorkflowToDefault(selectedProcId);
      setCurrentWorkflow(JSON.parse(JSON.stringify(resetWf)));
      setSuccessMessage('Đã khôi phục quy trình mặc định thành công!');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleSave = () => {
    // Validate steps
    for (const step of currentWorkflow.steps) {
      if (!step.stepName.trim()) {
        alert('Tên tiến độ không được để trống.');
        return;
      }
    }
    const success = saveProcedureWorkflow(currentWorkflow);
    if (success) {
      setSuccessMessage('Lưu cấu hình quy trình thành công!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } else {
      alert('Có lỗi khi lưu cấu hình.');
    }
  };

  const currentProcDef = PROCEDURE_CATALOG.find(p => p.id === selectedProcId);
  const standardDays = currentProcDef?.defaultDeadline || 0;
  const standardHours = standardDays * 8;

  // Calculate total agency SLA vs steps SLA vs stopped SLA
  const totalStepsHours = currentWorkflow.steps.reduce((acc, s) => acc + (s.excludeFromTotalSla ? 0 : (s.slaHours || 0)), 0);
  const totalExcludedHours = currentWorkflow.steps.reduce((acc, s) => acc + (s.excludeFromTotalSla ? (s.slaHours || 0) : 0), 0);
  const totalActualHours = totalStepsHours + totalExcludedHours;

  return (
    <div className="p-2 sm:p-4 max-w-7xl mx-auto space-y-4 flex flex-col h-full overflow-hidden">
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 shrink-0">
          <CheckCircle2 size={18} className="text-emerald-600" />
          {successMessage}
        </div>
      )}

      {/* SELECT PROCEDURE / SLA SUMMARY */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        <div className="flex-1 min-w-[280px]">
          <label className="text-xs font-bold text-slate-700 uppercase mb-1 block">Chọn thủ tục / loại hồ sơ</label>
          <select
            value={selectedProcId}
            onChange={(e) => setSelectedProcId(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:border-blue-500 outline-none transition-all cursor-pointer"
          >
            {PROCEDURE_CATALOG.map(proc => (
              <option key={proc.id} value={proc.id}>
                {proc.shortName || proc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs shrink-0">
          {/* STANDARD PROCEDURE SLA BENCHMARK */}
          <div className="pr-3 border-r border-slate-300">
            <span className="text-slate-500 font-medium block">SLA Cơ quan (Chuẩn):</span>
            <span className="font-bold text-emerald-700 text-sm">{standardDays} ngày ({standardHours}h)</span>
          </div>

          {/* ALLOCATED WORKFLOW STEPS SLA */}
          <div className="pr-3 border-r border-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">SLA Phân bổ:</span>
              {totalStepsHours === standardHours ? (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">Khớp chuẩn</span>
              ) : totalStepsHours > standardHours ? (
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">+{totalStepsHours - standardHours}h</span>
              ) : (
                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">-{standardHours - totalStepsHours}h</span>
              )}
            </div>
            <span className="font-bold text-blue-700 text-sm">{formatHoursToSla(totalStepsHours)} ({totalStepsHours}h)</span>
          </div>

          {/* PAUSED / EXCLUDED SLA */}
          <div className="pr-3 border-r border-slate-300">
            <span className="text-slate-500 font-medium block">Thời gian chờ ngoài:</span>
            <span className="font-bold text-amber-600 text-sm">{formatHoursToSla(totalExcludedHours)} ({totalExcludedHours}h)</span>
          </div>

          {/* TOTAL ACTUAL TIME */}
          <div>
            <span className="text-slate-500 font-medium block">Tổng thực tế:</span>
            <span className="font-bold text-slate-800 text-sm">{formatHoursToSla(totalActualHours)} ({totalActualHours}h)</span>
          </div>
        </div>
      </div>

      {/* WORKFLOW STEPS TABLE WITH ACTION BUTTONS & SMOOTH SCROLL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/90 shrink-0">
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
            Danh sách bước nghiệp vụ trong quy trình ({currentWorkflow.steps.length} bước)
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefault}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <RotateCcw size={14} /> Khôi phục mặc định
            </button>
            <button
              onClick={handleSave}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Save size={14} /> Lưu cấu hình
            </button>
            <button
              onClick={handleAddStep}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Plus size={14} /> Thêm bước
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto max-h-[calc(100vh-280px)]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100">
              <tr className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 tracking-wider shadow-2xs">
                <th className="py-3 px-4 w-16 text-center sticky top-0 left-0 bg-slate-100 z-30">STT</th>
                <th className="py-3 px-4 min-w-[240px] sticky top-0 left-16 bg-slate-100 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Tên tiến độ / Bước nghiệp vụ</th>
                <th className="py-3 px-4 w-36 sticky top-0 bg-slate-100 z-20">SLA Hiển thị (Ngày)</th>
                <th className="py-3 px-4 min-w-[180px] sticky top-0 bg-slate-100 z-20">Số giờ làm việc</th>
                <th className="py-3 px-4 w-36 text-center sticky top-0 bg-slate-100 z-20">Dừng SLA (Ngoài quy trình)</th>
                <th className="py-3 px-4 w-32 text-center sticky top-0 bg-slate-100 z-20">Thứ tự</th>
                <th className="py-3 px-4 w-20 text-center sticky top-0 bg-slate-100 z-20">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-700 font-medium">
              {currentWorkflow.steps.map((step, index) => {
                const daysVal = Math.round(((step.slaHours || 0) / 8) * 100) / 100;
                return (
                <tr key={step.id || index} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-500 sticky left-0 bg-white z-10">
                    {index + 1}
                  </td>
                  <td className="py-3 px-4 sticky left-16 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <input
                      type="text"
                      value={step.stepName}
                      onChange={(e) => handleStepChange(index, 'stepName', e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-900 font-medium focus:border-blue-500 outline-none"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 bg-slate-100/80 px-2.5 py-1.5 rounded-lg border border-slate-200 w-fit">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        {daysVal}
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">ngày</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={step.slaHours || 0}
                          onChange={(e) => handleStepChange(index, 'slaHours', e.target.value)}
                          className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-mono text-slate-900 font-bold focus:border-blue-500 outline-none"
                        />
                        <span className="text-[11px] text-slate-500 font-semibold">giờ</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {step.excludeFromTotalSla ? (
                          <span className="text-amber-600 font-semibold">Không tính vào tổng SLA</span>
                        ) : (
                          <span>Cảnh báo quá hạn sau {step.slaHours || 0}h</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={step.excludeFromTotalSla}
                        onChange={(e) => handleStepChange(index, 'excludeFromTotalSla', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="ml-2 text-[11px] font-semibold text-slate-600">
                        {step.excludeFromTotalSla ? 'Đang dừng' : 'Tính SLA'}
                      </span>
                    </label>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleMoveStep(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Di chuyển lên"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        onClick={() => handleMoveStep(index, 'down')}
                        disabled={index === currentWorkflow.steps.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Di chuyển xuống"
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleDeleteStep(index)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa bước"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
