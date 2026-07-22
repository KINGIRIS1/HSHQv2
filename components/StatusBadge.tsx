
import React from 'react';
import { RecordStatus } from '../types';
import { STATUS_LABELS, STATUS_COLORS } from '../constants';

interface StatusBadgeProps {
  status: RecordStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  // Map specific status values to customized bullet colors
  const dotColors: Record<RecordStatus, string> = {
    [RecordStatus.RECEIVED]: 'bg-gray-400',
    [RecordStatus.ASSIGNED]: 'bg-blue-500',
    [RecordStatus.IN_PROGRESS]: 'bg-amber-500 animate-pulse',
    [RecordStatus.COMPLETED_WORK]: 'bg-cyan-500',
    [RecordStatus.PENDING_CHECK]: 'bg-orange-500',
    [RecordStatus.CHECKED]: 'bg-teal-500',
    [RecordStatus.PENDING_SIGN]: 'bg-purple-500',
    [RecordStatus.SIGNED]: 'bg-indigo-500',
    [RecordStatus.HANDOVER]: 'bg-green-500 animate-pulse',
    [RecordStatus.RETURNED]: 'bg-emerald-500',
    [RecordStatus.WITHDRAWN]: 'bg-slate-400',
    [RecordStatus.REJECTED]: 'bg-rose-500',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border transition-all duration-200 ${STATUS_COLORS[status]} border-current/10 shadow-sm whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[status] || 'bg-gray-400'}`} />
      <span className="leading-none">{STATUS_LABELS[status]}</span>
    </span>
  );
};

export default StatusBadge;
