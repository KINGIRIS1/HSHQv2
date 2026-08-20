import React, { useState } from 'react';
import { DangKyRecord, Employee, User, UserRole, DangKyStatusType } from '../types';
import { 
  X, MapPin, FileText, User as UserIcon, Users, UserPlus, Shield, 
  DollarSign, CheckCircle2, Circle, Calendar, Printer, Pencil, 
  Trash2, ArrowRight, ArrowLeft, Building2, FileCheck, Layers
} from 'lucide-react';
import { saveDangKyRecordApi } from '../services/apiDangKy';

const NEXT_STATUS_MAP: Record<string, string> = {
  'Tiếp nhận mới': 'Thẩm định',
  'Thẩm định': 'Phiếu chuyển thuế',
  'Phiếu chuyển thuế': 'Chờ Thuế KV7',
  'Chờ Thuế KV7': 'Chờ giấy nộp tiền',
  'Chờ giấy nộp tiền': 'Chờ In GCN',
  'Chờ In GCN': 'Chờ kiểm tra',
  'Chờ kiểm tra': 'Chờ ký duyệt',
  'Chờ ký duyệt': 'Chờ bàn giao',
  'Chờ bàn giao': 'Đã giao 1 cửa',
  'Đã giao 1 cửa': 'Đã trả kết quả',
  'Đã trả kết quả': 'Đã trả kết quả',
  'Chờ bổ sung': 'Thẩm định',
  'CSD rút HS': 'CSD rút HS',
  'Trả hủy hồ sơ': 'Trả hủy hồ sơ'
};

interface DangKyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DangKyRecord | null;
  employees: Employee[];
  currentUser: User | null;
  onEdit?: (record: DangKyRecord) => void;
  onDelete?: (record: DangKyRecord) => void;
  onStatusAdvance?: (record: DangKyRecord) => void;
  onRefreshData?: () => void;
}

export const DangKyDetailModal: React.FC<DangKyDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  employees,
  currentUser,
  onEdit,
  onDelete,
  onStatusAdvance,
  onRefreshData
}) => {
  const [personalNote, setPersonalNote] = useState<string>(record?.notes || '');
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);

  if (!isOpen || !record) return null;

  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUBADMIN;
  const isOneDoor = currentUser?.role === UserRole.ONEDOOR;
  const canPerformAction = isAdmin || isOneDoor || true;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '---';
    try {
      const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const parts = clean.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount?: number | string | null) => {
    if (amount === undefined || amount === null || amount === '') return '0 đ';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '0 đ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const handleSaveNote = async () => {
    if (!record) return;
    setIsSavingNote(true);
    try {
      await saveDangKyRecordApi({ ...record, notes: personalNote });
      alert('Đã lưu ghi chú thành công!');
      if (onRefreshData) onRefreshData();
    } catch (e) {
      alert('Lỗi khi lưu ghi chú!');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Timeline Step Item
  const TimelineStep = ({
    title,
    date,
    staff,
    isDone,
    isCurrent,
    isLast
  }: {
    title: string;
    date?: string | null;
    staff?: string | null;
    isDone: boolean;
    isCurrent?: boolean;
    isLast?: boolean;
  }) => {
    return (
      <div className="relative flex gap-3">
        <div className="flex flex-col items-center">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center border-2 z-10 bg-white transition-all ${
              isDone
                ? 'border-emerald-500 text-emerald-600'
                : isCurrent
                ? 'border-blue-500 text-blue-600 ring-2 ring-blue-100'
                : 'border-gray-200 text-gray-300'
            }`}
          >
            {isDone ? (
              <CheckCircle2 size={15} className="text-emerald-500" />
            ) : (
              <Circle size={15} className={isCurrent ? 'text-blue-500 fill-blue-50' : 'text-gray-300'} />
            )}
          </div>
          {!isLast && (
            <div className={`w-0.5 grow my-1 transition-all ${isDone ? 'bg-emerald-300' : 'bg-gray-100'}`}></div>
          )}
        </div>
        <div className={`pb-4 ${!isLast ? '' : ''} flex-1`}>
          <div className="flex items-center justify-between">
            <p className={`text-xs font-bold uppercase ${isDone ? 'text-emerald-700' : isCurrent ? 'text-blue-700' : 'text-gray-400'}`}>
              {title}
            </p>
            {date && (
              <span className="text-[11px] font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                {formatDate(date)}
              </span>
            )}
          </div>
          {staff && (
            <p className="text-xs text-indigo-700 font-semibold mt-0.5 flex items-center gap-1">
              <span>Cán bộ:</span>
              <span className="bg-indigo-50 px-1.5 py-0.2 rounded">{staff}</span>
            </p>
          )}
        </div>
      </div>
    );
  };

  const owners = record.owners || [];
  const transferees = record.transferees || [];
  const nextStatus = NEXT_STATUS_MAP[record.status] || null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs animate-fade-in">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col border border-gray-200">
        {/* HEADER */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="bg-blue-100 text-blue-700 font-bold font-mono px-3 py-1 rounded-lg text-sm border border-blue-200">
              {record.code}
            </span>
            <h2 className="text-base font-bold text-gray-800 uppercase flex items-center gap-1.5">
              <Layers size={18} className="text-blue-600" />
              {record.recordType || 'Hồ sơ Đăng ký cấp GCN'}
            </h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {record.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {nextStatus && onStatusAdvance && (
              <button
                onClick={() => {
                  onStatusAdvance(record);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                title={`Chuyển bước sang: ${nextStatus}`}
              >
                <ArrowRight size={14} /> Chuyển: {nextStatus}
              </button>
            )}

            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(record);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="Chỉnh sửa hồ sơ"
              >
                <Pencil size={14} /> Chỉnh sửa
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => {
                  onClose();
                  onDelete(record);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="Xóa hồ sơ"
              >
                <Trash2 size={14} /> Xóa
              </button>
            )}

            <div className="w-px h-5 bg-gray-300 mx-1"></div>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CỘT 1: THÔNG TIN CHỦ HỒ SƠ & THỬA ĐẤT */}
            <div className="space-y-6">
              {/* CHỦ SỬ DỤNG */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                <h3 className="text-xs font-bold text-blue-700 uppercase mb-4 flex items-center gap-2 border-l-4 border-blue-600 pl-2">
                  <Users size={16} /> Thông tin chủ sử dụng ({owners.length})
                </h3>
                {owners.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Chưa có thông tin chủ sử dụng</p>
                ) : (
                  <div className="space-y-3 divide-y divide-gray-100">
                    {owners.map((owner, idx) => (
                      <div key={idx} className={idx > 0 ? 'pt-3' : ''}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900">
                            {idx + 1}. {owner.name}
                          </span>
                          {owner.cccd && (
                            <span className="text-[11px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border">
                              CCCD: {owner.cccd}
                            </span>
                          )}
                        </div>
                        {owner.address && (
                          <p className="text-xs text-gray-600 mt-1 flex items-start gap-1">
                            <MapPin size={12} className="text-gray-400 shrink-0 mt-0.5" />
                            <span>{owner.address}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* NGƯỜI NHẬN CHUYỂN QUYỀN (NẾU CÓ) */}
              {transferees.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-2xs">
                  <h3 className="text-xs font-bold text-emerald-700 uppercase mb-4 flex items-center gap-2 border-l-4 border-emerald-600 pl-2">
                    <UserPlus size={16} /> Bên nhận chuyển quyền ({transferees.length})
                  </h3>
                  <div className="space-y-3 divide-y divide-gray-100">
                    {transferees.map((tf, idx) => (
                      <div key={idx} className={idx > 0 ? 'pt-3' : ''}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900">
                            {idx + 1}. {tf.name}
                          </span>
                          {tf.cccd && (
                            <span className="text-[11px] font-mono text-gray-500 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              CCCD: {tf.cccd}
                            </span>
                          )}
                        </div>
                        {tf.address && (
                          <p className="text-xs text-gray-600 mt-1 flex items-start gap-1">
                            <MapPin size={12} className="text-gray-400 shrink-0 mt-0.5" />
                            <span>{tf.address}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NGƯỜI ĐƯỢC ỦY QUYỀN */}
              {record.authorizedPersonName && (
                <div className="bg-white p-5 rounded-xl border border-indigo-200 shadow-2xs">
                  <h3 className="text-xs font-bold text-indigo-700 uppercase mb-3 flex items-center gap-2 border-l-4 border-indigo-600 pl-2">
                    <Shield size={16} /> Người được ủy quyền
                  </h3>
                  <div className="space-y-1.5 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Họ và tên:</span>
                      <span className="font-bold text-indigo-900">{record.authorizedPersonName}</span>
                    </div>
                    {record.authorizedPersonId && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Số CCCD/ĐD:</span>
                        <span className="font-semibold font-mono text-gray-800">{record.authorizedPersonId}</span>
                      </div>
                    )}
                    {record.authorizedPersonPhone && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Số điện thoại:</span>
                        <span className="font-semibold text-gray-800">{record.authorizedPersonPhone}</span>
                      </div>
                    )}
                    {record.authorizedPersonAddress && (
                      <div className="pt-1 border-t border-indigo-100/70">
                        <span className="text-gray-500 block mb-0.5">Địa chỉ thường trú:</span>
                        <span className="font-medium text-gray-800 block">{record.authorizedPersonAddress}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* THÔNG TIN THỬA ĐẤT */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                <h3 className="text-xs font-bold text-green-700 uppercase mb-4 flex items-center gap-2 border-l-4 border-green-600 pl-2">
                  <MapPin size={16} /> Thông tin thửa đất & Địa danh
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Xã / Phường</label>
                    <p className="font-bold text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-200">
                      {record.ward || '---'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Loại hồ sơ</label>
                    <p className="font-semibold text-blue-800 bg-blue-50/60 p-2 rounded-lg border border-blue-100 truncate">
                      {record.recordType || '---'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Tờ bản đồ</label>
                    <p className="font-bold text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-200 text-center font-mono">
                      {record.mapSheet || '---'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Thửa đất</label>
                    <p className="font-bold text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-200 text-center font-mono">
                      {record.landPlot || '---'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Diện tích tổng</label>
                    <p className="font-bold text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-200 text-center font-mono">
                      {record.totalArea ? `${record.totalArea} m²` : '---'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Đất ở</label>
                    <p className="font-bold text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-200 text-center font-mono">
                      {record.residentialArea ? `${record.residentialArea} m²` : '---'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Số phát hành GCN</label>
                    <p className="font-bold text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-200 text-center font-mono">
                      {record.issueNumber || '---'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Số vào sổ</label>
                    <p className="font-bold text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-200 text-center font-mono">
                      {record.entryNumber || '---'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT 2: TIẾN ĐỘ QUY TRÌNH (14 BƯỚC) */}
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                <h3 className="text-xs font-bold text-indigo-700 uppercase mb-4 flex items-center gap-2 border-l-4 border-indigo-600 pl-2">
                  <Calendar size={16} /> Tiến độ Quy trình thực hiện
                </h3>

                {/* THỜI HẠN TỔNG QUAN */}
                <div className="border border-slate-200 rounded-xl p-3.5 mb-5 space-y-2 bg-slate-50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-600">Ngày nhận hồ sơ:</span>
                    <span className="font-bold font-mono text-slate-800">{formatDate(record.receivedDate)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-t border-slate-200/80 pt-2">
                    <span className="font-semibold text-blue-700">Ngày hẹn trả kết quả:</span>
                    <span className="font-bold font-mono text-blue-700">{formatDate(record.deadline)}</span>
                  </div>
                  {record.exportBatch && (
                    <div className="flex items-center justify-between text-xs border-t border-slate-200 pt-2">
                      <span className="font-semibold text-emerald-700">Đợt xuất bàn giao:</span>
                      <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {record.exportBatch}
                      </span>
                    </div>
                  )}
                </div>

                {/* TIMELINE CÁC BƯỚC */}
                <div className="space-y-1">
                  <TimelineStep
                    title="1. Tiếp nhận hồ sơ"
                    date={record.receivedDate}
                    staff={record.receivedBy}
                    isDone={true}
                  />
                  <TimelineStep
                    title="2. Thẩm định hồ sơ"
                    date={record.appraisalDate}
                    staff={record.appraisalStaff}
                    isDone={!!record.appraisalStaff || !!record.appraisalDate}
                  />
                  <TimelineStep
                    title="3. Phiếu chuyển thuế"
                    date={record.taxFormDate}
                    staff={record.taxFormStaff}
                    isDone={!!record.taxFormDate || !!record.taxFormStaff}
                  />
                  <TimelineStep
                    title="4. Chuyển thuế KV7"
                    date={record.taxKV7TransferDate}
                    staff={record.taxKV7Staff}
                    isDone={!!record.taxKV7TransferDate}
                  />
                  <TimelineStep
                    title="5. Thông báo thuế / Giấy nộp tiền"
                    date={record.taxNoticeDate || record.taxPaymentReceiptDate}
                    staff={record.taxNoticeStaff}
                    isDone={!!record.taxNoticeDate || !!record.taxPaymentReceiptDate}
                  />
                  <TimelineStep
                    title="6. In Giấy chứng nhận (GCN)"
                    date={record.printDate}
                    staff={record.printStaff}
                    isDone={!!record.printDate || !!record.printStaff}
                  />
                  <TimelineStep
                    title="7. Trình kiểm tra hồ sơ"
                    date={record.pendingCheckDate}
                    staff={record.checkedBy}
                    isDone={!!record.pendingCheckDate || !!record.checkedBy}
                  />
                  <TimelineStep
                    title="8. Trình ký duyệt"
                    date={record.submissionDate}
                    staff={record.submittedTo}
                    isDone={!!record.submissionDate || !!record.submittedTo}
                  />
                  <TimelineStep
                    title="9. Bàn giao Một cửa"
                    date={record.completedDate}
                    staff={record.exportBatch ? `Đợt: ${record.exportBatch}` : null}
                    isDone={!!record.completedDate || !!record.exportBatch}
                  />
                  <TimelineStep
                    title="10. Đã trả kết quả cho dân"
                    date={record.resultReturnedDate}
                    isDone={!!record.resultReturnedDate || record.status === 'Đã trả kết quả'}
                    isLast={true}
                  />
                </div>
              </div>
            </div>

            {/* CỘT 3: TÀI CHÍNH, GHI CHÚ & THAO TÁC */}
            <div className="space-y-6">
              {/* TÀI CHÍNH & THU PHÍ */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                <h3 className="text-xs font-bold text-amber-700 uppercase mb-4 flex items-center gap-2 border-l-4 border-amber-600 pl-2">
                  <DollarSign size={16} /> Tài chính & Thu phí
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center p-2.5 bg-amber-50/60 rounded-lg border border-amber-100">
                    <span className="font-semibold text-gray-700">Lệ phí / Phí dịch vụ:</span>
                    <span className="font-bold text-amber-900 text-sm font-mono">
                      {formatCurrency(record.feeAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-600">Số Biên lai:</span>
                    <span className="font-bold font-mono text-gray-800">{record.receiptNumber || '---'}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-600">Số Hóa đơn:</span>
                    <span className="font-bold font-mono text-gray-800">{record.invoiceNumber || '---'}</span>
                  </div>
                </div>
              </div>

              {/* GHI CHÚ HỒ SƠ */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
                <h3 className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center gap-2 border-l-4 border-slate-600 pl-2">
                  <FileText size={16} /> Ghi chú hồ sơ
                </h3>
                <textarea
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  placeholder="Nhập ghi chú hoặc nhắc nhở cho hồ sơ này..."
                  rows={4}
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-gray-50 focus:bg-white resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSaveNote}
                    disabled={isSavingNote}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <FileCheck size={14} />
                    {isSavingNote ? 'Đang lưu...' : 'Lưu ghi chú'}
                  </button>
                </div>
              </div>

              {/* THÔNG TIN HỆ THỐNG */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs text-[11px] text-gray-500 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span>ID hệ thống:</span>
                  <span className="font-bold text-gray-700">{record.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cập nhật gần nhất:</span>
                  <span>{formatDate(record.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DangKyDetailModal;
