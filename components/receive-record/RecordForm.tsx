
import React, { useState, useEffect, useRef } from 'react';
import { RecordFile, Holiday, RecordStatus, User, Employee, DangKyParty } from '../../types';
import { RECORD_TYPES, EXTENDED_RECORD_TYPES, getShortRecordType, getWardLabel } from '../../constants';
import { addActivityLog } from '../../services/activityLogService';
import { AutoResizeTextarea } from '../AutoResizeTextarea';
import { Save, User as UserIcon, Calendar, MapPin, FileCheck, Loader2, Printer, RotateCcw, XCircle, CheckCircle, AlertCircle, X, Phone, FileText, BookOpen, Clock, Hash, Map, ChevronDown, ChevronUp, Users, UserPlus, Plus, Shield } from 'lucide-react';

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
    if (!str) return { cccd: '', address: '', phone: '' };
    const parts = str.split('|');
    const firstPart = parts[0] || '';
    const secondPart = parts[1] || '';
    const thirdPart = parts[2] || '';
    
    // Check if first part is an old document type
    const knownDocTypes = ['Hợp đồng ủy quyền', 'Giấy ủy quyền', 'Văn bản ủy quyền', 'Hợp đồng uỷ quyền', 'Giấy uỷ quyền', 'Văn bản uỷ quyền', 'Khác'];
    const isDocType = knownDocTypes.some(type => firstPart.toLowerCase().includes(type.toLowerCase()));
    
    if (isDocType) {
        if (parts.length >= 4) {
            // Old format: Loại|Hình thức|CCCD|Địa chỉ/SĐT
            return { cccd: parts[2] || '', address: parts[3] || '', phone: parts[4] || '' };
        }
        return { cccd: '', address: '', phone: '' };
    } else {
        // New format: CCCD|Address|Phone
        return {
            cccd: firstPart,
            address: secondPart,
            phone: thirdPart
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
    issueNumber: '', entryNumber: '', issueDate: '', residentialArea: 0,
    owners: [{ name: '', cccd: '', address: '', phone: '' }],
    transferees: [],
    applicantIsOwner: false,
    applicantName: '',
    applicantCccd: '',
    applicantPhone: '',
    applicantAddress: ''
  });

  const [attachedDocs, setAttachedDocs] = useState<AttachedDocItem[]>([]);
  const [authCccd, setAuthCccd] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
      if (initialData) {
          setFormData({
              ...initialData,
              owners: initialData.owners && initialData.owners.length > 0 
                  ? initialData.owners 
                  : [{ name: initialData.customerName || '', cccd: initialData.cccd || '', address: initialData.customerAddress || '', phone: initialData.phoneNumber || '' }],
              transferees: initialData.transferees || []
          });
          setAttachedDocs(parseAttachedDocs(initialData.otherDocs));
          const parsed = parseAuthDocType(initialData.authDocType);
          setAuthCccd(parsed.cccd || initialData.authorizedPersonId || '');
          setAuthAddress(parsed.address || initialData.authorizedPersonAddress || '');
          setAuthPhone(parsed.phone || initialData.authorizedPersonPhone || '');
          setIsAuthOpen(!!(initialData.authorizedBy || initialData.authorizedPersonName || parsed.cccd || parsed.address || parsed.phone || initialData.authorizedPersonId || initialData.authorizedPersonPhone));
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

  // Kiểm tra loại hồ sơ 3.x.x Đăng ký
  const isDangKy = formData.recordType ? (
      formData.recordType.startsWith('3.') || 
      formData.recordType.toLowerCase().includes('chuyển nhượng') || 
      formData.recordType.toLowerCase().includes('tặng cho') || 
      formData.recordType.toLowerCase().includes('thừa kế') || 
      formData.recordType.toLowerCase().includes('cấp đổi') || 
      formData.recordType.toLowerCase().includes('cấp lại') ||
      formData.recordType.toLowerCase().includes('đăng ký')
  ) : false;

  useEffect(() => {
    if (!initialData) {
        if (!isDangKy) {
            const newCode = generateCode(processingWard, formData.receivedDate || '');
            setFormData(prev => {
                if (prev.code === newCode) return prev;
                return { ...prev, code: newCode };
            });
        } else if (!formData.code) {
            const newCode = generateCode(processingWard, formData.receivedDate || '');
            setFormData(prev => ({ ...prev, code: newCode }));
        }
    }
  }, [processingWard, formData.receivedDate, records, initialData, isDangKy]);

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
            } else if (value.startsWith('3.')) {
                // Đăng ký hồ sơ - mặc định giấy tờ
                const defaultDkDocs: AttachedDocItem[] = [
                    { id: '1', name: 'Giấy chứng nhận QSD đất', type: 'Bản chính' },
                    { id: '2', name: 'Đơn đăng ký biến động', type: 'Bản chính' }
                ];
                setAttachedDocs(defaultDkDocs);
                newData.otherDocs = JSON.stringify(defaultDkDocs);
            } else {
                setAttachedDocs([]);
                newData.otherDocs = '';
            }
        }
        return newData;
    });
  };

  // Owners Handlers (Cho 3.x.x)
  const addOwner = () => {
    setFormData(prev => ({
      ...prev,
      owners: [...(prev.owners || []), { name: '', cccd: '', address: '', phone: '' }]
    }));
  };

  const removeOwner = (index: number) => {
    setFormData(prev => {
      const remaining = (prev.owners || []).filter((_, idx) => idx !== index);
      const nextOwners = remaining.length > 0 ? remaining : [{ name: '', cccd: '', address: '', phone: '' }];
      return { ...prev, owners: nextOwners };
    });
  };

  const updateOwner = (index: number, field: keyof DangKyParty, value: string) => {
    setFormData(prev => {
      const nextOwners = [...(prev.owners || [{ name: '', cccd: '', address: '', phone: '' }])];
      nextOwners[index] = { ...nextOwners[index], [field]: value };
      const updated: Partial<RecordFile> = { ...prev, owners: nextOwners };
      
      // Đồng bộ chủ đầu tiên với customerName / cccd / customerAddress / phoneNumber
      if (index === 0) {
        if (field === 'name') updated.customerName = value;
        if (field === 'cccd') updated.cccd = value;
        if (field === 'phone') updated.phoneNumber = value;
        if (field === 'address') updated.customerAddress = value;
        
        // Nếu KHÔNG tích chọn "Người nộp là chủ" -> người nộp chính là người đứng tên GCN
        if (!prev.applicantIsOwner) {
          if (field === 'name') updated.applicantName = value;
          if (field === 'cccd') updated.applicantCccd = value;
          if (field === 'phone') updated.applicantPhone = value;
          if (field === 'address') updated.applicantAddress = value;
        }
      }
      return updated;
    });
  };

  // Transferees Handlers (Cho 3.x.x)
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
      const updated: Partial<RecordFile> = { ...prev, transferees: nextTf };

      // Nếu ĐANG TÍCH "Người nộp là chủ" -> người nộp chính là người nhận quyền đầu tiên
      if (index === 0 && prev.applicantIsOwner) {
        if (field === 'name') updated.applicantName = value;
        if (field === 'cccd') updated.applicantCccd = value;
        if (field === 'phone') updated.applicantPhone = value;
        if (field === 'address') updated.applicantAddress = value;
      }
      return updated;
    });
  };

  // Xử lý thay đổi thông tin người nộp hồ sơ (Real-time auto-sync)
  const handleApplicantFieldChange = (field: 'applicantName' | 'applicantCccd' | 'applicantPhone' | 'applicantAddress', value: string) => {
    setFormData(prev => {
      const updated: Partial<RecordFile> = {
        ...prev,
        [field]: value
      };

      if (prev.applicantIsOwner) {
        // TÍCH CHỌN: Đưa thông tin vào NGƯỜI NHẬN (transferees[0])
        const nextTf = [...(prev.transferees || [])];
        const tfField: keyof DangKyParty = field === 'applicantName' ? 'name' : field === 'applicantCccd' ? 'cccd' : field === 'applicantPhone' ? 'phone' : 'address';
        if (nextTf.length === 0) {
          nextTf.push({ name: '', cccd: '', phone: '', address: '', [tfField]: value });
        } else {
          nextTf[0] = { ...nextTf[0], [tfField]: value };
        }
        updated.transferees = nextTf;
      } else {
        // KHÔNG TÍCH: Đưa thông tin vào NGƯỜI ĐỨNG TÊN GCN (owners[0])
        const nextOwners = [...(prev.owners || [{ name: '', cccd: '', address: '', phone: '' }])];
        const ownerField: keyof DangKyParty = field === 'applicantName' ? 'name' : field === 'applicantCccd' ? 'cccd' : field === 'applicantPhone' ? 'phone' : 'address';
        if (nextOwners.length === 0) {
          nextOwners.push({ name: '', cccd: '', phone: '', address: '', [ownerField]: value });
        } else {
          nextOwners[0] = { ...nextOwners[0], [ownerField]: value };
        }
        updated.owners = nextOwners;
        if (field === 'applicantName') updated.customerName = value;
        if (field === 'applicantCccd') updated.cccd = value;
        if (field === 'applicantPhone') updated.phoneNumber = value;
        if (field === 'applicantAddress') updated.customerAddress = value;
      }

      return updated;
    });
  };

  // Sync applicant with Transferee (if checked) or Owner (if unchecked)
  const handleApplicantIsOwnerToggle = (checked: boolean) => {
    setFormData(prev => {
      const updated: Partial<RecordFile> = {
        ...prev,
        applicantIsOwner: checked,
      };

      const curApplicantName = prev.applicantName || prev.customerName || '';
      const curApplicantCccd = prev.applicantCccd || prev.cccd || '';
      const curApplicantPhone = prev.applicantPhone || prev.phoneNumber || '';
      const curApplicantAddress = prev.applicantAddress || prev.customerAddress || '';

      if (checked) {
        // TÍCH CHỌN: Đưa thông tin nhập vào NGƯỜI NHẬN (CHUYỂN NHƯỢNG, THỪA KẾ, TẶNG CHO, THỎA THUẬN)
        const nextTf = [...(prev.transferees || [])];
        if (nextTf.length === 0) {
          nextTf.push({
            name: curApplicantName,
            cccd: curApplicantCccd,
            phone: curApplicantPhone,
            address: curApplicantAddress
          });
        } else {
          nextTf[0] = {
            ...nextTf[0],
            name: curApplicantName || nextTf[0].name || '',
            cccd: curApplicantCccd || nextTf[0].cccd || '',
            phone: curApplicantPhone || nextTf[0].phone || '',
            address: curApplicantAddress || nextTf[0].address || ''
          };
        }
        updated.transferees = nextTf;

        // Nếu thông tin người nộp đang trống nhưng người nhận đã có sẵn, kéo về người nộp
        if (!curApplicantName && nextTf[0].name) updated.applicantName = nextTf[0].name;
        if (!curApplicantCccd && nextTf[0].cccd) updated.applicantCccd = nextTf[0].cccd;
        if (!curApplicantPhone && nextTf[0].phone) updated.applicantPhone = nextTf[0].phone;
        if (!curApplicantAddress && nextTf[0].address) updated.applicantAddress = nextTf[0].address;
      } else {
        // KHÔNG TÍCH: Đưa thông tin vào Người đứng tên GCN (owners[0])
        const nextOwners = [...(prev.owners || [{ name: '', cccd: '', address: '', phone: '' }])];
        if (nextOwners.length === 0) {
          nextOwners.push({
            name: curApplicantName,
            cccd: curApplicantCccd,
            phone: curApplicantPhone,
            address: curApplicantAddress
          });
        } else {
          nextOwners[0] = {
            ...nextOwners[0],
            name: curApplicantName || nextOwners[0].name || '',
            cccd: curApplicantCccd || nextOwners[0].cccd || '',
            phone: curApplicantPhone || nextOwners[0].phone || '',
            address: curApplicantAddress || nextOwners[0].address || ''
          };
        }
        updated.owners = nextOwners;
        updated.customerName = nextOwners[0].name;
        updated.cccd = nextOwners[0].cccd;
        updated.phoneNumber = nextOwners[0].phone;
        updated.customerAddress = nextOwners[0].address;

        // Nếu thông tin người nộp đang trống nhưng chủ GCN đã có sẵn, kéo về người nộp
        if (!curApplicantName && nextOwners[0].name) updated.applicantName = nextOwners[0].name;
        if (!curApplicantCccd && nextOwners[0].cccd) updated.applicantCccd = nextOwners[0].cccd;
        if (!curApplicantPhone && nextOwners[0].phone) updated.applicantPhone = nextOwners[0].phone;
        if (!curApplicantAddress && nextOwners[0].address) updated.applicantAddress = nextOwners[0].address;
      }

      return updated;
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
    const isCongVan = formData.recordType ? getShortRecordType(formData.recordType) === '1.2 Công văn' : false;
    const isDeadlineRequired = !isCongVan;
    
    // Tự động gán customerName từ người nộp hoặc chủ đầu tiên nếu đang ở chế độ 3.x.x
    let effectiveCustomerName = formData.customerName || '';
    if (isDangKy) {
        if (formData.applicantName) {
            effectiveCustomerName = formData.applicantName;
        } else if (formData.owners && formData.owners.length > 0 && formData.owners[0].name) {
            effectiveCustomerName = formData.owners[0].name;
        }
    }

    if (!formData.code || (!effectiveCustomerName && !formData.applicantName) || (isDeadlineRequired && !formData.deadline) || !formData.recordType) { 
        setNotification({ type: 'error', message: "Vui lòng điền các trường bắt buộc (*) và chọn Loại hồ sơ." });
        return; 
    }
    setLoading(true);
    const recordToSave: RecordFile = { 
        ...formData, 
        customerName: effectiveCustomerName || formData.customerName || '',
        authorizedBy: formData.authorizedBy || formData.authorizedPersonName || '',
        authorizedPersonName: formData.authorizedBy || formData.authorizedPersonName || '',
        authorizedPersonId: authCccd || formData.authorizedPersonId || '',
        authorizedPersonPhone: authPhone || formData.authorizedPersonPhone || '',
        authorizedPersonAddress: authAddress || formData.authorizedPersonAddress || '',
        authDocType: `${authCccd}|${authAddress}|${authPhone}`,
        id: formData.id || Math.random().toString(36).substr(2, 9), 
        status: formData.status || RecordStatus.RECEIVED,
        receivedBy: formData.receivedBy || currentUser.employeeId,
        sourceTable: isDangKy ? 'dangky_records' : (formData.sourceTable || 'land_records')
    } as RecordFile;
    const savedRecord = await onSave(recordToSave);
    setLoading(false);
    if (savedRecord) {
        addActivityLog({
            performerName: currentUser?.fullName || currentUser?.name || currentUser?.username || 'Cán bộ',
            performerRole: currentUser?.role || 'ONEDOOR',
            actionType: initialData ? 'UPDATE' : 'CREATE',
            actionLabel: initialData ? 'Cập nhật' : 'Tiếp nhận mới',
            targetType: isDangKy ? 'Đăng ký' : 'Hồ sơ',
            referenceCode: savedRecord.code,
            details: `${initialData ? 'Cập nhật thông tin' : 'Tiếp nhận mới'} hồ sơ ${savedRecord.code} - ${savedRecord.customerName || (savedRecord as any).owners?.[0]?.name || ''}`,
            recordId: savedRecord.id
        });
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
          issueNumber: '', entryNumber: '', issueDate: '', residentialArea: 0,
          owners: [{ name: '', cccd: '', address: '', phone: '' }],
          transferees: [],
          applicantIsOwner: false,
          applicantName: '',
          applicantCccd: '',
          applicantPhone: '',
          applicantAddress: ''
      });
      setAttachedDocs([]);
      setAuthCccd('');
      setAuthAddress('');
      setAuthPhone('');
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
                    <select className={`${inputClass} font-semibold`} value={formData.recordType || ''} onChange={(e) => handleChange('recordType', e.target.value)}>
                        <option value="">-- Chọn loại hồ sơ --</option>
                        {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div>
                    <label className={labelClass}>Mã hồ sơ</label>
                    <input type="text" readOnly={!initialData && !isDangKy} className={`${inputClass} font-mono ${(!initialData && isDangKy) || initialData ? 'bg-white font-bold text-blue-700' : 'bg-slate-100 text-slate-500 cursor-not-allowed'}`} value={formData.code || ''} onChange={(e) => (initialData || isDangKy) && handleChange('code', e.target.value)} />
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

        {/* NỘI DUNG FORM: DYNAMIC TÙY THEO LOẠI HỒ SƠ */}
        {isDangKy ? (
            /* ================= GIAO DIỆN CHUYÊN BIỆT CHO HỒ SƠ 3.x.x ĐĂNG KÝ ================= */
            <div className="space-y-3.5 sm:space-y-4">
                {/* 1. THÔNG TIN NGƯỜI NỘP HỒ SƠ */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between border-b pb-2 mb-3 border-slate-100">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                            <span className="p-1 bg-blue-100 text-blue-600 rounded-md">
                                <UserIcon size={14} />
                            </span>
                            THÔNG TIN NGƯỜI NỘP HỒ SƠ
                        </h3>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-blue-700 hover:text-blue-900 select-none">
                            <input
                                type="checkbox"
                                checked={!!formData.applicantIsOwner}
                                onChange={e => handleApplicantIsOwnerToggle(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            Người nộp là chủ hồ sơ
                        </label>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className={labelClass}>
                                Họ và tên người nộp <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.applicantName || ''}
                                onChange={e => handleApplicantFieldChange('applicantName', e.target.value)}
                                className={inputClass}
                                placeholder="Họ và tên..."
                            />
                        </div>

                        <div>
                            <label className={labelClass}>
                                CCCD/Số Giấy <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.applicantCccd || ''}
                                onChange={e => handleApplicantFieldChange('applicantCccd', e.target.value)}
                                className={`${inputClass} font-mono`}
                                placeholder="CCCD..."
                            />
                        </div>

                        <div>
                            <label className={labelClass}>
                                SĐT người nộp <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.applicantPhone || ''}
                                onChange={e => handleApplicantFieldChange('applicantPhone', e.target.value)}
                                className={inputClass}
                                placeholder="Số điện thoại..."
                            />
                        </div>

                        <div className="md:col-span-3">
                            <label className={labelClass}>
                                Địa chỉ thường trú <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.applicantAddress || ''}
                                onChange={e => handleApplicantFieldChange('applicantAddress', e.target.value)}
                                className={inputClass}
                                placeholder="Nhập địa chỉ thường trú..."
                            />
                        </div>
                    </div>
                </div>

                {/* 2. VỊ TRÍ & THỬA ĐẤT */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-3 flex items-center gap-1.5 border-b pb-2 border-slate-100">
                        <span className="p-1 bg-green-100 text-green-600 rounded-md">
                            <MapPin size={14} />
                        </span>
                        VỊ TRÍ & THỬA ĐẤT
                    </h3>
                    
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className={labelClass}>
                                    Xã / Phường <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.ward || ''}
                                    onChange={e => handleChange('ward', e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">-- Chọn Xã/Phường --</option>
                                    {wards.map(w => (
                                        <option key={w} value={w}>
                                            {getWardLabel(w)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className={labelClass}>Số phát hành</label>
                                <input
                                    type="text"
                                    value={formData.issueNumber || ''}
                                    onChange={e => handleChange('issueNumber', e.target.value)}
                                    className={inputClass}
                                    placeholder="VD: CD 123456"
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Số vào sổ</label>
                                <input
                                    type="text"
                                    value={formData.entryNumber || ''}
                                    onChange={e => handleChange('entryNumber', e.target.value)}
                                    className={inputClass}
                                    placeholder="VD: CH 01234"
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Ngày cấp</label>
                                <input
                                    type="date"
                                    value={dateVal(formData.issueDate)}
                                    onChange={e => handleChange('issueDate', e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className={labelClass}>Tờ bản đồ</label>
                                <input
                                    type="text"
                                    value={formData.mapSheet || ''}
                                    onChange={e => handleChange('mapSheet', e.target.value)}
                                    className={`${inputClass} font-mono`}
                                    placeholder="Tờ bản đồ"
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Thửa đất</label>
                                <input
                                    type="text"
                                    value={formData.landPlot || ''}
                                    onChange={e => handleChange('landPlot', e.target.value)}
                                    className={`${inputClass} font-mono`}
                                    placeholder="Thửa đất"
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Diện tích (m²)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.area ?? 0}
                                    onChange={e => handleChange('area', e.target.value ? Number(e.target.value) : 0)}
                                    className={`${inputClass} font-mono text-right`}
                                    placeholder="0"
                                />
                            </div>

                            <div>
                                <label className={labelClass}>ONT/ODT (m²)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.residentialArea ?? 0}
                                    onChange={e => handleChange('residentialArea', e.target.value ? Number(e.target.value) : 0)}
                                    className={`${inputClass} font-mono text-right`}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. NGƯỜI ĐỨNG TÊN GCN */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between border-b pb-2 mb-3 border-slate-100">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                            <span className="p-1 bg-blue-100 text-blue-600 rounded-md">
                                <Users size={14} />
                            </span>
                            NGƯỜI ĐỨNG TÊN GCN
                        </h3>
                        <button
                            type="button"
                            onClick={addOwner}
                            className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md border border-blue-200 hover:bg-blue-100 font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                        >
                            <Plus size={14} /> THÊM MỚI
                        </button>
                    </div>
                    
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left border-collapse bg-white text-xs sm:text-sm min-w-[500px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="py-2 px-2.5 w-10 text-center">#</th>
                                    <th className="py-2 px-2.5">HỌ TÊN NGƯỜI ĐỨNG TÊN GCN <span className="text-red-500">*</span></th>
                                    <th className="py-2 px-2.5">GIẤY CMND/ CCCD <span className="text-red-500">*</span></th>
                                    <th className="py-2 px-2.5">SỐ ĐIỆN THOẠI</th>
                                    <th className="py-2 px-2.5 w-10 text-center">XÓA</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                                {(formData.owners || [{ name: '', cccd: '', address: '', phone: '' }]).map((owner, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                                        <td className="py-1.5 px-2.5">
                                            <input
                                                type="text"
                                                required={idx === 0}
                                                value={owner.name}
                                                onChange={e => updateOwner(idx, 'name', e.target.value)}
                                                className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none text-slate-800 font-medium"
                                                placeholder="Họ tên..."
                                            />
                                        </td>
                                        <td className="py-1.5 px-2.5">
                                            <input
                                                type="text"
                                                value={owner.cccd || ''}
                                                onChange={e => updateOwner(idx, 'cccd', e.target.value)}
                                                className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none font-mono text-slate-800"
                                                placeholder="CCCD..."
                                            />
                                        </td>
                                        <td className="py-1.5 px-2.5">
                                            <input
                                                type="text"
                                                value={owner.phone || ''}
                                                onChange={e => updateOwner(idx, 'phone', e.target.value)}
                                                className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none text-slate-800"
                                                placeholder="SĐT..."
                                            />
                                        </td>
                                        <td className="py-1.5 px-2.5 text-center">
                                            <button
                                                type="button"
                                                onClick={() => removeOwner(idx)}
                                                disabled={(formData.owners || []).length <= 1}
                                                className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Xóa dòng"
                                            >
                                                <X size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. NGƯỜI NHẬN (CHUYỂN NHƯỢNG, THỪA KẾ, TẶNG CHO, THỎA THUẬN) (NẾU CÓ) */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between border-b pb-2 mb-3 border-slate-100">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                            <span className="p-1 bg-blue-100 text-blue-600 rounded-md">
                                <UserPlus size={14} />
                            </span>
                            NGƯỜI NHẬN (CHUYỂN NHƯỢNG, THỪA KẾ, TẶNG CHO, THỎA THUẬN) (NẾU CÓ)
                        </h3>
                        <button
                            type="button"
                            onClick={addTransferee}
                            className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md border border-blue-200 hover:bg-blue-100 font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                        >
                            <Plus size={14} /> THÊM MỚI
                        </button>
                    </div>
                    
                    {(formData.transferees || []).length === 0 ? (
                        <div className="text-center py-3 text-xs text-slate-400 italic bg-slate-50/80 rounded-lg border border-dashed border-slate-200">
                            Không có người nhận (Click nút "+ THÊM MỚI" để nhập liệu).
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left border-collapse bg-white text-xs sm:text-sm min-w-[500px]">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-2 px-2.5 w-10 text-center">#</th>
                                        <th className="py-2 px-2.5">HỌ VÀ TÊN NGƯỜI NHẬN</th>
                                        <th className="py-2 px-2.5">GIẤY CMND/ CCCD</th>
                                        <th className="py-2 px-2.5">SỐ ĐIỆN THOẠI</th>
                                        <th className="py-2 px-2.5 w-10 text-center">XÓA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                                    {(formData.transferees || []).map((tf, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50">
                                            <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                                            <td className="py-1.5 px-2.5">
                                                <input
                                                    type="text"
                                                    value={tf.name}
                                                    onChange={e => updateTransferee(idx, 'name', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none text-slate-800 font-medium"
                                                    placeholder="Họ tên..."
                                                />
                                            </td>
                                            <td className="py-1.5 px-2.5">
                                                <input
                                                    type="text"
                                                    value={tf.cccd || ''}
                                                    onChange={e => updateTransferee(idx, 'cccd', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none font-mono text-slate-800"
                                                    placeholder="CCCD..."
                                                />
                                            </td>
                                            <td className="py-1.5 px-2.5">
                                                <input
                                                    type="text"
                                                    value={tf.phone || ''}
                                                    onChange={e => updateTransferee(idx, 'phone', e.target.value)}
                                                    className="w-full px-2 py-1 text-xs sm:text-sm border border-slate-200 rounded-md focus:border-blue-500 outline-none text-slate-800"
                                                    placeholder="SĐT..."
                                                />
                                            </td>
                                            <td className="py-1.5 px-2.5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeTransferee(idx)}
                                                    className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                                    title="Xóa dòng"
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

                {/* NỘI DUNG YÊU CẦU CHI TIẾT */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-2 flex items-center gap-1.5 border-b pb-2 border-slate-100">
                        <span className="p-1 bg-purple-100 text-purple-600 rounded-md">
                            <FileText size={14} />
                        </span>
                        NỘI DUNG YÊU CẦU CHI TIẾT
                    </h3>
                    <AutoResizeTextarea
                        value={formData.content || formData.notes || ''}
                        onChange={e => {
                            handleChange('content', e.target.value);
                            handleChange('notes', e.target.value);
                        }}
                        className={`${inputClass} font-medium leading-relaxed`}
                        minRows={1}
                        placeholder="Nhập nội dung yêu cầu chi tiết của hồ sơ..."
                    />
                </div>

                {/* 5. GIẤY TỜ KÈM THEO (TOÀN KHUNG) */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                    <div className="flex justify-between items-center mb-2.5 border-b pb-2 border-slate-100">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                            <span className="p-1 bg-teal-100 text-teal-600 rounded-md"><FileText size={14} /></span> 
                            Giấy tờ kèm theo
                        </h3>
                        <button
                            type="button"
                            onClick={handleAddDoc}
                            className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-md border border-blue-200 hover:bg-blue-100 font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                        >
                            + THÊM GIẤY TỜ
                        </button>
                    </div>
                    
                    {attachedDocs.length === 0 ? (
                        <div className="text-center py-3 text-xs text-slate-400 italic bg-slate-50/80 rounded-lg border border-dashed border-slate-200">
                            Chưa có giấy tờ kèm theo nào. (Nhấn "+ THÊM GIẤY TỜ" để thêm)
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left border-collapse bg-white text-xs sm:text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-2 px-3 text-center w-10">#</th>
                                        <th className="py-2 px-3">TÊN GIẤY TỜ</th>
                                        <th className="py-2 px-3 w-36 text-center">HÌNH THỨC</th>
                                        <th className="py-2 px-3 w-10 text-center">XÓA</th>
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
                                                    className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100 cursor-pointer"
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

                {/* 6. THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN (NẾU CÓ - TOÀN KHUNG) */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
                    <div className="p-3.5 sm:p-4 flex items-center justify-between gap-2 bg-white rounded-xl">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                            <span className="p-1 bg-indigo-100 text-indigo-600 rounded-md"><Shield size={14} /></span>
                            Người ủy quyền (nếu có)
                        </h3>
                        <button
                            type="button"
                            onClick={() => setIsAuthOpen(!isAuthOpen)}
                            className="text-xs font-bold uppercase rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 py-1 text-slate-600 bg-white shadow-xs cursor-pointer"
                        >
                            {isAuthOpen ? '▲ ẨN' : '▼ HIỆN'}
                        </button>
                    </div>

                    {isAuthOpen && (
                        <div className="p-3.5 sm:p-4 bg-slate-50/50 space-y-3 animate-fade-in border-t border-slate-100 rounded-b-xl">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                    <label className={labelClass}>Họ và tên</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Họ tên người UQ..."
                                        value={formData.authorizedBy || ''}
                                        onChange={(e) => {
                                            handleChange('authorizedBy', e.target.value);
                                            handleChange('authorizedPersonName', e.target.value);
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Số điện thoại</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Số điện thoại..."
                                        value={authPhone}
                                        onChange={(e) => {
                                            setAuthPhone(e.target.value);
                                            handleChange('authorizedPersonPhone', e.target.value);
                                            setFormData(prev => ({ ...prev, authDocType: `${authCccd}|${authAddress}|${e.target.value}` }));
                                        }}
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
                                            handleChange('authorizedPersonId', e.target.value);
                                            setFormData(prev => ({ ...prev, authDocType: `${e.target.value}|${authAddress}|${authPhone}` }));
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Địa chỉ thường trú</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Địa chỉ thường trú..."
                                        value={authAddress}
                                        onChange={(e) => {
                                            setAuthAddress(e.target.value);
                                            handleChange('authorizedPersonAddress', e.target.value);
                                            setFormData(prev => ({ ...prev, authDocType: `${authCccd}|${e.target.value}|${authPhone}` }));
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        ) : (
            /* ================= GIAO DIỆN CHUẨN ĐỒNG BỘ CHO HỒ SƠ 1.x (LƯU TRỮ) VÀ 2.x (ĐO ĐẠC) ================= */
            <div className="space-y-3.5 sm:space-y-4">
                {/* 1. NGƯỜI NỘP HỒ SƠ HOẶC NƠI GỬI / NHẬN */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-3 flex items-center gap-1.5 border-b pb-2 border-slate-100">
                        <span className="p-1 bg-blue-100 text-blue-600 rounded-md">
                            <UserIcon size={14} />
                        </span> 
                        {isCongVan ? 'Thông tin nơi gửi / nhận' : 'THÔNG TIN NGƯỜI NỘP HỒ SƠ & CHỦ SỬ DỤNG'}
                    </h3>
                    
                    {isCongVan ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div>
                                <label className={labelClass}>Số, ký hiệu Công văn <span className="text-red-500">*</span></label>
                                <input type="text" required className={inputClass} placeholder="VD: 123/UBND-TH..." value={formData.customerName || ''} onChange={(e) => handleChange('customerName', e.target.value)} />
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className={labelClass}>Họ và tên / Chủ sử dụng <span className="text-red-500">*</span></label>
                                <input type="text" required className={inputClass} placeholder="Nguyễn Văn A..." value={formData.customerName || ''} onChange={(e) => handleChange('customerName', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>CCCD / Số Giấy</label>
                                <input type="text" className={`${inputClass} font-mono`} placeholder="0123456789..." value={formData.cccd || ''} onChange={(e) => handleChange('cccd', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Số điện thoại</label>
                                <input type="text" className={inputClass} placeholder="09xxxxxxxx..." value={formData.phoneNumber || ''} onChange={(e) => handleChange('phoneNumber', e.target.value)} />
                            </div>
                            <div className="md:col-span-3">
                                <label className={labelClass}>Địa chỉ thường trú / Nơi ở hiện nay</label>
                                <input type="text" className={inputClass} placeholder="Địa chỉ thường trú..." value={formData.customerAddress || ''} onChange={(e) => handleChange('customerAddress', e.target.value)} />
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. VỊ TRÍ, THỬA ĐẤT & GIẤY CHỨNG NHẬN HOẶC VĂN BẢN CÔNG VĂN */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-3 flex items-center gap-1.5 border-b pb-2 border-slate-100">
                        <span className="p-1 bg-green-100 text-green-600 rounded-md">
                            <MapPin size={14} />
                        </span> 
                        {isCongVan ? 'Văn bản Công văn' : 'VỊ TRÍ, THỬA ĐẤT & GIẤY CHỨNG NHẬN'}
                    </h3>
                    
                    {isCongVan ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div>
                                <label className={labelClass}>Cơ quan ban hành / Nơi gửi</label>
                                <input type="text" className={inputClass} placeholder="VD: UBND huyện, Tòa án..." value={formData.issueNumber || ''} onChange={(e) => handleChange('issueNumber', e.target.value)} />
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
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                    <label className={labelClass}>Xã / Phường <span className="text-red-500">*</span></label>
                                    <select required className={inputClass} value={formData.ward || ''} onChange={(e) => handleChange('ward', e.target.value)}>
                                        <option value="">-- Chọn xã / phường --</option>
                                        {wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Số phát hành</label>
                                    <input type="text" className={inputClass} placeholder="VD: CD 123456" value={formData.issueNumber || ''} onChange={(e) => handleChange('issueNumber', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}>Số vào sổ</label>
                                    <input type="text" className={inputClass} placeholder="VD: CH 01234" value={formData.entryNumber || ''} onChange={(e) => handleChange('entryNumber', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}>Ngày cấp</label>
                                    <input type="date" className={inputClass} value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value)} />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                    <label className={labelClass}>Tờ bản đồ</label>
                                    <input type="text" className={`${inputClass} text-center font-semibold`} placeholder="0" value={formData.mapSheet || ''} onChange={(e) => handleChange('mapSheet', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}>Thửa đất</label>
                                    <input type="text" className={`${inputClass} text-center font-semibold`} placeholder="0" value={formData.landPlot || ''} onChange={(e) => handleChange('landPlot', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}>Tổng diện tích (m²)</label>
                                    <input type="number" className={`${inputClass} text-center font-semibold`} placeholder="0" value={formData.area || ''} onChange={(e) => handleChange('area', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}>ONT/ODT (m²)</label>
                                    <input type="number" className={`${inputClass} text-center font-semibold`} placeholder="0" value={formData.residentialArea || ''} onChange={(e) => handleChange('residentialArea', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. NỘI DUNG YÊU CẦU / CHI TIẾT */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase mb-2 flex items-center gap-1.5 border-b pb-2 border-slate-100">
                        <span className="p-1 bg-orange-100 text-orange-600 rounded-md"><FileCheck size={14} /></span> 
                        {isCongVan ? 'Trích yếu nội dung công văn' : 'NỘI DUNG YÊU CẦU / CHI TIẾT'}
                    </h3>
                    
                    <div>
                        <AutoResizeTextarea
                            minRows={1}
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-xs sm:text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-medium text-slate-700 bg-white leading-relaxed"
                            value={formData.content || ''}
                            onChange={(e) => handleChange('content', e.target.value)}
                            placeholder={isCongVan ? "Nhập trích yếu nội dung công văn hành chính..." : "Nhập nội dung yêu cầu trích lục, đo đạc, cung cấp dữ liệu, ghi chú hồ sơ..."}
                        />
                    </div>
                </div>

                {/* 4. GIẤY TỜ KÈM THEO (TOÀN KHUNG) */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                    <div className="flex justify-between items-center mb-2.5 border-b pb-2 border-slate-100">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                            <span className="p-1 bg-teal-100 text-teal-600 rounded-md"><FileText size={14} /></span> 
                            {isCongVan ? 'Giấy tờ, văn bản kèm theo' : 'Giấy tờ kèm theo'}
                        </h3>
                        <button
                            type="button"
                            onClick={handleAddDoc}
                            className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-md border border-blue-200 hover:bg-blue-100 font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                        >
                            + THÊM GIẤY TỜ
                        </button>
                    </div>
                    
                    {attachedDocs.length === 0 ? (
                        <div className="text-center py-3 text-xs text-slate-400 italic bg-slate-50/80 rounded-lg border border-dashed border-slate-200">
                            Không có giấy tờ kèm theo nào. (Nhấn "+ THÊM GIẤY TỜ" để thêm)
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-left border-collapse bg-white text-xs sm:text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-2 px-3 text-center w-10">#</th>
                                        <th className="py-2 px-3">TÊN GIẤY TỜ</th>
                                        <th className="py-2 px-3 w-36 text-center">HÌNH THỨC</th>
                                        <th className="py-2 px-3 w-10 text-center">XÓA</th>
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
                                                    className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100 cursor-pointer"
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

                {/* 5. THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN (NẾU CÓ - TOÀN KHUNG) */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
                    <div className="p-3.5 sm:p-4 flex items-center justify-between gap-2 bg-white rounded-xl">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase flex items-center gap-1.5">
                            <span className="p-1 bg-indigo-100 text-indigo-600 rounded-md"><Shield size={14} /></span>
                            Người ủy quyền (nếu có)
                        </h3>
                        <button
                            type="button"
                            onClick={() => setIsAuthOpen(!isAuthOpen)}
                            className="text-xs font-bold uppercase rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 py-1 text-slate-600 bg-white shadow-xs cursor-pointer"
                        >
                            {isAuthOpen ? '▲ ẨN' : '▼ HIỆN'}
                        </button>
                    </div>

                    {isAuthOpen && (
                        <div className="p-3.5 sm:p-4 bg-slate-50/50 space-y-3 animate-fade-in border-t border-slate-100 rounded-b-xl">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                    <label className={labelClass}>Họ và tên</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Họ tên người UQ..."
                                        value={formData.authorizedBy || ''}
                                        onChange={(e) => {
                                            handleChange('authorizedBy', e.target.value);
                                            handleChange('authorizedPersonName', e.target.value);
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Số điện thoại</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Số điện thoại..."
                                        value={authPhone}
                                        onChange={(e) => {
                                            setAuthPhone(e.target.value);
                                            handleChange('authorizedPersonPhone', e.target.value);
                                            setFormData(prev => ({ ...prev, authDocType: `${authCccd}|${authAddress}|${e.target.value}` }));
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Số CCCD</label>
                                    <input
                                        type="text"
                                        className={`${inputClass} font-mono`}
                                        placeholder="Số CCCD..."
                                        value={authCccd}
                                        onChange={(e) => {
                                            setAuthCccd(e.target.value);
                                            handleChange('authorizedPersonId', e.target.value);
                                            setFormData(prev => ({ ...prev, authDocType: `${e.target.value}|${authAddress}|${authPhone}` }));
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Địa chỉ thường trú</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        placeholder="Địa chỉ thường trú..."
                                        value={authAddress}
                                        onChange={(e) => {
                                            setAuthAddress(e.target.value);
                                            handleChange('authorizedPersonAddress', e.target.value);
                                            setFormData(prev => ({ ...prev, authDocType: `${authCccd}|${e.target.value}|${authPhone}` }));
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* BUTTONS CỐ ĐỊNH STICKY DƯỚI CÙNG */}
        <div className="sticky bottom-0 left-0 right-0 z-20 bg-slate-50/95 backdrop-blur-md border-t border-slate-200 py-2.5 px-4 2xl:py-3.5 2xl:px-8 -mx-4 flex flex-col sm:flex-row justify-end gap-2.5 2xl:gap-4 shadow-md rounded-b-xl mt-3 2xl:mt-6">
            <button type="button" onClick={() => handleReset(false)} className="px-4 2xl:px-8 py-2 2xl:py-3 bg-white text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shadow-xs text-xs sm:text-sm 2xl:text-base font-bold border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer">
                {initialData ? <><XCircle size={16} className="text-red-500" /> Hủy</> : <><RotateCcw size={16} /> Làm mới</>}
            </button>
            <button type="submit" disabled={loading} className="px-6 2xl:px-10 py-2 2xl:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md text-xs sm:text-sm 2xl:text-base font-bold transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-1.5 cursor-pointer">
                <Save size={16} /> {loading ? 'Đang xử lý...' : (initialData ? 'CẬP NHẬT' : 'LƯU VÀ IN')}
            </button>
        </div>
    </form>
  );
};

export default RecordForm;
