
import React from 'react';
import { RecordStatus, DangKyStatusType } from '../types';
import { STATUS_LABELS, STATUS_COLORS } from '../constants';

interface StatusBadgeProps {
  status: RecordStatus | DangKyStatusType | string;
}

const dangKyBadgeClasses: Record<string, string> = {
  'Tiếp nhận mới': 'bg-blue-100 text-blue-800 border-blue-300',
  'Thẩm định': 'bg-purple-100 text-purple-800 border-purple-300',
  'Phiếu chuyển thuế': 'bg-amber-100 text-amber-800 border-amber-300',
  'Chờ Thuế KV7': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Chờ giấy nộp tiền': 'bg-orange-100 text-orange-800 border-orange-300',
  'Chờ In GCN': 'bg-indigo-100 text-indigo-800 border-indigo-300',
  'Chờ kiểm tra': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'Chờ ký duyệt': 'bg-teal-100 text-teal-800 border-teal-300',
  'Chờ bàn giao': 'bg-sky-100 text-sky-800 border-sky-300',
  'Đã giao 1 cửa': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Đã trả kết quả': 'bg-green-100 text-green-800 border-green-300',
  'Chờ bổ sung': 'bg-rose-100 text-rose-800 border-rose-300',
  'CSD rút HS': 'bg-slate-100 text-slate-700 border-slate-300',
  'Trả hủy hồ sơ': 'bg-red-100 text-red-800 border-red-300',
};

const dangKyDotColors: Record<string, string> = {
  'Tiếp nhận mới': 'bg-blue-500',
  'Thẩm định': 'bg-purple-500',
  'Phiếu chuyển thuế': 'bg-amber-500',
  'Chờ Thuế KV7': 'bg-yellow-500',
  'Chờ giấy nộp tiền': 'bg-orange-500',
  'Chờ In GCN': 'bg-indigo-500',
  'Chờ kiểm tra': 'bg-cyan-500',
  'Chờ ký duyệt': 'bg-teal-500',
  'Chờ bàn giao': 'bg-sky-500',
  'Đã giao 1 cửa': 'bg-emerald-500',
  'Đã trả kết quả': 'bg-green-500',
  'Chờ bổ sung': 'bg-rose-500',
  'CSD rút HS': 'bg-slate-500',
  'Trả hủy hồ sơ': 'bg-red-500',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  if (dangKyBadgeClasses[status]) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border transition-all duration-200 ${dangKyBadgeClasses[status]} shadow-xs whitespace-nowrap`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dangKyDotColors[status] || 'bg-gray-400'}`} />
        <span className="leading-none">{status}</span>
      </span>
    );
  }

  const recStatus = status as RecordStatus;
  const dotColors: Record<string, string> = {
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
    [RecordStatus.PENDING_SUPPLEMENT]: 'bg-pink-500',
    [RecordStatus.WITHDRAWN]: 'bg-slate-400',
    [RecordStatus.REJECTED]: 'bg-rose-500',
  };

  const label = STATUS_LABELS[recStatus] || status || '---';
  const colorClass = STATUS_COLORS[recStatus] || 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border transition-all duration-200 ${colorClass} border-current/10 shadow-xs whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[recStatus] || 'bg-gray-400'}`} />
      <span className="leading-none">{label}</span>
    </span>
  );
};

export default React.memo(StatusBadge);
