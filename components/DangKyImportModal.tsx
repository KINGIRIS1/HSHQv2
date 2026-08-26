import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { DangKyRecord, Employee, Holiday, DangKyStatusType, DANG_KY_STATUS_LIST } from '../types';
import { fetchHolidays } from '../services/api';
import { normalizeDangKyStatus } from '../services/apiDangKy';
import { X, Upload, FileSpreadsheet, Save, Loader2, AlertCircle, Check, RefreshCw, PlusCircle, AlertTriangle } from 'lucide-react';
import { calculateDeadlineHelper } from '../utils/appHelpers';
import { getShortRecordType } from '../constants';

interface DangKyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: DangKyRecord[], mode: 'create' | 'update', onProgress?: (processed: number, total: number) => void) => Promise<boolean>;
  employees: Employee[];
  initialMode?: 'create' | 'update';
}

export const DangKyImportModal: React.FC<DangKyImportModalProps> = ({ isOpen, onClose, onImport, employees, initialMode }) => {
  type PreviewRecord = DangKyRecord & { _errors?: string[] };
  const [previewData, setPreviewData] = useState<PreviewRecord[]>([]);
  const [fileName, setFileName] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'update'>(initialMode || 'update');
  const [viewFilter, setViewFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);

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
    
    if (input instanceof Date) {
      if (!isNaN(input.getTime())) {
        const y = input.getUTCFullYear();
        const m = String(input.getUTCMonth() + 1).padStart(2, '0');
        const d = String(input.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return undefined;
    }

    const num = Number(input);
    if (!isNaN(num) && num > 20000 && typeof input !== 'string') {
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
      
      const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
      const match = cleanStr.match(dmyRegex);
      if (match) {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3];
        return `${year}-${month}-${day}`;
      }

      const ymdRegex = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/;
      const matchYmd = cleanStr.match(ymdRegex);
      if (matchYmd) {
        const year = matchYmd[1];
        const month = matchYmd[2].padStart(2, '0');
        const day = matchYmd[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

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
          if (row && row.some(cell => {
            const s = String(cell).toLowerCase();
            return s.includes('mã') || s.includes('chủ sử dụng') || s.includes('người nộp') || s.includes('người nhận');
          })) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = (data[headerRowIndex] as string[]).map(h => String(h || '').toUpperCase().trim());
        const mappedRecords: PreviewRecord[] = [];

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

          const codeRaw = getVal(['MÃ HỒ SƠ', 'MÃ HS', 'CODE', 'MÃ BIÊN NHẬN', 'SỐ BIÊN NHẬN']);
          const code = codeRaw ? String(codeRaw).trim() : undefined;
          if (mode === 'update' && !code) continue;

          const record: any = {};
          const errors: string[] = [];

          if (code) record.code = code;
          else if (mode === 'create') record.code = `HS-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

          // Chủ sử dụng / Người chuyển nhượng
          const ownerNameRaw = getVal(['CHỦ SỬ DỤNG', 'TÊN CHỦ', 'BÊN CHUYỂN NHƯỢNG', 'CHỦ ĐẤT', 'HỌ TÊN', 'TÊN']);
          const ownerCccdRaw = getVal(['CCCD CHỦ', 'CMND CHỦ', 'CCCD', 'CMND']);
          const ownerAddressRaw = getVal(['ĐỊA CHỈ CHỦ', 'ĐỊA CHỈ', 'ĐỊA CHỈ THƯỜNG TRÚ']);
          const ownerPhoneRaw = getVal(['SĐT CHỦ', 'SĐT', 'ĐIỆN THOẠI']);

          if (ownerNameRaw !== undefined || ownerCccdRaw !== undefined || ownerAddressRaw !== undefined || ownerPhoneRaw !== undefined) {
            record.owners = [{
              name: ownerNameRaw !== undefined ? String(ownerNameRaw).trim() : '',
              cccd: ownerCccdRaw !== undefined ? String(ownerCccdRaw).trim() : '',
              address: ownerAddressRaw !== undefined ? String(ownerAddressRaw).trim() : '',
              phone: ownerPhoneRaw !== undefined ? String(ownerPhoneRaw).trim() : ''
            }];
          } else if (mode === 'create') {
            record.owners = [{ name: 'Chưa cập nhật', cccd: '', address: '', phone: '' }];
          }

          // Người nhận chuyển quyền / Bên nhận
          const transfereeNameRaw = getVal(['BÊN NHẬN', 'NGƯỜI NHẬN', 'NGƯỜI NHẬN CHUYỂN QUYỀN', 'BÊN MUA', 'NGƯỜI MUA']);
          const transfereeCccdRaw = getVal(['CCCD BÊN NHẬN', 'CCCD NGƯỜI NHẬN', 'CMND BÊN NHẬN']);
          const transfereeAddressRaw = getVal(['ĐỊA CHỈ BÊN NHẬN', 'ĐỊA CHỈ NGƯỜI NHẬN']);
          const transfereePhoneRaw = getVal(['SĐT BÊN NHẬN', 'SĐT NGƯỜI NHẬN']);

          if (transfereeNameRaw !== undefined) {
            record.transferees = [{
              name: String(transfereeNameRaw).trim(),
              cccd: transfereeCccdRaw !== undefined ? String(transfereeCccdRaw).trim() : '',
              address: transfereeAddressRaw !== undefined ? String(transfereeAddressRaw).trim() : '',
              phone: transfereePhoneRaw !== undefined ? String(transfereePhoneRaw).trim() : ''
            }];
          }

          // Người được ủy quyền
          const authNameRaw = getVal(['NGƯỜI ỦY QUYỀN', 'NGƯỜI ĐƯỢC ỦY QUYỀN', 'ỦY QUYỀN', 'ĐẠI DIỆN']);
          if (authNameRaw !== undefined) record.authorizedPersonName = String(authNameRaw).trim();
          const authCccdRaw = getVal(['CCCD ỦY QUYỀN', 'CMND ỦY QUYỀN']);
          if (authCccdRaw !== undefined) record.authorizedPersonId = String(authCccdRaw).trim();
          const authAddrRaw = getVal(['ĐỊA CHỈ ỦY QUYỀN']);
          if (authAddrRaw !== undefined) record.authorizedPersonAddress = String(authAddrRaw).trim();
          const authPhoneRaw = getVal(['SĐT ỦY QUYỀN']);
          if (authPhoneRaw !== undefined) record.authorizedPersonPhone = String(authPhoneRaw).trim();

          // Thửa, Tờ, Địa bàn
          const wardRaw = getVal(['XÃ', 'PHƯỜNG', 'XÃ / PHƯỜNG', 'ĐỊA DANH', 'WARD']);
          if (wardRaw !== undefined) record.ward = String(wardRaw).trim();

          const landPlotRaw = getVal(['THỬA', 'THỬA ĐẤT', 'THỬA ĐẤT SỐ']);
          if (landPlotRaw !== undefined) record.landPlot = String(landPlotRaw).trim();

          const mapSheetRaw = getVal(['TỜ', 'TỜ BẢN ĐỒ', 'TỜ SỐ', 'BẢN ĐỒ SỐ']);
          if (mapSheetRaw !== undefined) record.mapSheet = String(mapSheetRaw).trim();

          // Diện tích
          const rawArea = getVal(['DIỆN TÍCH', 'DIỆN TÍCH (M2)', 'AREA', 'TỔNG DIỆN TÍCH']);
          if (rawArea !== undefined && rawArea !== null && rawArea !== '') {
            const parsedArea = parseFloat(String(rawArea));
            record.totalArea = isNaN(parsedArea) ? 0 : parsedArea;
            if (isNaN(parsedArea)) errors.push(`Diện tích "${rawArea}" không hợp lệ.`);
          }

          const rawResArea = getVal(['ĐẤT Ở', 'THỔ CƯ', 'DIỆN TÍCH ĐẤT Ở']);
          if (rawResArea !== undefined && rawResArea !== null && rawResArea !== '') {
            const parsedResArea = parseFloat(String(rawResArea));
            record.residentialArea = isNaN(parsedResArea) ? 0 : parsedResArea;
          }

          // Số phát hành / Vào sổ
          const issueNumRaw = getVal(['SỐ PHÁT HÀNH', 'SỐ PHÁT HÀNH GCN', 'SỐ SERI']);
          if (issueNumRaw !== undefined) record.issueNumber = String(issueNumRaw).trim();

          const entryNumRaw = getVal(['SỐ VÀO SỔ', 'SỐ VÀO SỔ CẤP GCN', 'SỐ VÀO SỔ GCN']);
          if (entryNumRaw !== undefined) record.entryNumber = String(entryNumRaw).trim();

          // Loại hồ sơ
          const typeRaw = getVal(['LOẠI HỒ SƠ', 'LOẠI BIẾN ĐỘNG', 'THỦ TỤC', 'NỘI DUNG']);
          if (typeRaw !== undefined) {
            record.recordType = getShortRecordType(String(typeRaw).trim());
          } else if (mode === 'create') {
            record.recordType = '3.1.1 Chuyển quyền';
          }

          // Ngày nhận & Hạn trả
          const receivedRaw = getVal(['NGÀY NHẬN', 'NGÀY TIẾP NHẬN', 'NGÀY NỘP']);
          if (receivedRaw !== undefined) record.receivedDate = parseExcelDate(receivedRaw);
          else if (mode === 'create') record.receivedDate = new Date().toISOString();

          const deadlineRaw = getVal(['HẸN TRẢ', 'HẠN TRẢ', 'NGÀY HẸN TRẢ', 'DEADLINE']);
          if (deadlineRaw !== undefined) record.deadline = parseExcelDate(deadlineRaw);
          else if (mode === 'create' && record.recordType && record.receivedDate) {
            record.deadline = calculateDeadlineHelper(record.recordType, record.receivedDate, holidays);
          }

          // Cán bộ & Trạng thái
          const statusRaw = getVal(['TRẠNG THÁI', 'TRẠNG THÁI QUY TRÌNH', 'TÌNH TRẠNG']);
          if (statusRaw !== undefined) {
            record.status = normalizeDangKyStatus(String(statusRaw));
          } else if (mode === 'create') {
            record.status = 'Tiếp nhận mới';
          }

          const staffRaw = getVal(['CÁN BỘ THỤ LÝ', 'NGƯỜI XỬ LÝ', 'CÁN BỘ XỬ LÝ', 'CÁN BỘ THẨM ĐỊNH', 'NGƯỜI THỤ LÝ', 'CÁN BỘ']);
          if (staffRaw !== undefined) record.appraisalStaff = String(staffRaw).trim();

          const checkerRaw = getVal(['CÁN BỘ KIỂM TRA', 'NGƯỜI KIỂM TRA']);
          if (checkerRaw !== undefined) record.checkedBy = String(checkerRaw).trim();

          const submitToRaw = getVal(['LÃNH ĐẠO KÝ', 'NGƯỜI KÝ', 'LÃNH ĐẠO']);
          if (submitToRaw !== undefined) record.submittedTo = String(submitToRaw).trim();

          // Đợt xuất bàn giao 1 Cửa
          const batchRaw = getVal(['ĐỢT', 'ĐỢT BÀN GIAO', 'SỐ ĐỢT', 'BATCH']);
          if (batchRaw !== undefined) record.exportBatch = String(batchRaw).trim();

          // Biên lai / Lệ phí / Ghi chú
          const receiptRaw = getVal(['SỐ BIÊN LAI', 'BIÊN LAI']);
          if (receiptRaw !== undefined) record.receiptNumber = String(receiptRaw).trim();

          const feeRaw = getVal(['LỆ PHÍ', 'PHÍ', 'SỐ TIỀN']);
          if (feeRaw !== undefined && feeRaw !== null && feeRaw !== '') {
            const parsedFee = parseFloat(String(feeRaw).replace(/[^0-9.]/g, ''));
            if (!isNaN(parsedFee)) record.feeAmount = parsedFee;
          }

          const notesRaw = getVal(['GHI CHÚ', 'NỘI DUNG CHI TIẾT', 'GHI CHÚ HỒ SƠ']);
          if (notesRaw !== undefined) record.notes = String(notesRaw).trim();

          record.sourceTable = 'dangky_records';
          record.id = record.id || `dk-${Date.now()}-${i}`;
          record._errors = errors;
          mappedRecords.push(record);
        }

        setPreviewData(mappedRecords);
      } catch (err) {
        console.error('Lỗi phân tích file Excel Đăng ký:', err);
        alert('Có lỗi xảy ra khi đọc file Excel. Vui lòng kiểm tra lại định dạng file!');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const headers = [
      'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'CCCD CHỦ', 'SĐT', 'ĐỊA CHỈ',
      'BÊN NHẬN', 'CCCD BÊN NHẬN', 'ĐỊA CHỈ BÊN NHẬN', 'NGƯỜI ỦY QUYỀN',
      'XÃ / PHƯỜNG', 'THỬA', 'TỜ', 'DIỆN TÍCH', 'ĐẤT Ở',
      'SỐ PHÁT HÀNH', 'SỐ VÀO SỔ', 'LOẠI HỒ SƠ',
      'NGÀY NHẬN', 'HẸN TRẢ', 'TRẠNG THÁI', 'CÁN BỘ THỤ LÝ',
      'ĐỢT BÀN GIAO', 'SỐ BIÊN LAI', 'LỆ PHÍ', 'GHI CHÚ'
    ];

    const sampleRows = [
      [
        '000.00.00.H05-260818-0001', 'Nguyễn Văn Anh', '038090001111', '0912345678', 'Xã Hải Tiến',
        'Lê Văn Cường', '038085003333', 'Thị trấn Quảng Xương', 'Phạm Văn Dũng',
        'Xã Hải Tiến', '123', '45', '150.5', '100',
        'CP 123456', 'CS 01234', '3.1.1 Chuyển nhượng',
        '2026-08-20', '2026-09-05', 'Thẩm định', 'Nguyễn Văn Minh',
        'Đợt 1', 'BL-001', '100000', 'Hồ sơ đầy đủ thủ tục'
      ]
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_DangKy');
    XLSX.writeFile(wb, mode === 'create' ? 'Mau_Tiep_Nhan_Dang_Ky.xlsx' : 'Mau_Cap_Nhat_Dang_Ky.xlsx');
  };

  const handleExecuteImport = async () => {
    if (previewData.length === 0) return;
    setLoading(true);
    try {
      const validRecords = previewData.filter(r => !r._errors || r._errors.length === 0);
      const success = await onImport(validRecords, mode, (proc, tot) => {
        setProgress({ processed: proc, total: tot });
      });
      if (success) {
        onClose();
      }
    } catch (e) {
      console.error('Import error:', e);
      alert('Đã xảy ra lỗi trong quá trình xử lý dữ liệu.');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const filteredPreview = previewData.filter(r => {
    const hasError = r._errors && r._errors.length > 0;
    if (viewFilter === 'valid') return !hasError;
    if (viewFilter === 'errors') return hasError;
    return true;
  });

  const validCount = previewData.filter(r => !r._errors || r._errors.length === 0).length;
  const errorCount = previewData.length - validCount;

  if (!isOpen) return null;

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
                {mode === 'create' ? 'Tiếp nhận hàng loạt từ Excel (Đăng ký)' : 'Cập nhật hàng loạt từ file Excel (Đăng ký)'}
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">
                {mode === 'create' 
                  ? 'Thêm mới hàng loạt hồ sơ Đăng ký biến động & Cấp giấy' 
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
                onClick={() => setMode('update')}
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
                onClick={() => setMode('create')}
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
              id="excel-file-input"
            />
            <label
              htmlFor="excel-file-input"
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
                        <th className="p-2.5 border-r border-gray-200 min-w-[160px]">Mã Hồ Sơ</th>
                        <th className="p-2.5 border-r border-gray-200 min-w-[180px]">Chủ Sử Dụng</th>
                        <th className="p-2.5 border-r border-gray-200 min-w-[160px]">Bên Nhận CQ</th>
                        <th className="p-2.5 border-r border-gray-200 min-w-[110px]">Xã / Phường</th>
                        <th className="p-2.5 border-r border-gray-200 text-center min-w-[80px]">Thửa / Tờ</th>
                        <th className="p-2.5 border-r border-gray-200 min-w-[130px]">Trạng Thái</th>
                        <th className="p-2.5 border-r border-gray-200 min-w-[130px]">Cán Bộ Thụ Lý</th>
                        <th className="p-2.5 border-r border-gray-200 text-center min-w-[100px]">Hẹn Trả</th>
                        <th className="p-2.5 text-center min-w-[100px]">Đợt Bàn Giao</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredPreview.map((rec, idx) => {
                        const hasErr = rec._errors && rec._errors.length > 0;
                        return (
                          <tr key={idx} className={`hover:bg-blue-50/40 transition-colors ${hasErr ? 'bg-rose-50/50' : 'bg-white'}`}>
                            <td className="p-2.5 text-center text-gray-500 border-r border-gray-200 font-mono">{idx + 1}</td>
                            <td className="p-2.5 border-r border-gray-200 font-bold text-blue-700 font-mono">
                              {rec.code || <span className="text-gray-400 italic">Tự sinh</span>}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 font-semibold text-gray-800">
                              {rec.owners?.[0]?.name || '-'}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 text-gray-700">
                              {rec.transferees?.[0]?.name || '-'}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 text-gray-700">
                              {rec.ward || '-'}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 text-center text-gray-600 font-mono">
                              {rec.landPlot || '-'}/{rec.mapSheet || '-'}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 font-semibold text-amber-700">
                              {rec.status || '-'}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 text-gray-700">
                              {rec.appraisalStaff || rec.checkedBy || '-'}
                            </td>
                            <td className="p-2.5 border-r border-gray-200 text-center font-mono text-gray-600">
                              {rec.deadline ? rec.deadline.split('T')[0] : '-'}
                            </td>
                            <td className="p-2.5 text-center text-gray-700 font-medium">
                              {rec.exportBatch || '-'}
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
            onClick={handleExecuteImport}
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
export default DangKyImportModal;
