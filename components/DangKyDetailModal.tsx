import React, { useState, useEffect } from 'react';
import { DangKyRecord, Employee, User, UserRole } from '../types';
import { 
  X, MapPin, FileText, User as UserIcon, Users, UserPlus, Shield, 
  DollarSign, CheckCircle2, Circle, Calendar, Printer, Pencil, 
  Trash2, ArrowRight, Building2, FileCheck, Layers, CalendarClock,
  Receipt, Bell, StickyNote, Save, Loader2, CheckSquare, Send, Info
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
  const [personalNote, setPersonalNote] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
  const [reminderDate, setReminderDate] = useState<string>('');
  const [isSavingReminder, setIsSavingReminder] = useState<boolean>(false);

  useEffect(() => {
    if (record) {
      setPersonalNote(record.personalNotes || record.notes || '');
      if (record.reminderDate) {
        setReminderDate(record.reminderDate.split('T')[0]);
      } else {
        setReminderDate('');
      }
    }
  }, [record, isOpen]);

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
    if (amount === undefined || amount === null || amount === '') return '---';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num) || num <= 0) return '---';
    return `${num.toLocaleString('vi-VN')} đ`;
  };

  const handleSavePersonalNote = async () => {
    if (!record) return;
    setIsSavingNote(true);
    try {
      await saveDangKyRecordApi({ ...record, personalNotes: personalNote });
      alert('Đã lưu ghi chú cá nhân thành công!');
      if (onRefreshData) onRefreshData();
    } catch (e) {
      alert('Lỗi khi lưu ghi chú!');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleSaveReminder = async () => {
    if (!record) return;
    setIsSavingReminder(true);
    try {
      await saveDangKyRecordApi({ ...record, reminderDate: reminderDate || undefined });
      alert('Đã lưu hẹn giờ nhắc việc thành công!');
      if (onRefreshData) onRefreshData();
    } catch (e) {
      alert('Lỗi khi lưu hẹn giờ nhắc việc!');
    } finally {
      setIsSavingReminder(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const formatStaffInfo = (staffNameOrId?: string | null) => {
    if (!staffNameOrId) return null;
    const emp = employees?.find(e => e.id === staffNameOrId || e.name === staffNameOrId);
    if (emp) {
      const pos = emp.position || '';
      return pos ? `${emp.name} (${pos})` : emp.name;
    }
    return staffNameOrId;
  };

  // Timeline Step Item chuẩn như DetailModal
  const TimelineItem = ({
    date,
    label,
    icon: Icon,
    isLast,
    colorClass,
    forceActive,
    subText
  }: {
    date?: string | null;
    label: string;
    icon: any;
    isLast?: boolean;
    colorClass: { text: string; border: string; bg: string };
    forceActive?: boolean;
    subText?: string | null;
  }) => {
    const isActive = !!date || !!forceActive;
    return (
      <div className="relative flex gap-4">
        <div className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 bg-white ${isActive ? colorClass.border : 'border-gray-200'}`}>
            {isActive ? <CheckCircle2 size={16} className={colorClass.text} /> : <Circle size={16} className="text-gray-300" />}
          </div>
          {!isLast && <div className={`w-0.5 grow ${isActive ? colorClass.bg : 'bg-gray-100'} my-1`}></div>}
        </div>
        <div className="pb-6 flex-1">
          <p className={`text-xs font-bold uppercase mb-0.5 ${isActive ? colorClass.text : 'text-gray-400'}`}>{label}</p>
          <div className="flex items-center gap-2">
            <Icon size={14} className={isActive ? 'text-gray-500' : 'text-gray-300'} />
            <span className={`text-sm font-medium ${isActive ? 'text-gray-800' : 'text-gray-400 italic'}`}>
              {date ? formatDate(date) : (forceActive ? 'Đã hoàn tất' : 'Chưa thực hiện')}
            </span>
          </div>
          {subText && <p className="text-[11px] text-indigo-600 mt-1 italic font-medium">{subText}</p>}
        </div>
      </div>
    );
  };

  const owners = record.owners || [];
  const transferees = record.transferees || [];
  const nextStatus = NEXT_STATUS_MAP[record.status] || null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs animate-fade-in">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col border border-gray-200">
        
        {/* HEADER */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="bg-blue-100 text-blue-700 font-bold font-mono px-3 py-1 rounded text-sm border border-blue-200">
              {record.code}
            </span>
            <h2 className="text-lg font-bold text-gray-800 uppercase flex items-center gap-2">
              <Layers size={18} className="text-blue-600" />
              {record.recordType || 'Hồ sơ Đăng ký cấp GCN'}
            </h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {record.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrintReceipt}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-xs font-bold shadow-2xs cursor-pointer"
            >
              <Printer size={15} />
              In biên nhận
            </button>

            {onEdit && (
              <button
                onClick={() => { onClose(); onEdit(record); }}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg cursor-pointer"
                title="Chỉnh sửa hồ sơ"
              >
                <Pencil size={18} />
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => { onClose(); onDelete(record); }}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg cursor-pointer"
                title="Xóa hồ sơ"
              >
                <Trash2 size={18} />
              </button>
            )}

            <div className="w-px h-6 bg-gray-300 mx-1"></div>

            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* BODY (GRID 3 COLUMNS) */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUMN 1: THÔNG TIN CHỦ HỒ SƠ & ĐỊA CHÍNH */}
            <div className="space-y-6">
              
              {/* CHỦ SỬ DỤNG */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-bold text-blue-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-blue-600 pl-2">
                  <UserIcon size={16}/> Thông tin chủ hồ sơ
                </h3>
                
                {owners.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Chưa có thông tin chủ sử dụng</p>
                ) : (
                  <div className="space-y-4 divide-y divide-gray-100">
                    {owners.map((owner, idx) => (
                      <div key={idx} className={idx > 0 ? 'pt-3' : ''}>
                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                          {idx === 0 ? 'Chủ sử dụng chính' : `Đồng sử dụng ${idx + 1}`}
                        </label>
                        <p className="text-base font-bold text-gray-800 uppercase">{owner.name}</p>
                        
                        {owner.phone && (
                          <div className="mt-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Số điện thoại</label>
                            <p className="text-xs font-bold text-gray-800 font-mono">{owner.phone}</p>
                          </div>
                        )}

                        {owner.cccd && (
                          <div className="mt-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Số CCCD / ĐD</label>
                            <p className="text-xs font-bold text-gray-800 font-mono">{owner.cccd}</p>
                          </div>
                        )}

                        {owner.address && (
                          <div className="mt-1.5">
                            <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Địa chỉ thường trú</label>
                            <p className="text-xs font-semibold text-gray-700">{owner.address}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* BÊN NHẬN CHUYỂN QUYỀN */}
                {transferees.length > 0 && (
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <label className="text-[10px] text-emerald-600 uppercase font-bold block mb-2 flex items-center gap-1">
                      <UserPlus size={12} /> Bên nhận chuyển nhượng ({transferees.length})
                    </label>
                    <div className="space-y-2 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                      {transferees.map((tf, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="font-bold text-emerald-950 uppercase">{tf.name}</span>
                          {tf.cccd && <span className="text-gray-600 font-mono ml-2">({tf.cccd})</span>}
                          {tf.address && <p className="text-[11px] text-gray-600">{tf.address}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* NGƯỜI ĐƯỢC ỦY QUYỀN */}
                {record.authorizedPersonName && (
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <label className="text-[10px] text-indigo-500 uppercase font-bold block mb-2 flex items-center gap-1">
                      <Shield size={12} /> Người được ủy quyền
                    </label>
                    <div className="space-y-1.5 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Họ tên:</span>
                        <span className="font-bold text-indigo-900 uppercase">{record.authorizedPersonName}</span>
                      </div>
                      {record.authorizedPersonId && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">CCCD:</span>
                          <span className="font-semibold text-gray-800 font-mono">{record.authorizedPersonId}</span>
                        </div>
                      )}
                      {record.authorizedPersonPhone && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">SĐT:</span>
                          <span className="font-semibold text-gray-800 font-mono">{record.authorizedPersonPhone}</span>
                        </div>
                      )}
                      {record.authorizedPersonAddress && (
                        <div className="text-xs">
                          <span className="text-gray-500 block mb-0.5">Địa chỉ:</span>
                          <span className="font-semibold text-gray-800 block">{record.authorizedPersonAddress}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ĐỊA CHÍNH */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-bold text-green-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-green-600 pl-2">
                  <MapPin size={16}/> Thông tin địa chính
                </h3>
                
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="col-span-1">
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Xã / Phường</label>
                    <p className="font-bold text-gray-800 text-sm truncate">{record.ward || '---'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Tờ bản đồ</label>
                    <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center font-mono text-sm">{record.mapSheet || '-'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Thửa đất</label>
                    <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center font-mono text-sm">{record.landPlot || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Diện tích tổng</label>
                    <p className="text-xs font-bold text-gray-800 font-mono bg-slate-50 p-1.5 rounded border border-gray-200 text-center">
                      {record.totalArea ? `${record.totalArea} m²` : '---'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Đất ở</label>
                    <p className="text-xs font-bold text-gray-800 font-mono bg-slate-50 p-1.5 rounded border border-gray-200 text-center">
                      {record.residentialArea ? `${record.residentialArea} m²` : '---'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Số phát hành GCN</label>
                    <p className="text-xs font-bold text-gray-800 font-mono bg-slate-50 p-1.5 rounded border border-gray-200 text-center">
                      {record.issueNumber || '---'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Số vào sổ</label>
                    <p className="text-xs font-bold text-gray-800 font-mono bg-slate-50 p-1.5 rounded border border-gray-200 text-center">
                      {record.entryNumber || '---'}
                    </p>
                  </div>
                </div>
              </div>

              {/* REMINDER */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2">
                    <Bell size={16} /> Hẹn giờ nhắc việc
                  </h4>
                  <button 
                    onClick={handleSaveReminder} 
                    disabled={isSavingReminder}
                    className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50 font-bold transition-all cursor-pointer"
                  >
                    {isSavingReminder ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Lưu
                  </button>
                </div>
                <input 
                  type="date" 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                />
              </div>

              {/* PERSONAL NOTE */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase">
                    <StickyNote size={16} />
                    <span>Ghi chú cá nhân</span>
                  </div>
                  <button 
                    onClick={handleSavePersonalNote} 
                    disabled={isSavingNote}
                    className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50 font-bold transition-all cursor-pointer"
                  >
                    {isSavingNote ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                    Lưu
                  </button>
                </div>
                <textarea
                  rows={3}
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Nhập ghi chú riêng của bạn..."
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                />
              </div>
            </div>

            {/* COLUMN 2: CHI TIẾT & TÀI CHÍNH */}
            <div className="space-y-6">
              
              {/* SỐ PHIẾU CHUYỂN THUẾ */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-bold text-amber-600 uppercase mb-3 flex items-center gap-2 border-l-4 border-amber-600 pl-2">
                  <FileText size={16}/> Thông tin chuyển thuế
                </h3>
                <div className="bg-amber-50/70 p-3.5 rounded-lg border border-amber-200/80 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 uppercase">Số phiếu chuyển thuế:</span>
                  <span className="text-sm font-black text-amber-900 font-mono bg-white px-3 py-1 rounded-lg border border-amber-300 shadow-2xs">
                    {record.taxFormNumber || 'Chưa có số phiếu'}
                  </span>
                </div>
              </div>

              {/* NỘI DUNG CHI TIẾT */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                
                <h3 className="text-xs font-bold text-purple-600 uppercase flex items-center gap-2 border-l-4 border-purple-600 pl-2">
                  <FileText size={16}/> Nội dung chi tiết
                </h3>
                
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-gray-800 text-sm font-medium min-h-[80px]">
                  {record.notes || record.otherDocs || 'Không có nội dung chi tiết bổ sung.'}
                </div>

                {record.explanationPlan && (
                  <div>
                    <label className="text-[10px] text-purple-500 uppercase font-bold block mb-1">Phương án giải trình</label>
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-purple-900 text-sm font-medium">
                      {record.explanationPlan}
                    </div>
                  </div>
                )}

                {/* TÀI CHÍNH & LỆ PHÍ */}
                <div className="border-t border-gray-100 pt-4">
                  <label className="text-[11px] font-bold text-slate-700 uppercase block mb-2.5 flex items-center gap-1.5">
                    <Receipt size={15} className="text-emerald-600" />
                    <span>Thông tin Trả kết quả & Thu phí / Lệ phí</span>
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* SỐ TIỀN THU */}
                    <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200/80 flex flex-col justify-center min-w-0">
                      <label className="text-[10px] text-emerald-700 uppercase font-bold block whitespace-nowrap truncate">
                        Số tiền thu
                      </label>
                      <p className="text-sm font-black text-emerald-800 whitespace-nowrap truncate mt-0.5">
                        {formatCurrency(record.feeAmount || record.price || record.returnedPrice)}
                      </p>
                    </div>

                    {/* SỐ BIÊN LAI / HÓA ĐƠN */}
                    <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200/80 flex flex-col justify-center min-w-0">
                      <label className="text-[10px] text-blue-700 uppercase font-bold block whitespace-nowrap truncate">
                        {record.receiptType === 'Biên Lai' ? 'SỐ BIÊN LAI' : record.receiptType === 'Hóa Đơn' ? 'SỐ HÓA ĐƠN' : 'SỐ BIÊN LAI / HÓA ĐƠN'}
                      </label>
                      <p className="text-xs font-black text-blue-900 font-mono whitespace-nowrap truncate mt-0.5">
                        {record.receiptNumber || record.invoiceNumber || '---'}
                      </p>
                    </div>
                  </div>

                  {record.exportBatch && (
                    <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                      <span className="text-gray-500 font-medium">Đợt xuất bàn giao Một cửa:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Đợt {record.exportBatch}
                      </span>
                    </div>
                  )}
                </div>

                {/* GHI CHÚ NỘI BỘ */}
                {record.privateNotes && (
                  <div className="pt-2 border-t border-dashed border-gray-200">
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <div className="flex items-center gap-2 mb-1 text-yellow-800 font-bold text-xs">
                        <Info size={14} />
                        <span>Ghi chú nội bộ</span>
                      </div>
                      <p className="text-yellow-900 text-xs italic">"{record.privateNotes}"</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 3: TIẾN ĐỘ & THỜI GIAN (TIMELINE) */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-indigo-600 px-5 py-3 flex items-center gap-2">
                  <CalendarClock size={16} className="text-white"/>
                  <span className="text-xs font-bold text-white uppercase">Tiến độ & Thời gian</span>
                </div>
                
                <div className="p-6 text-center border-b border-gray-100">
                  <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Hạn trả kết quả</label>
                  <p className="text-2xl font-black text-gray-800 font-mono">{formatDate(record.deadline)}</p>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded mt-2 inline-block font-mono">
                    Ngày nhận: {formatDate(record.receivedDate)}
                  </span>
                </div>

                <div className="p-6 space-y-0">
                  <TimelineItem 
                    date={record.receivedDate} 
                    label="TIẾP NHẬN MỚI" 
                    icon={UserIcon}
                    colorClass={{text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
                    subText={formatStaffInfo(record.receivedBy)}
                  />

                  <TimelineItem 
                    date={record.appraisalDate} 
                    forceActive={!!record.appraisalStaff || !!record.appraisalDate}
                    label="THẨM ĐỊNH HỒ SƠ" 
                    icon={UserIcon}
                    colorClass={{text: 'text-blue-700', border: 'border-blue-600', bg: 'bg-blue-600'}}
                    subText={formatStaffInfo(record.appraisalStaff)}
                  />

                  <TimelineItem 
                    date={record.taxFormDate} 
                    forceActive={!!record.taxFormStaff || !!record.taxFormDate}
                    label="PHIẾU CHUYỂN THUẾ" 
                    icon={Send}
                    colorClass={{text: 'text-orange-700', border: 'border-orange-600', bg: 'bg-orange-600'}}
                    subText={formatStaffInfo(record.taxFormStaff)}
                  />

                  <TimelineItem 
                    date={record.taxKV7TransferDate} 
                    forceActive={!!record.taxKV7Staff || !!record.taxKV7TransferDate}
                    label="THUẾ KV7" 
                    icon={Building2}
                    colorClass={{text: 'text-amber-700', border: 'border-amber-600', bg: 'bg-amber-600'}}
                    subText={formatStaffInfo(record.taxKV7Staff)}
                  />

                  <TimelineItem 
                    date={record.taxNoticeDate} 
                    forceActive={!!record.taxNoticeStaff || !!record.taxNoticeDate}
                    label="THÔNG BÁO THUẾ" 
                    icon={Receipt}
                    colorClass={{text: 'text-yellow-700', border: 'border-yellow-600', bg: 'bg-yellow-600'}}
                    subText={formatStaffInfo(record.taxNoticeStaff)}
                  />

                  <TimelineItem 
                    date={record.printDate} 
                    forceActive={!!record.printDate || !!record.printStaff}
                    label="IN GIẤY CHỨNG NHẬN" 
                    icon={Printer}
                    colorClass={{text: 'text-purple-700', border: 'border-purple-600', bg: 'bg-purple-600'}}
                    subText={formatStaffInfo(record.printStaff)}
                  />

                  <TimelineItem 
                    date={record.pendingCheckDate} 
                    forceActive={!!record.pendingCheckDate || !!record.checkedBy}
                    label="TRÌNH KIỂM TRA" 
                    icon={Send}
                    colorClass={{text: 'text-amber-700', border: 'border-amber-600', bg: 'bg-amber-600'}}
                    subText={formatStaffInfo(record.checkedBy)}
                  />

                  <TimelineItem 
                    date={record.submissionDate} 
                    forceActive={!!record.submissionDate || !!record.submittedTo}
                    label="TRÌNH KÝ DUYỆT" 
                    icon={Send}
                    colorClass={{text: 'text-indigo-700', border: 'border-indigo-600', bg: 'bg-indigo-600'}}
                    subText={formatStaffInfo(record.submittedTo)}
                  />

                  <TimelineItem 
                    date={record.completedDate || record.exportDate} 
                    forceActive={!!record.completedDate || !!record.exportBatch}
                    label={record.status === 'Trả hủy hồ sơ' ? 'TRẢ HỦY HỒ SƠ' : record.status === 'CSD rút HS' ? 'CSD RÚT HỒ SƠ' : 'HOÀN THÀNH'} 
                    icon={CheckSquare}
                    colorClass={{
                      text: record.status === 'Trả hủy hồ sơ' ? 'text-red-700' : 'text-green-700', 
                      border: record.status === 'Trả hủy hồ sơ' ? 'border-red-600' : 'border-green-600', 
                      bg: record.status === 'Trả hủy hồ sơ' ? 'bg-red-600' : 'bg-green-600'
                    }}
                    subText={record.exportBatch ? `Đợt xuất: ${record.exportBatch}` : undefined}
                  />

                  <TimelineItem 
                    date={record.resultReturnedDate} 
                    label="TRẢ KẾT QUẢ CHO DÂN" 
                    icon={FileCheck}
                    isLast={true}
                    colorClass={{text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
                    subText={record.receiverName ? `Người nhận: ${record.receiverName}` : undefined}
                  />
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
