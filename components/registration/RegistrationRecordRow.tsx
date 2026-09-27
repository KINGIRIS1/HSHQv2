import React from 'react';
import {
  FileText,
  User,
  Calendar,
  MapPin,
  Clock,
  Paperclip,
  Edit2,
  Trash2,
  UserCheck,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { RecordFile, Employee, RecordStatus, DossierComponentItem } from '../../types';
import StatusBadge from '../StatusBadge';
import { getRegistrationWorkflowCategory, getStepSlaInfo, getAppointmentInfo } from '../../utils/registrationWorkflows';

interface RegistrationRecordRowProps {
  record: RecordFile;
  index: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onViewDetail: (record: RecordFile) => void;
  onEdit: (record: RecordFile) => void;
  onDelete?: (record: RecordFile) => void;
  onAssign?: (record: RecordFile) => void;
  employees?: Employee[];
}

export const RegistrationRecordRow: React.FC<RegistrationRecordRowProps> = ({
  record,
  index,
  isSelected,
  onToggleSelect,
  onViewDetail,
  onEdit,
  onDelete,
  onAssign,
  employees = [],
}) => {
  const isOverdue = React.useMemo(() => {
    if (
      !record.deadline ||
      record.status === RecordStatus.RETURNED ||
      record.status === RecordStatus.HANDOVER
    ) {
      return false;
    }
    const today = new Date().toISOString().substring(0, 10);
    return record.deadline < today;
  }, [record.deadline, record.status]);

  const hasAttachments =
    (record.attachedFiles && record.attachedFiles.length > 0) ||
    (Array.isArray(record.dossierComponents) &&
      (record.dossierComponents as DossierComponentItem[]).some((c) => Boolean(c.attachedFile)));

  return (
    <tr
      className={`border-b border-gray-100 transition-colors hover:bg-blue-50/40 text-xs ${
        isSelected ? 'bg-blue-50/80' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
      }`}
    >
      {/* Checkbox chọn */}
      <td className="py-2.5 px-3 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(record.id)}
          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
        />
      </td>

      {/* STT */}
      <td className="py-2.5 px-2 text-center text-slate-500 font-medium">{index + 1}</td>

      {/* Mã hồ sơ */}
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onViewDetail(record)}
            className="font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer text-left flex items-center gap-1"
          >
            <FileText size={13} className="text-blue-600 shrink-0" />
            <span>{record.code}</span>
          </button>
          {hasAttachments && (
            <span title="Có tệp đính kèm" className="text-emerald-600">
              <Paperclip size={12} />
            </span>
          )}
        </div>
      </td>

      {/* Chủ sử dụng & SĐT */}
      <td className="py-2.5 px-3 font-semibold text-slate-800">
        <div className="flex flex-col">
          <span className="text-slate-900 font-bold">{record.customerName || '—'}</span>
          {record.phoneNumber && (
            <span className="text-[11px] text-slate-500 font-normal">{record.phoneNumber}</span>
          )}
        </div>
      </td>

      {/* Xã / Phường */}
      <td className="py-2.5 px-3 text-slate-700">
        <div className="flex items-center gap-1">
          <MapPin size={12} className="text-slate-400 shrink-0" />
          <span>{record.ward || '—'}</span>
        </div>
      </td>

      {/* Thửa / Tờ */}
      <td className="py-2.5 px-3 text-slate-700 text-center">
        <span className="font-semibold text-slate-800">
          {record.landPlot ? `T.${record.landPlot}` : '—'}
          {record.mapSheet ? ` / TBĐ.${record.mapSheet}` : ''}
        </span>
      </td>

      {/* Nội dung hồ sơ & Quy trình */}
      <td className="py-2.5 px-3 text-slate-600 max-w-[240px]">
        {(() => {
          const cat = getRegistrationWorkflowCategory(record.recordType);
          const catBadges: Record<string, { label: string; cls: string }> = {
            tax_transfer: { label: 'Có thuế', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
            fast_track: { label: 'Không thuế', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
            gdbd: { label: 'Thế chấp/GDBD', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
            gdbd_register: { label: 'ĐK Thế chấp', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
            gdbd_release: { label: 'Giải chấp', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
            lost_cert: { label: 'Mất GCN', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
            lost_cert_tax: { label: 'Mất GCN (có thuế)', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
            split_plot: { label: 'Tách/Hợp', cls: 'bg-teal-50 text-teal-800 border-teal-200' },
            unclassified: { label: 'Chưa phân loại', cls: 'bg-slate-100 text-slate-500 border-slate-300' },
          };
          const badge = catBadges[cat] || catBadges.unclassified;

          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${badge.cls}`}>
                  {badge.label}
                </span>
                <span className="text-[11px] font-bold text-slate-800 truncate" title={record.recordType || ''}>
                  {record.recordType || 'Đăng ký đất đai'}
                </span>
              </div>
              {record.content && (
                <span className="text-[11px] text-slate-500 truncate" title={record.content}>
                  {record.content}
                </span>
              )}
            </div>
          );
        })()}
      </td>

      {/* Cán bộ thụ lý */}
      <td className="py-2.5 px-3">
        {record.assignedTo ? (
          (() => {
            const cleanKey = (record.assignedTo || '').trim().toLowerCase();
            const emp = (employees || []).find(e => 
              (e.id || '').trim().toLowerCase() === cleanKey || 
              (e.name || '').trim().toLowerCase() === cleanKey
            );
            const displayName = emp && emp.name ? emp.name : record.assignedTo;
            return (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-medium">
                <User size={11} className="text-slate-500" />
                <span title={displayName}>{displayName}</span>
              </div>
            );
          })()
        ) : (
          <button
            type="button"
            onClick={() => onAssign && onAssign(record)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 cursor-pointer font-medium text-[11px]"
          >
            <UserCheck size={11} />
            <span>Phân công</span>
          </button>
        )}
      </td>

      {/* Ngày tiếp nhận & Hạn giải quyết */}
      <td className="py-2.5 px-3 text-slate-600">
        {(() => {
          const appInfo = getAppointmentInfo(record);
          return (
            <div className="flex flex-col text-[11px] gap-0.5">
              <span className="flex items-center gap-1 text-slate-500">
                <Calendar size={11} className="text-slate-400" />
                <span>Nhận: {record.receivedDate || '—'}</span>
              </span>
              <span
                className={`flex items-center gap-1 font-bold ${
                  appInfo.phase === 'tax_notice'
                    ? 'text-indigo-700'
                    : isOverdue
                    ? 'text-red-600'
                    : 'text-emerald-700'
                }`}
                title={appInfo.description}
              >
                <Clock size={11} className={appInfo.phase === 'tax_notice' ? 'text-indigo-600' : 'text-emerald-600'} />
                <span>{appInfo.shortLabel}: {appInfo.formattedAppointmentDate}</span>
              </span>
            </div>
          );
        })()}
      </td>

      {/* Trạng thái */}
      <td className="py-2.5 px-3 text-center">
        <div className="flex flex-col items-center">
          <StatusBadge status={record.status} />
          {(() => {
            const sla = getStepSlaInfo(record);
            if (!sla || sla.status === 'completed' || sla.status === 'waiting') return null;
            if (sla.step.isTaxPhase) {
              return (
                <span className="mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200" title="Khâu liên thông thuế: Không tính vào thời hạn giải quyết của Chi nhánh">
                  <span>Thuế (Không tính hạn)</span>
                </span>
              );
            }
            if (sla.step.isPostingPhase) {
              return (
                <span className="mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200" title="Khâu niêm yết tại UBND xã 30 ngày: Không tính vào thời hạn giải quyết của Chi nhánh">
                  <span>Niêm yết xã (Không tính hạn)</span>
                </span>
              );
            }
            if (sla.durationHours === 0) return null;
            if (sla.status === 'overdue') {
              return (
                <span className="mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title={`Khâu ${sla.step.label} đã quá hạn ${sla.overdueLabel}`}>
                  <AlertTriangle size={10} className="text-rose-600" />
                  <span>Trễ khâu {sla.overdueLabel.replace('Trễ ', '')}</span>
                </span>
              );
            }
            if (sla.status === 'warning') {
              return (
                <span className="mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200" title={`Khâu ${sla.step.label} còn ${sla.remainingLabel}`}>
                  <Clock size={10} className="text-amber-600" />
                  <span>Còn {sla.remainingLabel}</span>
                </span>
              );
            }
            return (
              <span className="mt-0.5 inline-block text-[10px] text-slate-400 font-medium">
                Khâu: {sla.durationLabel}
              </span>
            );
          })()}
        </div>
      </td>

      {/* Nút thao tác */}
      <td className="py-2.5 px-3 text-right">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => onViewDetail(record)}
            title="Xem chi tiết"
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          >
            <Eye size={14} />
          </button>

          <button
            type="button"
            onClick={() => onEdit(record)}
            title="Sửa hồ sơ"
            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
          >
            <Edit2 size={14} />
          </button>

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(record)}
              title="Xóa hồ sơ"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
