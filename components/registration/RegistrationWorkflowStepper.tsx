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
  CreditCard,
  Printer,
} from 'lucide-react';
import { RecordFile, RecordStatus } from '../../types';
import {
  getRegistrationWorkflow,
  calculateRecordStepSla,
  getWorkflowStepIndex,
  formatDurationShort,
  formatMinutesToVietnamese,
  formatVietnamDateTime,
  getStepStartTime,
  RegistrationWorkflowConfig,
  StepSlaResult,
  WorkflowStep,
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
  onTogglePauseSla?: (isPaused: boolean) => void;
}

export const RegistrationWorkflowStepper: React.FC<RegistrationWorkflowStepperProps> = ({
  record,
  onChangeStatus,
  readOnly = false,
  onOpenWorkflowConfig,
  onTogglePauseSla,
}) => {
  const [workflow, setWorkflow] = useState<RegistrationWorkflowConfig>(() =>
    getRegistrationWorkflow(record.recordType)
  );

  // Lắng nghe sự kiện cập nhật cấu hình quy trình từ Modal hoặc khi đổi loại hồ sơ
  useEffect(() => {
    setWorkflow(getRegistrationWorkflow(record.recordType));
  }, [record.recordType]);

  useEffect(() => {
    const handleUpdate = () => {
      setWorkflow(getRegistrationWorkflow(record.recordType));
    };
    window.addEventListener('registration_procedures_updated', handleUpdate);
    return () => window.removeEventListener('registration_procedures_updated', handleUpdate);
  }, [record.recordType]);

  // Tìm bước hiện tại của hồ sơ trong quy trình
  const steps: WorkflowStep[] = workflow.steps || [];
  const currentStepIndex = getWorkflowStepIndex(record.status, steps);
  const activeIndex = currentStepIndex >= 0 ? currentStepIndex : 0;
  const currentStep = steps[activeIndex] || steps[0];

  const slaResult: StepSlaResult = calculateRecordStepSla(record, record.status, record.recordType || undefined);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {/* 1. HÀNG TIÊU ĐỀ BƯỚC & SLA CÙNG HÀNG (YÊU CẦU CỐT LÕI) */}
      <div className="p-4 bg-slate-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1.5 bg-blue-600 rounded-lg text-white font-black text-xs">
            {workflow.title || 'QUY TRÌNH'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-slate-100">
                {currentStep ? ((currentStep.name || currentStep.label || 'TIẾP NHẬN').toUpperCase()) : 'TIẾP NHẬN'}
              </span>
            </div>
          </div>
        </div>

        {/* CHỈ SỐ SLA ĐẾM NGƯỢC / TIẾN TỚI / TẠM DỪNG */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* NÚT TÍCH CHỌN TẠM DỪNG SLA CHO HỒ SƠ */}
          {!readOnly && onTogglePauseSla && (
            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-xs text-slate-200 cursor-pointer border border-slate-700 transition-colors select-none shadow-2xs">
              <input
                type="checkbox"
                checked={Boolean(record.isSlaPaused)}
                onChange={(e) => onTogglePauseSla(e.target.checked)}
                className="w-3.5 h-3.5 text-amber-500 rounded border-slate-600 focus:ring-amber-400 focus:ring-offset-slate-900 cursor-pointer"
              />
              <span className={record.isSlaPaused ? "text-amber-300 font-bold flex items-center gap-1" : "text-slate-300 flex items-center gap-1"}>
                <Pause size={12} className={record.isSlaPaused ? "text-amber-400 animate-pulse" : "text-slate-400"} />
                <span>{record.isSlaPaused ? "Đang tạm dừng SLA" : "Tạm dừng SLA"}</span>
              </span>
            </label>
          )}

          {slaResult.isPaused ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1.5 shadow-2xs">
              <Pause size={13} className="shrink-0 animate-pulse" />
              <span>{slaResult.stepHeaderText ? (slaResult.stepHeaderText.split('|')[2] || slaResult.stepHeaderText.replace(/\s*\([^)]*\)/g, '')) : 'Tạm dừng tính SLA'}</span>
            </span>
          ) : slaResult.isOverdue ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-400/40 flex items-center gap-1.5 shadow-2xs animate-pulse">
              <AlertTriangle size={13} className="shrink-0" />
              <span>🚨 {slaResult.overdueLabel}</span>
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5 shadow-2xs">
              <Clock size={13} className="shrink-0 text-emerald-400" />
              <span>{slaResult.remainingLabel}</span>
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
            const targetStatus = (step.statusKey || step.key || RecordStatus.RECEIVED) as RecordStatus;
            const recordedTime = (isCompleted || isCurrent) ? getStepStartTime(record, targetStatus) : null;
            const formattedTime = recordedTime ? formatVietnamDateTime(recordedTime) : null;

            return (
              <React.Fragment key={step.id || step.key || idx}>
                <div
                  onClick={() => {
                    if (!readOnly && onChangeStatus) {
                      onChangeStatus(targetStatus);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all shrink-0 border ${
                    !readOnly ? 'cursor-pointer hover:shadow-xs' : ''
                  } ${
                    isCurrent
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold ring-2 ring-blue-400/40'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200 font-semibold hover:bg-emerald-100/70'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-slate-800'
                  }`}
                  title={!readOnly ? `Bấm để mở chuyển sang ${step.name || step.label}` : undefined}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isCurrent
                        ? 'bg-white text-blue-700'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={12} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                  </div>

                  <div className="flex flex-col">
                    <span className="truncate max-w-[140px]" title={step.name || step.label}>
                      {step.name || step.label}
                    </span>
                    {formattedTime && (
                      <span
                        className={`text-[10px] font-medium ${
                          isCurrent ? 'text-blue-100' : isCompleted ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {formattedTime}
                      </span>
                    )}
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

      {/* 3. NÚT CHUYỂN BƯỚC & GIAO VIỆC NGHIỆP VỤ */}
      {!readOnly && onChangeStatus && (
        <div className="p-3.5 px-4 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-slate-100">
          {/* CÁC NÚT HÀNH ĐỘNG GIAO VIỆC NGỮ CẢNH CHÍNH (NỔI BẬT THEO TỪNG BƯỚC) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Layers size={13} className="text-blue-600" />
              <span>Giao việc khâu:</span>
            </span>

            {/* Bước 1 (Tiếp nhận) ➔ Thẩm định */}
            {(record.status === RecordStatus.RECEIVED || !record.assignedTo) && (
              <button
                type="button"
                onClick={() => onChangeStatus(RecordStatus.APPRAISAL)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <User size={14} />
                <span>Giao Thẩm định hồ sơ</span>
              </button>
            )}

            {/* Bước 2 (Thẩm định) ➔ Giao chuyển thuế */}
            {record.status === RecordStatus.APPRAISAL && (
              <>
                <button
                  type="button"
                  onClick={() => onChangeStatus(RecordStatus.TAX_TRANSFER)}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard size={14} />
                  <span>Giao chuyển thuế</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeStatus(RecordStatus.PENDING_PRINT_CERT)}
                  className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Chuyển In GCN</span>
                </button>
              </>
            )}

            {/* Bước 3 (Phiếu chuyển thuế) ➔ Thuế KV7 */}
            {record.status === RecordStatus.TAX_TRANSFER && (
              <button
                type="button"
                onClick={() => onChangeStatus(RecordStatus.PENDING_TAX_KV7)}
                className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Chuyển Thuế Khu vực 7</span>
              </button>
            )}

            {/* Bước 4 (Thuế KV7) ➔ Nhận thông báo thuế */}
            {record.status === RecordStatus.PENDING_TAX_KV7 && (
              <button
                type="button"
                onClick={() => onChangeStatus(RecordStatus.PENDING_TAX_PAYMENT)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Nhận Thông báo thuế</span>
              </button>
            )}

            {/* Bước 5 (Thông báo thuế) ➔ Giao In GCN */}
            {record.status === RecordStatus.PENDING_TAX_PAYMENT && (
              <button
                type="button"
                onClick={() => onChangeStatus(RecordStatus.PENDING_PRINT_CERT)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-blue-700 to-cyan-800 hover:from-blue-800 hover:to-cyan-900 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span>Giao In GCN</span>
              </button>
            )}

            {/* Bước 6 (In GCN) ➔ Trình kiểm tra */}
            {record.status === RecordStatus.PENDING_PRINT_CERT && (
              <button
                type="button"
                onClick={() => onChangeStatus(RecordStatus.PENDING_CHECK)}
                className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>Trình Kiểm tra hồ sơ</span>
              </button>
            )}

            {/* Bước 7 (Kiểm tra) ➔ Trình Lãnh đạo ký duyệt */}
            {record.status === RecordStatus.PENDING_CHECK && (
              <button
                type="button"
                onClick={() => onChangeStatus(RecordStatus.PENDING_SIGN)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight size={14} />
                <span>Trình Lãnh đạo ký duyệt</span>
              </button>
            )}

            {/* Bước 8 (Ký duyệt) ➔ Đã ký / Chờ bàn giao */}
            {record.status === RecordStatus.PENDING_SIGN && (
              <button
                type="button"
                onClick={() => onChangeStatus(RecordStatus.PENDING_HANDOVER)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>Đã ký duyệt / Chuyển hoàn thành</span>
              </button>
            )}

            {/* Bước 9/10 (Đã ký / Chờ giao) ➔ Bàn giao Một cửa trả kết quả */}
            {(record.status === RecordStatus.SIGNED || record.status === RecordStatus.PENDING_HANDOVER || record.status === RecordStatus.HANDOVER) && (
              <button
                type="button"
                onClick={() => onChangeStatus(RecordStatus.RETURNED)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Bàn giao Trả kết quả</span>
              </button>
            )}
          </div>

          {/* CÁC NÚT CHUYỂN BƯỚC KHÁC LINH HOẠT */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Chuyển nhanh:</span>
            {steps.map((step, idx) => {
              if (idx === activeIndex) return null;
              const targetStatus = (step.statusKey || step.key || RecordStatus.RECEIVED) as RecordStatus;
              return (
                <button
                  key={step.id || step.key || idx}
                  type="button"
                  onClick={() => onChangeStatus(targetStatus)}
                  className="px-2 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                  title={`Mở giao việc: ${step.name || step.label}`}
                >
                  <span>{step.shortLabel || step.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
