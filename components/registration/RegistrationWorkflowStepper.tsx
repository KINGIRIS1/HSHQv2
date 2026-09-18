import React from 'react';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Clock,
  RotateCcw,
  Sparkles,
  Info,
  Timer,
  CheckCircle,
} from 'lucide-react';
import { RecordFile, RecordStatus, RecordStatusLog } from '../../types';
import {
  getRegistrationWorkflow,
  WorkflowStep,
  getWorkflowStepIndex,
  getNextWorkflowStep,
  getPrevWorkflowStep,
  getStepSlaInfo,
} from '../../utils/registrationWorkflows';

interface RegistrationWorkflowStepperProps {
  record: RecordFile;
  onChangeStatus: (
    newStatus: RecordStatus,
    updatedFields?: Partial<RecordFile>,
    note?: string
  ) => void;
  currentUser?: { name?: string } | null;
  readOnly?: boolean;
}

export const RegistrationWorkflowStepper: React.FC<RegistrationWorkflowStepperProps> = ({
  record,
  onChangeStatus,
  currentUser,
  readOnly = false,
}) => {
  const workflow = getRegistrationWorkflow(record.recordType);
  const currentStatus = record.status || RecordStatus.RECEIVED;
  const currentIndex = getWorkflowStepIndex(currentStatus, workflow.steps);
  const currentStep = currentIndex >= 0 ? workflow.steps[currentIndex] : null;
  const nextStep = getNextWorkflowStep(currentStatus, workflow.steps);
  const prevStep = getPrevWorkflowStep(currentStatus, workflow.steps);

  // Tính toán thời gian và SLA cho bước hiện tại
  const currentStepSla = getStepSlaInfo(record, currentStatus);

  const isSpecialStatus =
    currentStatus === RecordStatus.PENDING_SUPPLEMENT ||
    currentStatus === RecordStatus.WITHDRAWN ||
    currentStatus === RecordStatus.REJECTED;

  // Xử lý chuyển sang một bước cụ thể
  const handleStepTransition = (targetStep: WorkflowStep) => {
    if (readOnly) return;
    if (targetStep.key === currentStatus) return;

    const today = new Date().toISOString().substring(0, 10);
    const updatedFields: Partial<RecordFile> = {};

    // Tự động điền mốc thời gian phù hợp nếu chưa có
    if (targetStep.dateField && !record[targetStep.dateField]) {
      (updatedFields as any)[targetStep.dateField] = today;
    }

    if (targetStep.key === RecordStatus.HANDOVER) {
      updatedFields.isHandedOver = true;
    }

    onChangeStatus(
      targetStep.key,
      updatedFields,
      `Chuyển tiến trình sang: ${targetStep.label}`
    );
  };

  // Nút chuyển nhanh sang bước tiếp theo
  const handleAdvanceNext = () => {
    if (!nextStep) return;
    handleStepTransition(nextStep);
  };

  // Nút lùi về bước trước
  const handleStepBack = () => {
    if (!prevStep) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn chuyển lùi hồ sơ về bước "${prevStep.label}"?`
      )
    ) {
      return;
    }
    handleStepTransition(prevStep);
  };

  // Chuyển sang tạm dừng bổ sung hồ sơ
  const handlePendingSupplement = () => {
    const reason = window.prompt(
      'Nhập lý do yêu cầu bổ sung hồ sơ:',
      record.supplementReason || 'Thiếu giấy tờ theo quy định'
    );
    if (reason === null) return;

    const today = new Date().toISOString().substring(0, 10);
    onChangeStatus(
      RecordStatus.PENDING_SUPPLEMENT,
      {
        previousStatus: currentStatus,
        supplementReason: reason,
        supplementRequestDate: today,
      },
      `Yêu cầu bổ sung: ${reason}`
    );
  };

  // Khôi phục từ trạng thái bổ sung
  const handleResumeFromSupplement = () => {
    const defaultResume = workflow.steps[1]?.key || RecordStatus.PENDING_PRINT_CERT;
    const resumeStatus =
      (record.previousStatus as RecordStatus) || defaultResume;
    onChangeStatus(
      resumeStatus,
      {
        supplementReturnedDate: new Date().toISOString().substring(0, 10),
      },
      `Hoàn thành bổ sung, tiếp tục xử lý tại bước: ${resumeStatus}`
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Header quy trình */}
      <div className="p-4 bg-gradient-to-r from-slate-50 via-blue-50/40 to-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm">
                {workflow.title}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                Tổng chuẩn: {workflow.standardDays} ngày
              </span>

              {/* Huy hiệu cảnh báo SLA bước hiện tại */}
              {currentStepSla && currentStepSla.step.isTaxPhase && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                  <Info size={12} className="text-indigo-600" />
                  <span>Liên thông thuế: Không tính vào thời hạn quy trình Chi nhánh</span>
                </span>
              )}

              {currentStepSla && currentStepSla.step.isPostingPhase && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <Info size={12} className="text-amber-600" />
                  <span>Niêm yết tại UBND xã 30 ngày: Không tính vào thời hạn Chi nhánh</span>
                </span>
              )}

              {currentStepSla && currentStepSla.durationHours > 0 && !isSpecialStatus && !currentStepSla.step.isTaxPhase && !currentStepSla.step.isPostingPhase && (
                currentStepSla.isOverdue ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={12} className="text-rose-600" />
                    <span>Quá hạn bước: {currentStepSla.overdueLabel}</span>
                  </span>
                ) : currentStepSla.status === 'warning' ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <Clock size={12} className="text-amber-600" />
                    <span>Sắp hết hạn khâu (Còn {currentStepSla.remainingLabel})</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle size={12} className="text-emerald-600" />
                    <span>Đúng hạn (Còn {currentStepSla.remainingLabel})</span>
                  </span>
                )
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{workflow.subtitle}</p>
          </div>
        </div>

        {/* Nút hành động nhanh */}
        {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            {isSpecialStatus && currentStatus === RecordStatus.PENDING_SUPPLEMENT ? (
              <button
                type="button"
                onClick={handleResumeFromSupplement}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Tiếp tục quy trình (Đã bổ sung xong)</span>
              </button>
            ) : (
              <>
                {prevStep && (
                  <button
                    type="button"
                    onClick={handleStepBack}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg border border-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                    title={`Lùi về: ${prevStep.label}`}
                  >
                    <ArrowLeft size={13} />
                    <span>Lùi bước</span>
                  </button>
                )}

                {nextStep && (
                  <button
                    type="button"
                    onClick={handleAdvanceNext}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-xs hover:shadow-md cursor-pointer animate-in fade-in"
                  >
                    <span>Bước tiếp: {nextStep.shortLabel}</span>
                    <ArrowRight size={14} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handlePendingSupplement}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  title="Tạm dừng chờ công dân bổ sung hồ sơ"
                >
                  <AlertTriangle size={13} className="text-amber-600" />
                  <span>Bổ sung</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Thông báo nếu đang ở trạng thái đặc biệt */}
      {isSpecialStatus && (
        <div className="mx-4 mt-3 p-3 rounded-lg border text-xs flex items-center justify-between gap-3 bg-amber-50 border-amber-200 text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Hồ sơ đang tạm dừng quy trình: </span>
              <span>
                {currentStatus === RecordStatus.PENDING_SUPPLEMENT
                  ? `Chờ bổ sung giấy tờ (${record.supplementReason || 'Chưa ghi rõ lý do'})`
                  : currentStatus === RecordStatus.WITHDRAWN
                  ? 'Chủ sử dụng đất đã rút hồ sơ'
                  : 'Hồ sơ đã bị huỷ / trả lại'}
              </span>
            </div>
          </div>
          {record.supplementRequestDate && (
            <span className="text-[11px] text-amber-700">
              Yêu cầu từ: {record.supplementRequestDate}
            </span>
          )}
        </div>
      )}

      {/* Thanh Stepper trực quan cuộn ngang nếu nhiều bước */}
      <div className="p-4 overflow-x-auto scrollbar-thin">
        <div className="min-w-[720px] flex items-center justify-between relative py-2">
          {workflow.steps.map((step, idx) => {
            const isCompleted = currentIndex > idx;
            const isCurrent = currentIndex === idx;
            const isPending = currentIndex < idx;
            const recordedDate = step.dateField ? (record[step.dateField] as string) : null;
            const stepSla = isCurrent ? currentStepSla : null;

            return (
              <React.Fragment key={step.key}>
                {/* Step Item */}
                <div
                  className="flex flex-col items-center text-center relative z-10 group cursor-pointer max-w-[115px]"
                  onClick={() => !readOnly && handleStepTransition(step)}
                  title={`${step.label} (Định mức: ${step.durationLabel}): ${step.description}`}
                >
                  {/* Circle Indicator */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                      isCurrent
                        ? stepSla?.isOverdue
                          ? 'bg-rose-600 text-white ring-4 ring-rose-100 shadow-md scale-110'
                          : stepSla?.status === 'warning'
                          ? 'bg-amber-600 text-white ring-4 ring-amber-100 shadow-md scale-110'
                          : 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-md scale-110'
                        : isCompleted
                        ? 'bg-emerald-600 text-white shadow-xs group-hover:bg-emerald-700'
                        : 'bg-white border-2 border-slate-300 text-slate-500 group-hover:border-blue-400 group-hover:text-blue-600'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={18} />
                    ) : isCurrent ? (
                      <span className="animate-pulse">{idx + 1}</span>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`mt-2 text-xs font-bold leading-tight transition-colors line-clamp-2 ${
                      isCurrent
                        ? stepSla?.isOverdue
                          ? 'text-rose-700 font-extrabold'
                          : 'text-blue-700 font-extrabold'
                        : isCompleted
                        ? 'text-emerald-700'
                        : 'text-slate-600 group-hover:text-slate-900'
                    }`}
                  >
                    {step.shortLabel}
                  </span>

                  {/* Định mức thời gian của bước */}
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded mt-0.5">
                    {step.durationLabel}
                  </span>

                  {/* Recorded Date or Status Tag */}
                  {recordedDate ? (
                    <span className="text-[10px] text-slate-500 mt-0.5 font-medium flex items-center gap-0.5">
                      <Clock size={9} />
                      {recordedDate.substring(5)}
                    </span>
                  ) : isCurrent ? (
                    stepSla?.isOverdue ? (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-300 mt-1 animate-pulse">
                        {stepSla.overdueLabel}
                      </span>
                    ) : stepSla?.status === 'warning' ? (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 mt-1">
                        Còn {stepSla.remainingLabel}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800 mt-1">
                        Đang xử lý
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Chờ đến lượt
                    </span>
                  )}
                </div>

                {/* Connecting Line between steps */}
                {idx < workflow.steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-1 relative top-[-18px]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        currentIndex > idx ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Footer chi tiết tiến độ & SLA của bước hiện tại */}
      {currentStep && (
        <div className="px-4 py-3 bg-slate-50/90 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-700 mt-0.5 sm:mt-0">
              <Timer size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-slate-900 font-bold text-sm">
                  Bước {currentIndex + 1}: {currentStep.label}
                </strong>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[11px]">
                  Định mức: {currentStep.durationLabel}
                </span>

                {currentStepSla && currentStepSla.step.isTaxPhase && (
                  <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Liên thông thuế: Không tính hạn giải quyết của Chi nhánh (Khoản 4 Điều 22 NĐ 101/2024)
                  </span>
                )}

                {currentStepSla && currentStepSla.step.isPostingPhase && (
                  <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-amber-100 text-amber-800 border border-amber-200">
                    Niêm yết UBND xã (30 ngày): Không tính hạn giải quyết của Chi nhánh (Điều 36 NĐ 101/2024)
                  </span>
                )}

                {currentStepSla && currentStepSla.durationHours > 0 && !isSpecialStatus && !currentStepSla.step.isTaxPhase && !currentStepSla.step.isPostingPhase && (
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                      currentStepSla.isOverdue
                        ? 'bg-rose-100 text-rose-800'
                        : currentStepSla.status === 'warning'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {currentStepSla.isOverdue
                      ? `Quá hạn: ${currentStepSla.overdueLabel}`
                      : `Thời gian đã dùng: ${currentStepSla.elapsedLabel} (Còn ${currentStepSla.remainingLabel})`}
                  </span>
                )}
              </div>
              <p className="text-slate-600 mt-0.5">{currentStep.description}</p>
            </div>
          </div>

          {/* Hộp thông tin liên thông thuế (không trừ thời gian Chi nhánh) */}
          {currentStepSla && currentStepSla.step.isTaxPhase && (
            <div className="min-w-[220px] flex flex-col gap-1 shrink-0 bg-indigo-50/90 p-2.5 rounded-lg border border-indigo-200 shadow-2xs">
              <div className="flex justify-between items-center text-[11px] font-bold text-indigo-900">
                <span className="flex items-center gap-1">
                  <Info size={13} className="text-indigo-600" />
                  Khâu Liên thông Thuế
                </span>
                <span className="text-[10px] bg-indigo-200/80 text-indigo-800 px-1.5 py-0.2 rounded font-semibold">Tạm dừng tính hạn</span>
              </div>
              <div className="text-[11px] text-indigo-700 font-medium">
                {currentStepSla.elapsedLabel}
              </div>
              <div className="text-[10px] text-slate-500 italic">
                Thời gian này không trừ vào thời hạn của Chi nhánh
              </div>
            </div>
          )}

          {/* Hộp thông tin niêm yết xã (không trừ thời gian Chi nhánh) */}
          {currentStepSla && currentStepSla.step.isPostingPhase && (
            <div className="min-w-[220px] flex flex-col gap-1 shrink-0 bg-amber-50/90 p-2.5 rounded-lg border border-amber-200 shadow-2xs">
              <div className="flex justify-between items-center text-[11px] font-bold text-amber-900">
                <span className="flex items-center gap-1">
                  <Info size={13} className="text-amber-600" />
                  Khâu Niêm yết UBND Xã
                </span>
                <span className="text-[10px] bg-amber-200/80 text-amber-800 px-1.5 py-0.2 rounded font-semibold">30 ngày niêm yết</span>
              </div>
              <div className="text-[11px] text-amber-800 font-medium">
                {currentStepSla.elapsedLabel}
              </div>
              <div className="text-[10px] text-slate-500 italic">
                Thời gian niêm yết không tính vào thời hạn Chi nhánh
              </div>
            </div>
          )}

          {/* Thanh tiến độ giờ làm việc của bước bình thường */}
          {currentStepSla && currentStepSla.durationHours > 0 && !isSpecialStatus && !currentStepSla.step.isTaxPhase && !currentStepSla.step.isPostingPhase && (
            <div className="min-w-[200px] flex flex-col gap-1 shrink-0 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
              <div className="flex justify-between text-[11px] font-medium text-slate-600">
                <span>Tiến độ bước:</span>
                <span
                  className={`font-bold ${
                    currentStepSla.isOverdue
                      ? 'text-rose-600'
                      : currentStepSla.status === 'warning'
                      ? 'text-amber-600'
                      : 'text-blue-600'
                  }`}
                >
                  {currentStepSla.percent}% {currentStepSla.isOverdue && '(Quá hạn)'}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    currentStepSla.isOverdue
                      ? 'bg-rose-500'
                      : currentStepSla.status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(100, currentStepSla.percent)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Đã qua: {currentStepSla.elapsedLabel}</span>
                <span>Hạn mức: {currentStepSla.durationLabel}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
