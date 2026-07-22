
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, Trash2, Download, AlertCircle, Save, FileSpreadsheet, MapPin, Ruler, Link as LinkIcon, Cloud, Loader2, FileCheck, Gavel, Copy } from 'lucide-react';
import { saveTemplate, hasTemplate, removeTemplate, saveTemplateUrl, getTemplateSourceType, STORAGE_KEYS } from '../services/docxService';
import { saveExcelTemplate, hasExcelTemplate, removeExcelTemplate, EXCEL_STORAGE_KEYS } from '../services/excelTemplateService';
import * as XLSX from 'xlsx-js-style';
import { confirmAction } from '../utils/appHelpers';

interface TemplateConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'receipt' | 'contract' | 'excel_list' | 'vphc';
}

const TemplateConfigModal: React.FC<TemplateConfigModalProps> = ({ isOpen, onClose, type }) => {
  const [mode, setMode] = useState<'upload' | 'url'>('upload'); // Chế độ: Upload file hoặc Link
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  
  const [savedType, setSavedType] = useState<'FILE' | 'URL' | 'NONE'>('NONE');
  const [startRow, setStartRow] = useState<number>(8);
  const [isSaving, setIsSaving] = useState(false);
  
  // State chọn loại hợp đồng con
  const [contractSubType, setContractSubType] = useState<'dodac' | 'cammoc' | 'liq_dodac' | 'liq_cammoc' | 'liq_trichluc' | 'annex'>('dodac');
  // State mới cho loại VPHC
  const [vphcSubType, setVphcSubType] = useState<'mau01' | 'mau02'>('mau01');

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  let storageKey = '';
  let title = '';
  let acceptExt = '.docx';
  let isExcel = false;

  switch (type) {
      case 'receipt':
          storageKey = STORAGE_KEYS.RECEIPT_TEMPLATE;
          title = 'Cấu hình Mẫu Biên Nhận (.docx)';
          break;
      case 'contract':
          if (contractSubType === 'dodac') {
              storageKey = STORAGE_KEYS.CONTRACT_TEMPLATE_DODAC;
              title = 'Mẫu Hợp đồng Đo đạc / Tách thửa';
          } else if (contractSubType === 'cammoc') {
              storageKey = STORAGE_KEYS.CONTRACT_TEMPLATE_CAMMOC;
              title = 'Mẫu Hợp đồng Cắm mốc';
          } else if (contractSubType === 'liq_dodac') {
              storageKey = STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_DODAC;
              title = 'Mẫu Thanh Lý HĐ Đo Đạc';
          } else if (contractSubType === 'liq_trichluc') {
              storageKey = STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_TRICHLUC;
              title = 'Mẫu Thanh Lý HĐ Trích Lục';
          } else if (contractSubType === 'annex') {
              storageKey = STORAGE_KEYS.CONTRACT_TEMPLATE_ANNEX;
              title = 'Mẫu Phụ Lục Gia Hạn Hợp Đồng';
          } else {
              storageKey = STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_CAMMOC;
              title = 'Mẫu Thanh Lý HĐ Cắm Mốc';
          }
          break;
      case 'excel_list':
          storageKey = EXCEL_STORAGE_KEYS.DAILY_LIST_TEMPLATE;
          title = 'Cấu hình Mẫu Danh Sách Ngày (.xlsx)';
          acceptExt = '.xlsx';
          isExcel = true;
          break;
      case 'vphc':
          if (vphcSubType === 'mau01') {
              storageKey = STORAGE_KEYS.VPHC_TEMPLATE_01;
              title = 'Mẫu 01: Biên bản Vi Phạm HC';
          } else {
              storageKey = STORAGE_KEYS.VPHC_TEMPLATE_02;
              title = 'Mẫu 02: Biên bản Làm Việc';
          }
          break;
  }

  useEffect(() => {
    if (isOpen) {
        if (isExcel) {
            setSavedType(hasExcelTemplate(storageKey) ? 'FILE' : 'NONE');
            const savedRow = localStorage.getItem(storageKey + '_start_row');
            if (savedRow) setStartRow(parseInt(savedRow));
        } else {
            setSavedType(getTemplateSourceType(storageKey));
        }
        setFile(null);
        setUrl('');
    }
  }, [isOpen, storageKey, isExcel]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const selectedFile = e.target.files[0];
        if (!selectedFile.name.endsWith(acceptExt)) {
            alert(`Vui lòng chỉ chọn file ${acceptExt}`);
            return;
        }
        setFile(selectedFile);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    if (isExcel) {
        // Excel chỉ hỗ trợ Upload file (chưa hỗ trợ link do thư viện xlsx phức tạp hơn)
        if (file) {
            const success = await saveExcelTemplate(storageKey, file, startRow);
            if (success) { setSavedType('FILE'); alert('Đã lưu mẫu Excel!'); setFile(null); }
        } else if (savedType !== 'NONE') {
            localStorage.setItem(storageKey + '_start_row', startRow.toString());
            alert('Đã cập nhật cấu hình!');
        }
        setIsSaving(false);
        return;
    }

    // Word logic
    let success = false;
    if (mode === 'upload' && file) {
        success = await saveTemplate(storageKey, file);
    } else if (mode === 'url' && url.trim()) {
        success = await saveTemplateUrl(storageKey, url);
    }

    if (success) {
        setSavedType(mode === 'upload' ? 'FILE' : 'URL');
        alert('Đã lưu cấu hình mẫu thành công!');
        setFile(null);
        setUrl('');
    } else {
        alert('Lỗi khi lưu mẫu. Vui lòng kiểm tra lại.');
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
      if(await confirmAction(`Bạn có chắc muốn xóa mẫu "${title}" hiện tại?`)) {
          if (isExcel) removeExcelTemplate(storageKey);
          else removeTemplate(storageKey);
          setSavedType('NONE');
          setFile(null);
          setUrl('');
      }
  };

  const handleDownloadExcelSample = () => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
          ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
          ["Độc lập - Tự do - Hạnh phúc"],
          [],
          ["DANH SÁCH HỒ SƠ TRÍCH LỤC TRÍCH ĐO"],
          ["NGÀY ... THÁNG ... NĂM ..."],
          [],
          ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Địa Chỉ", "Loại Hồ Sơ", "Hẹn Trả", "Ghi Chú"],
      ]);
      ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 20 }];
      ws['!merges'] = [
          { s: {r:0, c:0}, e: {r:0, c:6} }, { s: {r:1, c:0}, e: {r:1, c:6} },
          { s: {r:3, c:0}, e: {r:3, c:6} }, { s: {r:4, c:0}, e: {r:4, c:6} },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Mau_DS");
      XLSX.writeFile(wb, "Mau_Danh_Sach_Ho_So.xlsx");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-fade-in-up max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {isExcel ? <FileSpreadsheet className="text-green-600" /> : <FileText className="text-blue-600" />}
            {type === 'contract' ? 'Cấu hình Mẫu In Hợp Đồng' : type === 'vphc' ? 'Cấu hình Mẫu VPHC' : title}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
            
            {/* TOGGLE CHO HỢP ĐỒNG */}
            {type === 'contract' && (
                <div className="flex flex-col gap-2 mb-4">
                    <p className="text-xs font-bold text-gray-500 uppercase">Chọn loại mẫu để cấu hình:</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => setContractSubType('dodac')}
                            className={`flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold border transition-all ${contractSubType === 'dodac' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Ruler size={14} /> HĐ Đo Đạc
                        </button>
                        <button 
                            onClick={() => setContractSubType('cammoc')}
                            className={`flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold border transition-all ${contractSubType === 'cammoc' ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <MapPin size={14} /> HĐ Cắm Mốc
                        </button>
                        <button 
                            onClick={() => setContractSubType('liq_dodac')}
                            className={`flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold border transition-all ${contractSubType === 'liq_dodac' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <FileCheck size={14} /> TL Đo Đạc
                        </button>
                        <button 
                            onClick={() => setContractSubType('liq_cammoc')}
                            className={`flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold border transition-all ${contractSubType === 'liq_cammoc' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <FileCheck size={14} /> TL Cắm Mốc
                        </button>
                        <button 
                            onClick={() => setContractSubType('liq_trichluc')}
                            className={`flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold border transition-all ${contractSubType === 'liq_trichluc' ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Copy size={14} /> TL Trích Lục
                        </button>
                        <button 
                            onClick={() => setContractSubType('annex')}
                            className={`flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold border transition-all ${contractSubType === 'annex' ? 'bg-pink-100 border-pink-300 text-pink-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <FileCheck size={14} /> Phụ lục HĐ (Mới)
                        </button>
                    </div>
                </div>
            )}

            {/* TOGGLE CHO VPHC */}
            {type === 'vphc' && (
                <div className="flex flex-col gap-2 mb-4">
                    <p className="text-xs font-bold text-gray-500 uppercase">Chọn loại mẫu VPHC:</p>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setVphcSubType('mau01')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold border transition-all ${vphcSubType === 'mau01' ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <Gavel size={14} /> Mẫu 01 (VPHC)
                        </button>
                        <button 
                            onClick={() => setVphcSubType('mau02')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold border transition-all ${vphcSubType === 'mau02' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                            <FileText size={14} /> Mẫu 02 (Làm Việc)
                        </button>
                    </div>
                </div>
            )}

            {/* STATUS BANNER */}
            <div className={`p-4 rounded-lg border flex items-center justify-between ${savedType !== 'NONE' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-3">
                    {savedType !== 'NONE' ? <CheckCircle className="text-green-600" size={24} /> : <AlertCircle className="text-gray-400" size={24} />}
                    <div>
                        <p className={`font-bold ${savedType !== 'NONE' ? 'text-green-800' : 'text-gray-600'}`}>
                            {title}
                        </p>
                        <p className="text-xs text-gray-500">
                            {savedType !== 'NONE' 
                                ? (savedType === 'URL' ? 'Đã kết nối Link Google Docs' : 'Đã tải lên File') 
                                : 'Chưa cấu hình mẫu này'}
                        </p>
                    </div>
                </div>
                {savedType !== 'NONE' && (
                    <button onClick={handleDelete} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded" title="Xóa mẫu này">
                        <Trash2 size={18} />
                    </button>
                )}
            </div>

            {/* TAB SELECTOR (Word Only) */}
            {!isExcel && (
                <div className="flex border-b border-gray-200">
                    <button 
                        onClick={() => setMode('upload')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Upload size={14} /> Upload File (.docx)
                    </button>
                    <button 
                        onClick={() => setMode('url')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'url' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Cloud size={14} /> Link Google Docs
                    </button>
                </div>
            )}

            {/* INPUT AREA */}
            <div className="py-2">
                {mode === 'upload' ? (
                    <div 
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 cursor-pointer transition-colors relative"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept={acceptExt} 
                            className="hidden" 
                        />
                        <Upload className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                        <p className="text-sm font-medium text-gray-700">
                            {file ? file.name : `Nhấn để chọn file mẫu ${acceptExt}`}
                        </p>
                        {isExcel && <p className="text-xs text-gray-500 mt-1">Nên xóa hết dữ liệu cũ trong file mẫu, chỉ giữ lại tiêu đề.</p>}
                    </div>
                ) : (
                    <div className="space-y-2 animate-fade-in">
                        <label className="block text-sm font-medium text-gray-700">Dán link Google Docs (Quyền xem/chia sẻ):</label>
                        <div className="relative">
                            <input 
                                type="text"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 pl-9 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="https://docs.google.com/document/d/..."
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                            />
                            <LinkIcon size={16} className="absolute left-3 top-2.5 text-gray-400" />
                        </div>
                        <p className="text-xs text-blue-600 flex items-center gap-1 bg-blue-50 p-2 rounded">
                            <AlertCircle size={12} />
                            Hệ thống sẽ tự động tải file từ link này mỗi khi in. Tiện lợi để cập nhật mẫu mà không cần upload lại.
                        </p>
                    </div>
                )}
            </div>

            {isExcel && (
                <>
                    <div className="flex justify-end">
                        <button type="button" onClick={handleDownloadExcelSample} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <Download size={14} /> Tải file mẫu chuẩn (.xlsx)
                        </button>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-2">
                        <label className="block text-sm font-bold text-blue-800">Dữ liệu bắt đầu từ dòng số mấy?</label>
                        <div className="flex gap-2 items-center">
                            <input type="number" min="1" className="w-20 border border-blue-300 rounded px-2 py-1 text-center font-bold text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500" value={startRow} onChange={(e) => setStartRow(parseInt(e.target.value) || 1)} />
                            <span className="text-xs text-blue-600">(Ví dụ: Tiêu đề ở dòng 7, thì dữ liệu bắt đầu dòng 8)</span>
                        </div>
                    </div>
                </>
            )}

            {!isExcel && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <p className="text-sm font-bold text-yellow-800 mb-1 flex items-center gap-1">
                        <AlertCircle size={14} /> MẸO:
                    </p>
                    <div className="text-xs text-yellow-700">
                        Để tránh lỗi file Word, hãy copy các từ khóa (ví dụ <code>{'{{TEN}}'}</code>) ra Notepad rồi copy ngược lại vào file Word để xóa định dạng ẩn.
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t mt-auto">
                <button onClick={onClose} disabled={isSaving} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50">Đóng</button>
                <button 
                    onClick={handleSave} 
                    disabled={(mode === 'upload' ? !file : !url.trim()) || isSaving} 
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateConfigModal;
