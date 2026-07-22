
import React, { useState, useEffect, useRef } from 'react';
import { RecordFile, Holiday, RecordStatus, User, Employee } from '../../types';
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
            if (rType && rDate) newData.deadline = calculateDeadline(rType, rDate);
        }
        
        if (field === 'recordType') {
            if (value === '1.1 CC DL ĐĐ' || value === 'Cung cấp tài liệu đất đai' || value === '1.1 Cung cấp dữ liệu đất đai') {
                newData.price = 310000;
            } else {
                newData.price = null;
            }

            // Auto-populate default documents for "1.1 Cung cấp dữ liệu đất đai" and "Hồ sơ đo đạc" (starts with 2.)
            if (value === '1.1 Cung cấp dữ liệu đất đai' || value === '1.1 CC DL ĐĐ' || value.startsWith('2.')) {
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
    if (!formData.code || !formData.customerName || !formData.deadline || !formData.recordType) { 
        setNotification({ type: 'error', message: "Vui lòng điền các trường bắt buộc (*) và chọn Loại hồ sơ." });
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

  const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-medium text-slate-700 bg-white hover:border-gray-400";
  const labelClass = "block text-xs font-bold text-gray-700 mb-1";
  const iconWrapperClass = "absolute left-3 top-[34px] text-slate-400 pointer-events-none";

  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

  const isCongVan = formData.recordType ? getShortRecordType(formData.recordType) === '1.2 Công văn' : false;

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6 animate-fade-in relative pb-10">
        <div ref={topRef} />
        {notification && (
            <div className={`p-4 rounded-xl border shadow-lg flex items-start gap-3 transition-all duration-300 animate-fade-in-up ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                {notification.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5" size={20} /> : <AlertCircle className="shrink-0 mt-0.5" size={20} />}
                <div className="flex-1"><h4 className="font-bold text-sm uppercase">{notification.type === 'success' ? 'Thành công' : 'Có lỗi xảy ra'}</h4><p className="text-sm">{notification.message}</p></div>
                <button type="button" onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
        )}
        {initialData && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center justify-between mb-4 shadow-sm">
                <span className="font-bold flex items-center gap-2"><Loader2 className="animate-spin text-amber-600" size={18}/> Đang sửa: <span className="bg-white px-2 py-0.5 rounded border border-amber-200">{initialData.code}</span></span>
                <button type="button" onClick={() => handleReset(false)} className="text-sm font-bold underline hover:text-amber-900 bg-white/50 px-3 py-1.5 rounded">Hủy</button>
            </div>
        )}

        <div className="flex flex-col gap-6">
            {/* CỘT 4: Thời gian & Mã */}
            <div className="w-full animate-fade-in-up">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2"><span className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><Calendar size={16} /></span> Thời gian & Mã</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className={labelClass}>Ngày nhận</label><input type="date" required className={inputClass} value={dateVal(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value)} /></div>
                        <div><label className={`${labelClass} text-purple-600`}>{isCongVan ? 'Hạn xử lý' : 'Hẹn trả'} <span className="text-red-500">*</span></label><input type="date" required className={`${inputClass} bg-purple-50 border-purple-200 text-purple-700 font-bold`} value={dateVal(formData.deadline)} onChange={(e) => handleChange('deadline', e.target.value)} /></div>
                        <div><label className={labelClass}>Mã hồ sơ</label><input type="text" readOnly={!initialData} className={`${inputClass} font-mono ${initialData ? 'bg-white font-bold text-blue-700' : 'bg-slate-100 text-slate-500 cursor-not-allowed'}`} value={formData.code || ''} onChange={(e) => initialData && handleChange('code', e.target.value)} /></div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <label className={labelClass}>Loại hồ sơ <span className="text-red-500">*</span></label>
                        <select className={inputClass} value={formData.recordType || ''} onChange={(e) => handleChange('recordType', e.target.value)}>
                            <option value="">-- Chọn loại hồ sơ --</option>
                            {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* CỘT 1: Người nộp hồ sơ hoặc Thông tin gửi / nhận */}
            <div className="w-full">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                        <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                            <UserIcon size={16} />
                        </span> 
                        {isCongVan ? 'Thông tin nơi gửi / nhận' : 'Người nộp hồ sơ'}
                    </h3>
                    
                    {isCongVan ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>Số, ký hiệu Công văn <span className="text-red-500">*</span></label>
                                <input type="text" required className={inputClass} placeholder="VD: 123/UBND-TH..." value={formData.issueNumber || ''} onChange={(e) => handleChange('issueNumber', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Nơi nhận / Đơn vị xử lý</label>
                                <input type="text" className={inputClass} placeholder="VD: Chi nhánh VPĐKĐD..." value={formData.customerAddress || ''} onChange={(e) => handleChange('customerAddress', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Số điện thoại liên hệ</label>
                                <input type="text" className={inputClass} placeholder="VD: 09xxxxxxxx" value={formData.phoneNumber || ''} onChange={(e) => handleChange('phoneNumber', e.target.value)} />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div><label className={labelClass}>Chủ sử dụng <span className="text-red-500">*</span></label><input type="text" required className={inputClass} placeholder="Nguyễn Văn A..." value={formData.customerName || ''} onChange={(e) => handleChange('customerName', e.target.value)} /></div>
                                <div><label className={labelClass}>CCCD</label><input type="text" className={inputClass} placeholder="0123456789..." value={formData.cccd || ''} onChange={(e) => handleChange('cccd', e.target.value)} /></div>
                                <div><label className={labelClass}>Địa chỉ chủ sử dụng</label><input type="text" className={inputClass} placeholder="Địa chỉ thường trú..." value={formData.customerAddress || ''} onChange={(e) => handleChange('customerAddress', e.target.value)} /></div>
                                <div><label className={labelClass}>Số điện thoại</label><input type="text" className={inputClass} placeholder="09xxxxxxxx" value={formData.phoneNumber || ''} onChange={(e) => handleChange('phoneNumber', e.target.value)} /></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* CỘT 2: Thông tin giấy chứng nhận hoặc Chi tiết Công văn */}
            <div className="w-full">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                        <span className="p-1.5 bg-green-100 text-green-600 rounded-lg">
                            <MapPin size={16} />
                        </span> 
                        {isCongVan ? 'Văn bản Công văn' : 'Thông tin giấy chứng nhận'}
                    </h3>
                    
                    {isCongVan ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>Cơ quan ban hành / Nơi gửi <span className="text-red-500">*</span></label>
                                <input type="text" required className={inputClass} placeholder="VD: UBND huyện, Tòa án..." value={formData.customerName || ''} onChange={(e) => handleChange('customerName', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Ngày Công văn / Ngày ban hành</label>
                                <input type="date" className={inputClass} value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Xã / Phường liên quan</label>
                                <select className={inputClass} value={formData.ward || ''} onChange={(e) => handleChange('ward', e.target.value)}>
                                    <option value="">-- Chọn xã / phường --</option>
                                    {wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div><label className={labelClass}>Xã / Phường <span className="text-red-500">*</span></label><select required className={inputClass} value={formData.ward || ''} onChange={(e) => handleChange('ward', e.target.value)}><option value="">-- Chọn xã / phường --</option>{wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}</select></div>
                                <div><label className={labelClass}>Số phát hành</label><input type="text" className={inputClass} placeholder="VD: CD 123456" value={formData.issueNumber || ''} onChange={(e) => handleChange('issueNumber', e.target.value)} /></div>
                                <div><label className={labelClass}>Số vào sổ</label><input type="text" className={inputClass} placeholder="VD: CH 01234" value={formData.entryNumber || ''} onChange={(e) => handleChange('entryNumber', e.target.value)} /></div>
                                <div><label className={labelClass}>Ngày cấp</label><input type="date" className={inputClass} value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value)} /></div>
                            </div>
                            
                            <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                                <div className="relative"><label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Tờ bản đồ</label><input type="text" className="w-full border border-green-200 rounded-lg px-2 py-2 text-center font-bold text-green-800 bg-white outline-none" placeholder="0" value={formData.mapSheet || ''} onChange={(e) => handleChange('mapSheet', e.target.value)} /></div>
                                <div className="relative"><label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Thửa đất</label><input type="text" className="w-full border border-green-200 rounded-lg px-2 py-2 text-center font-bold text-green-800 bg-white outline-none" placeholder="0" value={formData.landPlot || ''} onChange={(e) => handleChange('landPlot', e.target.value)} /></div>
                                <div className="relative"><label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Diện tích (m²)</label><input type="number" className="w-full border border-green-200 rounded-lg px-2 py-2 text-center font-bold text-green-800 bg-white outline-none" placeholder="0" value={formData.area || ''} onChange={(e) => handleChange('area', e.target.value)} /></div>
                                <div className="relative"><label className="block text-[10px] font-bold text-green-700 uppercase mb-1 text-center">Đất ở (m²)</label><input type="number" className="w-full border border-green-200 rounded-lg px-2 py-2 text-center font-bold text-green-800 bg-white outline-none" placeholder="0" value={formData.residentialArea || ''} onChange={(e) => handleChange('residentialArea', e.target.value)} /></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* CỘT 3: Nội dung yêu cầu */}
            <div className="w-full">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2"><span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg"><FileCheck size={16} /></span> Nội dung yêu cầu</h3>
                    
                    <div>
                        <label className={labelClass}>{isCongVan ? 'Trích yếu nội dung công văn' : 'Nội dung chi tiết'}</label>
                        <textarea rows={1} className="w-full p-3 border border-gray-300 rounded-md text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-medium text-slate-700 bg-white resize-none" value={formData.content || ''} onChange={(e) => handleChange('content', e.target.value)} placeholder={isCongVan ? "Nhập trích yếu nội dung công văn hành chính..." : "Nhập ghi chú..."} />
                    </div>
                </div>
            </div>

            {/* GIẤY TỜ KÈM THEO KHÁC */}
            <div className="w-full">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 left-0 w-1 h-full bg-teal-500"></div>
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                            <span className="p-1.5 bg-teal-100 text-teal-600 rounded-lg"><FileText size={16} /></span> 
                            Giấy tờ kèm theo khác (nếu có)
                        </h3>
                        <button
                            type="button"
                            onClick={handleAddDoc}
                            className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 font-bold flex items-center gap-1 transition-all active:scale-95"
                        >
                            + THÊM MỚI
                        </button>
                    </div>
                    
                    {attachedDocs.length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Không có giấy tờ kèm theo nào. Bấm nút Thêm mới để thêm.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left border-collapse bg-white">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-2.5 px-3 text-center w-12">#</th>
                                        <th className="py-2.5 px-3">Tên giấy tờ khác nộp kèm</th>
                                        <th className="py-2.5 px-3 w-48 text-center">Hình thức nộp</th>
                                        <th className="py-2.5 px-3 w-16 text-center">Xóa</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {attachedDocs.map((doc, idx) => (
                                        <tr key={doc.id} className="hover:bg-slate-50/50">
                                            <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                            <td className="py-2 px-3">
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                                    placeholder="Nhập tên giấy tờ..."
                                                    value={doc.name}
                                                    onChange={(e) => handleUpdateDoc(idx, 'name', e.target.value)}
                                                />
                                            </td>
                                            <td className="py-2 px-3">
                                                <div className="flex items-center justify-center gap-3 text-xs">
                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                         <input
                                                             type="radio"
                                                             name={`docType-${doc.id}`}
                                                             value="Bản chính"
                                                             checked={doc.type === 'Bản chính'}
                                                             onChange={() => handleUpdateDoc(idx, 'type', 'Bản chính')}
                                                         />
                                                         Bản chính
                                                    </label>
                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                         <input
                                                             type="radio"
                                                             name={`docType-${doc.id}`}
                                                             value="Bản sao"
                                                             checked={doc.type === 'Bản sao'}
                                                             onChange={() => handleUpdateDoc(idx, 'type', 'Bản sao')}
                                                         />
                                                         Bản sao
                                                    </label>
                                                </div>
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteDoc(idx)}
                                                    className="p-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-100 transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

        {/* THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN (NẾU CÓ) */}
        <div className="w-full">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 bg-white">
                    <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                        <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                            <UserIcon size={16} />
                        </span>
                        Thông tin người được ủy quyền (nếu có)
                    </h3>
                    <button
                        type="button"
                        onClick={() => setIsAuthOpen(!isAuthOpen)}
                        className="flex items-center gap-1 text-xs font-bold uppercase rounded-lg border border-slate-200 hover:bg-slate-50 transition-all px-3 py-1.5 text-slate-600 bg-white shadow-sm"
                    >
                        {isAuthOpen ? '▲ ẨN NHẬP LIỆU' : '▼ HIỆN NHẬP LIỆU'}
                    </button>
                </div>

                {isAuthOpen && (
                    <div className="p-6 bg-slate-50/30 grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in border-t border-slate-100">
                        <div>
                            <label className={labelClass}>Họ tên người được ủy quyền</label>
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="Họ tên người được ủy quyền..."
                                value={formData.authorizedBy || ''}
                                onChange={(e) => handleChange('authorizedBy', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>CCCD người được ủy quyền</label>
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="Nhập số CCCD người được ủy quyền..."
                                value={authCccd}
                                onChange={(e) => {
                                    setAuthCccd(e.target.value);
                                    setFormData(prev => ({ ...prev, authDocType: `${e.target.value}|${authAddress}` }));
                                }}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Địa chỉ thường trú người được ủy quyền</label>
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="Nhập địa chỉ thường trú người được ủy quyền..."
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

        {/* BUTTONS Ở DƯỚI CÙNG - CỐ ĐỊNH STICKY */}
        <div className="sticky bottom-0 left-0 right-0 z-20 bg-slate-50/90 backdrop-blur-md border-t border-slate-200 py-4 px-6 -mx-6 flex flex-col sm:flex-row justify-end gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] rounded-b-2xl mt-6">
            <button type="button" onClick={() => handleReset(false)} className="px-6 py-2.5 bg-white text-slate-600 rounded-xl hover:bg-slate-100 transition-colors shadow-sm font-bold border border-slate-200 flex items-center justify-center gap-2">
                {initialData ? <><XCircle size={18} className="text-red-500" /> Hủy</> : <><RotateCcw size={18} /> Làm mới</>}
            </button>
            <button type="submit" disabled={loading} className="px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg font-bold transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2">
                <Save size={18} /> {loading ? 'Đang xử lý...' : (initialData ? 'CẬP NHẬT' : 'LƯU VÀ IN')}
            </button>
        </div>
        </div>
    </form>
  );
};

export default RecordForm;
