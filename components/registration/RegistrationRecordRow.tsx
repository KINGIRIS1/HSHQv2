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
  CreditCard,
  Printer,
  Shield,
  FileCheck,
  Send,
  Pause,
} from 'lucide-react';
import { RecordFile, Employee, User as AppUser, RecordStatus, DossierComponentItem } from '../../types';
import StatusBadge from '../StatusBadge';
import { getRegistrationWorkflowCategory, getStepSlaInfo, getAppointmentInfo, calculateExactSla, calculateRecordStepSla } from '../../utils/registrationWorkflows';
import { resolveEmployeeName } from '../../utils/appHelpers';
import { isCertificateRecordType } from '../../constants';

interface RegistrationRecordRowProps {
  record: RecordFile;
  index: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onViewDetail: (record: RecordFile) => void;
  onEdit: (record: RecordFile) => void;
  onDelete?: (record: RecordFile) => void;
  onAssign?: (record: RecordFile) => void;
  onStepHandover?: (record: RecordFile, targetStatus: RecordStatus) => void;
  onTogglePauseSla?: (record: RecordFile) => void;
  employees?: Employee[];
  users?: AppUser[];
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
  onStepHandover,
  onTogglePauseSla,
  employees = [],
  users = [],
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
        <div className="flex flex-col gap-0.5">
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
          {isCertificateRecordType(record) && (() => {
            const exactSla = calculateExactSla(record);
            return (
              <span className={`text-[11px] font-bold ${exactSla.colorClass}`}>
                ⏱️ {exactSla.text}
              </span>
            );
          })()}
        </div>
      </td>

      {/* Chủ sử dụng & SĐT */}
      <td className="py-2.5 px-3 font-semibold text-slate-800">
        <div className="flex flex-col">
          <span className="text-slate-900 font-bold">{record.customerName || '—'}</span>
          {isCertificateRecordType(record) && (() => {
            const stepSla = calculateRecordStepSla(record);
            if (stepSla.isPaused) {
              return (
                <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1 mt-0.5">
                  <Pause size={11} className="text-amber-600" />
                  <span>{stepSla.remainingLabel}</span>
                </span>
              );
            }
            if (stepSla.isOverdue) {
              return (
                <span className="text-[11px] font-black text-rose-600 flex items-center gap-1 mt-0.5">
                  <AlertTriangle size={11} className="text-rose-500 shrink-0" />
                  <span>{stepSla.overdueLabel}</span>
                </span>
              );
            }
            return (
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                <Clock size={11} className="text-emerald-600 shrink-0" />
                <span>{stepSla.remainingLabel}</span>
              </span>
            );
          })()}
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

      {/* Cán bộ thụ lý theo từng bước */}
      <td className="py-2.5 px-3">
        {(() => {
          let currentStepOfficer = record.assignedTo || record.appraisalStaff;
          let roleLabel = 'Thẩm định';

          if (
            record.status === RecordStatus.TAX_TRANSFER ||
            record.status === RecordStatus.PENDING_TAX_KV7 ||
            record.status === RecordStatus.PENDING_TAX_PAYMENT
          ) {
            currentStepOfficer = record.taxStaff || record.taxTransferStaff || record.appraisalStaff || record.assignedTo;
            roleLabel = 'Chuyển thuế';
          } else if (record.status === RecordStatus.PENDING_PRINT_CERT) {
            currentStepOfficer = record.printStaff || record.printStaffId || record.appraisalStaff || record.assignedTo;
            roleLabel = 'In GCN';
          } else if (record.status === RecordStatus.PENDING_CHECK) {
            currentStepOfficer = record.checkedBy || record.appraisalStaff || record.assignedTo;
            roleLabel = 'Kiểm tra';
          } else if (record.status === RecordStatus.PENDING_SIGN || record.status === RecordStatus.SIGNED) {
            currentStepOfficer = record.submittedTo || record.appraisalStaff || record.assignedTo;
            roleLabel = 'Ký duyệt';
          } else if (record.status === RecordStatus.RETURNED || record.status === RecordStatus.HANDOVER) {
            currentStepOfficer = record.returnedBy || record.appraisalStaff || record.assignedTo;
            roleLabel = 'Trả KQ';
          }

          const tooltipDetails = [
            `Thẩm định: ${record.appraisalStaff || record.assignedTo || '—'}`,
            record.taxStaff || record.taxTransferStaff ? `Thuế: ${record.taxStaff || record.taxTransferStaff}` : null,
            record.printStaff || record.printStaffId ? `In GCN: ${record.printStaff || record.printStaffId}` : null,
            record.checkedBy ? `Kiểm tra: ${record.checkedBy}` : null,
            record.submittedTo ? `Ký duyệt: ${record.submittedTo}` : null,
            record.returnedBy ? `Trả KQ: ${record.returnedBy}` : null,
          ].filter(Boolean).join('\n');

          if (currentStepOfficer) {
            const displayName = resolveEmployeeName(currentStepOfficer, employees, users);
            return (
              <div
                className="flex flex-col gap-0.5"
                title={tooltipDetails}
              >
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-medium text-[11px] max-w-[130px] truncate">
                  <User size={11} className="text-blue-600 shrink-0" />
                  <span className="truncate">{displayName}</span>
                </div>
                {roleLabel && (
                  <span className="text-[10px] text-slate-400 font-normal pl-1">
                    {roleLabel}
                    {record.appraisalStaff && (record.taxStaff || record.printStaff) && roleLabel !== 'Thẩm định' && (
                      <span className="text-slate-400 ml-1" title={`Thẩm định: ${record.appraisalStaff}`}>
                        (TĐ: {record.appraisalStaff.split(' ').pop()})
                      </span>
                    )}
                  </span>
                )}
              </div>
            );
          }

          return (
            <button
              type="button"
              onClick={() => onAssign && onAssign(record)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 cursor-pointer font-medium text-[11px]"
            >
              <UserCheck size={11} />
              <span>Phân công</span>
            </button>
          );
        })()}
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
          {/* NÚT GIAO VIỆC / CHUYỂN BƯỚC NHANH TRỰC TIẾP TRÊN DÒNG HỒ SƠ */}
          {onStepHandover && (() => {
            if (record.status === RecordStatus.APPRAISAL) {
              return (
                <button
                  type="button"
                  onClick={() => onStepHandover(record, RecordStatus.TAX_TRANSFER)}
                  title="Giao chuyển thuế"
                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <CreditCard size={12} />
                  <span>Giao thuế</span>
                </button>
              );
            }
            if (record.status === RecordStatus.TAX_TRANSFER) {
              return (
                <button
                  type="button"
                  onClick={() => onStepHandover(record, RecordStatus.PENDING_TAX_KV7)}
                  title="Chuyển Thuế KV7"
                  className="px-2 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <span>Sang KV7</span>
                </button>
              );
            }
            if (record.status === RecordStatus.PENDING_TAX_KV7) {
              return (
                <button
                  type="button"
                  onClick={() => onStepHandover(record, RecordStatus.PENDING_TAX_PAYMENT)}
                  title="Nhận Thông báo thuế (GNT)"
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <span>Nhận TB</span>
                </button>
              );
            }
            if (record.status === RecordStatus.PENDING_TAX_PAYMENT) {
              return (
                <button
                  type="button"
                  onClick={() => onStepHandover(record, RecordStatus.PENDING_PRINT_CERT)}
                  title="Giao In Giấy chứng nhận (GCN)"
                  className="px-2 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Printer size={12} />
                  <span>Giao In</span>
                </button>
              );
            }
            if (record.status === RecordStatus.PENDING_PRINT_CERT) {
              return (
                <button
                  type="button"
                  onClick={() => onStepHandover(record, RecordStatus.PENDING_CHECK)}
                  title="Trình Kiểm tra hồ sơ"
                  className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Shield size={12} />
                  <span>Trình KT</span>
                </button>
              );
            }
            if (record.status === RecordStatus.PENDING_CHECK) {
              return (
                <button
                  type="button"
                  onClick={() => onStepHandover(record, RecordStatus.PENDING_SIGN)}
                  title="Trình Lãnh đạo ký duyệt"
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <FileCheck size={12} />
                  <span>Trình Ký</span>
                </button>
              );
            }
            if (record.status === RecordStatus.PENDING_SIGN || record.status === RecordStatus.SIGNED || record.status === RecordStatus.PENDING_HANDOVER) {
              return (
                <button
                  type="button"
                  onClick={() => onStepHandover(record, RecordStatus.RETURNED)}
                  title="Bàn giao Trả kết quả (Một cửa)"
                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Send size={12} />
                  <span>Trả KQ</span>
                </button>
              );
            }
            return null;
          })()}

          {onTogglePauseSla && (
            <button
              type="button"
              onClick={() => onTogglePauseSla(record)}
              title={record.isSlaPaused ? "Đang tạm dừng SLA. Bấm để tiếp tục tính SLA" : "Bấm để tạm dừng tính SLA hồ sơ"}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                record.isSlaPaused
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 ring-1 ring-amber-300 font-bold'
                  : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
              }`}
            >
              <Pause size={14} className={record.isSlaPaused ? "text-amber-700 animate-pulse" : ""} />
            </button>
          )}

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
