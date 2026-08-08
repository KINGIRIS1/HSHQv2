
import React from 'react';
import { RecordFile, RecordStatus, Employee, UserRole } from '../types';
import { getNormalizedWard, getShortRecordType, getWardLabel, isCapGiayRecord, getCapGiaySubStepLabel, getCapGiaySubStepBadgeColor } from '../constants';
import { isRecordOverdue, isRecordApproaching, toTitleCase, formatBatchName, getBatchDisplayParts } from '../utils/appHelpers';
import { hasUserPermission } from '../config/roleConfig';
import StatusBadge from './StatusBadge';
import { CheckSquare, Square, AlertCircle, Clock, Eye, ArrowRight, Pencil, Trash2, Bell, FileCheck, Phone, Map, CalendarClock, Check } from 'lucide-react';

interface RecordRowProps {
  record: RecordFile;
  employees: Employee[];
  visibleColumns: Record<string, boolean>;
  isSelected: boolean;
  canPerformAction: boolean;
  isSpecializedTab?: boolean;
  currentUser?: any;
  rolePermissions?: Record<string, string[]>;
  departmentPermissions?: Record<string, string[]>;
  onToggleSelect: (id: string) => void;
  onView: (record: RecordFile) => void;
  onEdit: (record: RecordFile) => void;
  onDelete: (record: RecordFile) => void;
  onAdvanceStatus: (record: RecordFile) => void;
  onQuickUpdate: (id: string, field: keyof RecordFile, value: string) => void;
  onReturnResult?: (record: RecordFile) => void;
  onMapCorrection?: (record: RecordFile) => void; // New Handler
  onExtendDeadline?: (record: RecordFile) => void;
  columnOrder?: string[];
  canSelect?: boolean;
  holidays?: any[];
}

const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const RecordRow: React.FC<RecordRowProps> = ({
  record,
  employees,
  visibleColumns,
  isSelected,
  canPerformAction,
  isSpecializedTab = false,
  currentUser,
  rolePermissions,
  departmentPermissions,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
  onAdvanceStatus,
  onQuickUpdate,
  onReturnResult,
  onMapCorrection,
  onExtendDeadline,
  columnOrder,
  canSelect,
  holidays
}) => {
  const canExtendDeadline = hasUserPermission(
    currentUser,
    employees,
    'BTN_EXTEND_DEADLINE',
    rolePermissions,
    departmentPermissions
  ) && (
    record.status !== RecordStatus.HANDOVER && 
    record.status !== RecordStatus.RETURNED && 
    record.status !== RecordStatus.WITHDRAWN
  );
  const [localMsr, setLocalMsr] = React.useState(record.measurementNumber || "");
  const [localExc, setLocalExc] = React.useState(record.excerptNumber || "");
  const [localRec, setLocalRec] = React.useState(record.receiptNumber || "");
  React.useEffect(() => { setLocalMsr(record.measurementNumber || ""); }, [record.measurementNumber]);
  React.useEffect(() => { setLocalExc(record.excerptNumber || ""); }, [record.excerptNumber]);
  React.useEffect(() => { setLocalRec(record.receiptNumber || ""); }, [record.receiptNumber]);
  const normalizeName = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const employee = employees.find(e => 
      e.id === record.assignedTo || 
      (e as any).employeeId === record.assignedTo || 
      e.name === record.assignedTo ||
      (record.assignedTo && normalizeName(e.name) === normalizeName(record.assignedTo))
  );
  const assignedDisplayName = employee ? employee.name : record.assignedTo;
  const isOverdue = isRecordOverdue(record);
  const isApproaching = isRecordApproaching(record);
  
  const hasActiveReminder = record.reminderDate && 
                            record.status !== RecordStatus.HANDOVER && 
                            record.status !== RecordStatus.WITHDRAWN;

  const getDisplayStatus = (r: RecordFile) => {
      if (r.resultReturnedDate) {
          return RecordStatus.RETURNED;
      }
      if ((r.exportBatch || r.exportDate) && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.RETURNED && r.status !== RecordStatus.REJECTED) {
          return RecordStatus.HANDOVER;
      }
      return r.status;
  };
  
  const displayStatus = getDisplayStatus(record);

  const isReturned = displayStatus === RecordStatus.RETURNED || record.status === RecordStatus.RETURNED || !!record.resultReturnedDate;

  // Class chung cho các ô: Căn giữa cho sự cân đối, tăng padding thông thoáng hơn trên PC
  const cellClass = "p-3 md:p-3.5 align-middle text-slate-700 border-b border-slate-100/80 transition-colors duration-200";

  const orderedKeys = React.useMemo(() => {
    const defaultOrder = ['code', 'customer', 'deadline', 'ward', 'mapSheet', 'landPlot', 'assigned', 'completed', 'type', 'tech', 'receipt', 'status'];
    if (columnOrder && columnOrder.length > 0) {
      return columnOrder;
    }
    return defaultOrder;
  }, [columnOrder]);

  const renderCell = (key: string) => {
    switch (key) {
      case 'code':
        return (
          <td key="code" className={`${cellClass} font-medium text-blue-600 cursor-pointer`} onClick={() => onView(record)}>
            <div className="flex flex-col items-center gap-1">
                <div className="break-words font-bold leading-normal text-sm" title={record.code}>
                    {record.code}
                </div>
                {hasActiveReminder && <div className="flex items-center gap-1 text-xs text-pink-600 font-bold bg-pink-100 px-1.5 py-0.5 rounded"><Bell size={12} className="fill-pink-600" /> Nhắc hẹn</div>}
            </div>
            {isOverdue && <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded border border-red-200 font-bold mt-1 block text-center w-full">Quá hạn</span>}
          </td>
        );
      case 'customer':
        return (
          <td key="customer" className={cellClass}>
              <div className="flex flex-col gap-1 items-center text-center">
                  <div className="break-words leading-normal text-sm font-medium text-gray-900" title={record.customerName}>
                      {toTitleCase(record.customerName)}
                  </div>
                  {record.phoneNumber && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone size={14} className="shrink-0" />
                          <span className="font-mono">{record.phoneNumber}</span>
                      </div>
                  )}
              </div>
          </td>
        );
      case 'deadline':
        return (
          <td key="deadline" className={cellClass}>
            <div className="flex flex-col w-full bg-white/50 rounded border border-gray-100 overflow-hidden shadow-sm">
               <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50/80 border-b border-gray-100" title="Ngày tiếp nhận">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-tight mr-3">Nhận</span>
                  <span className="text-sm font-semibold text-slate-600 font-mono whitespace-nowrap">{formatDate(record.receivedDate)}</span>
               </div>
               
               <div className={`flex items-center justify-between px-2.5 py-1.5 ${isOverdue ? 'bg-red-50' : isApproaching ? 'bg-orange-50' : 'bg-white'}`} title="Hẹn trả kết quả">
                  <span className={`text-[10px] font-extrabold uppercase tracking-tight mr-1 ${isOverdue ? 'text-red-500' : isApproaching ? 'text-orange-500' : 'text-blue-500'}`}>Trả</span>
                  <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1">
                          <span className={`text-sm font-bold font-mono whitespace-nowrap ${isOverdue ? 'text-red-600' : isApproaching ? 'text-orange-600' : 'text-blue-700'}`}>
                              {formatDate(record.deadline)}
                          </span>
                          {isOverdue && <AlertCircle size={13} className="text-red-500 animate-pulse shrink-0" />}
                          {isApproaching && <Clock size={13} className="text-orange-500 shrink-0" />}
                      </div>
                  </div>
               </div>
            </div>
          </td>
        );
      case 'ward':
        const isHandedOver = Boolean(record.exportBatch || record.exportDate || record.status === RecordStatus.HANDOVER || record.status === RecordStatus.RETURNED);
        const isPhiDiaGioi = Boolean(record.handoverWard && record.handoverWard !== record.ward);
        return (
          <td key="ward" className={`${cellClass} text-center text-gray-700`}>
              <div className="break-words leading-normal text-sm" title={getWardLabel(record.ward)}> 
                  {getWardLabel(record.ward) || '--'}
                  {isHandedOver && isPhiDiaGioi && (
                      <div className="text-xs text-purple-600 mt-1 font-semibold" title="Nơi giao trả kết quả một cửa (Phi địa giới)">
                          (Giao: {getWardLabel(record.handoverWard)})
                      </div>
                  )}
              </div>
          </td>
        );
      case 'mapSheet':
        return <td key="mapSheet" className={`${cellClass} text-center font-mono text-sm font-bold text-slate-700`}>{record.mapSheet || '-'}</td>;
      case 'landPlot':
        return <td key="landPlot" className={`${cellClass} text-center font-mono text-sm font-bold text-slate-700`}>{record.landPlot || '-'}</td>;
      case 'assigned':
        return (
          <td key="assigned" className={`${cellClass} text-center`}>
              {assignedDisplayName || record.assignedDate ? (
                  <div className="flex flex-col items-center gap-0.5">
                      {record.assignedDate && (
                          <span className="text-xs text-gray-500">{formatDate(record.assignedDate)}</span>
                      )}
                      {assignedDisplayName && (
                          <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded break-words max-w-full leading-tight" title={assignedDisplayName}>{assignedDisplayName}</span>
                      )}
                  </div>
              ) : '--'}
          </td>
        );
      case 'completed':
        const batchParts = record.exportBatch ? getBatchDisplayParts(record.exportBatch, record.exportDate || record.completedDate) : null;
        return (
          <td key="completed" className={`${cellClass} text-center text-gray-600`}>
            {record.exportBatch && batchParts ? (
               <span className={`inline-flex flex-col items-center justify-center px-2 py-0.5 rounded border leading-tight ${record.status === RecordStatus.WITHDRAWN ? 'bg-slate-100 text-slate-700 border-slate-300' : record.status === RecordStatus.REJECTED ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                  <span className="text-[11px] font-extrabold whitespace-nowrap">{batchParts.batchName}</span>
                  {batchParts.dateName && (
                      <span className="text-[10px] font-medium opacity-90 whitespace-nowrap">{batchParts.dateName}</span>
                  )}
               </span>
            ) : record.status === RecordStatus.WITHDRAWN ? (
               <div className="flex flex-col items-center">
                  <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded mb-1">Rút HS</span>
                  <span className="text-sm font-bold text-slate-600">{formatDate(record.completedDate)}</span>
               </div>
            ) : record.status === RecordStatus.REJECTED ? (
               <div className="flex flex-col items-center">
                  <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded mb-1">Hồ sơ trả</span>
                  <span className="text-sm font-bold text-red-700">{formatDate(record.completedDate)}</span>
               </div>
            ) : (
               <span className="text-sm font-bold text-green-700">{formatDate(record.completedDate) || '--'}</span>
            )}
          </td>
        );
      case 'type':
        return (
          <td key="type" className={`${cellClass} text-center text-gray-700`}>
              <div className="break-words leading-normal text-sm" title={record.recordType || ''}> 
                  {getShortRecordType(record)}
              </div>
          </td>
        );
      case 'tech':
        const recTypeLower = (record.recordType || '').toLowerCase();
        const isCG = isCapGiayRecord(record);
        const isMeasurement = recTypeLower.includes('trích đo') || recTypeLower.includes('đo đạc') || recTypeLower.includes('đo') || recTypeLower.includes('tách thửa');
        const isExcerpt = recTypeLower.includes('trích lục');
        const showMsr = !isCG && (isMeasurement || (!isMeasurement && !isExcerpt));
        const showExc = !isCG && (isExcerpt || (!isMeasurement && !isExcerpt));

        return (
          <td key="tech" className={cellClass}>
            <div className="flex flex-col gap-1.5 items-center">
              {!showMsr && !showExc ? (
                <span className="text-gray-400 text-xs font-mono block text-center">-</span>
              ) : canPerformAction ? (
                  <>
                      {showMsr && (
                          <input type="text" className="w-full text-sm border border-gray-200 rounded px-1 py-1 focus:border-blue-500 outline-none bg-white/50 text-center" value={localMsr} onChange={(e) => setLocalMsr(e.target.value)} onBlur={() => localMsr !== (record.measurementNumber || '') && onQuickUpdate(record.id, 'measurementNumber', localMsr)} placeholder="TĐ" title="Số Trích Đo" />
                      )}
                      {showExc && (
                          <input type="text" className="w-full text-sm border border-gray-200 rounded px-1 py-1 focus:border-blue-500 outline-none bg-white/50 text-center" value={localExc} onChange={(e) => setLocalExc(e.target.value)} onBlur={() => localExc !== (record.excerptNumber || '') && onQuickUpdate(record.id, 'excerptNumber', localExc)} placeholder="TL" title="Số Trích Lục" />
                      )}
                  </>
              ) : (
                  <>
                      {showMsr && (
                          <span className="text-sm text-gray-800 font-mono truncate block text-center" title="Số TĐ">{record.measurementNumber || '-'}</span>
                      )}
                      {showExc && (
                          <span className="text-sm text-gray-800 font-mono truncate block text-center" title="Số TL">{record.excerptNumber || '-'}</span>
                      )}
                  </>
              )}
            </div>
          </td>
        );
      case 'receipt':
        return (
          <td key="receipt" className={`${cellClass} text-center`}>
              {canPerformAction ? (
                  <input 
                      type="text" 
                      className="w-full text-sm border border-gray-200 rounded px-1 py-1.5 focus:border-purple-500 outline-none bg-white/50 text-center font-bold text-purple-700 placeholder-gray-300" 
                      value={localRec} 
                      onChange={(e) => setLocalRec(e.target.value)}
                      onBlur={() => localRec !== (record.receiptNumber || '') && onQuickUpdate(record.id, 'receiptNumber', localRec)} 
                      onClick={(e) => e.stopPropagation()} 
                      placeholder="BL" 
                  />
              ) : (
                  <span className="text-sm text-purple-700 font-bold font-mono">{record.receiptNumber || '-'}</span>
              )}
          </td>
        );
      case 'status':
        return (
          <td key="status" className={`${cellClass} text-center`}>
              <div className="transform origin-top pt-1 flex flex-col items-center">
                  <StatusBadge status={displayStatus} />
                  
                  {/* HIỂN THỊ / CHỌN BƯỚC NHỎ DÀNH RIÊNG CHO HỒ SƠ CẤP GIẤY */}
                  {isCapGiayRecord(record) && (
                    <div className="mt-1 flex flex-col items-center gap-1">
                      {canPerformAction ? (
                        <select
                          value={record.capGiaySubStep || 'tham_dinh'}
                          onChange={(e) => {
                            e.stopPropagation();
                            onQuickUpdate(record.id, 'capGiaySubStep', e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-[11px] font-bold px-1.5 py-0.5 rounded border outline-none cursor-pointer transition-colors shadow-2xs ${getCapGiaySubStepBadgeColor(record.capGiaySubStep)}`}
                          title="Chuyển bước nhỏ Cấp giấy"
                        >
                          <option value="tham_dinh">Thẩm tra</option>
                          <option value="phieu_chuyen_thue">Chuyển thuế</option>
                          <option value="cho_nop_thue">Chờ nộp thuế</option>
                          <option value="hoan_thien_trinh_duyet">In & Hoàn thiện</option>
                        </select>
                      ) : (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getCapGiaySubStepBadgeColor(record.capGiaySubStep)}`}>
                          {getCapGiaySubStepLabel(record.capGiaySubStep)}
                        </span>
                      )}

                      {(record.capGiaySubStep === 'cho_nop_thue' || record.capGiaySubStep === 'cho_giay_nop_tien') && canPerformAction && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickUpdate(record.id, 'capGiaySubStep', 'hoan_thien_trinh_duyet');
                          }}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-black shadow-xs transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                          title="Xác nhận người dân đã nộp tiền thuế -> Chuyển In & Hoàn thiện"
                        >
                          <Check size={12} className="stroke-[3]" />
                          <span>Đã nộp thuế</span>
                        </button>
                      )}
                    </div>
                  )}
              </div>
              
              {/* NÚT CHỈNH LÝ (Thay thế checkbox) */}
              {onMapCorrection && (
                  <div className="mt-2 flex justify-center">
                      <button 
                          onClick={(e) => { e.stopPropagation(); onMapCorrection(record); }}
                          className={`flex items-center gap-1 px-2 py-1 rounded border transition-all text-[10px] font-bold shadow-sm ${
                              record.needsMapCorrection 
                              ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' 
                              : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50'
                          }`}
                          title={record.needsMapCorrection ? "Hồ sơ đang cần chỉnh lý. Bấm để HỦY." : "Bấm để chuyển sang chỉnh lý bản đồ"}
                      >
                          <Map size={14} className={record.needsMapCorrection ? "fill-orange-100" : ""} />
                          {record.needsMapCorrection && <span>CHỈNH LÝ</span>}
                      </button>
                  </div>
              )}
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <tr className={`transition-all duration-200 group border-l-4 ${isOverdue ? 'bg-red-50/50 border-l-red-500 hover:bg-red-50' : isApproaching ? 'bg-orange-50/50 border-l-orange-500 hover:bg-orange-50' : isSelected ? 'bg-blue-50/50 border-l-blue-500 hover:bg-blue-50' : 'border-l-transparent hover:bg-slate-50/80 hover:shadow-sm'}`} onDoubleClick={() => onView(record)}>
      <td className={`${cellClass} text-center`}>
        <div className="mt-1">
            {(canSelect !== undefined ? canSelect : canPerformAction) ? (
            <button onClick={() => onToggleSelect(record.id)} className={`${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            ) : (
            <div className="w-4 h-4" />
            )}
        </div>
      </td>
      
      {orderedKeys.map(key => visibleColumns[key] && renderCell(key))}
      
      {canPerformAction && (
        <td className={`${cellClass} sticky right-0 shadow-l text-center ${isOverdue ? 'bg-red-50 group-hover:bg-red-100' : isApproaching ? 'bg-orange-50 group-hover:bg-orange-100' : 'bg-white group-hover:bg-blue-50/60'}`}>
          <div className="flex flex-col items-center justify-center gap-1 py-0.5">
            {/* Hàng trên: Xem & Chuyển bước */}
            <div className="flex items-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); onView(record); }} className="p-1 text-slate-600 hover:text-green-700 hover:bg-green-100/80 rounded transition-colors border border-slate-200/80 bg-white" title="Xem chi tiết"><Eye size={15} /></button>
              
              {onReturnResult && displayStatus === RecordStatus.HANDOVER && !isReturned && !record.resultReturnedDate && (
                  <button onClick={(e) => { e.stopPropagation(); onReturnResult(record); }} className="p-1 text-emerald-700 hover:bg-emerald-100 rounded transition-colors border border-emerald-200 bg-emerald-50" title="Trả kết quả">
                      <FileCheck size={15} />
                  </button>
              )}

              {/* NÚT CHUYỂN BƯỚC / CHUYỂN VỀ GIAO VIỆC / XÁC NHẬN NỘP THUẾ */}
              {!isReturned && (() => {
                const isCG = isCapGiayRecord(record);
                const isRejectedOnly = record.status === RecordStatus.REJECTED || displayStatus === RecordStatus.REJECTED || record.capGiaySubStep === 'cho_bo_sung';
                const isTaxWaiting = isCG && (record.capGiaySubStep === 'cho_nop_thue' || record.capGiaySubStep === 'cho_giay_nop_tien');
                
                if (isRejectedOnly) {
                  return (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onAdvanceStatus(record); }} 
                      className="p-1 text-amber-700 hover:bg-amber-100 rounded transition-colors border border-amber-300 bg-amber-50 font-bold" 
                      title="Chuyển về bước Chờ giao việc (Phân công lại/Gợi ý người thụ lý cũ)"
                    >
                      <ArrowRight size={15} />
                    </button>
                  );
                }

                if (isTaxWaiting) {
                  return (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onAdvanceStatus(record); }} 
                      className="p-1 text-purple-700 hover:bg-purple-100 rounded transition-colors border border-purple-300 bg-purple-50 font-bold" 
                      title="Xác nhận nộp thuế → Trả về bước Chờ giao việc (Chờ phân công người in)"
                    >
                      <ArrowRight size={15} />
                    </button>
                  );
                }

                if (displayStatus !== RecordStatus.HANDOVER && displayStatus !== RecordStatus.WITHDRAWN && record.status !== RecordStatus.HANDOVER && record.status !== RecordStatus.WITHDRAWN && !record.resultReturnedDate) {
                  return (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onAdvanceStatus(record); }} 
                      className="p-1 text-green-700 hover:bg-green-100 rounded transition-colors border border-green-200 bg-green-50" 
                      title="Chuyển bước"
                    >
                      <ArrowRight size={15} />
                    </button>
                  );
                }

                return null;
              })()}
            </div>

            {/* Hàng dưới: Sửa & Xóa */}
            <div className="flex items-center gap-1">
              {currentUser?.role !== 'ONEDOOR' && currentUser?.role !== UserRole.ONEDOOR && (
                <button onClick={() => onEdit(record)} className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors border border-blue-200 bg-blue-50/50" title="Sửa"><Pencil size={15} /></button>
              )}
              {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUBADMIN || currentUser?.role === UserRole.TEAM_LEADER) && !isReturned && (
                  <button onClick={() => onDelete(record)} className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors border border-red-200 bg-red-50/50" title="Xóa"><Trash2 size={15} /></button>
              )}
            </div>
          </div>
        </td>
      )}
    </tr>
  );
};

export default React.memo(RecordRow, (prevProps, nextProps) => {
  return (
    prevProps.record === nextProps.record &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.visibleColumns === nextProps.visibleColumns &&
    prevProps.columnOrder === nextProps.columnOrder &&
    prevProps.employees.length === nextProps.employees.length
  );
});
