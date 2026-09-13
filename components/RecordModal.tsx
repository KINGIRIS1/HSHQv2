
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole, AttachedDocItem, DossierComponentItem, AttachedFileMeta } from '../types';
import AutoResizeTextarea from './AutoResizeTextarea';
import { GROUPS, EXTENDED_RECORD_TYPES, STATUS_LABELS, SELECTABLE_STATUSES, ARCHIVE_SELECTABLE_STATUSES, SURVEY_SELECTABLE_STATUSES, getShortRecordType, getWardLabel, getNormalizedWard, isArchiveRecordType } from '../constants';
import { X, Save, Lock, User as UserIcon, MapPin, FileText, Calendar, FileCheck, ChevronDown, ChevronUp, Paperclip, Upload, Eye, Download, ExternalLink, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { calculateDeadlineHelper, getDepartmentForRecord, isProcedure2_3, syncRecordStatusTransition, getPureBatchNumber, groupEmployeesByDepartment, isFieldWorkProcedure, isOfficeOnlySurveyProcedure, deriveActualSurveyStatus, getDerivedStatusFromDates, cleanFutureMilestoneDates } from '../utils/appHelpers';
import { fetchContracts } from '../services/api';
import { processAndSaveSingleAttachment, previewAttachment, downloadAttachment, getGoogleDriveIncomingUrl, isAllowedDocFile } from '../services/attachmentStorage';
import DossierComponentSection from './receive-record/DossierComponentSection';

const parseAttachedDocs = (otherDocsStr: string | null | undefined): AttachedDocItem[] => {
    if (!otherDocsStr) return [];
    try {
        const parsed = JSON.parse(otherDocsStr);
        if (Array.isArray(parsed)) {
            return parsed.map((item: any, idx: number) => ({
                id: item.id || String(idx + 1),
                name: item.name || '',
                type: item.type === 'Bản sao' ? 'Bản sao' : 'Bản chính',
                original: typeof item.original === 'number' ? item.original : (item.type === 'Bản sao' ? 0 : 1),
                copy: typeof item.copy === 'number' ? item.copy : (item.type === 'Bản sao' ? 1 : 0),
                attachedFile: item.attachedFile || undefined
            }));
        }
    } catch (e) {
        const parts = otherDocsStr.split('|');
        if (parts[0]) {
            return [{
                id: '1',
                name: parts[0],
                type: parts[1] === 'Bản sao' ? 'Bản sao' : 'Bản chính',
                original: parts[1] === 'Bản sao' ? 0 : 1,
                copy: parts[1] === 'Bản sao' ? 1 : 0
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

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (record: Omit<RecordFile, 'id' | 'status'> & { id?: string, status?: RecordStatus }) => void;
  initialData?: RecordFile | null;
  employees: Employee[];
  currentUser: User;
  wards: string[];
  currentView?: string;
  holidays?: any[];
  records?: RecordFile[];
}

const generateRecordCode = (dateStr: string, recordsList: RecordFile[] = [], isArchive: boolean = false, recordType: string = '') => {
    const d = new Date(dateStr || new Date());
    const year = d.getFullYear().toString();
    const yy = year.slice(-2);
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const datePrefix = `${yy}${mm}${dd}`;

    const rType = (recordType || '').toLowerCase();
    const isLT = isArchive || rType.startsWith('1.') || rType.includes('1.1') || rType.includes('1.2') || rType.includes('sao lục') || rType.includes('công văn') || rType.includes('cung cấp') || rType.includes('lưu trữ');

    let maxSeq = 0;
    recordsList.forEach((r) => {
        if (!r.code) return;
        const cleanCode = r.code.startsWith('LT-') ? r.code.replace('LT-', '') : (r.code.startsWith('HQ-') ? r.code.replace('HQ-', '') : r.code);
        const parts = cleanCode.split('-');
        if (parts.length >= 2) {
            const rDate = parts[0];
            const rSeq = parts[1];
            if (rDate && rDate.substring(0, 2) === yy) {
                const seqNum = parseInt(rSeq, 10);
                if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
            }
        }
    });

    const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
    return isLT ? `LT-${datePrefix}-${nextSeq}` : `${datePrefix}-${nextSeq}`;
};

const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSubmit, initialData, employees, currentUser, wards, currentView, holidays, records }) => {
  const defaultState: Partial<RecordFile> = {
    code: '', customerName: '', phoneNumber: '', cccd: '', customerAddress: '', content: '', otherDocs: '',
    receivedDate: new Date().toISOString(), deadline: '', assignedTo: '', status: RecordStatus.RECEIVED,
    group: GROUPS[0], ward: '', landPlot: '', mapSheet: '', area: 0, address: '',
    recordType: '', measurementNumber: '', excerptNumber: '',
    issueNumber: '', entryNumber: '', issueDate: '',
    privateNotes: '', authorizedBy: '', authDocType: '', receiptNumber: '', resultReturnedDate: '', explanationPlan: ''
  };

  const [formData, setFormData] = useState<Partial<RecordFile>>(defaultState);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDocItem[]>([]);
  const [dossierComponents, setDossierComponents] = useState<DossierComponentItem[]>([]);
  const [uploadingDocIdx, setUploadingDocIdx] = useState<number | null>(null);
  const docFileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const [authCccd, setAuthCccd] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  const isEdit = !!initialData && !!initialData.id;
  const hasAdminRights = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN || currentUser.role === UserRole.TEAM_LEADER;
  const isOneDoor = currentUser.role === UserRole.ONEDOOR;
  const canEditResult = (hasAdminRights || isOneDoor) && isEdit;

  const isArchiveView = [
    "archive_records",
    "archive_assign_tasks",
    "archive_completed_list",
    "archive_pending_check_list",
    "archive_check_list",
    "archive_handover_list",
    "archive_director_completed",
  ].includes(currentView || "");

  const isMeasurementView = [
    "all_records",
    "assign_tasks",
    "completed_list",
    "pending_check_list",
    "check_list",
    "handover_list",
    "director_completed",
  ].includes(currentView || "");

  // Tất cả các thủ tục / loại hồ sơ khi nhập mới hoặc cập nhật
  let allowedRecordTypes: string[] = EXTENDED_RECORD_TYPES;

  const groupedEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return {};
    return groupEmployeesByDepartment(employees);
  }, [employees]);

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            const dataToSet = { ...initialData };
            const rLower = String(dataToSet.recordType || '').toLowerCase();
            if (!dataToSet.status) {
                dataToSet.status = RecordStatus.RECEIVED;
            }
            setFormData(dataToSet);
            setAttachedDocs(parseAttachedDocs(initialData.otherDocs));
            const initialComps: DossierComponentItem[] = (() => {
                if (!initialData.dossierComponents) return [];
                if (Array.isArray(initialData.dossierComponents)) return initialData.dossierComponents;
                if (typeof initialData.dossierComponents === 'string') {
                    try {
                        const parsed = JSON.parse(initialData.dossierComponents);
                        return Array.isArray(parsed) ? parsed : [];
                    } catch {
                        return [];
                    }
                }
                return [];
            })();
            setDossierComponents(initialComps);
            const parsed = parseAuthDocType(initialData.authDocType);
            setAuthCccd(parsed.cccd);
            setAuthAddress(parsed.address);
            setIsAuthOpen(!!(initialData.authorizedBy || parsed.cccd || parsed.address));

            // Tự động đồng bộ số tiền (returnedPrice) nếu chưa có giống như màn hình Chi tiết và Trả kết quả
            const determinePrice = async () => {
                if (dataToSet.returnedPrice !== undefined && dataToSet.returnedPrice !== null) {
                    return;
                }
                
                // 1. Kiểm tra price lưu sẵn
                if (dataToSet.price && dataToSet.price > 0) {
                    setFormData(prev => ({ ...prev, returnedPrice: dataToSet.price }));
                    return;
                }

                // 2. Tra cứu hợp đồng giống DetailModal
                try {
                    const fetchedContracts = await fetchContracts();
                    const match = fetchedContracts.find(c => {
                        if (!c) return false;
                        const cAddr = (c.customerAddress || '').trim().toLowerCase();
                        const cCode = (c.code || '').trim().toLowerCase();
                        const rCode = (dataToSet.code || '').trim().toLowerCase();
                        const cName = (c.customerName || '').trim().toLowerCase();
                        const rName = (dataToSet.customerName || '').trim().toLowerCase();
                        const cPlot = (c.landPlot || '').trim().toLowerCase();
                        const rPlot = (dataToSet.landPlot || '').trim().toLowerCase();
                        const cMap = (c.mapSheet || '').trim().toLowerCase();
                        const rMap = (dataToSet.mapSheet || '').trim().toLowerCase();

                        const clean = (str: string) => str.replace(/[^a-z0-9]/gi, '').toLowerCase();

                        if (rCode && (cAddr === rCode || cCode === rCode)) return true;
                        if (rCode && cCode && clean(rCode).length >= 3 && clean(rCode) === clean(cCode)) return true;
                        if (rCode && cAddr && clean(rCode).length >= 3 && clean(rCode) === clean(cAddr)) return true;
                        if (rName && cName && rName === cName) {
                            if (rPlot && cPlot && rPlot === cPlot) return true;
                            if (rMap && cMap && rMap === cMap) return true;
                        }
                        return false;
                    });
                    
                    if (match) {
                        const isLiquidated = Boolean(match.liquidationAmount && match.liquidationAmount > 0 && match.liquidationDate);
                        const priceVal = (isLiquidated ? match.liquidationAmount : match.totalAmount) ?? 0;
                        setFormData(prev => ({ ...prev, returnedPrice: priceVal }));
                        return;
                    }
                } catch (err) {
                    console.error("Error loading contract price in RecordModal:", err);
                }

                // 4. Nếu không có hợp đồng khớp, để undefined cho người dùng tự điền
            };
            determinePrice();
        } else {
            setFormData({
              ...defaultState,
              recordType: '',
              receivedDate: new Date().toISOString(),
              deadline: '',
              price: undefined,
              status: RecordStatus.RECEIVED,
              code: generateRecordCode(new Date().toISOString(), records, currentView === 'archive'),
              receivedBy: currentUser?.employeeId || ''
            });
            setAttachedDocs([]);
            setAuthCccd('');
            setAuthAddress('');
            setIsAuthOpen(false);
        }
    }
  }, [initialData, isOpen, currentView]);

  const handleAddDoc = () => {
      const nextNum = attachedDocs.length + 1;
      const newDoc: AttachedDocItem = {
          id: String(nextNum),
          name: '',
          type: 'Bản chính',
          original: 1,
          copy: 0
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
      const updatedDocs = filteredDocs.map((doc, idx) => ({
          ...doc,
          id: String(idx + 1)
      }));
      setAttachedDocs(updatedDocs);
      setFormData(prev => ({ ...prev, otherDocs: JSON.stringify(updatedDocs) }));
  };

  const handleAttachFileToDoc = async (index: number, file: File) => {
      if (!isAllowedDocFile(file)) {
          alert('Hệ thống đã bỏ hỗ trợ định dạng ảnh. Vui lòng tải lên tệp văn bản (PDF, Word, Excel, CAD...)');
          return;
      }
      try {
          setUploadingDocIdx(index);
          const targetDoc = attachedDocs[index];
          const docName = targetDoc?.name?.trim() || 'Giấy tờ kèm theo';
          const savedMeta = await processAndSaveSingleAttachment(
              file,
              formData.code || 'HS',
              docName,
              index + 1,
              'Bộ phận tiếp nhận',
              'Cập nhật hồ sơ'
          );
          const updatedDocs = attachedDocs.map((d, idx) => {
              if (idx === index) {
                  return { ...d, attachedFile: savedMeta };
              }
              return d;
          });
          setAttachedDocs(updatedDocs);
          setFormData(prev => ({
              ...prev,
              otherDocs: JSON.stringify(updatedDocs),
              attachedFiles: [...(prev.attachedFiles || []).filter(f => f.id !== savedMeta.id), savedMeta]
          }));
      } catch (err: any) {
          alert(err.message || 'Lỗi khi tải tệp đính kèm');
      } finally {
          setUploadingDocIdx(null);
      }
  };

  const handleRemoveDocFile = (index: number) => {
      const updatedDocs = attachedDocs.map((d, idx) => {
          if (idx === index) {
              return { ...d, attachedFile: undefined };
          }
          return d;
      });
      setAttachedDocs(updatedDocs);
      setFormData(prev => ({
          ...prev,
          otherDocs: JSON.stringify(updatedDocs)
      }));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.recordType || !formData.recordType.trim()) {
      alert("Vui lòng chọn loại hồ sơ / thủ tục trước khi lưu!");
      return;
    }
    let finalData: any = { ...formData };
    finalData.dossierComponents = dossierComponents;
    if (!finalData.receivedBy && currentUser) {
        finalData.receivedBy = currentUser.employeeId || currentUser.name || currentUser.username || '';
    }
    
    const isArchive = isArchiveRecordType(finalData.recordType || '') || ((finalData as any).department && String((finalData as any).department).toLowerCase().includes('lưu trữ'));

    if (finalData.exportBatch !== undefined && finalData.exportBatch !== null) {
        finalData.exportBatch = getPureBatchNumber(finalData.exportBatch) || undefined;
    }

    if (finalData.status === RecordStatus.WITHDRAWN && !finalData.completedDate) finalData.completedDate = new Date().toISOString();
    if (finalData.status === RecordStatus.REJECTED && !finalData.completedDate) finalData.completedDate = new Date().toISOString();

    // 1. Tự động kiểm tra và mở khóa:
    // Nếu trạng thái đang là RETURNED nhưng người dùng đã xóa resultReturnedDate
    // -> Tự động quay lùi trạng thái về mốc thời gian cao nhất còn lại (Bàn giao, Đã duyệt ký, Trình ký, ...)
    if (finalData.status === RecordStatus.RETURNED && (!finalData.resultReturnedDate || String(finalData.resultReturnedDate).trim() === '')) {
        finalData.status = getDerivedStatusFromDates(finalData, { isArchive });
    }

    // 2. Nếu có điền resultReturnedDate và không ở trạng thái hủy/từ chối -> Trạng thái là Đã trả kết quả
    if (finalData.resultReturnedDate && String(finalData.resultReturnedDate).trim() !== '' && finalData.status !== RecordStatus.WITHDRAWN && finalData.status !== RecordStatus.REJECTED) {
        finalData.status = RecordStatus.RETURNED;
        if (!finalData.completedDate) finalData.completedDate = finalData.resultReturnedDate;
    }

    const targetStatus = finalData.status || RecordStatus.RECEIVED;

    // 3. Dọn dẹp triệt để các mốc ngày và thông tin tương lai vượt quá targetStatus
    const cleanedMilestones = cleanFutureMilestoneDates(finalData, targetStatus);
    finalData = { ...finalData, ...cleanedMilestones };

    // 4. Áp dụng đồng bộ trạng thái trung tâm
    const syncedUpdates = syncRecordStatusTransition(initialData || {}, targetStatus, {
        userName: currentUser.name || currentUser.username || 'Hệ thống',
        userId: currentUser.id,
        customDates: {
            receivedDate: finalData.receivedDate,
            assignedDate: finalData.assignedDate,
            fieldAssignedDate: finalData.fieldAssignedDate,
            fieldCompletedDate: finalData.fieldCompletedDate,
            officeAssignedDate: finalData.officeAssignedDate,
            officeCompletedDate: finalData.officeCompletedDate,
            completedWorkDate: finalData.completedWorkDate,
            pendingCheckDate: finalData.pendingCheckDate,
            checkedDate: finalData.checkedDate,
            submissionDate: finalData.submissionDate,
            approvalDate: finalData.approvalDate,
            completedDate: finalData.completedDate,
            exportDate: finalData.exportDate,
            resultReturnedDate: finalData.resultReturnedDate
        },
        exportBatch: finalData.exportBatch,
        exportDate: finalData.exportDate,
        resultReturnedDate: finalData.resultReturnedDate,
        receiverName: finalData.receiverName,
        receiptNumber: finalData.receiptNumber,
        returnedPrice: finalData.returnedPrice
    });

    // 5. Gộp dữ liệu an toàn
    const mergedData: any = {
        ...syncedUpdates,
        ...finalData,
    };

    const dateFields = [
        'receivedDate',
        'assignedDate',
        'fieldAssignedDate',
        'fieldCompletedDate',
        'officeAssignedDate',
        'officeCompletedDate',
        'completedWorkDate',
        'pendingCheckDate',
        'checkedDate',
        'submissionDate',
        'approvalDate',
        'completedDate',
        'exportDate',
        'resultReturnedDate'
    ] as const;

    for (const df of dateFields) {
        if (cleanedMilestones[df] === null) {
            mergedData[df] = null;
        } else if (finalData[df] !== undefined && finalData[df] !== '') {
            mergedData[df] = finalData[df];
        } else if (syncedUpdates[df] !== undefined && syncedUpdates[df] !== '') {
            mergedData[df] = syncedUpdates[df];
        } else {
            mergedData[df] = null;
        }
    }

    // Nếu không có số biên lai / số hóa đơn, loại bỏ hoàn toàn số tiền thu
    const hasReceiptNumber = Boolean(finalData.receiptNumber && String(finalData.receiptNumber).trim() !== '');
    if (!hasReceiptNumber) {
        finalData.returnedPrice = undefined;
        finalData.receiptType = undefined;
    }

    const cleanData = JSON.parse(JSON.stringify(mergedData));
    if (!hasReceiptNumber) {
        cleanData.returnedPrice = undefined;
        cleanData.receiptType = undefined;
    }

    onSubmit(cleanData as any);
    onClose();
  };

  const handleChange = (field: keyof RecordFile, value: any) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value };
      
      if (field === 'status') {
        const newStatus = value as RecordStatus;
        const cleanedMilestones = cleanFutureMilestoneDates(prev, newStatus);
        
        const rollbackFields: Partial<RecordFile> = {};
        Object.keys(cleanedMilestones).forEach(k => {
            if ((cleanedMilestones as any)[k] === null) {
                (rollbackFields as any)[k] = '';
            }
        });

        const synced = syncRecordStatusTransition(prev, newStatus, {
          userName: currentUser.name || currentUser.username || 'Hệ thống',
          userId: currentUser.id,
          customDates: {
            receivedDate: prev.receivedDate,
            assignedDate: prev.assignedDate,
            fieldAssignedDate: prev.fieldAssignedDate,
            fieldCompletedDate: prev.fieldCompletedDate,
            officeAssignedDate: prev.officeAssignedDate,
            officeCompletedDate: prev.officeCompletedDate,
            completedWorkDate: prev.completedWorkDate,
            pendingCheckDate: prev.pendingCheckDate,
            checkedDate: prev.checkedDate,
            submissionDate: prev.submissionDate,
            approvalDate: prev.approvalDate,
            completedDate: prev.completedDate,
            exportDate: prev.exportDate,
            resultReturnedDate: prev.resultReturnedDate
          }
        });
        updated = { ...updated, ...synced, ...rollbackFields, status: newStatus };
      }

      // Tự động đồng bộ trạng thái khi thay đổi hoặc xóa các mốc ngày tháng
      const milestoneDateFields: (keyof RecordFile)[] = [
        'resultReturnedDate',
        'completedDate',
        'exportDate',
        'approvalDate',
        'submissionDate',
        'checkedDate',
        'pendingCheckDate',
        'completedWorkDate',
        'officeCompletedDate',
        'officeAssignedDate',
        'fieldCompletedDate',
        'fieldAssignedDate',
        'assignedDate'
      ];

      if (milestoneDateFields.includes(field)) {
        const isArchive = isArchiveRecordType(updated.recordType || '') || ((updated as any).department && String((updated as any).department).toLowerCase().includes('lưu trữ'));
        
        if (!value) {
            // Khi xóa mốc ngày: Tự động đưa về trạng thái ứng với mốc thời gian còn lại gần nhất
            if (updated.status !== RecordStatus.WITHDRAWN && updated.status !== RecordStatus.REJECTED) {
                const derivedStatus = getDerivedStatusFromDates(updated, { isArchive });
                updated.status = derivedStatus;
                const cleaned = cleanFutureMilestoneDates(updated, derivedStatus);
                Object.keys(cleaned).forEach(k => {
                    if ((cleaned as any)[k] === null) {
                        (updated as any)[k] = '';
                    }
                });
            }
        } else {
            // Khi điền hoặc chọn mốc ngày:
            if (field === 'resultReturnedDate') {
                if (updated.status !== RecordStatus.WITHDRAWN && updated.status !== RecordStatus.REJECTED) {
                    updated.status = RecordStatus.RETURNED;
                    if (!updated.completedDate) updated.completedDate = value;
                }
            } else if (field === 'completedDate' || field === 'exportDate') {
                if (updated.status !== RecordStatus.WITHDRAWN && updated.status !== RecordStatus.REJECTED && updated.status !== RecordStatus.RETURNED) {
                    updated.status = RecordStatus.HANDOVER;
                }
            } else if (field === 'approvalDate') {
                if (updated.status !== RecordStatus.WITHDRAWN && updated.status !== RecordStatus.REJECTED && updated.status !== RecordStatus.RETURNED && updated.status !== RecordStatus.HANDOVER) {
                    updated.status = RecordStatus.SIGNED;
                }
            } else if (field === 'submissionDate' || field === 'checkedDate') {
                if (updated.status !== RecordStatus.WITHDRAWN && updated.status !== RecordStatus.REJECTED && updated.status !== RecordStatus.RETURNED && updated.status !== RecordStatus.HANDOVER && updated.status !== RecordStatus.SIGNED) {
                    updated.status = RecordStatus.PENDING_SIGN;
                }
            } else if (field === 'pendingCheckDate') {
                if (updated.status !== RecordStatus.WITHDRAWN && updated.status !== RecordStatus.REJECTED && updated.status !== RecordStatus.RETURNED && updated.status !== RecordStatus.HANDOVER && updated.status !== RecordStatus.SIGNED && updated.status !== RecordStatus.PENDING_SIGN) {
                    updated.status = RecordStatus.PENDING_CHECK;
                }
            } else if (field === 'completedWorkDate') {
                if (updated.status === RecordStatus.RECEIVED || updated.status === RecordStatus.ASSIGNED || updated.status === RecordStatus.FIELD_WORK || updated.status === RecordStatus.OFFICE_WORK) {
                    updated.status = isArchive ? RecordStatus.ASSIGNED : RecordStatus.COMPLETED_WORK;
                }
            } else if (field === 'officeAssignedDate' || field === 'officeCompletedDate') {
                if (field === 'officeAssignedDate' && !updated.assignedDate) updated.assignedDate = value;
                if (updated.status === RecordStatus.RECEIVED || updated.status === RecordStatus.FIELD_WORK || updated.status === RecordStatus.ASSIGNED) {
                    updated.status = isArchive ? RecordStatus.ASSIGNED : RecordStatus.OFFICE_WORK;
                }
            } else if (field === 'fieldAssignedDate' || field === 'fieldCompletedDate') {
                if (field === 'fieldAssignedDate' && !updated.assignedDate) updated.assignedDate = value;
                if (updated.status === RecordStatus.RECEIVED) {
                    updated.status = isArchive ? RecordStatus.ASSIGNED : RecordStatus.FIELD_WORK;
                }
            } else if (field === 'assignedDate') {
                if (updated.status === RecordStatus.RECEIVED) {
                    if (isArchive) {
                        updated.status = RecordStatus.ASSIGNED;
                    } else if (isFieldWorkProcedure(updated.recordType || '')) {
                        updated.status = RecordStatus.FIELD_WORK;
                        if (!updated.fieldAssignedDate) updated.fieldAssignedDate = value;
                    } else if (isOfficeOnlySurveyProcedure(updated.recordType || '')) {
                        updated.status = RecordStatus.OFFICE_WORK;
                        if (!updated.officeAssignedDate) updated.officeAssignedDate = value;
                    } else {
                        updated.status = RecordStatus.FIELD_WORK;
                    }
                }
            }
        }
      }

      if (field === 'assignedTo') {
        if (value) {
          const emp = employees.find(e => e.id === value || e.name === value);
          const firstWard = emp?.managedWards?.[0];
          if (firstWard && !prev.ward) {
            updated.ward = firstWard;
          }
          if (!updated.assignedDate) {
            updated.assignedDate = new Date().toISOString().split('T')[0];
          }
          if (updated.status === RecordStatus.RECEIVED) {
            if (isArchiveRecordType(updated.recordType || '')) {
              updated.status = RecordStatus.ASSIGNED;
            } else if (isFieldWorkProcedure(updated.recordType || '')) {
              updated.status = RecordStatus.FIELD_WORK;
              if (!updated.fieldAssignedDate) updated.fieldAssignedDate = updated.assignedDate;
            } else if (isOfficeOnlySurveyProcedure(updated.recordType || '')) {
              updated.status = RecordStatus.OFFICE_WORK;
              if (!updated.officeAssignedDate) updated.officeAssignedDate = updated.assignedDate;
            } else {
              updated.status = RecordStatus.FIELD_WORK;
            }
          }
        }
      }
      if (updated.ward) {
        const norm = getNormalizedWard(updated.ward);
        if (GROUPS.includes(norm)) {
          updated.group = norm;
        }
      }
      if (field === 'recordType' || field === 'receivedDate') {
        const rType = field === 'recordType' ? value : prev.recordType;
        const rDate = field === 'receivedDate' ? value : prev.receivedDate;
        if (rType && rDate) {
          updated.deadline = calculateDeadlineHelper(rType, String(rDate).split('T')[0], holidays || []);
        } else if (!rType) {
          updated.deadline = '';
          updated.price = undefined;
          updated.returnedPrice = undefined;
        }
        if (field === 'recordType') {
          if (!initialData) {
            updated.code = generateRecordCode(String(rDate || new Date().toISOString()), records, currentView === 'archive', String(value || ''));
          }
          if (!value) {
            updated.price = undefined;
            updated.returnedPrice = undefined;
          }
        }
      }
      return updated;
    });
  };
  const val = (v: any) => v === undefined || v === null ? '' : v;
  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const isArchive = isArchiveRecordType(formData.recordType || '') || (getDepartmentForRecord(formData as RecordFile).toLowerCase().includes('lưu trữ'));
  const isCongVan = formData.recordType ? getShortRecordType(formData.recordType) === '1.2 Công văn' : false;
  const recTypeLower = (formData.recordType || '').toLowerCase();
  const showMsr = !isArchive && (recTypeLower.includes('trích đo') || recTypeLower.includes('đo đạc') || recTypeLower.includes('đo') || recTypeLower.includes('tách thửa') || (!recTypeLower.includes('trích đo') && !recTypeLower.includes('trích lục')));
  const showExc = !isArchive && (recTypeLower.includes('trích lục') || (!recTypeLower.includes('trích đo') && !recTypeLower.includes('trích lục')));

  const statusSelectOptions = isArchive
    ? ARCHIVE_SELECTABLE_STATUSES
    : SURVEY_SELECTABLE_STATUSES.filter(item => item.key !== RecordStatus.IN_PROGRESS);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-0 md:p-4 backdrop-blur-sm">
      <div className="bg-white md:rounded-xl shadow-2xl w-full max-w-4xl h-full md:max-h-[95vh] flex flex-col animate-fade-in-up">
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 md:p-5 border-b bg-gray-50 rounded-t-none md:rounded-t-xl shrink-0">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 truncate pr-2">
            {initialData ? 'Cập nhật thông tin hồ sơ' : 'Tiếp nhận hồ sơ mới'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-gray-200">
            <X size={24} />
          </button>
        </div>
        
        {/* BODY - SCROLLABLE */}
        <div className="overflow-y-auto p-4 md:p-6 flex-1 bg-gray-100">
            <form id="record-form" onSubmit={handleSubmit} className="space-y-6">
                {/* 1. THÔNG TIN CHUNG */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2"><Calendar size={16} /> Thông tin chung</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Mã hồ sơ <span className="text-red-500">*</span></label>
                            <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-bold text-blue-700" value={val(formData.code)} onChange={(e) => handleChange('code', e.target.value)} />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                Loại hồ sơ <span className="text-red-500">*</span>
                            </label>
                            <select 
                                required
                                className={`w-full border rounded-md px-3 py-2 bg-white ${!formData.recordType ? 'border-amber-400 bg-amber-50/40 text-amber-900 font-semibold ring-1 ring-amber-300' : 'border-gray-300'}`} 
                                value={formData.recordType ? getShortRecordType(formData.recordType) : ''} 
                                onChange={(e) => handleChange('recordType', e.target.value)}
                            >
                                <option value="">-- Chọn loại hồ sơ / thủ tục --</option>
                                {allowedRecordTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            {!formData.recordType && (
                                <p className="text-[11px] text-amber-600 mt-1 font-medium">* Bắt buộc chọn loại hồ sơ để kích hoạt chức năng lưu</p>
                            )}
                        </div>
                        {hasAdminRights ? (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái</label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-yellow-50 font-medium" 
                                        value={val(formData.status)} 
                                        onChange={(e) => handleChange('status', e.target.value)}
                                    >
                                        {/* Nếu trạng thái hiện tại là trạng thái cũ hoặc không nằm trong danh mục chuẩn, hiển thị để tránh bị tự nhảy về Tiếp nhận mới */}
                                        {formData.status && !statusSelectOptions.some(item => item.key === formData.status) && (
                                            <option value={formData.status}>
                                                {STATUS_LABELS[formData.status as RecordStatus] || formData.status} (Chưa chuẩn hóa - Vui lòng chọn lại)
                                            </option>
                                        )}
                                        {statusSelectOptions.map(item => (
                                            <option key={item.key} value={item.key}>{item.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày nhận</label><input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value)} /></div>
                                {!isCongVan && (
                                    <div><label className="block text-xs font-bold text-gray-700 mb-1">Hẹn trả <span className="text-red-500">*</span></label><input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-semibold text-red-600 bg-red-50" value={dateVal(formData.deadline)} onChange={(e) => handleChange('deadline', e.target.value)} /></div>
                                )}
                                {(() => {
                                    const statusFlow = [
                                        RecordStatus.RECEIVED,
                                        RecordStatus.FIELD_WORK,
                                        RecordStatus.OFFICE_WORK,
                                        RecordStatus.ASSIGNED,
                                        RecordStatus.IN_PROGRESS,
                                        RecordStatus.COMPLETED_WORK,
                                        RecordStatus.PENDING_CHECK,
                                        RecordStatus.PENDING_SIGN,
                                        RecordStatus.SIGNED,
                                        RecordStatus.HANDOVER,
                                        RecordStatus.RETURNED
                                    ];
                                    const currentIdx = formData.status ? statusFlow.indexOf(formData.status) : -1;
                                    const isFieldWork = isFieldWorkProcedure(formData.recordType);
                                    const isOfficeOnly = isOfficeOnlySurveyProcedure(formData.recordType);
                                    const hasAssigned = true; // Luôn hiển thị ô Ngày giao NV / Ngày đo đạc / Ngày Biên tập cho tất cả hồ sơ kể cả tiếp nhận mới
                                    const hasPendingCheck = !isArchive && (currentIdx >= statusFlow.indexOf(RecordStatus.PENDING_CHECK) || !!formData.pendingCheckDate || !!formData.checkedDate);
                                    const hasSubmission = currentIdx >= statusFlow.indexOf(RecordStatus.PENDING_SIGN) || !!formData.submissionDate;
                                    const hasApproval = currentIdx >= statusFlow.indexOf(RecordStatus.SIGNED) || !!formData.approvalDate;
                                    const hasHandover = currentIdx >= statusFlow.indexOf(RecordStatus.HANDOVER) || formData.status === RecordStatus.WITHDRAWN || formData.status === RecordStatus.REJECTED || !!formData.completedDate;
                                    const assignedLabel = isFieldWork ? 'Ngày đo đạc' : isOfficeOnly ? 'Ngày Biên tập' : 'Ngày giao NV';

                                    return (
                                        <>
                                            {hasAssigned && (
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">{assignedLabel}</label>
                                                    <input 
                                                        type="date" 
                                                        className="w-full border border-gray-300 rounded-md px-3 py-2" 
                                                        value={dateVal(isFieldWork ? (formData.fieldAssignedDate || formData.assignedDate) : isOfficeOnly ? (formData.officeAssignedDate || formData.assignedDate) : formData.assignedDate)} 
                                                        onChange={(e) => {
                                                            if (isFieldWork) {
                                                                handleChange('fieldAssignedDate', e.target.value);
                                                            } else if (isOfficeOnly) {
                                                                handleChange('officeAssignedDate', e.target.value);
                                                            } else {
                                                                handleChange('assignedDate', e.target.value);
                                                            }
                                                        }} 
                                                    />
                                                </div>
                                            )}
                                            {isFieldWork && (currentIdx >= statusFlow.indexOf(RecordStatus.OFFICE_WORK) || hasPendingCheck || !!formData.officeAssignedDate || !!formData.officeCompletedDate) && (
                                                <div>
                                                    <label className="block text-xs font-bold text-indigo-700 mb-1">Ngày Biên tập</label>
                                                    <input 
                                                        type="date" 
                                                        className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-indigo-50/30 text-indigo-800" 
                                                        value={dateVal(formData.officeAssignedDate || formData.officeCompletedDate)} 
                                                        onChange={(e) => {
                                                            handleChange('officeAssignedDate', e.target.value);
                                                        }} 
                                                    />
                                                </div>
                                            )}
                                            {hasPendingCheck && (
                                                <div><label className="block text-xs font-bold text-blue-700 mb-1">Ngày trình kiểm tra</label><input type="date" className="w-full border border-blue-300 rounded-md px-3 py-2 bg-blue-50/50 text-blue-800" value={dateVal(formData.pendingCheckDate)} onChange={(e) => handleChange('pendingCheckDate', e.target.value)} /></div>
                                            )}
                                            {hasSubmission && (
                                                <div><label className="block text-xs font-bold text-purple-700 mb-1">Ngày trình ký</label><input type="date" className="w-full border border-purple-300 rounded-md px-3 py-2 bg-purple-50/50 text-purple-800" value={dateVal(formData.submissionDate)} onChange={(e) => handleChange('submissionDate', e.target.value)} /></div>
                                            )}
                                            {hasApproval && (
                                                <div><label className="block text-xs font-bold text-indigo-700 mb-1">Ngày ký duyệt</label><input type="date" className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-indigo-50/50 text-indigo-800" value={dateVal(formData.approvalDate)} onChange={(e) => handleChange('approvalDate', e.target.value)} /></div>
                                            )}
                                            {hasHandover && (
                                                <div>
                                                    <label className="block text-xs font-bold text-green-700 mb-1">
                                                        {formData.status === RecordStatus.WITHDRAWN ? 'Ngày rút hồ sơ' : formData.status === RecordStatus.REJECTED ? 'Ngày trả hồ sơ' : 'Ngày hoàn thành (Giao 1 cửa)'}
                                                     </label>
                                                    <input type="date" className="w-full border border-green-300 rounded-md px-3 py-2 bg-green-50/50 font-semibold text-green-800" value={dateVal(formData.completedDate)} onChange={(e) => handleChange('completedDate', e.target.value)} />
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Trạng thái</label>
                                    <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700">
                                        {STATUS_LABELS[formData.status as RecordStatus] || SELECTABLE_STATUSES.find(s => s.key === formData.status)?.label || formData.status || 'Chưa xác định'}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Ngày nhận</label>
                                    <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700">
                                        {formData.receivedDate ? formatDate(formData.receivedDate) : '--'}
                                    </div>
                                </div>
                                {!isCongVan && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Hẹn trả</label>
                                        <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-sm font-semibold text-red-600">
                                            {formData.deadline ? formatDate(formData.deadline) : '--'}
                                        </div>
                                    </div>
                                )}
                                {(formData.assignedDate || formData.fieldAssignedDate) && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">
                                            {isFieldWorkProcedure(formData.recordType) ? 'Ngày đo đạc' : isOfficeOnlySurveyProcedure(formData.recordType) ? 'Ngày Biên tập' : 'Ngày giao NV'}
                                        </label>
                                        <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-700">
                                            {formatDate(formData.assignedDate || formData.fieldAssignedDate)}
                                        </div>
                                    </div>
                                )}
                                {isFieldWorkProcedure(formData.recordType) && (formData.officeAssignedDate || formData.officeCompletedDate) && (
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-700 mb-1">Ngày Biên tập</label>
                                        <div className="w-full border border-indigo-100 rounded-md px-3 py-2 bg-indigo-50/50 text-sm font-semibold text-indigo-800">
                                            {formatDate(formData.officeAssignedDate || formData.officeCompletedDate)}
                                        </div>
                                    </div>
                                )}
                                {formData.pendingCheckDate && (
                                    <div>
                                        <label className="block text-xs font-bold text-blue-700 mb-1">Ngày trình kiểm tra</label>
                                        <div className="w-full border border-blue-100 rounded-md px-3 py-2 bg-blue-50/50 text-sm font-semibold text-blue-800">
                                            {formatDate(formData.pendingCheckDate)}
                                        </div>
                                    </div>
                                )}
                                {formData.submissionDate && (
                                    <div>
                                        <label className="block text-xs font-bold text-purple-700 mb-1">Ngày trình ký</label>
                                        <div className="w-full border border-purple-100 rounded-md px-3 py-2 bg-purple-50/50 text-sm font-semibold text-purple-800">
                                            {formatDate(formData.submissionDate)}
                                        </div>
                                    </div>
                                )}
                                {formData.approvalDate && (
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-700 mb-1">Ngày ký duyệt</label>
                                        <div className="w-full border border-indigo-100 rounded-md px-3 py-2 bg-indigo-50/50 text-sm font-semibold text-indigo-800">
                                            {formatDate(formData.approvalDate)}
                                        </div>
                                    </div>
                                )}
                                {formData.completedDate && (
                                    <div>
                                        <label className="block text-xs font-bold text-green-700 mb-1">
                                            {formData.status === RecordStatus.WITHDRAWN ? 'Ngày rút hồ sơ' : formData.status === RecordStatus.REJECTED ? 'Ngày trả hồ sơ' : 'Ngày hoàn thành (Giao 1 cửa)'}
                                        </label>
                                        <div className="w-full border border-green-100 rounded-md px-3 py-2 bg-green-50/50 text-sm font-semibold text-green-800">
                                            {formatDate(formData.completedDate)}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* 2. CHỦ SỬ DỤNG HOẶC THÔNG TIN GỬI NHẬN */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                        <UserIcon size={16} /> {isCongVan ? 'Thông tin gửi / nhận' : 'Chủ sử dụng'}
                    </h3>
                    {isCongVan ? (
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Số, ký hiệu Công văn <span className="text-red-500">*</span></label>
                                <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-medium" value={val(formData.customerName)} onChange={(e) => handleChange('customerName', e.target.value)} placeholder="VD: 123/UBND-TH..." />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Tên chủ sử dụng <span className="text-red-500">*</span></label><input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-medium" value={val(formData.customerName)} onChange={(e) => handleChange('customerName', e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Số điện thoại</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.phoneNumber)} onChange={(e) => handleChange('phoneNumber', e.target.value)} /></div>
                            <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Địa chỉ chủ sử dụng</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.customerAddress)} onChange={(e) => handleChange('customerAddress', e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">CCCD</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.cccd)} onChange={(e) => handleChange('cccd', e.target.value)} /></div>
                        </div>
                    )}
                </div>

                {/* 3. Vị Trí & Thửa Đất HOẶC VĂN BẢN CÔNG VĂN */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                        <MapPin size={16} /> {isCongVan ? 'Văn bản Công văn' : 'Vị trí & Thửa đất'}
                    </h3>
                    {isCongVan ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Cơ quan ban hành / Nơi gửi</label>
                                <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.issueNumber)} onChange={(e) => handleChange('issueNumber', e.target.value)} placeholder="VD: UBND huyện, Tòa án..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Ngày Công văn</label>
                                <input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Xã / Phường liên quan</label>
                                <select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" value={val(formData.ward)} onChange={(e) => handleChange('ward', e.target.value)}>
                                    <option value="">-- Chọn Xã/Phường --</option>
                                    {wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-700 mb-1">Xã / Phường</label>
                                <select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" value={val(formData.ward)} onChange={(e) => handleChange('ward', e.target.value)}>
                                    <option value="">-- Chọn Xã/Phường --</option>
                                    {wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Tờ bản đồ</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.mapSheet)} onChange={(e) => handleChange('mapSheet', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Thửa đất</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.landPlot)} onChange={(e) => handleChange('landPlot', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Diện tích (m2)</label><input type="number" className="w-full border border-gray-300 rounded-md px-3 py-2 text-right" value={formData.area || 0} onChange={(e) => handleChange('area', parseFloat(e.target.value))} /></div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Số phát hành</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="VD: CD 123456" value={val(formData.issueNumber)} onChange={(e) => handleChange('issueNumber', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Số vào sổ</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="VD: CH 01234" value={val(formData.entryNumber)} onChange={(e) => handleChange('entryNumber', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày cấp</label><input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.issueDate)} onChange={(e) => handleChange('issueDate', e.target.value)} /></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. NỘI DUNG & KỸ THUẬT */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                        <FileText size={16} /> {isCongVan ? 'Nội dung Công văn & Xử lý' : 'Nội dung & Kỹ thuật'}
                    </h3>
                    <div className="space-y-4">
                        <div className="flex flex-col gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1.5">{isCongVan ? 'Trích yếu nội dung công văn' : 'Nội dung yêu cầu'}</label>
                                <AutoResizeTextarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none" value={val(formData.content)} onChange={(e) => handleChange('content', e.target.value)} placeholder={isCongVan ? 'Nhập trích yếu nội dung công văn...' : ''} />
                            </div>
                            
                            {/* Dynamic Attached Documents List */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-bold text-gray-700">{isCongVan ? 'Giấy tờ, văn bản kèm theo' : 'Giấy tờ kèm theo'}</label>
                                    <button
                                        type="button"
                                        onClick={handleAddDoc}
                                        className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md border border-blue-200 hover:bg-blue-100 font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                                    >
                                        <Plus size={13} />
                                        Thêm mới
                                    </button>
                                </div>
                                
                                {attachedDocs.length === 0 ? (
                                    <div className="text-center py-5 text-xs text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                        Không có giấy tờ kèm theo. Bấm nút Thêm mới để thêm.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-56 overflow-y-auto">
                                        <table className="w-full text-left border-collapse bg-white">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                                    <th className="py-2 px-2 text-center w-8">#</th>
                                                    <th className="py-2 px-2">Tên giấy tờ</th>
                                                    <th className="py-2 px-2 w-28 text-center">Hình thức</th>
                                                    <th className="py-2 px-2 w-28 text-center">Tệp đính kèm</th>
                                                    <th className="py-2 px-2 w-8 text-center">Xóa</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs">
                                                {attachedDocs.map((doc, idx) => (
                                                    <tr key={doc.id} className="hover:bg-slate-50/50">
                                                        <td className="py-1 px-2 text-center font-bold text-slate-400">{idx + 1}</td>
                                                        <td className="py-1 px-2">
                                                            <input
                                                                type="text"
                                                                required
                                                                className="w-full px-1.5 py-1 text-xs border border-slate-200 rounded outline-none focus:border-blue-500"
                                                                placeholder="Nhập tên..."
                                                                value={doc.name}
                                                                onChange={(e) => handleUpdateDoc(idx, 'name', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="py-1 px-2">
                                                            <div className="flex items-center justify-center gap-2 text-[10px]">
                                                                <label className="flex items-center gap-0.5 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        name={`modal-docType-${doc.id}`}
                                                                        value="Bản chính"
                                                                        checked={doc.type === 'Bản chính'}
                                                                        onChange={() => handleUpdateDoc(idx, 'type', 'Bản chính')}
                                                                    />
                                                                    Chính
                                                                </label>
                                                                <label className="flex items-center gap-0.5 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        name={`modal-docType-${doc.id}`}
                                                                        value="Bản sao"
                                                                        checked={doc.type === 'Bản sao'}
                                                                        onChange={() => handleUpdateDoc(idx, 'type', 'Bản sao')}
                                                                    />
                                                                    Sao
                                                                </label>
                                                            </div>
                                                        </td>
                                                        <td className="py-1 px-2 text-center">
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dgn,.txt,.zip,.rar,.7z"
                                                                ref={(el) => (docFileInputRefs.current[idx] = el)}
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) handleAttachFileToDoc(idx, file);
                                                                    e.target.value = '';
                                                                }}
                                                            />
                                                            {doc.attachedFile ? (
                                                                <div className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
                                                                    <button
                                                                        type="button"
                                                                        title={`Xem tệp: ${doc.attachedFile.fileName}`}
                                                                        onClick={() => previewAttachment(doc.attachedFile!)}
                                                                        className="p-0.5 text-emerald-700 hover:text-emerald-900 rounded cursor-pointer"
                                                                    >
                                                                        <CheckCircle2 size={12} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        title={`Xem trước (${doc.attachedFile.fileName})`}
                                                                        onClick={() => previewAttachment(doc.attachedFile!)}
                                                                        className="p-0.5 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                                                                    >
                                                                        <Eye size={12} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        title="Tải về"
                                                                        onClick={() => downloadAttachment(doc.attachedFile!)}
                                                                        className="p-0.5 text-slate-500 hover:text-emerald-700 rounded cursor-pointer"
                                                                    >
                                                                        <Download size={12} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        title="Gỡ tệp"
                                                                        onClick={() => handleRemoveDocFile(idx)}
                                                                        className="p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => docFileInputRefs.current[idx]?.click()}
                                                                    disabled={uploadingDocIdx === idx}
                                                                    title="Đính kèm tệp"
                                                                    className="p-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200 transition-all cursor-pointer inline-flex items-center justify-center disabled:opacity-50"
                                                                >
                                                                    {uploadingDocIdx === idx ? (
                                                                        <Loader2 size={12} className="animate-spin text-blue-600" />
                                                                    ) : (
                                                                        <Paperclip size={12} />
                                                                    )}
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="py-1 px-2 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteDoc(idx)}
                                                                className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* THÀNH PHẦN HỒ SƠ */}
                            <div className="mt-3">
                                <DossierComponentSection
                                    recordCode={formData.code || 'HS'}
                                    department={getDepartmentForRecord(formData) || 'Bộ phận tiếp nhận'}
                                    stage="Cập nhật hồ sơ"
                                    components={dossierComponents}
                                    onChange={(newComps) => {
                                        setDossierComponents(newComps);
                                        setFormData(prev => ({ ...prev, dossierComponents: newComps }));
                                    }}
                                    title="Thành phần hồ sơ"
                                />
                            </div>

                            {/* ĐƯỜNG DẪN GOOGLE DRIVE LƯU DỮ LIỆU */}
                            {getGoogleDriveIncomingUrl() && (
                                <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs mt-2">
                                    <div className="flex items-center gap-2 text-blue-800">
                                        <ExternalLink size={14} className="text-blue-600 shrink-0" />
                                        <span>Đường dẫn lưu dữ liệu tiếp nhận (Google Drive):</span>
                                    </div>
                                    <a 
                                        href={getGoogleDriveIncomingUrl()} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                                    >
                                        Mở Google Drive →
                                    </a>
                                </div>
                            )}

                            {/* THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN (NẾU CÓ) */}
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                <div 
                                    onClick={() => setIsAuthOpen(!isAuthOpen)}
                                    className="p-4 flex items-center justify-between gap-4 border-b border-gray-100 bg-gray-50/50 cursor-pointer hover:bg-gray-100/80 select-none"
                                >
                                    <h3 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-2">
                                        <UserIcon size={14} className="text-indigo-600" />
                                        Thông tin người được ủy quyền (nếu có)
                                    </h3>
                                    <button
                                        type="button"
                                        className="flex items-center gap-1 text-[10px] font-bold uppercase rounded border border-gray-300 px-2 py-1 text-gray-600 bg-gray-50 shadow-sm pointer-events-none"
                                    >
                                        {isAuthOpen ? '▲ ẨN NHẬP LIỆU' : '▼ HIỆN NHẬP LIỆU'}
                                    </button>
                                </div>

                                {isAuthOpen && (
                                    <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-100">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Họ và tên</label>
                                            <input
                                                type="text"
                                                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                                placeholder="Họ tên..."
                                                value={formData.authorizedBy || ''}
                                                onChange={(e) => handleChange('authorizedBy', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Số CCCD</label>
                                            <input
                                                type="text"
                                                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                                placeholder="Số CCCD..."
                                                value={authCccd}
                                                onChange={(e) => {
                                                    setAuthCccd(e.target.value);
                                                    setFormData(prev => ({ ...prev, authDocType: `${e.target.value}|${authAddress}` }));
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Địa chỉ</label>
                                            <input
                                                type="text"
                                                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                                                placeholder="Địa chỉ..."
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

                            {/* CÁN BỘ PHỤ TRÁCH / GIAO XỬ LÝ THEO ĐÚNG TIẾN ĐỘ & TRẠNG THÁI HIỆN TẠI */}
                            {(() => {
                                const currentStaffBinding = (() => {
                                    switch (formData.status) {
                                        case RecordStatus.RECEIVED:
                                            return {
                                                stageTitle: 'Bước Tiếp nhận',
                                                label: 'Cán bộ Tiếp nhận hồ sơ',
                                                field: 'receivedBy' as const,
                                                value: formData.receivedBy || formData.assignedTo || '',
                                                dateLabel: 'Ngày nhận',
                                                dateValue: formData.receivedDate
                                            };
                                        case RecordStatus.FIELD_WORK:
                                            return {
                                                stageTitle: 'Bước Đo đạc thực địa',
                                                label: 'Cán bộ Đo đạc thực địa (Ngoại nghiệp)',
                                                field: 'surveyorId' as const,
                                                value: formData.surveyorId || formData.assignedTo || '',
                                                dateLabel: 'Ngày giao đo',
                                                dateValue: formData.fieldAssignedDate || formData.surveyAssignedDate
                                            };
                                        case RecordStatus.OFFICE_WORK:
                                            return {
                                                stageTitle: 'Bước Biên tập bản đồ',
                                                label: 'Cán bộ Biên tập bản đồ (Nội nghiệp)',
                                                field: 'drafterId' as const,
                                                value: formData.drafterId || formData.assignedTo || '',
                                                dateLabel: 'Ngày giao biên tập',
                                                dateValue: formData.officeAssignedDate
                                            };
                                        case RecordStatus.PENDING_CHECK:
                                            return {
                                                stageTitle: 'Bước Chờ kiểm tra',
                                                label: 'Cán bộ Kiểm tra hồ sơ',
                                                field: 'checkedBy' as const,
                                                value: formData.checkedBy || formData.assignedTo || '',
                                                dateLabel: 'Ngày kiểm tra',
                                                dateValue: formData.checkedDate || formData.pendingCheckDate
                                            };
                                        case RecordStatus.PENDING_SIGN:
                                        case RecordStatus.SIGNED:
                                            return {
                                                stageTitle: formData.status === RecordStatus.SIGNED ? 'Bước Đã ký duyệt' : 'Bước Trình ký',
                                                label: 'Lãnh đạo Ký duyệt hồ sơ',
                                                field: 'submittedTo' as const,
                                                value: formData.submittedTo || formData.assignedTo || '',
                                                dateLabel: 'Ngày ký duyệt',
                                                dateValue: formData.approvalDate || formData.submissionDate
                                            };
                                        case RecordStatus.HANDOVER:
                                        case RecordStatus.RETURNED:
                                            return {
                                                stageTitle: formData.status === RecordStatus.RETURNED ? 'Bước Đã trả kết quả' : 'Bước Giao 1 cửa',
                                                label: 'Cán bộ Bàn giao / Trả kết quả',
                                                field: 'returnedBy' as const,
                                                value: formData.returnedBy || formData.assignedTo || '',
                                                dateLabel: 'Ngày trả kết quả',
                                                dateValue: formData.resultReturnedDate || formData.exportDate
                                            };
                                        default:
                                            return {
                                                stageTitle: 'Phân công thụ lý',
                                                label: 'Cán bộ thụ lý / Được giao xử lý',
                                                field: 'assignedTo' as const,
                                                value: formData.assignedTo || formData.receivedBy || '',
                                                dateLabel: 'Ngày phân công',
                                                dateValue: formData.assignedDate
                                            };
                                    }
                                })();

                                const handleStaffSelectChange = (newEmpId: string) => {
                                    const { field } = currentStaffBinding;
                                    handleChange(field, newEmpId);
                                    if (field === 'surveyorId' || field === 'drafterId' || field === 'assignedTo' || field === 'receivedBy') {
                                        handleChange('assignedTo', newEmpId);
                                    }
                                };

                                const currentEmp = employees.find(e => e.id === currentStaffBinding.value || e.name === currentStaffBinding.value);
                                const currentEmpDisplay = currentEmp ? `${currentEmp.name} (${currentEmp.position || currentEmp.department || 'Cán bộ'})` : (currentStaffBinding.value || 'Chưa phân công');

                                return (
                                    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                                        <label className="block text-xs font-bold text-gray-700 uppercase mb-2 flex flex-wrap items-center justify-between gap-2">
                                            <span className="flex items-center gap-2">
                                                <UserIcon size={14} className="text-indigo-600" />
                                                {currentStaffBinding.label}
                                            </span>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[11px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                                    {currentStaffBinding.stageTitle}
                                                </span>
                                                {currentStaffBinding.dateValue && (
                                                    <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                        {currentStaffBinding.dateLabel}: {dateVal(currentStaffBinding.dateValue)}
                                                    </span>
                                                )}
                                            </div>
                                        </label>
                                        {hasAdminRights ? (
                                            <select
                                                id="record-assignedTo-select"
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white text-sm font-medium text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-xs"
                                                value={currentEmp ? currentEmp.id : (currentStaffBinding.value || '')}
                                                onChange={(e) => handleStaffSelectChange(e.target.value)}
                                            >
                                                <option value="">-- Chưa giao / Chọn cán bộ phụ trách ({currentStaffBinding.stageTitle}) --</option>
                                                {Object.entries(groupedEmployees).map(([dept, emps]) => (
                                                    <optgroup key={dept} label={dept}>
                                                        {emps.map(emp => (
                                                            <option key={emp.id} value={emp.id}>
                                                                {emp.name} ({emp.position || 'Cán bộ'})
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="w-full border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-sm font-semibold text-indigo-800">
                                                {currentEmpDisplay}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* THÔNG TIN TRẢ KẾT QUẢ & THU PHÍ (ĐẶT TRÊN GHI CHÚ NỘI BỘ) */}
                        {isEdit && (canEditResult || hasAdminRights) && (
                            <div className="bg-emerald-50/70 p-4 rounded-lg border border-emerald-200 shadow-sm">
                                <h4 className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-2 mb-3">
                                    <FileCheck size={16} className="text-emerald-600" />
                                    <span>Thông tin Trả kết quả & Biên lai / Hóa đơn</span>
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-800 mb-1">
                                            Ngày trả kết quả
                                        </label>
                                        <input 
                                            type="date" 
                                            className="w-full border border-emerald-300 rounded-md px-3 py-2 bg-white font-bold text-emerald-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                                            value={dateVal(formData.resultReturnedDate)} 
                                            onChange={(e) => handleChange('resultReturnedDate', e.target.value)} 
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-bold text-emerald-800">
                                                {formData.receiptType === 'Biên Lai' ? 'Số Biên lai' : formData.receiptType === 'Hóa Đơn' ? 'Số Hóa đơn' : 'Số Biên lai / Hóa đơn'}
                                            </label>
                                            <div className="flex items-center gap-2 text-[10px]">
                                                <button
                                                    type="button"
                                                    onClick={() => handleChange('receiptType', formData.receiptType === 'Biên Lai' ? 'Hóa Đơn' : 'Biên Lai')}
                                                    className="text-emerald-700 underline hover:text-emerald-900 font-semibold"
                                                >
                                                    {formData.receiptType === 'Biên Lai' ? 'Đổi sang HĐ' : 'Đổi sang BL'}
                                                </button>
                                            </div>
                                        </div>
                                        <input 
                                            type="text" 
                                            className="w-full border border-emerald-300 rounded-md px-3 py-2 font-mono bg-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                                            value={val(formData.receiptNumber)} 
                                            onChange={(e) => handleChange('receiptNumber', e.target.value)} 
                                            placeholder="Nhập số biên lai/hóa đơn..." 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-800 mb-1">
                                            Số tiền (VNĐ)
                                        </label>
                                        <input 
                                            type="number" 
                                            className="w-full border border-emerald-300 rounded-md px-3 py-2 font-bold text-emerald-900 bg-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" 
                                            value={formData.returnedPrice !== undefined && formData.returnedPrice !== null ? formData.returnedPrice : (formData.price !== undefined && formData.price !== null ? formData.price : '')} 
                                            onChange={(e) => {
                                                const valNum = parseFloat(e.target.value) || 0;
                                                handleChange('returnedPrice', valNum);
                                                if (formData.price === undefined || formData.price === null) {
                                                    handleChange('price', valNum);
                                                }
                                            }} 
                                            placeholder="Nhập số tiền..." 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                         {hasAdminRights && isEdit && (
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                <div className="flex items-center gap-2 mb-1"><Lock size={14} className="text-yellow-600" /><label className="text-xs font-bold text-yellow-800 uppercase">Ghi chú nội bộ</label></div>
                                <AutoResizeTextarea className="w-full border border-yellow-300 rounded-md px-3 py-2 bg-white text-sm" value={val(formData.privateNotes)} onChange={(e) => handleChange('privateNotes', e.target.value)} placeholder="Nhập ghi chú nội bộ..." />
                            </div>
                        )}

                        {/* HIỂN THỊ ĐỢT XUẤT, NGÀY XUẤT VÀ PHI ĐỊA GIỚI (Chỉ hiển thị khi đã ở bước Giao 1 cửa trở lên hoặc Rút/Trả hồ sơ) */}
                        {hasAdminRights && isEdit && (() => {
                            const statusFlow = [
                                RecordStatus.RECEIVED,
                                RecordStatus.ASSIGNED,
                                RecordStatus.IN_PROGRESS,
                                RecordStatus.COMPLETED_WORK,
                                RecordStatus.PENDING_CHECK,
                                RecordStatus.PENDING_SIGN,
                                RecordStatus.SIGNED,
                                RecordStatus.HANDOVER,
                                RecordStatus.RETURNED
                            ];
                            const curIdx = formData.status ? statusFlow.indexOf(formData.status) : -1;
                            const showExportInfo = curIdx >= statusFlow.indexOf(RecordStatus.HANDOVER) || formData.status === RecordStatus.WITHDRAWN || formData.status === RecordStatus.REJECTED;
                            if (!showExportInfo) return null;

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50/80 p-3.5 rounded-lg border border-indigo-200/80">
                                    <div>
                                        <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Đợt xuất (Batch)</label>
                                        <input type="text" className="w-full border border-indigo-200 rounded-md px-2.5 py-1.5 text-sm bg-white font-medium" value={val(getPureBatchNumber(formData.exportBatch))} onChange={(e) => handleChange('exportBatch', getPureBatchNumber(e.target.value))} placeholder="VD: 1, 2, 3..." />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-indigo-800 uppercase mb-1">Ngày xuất</label>
                                        <input type="date" className="w-full border border-indigo-200 rounded-md px-2.5 py-1.5 text-sm bg-white" value={val(formData.exportDate ? formData.exportDate.split('T')[0] : '')} onChange={(e) => { const v = e.target.value; if (!v) { handleChange('exportDate', null); return; } const d = new Date(v); if (!isNaN(d.getTime())) { handleChange('exportDate', d.toISOString()); } }} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-purple-900 uppercase mb-1">Phi địa giới</label>
                                        <select 
                                            className="w-full border border-indigo-200 rounded-md px-2.5 py-1.5 text-sm bg-white font-semibold text-purple-900"
                                            value={val(formData.handoverWard)} 
                                            onChange={(e) => handleChange('handoverWard', e.target.value || null)}
                                        >
                                            <option value="">-- Không (Theo địa chỉ thửa đất) --</option>
                                            {wards.map(w => <option key={w} value={w}>{getWardLabel(w)}</option>)}
                                        </select>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </form>
        </div>

        {/* FOOTER */}
        <div className="p-4 md:p-5 border-t bg-gray-50 flex justify-end gap-3 shrink-0 rounded-b-none md:rounded-b-xl sticky bottom-0 z-10">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 font-medium transition-colors text-sm">Hủy bỏ</button>
            <button 
                type="submit" 
                form="record-form" 
                disabled={!formData.recordType || !formData.recordType.trim()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg shadow-md font-bold transition-all text-sm ${
                    !formData.recordType || !formData.recordType.trim() 
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-70' 
                        : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                }`}
            >
                <Save size={18} /> {initialData ? 'Cập nhật' : 'Lưu hồ sơ'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default RecordModal;
