
import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee, Holiday } from '../types';
import { RECORD_TYPES, STATUS_LABELS, STATUS_COLORS } from '../constants';
import { fetchHolidays } from '../services/api';
import { X, Upload, FileSpreadsheet, Save, Loader2, AlertCircle, Check, RefreshCw, PlusCircle, AlertTriangle } from 'lucide-react';
import { calculateDeadlineHelper, formatDateKey, migrateUnbatchedRecords } from '../utils/appHelpers';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: RecordFile[], mode: 'create' | 'update', onProgress?: (processed: number, total: number) => void) => Promise<boolean>;
  employees: Employee[];
  initialMode?: 'create' | 'update';
}

const removeDiacritics = (str: string) => {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
};

const FIELD_LABELS: Record<string, string> = {
    customerName: 'Chủ sử dụng',
    phoneNumber: 'Số điện thoại',
    customerAddress: 'Địa chỉ',
    cccd: 'CCCD',
    authDocType: 'Ủy quyền',
    ward: 'Xã/Phường',
    mapSheet: 'Tờ bản đồ',
    landPlot: 'Thửa đất',
    area: 'Diện tích',
    residentialArea: 'Đất ở',
    issueNumber: 'Số phát hành',
    entryNumber: 'Số vào sổ',
    issueDate: 'Ngày cấp',
    recordType: 'Loại hồ sơ',
    content: 'Nội dung',
    otherDocs: 'Giấy tờ kèm theo',
    receivedDate: 'Ngày nhận',
    deadline: 'Ngày hẹn trả',
    completedWorkDate: 'Ngày thực hiện',
    pendingCheckDate: 'Ngày chờ kiểm tra',
    checkedDate: 'Ngày đã kiểm tra',
    submissionDate: 'Ngày trình ký',
    approvalDate: 'Ngày ký duyệt',
    completedDate: 'Ngày hoàn thành',
    resultReturnedDate: 'Ngày trả kết quả',
    exportBatch: 'Đợt',
    exportDate: 'Ngày xuất',
    assignedTo: 'Người xử lý',
    assignedDate: 'Ngày giao',
    status: 'Trạng thái'
};

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, employees, initialMode }) => {
  type PreviewRecord = RecordFile & { _errors?: string[] };
  const [previewData, setPreviewData] = useState<PreviewRecord[]>([]);
  const [fileName, setFileName] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'update'>(initialMode || 'create');
  const [viewFilter, setViewFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState<{ processed: number, total: number } | null>(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);

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
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen, initialMode]);

  const parseExcelDate = (input: any): string | undefined => {
      if (input === undefined || input === null || input === '') return undefined;
      
      // If it is already a Date object
      if (input instanceof Date) {
          if (!isNaN(input.getTime())) {
              const y = input.getUTCFullYear();
              const m = String(input.getUTCMonth() + 1).padStart(2, '0');
              const d = String(input.getUTCDate()).padStart(2, '0');
              return `${y}-${m}-${d}`;
          }
          return undefined;
      }

      // Check for Excel serial number
      const num = Number(input);
      if (!isNaN(num) && num > 20000 && typeof input !== 'string') {
          // Calculate UTC milliseconds directly from Excel epoch without local timezone offset shift
          const utcMs = Math.round((num - 25569) * 86400 * 1000);
          const date = new Date(utcMs);
          if (!isNaN(date.getTime())) {
              const y = date.getUTCFullYear();
              const m = String(date.getUTCMonth() + 1).padStart(2, '0');
              const d = String(date.getUTCDate()).padStart(2, '0');
              return `${y}-${m}-${d}`;
          }
      }

      if (typeof input === 'string') {
          const cleanStr = input.trim();
          if (cleanStr === '') return undefined;
          
          // Try parse via regex for DD/MM/YYYY
          const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
          const match = cleanStr.match(dmyRegex);
          if (match) {
              const day = match[1].padStart(2, '0');
              const month = match[2].padStart(2, '0');
              const year = match[3];
              return `${year}-${month}-${day}`;
          }

          // Try match YYYY-MM-DD
          const ymdRegex = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/;
          const matchYmd = cleanStr.match(ymdRegex);
          if (matchYmd) {
              const year = matchYmd[1];
              const month = matchYmd[2].padStart(2, '0');
              const day = matchYmd[3].padStart(2, '0');
              return `${year}-${month}-${day}`;
          }

          // Native Date fallback using UTC
          const date = new Date(cleanStr);
          if (!isNaN(date.getTime())) {
              const y = date.getUTCFullYear();
              const m = String(date.getUTCMonth() + 1).padStart(2, '0');
              const d = String(date.getUTCDate()).padStart(2, '0');
              return `${y}-${m}-${d}`;
          }
      }
      return undefined;
  };

  const calculateDeadline = (type: string, receivedDateStr: string) => {
      return calculateDeadlineHelper(type, receivedDateStr, holidays);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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

        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(data.length, 20); i++) {
            const row = data[i] as any[];
            if (row && row.some(cell => String(cell).toLowerCase().includes('mã') || String(cell).toLowerCase().includes('chủ sử dụng'))) {
                headerRowIndex = i;
                break;
            }
        }

        const headers = (data[headerRowIndex] as string[]).map(h => String(h).toUpperCase().trim());
        const mappedRecords: any[] = []; // Dùng any để linh hoạt cho Update object

        const typeMapping: Record<string, string> = {
            'TL': '2.1 Trích lục', 'TRÍCH LỤC': '2.1 Trích lục', '2.1': '2.1 Trích lục',
            'TĐ': '2.2 Trích đo', 'TD': '2.2 Trích đo', 'TRÍCH ĐO': '2.2 Trích đo', '2.2': '2.2 Trích đo',
            'CN SỐ THỬA': '2.3 Duyệt đơn & Cung cấp số thửa', 'CẬP NHẬT SỐ THỬA': '2.3 Duyệt đơn & Cung cấp số thửa', 'CẬP NHẬP SỐ THỬA': '2.3 Duyệt đơn & Cung cấp số thửa', '2.3': '2.3 Duyệt đơn & Cung cấp số thửa', '2.6': '2.3 Duyệt đơn & Cung cấp số thửa',
            'ĐĐ': '2.4 Trích đo Cắm mốc', 'DD': '2.4 Trích đo Cắm mốc', 'ĐO ĐẠC': '2.4 Trích đo Cắm mốc', 'CM': '2.4 Trích đo Cắm mốc', 'CẮM MỐC': '2.4 Trích đo Cắm mốc', '2.4': '2.4 Trích đo Cắm mốc',
            'CL': 'Trích đo chỉnh lý bản đồ địa chính', 'CHỈNH LÝ': 'Trích đo chỉnh lý bản đồ địa chính',
            'HIẾN ĐƯỜNG': 'Trích đo chỉnh lý bản đồ địa chính',
            'TÁCH THỬA': '2.5 Trích đo Tách - Hợp thửa', 'HỢP THỬA': '2.2 Trích đo', 'CẤP ĐỔI': '2.2 Trích đo', '2.5': '2.5 Trích đo Tách - Hợp thửa'
        };

        for (let i = headerRowIndex + 1; i < data.length; i++) {
            const row = data[i] as any[];
            if (!row || row.length === 0) continue;

            // Hàm helper: Trả về undefined nếu cột không tồn tại, trả về giá trị nếu có
            const getVal = (possibleHeaders: string[]) => {
                // Ưu tiên khớp chính xác (exact match)
                let idx = headers.findIndex(h => {
                    const hUpper = h.trim().toUpperCase();
                    return possibleHeaders.some(ph => hUpper === ph.toUpperCase());
                });
                // Nếu không có khớp chính xác, tìm khớp chứa chuỗi (contains)
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
            
            if (mode === 'update' && !code) continue; // Update bắt buộc phải có mã
            
            // Xây dựng object record. Với Update, chỉ điền field nào có trong Excel.
            const record: any = {};
            
            // 1. CÁC TRƯỜNG CƠ BẢN
            if (code) record.code = code;
            else if (mode === 'create') record.code = `AUTO-${Math.floor(Math.random()*10000)}`;

            const nameRaw = getVal(['CHỦ SỬ DỤNG', 'TÊN', 'HỌ TÊN', 'CUSTOMER', 'customername', 'customer_name', 'customerName']);
            if (nameRaw !== undefined) record.customerName = String(nameRaw);
            else if (mode === 'create') record.customerName = 'Chưa cập nhật';

            const phoneRaw = getVal(['SĐT', 'ĐIỆN THOẠI', 'phonenumber', 'phone_number', 'phoneNumber']);
            if (phoneRaw !== undefined) record.phoneNumber = String(phoneRaw);

            const addressRaw = getVal(['ĐỊA CHỈ', 'ADDRESS', 'customeraddress', 'customer_address', 'customerAddress', 'address']);
            if (addressRaw !== undefined) record.customerAddress = String(addressRaw);

            const cccdRaw = getVal(['CCCD', 'CMND', 'cccd']);
            if (cccdRaw !== undefined) record.cccd = String(cccdRaw);

            const authByRaw = getVal(['NGƯỜI ỦY QUYỀN', 'ỦY QUYỀN', 'authorizedby', 'authorized_by', 'authorizedBy']);
            const authTypeRaw = getVal(['LOẠI ỦY QUYỀN', 'GIẤY ỦY QUYỀN', 'authdoctype', 'auth_doc_type', 'authDocType']);
            if (authByRaw !== undefined || authTypeRaw !== undefined) {
                record.authDocType = `${authByRaw || ''}|${authTypeRaw || ''}`;
            }

            const wardRaw = getVal(['XÃ', 'PHƯỜNG', 'WARD', 'ward']);
            if (wardRaw !== undefined) record.ward = String(wardRaw);

            const mapSheetRaw = getVal(['TỜ', 'BẢN ĐỒ SỐ', 'mapsheet', 'map_sheet', 'mapSheet']);
            if (mapSheetRaw !== undefined) record.mapSheet = String(mapSheetRaw);

            const landPlotRaw = getVal(['THỬA', 'THỬA ĐẤT SỐ', 'landplot', 'land_plot', 'landPlot']);
            if (landPlotRaw !== undefined) record.landPlot = String(landPlotRaw);

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
            if (issueNumRaw !== undefined) record.issueNumber = String(issueNumRaw);

            const entryNumRaw = getVal(['SỐ VÀO SỔ', 'entrynumber', 'entry_number', 'entryNumber']);
            if (entryNumRaw !== undefined) record.entryNumber = String(entryNumRaw);

            const issueDateRaw = getVal(['NGÀY CẤP', 'issuedate', 'issue_date', 'issueDate']);
            if (issueDateRaw !== undefined) record.issueDate = parseExcelDate(issueDateRaw);

            const contentRaw = getVal(['NỘI DUNG', 'GHI CHÚ', 'content', 'notes']);
            if (contentRaw !== undefined) record.content = String(contentRaw);

            const otherDocsRaw = getVal(['GIẤY TỜ KÈM THEO', 'GIẤY TỜ', 'otherdocs', 'other_docs', 'otherDocs']);
            if (otherDocsRaw !== undefined) record.otherDocs = String(otherDocsRaw);

            // 2. NGÀY THÁNG CỦA TỪNG TRẠNG THÁI & THÔNG TIN CHUNG
            const receivedRaw = getVal(['NGÀY NHẬN', 'NGÀY NỘP', 'receiveddate', 'received_date', 'receivedDate']);
            if (receivedRaw !== undefined) record.receivedDate = parseExcelDate(receivedRaw);
            else if (mode === 'create') record.receivedDate = new Date().toISOString();

            const deadlineRaw = getVal(['HẸN TRẢ', 'DEADLINE', 'deadline']);
            if (deadlineRaw !== undefined) record.deadline = parseExcelDate(deadlineRaw);

            const completedWorkDateRaw = getVal(['NGÀY THỰC HIỆN', 'NGÀY ĐÃ THỰC HIỆN', 'completedworkdate', 'completed_work_date', 'completedWorkDate']);
            if (completedWorkDateRaw !== undefined) record.completedWorkDate = parseExcelDate(completedWorkDateRaw);

            const pendingCheckDateRaw = getVal(['NGÀY TRÌNH KIỂM TRA', 'NGÀY CHỜ KIỂM TRA', 'pendingcheckdate', 'pending_check_date', 'pendingCheckDate']);
            if (pendingCheckDateRaw !== undefined) record.pendingCheckDate = parseExcelDate(pendingCheckDateRaw);

            const checkedDateRaw = getVal(['NGÀY ĐÃ KIỂM TRA', 'checkeddate', 'checked_date', 'checkedDate']);
            if (checkedDateRaw !== undefined) record.checkedDate = parseExcelDate(checkedDateRaw);

            const submissionDateRaw = getVal(['NGÀY TRÌNH KÝ', 'submissiondate', 'submission_date', 'submissionDate']);
            if (submissionDateRaw !== undefined) record.submissionDate = parseExcelDate(submissionDateRaw);

            const approvalDateRaw = getVal(['NGÀY KÝ DUYỆT', 'NGÀY KÝ', 'approvaldate', 'approval_date', 'approvalDate']);
            if (approvalDateRaw !== undefined) record.approvalDate = parseExcelDate(approvalDateRaw);

            const completedDateRaw = getVal(['NGÀY HOÀN THÀNH', 'completeddate', 'completed_date', 'completedDate', 'NGÀY GIAO 1 CỬA']);
            if (completedDateRaw !== undefined) record.completedDate = parseExcelDate(completedDateRaw);

            const resultReturnedDateRaw = getVal(['NGÀY TRẢ DÂN', 'resultreturneddate', 'result_returned_date', 'resultReturnedDate']);
            if (resultReturnedDateRaw !== undefined) record.resultReturnedDate = parseExcelDate(resultReturnedDateRaw);

            // 3. LOẠI HỒ SƠ
            const typeRaw = getVal(['LOẠI HỒ SƠ', 'LOAI HO SO', 'recordtype', 'record_type']);
            if (typeRaw !== undefined) {
                record.recordType = String(typeRaw).trim();
            } else if (mode === 'create') {
                record.recordType = RECORD_TYPES[0];
            }

            if (mode === 'create' && !record.deadline && record.recordType && record.receivedDate) {
                record.deadline = calculateDeadline(record.recordType, record.receivedDate);
            }

            // 4. THÔNG TIN XUẤT (QUAN TRỌNG CHO VIỆC TỰ ĐỘNG HANDOVER)
            const exportBatchRaw = getVal(['ĐỢT', 'BATCH', 'exportbatch', 'export_batch', 'exportBatch']);
            if (exportBatchRaw !== undefined) {
                const numStr = String(exportBatchRaw).replace(/[^0-9]/g, '');
                if (numStr) record.exportBatch = parseInt(numStr, 10);
            }

            const exportDateRaw = getVal(['NGÀY XUẤT', 'EXPORT DATE', 'NGÀY TRẢ', 'exportdate', 'export_date', 'exportDate']);
            if (exportDateRaw !== undefined) {
                record.exportDate = parseExcelDate(exportDateRaw);
            }

            // Parse NGƯỜI XỬ LÝ & NGÀY GIAO trước để hỗ trợ suy diễn trạng thái Đã Giao Việc
            const assigneeRaw = getVal(['NGƯỜI XỬ LÝ', 'NHÂN VIÊN', 'assignedto', 'assigned_to', 'assignedTo']);
            if (assigneeRaw !== undefined && String(assigneeRaw).trim() !== '') {
                const normAssignee = removeDiacritics(String(assigneeRaw));
                const emp = employees.find(e => removeDiacritics(e.name).includes(normAssignee));
                if (emp) {
                    record.assignedTo = emp.name;
                    if (mode === 'create') record.assignedDate = record.receivedDate;
                } else {
                    errors.push(`Không tìm thấy nhân viên "${assigneeRaw}".`);
                }
            }

            const assignedDateRaw = getVal(['NGÀY GIAO', 'NGÀY GIAO VIỆC', 'assigneddate', 'assigned_date', 'assignedDate']);
            if (assignedDateRaw !== undefined) {
                record.assignedDate = parseExcelDate(assignedDateRaw);
            }

            // 5. TRẠNG THÁI & NGƯỜI XỬ LÝ
            // Logic ưu tiên: Nếu có cột Trạng Thái được điền trực tiếp từ Excel -> Ưu tiên dùng cột Trạng Thái trước.
            // Nếu không có, mới dùng logic suy diễn dựa trên các cột mốc ngày đã điền.
            let explicitStatus: RecordStatus | undefined = undefined;

            // Kiểm tra cột trạng thái từ Excel trước
            const statusRaw = getVal(['TRẠNG THÁI', 'STATUS', 'status']);
            if (statusRaw !== undefined && String(statusRaw).trim() !== '') {
                let sNorm = removeDiacritics(String(statusRaw));
                if (sNorm.includes('1 cua') || sNorm.includes('mot cua') || sNorm.includes('handover') || sNorm.includes('giao 1 cua') || sNorm.includes('ban giao') || sNorm.includes('xuat 1 cua')) {
                    explicitStatus = RecordStatus.HANDOVER;
                } else if (sNorm.includes('giao nhan vien') || sNorm.includes('assigned') || sNorm.includes('giao viec') || sNorm.includes('phan cong') || (sNorm.includes('giao') && !sNorm.includes('1 cua'))) {
                    explicitStatus = RecordStatus.ASSIGNED;
                } else if (sNorm.includes('dang') || sNorm.includes('progress')) {
                    explicitStatus = RecordStatus.IN_PROGRESS;
                } else if (sNorm.includes('da thuc hien') || sNorm.includes('thuc hien xong') || sNorm.includes('completed work') || sNorm.includes('do dac xong')) {
                    explicitStatus = RecordStatus.COMPLETED_WORK;
                } else if (sNorm.includes('cho kiem tra') || sNorm.includes('pending check') || sNorm.includes('trinh kiem tra')) {
                    explicitStatus = RecordStatus.PENDING_CHECK;
                } else if (sNorm.includes('da kiem tra') || sNorm.includes('checked')) {
                    explicitStatus = RecordStatus.CHECKED;
                } else if (sNorm.includes('cho ky') || sNorm.includes('pending sign') || sNorm.includes('trinh ky')) {
                    explicitStatus = RecordStatus.PENDING_SIGN;
                } else if (sNorm.includes('da ky') || sNorm.includes('signed') || sNorm.includes('ky duyet')) {
                    explicitStatus = RecordStatus.SIGNED;
                } else if (sNorm.includes('xong') || sNorm.includes('hoan thanh')) {
                    explicitStatus = RecordStatus.HANDOVER;
                } else if (sNorm.includes('tra dan') || sNorm.includes('returned') || sNorm.includes('da tra') || sNorm.includes('tra ket qua')) {
                    explicitStatus = RecordStatus.RETURNED;
                } else if (sNorm.includes('rut') || sNorm.includes('withdrawn')) {
                    explicitStatus = RecordStatus.WITHDRAWN;
                } else if (sNorm.includes('tu choi') || sNorm.includes('bi tra') || sNorm.includes('rejected')) {
                    explicitStatus = RecordStatus.REJECTED;
                } else if (sNorm.includes('tiep nhan') || sNorm.includes('received') || sNorm.includes('moi nhan') || sNorm.includes('chua giao')) {
                    explicitStatus = RecordStatus.RECEIVED;
                } else {
                    errors.push(`Trạng thái "${statusRaw}" không hợp lệ.`);
                }
            }

            // Gán trạng thái theo độ ưu tiên
            if (explicitStatus !== undefined) {
                record.status = explicitStatus;
                
                // Điền tự động các trường ngày tương ứng với trạng thái đã chọn nếu trường ngày đó chưa có giá trị
                const nowStr = new Date().toISOString();
                if (explicitStatus === RecordStatus.HANDOVER) {
                    if (!record.completedDate) record.completedDate = nowStr;
                } else if (explicitStatus === RecordStatus.RETURNED) {
                    if (!record.resultReturnedDate) record.resultReturnedDate = nowStr;
                } else if (explicitStatus === RecordStatus.SIGNED) {
                    if (!record.approvalDate) record.approvalDate = nowStr;
                } else if (explicitStatus === RecordStatus.PENDING_SIGN) {
                    if (!record.submissionDate) record.submissionDate = nowStr;
                } else if (explicitStatus === RecordStatus.CHECKED) {
                    if (!record.checkedDate) record.checkedDate = nowStr;
                } else if (explicitStatus === RecordStatus.PENDING_CHECK) {
                    if (!record.pendingCheckDate) record.pendingCheckDate = nowStr;
                } else if (explicitStatus === RecordStatus.COMPLETED_WORK) {
                    if (!record.completedWorkDate) record.completedWorkDate = nowStr;
                } else if (explicitStatus === RecordStatus.ASSIGNED || explicitStatus === RecordStatus.IN_PROGRESS) {
                    if (!record.assignedDate) record.assignedDate = nowStr;
                }
            } else {
                // Nếu KHÔNG có cột TRẠNG THÁI cụ thể, dùng LOGIC SUY DIỄN DỰA TRÊN NGÀY THÁNG VÀ PHÂN CÔNG (chỉ áp dụng cho tạo mới, tránh ghi đè status khi update)
                if (mode === 'create') {
                    if (record.exportBatch || record.exportDate || record.completedDate) {
                        record.status = RecordStatus.HANDOVER;
                        if (!record.completedDate && record.exportDate) {
                            record.completedDate = record.exportDate;
                        }
                    } else if (record.resultReturnedDate) {
                        record.status = RecordStatus.RETURNED;
                    } else if (record.approvalDate) {
                        record.status = RecordStatus.SIGNED;
                    } else if (record.submissionDate) {
                        record.status = RecordStatus.PENDING_SIGN;
                    } else if (record.checkedDate) {
                        record.status = RecordStatus.CHECKED;
                    } else if (record.pendingCheckDate) {
                        record.status = RecordStatus.PENDING_CHECK;
                    } else if (record.completedWorkDate) {
                        record.status = RecordStatus.COMPLETED_WORK;
                    } else if (record.assignedTo || record.assignedDate) {
                        record.status = RecordStatus.ASSIGNED;
                    } else {
                        record.status = RecordStatus.RECEIVED;
                    }
                }
            }

            // ID giả lập cho preview
            record.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
            
            if (mode === 'create') {
                if (!record.customerName) errors.push("Thiếu tên Chủ sử dụng.");
                if (!record.recordType) errors.push("Thiếu Loại hồ sơ.");
            } else {
                if (!record.code) errors.push("Thiếu Mã HS (Bắt buộc để cập nhật).");
            }

            record._errors = errors;
            mappedRecords.push(record);
        }

        const { migratedRecords } = migrateUnbatchedRecords(mappedRecords as RecordFile[]);
        setPreviewData(migratedRecords as PreviewRecord[]);
        setLoading(false);

      } catch (error) {
        console.error("Lỗi đọc Excel:", error);
        alert("Có lỗi khi đọc file Excel.");
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSave = async () => {
      setLoading(true);
      setProgress({ processed: 0, total: previewData.length });
      const success = await onImport(previewData, mode, (processed, total) => {
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
              'TRẠNG THÁI', 'NGÀY XUẤT', 'ĐỢT', 'NGƯỜI XỬ LÝ', 'NGÀY GIAO'
          ];
          sampleData = [
              ['HS001', 'Nguyễn Văn A', '070012345678', '0901234567', 'Tổ 1, KP 2', 'Lê Văn C', 
               'Tân Khải', '123', '45', '100.5', '50', 'CD 123456', 'CH 01234', '2024-01-01', 
               '2.1 Trích Lục', 'cấp đổi', 'Sổ đỏ | Bản chính', '2024-01-01', '2024-01-15', 
               'Đã giao 1 cửa', '2024-01-20', '1', '', '']
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col animate-fade-in-up">
        {/* HEADER */}
        <div className="flex justify-between items-center p-5 border-b shrink-0 bg-slate-900 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                {mode === 'create' ? 'Tiếp nhận hàng loạt từ Excel' : 'Cập nhật hàng loạt từ file Excel'}
              </h2>
              <p className="text-xs text-slate-300">
                {mode === 'create' 
                  ? 'Thêm mới hàng loạt hồ sơ Đo đạc & Lưu trữ từ file Excel' 
                  : 'Cập nhật tự động thông tin, trạng thái, ngày tháng dựa theo Mã hồ sơ'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* MODE INFO & FILE CONTROLS */}
        <div className="p-4 border-b bg-slate-50 shrink-0 space-y-3">
            {/* Always display mode switcher */}
            <div className="flex justify-center">
                <div className="bg-white border border-gray-300 rounded-xl p-1 flex shadow-xs">
                    <button 
                        type="button"
                        onClick={() => { setMode('create'); setPreviewData([]); setFileName(''); }}
                        className={`flex items-center gap-2 px-5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${mode === 'create' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <PlusCircle size={15} /> Tiếp nhận hàng loạt
                    </button>
                    <button 
                        type="button"
                        onClick={() => { setMode('update'); setPreviewData([]); setFileName(''); }}
                        className={`flex items-center gap-2 px-5 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${mode === 'update' ? 'bg-amber-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <RefreshCw size={15} /> Cập nhật hàng loạt
                    </button>
                </div>
            </div>

            {/* BAR ROW: FILTERS ON LEFT | ACTION BUTTONS ON RIGHT */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                {/* Left Side: Filter Pills or Status */}
                <div className="flex flex-wrap items-center gap-2">
                    {previewData.length > 0 && !loading ? (
                        <>
                            <button 
                                onClick={() => setViewFilter('all')}
                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewFilter === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
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
                        </>
                    ) : (
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <FileSpreadsheet size={16} className="text-blue-600" />
                            {fileName ? (
                                <span>File đã chọn: <strong className="text-blue-700">{fileName}</strong></span>
                            ) : (
                                <span>{mode === 'create' ? 'Tải file mẫu hoặc chọn file Excel để nhập hồ sơ mới' : 'Tải file mẫu hoặc chọn file Excel để cập nhật thông tin hồ sơ'}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Side: Action Buttons: Tải mẫu -> Chọn File -> [!] */}
                <div className="flex items-center gap-2 ml-auto">
                    <button 
                        onClick={handleDownloadTemplate} 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        title="Tải file Excel mẫu"
                    >
                        <FileSpreadsheet size={15} /> Tải mẫu
                    </button>

                    <input type="file" ref={fileInputRef} accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" />
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className={`text-white px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${mode === 'create' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                        title="Chọn file Excel từ máy tính"
                    >
                        <Upload size={15} /> Chọn File
                    </button>

                    <button 
                        onClick={() => setShowNoticeModal(true)} 
                        className="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs flex items-center justify-center shadow-sm border border-red-400 transition-all active:scale-90 cursor-pointer ml-0.5 shrink-0"
                        title="Xem nhắc nhở & hướng dẫn Cập nhật thông minh"
                    >
                        !
                    </button>
                </div>
            </div>
        </div>

        {/* PREVIEW TABLE */}
        <div className="flex-1 overflow-auto p-0">
            {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Loader2 className="w-10 h-10 animate-spin mb-2 text-blue-500" />
                    <p>Đang xử lý dữ liệu...</p>
                </div>
            ) : previewData.length > 0 ? (() => {
                const activeUpdatedKeys = Array.from(
                    new Set(
                        previewData.flatMap(r => Object.keys(r))
                    )
                ).filter(key => !['id', 'code', '_errors', 'sourceTable'].includes(key));

                return (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100 sticky top-0 shadow-sm z-10 text-xs uppercase font-bold text-gray-600">
                            <tr>
                                <th className="p-3 border-b">#</th>
                                <th className="p-3 border-b">Mã HS</th>
                                {activeUpdatedKeys.map(key => (
                                    <th key={key} className="p-3 border-b">{FIELD_LABELS[key] || key}</th>
                                ))}
                                <th className="p-3 border-b">Kiểm duyệt lỗi</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm text-gray-700 divide-y divide-gray-100">
                            {previewData.filter(r => {
                                if (viewFilter === 'valid') return !r._errors?.length;
                                if (viewFilter === 'errors') return r._errors && r._errors.length > 0;
                                return true;
                            }).map((record, idx) => {
                                const hasError = record._errors && record._errors.length > 0;
                                const originalIdx = previewData.indexOf(record) + 1;
                                return (
                                    <tr key={originalIdx} className={`hover:bg-blue-50 ${hasError ? 'bg-red-50' : ''}`}>
                                        <td className="p-3">{originalIdx}</td>
                                        <td className="p-3 font-medium text-blue-600">{record.code}</td>
                                        {activeUpdatedKeys.map(key => {
                                            const val = record[key];
                                            return (
                                                <td key={key} className="p-3">
                                                    {key === 'status' && val ? (
                                                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold inline-block shadow-2xs ${STATUS_COLORS[val as RecordStatus] || 'bg-gray-100 text-gray-700'}`}>
                                                            {STATUS_LABELS[val as RecordStatus] || val}
                                                        </span>
                                                    ) : (
                                                        <span className={val !== undefined && val !== null && String(val).trim() !== '' ? 'text-gray-800' : 'text-gray-300 italic'}>
                                                            {val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '(Giữ nguyên)'}
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="p-3">
                                            {hasError ? (
                                                <ul className="text-red-600 list-disc pl-4 text-xs font-medium">
                                                    {record._errors!.map((err, i) => <li key={i}>{err}</li>)}
                                                </ul>
                                            ) : (
                                                <span className="text-green-600 text-xs flex items-center gap-1 font-medium"><Check size={14} /> Hợp lệ</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                );
            })() : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <FileSpreadsheet size={48} className="mb-2 opacity-50" />
                    <p>Chưa có dữ liệu. Vui lòng chọn file Excel.</p>
                </div>
            )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t bg-white flex justify-between items-center shrink-0 rounded-b-lg">
            {previewData.length > 0 ? (
                <div className="flex gap-4 text-sm font-medium">
                    <span className="text-green-600">✅ Hợp lệ: {previewData.filter(r => !r._errors?.length).length}</span>
                    {previewData.some(r => r._errors?.length) && <span className="text-red-500">❌ Lỗi: {previewData.filter(r => r._errors?.length).length} (Vui lòng sửa Excel và tải lại)</span>}
                </div>
            ) : <div />}
            <div className="flex gap-3 items-center">
                {progress && (
                    <div className="w-48 bg-gray-200 rounded-full h-2.5 mr-4 overflow-hidden">
                        <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${Math.max(5, (progress.processed / progress.total) * 100)}%` }}></div>
                    </div>
                )}
                <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50" disabled={loading}>Hủy bỏ</button>
                <button 
                    onClick={handleSave} 
                    disabled={previewData.length === 0 || previewData.some(r => r._errors?.length) || loading} 
                    className={`flex items-center gap-2 px-6 py-2 text-white rounded-md disabled:opacity-50 font-medium shadow-sm transition-all ${mode === 'create' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                    {loading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            {progress ? `Đang lưu... ${Math.round((progress.processed / progress.total) * 100)}%` : 'Đang xử lý...'}
                        </>
                    ) : (
                        <>
                            <Save size={18} /> {mode === 'create' ? 'Lưu vào hệ thống' : 'Tiến hành cập nhật'}
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>

      {/* MODAL HƯỚNG DẪN / NHẮC NHỞ CẬP NHẬT THÔNG MINH */}
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
