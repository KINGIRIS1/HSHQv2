
import React from 'react';
import { RecordStatus } from '../types';
import { STATUS_LABELS, STATUS_COLORS, mapStatusToRecordStatus } from '../constants';

interface StatusBadgeProps {
  status: RecordStatus | string;
  isApproaching?: boolean;
  isOverdue?: boolean;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, isApproaching, isOverdue, className = '' }) => {
  const normalizedStatus = mapStatusToRecordStatus(status);

  // Map specific status values to customized bullet colors
  const dotColors: Record<RecordStatus, string> = {
    [RecordStatus.RECEIVED]: 'bg-gray-400',
    [RecordStatus.ASSIGNED]: 'bg-blue-500',
    [RecordStatus.IN_PROGRESS]: 'bg-amber-500 animate-pulse',
    [RecordStatus.FIELD_WORK]: 'bg-sky-500 animate-pulse',
    [RecordStatus.OFFICE_WORK]: 'bg-indigo-500 animate-pulse',
    [RecordStatus.COMPLETED_WORK]: 'bg-cyan-500',
    [RecordStatus.PENDING_CHECK]: 'bg-orange-500',
    [RecordStatus.PENDING_SIGN]: 'bg-purple-500',
    [RecordStatus.SIGNED]: 'bg-indigo-500',
    [RecordStatus.HANDOVER]: 'bg-green-500 animate-pulse',
    [RecordStatus.RETURNED]: 'bg-emerald-500',
    [RecordStatus.PENDING_SUPPLEMENT]: 'bg-pink-500',
    [RecordStatus.WITHDRAWN]: 'bg-slate-400',
    [RecordStatus.REJECTED]: 'bg-rose-500',
    [RecordStatus.APPRAISAL]: 'bg-blue-500 animate-pulse',
    [RecordStatus.PENDING_POSTING]: 'bg-amber-500 animate-pulse',
    [RecordStatus.TAX_TRANSFER]: 'bg-indigo-500',
    [RecordStatus.PENDING_TAX_KV7]: 'bg-violet-500',
    [RecordStatus.PENDING_TAX_NOTICE]: 'bg-amber-500',
    [RecordStatus.PENDING_TAX_PAYMENT]: 'bg-amber-500',
    [RecordStatus.PENDING_PRINT_CERT]: 'bg-teal-500',
    [RecordStatus.PENDING_HANDOVER]: 'bg-cyan-500 animate-pulse',
  };

  const label = STATUS_LABELS[normalizedStatus] || String(status || 'Chưa xác định');
  
  // Đổi màu vàng cảnh báo khi sắp trễ hạn (còn <= 1h làm việc)
  let colorClass = STATUS_COLORS[normalizedStatus] || 'bg-gray-100 text-gray-800';
  let dotClass = dotColors[normalizedStatus] || 'bg-gray-400';

  if (isApproaching) {
    colorClass = 'bg-amber-100 text-amber-900 border-amber-400 ring-2 ring-amber-400/60 font-black';
    dotClass = 'bg-amber-500 animate-pulse';
  } else if (isOverdue) {
    colorClass = `${colorClass} ring-1 ring-red-400 font-bold`;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border transition-all duration-200 ${colorClass} border-current/10 shadow-sm whitespace-nowrap ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      <span className="leading-none">{label}</span>
    </span>
  );
};

export default React.memo(StatusBadge);
