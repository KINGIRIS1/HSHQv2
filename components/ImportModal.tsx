
import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee, Holiday } from '../types';
import { RECORD_TYPES, STATUS_LABELS, STATUS_COLORS } from '../constants';
import { fetchHolidays } from '../services/api';
import { X, Upload, FileSpreadsheet, Save, Loader2, AlertCircle, Check, RefreshCw, PlusCircle, AlertTriangle } from 'lucide-react';
import { calculateDeadlineHelper, formatDateKey } from '../utils/appHelpers';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: RecordFile[], mode: 'create' | 'update', onProgress?: (processed: number, total: number) => void) => Promise<boolean>;
  employees: Employee[];
  initialMode?: 'create' | 'update';
}

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
              return formatDateKey(input);
          }
          return undefined;
      }

      // Check for Excel serial number
      const num = Number(input);
      if (!isNaN(num) && num > 20000 && typeof input !== 'string') {
          const excelEpoch = new Date(1899, 11, 30);
          const totalMilliseconds = Math.round(num * 86400 * 1000); 
          const date = new Date(excelEpoch.getTime() + totalMilliseconds);
          if (!isNaN(date.getTime())) {
              return formatDateKey(date);
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

          // Native Date fallback
          const date = new Date(cleanStr);
          if (!isNaN(date.getTime())) {
              return formatDateKey(date);
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
            'TL': 'Trích lục bản đồ địa chính', 'TRÍCH LỤC': 'Trích lục bản đồ địa chính',
            'TĐ': 'Trích đo bản đồ địa chính', 'TD': 'Trích đo bản đồ địa chính', 'TRÍCH ĐO': 'Trích đo bản đồ địa chính',
            'ĐĐ': 'Đo đạc', 'DD': 'Đo đạc', 'ĐO ĐẠC': 'Đo đạc',
            'CM': 'Cắm mốc', 'CẮM MỐC': 'Cắm mốc',
            'CL': 'Trích đo chỉnh lý bản đồ địa chính', 'CHỈNH LÝ': 'Trích đo chỉnh lý bản đồ địa chính',
            'HIẾN ĐƯỜNG': 'Trích đo chỉnh lý bản đồ địa chính',
            'TÁCH THỬA': 'Tách thửa', 'HỢP THỬA': 'Trích đo bản đồ địa chính', 'CẤP ĐỔI': 'Trích đo bản đồ địa chính'
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

            const rTypeStr = String(record.recordType || '').toLowerCase();
            if (rTypeStr.includes('1.2') || rTypeStr.includes('công văn') || rTypeStr.includes('cong van') || rTypeStr.includes('cung cấp tài liệu') || record.recordType === '1.1 CC DL ĐĐ') {
                if (!record.price) record.price = 310000;
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
                const emp = employees.find(e => e.name.toLowerCase().includes(String(assigneeRaw).toLowerCase().trim()));
                if (emp) {
                    record.assignedTo = emp.id;
                    if (mode === 'create') record.assignedDate = record.receivedDate;
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
                let sStr = String(statusRaw).toUpperCase().trim();
                if (sStr.includes('1 CỬA') || sStr.includes('1 CUA') || sStr.includes('MỘT CỬA') || sStr.includes('MOT CUA') || sStr.includes('HANDOVER') || sStr.includes('GIAO 1 CỬA') || sStr.includes('ĐÃ GIAO 1 CỬA') || sStr.includes('BÀN GIAO') || sStr.includes('ĐÃ XUẤT') || sStr.includes('XUẤT 1 CỬA')) {
                    explicitStatus = RecordStatus.HANDOVER;
                } else if (sStr.includes('GIAO NHÂN VIÊN') || sStr.includes('PASSED_TO') || sStr.includes('ASSIGNED') || sStr.includes('GIAO VIỆC') || sStr.includes('ĐÃ GIAO VIỆC') || sStr.includes('PHÂN CÔNG') || (sStr.includes('ĐÃ GIAO') && !sStr.includes('1 CỬA'))) {
                    explicitStatus = RecordStatus.ASSIGNED;
                } else if (sStr.includes('ĐANG') || sStr.includes('PROGRESS')) {
                    explicitStatus = RecordStatus.IN_PROGRESS;
                } else if (sStr.includes('ĐÃ THỰC HIỆN') || sStr.includes('THỰC HIỆN XONG') || sStr.includes('COMPLETED_WORK') || sStr.includes('ĐO ĐẠC XONG')) {
                    explicitStatus = RecordStatus.COMPLETED_WORK;
                } else if (sStr.includes('CHỜ KIỂM TRA') || sStr.includes('PENDING_CHECK') || sStr.includes('TRÌNH KIỂM TRA')) {
                    explicitStatus = RecordStatus.PENDING_CHECK;
                } else if (sStr.includes('ĐÃ KIỂM TRA') || sStr.includes('CHECKED') || sStr.includes('ĐÃ KT')) {
                    explicitStatus = RecordStatus.CHECKED;
                } else if (sStr.includes('CHỜ KÝ') || sStr.includes('PENDING_SIGN') || sStr.includes('TRÌNH KÝ')) {
                    explicitStatus = RecordStatus.PENDING_SIGN;
                } else if (sStr.includes('ĐÃ KÝ') || sStr.includes('SIGNED') || sStr.includes('KÝ DUYỆT')) {
                    explicitStatus = RecordStatus.SIGNED;
                } else if (sStr.includes('XONG') || sStr.includes('HOÀN THÀNH')) {
                    explicitStatus = RecordStatus.HANDOVER;
                } else if (sStr.includes('TRẢ DÂN') || sStr.includes('RETURNED') || sStr.includes('ĐÃ TRẢ') || sStr.includes('TRẢ KẾT QUẢ')) {
                    explicitStatus = RecordStatus.RETURNED;
                } else if (sStr.includes('RÚT') || sStr.includes('WITHDRAWN')) {
                    explicitStatus = RecordStatus.WITHDRAWN;
                } else if (sStr.includes('TỪ CHỐI') || sStr.includes('BỊ TRẢ') || sStr.includes('REJECTED')) {
                    explicitStatus = RecordStatus.REJECTED;
                } else if (sStr.includes('TIẾP NHẬN') || sStr.includes('RECEIVED') || sStr.includes('MỚI NHẬN') || sStr.includes('CHƯA GIAO')) {
                    explicitStatus = RecordStatus.RECEIVED;
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
                // Nếu KHÔNG có cột TRẠNG THÁI cụ thể, dùng LOGIC SUY DIỄN DỰA TRÊN NGÀY THÁNG VÀ PHÂN CÔNG
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
                } else if (mode === 'create') {
                    record.status = RecordStatus.RECEIVED;
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

        setPreviewData(mappedRecords as PreviewRecord[]);
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
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {mode === 'create' ? (
              <>
                <FileSpreadsheet className="text-green-600" />
                Tiếp nhận hàng loạt từ Excel
              </>
            ) : (
              <>
                <RefreshCw className="text-amber-600" />
                Cập nhật thông tin từ Excel
              </>
            )}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">
            <X size={24} />
          </button>
        </div>

        {/* MODE INFO & FILE CONTROLS */}
        <div className="p-4 border-b bg-slate-50 shrink-0 space-y-3">
            {/* Show mode switcher only when initialMode is not explicitly provided */}
            {!initialMode && (
              <div className="flex justify-center">
                  <div className="bg-white border border-gray-300 rounded-lg p-1 flex shadow-sm">
                      <button 
                          onClick={() => { setMode('create'); setPreviewData([]); setFileName(''); }}
                          className={`flex items-center gap-2 px-6 py-1.5 rounded-md font-medium text-sm transition-all ${mode === 'create' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                      >
                          <PlusCircle size={16} /> Nhập hồ sơ mới
                      </button>
                      <button 
                          onClick={() => { setMode('update'); setPreviewData([]); setFileName(''); }}
                          className={`flex items-center gap-2 px-6 py-1.5 rounded-md font-medium text-sm transition-all ${mode === 'update' ? 'bg-orange-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                      >
                          <RefreshCw size={16} /> Cập nhật thông tin
                      </button>
                  </div>
              </div>
            )}

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
            ) : previewData.length > 0 ? (
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 sticky top-0 shadow-sm z-10 text-xs uppercase font-bold text-gray-600">
                        <tr>
                            <th className="p-3 border-b">#</th>
                            <th className="p-3 border-b">Mã HS</th>
                            <th className="p-3 border-b">Chủ Sử Dụng</th>
                            <th className="p-3 border-b">Trạng Thái (Dự kiến)</th>
                            <th className="p-3 border-b">Ngày Xuất</th>
                            <th className="p-3 border-b">Đợt</th>
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
                            // Find original index for display
                            const originalIdx = previewData.indexOf(record) + 1;
                            return (
                                <tr key={originalIdx} className={`hover:bg-blue-50 ${hasError ? 'bg-red-50' : ''}`}>
                                    <td className="p-3">{originalIdx}</td>
                                    <td className="p-3 font-medium text-blue-600">{record.code}</td>
                                    <td className="p-3 font-medium text-gray-500">{record.customerName || <span className="text-gray-300 italic">(Giữ nguyên)</span>}</td>
                                    <td className="p-3">
                                        {record.status ? (
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold inline-block shadow-2xs ${STATUS_COLORS[record.status as RecordStatus] || 'bg-gray-100 text-gray-700'}`}>
                                                {STATUS_LABELS[record.status as RecordStatus] || record.status}
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 italic">(Giữ nguyên)</span>
                                        )}
                                    </td>
                                    <td className="p-3 font-mono text-green-700">{record.exportDate ? record.exportDate.split('T')[0] : '-'}</td>
                                    <td className="p-3 font-bold">{record.exportBatch || '-'}</td>
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
            ) : (
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
