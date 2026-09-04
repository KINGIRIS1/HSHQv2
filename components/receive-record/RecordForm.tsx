
import React, { useState, useEffect, useRef } from 'react';
import { RecordFile, Holiday, RecordStatus, User, Employee } from '../../types';
import AutoResizeTextarea from '../AutoResizeTextarea';
import { RECORD_TYPES, EXTENDED_RECORD_TYPES, getShortRecordType, getWardLabel } from '../../constants';
import { Save, User as UserIcon, Calendar, MapPin, FileCheck, Loader2, Printer, RotateCcw, XCircle, CheckCircle, AlertCircle, X, Phone, FileText, BookOpen, Clock, Hash, Map, ChevronDown, ChevronUp } from 'lucide-react';

interface AttachedDocItem {
  id: string;
  name: string;
  type: 'Bản chính' | 'Bản sao';
}

const parseAttachedDocs = (otherDocsStr: string | null | undefined): AttachedDocItem[] => {
    if (!otherDocsStr) return [];
    try {
        const parsed = JSON.parse(otherDocsStr);
        if (Array.isArray(parsed)) {
            return parsed.map((item: any, idx: number) => ({
                id: item.id || String(idx + 1),
                name: item.name || '',
                type: item.type === 'Bản sao' ? 'Bản sao' : 'Bản chính'
            }));
        }
    } catch (e) {
        // Fallback for old/simple format "Sổ đỏ, CMND...|Bản chính"
        const parts = otherDocsStr.split('|');
        if (parts[0]) {
            return [{
                id: '1',
                name: parts[0],
                type: parts[1] === 'Bản sao' ? 'Bản sao' : 'Bản chính'
            }];
        }
    }
    return [];
};

const parseAuthDocType = (str: string | null | undefined) => {
    if (!str) return { cccd: '', address: '' };
    const parts = str.split('|');
    const firstPart = parts[0] || '';
    const secondPart = parts[1] || '';
    
    // Check if first part is an old document type
    const knownDocTypes = ['Hợp đồng ủy quyền', 'Giấy ủy quyền', 'Văn bản ủy quyền', 'Hợp đồng uỷ quyền', 'Giấy uỷ quyền', 'Văn bản uỷ quyền', 'Khác'];
    const isDocType = knownDocTypes.some(type => firstPart.toLowerCase().includes(type.toLowerCase()));
    
    if (isDocType) {
        if (parts.length >= 4) {
            // Old format proposal: Loại|Hình thức|CCCD|SĐT
            return { cccd: parts[2] || '', address: parts[3] || '' };
        }
        return { cccd: '', address: '' };
    } else {
        // New format: CCCD|Address
        return {
            cccd: firstPart,
            address: secondPart
        };
    }
};

interface RecordFormProps {
  onSave: (record: RecordFile) => Promise<RecordFile | null>;
  wards: string[];
  records: RecordFile[];
  holidays: Holiday[];
  calculateDeadline: (type: string, date: string) => string;
  generateCode: (ward: string, date: string) => string;
  onPrint?: (data: Partial<RecordFile>) => void;
  initialData?: RecordFile | null;
  onCancelEdit?: () => void;
  currentUser: User;
  employees: Employee[];
}

const RecordForm: React.FC<RecordFormProps> = ({ onSave, wards, records, holidays, calculateDeadline, generateCode, onPrint, initialData, onCancelEdit, currentUser, employees }) => {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const linkedEmp = employees.find(e => e.id === currentUser.employeeId);
  const processingWard = linkedEmp?.managedWards?.[0] || 'Tân Khai';

  const d = new Date();
  const padNum = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${d.getFullYear()}-${padNum(d.getMonth() + 1)}-${padNum(d.getDate())}T${padNum(d.getHours())}:${padNum(d.getMinutes())}:${padNum(d.getSeconds())}`;

  const [formData, setFormData] = useState<Partial<RecordFile>>({
    code: '', customerName: '', phoneNumber: '', cccd: '', customerAddress: '', authorizedBy: '', authDocType: '', otherDocs: '', content: '',
    receivedDate: todayStr, deadline: '', ward: processingWard, landPlot: '', mapSheet: '', area: 0,
    address: '', recordType: '', status: RecordStatus.RECEIVED,
    issueNumber: '', entryNumber: '', issueDate: '', residentialArea: 0
  });

  const [attachedDocs, setAttachedDocs] = useState<AttachedDocItem[]>([]);
  const [authCccd, setAuthCccd] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
      if (initialData) {
          setFormData(initialData);
          setAttachedDocs(parseAttachedDocs(initialData.otherDocs));
          const parsed = parseAuthDocType(initialData.authDocType);
          setAuthCccd(parsed.cccd);
          setAuthAddress(parsed.address);
          setIsAuthOpen(!!(initialData.authorizedBy || parsed.cccd || parsed.address));
          setNotification(null);
      } else {
          handleReset(false);
      }
  }, [initialData]);

  useEffect(() => {
      if (notification && topRef.current) {
          topRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (notification.type === 'success') {
              const timer = setTimeout(() => setNotification(null), 5000);
              return () => clearTimeout(timer);
          }
      }
  }, [notification]);

  useEffect(() => {
    if (!initialData) {
        const newCode = generateCode(processingWard, formData.receivedDate || '');
        setFormData(prev => {
            if (prev.code === newCode) return prev;
            return { ...prev, code: newCode };
        });
    }
  }, [processingWard, formData.receivedDate, records, initialData]);

  const handleChange = (field: keyof RecordFile, value: any) => {
    setFormData(prev => {
        let finalValue = value;
        if (field === 'receivedDate' && value && !value.includes('T')) {
            const nowTime = new Date();
            const padTime = (n: number) => String(n).padStart(2, '0');
            finalValue = `${value}T${padTime(nowTime.getHours())}:${padTime(nowTime.getMinutes())}:${padTime(nowTime.getSeconds())}`;
        }
        const newData = { ...prev, [field]: finalValue };
        if (field === 'recordType' || field === 'receivedDate') {
            const rType = field === 'recordType' ? (field === 'recordType' ? finalValue : prev.recordType) : prev.recordType;
            const rDate = field === 'receivedDate' ? (field === 'receivedDate' ? finalValue : prev.receivedDate) : prev.receivedDate;
            if (rType && rDate) {
                newData.deadline = calculateDeadline(rType, rDate);
            } else if (!rType) {
                newData.deadline = '';
            }
        }
        
        if (field === 'recordType') {
            if (!value) {
                newData.price = null;
                setAttachedDocs([]);
                newData.otherDocs = '';
            } else {
                const vLower = String(value || '').toLowerCase();
                if (
                    value === '1.1 Sao lục' || 
                    value === '1.1 CC DL ĐĐ' || 
                    value === 'Cung cấp tài liệu đất đai' || 
                    value === '1.1 Cung cấp dữ liệu đất đai' ||
                    value === '1.1 Sao lục hồ sơ' ||
                    vLower.includes('sao lục') ||
                    vLower.includes('1.2') || 
                    vLower.includes('công văn') || 
                    vLower.includes('cong van')
                ) {
                    newData.price = 310000;
                } else {
                    newData.price = null;
                }

                // Auto-populate default documents for "1.1 Sao lục hồ sơ" and "Hồ sơ đo đạc" (starts with 2.)
                if (value === '1.1 Sao lục hồ sơ' || value === '1.1 Sao lục' || value === '1.1 Cung cấp dữ liệu đất đai' || value === '1.1 CC DL ĐĐ' || value.startsWith('2.')) {
                    const defaultDocs: AttachedDocItem[] = [
                        { id: '1', name: 'Phiếu yêu cầu lập hợp đồng đo đạc dịch vụ, Cắm mốc, trích lục, Cung cấp thông tin', type: 'Bản chính' },
                        { id: '2', name: 'Giấy chứng nhận đã cấp', type: 'Bản sao' }
                    ];
                    setAttachedDocs(defaultDocs);
                    newData.otherDocs = JSON.stringify(defaultDocs);
                } else {
                    setAttachedDocs([]);
                    newData.otherDocs = '';
                }
            }
        }
        return newData;
    });
  };

  const handleAddDoc = () => {
      const nextNum = attachedDocs.length + 1;
      const newDoc: AttachedDocItem = {
          id: String(nextNum),
          name: '',
          type: 'Bản chính'
      };
      const updatedDocs = [...attachedDocs, newDoc];
      setAttachedDocs(updatedDocs);
      setFormData(prev => ({ ...prev, otherDocs: JSON.stringify(updatedDocs) }));
  };

  const handleUpdateDoc = (index: number, field: keyof AttachedDocItem, value: string) => {
      const updatedDocs = attachedDocs.map((doc, idx) => {
          if (idx === index) {
              return { ...doc, [field]: value };
          }
          return doc;
      });
      setAttachedDocs(updatedDocs);
      setFormData(prev => ({ ...prev, otherDocs: JSON.stringify(updatedDocs) }));
  };

  const handleDeleteDoc = (index: number) => {
      const filteredDocs = attachedDocs.filter((_, idx) => idx !== index);
      // Re-number remaining items sequentially so they update their STT in the list and receipt
      const updatedDocs = filteredDocs.map((doc, idx) => ({
          ...doc,
          id: String(idx + 1)
      }));
      setAttachedDocs(updatedDocs);
      setFormData(prev => ({ ...prev, otherDocs: JSON.stringify(updatedDocs) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    if (!formData.recordType || !formData.recordType.trim()) { 
        setNotification({ type: 'error', message: "Vui lòng chọn loại hồ sơ / thủ tục trước khi lưu." });
        return; 
    }
    const isCongVan = formData.recordType ? getShortRecordType(formData.recordType) === '1.2 Công văn' : false;
    const isDeadlineRequired = !isCongVan;
    if (!formData.code || !formData.customerName || (isDeadlineRequired && !formData.deadline)) { 
        setNotification({ type: 'error', message: "Vui lòng điền các trường bắt buộc (*) trước khi lưu." });
        return; 
    }
    setLoading(true);
    const recordToSave: RecordFile = { 
        ...formData, 
        id: formData.id || Math.random().toString(36).substr(2, 9), 
        status: formData.status || RecordStatus.RECEIVED,
        receivedBy: formData.receivedBy || currentUser.employeeId 
    } as RecordFile;
    const savedRecord = await onSave(recordToSave);
    setLoading(false);
    if (savedRecord) {
        setNotification({ type: 'success', message: initialData ? `Cập nhật thành công: ${savedRecord.code}` : `Đã tiếp nhận mới: ${savedRecord.code}` });
        if (!initialData && onPrint) {
            onPrint(savedRecord);
        }
        if (initialData && onCancelEdit) onCancelEdit(); else handleReset(true);
    } else {
        setNotification({ type: 'error', message: "Lỗi khi lưu hồ sơ." });
    }
  };

  const handleReset = (keepNotification = false) => {
      const d = new Date();
      const padL = (n: number) => String(n).padStart(2, '0');
      const todayStrLocal = `${d.getFullYear()}-${padL(d.getMonth() + 1)}-${padL(d.getDate())}T${padL(d.getHours())}:${padL(d.getMinutes())}:${padL(d.getSeconds())}`;
      setFormData({ 
          code: '', customerName: '', phoneNumber: '', cccd: '', customerAddress: '', 
          authorizedBy: '', authDocType: '', otherDocs: '', content: '', 
          receivedDate: todayStrLocal, deadline: '', 
          ward: processingWard, landPlot: '', mapSheet: '', area: 0, address: '', 
          recordType: '', status: RecordStatus.RECEIVED,
          issueNumber: '', entryNumber: '', issueDate: '', residentialArea: 0
      });
      setAttachedDocs([]);
      setAuthCccd('');
      setAuthAddress('');
      setIsAuthOpen(false);
      if (!keepNotification) setNotification(null);
      if (onCancelEdit && initialData) onCancelEdit();
  };

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-1.5 2xl:py-2 text-xs sm:text-sm 2xl:text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-medium text-slate-700 bg-white hover:border-gray-400 shadow-2xs";
  const labelClass = "block text-xs 2xl:text-sm font-bold text-slate-700 mb-1 2xl:mb-1.5";
  const iconWrapperClass = "absolute left-3 top-[34px] text-slate-400 pointer-events-none";

  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

  const isCongVan = formData.recordType ? getShortRecordType(formData.recordType) === '1.2 Công văn' : false;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[2200px] mx-auto space-y-4 2xl:space-y-6 animate-fade-in relative pb-4">
        <div ref={topRef} />
        {notification && (
            <div className={`p-3 rounded-xl border shadow-sm flex items-start gap-2.5 transition-all duration-300 animate-fade-in-up ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {notification.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5" size={18} /> : <AlertCircle className="shrink-0 mt-0.5" size={18} />}
                <div className="flex-1"><h4 className="font-bold text-xs uppercase">{notification.type === 'success' ? 'Thành công' : 'Có lỗi xảy ra'}</h4><p className="text-xs">{notification.message}</p></div>
                <button type="button" onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
        )}
        {initialData && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl flex items-center justify-between shadow-xs text-xs">
                <span className="font-bold flex items-center gap-2"><Loader2 className="animate-spin text-amber-600" size={16}/> Đang sửa: <span className="bg-white px-2 py-0.5 rounded border border-amber-200 font-mono">{initialData.code}</span></span>
                <button type="button" onClick={() => handleReset(false)} className="text-xs font-bold underline hover:text-amber-900 bg-white/60 px-2.5 py-1 rounded-md">Hủy</button>
            </div>
        )}

        {/* HÀNG 1: LOẠI HỒ SƠ, MÃ HỒ SƠ, NGÀY NHẬN, HẸN TRẢ (MỞ HẾT KHỔ GỘP THÀNH 1 HÀNG) */}
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${isCongVan ? 'lg:grid-cols-3 xl:grid-cols-3' : 'lg:grid-cols-4 xl:grid-cols-4'} gap-3 items-end`}>
                <div>
                    <label className={`${labelClass} uppercase flex items-center gap-1.5`}>
                        <span className="p-1 bg-blue-100 text-blue-600 rounded-md"><FileCheck size={14} /></span>
                        Loại hồ sơ <span className="text-red-500">*</span>
                    </label>
                    <select 
                        required 
                        className={`${inputClass} font-semibold ${!formData.recordType ? 'border-amber-400 bg-amber-50/40 text-amber-900 ring-1 ring-amber-300' : ''}`} 
                        value={formData.recordType ? getShortRecordType(formData.recordType) : ''} 
                        onChange={(e) => handleChange('recordType', e.target.value)}
                    >
                        <option value="">-- Chọn loại hồ sơ / thủ tục --</option>
                        {EXTENDED_RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div>
                    <label className={labelClass}>Mã hồ sơ</label>
                    <input type="text" readOnly={!initialData} className={`${inputClass} font-mono ${initialData ? 'bg-white font-bold text-blue-700' : 'bg-slate-100 text-slate-500 cursor-not-allowed'}`} value={formData.code || ''} onChange={(e) => initialData && handleChange('code', e.target.value)} />
                </div>

                <div>
                    <label className={labelClass}>Ngày nhận</label>
                    <input type="date" required className={inputClass} value={dateVal(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value)} />
                </div>

                {!isCongVan && (
                    <div>
                        <label className={`${labelClass} text-purple-700`}>Hẹn trả <span className="text-red-500">*</span></label>
                        <input type="date" required className={`${inputClass} bg-purple-50/80 border-purple-200 text-purple-800 font-bold`} value={dateVal(formData.deadline)} onChange={(e) => handleChange('deadline', e.target.value)} />
                    </div>
                )}
            </div>
        </div>

        {/* PHÍA DƯỚI: LUỒNG DỌC TRÀN VIỀN 100% */}
        <div className="space-y-3.5 sm:space-y-4 w-full">
                {/* Người nộp hồ sơ hoặc Nơi gửi / nhận */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-3 flex items-center gap-1.5 border-b pb-2 border-slate-100">
                        <span className="p-1 bg-blue-100 text-blue-600 rounded-md">
                            <UserIcon size={14} />
                        </span> 
                        {isCongVan ? 'Thông tin nơi gửi / nhận' : 'Người nộp hồ sơ'}
                    </h3>
                    
                    {isCongVan ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Số, ký hiệu Công văn <span className="text-red-500">*</span></label>
                                <input type="text" required className={inputClass} placeholder="VD: 123/UBND-TH..." value={formData.customerName || ''} onChange={(e) => handleChange('customerName', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Nơi nhận / Đơn vị xử lý</label>
                                <input type="text" className={inputClass} placeholder="VD: Chi nhánh VPĐKĐD..." value={formData.customerAddress || ''} onChange={(e) => handleChange('customerAddress', e.target.value)} />
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelClass}>Số điện thoại liên hệ</label>
                                <input type="text" className={inputClass} placeholder="VD: 09xxxxxxxx" value={formData.phoneNumber || ''} onChange={(e) => handleChange('phoneNumber', e.target.value)} />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div><label className={labelClass}>Chủ sử dụng <span className="text-red-500">*</span></label><input type="text" required className={inputClass} placeholder="Nguyễn Văn A..." value={formData.customerName || ''} onChange={(e) => handleChange('customerName', e.target.value)} /></div>
                            <div><label className={labelClass}>CCCD</label><input type="text" className={inputClass} placeholder="0123456789..." value={formData.cccd || ''} onChange={(e) => handleChange('cccd', e.target.value)} /></div>
                            <div><label className={labelClass}>Địa chỉ chủ sử dụng</label><input type="text" className={inputClass} placeholder="Địa chỉ thường trú..." value={formData.customerAddress || ''} onChange={(e) => handleChange('customerAddress', e.target.value)} /></div>
                            <div><label className={labelClass}>Số điện thoại</label><input type="text" className={inputClass} placeholder="09xxxxxxxx" value={formData.phoneNumber || ''} onChange={(e) => handleChange('phoneNumber', e.target.value)} /></div>
                        </div>
                    )}
                </div>

                {/* Thông tin giấy chứng nhận */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-3 flex items-center gap-1.5 border-b pb-2 border-slate-100">
                        <span className="p-1 bg-green-100 text-green-600 rounded-md">
                            <MapPin size={14} />
                        </span> 
                        {isCongVan ? 'Văn bản Công văn' : 'Thông tin thửa đất & Giấy chứng nhận'}
                    </h3>
                    
                    {isCongVan ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Cơ quan ban hành / Nơi gửi</label>
                                <input type="text" className={inputClass} placeholder="VD: UBND huyện, Tòa án..." value={formData.issueNumber || ''} onChange={(e) => handleChange('issueNumber', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Ngày Công văn / Ngày ban hành</label>
                                <input type="date" className={inputClass} value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value)} />
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelClass}>Xã / Phường liên quan</label>
                                <select className={inputClass} value={formData.ward || ''} onChange={(e) => handleChange('ward', e.target.value)}>
                                    <option value="">-- Chọn xã / phường --</option>
                                    {wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                <div><label className={labelClass}>Xã / Phường <span className="text-red-500">*</span></label><select required className={inputClass} value={formData.ward || ''} onChange={(e) => handleChange('ward', e.target.value)}><option value="">-- Chọn xã / phường --</option>{wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}</select></div>
                                <div><label className={labelClass}>Số phát hành</label><input type="text" className={inputClass} placeholder="VD: CD 123456" value={formData.issueNumber || ''} onChange={(e) => handleChange('issueNumber', e.target.value)} /></div>
                                <div><label className={labelClass}>Số vào sổ</label><input type="text" className={inputClass} placeholder="VD: CH 01234" value={formData.entryNumber || ''} onChange={(e) => handleChange('entryNumber', e.target.value)} /></div>
                                <div><label className={labelClass}>Ngày cấp</label><input type="date" className={inputClass} value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value)} /></div>
                            </div>
                            
                            <div className="bg-green-50/60 p-2.5 rounded-xl border border-green-100 grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                                <div><label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Tờ bản đồ</label><input type="text" className="w-full border border-green-200 rounded-md px-2 py-1 text-center font-bold text-green-800 bg-white outline-none text-xs sm:text-sm" placeholder="0" value={formData.mapSheet || ''} onChange={(e) => handleChange('mapSheet', e.target.value)} /></div>
                                <div><label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Thửa đất</label><input type="text" className="w-full border border-green-200 rounded-md px-2 py-1 text-center font-bold text-green-800 bg-white outline-none text-xs sm:text-sm" placeholder="0" value={formData.landPlot || ''} onChange={(e) => handleChange('landPlot', e.target.value)} /></div>
                                <div><label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Tổng dt (m²)</label><input type="number" className="w-full border border-green-200 rounded-md px-2 py-1 text-center font-bold text-green-800 bg-white outline-none text-xs sm:text-sm" placeholder="0" value={formData.area || ''} onChange={(e) => handleChange('area', e.target.value)} /></div>
                                <div><label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">ONT/ODT (m²)</label><input type="number" className="w-full border border-green-200 rounded-md px-2 py-1 text-center font-bold text-green-800 bg-white outline-none text-xs sm:text-sm" placeholder="0" value={formData.residentialArea || ''} onChange={(e) => handleChange('residentialArea', e.target.value)} /></div>
                            </div>
                        </div>
                    )}
                </div>
                {/* Nội dung chi tiết */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-2 flex items-center gap-1.5 border-b pb-2 border-slate-100">
                        <span className="p-1 bg-orange-100 text-orange-600 rounded-md"><FileCheck size={14} /></span> 
                        Nội dung chi tiết
                    </h3>
                    
                    <div>
                        <AutoResizeTextarea className="w-full p-2.5 border border-gray-300 rounded-lg text-xs sm:text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-medium text-slate-700 bg-white" value={formData.content || ''} onChange={(e) => handleChange('content', e.target.value)} placeholder={isCongVan ? "Nhập trích yếu nội dung công văn hành chính..." : "Nhập nội dung chi tiết / ghi chú..."} />
                    </div>
                </div>

                {/* Giấy tờ kèm theo khác (nếu có) */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                    <div className="flex justify-between items-center mb-2.5 border-b pb-2 border-slate-100">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                            <span className="p-1 bg-teal-100 text-teal-600 rounded-md"><FileText size={14} /></span> 
                            Giấy tờ kèm theo khác (nếu có)
                        </h3>
                        <button
                            type="button"
                            onClick={handleAddDoc}
                            className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md border border-blue-200 hover:bg-blue-100 font-bold flex items-center gap-1 transition-all active:scale-95"
                        >
                            + THÊM
                        </button>
                    </div>
                    
                    {attachedDocs.length === 0 ? (
                        <div className="text-center py-3 text-xs text-slate-400 italic bg-slate-50/80 rounded-lg border border-dashed border-slate-200">
                            Không có giấy tờ kèm theo nào.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left border-collapse bg-white text-xs sm:text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-1.5 px-2 text-center w-8">#</th>
                                        <th className="py-1.5 px-2">Tên giấy tờ</th>
                                        <th className="py-1.5 px-2 w-28 text-center">Loại</th>
                                        <th className="py-1.5 px-2 w-8 text-center">Xóa</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                                    {attachedDocs.map((doc, idx) => (
                                        <tr key={doc.id} className="hover:bg-slate-50/50">
                                            <td className="py-1 px-2 text-center font-bold text-slate-400 text-xs">{idx + 1}</td>
                                            <td className="py-1 px-2">
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none"
                                                    placeholder="Tên giấy tờ..."
                                                    value={doc.name}
                                                    onChange={(e) => handleUpdateDoc(idx, 'name', e.target.value)}
                                                />
                                            </td>
                                            <td className="py-1 px-2">
                                                <div className="flex items-center justify-center gap-1.5 text-xs">
                                                    <label className="flex items-center gap-0.5 cursor-pointer">
                                                         <input
                                                             type="radio"
                                                             name={`docType-${doc.id}`}
                                                             value="Bản chính"
                                                             checked={doc.type === 'Bản chính'}
                                                             onChange={() => handleUpdateDoc(idx, 'type', 'Bản chính')}
                                                         />
                                                         Chính
                                                     </label>
                                                     <label className="flex items-center gap-0.5 cursor-pointer">
                                                         <input
                                                             type="radio"
                                                             name={`docType-${doc.id}`}
                                                             value="Bản sao"
                                                             checked={doc.type === 'Bản sao'}
                                                             onChange={() => handleUpdateDoc(idx, 'type', 'Bản sao')}
                                                         />
                                                         Sao
                                                     </label>
                                                </div>
                                            </td>
                                            <td className="py-1 px-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteDoc(idx)}
                                                    className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Thông tin người được ủy quyền (nếu có) */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
                    <div 
                        onClick={() => setIsAuthOpen(!isAuthOpen)}
                        className="p-3.5 sm:p-4 flex items-center justify-between gap-2 bg-white rounded-xl cursor-pointer hover:bg-slate-50 select-none"
                    >
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                            <span className="p-1 bg-indigo-100 text-indigo-600 rounded-md"><UserIcon size={14} /></span>
                            Người ủy quyền (nếu có)
                        </h3>
                        <button
                            type="button"
                            className="text-xs font-bold uppercase rounded-md border border-slate-200 px-2.5 py-1 text-slate-600 bg-white shadow-xs pointer-events-none"
                        >
                            {isAuthOpen ? '▲ ẨN' : '▼ HIỆN'}
                        </button>
                    </div>

                    {isAuthOpen && (
                        <div className="p-3.5 bg-slate-50/50 space-y-3 animate-fade-in border-t border-slate-100 rounded-b-xl">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass}>Họ và tên</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Họ tên..."
                                        value={formData.authorizedBy || ''}
                                        onChange={(e) => handleChange('authorizedBy', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Số CCCD</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Số CCCD..."
                                        value={authCccd}
                                        onChange={(e) => {
                                            setAuthCccd(e.target.value);
                                            setFormData(prev => ({ ...prev, authDocType: `${e.target.value}|${authAddress}` }));
                                        }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Địa chỉ</label>
                                <input
                                    type="text"
                                    className={inputClass}
                                    placeholder="Địa chỉ thường trú..."
                                    value={authAddress}
                                    onChange={(e) => {
                                        setAuthAddress(e.target.value);
                                        setFormData(prev => ({ ...prev, authDocType: `${authCccd}|${e.target.value}` }));
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

        {/* BUTTONS CỐ ĐỊNH STICKY DƯỚI CÙNG */}
        <div className="sticky bottom-0 left-0 right-0 z-20 bg-slate-50/95 backdrop-blur-md border-t border-slate-200 py-2.5 px-4 2xl:py-3.5 2xl:px-8 -mx-4 flex flex-col sm:flex-row justify-end gap-2.5 2xl:gap-4 shadow-md rounded-b-xl mt-3 2xl:mt-6">
            <button type="button" onClick={() => handleReset(false)} className="px-4 2xl:px-8 py-2 2xl:py-3 bg-white text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shadow-xs text-xs sm:text-sm 2xl:text-base font-bold border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer">
                {initialData ? <><XCircle size={16} className="text-red-500" /> Hủy</> : <><RotateCcw size={16} /> Làm mới</>}
            </button>
            <button 
                type="submit" 
                disabled={loading || !formData.recordType || !formData.recordType.trim()} 
                className={`px-6 2xl:px-10 py-2 2xl:py-3 rounded-lg shadow-md text-xs sm:text-sm 2xl:text-base font-bold transition-all flex items-center justify-center gap-1.5 ${
                    !formData.recordType || !formData.recordType.trim() 
                        ? 'bg-slate-400 text-slate-200 cursor-not-allowed opacity-70' 
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 cursor-pointer'
                }`}
            >
                <Save size={16} /> {loading ? 'Đang xử lý...' : (initialData ? 'CẬP NHẬT' : 'LƯU VÀ IN')}
            </button>
        </div>
    </form>
  );
};

export default RecordForm;
