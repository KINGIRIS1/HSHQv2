import React, { useState, useEffect } from 'react';
import { DangKyRecord, DangKyStatusType, DangKyParty, Employee, User } from '../types';
import { DANG_KY_STATUS_LIST } from '../types';
import { 
  X, Save, FileText, Users, UserPlus, Shield, 
  Calendar, DollarSign, Plus, Trash2, MapPin, 
  ClipboardList, CheckCircle2, User as UserIcon, Calculator
} from 'lucide-react';
import { calculateDeadlineHelper } from '../utils/appHelpers';

interface DangKyRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: DangKyRecord) => Promise<void> | void;
  initialData?: DangKyRecord | null;
  employees: Employee[];
  currentUser: User | null;
  wards: string[];
  holidays?: any[];
}

export const DangKyRecordModal: React.FC<DangKyRecordModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  employees,
  currentUser,
  wards,
  holidays = []
}) => {
  const [modalFormTab, setModalFormTab] = useState<'general' | 'owners' | 'transferees' | 'authorized' | 'workflow' | 'finance'>('general');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const defaultRecord: DangKyRecord = {
    id: `dk-${Date.now()}`,
    code: '',
    owners: [{ name: '', cccd: '', address: '', phone: '' }],
    transferees: [],
    authorizedPersonName: '',
    authorizedPersonId: '',
    authorizedPersonPhone: '',
    authorizedPersonAddress: '',
    landPlot: '',
    mapSheet: '',
    issueNumber: '',
    entryNumber: '',
    totalArea: '',
    residentialArea: '',
    ward: wards[0] || '',
    recordType: 'Chuyển nhượng QSDĐ',
    receivedDate: new Date().toISOString().split('T')[0],
    deadline: '',
    appraisalDate: '',
    appraisalStaff: '',
    taxFormDate: '',
    taxFormStaff: '',
    taxKV7TransferDate: '',
    taxKV7Staff: '',
    taxNoticeDate: '',
    taxNoticeStaff: '',
    taxPaymentReceiptDate: '',
    printDate: '',
    printStaff: '',
    pendingCheckDate: '',
    checkedBy: '',
    submissionDate: '',
    submittedTo: '',
    completedDate: '',
    exportBatch: '',
    resultReturnedDate: '',
    receiptNumber: '',
    invoiceNumber: '',
    feeAmount: 0,
    status: 'Tiếp nhận mới',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const [formData, setFormData] = useState<DangKyRecord>(defaultRecord);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        owners: initialData.owners && initialData.owners.length > 0 ? initialData.owners : [{ name: '', cccd: '', address: '', phone: '' }],
        transferees: initialData.transferees || []
      });
    } else {
      const todayStr = new Date().toISOString().split('T')[0];
      const defaultType = 'Chuyển nhượng QSDĐ';
      const initialDeadline = calculateDeadlineHelper(defaultType, todayStr, holidays || []);
      setFormData({
        ...defaultRecord,
        id: `dk-${Date.now()}`,
        code: `000.00.00.H05-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
        receivedDate: todayStr,
        recordType: defaultType,
        deadline: initialDeadline,
        receivedBy: currentUser?.name || ''
      });
    }
    setModalFormTab('general');
  }, [initialData, isOpen]);

  const handleFieldChange = (field: keyof DangKyRecord, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'recordType' || field === 'receivedDate') {
        const rType = field === 'recordType' ? value : prev.recordType;
        const rDate = field === 'receivedDate' ? value : prev.receivedDate;
        if (rType && rDate) {
          updated.deadline = calculateDeadlineHelper(rType, String(rDate).split('T')[0], holidays || []);
        }
      }
      return updated;
    });
  };

  const recalculateDeadline = () => {
    if (formData.recordType && formData.receivedDate) {
      const newDeadline = calculateDeadlineHelper(formData.recordType, String(formData.receivedDate).split('T')[0], holidays || []);
      setFormData(prev => ({ ...prev, deadline: newDeadline }));
    }
  };

  if (!isOpen) return null;

  // Add / Remove Owners
  const addOwner = () => {
    setFormData(prev => ({
      ...prev,
      owners: [...(prev.owners || []), { name: '', cccd: '', address: '', phone: '' }]
    }));
  };

  const removeOwner = (index: number) => {
    if ((formData.owners || []).length <= 1) {
      alert('Hồ sơ phải có ít nhất 1 chủ sử dụng!');
      return;
    }
    setFormData(prev => ({
      ...prev,
      owners: prev.owners.filter((_, idx) => idx !== index)
    }));
  };

  const updateOwner = (index: number, field: keyof DangKyParty, value: string) => {
    setFormData(prev => {
      const nextOwners = [...prev.owners];
      nextOwners[index] = { ...nextOwners[index], [field]: value };
      return { ...prev, owners: nextOwners };
    });
  };

  // Add / Remove Transferees
  const addTransferee = () => {
    setFormData(prev => ({
      ...prev,
      transferees: [...(prev.transferees || []), { name: '', cccd: '', address: '', phone: '' }]
    }));
  };

  const removeTransferee = (index: number) => {
    setFormData(prev => ({
      ...prev,
      transferees: (prev.transferees || []).filter((_, idx) => idx !== index)
    }));
  };

  const updateTransferee = (index: number, field: keyof DangKyParty, value: string) => {
    setFormData(prev => {
      const nextTf = [...(prev.transferees || [])];
      nextTf[index] = { ...nextTf[index], [field]: value };
      return { ...prev, transferees: nextTf };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      alert('Vui lòng nhập Mã hồ sơ!');
      return;
    }

    const firstOwner = formData.owners?.[0]?.name;
    if (!firstOwner || !firstOwner.trim()) {
      alert('Vui lòng nhập họ tên chủ sử dụng đầu tiên!');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        updatedAt: new Date().toISOString()
      });
      onClose();
    } catch (err) {
      console.error('Error saving:', err);
      alert('Có lỗi xảy ra khi lưu hồ sơ!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-800 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardList size={20} className="text-blue-400" />
            <h3 className="font-bold text-base">
              {initialData ? `Cập nhật Hồ Sơ: ${initialData.code}` : 'Thêm Mới Hồ Sơ Đăng Ký'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-slate-700 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex bg-slate-100 border-b border-gray-200 px-4 overflow-x-auto text-xs font-bold text-gray-600 shrink-0">
          <button
            type="button"
            onClick={() => setModalFormTab('general')}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              modalFormTab === 'general' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent hover:text-gray-900'
            }`}
          >
            <FileText size={14} /> 1. Thông tin chung & Đất
          </button>
          <button
            type="button"
            onClick={() => setModalFormTab('owners')}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              modalFormTab === 'owners' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent hover:text-gray-900'
            }`}
          >
            <Users size={14} /> 2. Chủ sử dụng ({(formData.owners || []).length})
          </button>
          <button
            type="button"
            onClick={() => setModalFormTab('transferees')}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              modalFormTab === 'transferees' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent hover:text-gray-900'
            }`}
          >
            <UserPlus size={14} /> 3. Người nhận CQ ({(formData.transferees || []).length})
          </button>
          <button
            type="button"
            onClick={() => setModalFormTab('authorized')}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              modalFormTab === 'authorized' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent hover:text-gray-900'
            }`}
          >
            <Shield size={14} /> 4. Người ủy quyền
          </button>
          <button
            type="button"
            onClick={() => setModalFormTab('workflow')}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              modalFormTab === 'workflow' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent hover:text-gray-900'
            }`}
          >
            <Calendar size={14} /> 5. Tiến độ Quy trình
          </button>
          <button
            type="button"
            onClick={() => setModalFormTab('finance')}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              modalFormTab === 'finance' ? 'border-blue-600 text-blue-700 bg-white shadow-2xs' : 'border-transparent hover:text-gray-900'
            }`}
          >
            <DollarSign size={14} /> 6. Tài chính & Thu phí
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* TAB 1: THÔNG TIN CHUNG */}
          {modalFormTab === 'general' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Mã Hồ Sơ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.code || ''}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg font-mono font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Ví dụ: 000.00.00.H05-260818-0001"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Trạng Thái Quy Trình (14 Bước) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status || 'Tiếp nhận mới'}
                  onChange={e => setFormData({ ...formData, status: e.target.value as DangKyStatusType })}
                  className="w-full p-2 border border-gray-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  {DANG_KY_STATUS_LIST.map(st => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Địa Danh (Xã / Phường)</label>
                <select
                  value={formData.ward || ''}
                  onChange={e => setFormData({ ...formData, ward: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Chọn Xã / Phường --</option>
                  {wards.map(w => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Loại Hồ Sơ</label>
                <input
                  type="text"
                  value={formData.recordType || ''}
                  onChange={e => handleFieldChange('recordType', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Ví dụ: Chuyển nhượng QSDĐ, Tặng cho, Thừa kế..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Tờ Bản Đồ</label>
                  <input
                    type="text"
                    value={formData.mapSheet || ''}
                    onChange={e => setFormData({ ...formData, mapSheet: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none text-center font-mono"
                    placeholder="Số tờ"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Thửa Đất</label>
                  <input
                    type="text"
                    value={formData.landPlot || ''}
                    onChange={e => setFormData({ ...formData, landPlot: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none text-center font-mono"
                    placeholder="Số thửa"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Tổng Diện Tích (m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.totalArea || ''}
                    onChange={e => setFormData({ ...formData, totalArea: e.target.value ? Number(e.target.value) : '' })}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Diện Tích Đất Ở (m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.residentialArea || ''}
                    onChange={e => setFormData({ ...formData, residentialArea: e.target.value ? Number(e.target.value) : '' })}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Số Phát Hành GCN</label>
                <input
                  type="text"
                  value={formData.issueNumber || ''}
                  onChange={e => setFormData({ ...formData, issueNumber: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Ví dụ: CP 123456"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Số Vào Sổ Cấp GCN</label>
                <input
                  type="text"
                  value={formData.entryNumber || ''}
                  onChange={e => setFormData({ ...formData, entryNumber: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Ví dụ: CS 01234"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Ngày Tiếp Nhận</label>
                <input
                  type="date"
                  value={formData.receivedDate ? formData.receivedDate.split('T')[0] : ''}
                  onChange={e => handleFieldChange('receivedDate', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Người Tiếp Nhận Hồ Sơ</label>
                <select
                  value={formData.receivedBy || ''}
                  onChange={e => setFormData({ ...formData, receivedBy: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Chọn cán bộ tiếp nhận --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.name}>{emp.name} ({emp.department || 'Bộ phận'})</option>
                  ))}
                  {currentUser && !employees.some(e => e.name === currentUser.name) && (
                    <option value={currentUser.name}>{currentUser.name} (Hiện tại)</option>
                  )}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-bold text-gray-700">Ngày Hẹn Trả Kết Quả</label>
                  <button
                    type="button"
                    onClick={recalculateDeadline}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Tự động tính ngày hẹn dựa trên loại hồ sơ, ngày tiếp nhận và lịch nghỉ lễ"
                  >
                    <Calculator size={13} /> Tính lại hạn trả
                  </button>
                </div>
                <input
                  type="date"
                  value={formData.deadline ? formData.deadline.split('T')[0] : ''}
                  onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono font-bold text-blue-700 bg-blue-50/40"
                />
              </div>
            </div>
          )}

          {/* TAB 2: CHỦ SỬ DỤNG */}
          {modalFormTab === 'owners' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-bold text-gray-700">Danh sách Chủ sử dụng đất (Bên chuyển nhượng/Chủ cũ)</span>
                <button
                  type="button"
                  onClick={addOwner}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                >
                  <Plus size={14} /> Thêm Chủ Sử Dụng
                </button>
              </div>

              {formData.owners.map((owner, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-blue-700 flex items-center gap-1.5">
                      <UserIcon size={14} /> Chủ sử dụng #{idx + 1}
                    </span>
                    {formData.owners.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOwner(idx)}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Xóa chủ này"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Họ và Tên <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={owner.name}
                        onChange={e => updateOwner(idx, 'name', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Nguyễn Văn A"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Số CCCD / CMND</label>
                      <input
                        type="text"
                        value={owner.cccd || ''}
                        onChange={e => updateOwner(idx, 'cccd', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                        placeholder="0380..."
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Số Điện Thoại</label>
                      <input
                        type="text"
                        value={owner.phone || ''}
                        onChange={e => updateOwner(idx, 'phone', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="09..."
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">Địa Chỉ Thường Trú</label>
                      <input
                        type="text"
                        value={owner.address || ''}
                        onChange={e => updateOwner(idx, 'address', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Xã, Huyện, Tỉnh..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: NGƯỜI NHẬN CHUYỂN QUYỀN */}
          {modalFormTab === 'transferees' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-bold text-gray-700">Danh sách Người nhận chuyển quyền (Bên mua/Chủ mới)</span>
                <button
                  type="button"
                  onClick={addTransferee}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                >
                  <Plus size={14} /> Thêm Người Nhận CQ
                </button>
              </div>

              {(formData.transferees || []).length === 0 ? (
                <div className="text-center p-8 bg-gray-50 border border-dashed rounded-xl text-gray-400 text-xs">
                  Chưa có người nhận chuyển quyền nào. Nhấn nút "Thêm Người Nhận CQ" ở trên nếu có.
                </div>
              ) : (
                formData.transferees.map((tf, idx) => (
                  <div key={idx} className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3 relative">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                        <UserPlus size={14} /> Người nhận chuyển quyền #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTransferee(idx)}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Xóa người này"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">
                          Họ và Tên <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={tf.name}
                          onChange={e => updateTransferee(idx, 'name', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="Trần Thị B"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Số CCCD / CMND</label>
                        <input
                          type="text"
                          value={tf.cccd || ''}
                          onChange={e => updateTransferee(idx, 'cccd', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                          placeholder="0380..."
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Số Điện Thoại</label>
                        <input
                          type="text"
                          value={tf.phone || ''}
                          onChange={e => updateTransferee(idx, 'phone', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="09..."
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Địa Chỉ Thường Trú</label>
                        <input
                          type="text"
                          value={tf.address || ''}
                          onChange={e => updateTransferee(idx, 'address', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="Xã, Huyện, Tỉnh..."
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: NGƯỜI ĐƯỢC ỦY QUYỀN */}
          {modalFormTab === 'authorized' && (
            <div className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-4 text-xs">
              <span className="font-bold text-indigo-900 block border-b border-indigo-200 pb-2">
                Thông tin Người được ủy quyền (Người đại diện nộp/nhận hồ sơ)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Họ và Tên Người Ủy Quyền</label>
                  <input
                    type="text"
                    value={formData.authorizedPersonName || ''}
                    onChange={e => setFormData({ ...formData, authorizedPersonName: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Lê Văn C"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Số CCCD / CMND</label>
                  <input
                    type="text"
                    value={formData.authorizedPersonId || ''}
                    onChange={e => setFormData({ ...formData, authorizedPersonId: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    placeholder="0380..."
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Số Điện Thoại Liên Hệ</label>
                  <input
                    type="text"
                    value={formData.authorizedPersonPhone || ''}
                    onChange={e => setFormData({ ...formData, authorizedPersonPhone: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="09..."
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Địa Chỉ Thường Trú</label>
                  <input
                    type="text"
                    value={formData.authorizedPersonAddress || ''}
                    onChange={e => setFormData({ ...formData, authorizedPersonAddress: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Địa chỉ..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TIẾN ĐỘ QUY TRÌNH (14 BƯỚC) */}
          {modalFormTab === 'workflow' && (
            <div className="space-y-4 text-xs">
              <span className="font-bold text-gray-700 block border-b pb-2">
                Chi tiết Ngày thực hiện & Cán bộ thụ lý từng bước
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Thẩm định */}
                <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                  <span className="font-bold text-slate-800 block">1. Bước Thẩm định</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Ngày Thẩm định</label>
                      <input
                        type="date"
                        value={formData.appraisalDate ? formData.appraisalDate.split('T')[0] : ''}
                        onChange={e => setFormData({ ...formData, appraisalDate: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">NV Thẩm định</label>
                      <select
                        value={formData.appraisalStaff || ''}
                        onChange={e => setFormData({ ...formData, appraisalStaff: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs cursor-pointer"
                      >
                        <option value="">-- Chọn NV --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. Phiếu chuyển thuế */}
                <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                  <span className="font-bold text-slate-800 block">2. Phiếu chuyển thuế</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Ngày Chuyển thuế</label>
                      <input
                        type="date"
                        value={formData.taxFormDate ? formData.taxFormDate.split('T')[0] : ''}
                        onChange={e => setFormData({ ...formData, taxFormDate: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">NV Chuyển thuế</label>
                      <select
                        value={formData.taxFormStaff || ''}
                        onChange={e => setFormData({ ...formData, taxFormStaff: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs cursor-pointer"
                      >
                        <option value="">-- Chọn NV --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Chuyển Thuế KV7 */}
                <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                  <span className="font-bold text-slate-800 block">3. Chuyển Thuế KV7</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Ngày Thuế KV7</label>
                      <input
                        type="date"
                        value={formData.taxKV7TransferDate ? formData.taxKV7TransferDate.split('T')[0] : ''}
                        onChange={e => setFormData({ ...formData, taxKV7TransferDate: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">NV Thuế KV7</label>
                      <select
                        value={formData.taxKV7Staff || ''}
                        onChange={e => setFormData({ ...formData, taxKV7Staff: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs cursor-pointer"
                      >
                        <option value="">-- Chọn NV --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. Thông báo thuế / GNT */}
                <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                  <span className="font-bold text-slate-800 block">4. Thông báo thuế / GNT</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Ngày TBT / GNT</label>
                      <input
                        type="date"
                        value={formData.taxNoticeDate ? formData.taxNoticeDate.split('T')[0] : ''}
                        onChange={e => setFormData({ ...formData, taxNoticeDate: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">NV TBT</label>
                      <select
                        value={formData.taxNoticeStaff || ''}
                        onChange={e => setFormData({ ...formData, taxNoticeStaff: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs cursor-pointer"
                      >
                        <option value="">-- Chọn NV --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 5. In GCN */}
                <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                  <span className="font-bold text-slate-800 block">5. In Giấy chứng nhận (GCN)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Ngày In GCN</label>
                      <input
                        type="date"
                        value={formData.printDate ? formData.printDate.split('T')[0] : ''}
                        onChange={e => setFormData({ ...formData, printDate: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">NV In GCN</label>
                      <select
                        value={formData.printStaff || ''}
                        onChange={e => setFormData({ ...formData, printStaff: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs cursor-pointer"
                      >
                        <option value="">-- Chọn NV --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 6. Kiểm tra & Trình ký */}
                <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                  <span className="font-bold text-slate-800 block">6. Kiểm tra & Trình ký</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Ngày Kiểm tra</label>
                      <input
                        type="date"
                        value={formData.pendingCheckDate ? formData.pendingCheckDate.split('T')[0] : ''}
                        onChange={e => setFormData({ ...formData, pendingCheckDate: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Người Kiểm tra</label>
                      <select
                        value={formData.checkedBy || ''}
                        onChange={e => setFormData({ ...formData, checkedBy: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs cursor-pointer"
                      >
                        <option value="">-- Chọn Cán bộ --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Ngày Trình ký</label>
                      <input
                        type="date"
                        value={formData.submissionDate ? formData.submissionDate.split('T')[0] : ''}
                        onChange={e => setFormData({ ...formData, submissionDate: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Người Ký duyệt</label>
                      <input
                        type="text"
                        value={formData.submittedTo || ''}
                        onChange={e => setFormData({ ...formData, submittedTo: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs"
                        placeholder="Lãnh đạo ký..."
                      />
                    </div>
                  </div>
                </div>

                {/* 7. Hoàn thành & Trả kết quả */}
                <div className="p-3 bg-slate-50 border rounded-lg space-y-2 md:col-span-2">
                  <span className="font-bold text-slate-800 block">7. Bàn giao 1 cửa & Trả kết quả</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Ngày Hoàn thành/Bàn giao</label>
                      <input
                        type="date"
                        value={formData.completedDate ? formData.completedDate.split('T')[0] : ''}
                        onChange={e => setFormData({ ...formData, completedDate: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Đợt Xuất Bàn Giao</label>
                      <input
                        type="text"
                        value={formData.exportBatch || ''}
                        onChange={e => setFormData({ ...formData, exportBatch: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs font-mono font-bold text-emerald-700"
                        placeholder="Ví dụ: Đợt 01-2026..."
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-0.5">Ngày Trả Kết Quả Cho Dân</label>
                      <input
                        type="date"
                        value={formData.resultReturnedDate ? formData.resultReturnedDate.split('T')[0] : ''}
                        onChange={e => setFormData({ ...formData, resultReturnedDate: e.target.value })}
                        className="w-full p-1.5 border rounded text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: TÀI CHÍNH & THU PHÍ */}
          {modalFormTab === 'finance' && (
            <div className="p-4 bg-amber-50/40 border border-amber-200 rounded-xl space-y-4 text-xs">
              <span className="font-bold text-amber-900 block border-b border-amber-200 pb-2">
                Thông tin Tài chính, Biên lai & Hóa đơn
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Số Tiền Thu Lệ Phí (VNĐ)</label>
                  <input
                    type="number"
                    value={formData.feeAmount || 0}
                    onChange={e => setFormData({ ...formData, feeAmount: e.target.value ? Number(e.target.value) : 0 })}
                    className="w-full p-2 border border-gray-300 rounded-lg text-amber-900 font-bold font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Số Biên Lai Thu</label>
                  <input
                    type="text"
                    value={formData.receiptNumber || ''}
                    onChange={e => setFormData({ ...formData, receiptNumber: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                    placeholder="BL-..."
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Số Hóa Đơn Điện Tử</label>
                  <input
                    type="text"
                    value={formData.invoiceNumber || ''}
                    onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                    placeholder="HD-..."
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Ghi Chú Hồ Sơ</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="Ghi chú thêm về hồ sơ này..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save size={15} />
              {isSubmitting ? 'Đang lưu...' : initialData ? 'Lưu Thay Đổi' : 'Tạo Mới Hồ Sơ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default DangKyRecordModal;
