
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus } from '../../types';
import { RECORD_TYPES } from '../../constants';
import { Upload, FileSpreadsheet, Wand2, Save, Printer, X, Check, Download } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';

interface BulkImportProps {
  onSave: (record: RecordFile) => Promise<RecordFile | null>;
  calculateDeadline: (type: string, date: string) => string;
  calculateNextCode: (ward: string, date: string, existingCodes: string[]) => string;
  onPreview: (record: Partial<RecordFile>) => void;
  currentUser?: any;
}

interface BulkRecordItem extends Partial<RecordFile> {
    tempId: string;
    isSaved: boolean;
}

const BulkImport: React.FC<BulkImportProps> = ({ onSave, calculateDeadline, calculateNextCode, onPreview, currentUser }) => {
  const [bulkRecords, setBulkRecords] = useState<BulkRecordItem[]>([]);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

  const handleDownloadTemplate = () => {
      const wb = XLSX.utils.book_new();
      
      const headers = [
          "CHỦ SỬ DỤNG", "SĐT", "XÃ", "THỬA", "TỜ", "DIỆN TÍCH", "ĐỊA CHỈ", "LOẠI HỒ SƠ", "NỘI DUNG", "NGƯỜI ỦY QUYỀN", "LOẠI ỦY QUYỀN"
      ];
      
      const sampleData = [
          ["Nguyễn Văn A", "0901234567", "Tân Quan", "123", "45", "100.5", "Tổ 1, KP 2", "Trích lục", "Xin trích lục bản đồ", "", ""],
          ["Trần Thị B", "0987654321", "Tân Khai", "456", "78", "250.0", "KP 3", "Đo đạc", "Đo đạc cắm mốc", "Lê Văn C", "Giấy ủy quyền"]
      ];
      
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
      
      const wscols = [
          {wch: 25}, {wch: 15}, {wch: 20}, {wch: 10}, {wch: 10}, 
          {wch: 15}, {wch: 30}, {wch: 25}, {wch: 30}, {wch: 25}, {wch: 20}
      ];
      ws['!cols'] = wscols;
      
      XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap_Lieu");
      XLSX.writeFile(wb, "Mau_Nhap_Lieu_Ho_So.xlsx");
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          const ab = evt.target?.result;
          const wb = XLSX.read(ab, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          let headerRowIndex = 0;
          for (let i = 0; i < Math.min(data.length, 20); i++) {
              const row = data[i] as any[];
              if (row && row.some(cell => String(cell).toLowerCase().includes('chủ sử dụng') || String(cell).toLowerCase().includes('tên'))) {
                  headerRowIndex = i;
                  break;
              }
          }

          const headers = (data[headerRowIndex] as string[]).map(h => String(h).toUpperCase().trim());
          const newBulkRecords: BulkRecordItem[] = [];

          const typeMapping: Record<string, string> = {
              'TL': 'Trích lục bản đồ địa chính',
              'TRÍCH LỤC': 'Trích lục bản đồ địa chính',
              'TĐ': 'Trích đo bản đồ địa chính',
              'TD': 'Trích đo bản đồ địa chính',
              'TRÍCH ĐO': 'Trích đo bản đồ địa chính',
              'ĐĐ': 'Đo đạc',
              'DD': 'Đo đạc',
              'ĐO ĐẠC': 'Đo đạc',
              'CM': 'Cắm mốc',
              'CẮM MỐC': 'Cắm mốc',
              'CL': 'Trích đo chỉnh lý bản đồ địa chính',
              'CHỈNH LÝ': 'Trích đo chỉnh lý bản đồ địa chính',
              'HIẾN ĐƯỜNG': 'Trích đo chỉnh lý bản đồ địa chính',
              'TÁCH THỬA': 'Tách thửa',
              'HỢP THỬA': 'Trích đo bản đồ địa chính',
              'CẤP ĐỔI': 'Trích đo bản đồ địa chính'
          };

          for (let i = headerRowIndex + 1; i < data.length; i++) {
              const row = data[i] as any[];
              if (!row || row.length === 0) continue;

              const getVal = (possibleHeaders: string[]) => {
                  const idx = headers.findIndex(h => possibleHeaders.some(ph => h.includes(ph)));
                  return idx !== -1 ? row[idx] : undefined;
              };

              const customerName = getVal(['CHỦ SỬ DỤNG', 'TÊN', 'HỌ TÊN']);
              if (!customerName) continue;

              const ward = getVal(['XÃ', 'PHƯỜNG', 'ĐỊA BÀN']) || '';
              
              let rawType = String(getVal(['LOẠI', 'LĨNH VỰC', 'LOAI HO SO', 'LOẠI HỒ SƠ']) || '').trim();
              let recordType = typeMapping[rawType.toUpperCase()];

              if (!recordType) {
                  const lower = rawType.toLowerCase();
                  if (lower.includes('trích lục')) recordType = 'Trích lục bản đồ địa chính';
                  else if (lower.includes('chỉnh lý') || lower.includes('hiến đường')) recordType = 'Trích đo chỉnh lý bản đồ địa chính';
                  else if (lower.includes('tách thửa')) recordType = 'Tách thửa';
                  else if (lower.includes('trích đo') || lower.includes('hợp thửa')) recordType = 'Trích đo bản đồ địa chính';
                  else if (lower.includes('đo đạc')) recordType = 'Đo đạc';
                  else if (lower.includes('cắm mốc')) recordType = 'Cắm mốc';
                  else if (rawType) recordType = rawType;
                  else recordType = RECORD_TYPES[0];
              }
              
              const authorizedBy = String(getVal(['NGƯỜI ỦY QUYỀN', 'ỦY QUYỀN', 'AUTHORIZED BY']) || '');
              const authDocType = String(getVal(['LOẠI ỦY QUYỀN', 'GIẤY ỦY QUYỀN', 'AUTH DOC']) || '');

              const receivedDate = new Date().toISOString();
              const deadline = calculateDeadline(String(recordType), receivedDate.split('T')[0]);

              newBulkRecords.push({
                  tempId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
                  isSaved: false,
                  customerName: String(customerName),
                  phoneNumber: String(getVal(['SĐT', 'ĐIỆN THOẠI']) || ''),
                  ward: String(ward),
                  landPlot: String(getVal(['THỬA']) || ''),
                  mapSheet: String(getVal(['TỜ']) || ''),
                  area: parseFloat(String(getVal(['DIỆN TÍCH']) || '0')),
                  address: String(getVal(['ĐỊA CHỈ']) || ''),
                  recordType: String(recordType),
                  receivedDate: receivedDate,
                  deadline: deadline,
                  status: RecordStatus.RECEIVED,
                  receivedBy: currentUser?.employeeId,
                  content: String(getVal(['NỘI DUNG', 'GHI CHÚ']) || ''),
                  authorizedBy: authorizedBy,
                  authDocType: authDocType,
                  code: ''
              });
          }
          setBulkRecords(newBulkRecords);
          if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
      };
      reader.readAsArrayBuffer(file);
  };

  const handleGenerateBulkCode = (index: number) => {
      setBulkRecords(prev => {
          const newList = [...prev];
          const record = newList[index];
          if (!record.ward) { alert("Vui lòng nhập Xã/Phường trước khi tạo mã."); return prev; }
          const existingBulkCodes = newList.map(r => r.code || '').filter(c => c !== '');
          const newCode = calculateNextCode(record.ward, record.receivedDate || '', existingBulkCodes);
          newList[index] = { ...record, code: newCode };
          return newList;
      });
  };

  const handleSaveBulkRecord = async (index: number) => {
      const record = bulkRecords[index];
      if (!record.code || !record.customerName) { alert("Thiếu mã hoặc tên."); return; }

      const newRecord: RecordFile = { 
          ...record, 
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
          receivedDate: record.receivedDate || new Date().toISOString(),
          deadline: record.deadline || '',
          status: RecordStatus.RECEIVED,
          receivedBy: currentUser?.employeeId
      } as RecordFile;

      const savedRecord = await onSave(newRecord);
      if (savedRecord) {
          setBulkRecords(prev => {
              const newList = [...prev];
              newList[index] = { ...newList[index], isSaved: true, code: savedRecord.code };
              return newList;
          });
      } else {
          alert("Lỗi khi lưu.");
      }
  };

  const updateBulkRecord = (index: number, field: keyof RecordFile, value: any) => {
      setBulkRecords(prev => {
          const newList = [...prev];
          const updated = { ...newList[index], [field]: value };
          if (field === 'recordType' || field === 'receivedDate') {
              const rType = field === 'recordType' ? value : updated.recordType;
              const rDate = field === 'receivedDate' ? value : updated.receivedDate;
              if (rType && rDate) updated.deadline = calculateDeadline(rType, rDate);
          }
          newList[index] = updated;
          return newList;
      });
  };

  const removeBulkRecord = async (index: number) => {
      if(await confirmAction('Bạn muốn xóa dòng này?')) setBulkRecords(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
                <h3 className="font-bold text-blue-800 text-lg flex items-center gap-2">
                    <Upload size={20} /> Nhập liệu hàng loạt từ Excel
                </h3>
                <p className="text-sm text-blue-600 mt-1">Chọn file Excel để nhập danh sách. Mã hồ sơ sẽ được để trống và tạo sau.</p>
            </div>
            <div className="flex gap-2">
                <button onClick={handleDownloadTemplate} className="bg-white text-green-700 border border-green-300 px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-100 flex items-center gap-2">
                    <Download size={16} /> Tải mẫu Excel
                </button>
                <button onClick={() => bulkFileInputRef.current?.click()} className="bg-white text-blue-700 border border-blue-300 px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-100 flex items-center gap-2">
                    <FileSpreadsheet size={16} /> Chọn File Excel
                </button>
                <input type="file" ref={bulkFileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleBulkImport} />
            </div>
        </div>

        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                <span className="font-bold text-gray-700">Danh sách chờ xử lý ({bulkRecords.length})</span>
                {bulkRecords.length > 0 && <span className="text-xs text-orange-600 italic">Lưu ý: Bấm "Tạo mã" &rarr; "Lưu" cho từng dòng.</span>}
            </div>
            <div className="overflow-auto flex-1">
                <table className="w-full text-left table-fixed min-w-[1200px]">
                    <thead className="bg-gray-100 text-xs text-gray-600 uppercase font-bold sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3 w-10 text-center">#</th>
                            <th className="p-3 w-[160px]">Mã Hồ Sơ</th>
                            <th className="p-3 w-[200px]">Chủ Sử Dụng</th>
                            <th className="p-3 w-[115px]">Loại Hồ Sơ</th>
                            <th className="p-3 w-[120px]">Xã / Phường</th>
                            <th className="p-3 w-[120px]">Hẹn Trả</th>
                            <th className="p-3 w-[200px] text-center">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {bulkRecords.length > 0 ? bulkRecords.map((item, idx) => (
                            <tr key={item.tempId} className={`hover:bg-blue-50/30 ${item.isSaved ? 'bg-green-50' : ''}`}>
                                <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                                <td className="p-3">
                                    <div className="flex gap-1">
                                        <input type="text" className={`w-full border rounded px-2 py-1 text-sm font-mono ${item.code ? 'border-blue-300 text-blue-700 font-bold' : 'border-gray-300 bg-gray-50'}`} placeholder="Chưa có mã" value={item.code || ''} onChange={(e) => updateBulkRecord(idx, 'code', e.target.value)} readOnly={item.isSaved} />
                                        {!item.isSaved && <button onClick={() => handleGenerateBulkCode(idx)} className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200" title="Tạo mã"><Wand2 size={14} /></button>}
                                    </div>
                                </td>
                                <td className="p-3"><input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={item.customerName ?? ''} onChange={(e) => updateBulkRecord(idx, 'customerName', e.target.value)} readOnly={item.isSaved} /></td>
                                <td className="p-3"><select className="w-full border border-gray-300 rounded px-2 py-1 text-sm outline-none" value={item.recordType ?? ''} onChange={(e) => updateBulkRecord(idx, 'recordType', e.target.value)} disabled={item.isSaved}> {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)} </select></td>
                                <td className="p-3"><input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={item.ward ?? ''} onChange={(e) => updateBulkRecord(idx, 'ward', e.target.value)} readOnly={item.isSaved} /></td>
                                <td className="p-3"><input type="date" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={dateVal(item.deadline)} onChange={(e) => updateBulkRecord(idx, 'deadline', e.target.value)} readOnly={item.isSaved} /></td>
                                <td className="p-3 text-center">
                                    <div className="flex justify-center gap-2">
                                        {item.isSaved ? <span className="flex items-center gap-1 text-green-600 font-bold px-3 py-1 bg-green-100 rounded text-xs"><Check size={14} /> Đã lưu</span> : <button onClick={() => handleSaveBulkRecord(idx)} disabled={!item.code} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 text-xs font-bold"><Save size={14} /> Lưu</button>}
                                        <button onClick={() => onPreview(item)} className="p-1.5 text-purple-600 border border-purple-200 rounded hover:bg-purple-50" title="In biên nhận"><Printer size={16} /></button>
                                        {!item.isSaved && <button onClick={() => removeBulkRecord(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa dòng"><X size={16} /></button>}
                                    </div>
                                </td>
                            </tr>
                        )) : <tr><td colSpan={7} className="p-12 text-center text-gray-400 italic">Chưa có dữ liệu.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default BulkImport;
