import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee, Holiday } from '../types';
import { RECORD_TYPES, STATUS_LABELS, STATUS_COLORS, getShortRecordType, isArchiveRecordType, isCertificateRecordType } from '../constants';
import { fetchHolidays } from '../services/api';
import { keepOnlyDate } from '../services/apiCore';
import { X, Upload, FileSpreadsheet, Save, Loader2, Check, RefreshCw, PlusCircle, AlertTriangle } from 'lucide-react';
import { calculateDeadlineHelper, migrateUnbatchedRecords, isOfficeOnlySurveyProcedure, isFieldWorkProcedure } from '../utils/appHelpers';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: RecordFile[], mode: 'create' | 'update', onProgress?: (processed: number, total: number) => void) => Promise<boolean>;
  employees: Employee[];
  initialMode?: 'create' | 'update';
  records?: RecordFile[];
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, employees, initialMode, records = [] }) => {
  type PreviewRecord = RecordFile & { _errors?: string[]; _isDuplicateCode?: boolean; _isDupInSoftware?: boolean; _isDupInFile?: boolean };
  const [previewData, setPreviewData] = useState<PreviewRecord[]>([]);
  const [fileName, setFileName] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'update'>(initialMode || 'create');
  const [viewFilter, setViewFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState<{ processed: number, total: number } | null>(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showDuplicatePromptModal, setShowDuplicatePromptModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
        fetchHolidays().then(setHolidays);
        setPreviewData([]);
        setFileName('');
        setViewFilter('all');
        setProgress(null);
        if (initialMode) {
            setMode(initialMode);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen, initialMode]);

  const parseExcelDate = (input: any, fieldLabel?: string, errorsList?: string[], isDeadline: boolean = false): string | undefined => {
      if (input === undefined || input === null || input === '') return undefined;
      const strVal = String(input).trim();
      if (strVal === '' || strVal === '-' || strVal === 'N/A' || strVal === 'null' || strVal === 'undefined') return undefined;

      const dateIso = keepOnlyDate(input);
      if (dateIso) {
          // Kiểm tra xem chuỗi đầu vào có sẵn phần giờ hay không
          const timeMatch = strVal.match(/[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
          if (timeMatch) {
              const hh = String(timeMatch[1]).padStart(2, '0');
              const mm = String(timeMatch[2]).padStart(2, '0');
              const ss = timeMatch[3] ? String(timeMatch[3]).padStart(2, '0') : '00';
              return `${dateIso}T${hh}:${mm}:${ss}`;
          }
          // Nếu người dùng nhập chỉ ngày tháng năm -> Lấy mặc định giờ đầu tiên của ngày làm việc (07:30:00), riêng hạn trả là 17:30:00
          const defaultHour = isDeadline ? 'T17:30:00' : 'T07:30:00';
          return `${dateIso}${defaultHour}`;
      }

      if (fieldLabel && errorsList) {
          errorsList.push(`${fieldLabel} "${strVal}" không đúng định dạng ngày (vd: 24/07/2026) hoặc sai lịch (vd: 30/02)`);
      }
      return undefined;
  };

  const calculateDeadline = (type: string, receivedDateStr: string) => {
      return calculateDeadlineHelper(type, receivedDateStr, holidays);
  };

  const processFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ab = evt.target?.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // 1. Quét tìm dòng tiêu đề chính xác (Fuzzy Header Detection)
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(data.length, 20); i++) {
            const row = data[i] as any[];
            if (row && row.some(cell => {
              const s = String(cell).toLowerCase();
              return s.includes('mã') || s.includes('chủ sử dụng') || s.includes('họ tên') || s.includes('thửa') || s.includes('loại hồ sơ') || s.includes('stt');
            })) {
                headerRowIndex = i;
                break;
            }
        }

        const headers = (data[headerRowIndex] as string[]).map(h => String(h || '').toUpperCase().trim());
        const mappedRecords: any[] = [];

        const typeMapping: Record<string, string> = {
            'TL': '2.1 Trích lục', 'TRÍCH LỤC': '2.1 Trích lục', '2.1': '2.1 Trích lục',
            'TĐ': '2.2 Trích đo', 'TD': '2.2 Trích đo', 'TRÍCH ĐO': '2.2 Trích đo', '2.2': '2.2 Trích đo',
            'CN SỐ THỬA': '2.3 Duyệt đơn', 'CẬP NHẬT SỐ THỬA': '2.3 Duyệt đơn', 'CẬP NHẬP SỐ THỬA': '2.3 Duyệt đơn', '2.3': '2.3 Duyệt đơn', '2.6': '2.3 Duyệt đơn',
            'ĐĐ': '2.4 Cắm mốc', 'DD': '2.4 Cắm mốc', 'ĐO ĐẠC': '2.4 Cắm mốc', 'CM': '2.4 Cắm mốc', 'CẮM MỐC': '2.4 Cắm mốc', '2.4': '2.4 Cắm mốc',
            'CL': '2.2 Trích đo', 'CHỈNH LÝ': '2.2 Trích đo',
            'HIẾN ĐƯỜNG': '2.2 Trích đo',
            'TÁCH THỬA': '2.5 Tách-Hợp thửa', 'HỢP THỬA': '2.5 Tách-Hợp thửa', 'CẤP ĐỔI': '2.2 Trích đo', '2.5': '2.5 Tách-Hợp thửa'
        };

        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i] as any[];
            if (!row || row.length === 0) continue;

            const getVal = (possibleHeaders: string[]) => {
                let idx = headers.findIndex(h => {
                    const hUpper = h.trim().toUpperCase();
                    return possibleHeaders.some(ph => hUpper === ph.toUpperCase());
                });
                if (idx === -1) {
                    idx = headers.findIndex(h => {
                        const hUpper = h.trim().toUpperCase();
                        return possibleHeaders.some(ph => hUpper.includes(ph.toUpperCase()));
                    });
                }
                return idx !== -1 ? row[idx] : undefined;
            };

            const codeRaw = getVal(['MÃ HỒ SƠ', 'MÃ HS', 'CODE', 'code']);
            const code = codeRaw ? String(codeRaw).trim() : undefined;
            
            if (mode === 'update' && !code) continue;
            
            const record: any = {};
            
            if (code) record.code = code;
            else if (mode === 'create') record.code = `AUTO-${Math.floor(Math.random()*10000)}`;

            const nameRaw = getVal(['CHỦ SỬ DỤNG', 'TÊN', 'HỌ TÊN', 'CUSTOMER', 'customername', 'customer_name', 'customerName', 'BÊN CHUYỂN NHƯỢNG']);
            if (nameRaw !== undefined) record.customerName = String(nameRaw).trim();
            else if (mode === 'create') record.customerName = 'Chưa cập nhật';

            const phoneRaw = getVal(['SĐT', 'ĐIỆN THOẠI', 'phonenumber', 'phone_number', 'phoneNumber']);
            if (phoneRaw !== undefined) record.phoneNumber = String(phoneRaw).trim();

            const addressRaw = getVal(['ĐỊA CHỈ', 'ADDRESS', 'customeraddress', 'customer_address', 'customerAddress', 'address']);
            if (addressRaw !== undefined) record.customerAddress = String(addressRaw).trim();

            const cccdRaw = getVal(['CCCD', 'CMND', 'cccd']);
            if (cccdRaw !== undefined) record.cccd = String(cccdRaw).trim();

            const authByRaw = getVal(['NGƯỜI ỦY QUYỀN', 'ỦY QUYỀN', 'authorizedby', 'authorized_by', 'authorizedBy']);
            const authTypeRaw = getVal(['LOẠI ỦY QUYỀN', 'GIẤY ỦY QUYỀN', 'authdoctype', 'auth_doc_type', 'authDocType']);
            if (authByRaw !== undefined || authTypeRaw !== undefined) {
                record.authDocType = `${authByRaw || ''}|${authTypeRaw || ''}`;
            }

            const wardRaw = getVal(['XÃ', 'PHƯỜNG', 'WARD', 'ward', 'ĐỊA BÀN', 'XÃ / PHƯỜNG']);
            if (wardRaw !== undefined) record.ward = String(wardRaw).trim();

            const mapSheetRaw = getVal(['TỜ', 'BẢN ĐỒ SỐ', 'TỜ BẢN ĐỒ', 'mapsheet', 'map_sheet', 'mapSheet']);
            if (mapSheetRaw !== undefined) record.mapSheet = String(mapSheetRaw).trim();

            const landPlotRaw = getVal(['THỬA', 'THỬA ĐẤT SỐ', 'THỬA ĐẤT', 'landplot', 'land_plot', 'landPlot']);
            if (landPlotRaw !== undefined) record.landPlot = String(landPlotRaw).trim();

            const errors: string[] = [];

            const rawArea = getVal(['DIỆN TÍCH', 'AREA', 'area']);
            if (rawArea !== undefined && rawArea !== null && rawArea !== '') {
                const parsedArea = parseFloat(String(rawArea));
                record.area = isNaN(parsedArea) ? 0 : parsedArea;
                if (isNaN(parsedArea)) {
                    errors.push(`Diện tích "${rawArea}" không hợp lệ.`);
                }
            } else if (rawArea !== undefined) {
                record.area = null;
            }

            const rawResArea = getVal(['ĐẤT Ở', 'THỔ CƯ', 'residentialarea', 'residential_area', 'residentialArea']);
            if (rawResArea !== undefined && rawResArea !== null && rawResArea !== '') {
                 const parsedResArea = parseFloat(String(rawResArea));
                 record.residentialArea = isNaN(parsedResArea) ? 0 : parsedResArea;
                 if (isNaN(parsedResArea)) {
                     errors.push(`Đất ở "${rawResArea}" không hợp lệ.`);
                 }
            } else if (rawResArea !== undefined) {
                 record.residentialArea = null;
            }

            const issueNumRaw = getVal(['SỐ PHÁT HÀNH', 'issuenumber', 'issue_number', 'issueNumber']);
            if (issueNumRaw !== undefined) record.issueNumber = String(issueNumRaw).trim();

            const entryNumRaw = getVal(['SỐ VÀO SỔ', 'entrynumber', 'entry_number', 'entryNumber']);
            if (entryNumRaw !== undefined) record.entryNumber = String(entryNumRaw).trim();

            const issueDateRaw = getVal(['NGÀY CẤP', 'issuedate', 'issue_date', 'issueDate']);
            if (issueDateRaw !== undefined) record.issueDate = parseExcelDate(issueDateRaw, 'Ngày cấp', errors);

            const contentRaw = getVal(['NỘI DUNG', 'GHI CHÚ', 'content', 'notes']);
            if (contentRaw !== undefined) record.content = String(contentRaw).trim();

            const otherDocsRaw = getVal(['GIẤY TỜ KÈM THEO', 'GIẤY TỜ', 'otherdocs', 'other_docs', 'otherDocs']);
            if (otherDocsRaw !== undefined) record.otherDocs = String(otherDocsRaw).trim();

            const receivedRaw = getVal(['NGÀY NHẬN', 'NGÀY NỘP', 'receiveddate', 'received_date', 'receivedDate']);
            if (receivedRaw !== undefined) {
                record.receivedDate = parseExcelDate(receivedRaw, 'Ngày nhận', errors);
            } else if (mode === 'create') {
                record.receivedDate = new Date().toISOString();
            }

            const deadlineRaw = getVal(['HẸN TRẢ', 'DEADLINE', 'deadline']);
            if (deadlineRaw !== undefined) record.deadline = parseExcelDate(deadlineRaw, 'Ngày hẹn trả', errors, true);

            const completedWorkDateRaw = getVal(['NGÀY THỰC HIỆN', 'NGÀY ĐÃ THỰC HIỆN', 'completedworkdate', 'completed_work_date', 'completedWorkDate']);
            if (completedWorkDateRaw !== undefined) record.completedWorkDate = parseExcelDate(completedWorkDateRaw, 'Ngày thực hiện', errors);

            const pendingCheckDateRaw = getVal(['NGÀY TRÌNH KIỂM TRA', 'NGÀY CHỜ KIỂM TRA', 'pendingcheckdate', 'pending_check_date', 'pendingCheckDate']);
            if (pendingCheckDateRaw !== undefined) record.pendingCheckDate = parseExcelDate(pendingCheckDateRaw, 'Ngày trình KT', errors);

            const checkedDateRaw = getVal(['NGÀY ĐÃ KIỂM TRA', 'checkeddate', 'checked_date', 'checkedDate']);
            if (checkedDateRaw !== undefined) record.checkedDate = parseExcelDate(checkedDateRaw, 'Ngày đã KT', errors);

            const submissionDateRaw = getVal(['NGÀY TRÌNH KÝ', 'submissiondate', 'submission_date', 'submissionDate']);
            if (submissionDateRaw !== undefined) record.submissionDate = parseExcelDate(submissionDateRaw, 'Ngày trình ký', errors);

            const approvalDateRaw = getVal(['NGÀY KÝ DUYỆT', 'NGÀY KÝ', 'approvaldate', 'approval_date', 'approvalDate']);
            if (approvalDateRaw !== undefined) record.approvalDate = parseExcelDate(approvalDateRaw, 'Ngày ký', errors);

            const completedDateRaw = getVal(['NGÀY HOÀN THÀNH', 'completeddate', 'completed_date', 'completedDate', 'NGÀY GIAO 1 CỬA']);
            if (completedDateRaw !== undefined) record.completedDate = parseExcelDate(completedDateRaw, 'Ngày hoàn thành', errors);

            const resultReturnedDateRaw = getVal(['NGÀY TRẢ DÂN', 'resultreturneddate', 'result_returned_date', 'resultReturnedDate']);
            if (resultReturnedDateRaw !== undefined) record.resultReturnedDate = parseExcelDate(resultReturnedDateRaw, 'Ngày trả dân', errors);

            const typeRaw = getVal(['LOẠI HỒ SƠ', 'LOAI HO SO', 'LOẠI', 'THỦ TỤC', 'recordtype', 'record_type']);
            if (typeRaw !== undefined) {
                const str = String(typeRaw).trim();
                record.recordType = typeMapping[str.toUpperCase()] || getShortRecordType(str);
            } else if (mode === 'create') {
                record.recordType = RECORD_TYPES[0];
            }

            if (mode === 'create' && !record.deadline && record.recordType && record.receivedDate) {
                record.deadline = calculateDeadline(record.recordType, record.receivedDate);
            }

            const exportBatchRaw = getVal(['ĐỢT', 'BATCH', 'exportbatch', 'export_batch', 'exportBatch', 'ĐỢT XUẤT', 'DOT XUAT', 'DOT', 'ĐỢT BÀN GIAO', 'ĐỢT GIAO 1 CỬA', 'ĐỢT GIAO', 'ĐỢT XUẤT HỒ SƠ', 'ĐỢT GIAO MỘT CỬA']);
            if (exportBatchRaw !== undefined) {
                const numStr = String(exportBatchRaw).replace(/[^0-9]/g, '');
                if (numStr) {
                    record.exportBatch = parseInt(numStr, 10);
                } else if (String(exportBatchRaw).trim() !== '') {
                    record.exportBatch = String(exportBatchRaw).trim();
                }
            }

            const exportDateRaw = getVal(['NGÀY XUẤT', 'EXPORT DATE', 'exportdate', 'export_date', 'exportDate', 'NGÀY XUẤT HỒ SƠ', 'NGÀY XUẤT GIAO 1 CỬA', 'NGÀY BÀN GIAO', 'NGÀY GIAO 1 CỬA', 'NGÀY BÀN GIAO 1 CỬA', 'NGÀY GIAO MỘT CỬA', 'NGÀY BÀN GIAO MỘT CỬA', 'NGÀY TRẢ KẾT QUẢ', 'NGÀY XUẤT ĐỢT']);
            if (exportDateRaw !== undefined) {
                record.exportDate = parseExcelDate(exportDateRaw, 'Ngày xuất', errors);
            }

            // Đồng bộ và tự động bù ngày xuất / ngày hoàn thành nếu có đợt xuất
            if (record.exportBatch && !record.exportDate) {
                record.exportDate = record.completedDate || record.approvalDate || record.resultReturnedDate || record.receivedDate;
            }
            if (record.exportDate && !record.completedDate) {
                record.completedDate = record.exportDate;
            }

            const assigneeRaw = getVal(['NGƯỜI XỬ LÝ', 'NHÂN VIÊN', 'assignedto', 'assigned_to', 'assignedTo', 'NV XỬ LÝ']);
            if (assigneeRaw !== undefined && String(assigneeRaw).trim() !== '') {
                const emp = employees.find(e => e.name.toLowerCase().includes(String(assigneeRaw).toLowerCase().trim()));
                if (emp) {
                    record.assignedTo = emp.id;
                    if (mode === 'create') record.assignedDate = record.receivedDate;
                }
            }

            const assignedDateRaw = getVal(['NGÀY GIAO', 'NGÀY GIAO VIỆC', 'assigneddate', 'assigned_date', 'assignedDate']);
            if (assignedDateRaw !== undefined) {
                record.assignedDate = parseExcelDate(assignedDateRaw, 'Ngày giao', errors);
            }

            let explicitStatus: RecordStatus | undefined = undefined;

            const statusRaw = getVal(['TRẠNG THÁI', 'STATUS', 'status']);
            if (statusRaw !== undefined && String(statusRaw).trim() !== '') {
                let sStr = String(statusRaw).toUpperCase().trim();
                if (sStr.includes('1 CỬA') || sStr.includes('1 CUA') || sStr.includes('MỘT CỬA') || sStr.includes('MOT CUA') || sStr.includes('HANDOVER') || sStr.includes('GIAO 1 CỬA') || sStr.includes('ĐÃ GIAO 1 CỬA') || sStr.includes('BÀN GIAO 1 CỬA') || sStr.includes('XUẤT 1 CỬA') || sStr.includes('ĐÃ XUẤT 1 CỬA')) {
                    explicitStatus = RecordStatus.HANDOVER;
                } else if (sStr.includes('TRẢ DÂN') || sStr.includes('RETURNED') || sStr.includes('ĐÃ TRẢ DÂN') || sStr.includes('TRẢ KẾT QUẢ')) {
                    explicitStatus = RecordStatus.RETURNED;
                } else if (sStr.includes('KÝ DUYỆT') || sStr.includes('ĐÃ KÝ') || sStr.includes('SIGNED') || sStr.includes('LÃNH ĐẠO KÝ') || sStr.includes('ĐÃ KÝ DUYỆT')) {
                    explicitStatus = RecordStatus.SIGNED;
                } else if (sStr.includes('TRÌNH KÝ') || sStr.includes('CHỜ KÝ') || sStr.includes('PENDING_SIGN') || sStr.includes('CHỜ KÝ DUYỆT') || sStr.includes('ĐÃ KIỂM TRA') || sStr.includes('CHECKED') || sStr.includes('ĐÃ KT') || sStr.includes('KIỂM TRA XONG') || sStr.includes('ĐÃ DUYỆT')) {
                    explicitStatus = RecordStatus.PENDING_SIGN;
                } else if (sStr.includes('KIỂM TRA') || sStr.includes('PENDING_CHECK') || sStr.includes('TRÌNH KIỂM TRA') || sStr.includes('CHỜ KT')) {
                    explicitStatus = RecordStatus.PENDING_CHECK;
                } else if (sStr.includes('ĐÃ THỰC HIỆN') || sStr.includes('THỰC HIỆN XONG') || sStr.includes('COMPLETED_WORK') || sStr.includes('ĐO ĐẠC XONG') || sStr.includes('HOÀN THÀNH ĐO')) {
                    explicitStatus = RecordStatus.COMPLETED_WORK;
                } else if (sStr.includes('NỘI NGHIỆP') || sStr.includes('BIÊN TẬP') || sStr.includes('OFFICE_WORK') || sStr.includes('XỬ LÝ NỘI NGHIỆP')) {
                    explicitStatus = RecordStatus.OFFICE_WORK;
                } else if (sStr.includes('NGOẠI NGHIỆP') || sStr.includes('FIELD_WORK') || sStr.includes('ĐI ĐO') || sStr.includes('ĐO NGOẠI NGHIỆP') || sStr.includes('ĐO ĐẠC')) {
                    explicitStatus = RecordStatus.FIELD_WORK;
                } else if (sStr.includes('GIAO NHÂN VIÊN') || sStr.includes('PASSED_TO') || sStr.includes('ASSIGNED') || sStr.includes('GIAO VIỆC') || sStr.includes('ĐÃ GIAO VIỆC') || sStr.includes('PHÂN CÔNG') || (sStr.includes('ĐÃ GIAO') && !sStr.includes('1 CỬA'))) {
                    explicitStatus = RecordStatus.ASSIGNED;
                } else if (sStr.includes('RÚT') || sStr.includes('WITHDRAWN')) {
                    explicitStatus = RecordStatus.WITHDRAWN;
                } else if (sStr.includes('TỪ CHỐI') || sStr.includes('BỊ TRẢ') || sStr.includes('REJECTED')) {
                    explicitStatus = RecordStatus.REJECTED;
                } else if (sStr.includes('TIẾP NHẬN') || sStr.includes('RECEIVED') || sStr.includes('MỚI NHẬN') || sStr.includes('CHƯA GIAO') || sStr.includes('ĐÃ NHẬN')) {
                    explicitStatus = RecordStatus.RECEIVED;
                } else if (sStr.includes('ĐANG') || sStr.includes('PROGRESS')) {
                    explicitStatus = RecordStatus.IN_PROGRESS;
                }
            }

            if (explicitStatus !== undefined && explicitStatus !== RecordStatus.IN_PROGRESS) {
                record.status = explicitStatus;
                
                const nowStr = new Date().toISOString();
                if (explicitStatus === RecordStatus.HANDOVER) {
                    if (!record.completedDate) record.completedDate = nowStr;
                } else if (explicitStatus === RecordStatus.RETURNED) {
                    if (!record.resultReturnedDate) record.resultReturnedDate = nowStr;
                } else if (explicitStatus === RecordStatus.SIGNED) {
                    if (!record.approvalDate) record.approvalDate = nowStr;
                } else if (explicitStatus === RecordStatus.PENDING_SIGN) {
                    if (!record.submissionDate) record.submissionDate = nowStr;
                } else if (explicitStatus === RecordStatus.PENDING_CHECK) {
                    if (!record.pendingCheckDate) record.pendingCheckDate = nowStr;
                } else if (explicitStatus === RecordStatus.COMPLETED_WORK) {
                    if (!record.completedWorkDate) record.completedWorkDate = nowStr;
                } else if (explicitStatus === RecordStatus.ASSIGNED) {
                    if (!record.assignedDate) record.assignedDate = nowStr;
                }
            } else {
                // Tự động suy luận trạng thái dựa trên các mốc tiến trình (khi file không có cột Trạng thái hoặc là "Đang thực hiện")
                if (record.resultReturnedDate) {
                    record.status = RecordStatus.RETURNED;
                } else if (record.exportBatch || record.exportDate || record.completedDate) {
                    record.status = RecordStatus.HANDOVER;
                } else if (record.approvalDate) {
                    record.status = RecordStatus.SIGNED;
                } else if (record.submissionDate || record.submittedTo || record.checkedDate) {
                    record.status = RecordStatus.PENDING_SIGN;
                } else if (record.pendingCheckDate || record.checkedBy) {
                    record.status = RecordStatus.PENDING_CHECK;
                } else if (record.completedWorkDate) {
                    record.status = RecordStatus.COMPLETED_WORK;
                } else if (record.officeAssignedDate || (isOfficeOnlySurveyProcedure(record.recordType) && (record.assignedTo || record.assignedDate))) {
                    record.status = RecordStatus.OFFICE_WORK;
                    if (record.assignedTo && !record.drafterId) record.drafterId = record.assignedTo;
                    if (record.assignedDate && !record.officeAssignedDate) record.officeAssignedDate = record.assignedDate;
                } else if (record.fieldAssignedDate || (record.assignedTo || record.assignedDate)) {
                    const isArch = isArchiveRecordType(record.recordType);
                    if (isArch) {
                        record.status = RecordStatus.IN_PROGRESS;
                    } else if (isOfficeOnlySurveyProcedure(record.recordType)) {
                        record.status = RecordStatus.OFFICE_WORK;
                    } else {
                        record.status = RecordStatus.FIELD_WORK;
                        if (record.assignedTo && !record.surveyorId) record.surveyorId = record.assignedTo;
                        if (record.assignedDate && !record.fieldAssignedDate) record.fieldAssignedDate = record.assignedDate;
                    }
                } else if (explicitStatus === RecordStatus.IN_PROGRESS) {
                    record.status = isArchiveRecordType(record.recordType) ? RecordStatus.IN_PROGRESS : (isOfficeOnlySurveyProcedure(record.recordType) ? RecordStatus.OFFICE_WORK : RecordStatus.FIELD_WORK);
                } else if (mode === 'create') {
                    record.status = RecordStatus.RECEIVED;
                }
            }

            record.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
            
            const rTypeStr = String(record.recordType || '').trim();
            if (isCertificateRecordType(rTypeStr) || rTypeStr.startsWith('3.')) {
                record.sourceTable = 'dangky_records';
                record.group = '3. Đăng ký đất đai, cấp GCN';
            } else if (isArchiveRecordType(rTypeStr) || rTypeStr.startsWith('1.')) {
                record.sourceTable = 'luutru_records';
                record.group = '1. Cung cấp thông tin, dữ liệu đất đai';
            } else {
                record.sourceTable = 'land_records';
                record.group = '2. Đo đạc bản đồ';
            }

            record._errors = errors;
            mappedRecords.push(record);
        }

        const { migratedRecords } = migrateUnbatchedRecords(mappedRecords as RecordFile[]);
        const validated = validateRecords(migratedRecords as PreviewRecord[], mode, records);
        setPreviewData(validated);
        setLoading(false);

      } catch (error) {
        console.error("Lỗi đọc Excel:", error);
        alert("Có lỗi khi đọc file Excel.");
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateRecords = (
    items: PreviewRecord[], 
    currentMode: 'create' | 'update', 
    existingRecords: RecordFile[] = []
  ): PreviewRecord[] => {
    const existingCodeSet = new Set(
      existingRecords.map(r => String(r.code || '').trim().toUpperCase()).filter(Boolean)
    );

    const fileCodeCounts = new Map<string, number>();
    items.forEach(r => {
      if (r.code) {
        const cUpper = String(r.code).trim().toUpperCase();
        fileCodeCounts.set(cUpper, (fileCodeCounts.get(cUpper) || 0) + 1);
      }
    });

    return items.map(record => {
      const errors: string[] = [];
      let isDupInSoftware = false;
      let isDupInFile = false;
      let notFoundInSoftware = false;

      if (currentMode === 'create') {
        if (!record.customerName) errors.push("Thiếu tên Chủ sử dụng.");
        if (!record.recordType) errors.push("Thiếu Loại hồ sơ.");
        
        if (record.code) {
          const cUpper = String(record.code).trim().toUpperCase();
          if (existingCodeSet.has(cUpper)) {
            isDupInSoftware = true;
            errors.push(`Trùng mã hồ sơ "${record.code}" với hồ sơ đã có trong phần mềm.`);
          }
          if ((fileCodeCounts.get(cUpper) || 0) > 1) {
            isDupInFile = true;
            errors.push(`Trùng mã hồ sơ "${record.code}" bị lặp lại trong file Excel.`);
          }
        }
      } else {
        if (!record.code) {
          errors.push("Thiếu Mã HS (Bắt buộc để cập nhật).");
        } else {
          const cUpper = String(record.code).trim().toUpperCase();
          if (!existingCodeSet.has(cUpper)) {
            notFoundInSoftware = true;
            errors.push(`⚠️ Mã hồ sơ "${record.code}" chưa có trên phần mềm (Không thể cập nhật).`);
          }
        }
      }

      // Preserve non-code errors like date parsing errors
      const otherErrors = (record._errors || []).filter(e => 
        !e.includes("Trùng mã hồ sơ") && 
        !e.includes("Thiếu tên") && 
        !e.includes("Thiếu Loại") && 
        !e.includes("Thiếu Mã HS") &&
        !e.includes("chưa có trên phần mềm")
      );
      
      const combinedErrors = Array.from(new Set([...otherErrors, ...errors]));

      return {
        ...record,
        _errors: combinedErrors,
        _isDuplicateCode: isDupInSoftware || isDupInFile,
        _isDupInSoftware: isDupInSoftware,
        _isDupInFile: isDupInFile,
        _notFoundInSoftware: notFoundInSoftware
      };
    });
  };

  const handleModeSwitch = (newMode: 'create' | 'update') => {
    setMode(newMode);
    setViewFilter('all');
    if (previewData.length > 0) {
      setPreviewData(validateRecords(previewData, newMode, records));
    }
  };

  const handleAutoFixDuplicateCodes = () => {
    const existingCodeSet = new Set(
      (records || []).map(r => String(r.code || '').trim().toUpperCase()).filter(Boolean)
    );

    const updated = previewData.map(r => {
      if (r._isDuplicateCode || (mode === 'create' && !r.code)) {
        const baseCode = r.code ? String(r.code).trim() : 'HS';
        let suffix = 1;
        let newCode = `${baseCode}-${suffix}`;
        while (
          existingCodeSet.has(newCode.toUpperCase()) || 
          previewData.some(p => p.id !== r.id && String(p.code || '').trim().toUpperCase() === newCode.toUpperCase())
        ) {
          suffix++;
          newCode = `${baseCode}-${suffix}`;
        }
        existingCodeSet.add(newCode.toUpperCase());
        return { ...r, code: newCode };
      }
      return r;
    });

    setPreviewData(validateRecords(updated, mode, records));
    setShowDuplicatePromptModal(false);
  };

  const handleSkipDuplicateRecords = () => {
    const filtered = previewData.filter(r => !r._isDuplicateCode);
    setPreviewData(validateRecords(filtered, mode, records));
    setShowDuplicatePromptModal(false);
  };

  const handleSwitchToUpdateMode = () => {
    handleModeSwitch('update');
    setShowDuplicatePromptModal(false);
  };

  const handleCodeChange = (id: string, newCode: string) => {
    const updated = previewData.map(p => p.id === id ? { ...p, code: newCode } : p);
    setPreviewData(validateRecords(updated, mode, records));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleSave = async (skipDuplicateCheck = false) => {
      const duplicates = previewData.filter(r => r._isDuplicateCode);
      if (mode === 'create' && duplicates.length > 0 && !skipDuplicateCheck) {
        setShowDuplicatePromptModal(true);
        return;
      }

      const recordsToImport = mode === 'create' ? previewData.filter(r => !r._errors?.length) : previewData;

      if (recordsToImport.length === 0) {
        alert("Không có hồ sơ hợp lệ nào để nhập!");
        return;
      }

      setLoading(true);
      setProgress({ processed: 0, total: recordsToImport.length });
      const success = await onImport(recordsToImport, mode, (processed, total) => {
          setProgress({ processed, total });
      });
      setLoading(false);
      setProgress(null);
      if (success) {
          onClose();
      }
  };

  const handleDownloadTemplate = () => {
      let headers: string[];
      let sampleData: any[][];

      if (mode === 'update') {
          headers = [
              'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'CCCD', 'SĐT', 'ĐỊA CHỈ', 'NGƯỜI ỦY QUYỀN', 
              'XÃ', 'THỬA', 'TỜ', 'DIỆN TÍCH', 'ĐẤT Ở', 'SỐ PHÁT HÀNH', 'SỐ VÀO SỔ', 'NGÀY CẤP', 
              'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'NGÀY NHẬN', 'HẸN TRẢ', 
              'TRẠNG THÁI', 'NGÀY THỰC HIỆN', 'NGÀY TRÌNH KIỂM TRA', 'NGÀY ĐÃ KIỂM TRA', 'NGÀY TRÌNH KÝ', 
              'NGÀY KÝ DUYỆT', 'NGÀY HOÀN THÀNH', 'NGÀY TRẢ DÂN', 'NGÀY XUẤT', 'ĐỢT', 'NGƯỜI XỬ LÝ', 'NGÀY GIAO'
          ];
          sampleData = [
              ['HS001', 'Nguyễn Văn A', '070012345678', '0901234567', 'Tổ 1, KP 2', 'Lê Văn C', 
               'Tân Khải', '123', '45', '100.5', '50', 'CD 123456', 'CH 01234', '2024-01-01', 
               '2.1 Trích Lục', 'cấp đổi', 'Sổ đỏ | Bản chính', '2024-01-01', '2024-01-15', 
               'Đã kiểm tra', '', '', '2024-01-10', '', '', '', '', '2024-01-20', '1', '', '']
          ];
      } else {
          headers = [
              'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'CCCD', 'SĐT', 'ĐỊA CHỈ', 'NGƯỜI ỦY QUYỀN', 'LOẠI ỦY QUYỀN', 
              'XÃ', 'THỬA', 'TỜ', 'DIỆN TÍCH', 'ĐẤT Ở', 'SỐ PHÁT HÀNH', 'SỐ VÀO SỔ', 'NGÀY CẤP', 
              'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'NGÀY NHẬN', 'HẸN TRẢ', 
              'TRẠNG THÁI', 'NGÀY THỰC HIỆN', 'NGÀY TRÌNH KIỂM TRA', 'NGÀY ĐÃ KIỂM TRA', 'NGÀY TRÌNH KÝ', 
              'NGÀY KÝ DUYỆT', 'NGÀY HOÀN THÀNH', 'NGÀY TRẢ DÂN', 'NGÀY XUẤT', 'ĐỢT', 'NGƯỜI XỬ LÝ', 'NGÀY GIAO'
          ];
          sampleData = [
              ['HS001', 'Nguyễn Văn A', '070012345678', '0901234567', 'Tổ 1, KP 2', 'Lê Văn C', 'Giấy ủy quyền', 
               'Tân Khai', '123', '45', '100.5', '50', 'CD 123456', 'CH 01234', '2024-01-01', 
               'Đo đạc', 'Đo đạc cắm mốc', 'Sổ đỏ|Bản chính', '2024-01-01', '2024-01-15', 
               'Đã nhận', '', '', '', '', '', '', '', '', '', '', '']
          ];
      }

      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
      const wb = XLSX.utils.book_new();
      const fileName = mode === 'update' ? 'Mau_Cap_Nhat_Ho_So.xlsx' : 'Mau_Nhap_Ho_So.xlsx';
      XLSX.utils.book_append_sheet(wb, ws, 'Mau_Excel');
      XLSX.writeFile(wb, fileName);
  };

  // Danh sách các cột động hiển thị dựa trên dữ liệu người dùng thực tế tải lên từ Excel
  const activePreviewColumns = useMemo(() => {
    if (!previewData.length) return [];
    
    const possibleCols: { key: keyof RecordFile; label: string; render: (r: PreviewRecord) => React.ReactNode }[] = [
      { 
        key: 'customerName', 
        label: 'Chủ Sử Dụng', 
        render: (r) => r.customerName || <span className="text-slate-300 italic">(Giữ nguyên)</span> 
      },
      { 
        key: 'status', 
        label: 'Trạng Thái (Dự kiến)', 
        render: (r) => r.status ? (
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold inline-block shadow-2xs ${STATUS_COLORS[r.status as RecordStatus] || 'bg-slate-100 text-slate-700'}`}>
            {STATUS_LABELS[r.status as RecordStatus] || r.status}
          </span>
        ) : <span className="text-slate-300 italic">(Giữ nguyên)</span> 
      },
      { 
        key: 'assignedTo', 
        label: 'Người Xử Lý', 
        render: (r) => {
          const emp = employees.find(e => e.id === r.assignedTo);
          return emp ? <span className="font-semibold text-indigo-600">{emp.name}</span> : (r.assignedTo ? String(r.assignedTo) : <span className="text-slate-300 italic">(Giữ nguyên)</span>);
        }
      },
      { key: 'assignedDate', label: 'Ngày Giao', render: (r) => r.assignedDate ? r.assignedDate.split('T')[0] : '-' },
      { key: 'completedWorkDate', label: 'Ngày Thực Hiện', render: (r) => r.completedWorkDate ? r.completedWorkDate.split('T')[0] : '-' },
      { key: 'pendingCheckDate', label: 'Ngày Trình KT', render: (r) => r.pendingCheckDate ? r.pendingCheckDate.split('T')[0] : '-' },
      { key: 'checkedDate', label: 'Ngày Đã KT', render: (r) => r.checkedDate ? r.checkedDate.split('T')[0] : '-' },
      { key: 'submissionDate', label: 'Ngày Trình Ký', render: (r) => r.submissionDate ? r.submissionDate.split('T')[0] : '-' },
      { key: 'approvalDate', label: 'Ngày Ký Duyệt', render: (r) => r.approvalDate ? r.approvalDate.split('T')[0] : '-' },
      { key: 'completedDate', label: 'Ngày Hoàn Thành', render: (r) => r.completedDate ? r.completedDate.split('T')[0] : '-' },
      { key: 'resultReturnedDate', label: 'Ngày Trả Dân', render: (r) => r.resultReturnedDate ? r.resultReturnedDate.split('T')[0] : '-' },
      { key: 'exportDate', label: 'Ngày Xuất', render: (r) => <span className="font-mono text-emerald-700">{r.exportDate ? r.exportDate.split('T')[0] : '-'}</span> },
      { key: 'exportBatch', label: 'Đợt', render: (r) => <span className="font-bold">{r.exportBatch || '-'}</span> }
    ];

    if (mode === 'create') {
      return [
        possibleCols[0], // customerName
        possibleCols[1], // status
        possibleCols[11], // exportDate
        possibleCols[12]  // exportBatch
      ];
    }

    // Chế độ Cập nhật (Update): Chỉ lấy những cột mà ít nhất 1 dòng có dữ liệu
    const active = possibleCols.filter(col => 
      previewData.some(r => r[col.key] !== undefined && r[col.key] !== null && r[col.key] !== '')
    );

    if (active.length === 0) {
      return [
        possibleCols[0], // customerName
        possibleCols[1], // status
        possibleCols[11], // exportDate
        possibleCols[12]  // exportBatch
      ];
    }
    return active;
  }, [previewData, employees, mode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden border border-slate-100">
        
        {/* HEADER BAR (Blue Header Matching Image 1 & Image 2) */}
        <div className="bg-blue-700 px-6 py-4 flex justify-between items-center shrink-0 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white border border-white/20 shadow-inner shrink-0">
              <FileSpreadsheet size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                {mode === 'create' 
                  ? 'Tiếp nhận hàng loạt từ Excel (Đo đạc / Lưu trữ)' 
                  : 'Cập nhật hàng loạt từ file Excel (Đo đạc / Lưu trữ)'
                }
              </h2>
              <p className="text-xs text-blue-100/90 font-medium mt-0.5">
                {mode === 'create'
                  ? 'Thêm mới hàng loạt hồ sơ Đo đạc & Lưu trữ từ file Excel'
                  : 'Cập nhật tự động trạng thái quy trình, cán bộ thụ lý, hạn trả... dựa theo Mã hồ sơ'
                }
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Đóng modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* SUBHEADER CONTROL BAR (Top control row) */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* Left Side: Segmented control tabs */}
          <div className="bg-slate-200/70 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60 shadow-inner">
            <button 
              onClick={() => handleModeSwitch('update')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                mode === 'update' 
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60' 
                  : 'text-slate-600 hover:text-slate-900 font-semibold'
              }`}
            >
              <RefreshCw size={15} /> Cập nhật dữ liệu
            </button>

            <button 
              onClick={() => handleModeSwitch('create')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                mode === 'create' 
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60' 
                  : 'text-slate-600 hover:text-slate-900 font-semibold'
              }`}
            >
              <PlusCircle size={15} /> Nhập mới hàng loạt
            </button>

            <button 
              onClick={handleDownloadTemplate} 
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-2xs transition-all cursor-pointer"
              title="Tải file mẫu Excel"
            >
              <FileSpreadsheet size={15} className="text-slate-600" /> Tải file mẫu Excel
            </button>
          </div>

          {/* Right Side: Upload button & Red Exclamation Notice Button */}
          <div className="flex items-center gap-2 ml-auto">
            <input type="file" ref={fileInputRef} accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" />
            
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-4.5 py-2.5 text-xs flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
              title="Tải lên file Excel"
            >
              <Upload size={15} /> Tải lên file Excel
            </button>

            <button 
              onClick={() => setShowNoticeModal(true)} 
              className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white font-extrabold text-sm flex items-center justify-center shadow-md border border-red-400/80 cursor-pointer transition-all active:scale-90 ml-1 shrink-0"
              title="Xem hướng dẫn cập nhật thông minh"
            >
              !
            </button>
          </div>
        </div>

        {/* MAIN BODY AREA */}
        <div className="flex-1 overflow-auto p-6 flex flex-col">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 my-auto">
              <Loader2 className="w-10 h-10 animate-spin mb-3 text-blue-600" />
              <p className="text-sm font-semibold text-slate-700">Đang đọc và đối soát dữ liệu file Excel...</p>
            </div>
          ) : previewData.length > 0 ? (
            <div className="space-y-4 flex-1 flex flex-col">
              {/* Filter Row */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <button 
                      onClick={() => setViewFilter('all')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewFilter === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300/70'}`}
                  >
                      Tất cả ({previewData.length})
                  </button>
                  <button 
                      onClick={() => setViewFilter('valid')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewFilter === 'valid' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}
                  >
                      Hợp lệ ({previewData.filter(r => !r._errors?.length).length})
                  </button>
                  <button 
                      onClick={() => setViewFilter('errors')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewFilter === 'errors' ? 'bg-red-600 text-white shadow-xs' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'}`}
                  >
                      Không hợp lệ ({previewData.filter(r => r._errors?.length).length})
                  </button>
                </div>
                {fileName && (
                  <span className="text-xs text-slate-500 font-medium">
                    File: <strong className="text-blue-600">{fileName}</strong>
                  </span>
                )}
              </div>

              {/* Alert Banner for Duplicate Codes */}
              {mode === 'create' && previewData.some(r => r._isDuplicateCode) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-fade-in">
                  <div className="flex items-center gap-2.5 text-amber-900 text-xs font-bold">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                    <span>
                      Phát hiện <strong className="text-red-600 font-extrabold text-sm">{previewData.filter(r => r._isDuplicateCode).length}</strong> hồ sơ có <strong>Mã hồ sơ đã tồn tại</strong> trong phần mềm hoặc lặp lại trong file.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleAutoFixDuplicateCodes} 
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      title="Tự động thêm hậu tố (-1, -2...) để cấp mã mới duy nhất"
                    >
                      🪄 Tự đổi mã mới
                    </button>
                    <button 
                      onClick={handleSkipDuplicateRecords} 
                      className="bg-slate-700 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      title="Loại bỏ các dòng bị trùng mã ra khỏi danh sách nhập"
                    >
                      🚫 Bỏ qua dòng trùng
                    </button>
                    <button 
                      onClick={handleSwitchToUpdateMode} 
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      title="Chuyển sang chế độ Cập nhật dữ liệu theo mã hồ sơ"
                    >
                      🔄 Chuyển Cập nhật
                    </button>
                  </div>
                </div>
              )}

              {/* Alert Banner for Non-existent Records in Update mode */}
              {mode === 'update' && previewData.some(r => (r as any)._notFoundInSoftware) && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-fade-in">
                  <div className="flex items-center gap-2.5 text-red-900 text-xs font-bold">
                    <AlertTriangle size={18} className="text-red-600 shrink-0" />
                    <span>
                      Phát hiện <strong className="text-red-700 font-extrabold text-sm">{previewData.filter(r => (r as any)._notFoundInSoftware).length}</strong> hồ sơ <strong>chưa có trên phần mềm</strong> (Chưa tồn tại mã để cập nhật).
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleModeSwitch('create')} 
                      className="bg-red-600 hover:bg-red-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      title="Chuyển toàn bộ danh sách sang chế độ Nhập mới để thêm mới hồ sơ"
                    >
                      <PlusCircle size={15} /> Chuyển sang "Nhập mới" (Tạo mới)
                    </button>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="flex-1 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 sticky top-0 shadow-xs z-10 text-xs uppercase font-bold text-slate-600">
                        <tr>
                            <th className="p-3 border-b whitespace-nowrap">#</th>
                            <th className="p-3 border-b whitespace-nowrap">Mã HS</th>
                            {activePreviewColumns.map(col => (
                                <th key={col.key} className="p-3 border-b whitespace-nowrap">{col.label}</th>
                            ))}
                            <th className="p-3 border-b whitespace-nowrap">Kiểm duyệt lỗi</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                        {previewData.filter(r => {
                            if (viewFilter === 'valid') return !r._errors?.length;
                            if (viewFilter === 'errors') return r._errors && r._errors.length > 0;
                            return true;
                        }).map((record) => {
                            const hasError = record._errors && record._errors.length > 0;
                            const originalIdx = previewData.indexOf(record) + 1;
                            return (
                                <tr key={originalIdx} className={`hover:bg-blue-50/50 ${hasError ? 'bg-red-50/50' : ''}`}>
                                    <td className="p-3 text-xs font-semibold text-slate-400">{originalIdx}</td>
                                    <td className="p-3 font-medium whitespace-nowrap">
                                        <input 
                                            type="text"
                                            className={`px-2.5 py-1 border rounded-lg text-xs font-mono font-bold w-40 outline-none transition-all ${
                                              record._isDuplicateCode 
                                                ? 'border-red-400 bg-red-100/80 text-red-700 focus:ring-2 focus:ring-red-300 font-extrabold' 
                                                : 'border-slate-300 bg-white text-blue-700 focus:border-blue-500'
                                            }`}
                                            value={record.code || ''}
                                            onChange={(e) => handleCodeChange(record.id, e.target.value)}
                                            placeholder="Nhập mã HS..."
                                        />
                                    </td>
                                    {activePreviewColumns.map(col => (
                                        <td key={col.key} className="p-3 whitespace-nowrap">
                                            {col.render(record)}
                                        </td>
                                    ))}
                                    <td className="p-3">
                                        {hasError ? (
                                            <ul className="text-red-600 list-disc pl-4 text-xs font-medium">
                                                {record._errors!.map((err, i) => <li key={i}>{err}</li>)}
                                            </ul>
                                        ) : (
                                            <span className="text-emerald-600 text-xs flex items-center gap-1 font-medium"><Check size={14} /> Hợp lệ</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* EMPTY STATE / DRAG AND DROP ZONE (Exact Match Image 1 & Image 2) */
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`w-full max-w-4xl border-2 border-dashed ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200/90 bg-slate-50/40'} rounded-3xl p-12 flex flex-col items-center justify-center text-center my-auto transition-all mx-auto`}
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-100/80 flex items-center justify-center text-slate-300 mb-4 shadow-inner">
                <FileSpreadsheet size={40} className="text-slate-300 stroke-[1.2]" />
              </div>
              
              <h3 className="text-base font-bold text-slate-800 mb-1.5">
                Chưa có dữ liệu xem trước
              </h3>
              
              <p className="text-xs text-slate-500 mb-6 max-w-md">
                {mode === 'create'
                  ? 'Vui lòng tải lên file Excel (.xlsx hoặc .xls) chứa danh sách hồ sơ cần tiếp nhận.'
                  : 'Vui lòng tải lên file Excel (.xlsx hoặc .xls) chứa danh sách hồ sơ cần cập nhật.'
                }
              </p>

              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white hover:bg-slate-50 text-blue-600 border border-blue-200/90 hover:border-blue-400 font-bold px-6 py-2.5 rounded-xl text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-2"
              >
                Chọn file từ máy tính
              </button>
            </div>
          )}
        </div>

        {/* FOOTER BAR (Matching Image 1 & Image 2) */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-between items-center rounded-b-2xl shrink-0">
          <button 
            onClick={onClose} 
            className="text-slate-600 hover:text-slate-900 font-bold text-xs transition-colors cursor-pointer px-2 py-1"
            disabled={loading}
          >
            Đóng / Hủy
          </button>

          <div className="flex items-center gap-3">
            {progress && (
                <div className="w-48 bg-slate-200 rounded-full h-2 mr-2 overflow-hidden">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${Math.max(5, (progress.processed / progress.total) * 100)}%` }}></div>
                </div>
            )}
            
            <button 
                onClick={() => handleSave(false)} 
                disabled={previewData.length === 0 || loading} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-6 py-2.5 text-xs flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
            >
                {loading ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        {progress ? `Đang lưu... ${Math.round((progress.processed / progress.total) * 100)}%` : 'Đang xử lý...'}
                    </>
                ) : (
                    <>
                        <Check size={16} /> 
                        {mode === 'create' 
                          ? `Tiếp nhận ${previewData.filter(r => !r._errors?.length).length}/${previewData.length} hồ sơ` 
                          : `Cập nhật ${previewData.length} hồ sơ`
                        }
                    </>
                )}
            </button>
          </div>
        </div>

      </div>

      {/* MODAL CẢNH BÁO TRÙNG MÃ HỒ SƠ KHI BẤM LƯU */}
      {showDuplicatePromptModal && (
        <div className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-scale-up space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  Phát hiện Trùng Mã Hồ Sơ
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Có {previewData.filter(r => r._isDuplicateCode).length} hồ sơ trong file trùng mã đã có trong hệ thống hoặc bị lặp.
                </p>
              </div>
            </div>

            <div className="text-sm text-slate-700 leading-relaxed space-y-2 bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/80">
              <p className="font-semibold text-amber-900">Bạn muốn xử lý các dòng bị trùng mã như thế nào?</p>
              <p className="text-xs text-slate-600">
                Nếu tự đổi mã mới, hệ thống sẽ tự sinh suffix (-1, -2...) để cấp mã duy nhất không trùng lặp.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleAutoFixDuplicateCodes}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                🪄 1. Tự động đổi mã mới duy nhất & Tiếp tục nhập
              </button>

              <button
                onClick={handleSkipDuplicateRecords}
                className="w-full bg-slate-700 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                🚫 2. Bỏ qua các dòng trùng mã (Chỉ nhập các dòng hợp lệ)
              </button>

              <button
                onClick={handleSwitchToUpdateMode}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                🔄 3. Chuyển sang chế độ Cập nhật dữ liệu
              </button>

              <button
                onClick={() => setShowDuplicatePromptModal(false)}
                className="w-full bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer mt-1"
              >
                ✖️ Hủy / Quay lại chỉnh sửa thủ công
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HƯỚNG DẪN CHẾ ĐỘ CẬP NHẬT THÔNG MINH */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-red-500 text-white font-black flex items-center justify-center text-sm shadow-sm shrink-0">!</span>
                HƯỚNG DẪN CHẾ ĐỘ CẬP NHẬT THÔNG MINH
              </h3>
              <button onClick={() => setShowNoticeModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="py-4 space-y-3 text-sm text-slate-700 leading-relaxed">
              <p className="flex items-start gap-2">
                <span className="font-bold text-blue-600 shrink-0">•</span>
                <span>Hệ thống tự động dò tìm hồ sơ dựa vào <strong>Mã Hồ Sơ</strong>.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-bold text-blue-600 shrink-0">•</span>
                <span>Chỉ cập nhật các cột <strong>CÓ dữ liệu</strong> trong file Excel (Ví dụ: file chỉ có cột Ngày Xuất thì hệ thống chỉ cập nhật cột Ngày Xuất).</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-bold text-amber-600 shrink-0">•</span>
                <span><strong>QUAN TRỌNG:</strong> Nếu file có cột <strong>"Đợt"</strong> hoặc <strong>"Ngày xuất/Ngày trả"</strong>, hệ thống sẽ tự động chuyển trạng thái hồ sơ sang <strong>"Đã giao 1 cửa"</strong> để tránh bị báo trễ hạn.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-bold text-emerald-600 shrink-0">•</span>
                <span>Bấm <strong>"Tải mẫu"</strong> để tải file Excel chuẩn, điền thông tin và bấm <strong>"Chọn File"</strong> để đối soát dữ liệu trước khi bấm Cập nhật.</span>
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowNoticeModal(false)} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl text-sm shadow-md transition-all active:scale-95 cursor-pointer"
              >
                OK (Đã hiểu)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ImportModal;
