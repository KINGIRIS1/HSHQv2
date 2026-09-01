
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import { PriceItem } from '../types';
import { savePriceListBatch } from '../services/api';
import { X, Save, Upload, FileSpreadsheet, Trash2, AlertCircle, Download } from 'lucide-react';
import { confirmAction } from '../utils/appHelpers';

interface PriceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPriceList: PriceItem[];
  onUpdate: () => void;
}

const PriceConfigModal: React.FC<PriceConfigModalProps> = ({ isOpen, onClose, currentPriceList, onUpdate }) => {
  const [items, setItems] = useState<PriceItem[]>(currentPriceList);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) setItems(currentPriceList);
  }, [isOpen, currentPriceList]);

  if (!isOpen) return null;

  const handleDownloadSample = () => {
      const headers = ["LOAIHS", "KHUVUC", "TENSANPHAM", "DTMIN", "DTMAX", "DONVI", "GIASANPHAM", "VAT", "VAT_IS_PERCENT"];
      const data = [
          ["Đo đạc", "Đất nông thôn", "Đo đạc diện tích dưới 500m2", 0, 500, "Thửa", 1000000, 10, "TRUE"],
          ["Đo đạc", "Đất đô thị", "Đo đạc diện tích dưới 500m2", 0, 500, "Thửa", 1200000, 10, "TRUE"],
          ["Cắm mốc", "Đất nông thôn", "Cắm mốc ranh giới", 0, 99999, "Mốc", 300000, 8, "FALSE"]
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bang_Gia_Mau");
      XLSX.writeFile(wb, "Bang_Gia_Mau.xlsx");
  };

  // --- LOGIC NHẬP EXCEL (FIXED) ---
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        // FIX: Đổi 'binary' -> 'array'
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const newItems: PriceItem[] = [];
        // Map theo hình ảnh user cung cấp
        // Headers: LOAIHS, KhuVuc, TenSanPham, DTMin, DTMax, Donvi, GiaSanPham, VAT, VAT_IS_PERCENT
        rows.forEach((row: any) => {
           const normalizedRow: Record<string, any> = {};
           Object.keys(row).forEach(k => normalizedRow[k.trim().toUpperCase()] = row[k]);
           
           const name = String(normalizedRow['TENSANPHAM'] || normalizedRow['TÊN SẢN PHẨM'] || '');
           
           if (name) {
               const vatPercentRaw = String(normalizedRow['VAT_IS_PERCENT'] || 'TRUE').toUpperCase();
               const vatIsPercent = vatPercentRaw === 'TRUE' || vatPercentRaw === '1' || vatPercentRaw === 'YES';

               newItems.push({
                   id: Math.random().toString(36).substr(2, 9),
                   serviceGroup: String(normalizedRow['LOAIHS'] || ''),
                   areaType: String(normalizedRow['KHUVUC'] || ''),
                   serviceName: name,
                   minArea: Number(normalizedRow['DTMIN'] || 0),
                   maxArea: Number(normalizedRow['DTMAX'] || 99999999),
                   unit: String(normalizedRow['DONVI'] || 'Thửa'),
                   price: Number(normalizedRow['GIASANPHAM'] || 0),
                   vatRate: Number(normalizedRow['VAT'] || 8),
                   vatIsPercent: vatIsPercent
               });
           }
        });

        if (newItems.length > 0) {
            setItems(newItems);
            alert(`Đã đọc được ${newItems.length} dòng từ Excel.`);
        } else {
            alert('Không tìm thấy dữ liệu phù hợp. Vui lòng kiểm tra tên cột trong Excel (TenSanPham, GiaSanPham, DTMin, DTMax, VAT_IS_PERCENT...).');
        }
      } catch (error) {
        console.error(error);
        alert('Lỗi đọc file Excel.');
      } finally {
         if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    // FIX: Sử dụng readAsArrayBuffer
    reader.readAsArrayBuffer(file);
  };

  const handleSave = async () => {
      if (!(await confirmAction("Hành động này sẽ thay thế toàn bộ bảng giá hiện tại. Bạn có chắc chắn không?"))) return;
      
      setLoading(true);
      const success = await savePriceListBatch(items);
      setLoading(false);
      if (success) {
          alert("Đã cập nhật bảng giá thành công!");
          onUpdate();
          onClose();
      } else {
          alert("Lỗi khi lưu bảng giá.");
      }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="text-green-600"/> Cấu hình Bảng giá Dịch vụ
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 bg-gray-50 border-b flex gap-3 items-center justify-between">
            <div className="flex gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImportExcel}
                    accept=".xlsx, .xls"
                    className="hidden"
                />
                <button 
                    onClick={handleDownloadSample}
                    className="flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors shadow-sm font-medium text-sm"
                >
                    <Download size={16} /> Tải file mẫu
                </button>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium text-sm"
                >
                    <Upload size={16} /> Import Excel
                </button>
            </div>
            <div className="text-xs text-gray-500 flex items-center bg-yellow-50 p-2 rounded border border-yellow-200">
                <AlertCircle size={14} className="mr-1 text-yellow-600"/>
                Cột Excel cần: LOAIHS, KhuVuc, TenSanPham, DTMin, DTMax, Donvi, GiaSanPham, VAT, VAT_IS_PERCENT
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-left border-collapse">
                <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0 shadow-sm">
                    <tr>
                        <th className="p-3 border-b">Loại HS</th>
                        <th className="p-3 border-b">Khu vực</th>
                        <th className="p-3 border-b">Tên sản phẩm</th>
                        <th className="p-3 border-b text-center">DT Min</th>
                        <th className="p-3 border-b text-center">DT Max</th>
                        <th className="p-3 border-b text-center">ĐVT</th>
                        <th className="p-3 border-b text-right">Đơn giá</th>
                        <th className="p-3 border-b text-center">VAT</th>
                    </tr>
                </thead>
                <tbody className="text-sm">
                    {items.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-2 text-gray-600">{item.serviceGroup}</td>
                            <td className="p-2 text-gray-600">{item.areaType}</td>
                            <td className="p-2 font-medium text-gray-800">{item.serviceName}</td>
                            <td className="p-2 text-center text-gray-600">{item.minArea}</td>
                            <td className="p-2 text-center text-gray-600">{item.maxArea}</td>
                            <td className="p-2 text-center text-gray-600">{item.unit}</td>
                            <td className="p-2 text-right font-mono font-bold text-blue-700">{item.price?.toLocaleString('vi-VN')}</td>
                            <td className="p-2 text-center text-gray-600">
                                {item.vatRate}{item.vatIsPercent ? '%' : ''}
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr>
                            <td colSpan={8} className="p-8 text-center text-gray-400">Chưa có dữ liệu bảng giá. Hãy Import từ Excel.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        <div className="p-4 border-t bg-white flex justify-end gap-3 rounded-b-lg">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Hủy
            </button>
            <button onClick={handleSave} disabled={loading || items.length === 0} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm disabled:opacity-50">
                <Save size={18} /> {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default PriceConfigModal;
