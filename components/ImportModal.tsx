
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
  currentView?: string;
  moduleName?: string;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, employees, initialMode, currentView, moduleName }) => {
  type PreviewRecord = RecordFile & { _errors?: string[] };
  const [previewData, setPreviewData] = useState<PreviewRecord[]>([]);
  const [fileName, setFileName] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'update'>(initialMode || 'create');
  const [viewFilter, setViewFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState<{ processed: number, total: number } | null>(null);

  const derivedModuleName = moduleName || (
    currentView?.startsWith('archive_') || currentView === 'archive_records'
      ? 'Lưu trữ'
      : 'Đo đạc'
  );

  useEffect(() => {
    if (isOpen) {
        fetchHolidays().then(setHolidays).catch(() => {});
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
              'TRẠNG THÁI', 'NGÀY XUẤT', 'ĐỢT', 'NGƯỜI XỬ LÝ', 'NGÀY GIAO'
          ];
          sampleData = [
              ['HS001', 'Nguyễn Văn A', '070012345678', '0901234567', 'Tổ 1, KP 2', 'Lê Văn C', 'Giấy ủy quyền',
               'Tân Khải', '123', '45', '100.5', '50', 'CD 123456', 'CH 01234', '2024-01-01', 
               '2.1 Trích Lục', 'cấp đổi', 'Sổ đỏ | Bản chính', '2024-01-01', '2024-01-15', 
               'Đã nhận', '2024-01-20', '1', '', '']
          ];
      }

      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
      const wb = XLSX.utils.book_new();
      const fileName = mode === 'update' ? 'Mau_Cap_Nhat_Ho_So.xlsx' : 'Mau_Nhap_Ho_So.xlsx';
      XLSX.utils.book_append_sheet(wb, ws, 'Mau_Excel');
      XLSX.writeFile(wb, fileName);
  };

  if (!isOpen) return null;

  const validCount = previewData.filter(r => !r._errors?.length).length;
  const errorCount = previewData.filter(r => r._errors && r._errors.length > 0).length;

  const filteredPreview = previewData.filter(r => {
    if (viewFilter === 'valid') return !r._errors?.length;
    if (viewFilter === 'errors') return r._errors && r._errors.length > 0;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-gray-100 animate-scale-up flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-4 flex items-center justify-between text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-xs">
              <FileSpreadsheet size={22} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {mode === 'create' 
                  ? `Tiếp nhận hàng loạt từ Excel (${derivedModuleName})` 
                  : `Cập nhật hàng loạt từ file Excel (${derivedModuleName})`}
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">
                {mode === 'create' 
                  ? `Thêm mới hàng loạt hồ sơ ${derivedModuleName} từ file Excel` 
                  : 'Cập nhật tự động trạng thái quy trình, cán bộ thụ lý, hạn trả... dựa theo Mã hồ sơ'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Controls Bar */}
        <div className="p-5 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Toggle Mode */}
            <div className="flex rounded-xl bg-gray-200 p-1 border border-gray-300 shadow-2xs">
              <button
                type="button"
                onClick={() => { setMode('update'); setPreviewData([]); setFileName(''); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  mode === 'update' 
                    ? 'bg-white text-blue-700 shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <RefreshCw size={14} /> Cập nhật dữ liệu
              </button>
              <button
                type="button"
                onClick={() => { setMode('create'); setPreviewData([]); setFileName(''); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  mode === 'create' 
                    ? 'bg-white text-blue-700 shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <PlusCircle size={14} /> Nhập mới hàng loạt
              </button>
            </div>

            {/* Download Template */}
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-1.5 bg-white border border-gray-300 hover:border-blue-500 hover:text-blue-600 text-gray-700 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet size={14} /> Tải file mẫu Excel
            </button>
          </div>

          {/* Upload File Input */}
          <div className="flex items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
              id="excel-file-input-common"
            />
            <label
              htmlFor="excel-file-input-common"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Upload size={15} /> {fileName ? 'Chọn file khác' : 'Tải lên file Excel'}
            </label>
            {fileName && (
              <span className="text-xs font-medium text-slate-600 max-w-[200px] truncate" title={fileName}>
                📄 {fileName}
              </span>
            )}
          </div>
        </div>

        {/* Modal Body / Table Preview */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && !progress && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <Loader2 className="animate-spin text-blue-600" size={36} />
              <p className="text-sm font-medium">Đang đọc và xử lý cấu trúc file Excel...</p>
            </div>
          )}

          {!loading && previewData.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 text-center">
              <FileSpreadsheet size={48} className="text-gray-300 mb-3" />
              <h4 className="text-sm font-bold text-gray-700">Chưa có dữ liệu xem trước</h4>
              <p className="text-xs text-gray-500 max-w-md mt-1 mb-4">
                Vui lòng tải lên file Excel (.xlsx hoặc .xls) chứa danh sách hồ sơ cần {mode === 'create' ? 'tiếp nhận' : 'cập nhật'}.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white border border-gray-300 hover:border-blue-500 text-blue-600 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                Chọn file từ máy tính
              </button>
            </div>
          )}

          {previewData.length > 0 && (
            <div className="space-y-4">
              {/* Summary Badges & Filter Tabs */}
              <div className="flex items-center justify-between gap-3 bg-blue-50/60 p-3 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-blue-900">Tổng cộng:</span>
                  <span className="px-2 py-0.5 bg-blue-600 text-white font-extrabold rounded-md">{previewData.length}</span>
                  <span className="text-emerald-700 font-semibold ml-2">✓ Hợp lệ: {validCount}</span>
                  {errorCount > 0 && <span className="text-rose-600 font-bold ml-2">⚠ Lỗi: {errorCount}</span>}
                </div>

                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-2xs text-xs">
                  <button
                    type="button"
                    onClick={() => setViewFilter('all')}
                    className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${viewFilter === 'all' ? 'bg-blue-600 text-white font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Tất cả ({previewData.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewFilter('valid')}
                    className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${viewFilter === 'valid' ? 'bg-emerald-600 text-white font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Hợp lệ ({validCount})
                  </button>
                  {errorCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setViewFilter('errors')}
                      className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${viewFilter === 'errors' ? 'bg-rose-600 text-white font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Bị lỗi ({errorCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-[420px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 sticky top-0 z-10 select-none uppercase text-[11px]">
                        <th className="p-2.5 text-center border-r border-gray-200 w-10">STT</th>
                        <th className="p-2.5 border-r border-gray-200 min-w-[140px]">Mã HS</th>
                        <th className="p-2.5 border-r border-gray-200 min-w-[170px]">Chủ Sử Dụng</th>
                        <th className="p-2.5 border-r border-gray-200 min-w-[110px]">Xã / Phường</th>
                        <th className="p-2.5 border-r border-gray-200 text-center min-w-[80px]">Thửa / Tờ</th>
                        <th className="p-2.5 border-r border-gray-200 min-w-[130px]">Trạng Thái</th>
                        <th className="p-2.5 border-r border-gray-200 text-center min-w-[100px]">Ngày Xuất</th>
                        <th className="p-2.5 border-r border-gray-200 text-center min-w-[70px]">Đợt</th>
                        <th className="p-2.5 text-center min-w-[120px]">Kiểm duyệt lỗi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredPreview.map((rec, idx) => {
                        const hasErr = rec._errors && rec._errors.length > 0;
                        return (
                          <tr key={idx} className={`hover:bg-blue-50/40 transition-colors ${hasErr ? 'bg-rose-50/50' : 'bg-white'}`}>
                            <td className="p-2.5 text-center text-gray-500 border-r border-gray-200 font-mono">{idx + 1}</td>
                            <td className="p-2.5 border-r border-gray-200 font-bold text-blue-700 font-mono">
                              {rec.code || <span className="text-gray-400 italic">(Giữ nguyên)</span>}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 font-semibold text-gray-800">
                              {rec.customerName || <span className="text-gray-400 italic">(Giữ nguyên)</span>}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 text-gray-700">
                              {rec.ward || '-'}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 text-center text-gray-600 font-mono">
                              {rec.landPlot || '-'}/{rec.mapSheet || '-'}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 font-semibold">
                              {rec.status ? (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold inline-block shadow-2xs ${STATUS_COLORS[rec.status as RecordStatus] || 'bg-gray-100 text-gray-700'}`}>
                                  {STATUS_LABELS[rec.status as RecordStatus] || rec.status}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">(Giữ nguyên)</span>
                              )}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 text-center font-mono text-emerald-700">
                              {rec.exportDate ? rec.exportDate.split('T')[0] : '-'}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 text-center font-bold text-gray-800">
                              {rec.exportBatch || '-'}
                            </td>
                            <td className="p-2.5 text-center">
                              {hasErr ? (
                                <ul className="text-rose-600 list-disc pl-4 text-xs font-medium text-left">
                                  {rec._errors!.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                              ) : (
                                <span className="text-emerald-600 text-xs flex items-center justify-center gap-1 font-semibold">
                                  <Check size={14} /> Hợp lệ
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar if processing */}
        {progress && (
          <div className="px-6 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-3">
            <Loader2 className="animate-spin text-blue-600 shrink-0" size={16} />
            <div className="flex-1">
              <div className="flex justify-between text-xs font-semibold text-blue-900 mb-1">
                <span>Đang xử lý lưu dữ liệu...</span>
                <span>{progress.processed} / {progress.total}</span>
              </div>
              <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-150"
                  style={{ width: `${(progress.processed / progress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Đóng / Hủy
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            disabled={validCount === 0 || loading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <Check size={16} /> {mode === 'create' ? `Tiếp nhận ${validCount} hồ sơ` : `Cập nhật ${validCount} hồ sơ`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
