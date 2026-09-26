import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  ChevronRight,
  ArrowRight,
  User,
  Calendar,
  Layers,
  Settings,
} from 'lucide-react';
import { RecordFile, RecordStatus } from '../../types';
import {
  getProcedureByRecordType,
  calculateRecordStepSla,
  formatDurationShort,
  formatMinutesToVietnamese,
  RegistrationProcedureConfig,
  RegistrationStepConfig,
  StepSlaResult,
} from '../../utils/registrationWorkflows';
import { CAP_GIAY_SELECTABLE_STATUSES } from '../../constants';

interface RegistrationWorkflowStepperProps {
  record: RecordFile;
  onChangeStatus?: (
    newStatus: RecordStatus,
    updatedFields?: Partial<RecordFile>,
    note?: string
  ) => void;
  currentUser?: { name?: string } | null;
  readOnly?: boolean;
  onOpenWorkflowConfig?: () => void;
}

export const RegistrationWorkflowStepper: React.FC<RegistrationWorkflowStepperProps> = ({
  record,
  onChangeStatus,
  readOnly = false,
  onOpenWorkflowConfig,
}) => {
  const [procedure, setProcedure] = useState<RegistrationProcedureConfig>(() =>
    getProcedureByRecordType(record.recordType)
  );

  // Lắng nghe sự kiện cập nhật cấu hình quy trình từ Modal
  useEffect(() => {
    const handleUpdate = () => {
      setProcedure(getProcedureByRecordType(record.recordType));
    };
    window.addEventListener('registration_procedures_updated', handleUpdate);
    return () => window.removeEventListener('registration_procedures_updated', handleUpdate);
  }, [record.recordType]);

  // Tìm bước hiện tại của hồ sơ trong quy trình
  const steps = procedure.steps || [];
  const currentStepIndex = steps.findIndex((s) => s.statusKey === record.status);
  const activeIndex = currentStepIndex >= 0 ? currentStepIndex : 0;
  const currentStep = steps[activeIndex] || steps[0];

  // Tính SLA cho bước hiện tại
  const slaResult: StepSlaResult = calculateRecordStepSla(record, currentStep, procedure);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {/* 1. HÀNG TIÊU ĐỀ BƯỚC & SLA CÙNG HÀNG (YÊU CẦU CỐT LÕI) */}
      <div className="p-4 bg-slate-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1.5 bg-blue-600 rounded-lg text-white font-black text-xs">
            {procedure.code}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-slate-100">
                Bước {activeIndex + 1}/{steps.length}: {currentStep ? currentStep.name.toUpperCase() : 'TIẾP NHẬN'}
              </span>
              <span className="text-slate-400 text-xs">|</span>
              <span className="text-xs font-semibold text-slate-300">
                Định mức: <strong className="text-white">{slaResult.durationLabel}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* CHỈ SỐ SLA ĐẾM NGƯỢC / TIẾN TỚI / TẠM DỪNG */}
        <div className="flex items-center gap-2 flex-wrap">
          {slaResult.isPaused ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1.5 shadow-2xs">
              <Pause size={13} className="shrink-0 animate-pulse" />
              <span>{slaResult.stepHeaderText.split('|')[2] || `Tạm dừng tính SLA (${slaResult.pauseReason})`}</span>
            </span>
          ) : slaResult.isOverdue ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-400/40 flex items-center gap-1.5 shadow-2xs animate-pulse">
              <AlertTriangle size={13} className="shrink-0" />
              <span>🚨 Trễ hạn {slaResult.overdueLabel}</span>
            </span>
          ) : slaResult.isWarning ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1.5 shadow-2xs">
              <Clock size={13} className="shrink-0" />
              <span>⚠️ Cảnh báo: Còn lại {slaResult.remainingLabel}</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1.5 shadow-2xs">
              <Clock size={13} className="shrink-0" />
              <span>⏱️ Còn lại {slaResult.remainingLabel}</span>
            </span>
          )}

          {onOpenWorkflowConfig && (
            <button
              type="button"
              onClick={onOpenWorkflowConfig}
              title="Mở cấu hình Trạng thái & SLA"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 2. THANH TIẾN TRÌNH CÁC BƯỚC QUY TRÌNH (STEPPER TRACK) */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-200">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {steps.map((step, idx) => {
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const isFuture = idx > activeIndex;

            return (
              <React.Fragment key={step.id}>
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all shrink-0 border ${
                    isCurrent
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCurrent
                        ? 'bg-white text-blue-700'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={12} /> : idx + 1}
                  </div>

                  <div className="flex flex-col">
                    <span className="truncate max-w-[130px]" title={step.name}>
                      {step.name}
                    </span>
                    <span
                      className={`text-[10px] font-normal ${
                        isCurrent ? 'text-blue-100' : isCompleted ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {step.isSlaPaused ? 'Tạm dừng SLA' : formatDurationShort(step.totalMinutes)}
                    </span>
                  </div>
                </div>

                {idx < steps.length - 1 && (
                  <ChevronRight size={14} className="text-slate-300 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 3. NÚT CHUYỂN BƯỚC NHANH KHI CÁN BỘ THỰC HIỆN */}
      {!readOnly && onChangeStatus && steps.length > 0 && (
        <div className="p-3 px-4 bg-white flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Chuyển tiếp bước:</span>
            <span>Chọn bước kế tiếp để cập nhật trạng thái hồ sơ</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {steps.map((step, idx) => {
              if (idx === activeIndex) return null;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onChangeStatus(step.statusKey)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>➔ Bước {idx + 1}: {step.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
