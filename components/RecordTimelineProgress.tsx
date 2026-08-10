import React from 'react';
import { RecordFile, Employee, User, UserRole, RecordStatus } from '../types';
import { getNormalizedWard, getShortRecordType, isCapGiayRecord } from '../constants';
import { getBatchDisplayParts } from '../utils/appHelpers';
import { 
  CheckCircle2, Circle, Clock, AlertTriangle, Calendar, User as UserIcon, 
  Send, FileSignature, CheckSquare, FileCheck, Timer, ArrowRight, CalendarClock, Hash,
  ClipboardList, FileText
} from 'lucide-react';

interface RecordTimelineProgressProps {
  record: RecordFile;
  employees: Employee[];
  users: User[];
  formatDate: (dateStr?: string | null) => string;
}

// Helper: Calculate duration text between two ISO string dates or null (using now as fallback for end date)
export const getStepDurationText = (startDateStr?: string | null, endDateStr?: string | null): string | null => {
  if (!startDateStr) return null;
  const start = new Date(startDateStr).getTime();
  if (isNaN(start)) return null;

  const end = endDateStr ? new Date(endDateStr).getTime() : Date.now();
  if (isNaN(end)) return null;

  const diffMs = end - start;
  if (diffMs < 0) return '0 giờ';

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;

  if (days >= 1) {
    if (remainingHours > 0) {
      return `${days} ngày ${remainingHours}g`;
    }
    return `${days} ngày`;
  } else if (totalHours >= 1) {
    const remainMins = totalMinutes % 60;
    if (remainMins > 0) {
      return `${totalHours}g ${remainMins}p`;
    }
    return `${totalHours} giờ`;
  } else {
    return `${totalMinutes > 0 ? totalMinutes : 1} phút`;
  }
};

export const RecordTimelineProgress: React.FC<RecordTimelineProgressProps> = ({
  record,
  employees,
  users,
  formatDate
}) => {
  // Determine finish date
  const isFinished = [RecordStatus.HANDOVER, RecordStatus.RETURNED].includes(record.status) || !!record.resultReturnedDate || !!record.completedDate;
  const finishDateStr = record.resultReturnedDate || record.completedDate || record.exportDate || null;

  // Deadline calculation
  const receivedMs = record.receivedDate ? new Date(record.receivedDate).getTime() : Date.now();
  const deadlineMs = record.deadline ? new Date(record.deadline).getTime() : receivedMs + (30 * 86400000);
  const currentMs = isFinished && finishDateStr ? new Date(finishDateStr).getTime() : Date.now();

  const totalDurationMs = Math.max(86400000, deadlineMs - receivedMs);
  const elapsedMs = Math.max(0, currentMs - receivedMs);

  const rawPercent = Math.round((elapsedMs / totalDurationMs) * 100);
  const progressPercent = Math.min(100, Math.max(0, rawPercent));

  // Overdue / Remaining days
  const nowOrFinish = isFinished && finishDateStr ? new Date(finishDateStr) : new Date();
  const deadlineDate = record.deadline ? new Date(record.deadline) : null;
  
  let deadlineStatusBadge = {
    text: 'Đang thực hiện',
    className: 'bg-blue-100 text-blue-800 border-blue-300'
  };

  if (deadlineDate) {
    // Set deadline to end of day for comparison
    const targetEnd = new Date(deadlineDate);
    targetEnd.setHours(23, 59, 59, 999);
    
    const diffTime = targetEnd.getTime() - nowOrFinish.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (isFinished) {
      if (diffDays >= 0) {
        deadlineStatusBadge = {
          text: diffDays === 0 ? 'Hoàn thành đúng hạn' : `Sớm ${diffDays} ngày`,
          className: 'bg-emerald-100 text-emerald-800 border-emerald-300'
        };
      } else {
        deadlineStatusBadge = {
          text: `Trễ hạn ${Math.abs(diffDays)} ngày`,
          className: 'bg-rose-100 text-rose-800 border-rose-300'
        };
      }
    } else {
      if (diffDays > 0) {
        deadlineStatusBadge = {
          text: `Còn ${diffDays} ngày`,
          className: 'bg-indigo-100 text-indigo-800 border-indigo-300'
        };
      } else if (diffDays === 0) {
        deadlineStatusBadge = {
          text: 'Hạn chót hôm nay!',
          className: 'bg-amber-100 text-amber-800 border-amber-300 font-bold animate-pulse'
        };
      } else {
        deadlineStatusBadge = {
          text: `Quá hạn ${Math.abs(diffDays)} ngày`,
          className: 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse'
        };
      }
    }
  }

  // Active status checks
  const isWorkDone = [
    RecordStatus.PENDING_CHECK, 
    RecordStatus.PENDING_SIGN, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.completedWorkDate;

  const isPendingCheckActive = [
    RecordStatus.PENDING_CHECK, RecordStatus.PENDING_SIGN, 
    RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.pendingCheckDate;

  const isPendingSignActive = [
    RecordStatus.PENDING_SIGN, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.submissionDate;

  const isHideCheckSteps = record.recordType === 'Cung cấp tài liệu đất đai' || record.recordType === 'Sao lục' || record.recordType === 'Công văn';

  const isCG = isCapGiayRecord(record);

  // Build timeline steps array
  const steps = [
    {
      id: 'received',
      label: 'NHẬN HỒ SƠ',
      date: record.receivedDate,
      forceActive: true,
      icon: UserIcon,
      colorClass: { text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600' },
      subText: record.receivedBy ? (() => {
        const receiver = users.find(u => u.employeeId === record.receivedBy);
        if (!receiver) return undefined;
        const emp = employees.find(e => e.id === receiver.employeeId);
        return `${receiver.name} (${emp?.position || 'Nhân viên'})`;
      })() : undefined,
      durationLabel: getStepDurationText(record.receivedDate, record.assignedDate || record.pendingCheckDate || record.submissionDate)
    },
    ...(!isCG ? [
      {
        id: 'assigned',
        label: 'GIAO NHÂN VIÊN',
        date: record.assignedDate,
        forceActive: !!record.assignedDate || isWorkDone,
        icon: UserIcon,
        colorClass: { text: 'text-blue-700', border: 'border-blue-600', bg: 'bg-blue-600' },
        subText: record.assignedTo ? (() => {
          const emp = employees.find(e => e.id === record.assignedTo);
          if (!emp) return undefined;
          return `${emp.name} (${emp.department})`;
        })() : undefined,
        durationLabel: record.assignedDate ? getStepDurationText(record.assignedDate, record.pendingCheckDate || record.submissionDate) : null
      }
    ] : []),
    ...(isCG ? [
      {
        id: 'tham_dinh',
        label: 'THẨM ĐỊNH',
        date: ['tham_dinh', 'phieu_chuyen_thue', 'cho_tbt', 'cho_gnt', 'in_hoan_thien', 'hoan_thien_trinh_duyet', 'trinh_kiem_tra', 'trinh_ky', 'cho_ban_giao', 'da_ban_giao'].includes(record.capGiaySubStep || '') ? record.receivedDate : null,
        forceActive: true,
        icon: ClipboardList,
        colorClass: { text: 'text-indigo-700', border: 'border-indigo-600', bg: 'bg-indigo-600' },
        subText: record.assignedTo ? (() => {
          const emp = employees.find(e => e.id === record.assignedTo);
          return emp ? `${emp.name} (${emp.department})` : undefined;
        })() : undefined,
        durationLabel: null
      },
      {
        id: 'phieu_chuyen_thue',
        label: 'CHUYỂN THUẾ',
        date: record.taxTransferDate || (['phieu_chuyen_thue', 'cho_tbt', 'cho_gnt', 'in_hoan_thien', 'hoan_thien_trinh_duyet', 'trinh_kiem_tra', 'trinh_ky', 'cho_ban_giao', 'da_ban_giao'].includes(record.capGiaySubStep || '') ? record.assignedDate : null),
        forceActive: ['phieu_chuyen_thue', 'cho_tbt', 'cho_gnt', 'in_hoan_thien', 'hoan_thien_trinh_duyet', 'trinh_kiem_tra', 'trinh_ky', 'cho_ban_giao', 'da_ban_giao'].includes(record.capGiaySubStep || ''),
        icon: FileText,
        colorClass: { text: 'text-amber-700', border: 'border-amber-600', bg: 'bg-amber-600' },
        subText: record.assignedTo ? (() => {
          const emp = employees.find(e => e.id === record.assignedTo);
          return emp ? `${emp.name} (${emp.department})` : undefined;
        })() : undefined,
        durationLabel: null
      },
      {
        id: 'cho_tbt',
        label: 'THUẾ KV7',
        date: record.taxNoticeDate || (['cho_tbt', 'cho_gnt', 'in_hoan_thien', 'hoan_thien_trinh_duyet', 'trinh_kiem_tra', 'trinh_ky', 'cho_ban_giao', 'da_ban_giao'].includes(record.capGiaySubStep || '') ? record.assignedDate : null),
        forceActive: ['cho_tbt', 'cho_gnt', 'in_hoan_thien', 'hoan_thien_trinh_duyet', 'trinh_kiem_tra', 'trinh_ky', 'cho_ban_giao', 'da_ban_giao'].includes(record.capGiaySubStep || ''),
        icon: FileText,
        colorClass: { text: 'text-orange-700', border: 'border-orange-600', bg: 'bg-orange-600' },
        subText: record.assignedTo ? (() => {
          const emp = employees.find(e => e.id === record.assignedTo);
          return emp ? `${emp.name} (${emp.department})` : undefined;
        })() : undefined,
        durationLabel: null
      },
      {
        id: 'cho_gnt',
        label: 'GIẤY NỘP TIỀN',
        date: record.taxPaidDate || (['cho_gnt', 'in_hoan_thien', 'hoan_thien_trinh_duyet', 'trinh_kiem_tra', 'trinh_ky', 'cho_ban_giao', 'da_ban_giao'].includes(record.capGiaySubStep || '') ? record.assignedDate : null),
        forceActive: ['cho_gnt', 'in_hoan_thien', 'hoan_thien_trinh_duyet', 'trinh_kiem_tra', 'trinh_ky', 'cho_ban_giao', 'da_ban_giao'].includes(record.capGiaySubStep || ''),
        icon: FileText,
        colorClass: { text: 'text-yellow-700', border: 'border-yellow-600', bg: 'bg-yellow-600' },
        subText: record.assignedTo ? (() => {
          const emp = employees.find(e => e.id === record.assignedTo);
          return emp ? `${emp.name} (${emp.department})` : undefined;
        })() : undefined,
        durationLabel: null
      },
      {
        id: 'in_hoan_thien',
        label: 'IN & HOÀN THIỆN',
        date: record.printedDate || (['in_hoan_thien', 'hoan_thien_trinh_duyet', 'trinh_kiem_tra', 'trinh_ky', 'cho_ban_giao', 'da_ban_giao'].includes(record.capGiaySubStep || '') ? record.submissionDate : null),
        forceActive: ['in_hoan_thien', 'hoan_thien_trinh_duyet', 'trinh_kiem_tra', 'trinh_ky', 'cho_ban_giao', 'da_ban_giao'].includes(record.capGiaySubStep || ''),
        icon: FileCheck,
        colorClass: { text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600' },
        subText: record.assignedTo ? (() => {
          const emp = employees.find(e => e.id === record.assignedTo);
          return emp ? `${emp.name} (${emp.department})` : undefined;
        })() : undefined,
        durationLabel: null
      }
    ] : []),
    ...(!isHideCheckSteps ? [
      {
        id: 'pending_check',
        label: 'TRÌNH KIỂM TRA',
        date: record.pendingCheckDate,
        forceActive: isPendingCheckActive,
        icon: Send,
        colorClass: { text: 'text-orange-700', border: 'border-orange-600', bg: 'bg-orange-600' },
        subText: (record.pendingCheckDate || isPendingCheckActive) && record.checkedBy ? (() => {
          const checker = employees.find(e => e.id === record.checkedBy);
          if (!checker) return undefined;
          return `${checker.name} (${checker?.position || 'Người kiểm tra'})`;
        })() : undefined,
        durationLabel: record.pendingCheckDate ? getStepDurationText(record.pendingCheckDate, record.submissionDate) : null
      }
    ] : []),
    {
      id: 'submission',
      label: 'TRÌNH KÝ',
      date: record.submissionDate,
      forceActive: isPendingSignActive,
      icon: Send,
      colorClass: { text: 'text-indigo-700', border: 'border-indigo-600', bg: 'bg-indigo-600' },
      subText: (record.submissionDate || isPendingSignActive) && record.submittedTo ? (() => {
        const director = users.find(u => u.employeeId === record.submittedTo);
        if (!director) return undefined;
        const emp = employees.find(e => e.id === director.employeeId);
        return `${director.name} (${emp?.position || (director.role === UserRole.ADMIN ? 'Giám đốc' : 'Phó giám đốc')})`;
      })() : undefined,
      durationLabel: record.submissionDate ? getStepDurationText(record.submissionDate, isCG ? (record.completedDate || record.exportDate) : (record.approvalDate || record.completedDate)) : null
    },

    {
      id: 'completion',
      label: record.status === RecordStatus.REJECTED ? "HỒ SƠ TRẢ" : record.status === RecordStatus.WITHDRAWN ? "RÚT HỒ SƠ" : "HOÀN THÀNH",
      date: record.completedDate || record.exportDate,
      forceActive: !!record.completedDate || !!record.exportDate || !!record.exportBatch,
      icon: CheckSquare,
      colorClass: { 
        text: record.status === RecordStatus.REJECTED ? 'text-red-700' : 'text-green-700', 
        border: record.status === RecordStatus.REJECTED ? 'border-red-600' : 'border-green-600', 
        bg: record.status === RecordStatus.REJECTED ? 'bg-red-600' : 'bg-green-600' 
      },
      subText: record.exportBatch ? (() => {
        const parts = getBatchDisplayParts(record.exportBatch, record.exportDate || record.completedDate);
        return parts?.batchName || `Đợt ${record.exportBatch}`;
      })() : undefined,
      durationLabel: (record.completedDate || record.exportDate) ? getStepDurationText(record.completedDate || record.exportDate, record.resultReturnedDate) : null
    },
    {
      id: 'result_returned',
      label: 'TRẢ KẾT QUẢ',
      date: record.resultReturnedDate,
      forceActive: !!record.resultReturnedDate,
      icon: FileCheck,
      colorClass: { text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600' },
      subText: record.resultReturnedDate && record.receiverName ? `Người nhận: ${record.receiverName}` : undefined,
      durationLabel: null
    }
  ];

  return (
    <div className="space-y-4">
      {/* Deadline Header Card matching design */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="bg-indigo-600 px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock size={16} className="text-white shrink-0" />
            <span className="text-xs font-bold text-white uppercase tracking-wide">
              TIẾN ĐỘ & THỜI GIAN
            </span>
          </div>
          {deadlineStatusBadge.text && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white/90 ${deadlineStatusBadge.className}`}>
              {deadlineStatusBadge.text}
            </span>
          )}
        </div>
        <div className="p-4 flex flex-col items-center justify-center text-center space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            HẠN TRẢ KẾT QUẢ
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight my-1">
            {formatDate(record.deadline) || '---'}
          </div>
          <div className="inline-block bg-slate-100 text-slate-500 text-xs font-medium px-3 py-1 rounded-md">
            Ngày nhận: {formatDate(record.receivedDate) || '---'}
          </div>
        </div>
      </div>

      {/* Visual Step-by-Step Timeline */}
      <div className="p-1 space-y-0">
        {steps.map((step, index) => {
          const isActive = !!step.date || !!step.forceActive;
          const isLast = index === steps.length - 1;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative flex gap-3.5">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 bg-white transition-all ${
                  isActive ? `${step.colorClass.border} shadow-xs` : 'border-slate-200'
                }`}>
                  {isActive ? (
                    <CheckCircle2 size={16} className={step.colorClass.text} />
                  ) : (
                    <Circle size={16} className="text-slate-300" />
                  )}
                </div>
                {!isLast && (
                  <div className={`w-0.5 grow ${isActive ? step.colorClass.bg : 'bg-slate-200'} my-1 min-h-[32px]`} />
                )}
              </div>

              <div className="pb-5 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-xs font-bold uppercase ${isActive ? step.colorClass.text : 'text-slate-400'}`}>
                    {step.label}
                  </p>

                  {/* Step Elapsed Duration Badge */}
                  {step.durationLabel && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200/60 shrink-0">
                      <Clock size={10} className="text-slate-500" />
                      <span>{step.durationLabel}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <Icon size={14} className={isActive ? 'text-slate-500' : 'text-slate-300'} />
                  <span className={`text-xs font-semibold ${isActive ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                    {step.date ? formatDate(step.date) : (step.forceActive ? 'Đã hoàn tất' : 'Chưa thực hiện')}
                  </span>
                </div>

                {step.subText && (
                  <p className="text-[11px] text-indigo-600 font-medium mt-0.5 italic truncate">
                    {step.subText}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
