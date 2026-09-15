import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { PriceItem } from '../types';
import { savePriceListBatch } from '../services/api';
import { X, Save, Upload, FileSpreadsheet, Trash2, AlertCircle, Download, Plus, CheckCircle2, RotateCcw } from 'lucide-react';

interface PriceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPriceList: PriceItem[];
  onUpdate: () => void;
}

const PriceConfigModal: React.FC<PriceConfigModalProps> = ({ isOpen, onClose, currentPriceList, onUpdate }) => {
  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setItems(Array.isArray(currentPriceList) ? [...currentPriceList] : []);
      setStatusMessage(null);
    }
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

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const newItems: PriceItem[] = [];
        rows.forEach((row: any) => {
           const normalizedRow: Record<string, any> = {};
           Object.keys(row).forEach(k => {
               const cleanKey = k.trim().toUpperCase()
                   .replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A")
                   .replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E")
                   .replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I")
                   .replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O")
                   .replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U")
                   .replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y")
                   .replace(/Đ/g, "D")
                   .replace(/\s+/g, "");
               normalizedRow[cleanKey] = row[k];
           });
           
           const name = String(
               normalizedRow['TENSANPHAM'] || normalizedRow['TENSP'] || normalizedRow['DICHVU'] || normalizedRow['TENDICHVU'] || ''
           ).trim();
           
           if (name) {
               const vatPercentRaw = String(normalizedRow['VATISPERCENT'] || normalizedRow['VATPERCENT'] || 'TRUE').toUpperCase();
               const vatIsPercent = vatPercentRaw === 'TRUE' || vatPercentRaw === '1' || vatPercentRaw === 'YES';

               const rawPrice = normalizedRow['GIASANPHAM'] ?? normalizedRow['GIASP'] ?? normalizedRow['DONGIA'] ?? normalizedRow['GIA'] ?? 0;
               const cleanPrice = typeof rawPrice === 'string' ? Number(rawPrice.replace(/[^0-9]/g, '')) : Number(rawPrice || 0);

               newItems.push({
                   id: Math.random().toString(36).substr(2, 9),
                   serviceGroup: String(normalizedRow['LOAIHS'] || normalizedRow['LOAIHOSOVUPHA'] || normalizedRow['NHOMDICHVU'] || ''),
                   areaType: String(normalizedRow['KHUVUC'] || normalizedRow['KHUVUCDAT'] || ''),
                   serviceName: name,
                   minArea: Number(normalizedRow['DTMIN'] || normalizedRow['DIENTICHMIN'] || 0),
                   maxArea: Number(normalizedRow['DTMAX'] || normalizedRow['DIENTICHMAX'] || 99999999),
                   unit: String(normalizedRow['DONVI'] || normalizedRow['DONVITINH'] || 'Thửa'),
                   price: isNaN(cleanPrice) ? 0 : cleanPrice,
                   vatRate: Number(normalizedRow['VAT'] || normalizedRow['THUEVAT'] || 8),
                   vatIsPercent: vatIsPercent
               });
           }
        });

        if (newItems.length > 0) {
            setItems(newItems);
            setStatusMessage({ type: 'success', text: `Đã nhập thành công ${newItems.length} dịch vụ từ tệp Excel!` });
        } else {
            setStatusMessage({ type: 'error', text: 'Không tìm thấy dữ liệu phù hợp trong tệp Excel. Vui lòng kiểm tra các tiêu đề cột.' });
        }
      } catch (error) {
        console.error(error);
        setStatusMessage({ type: 'error', text: 'Lỗi khi đọc tệp Excel. Vui lòng kiểm tra lại định dạng tệp.' });
      } finally {
         if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAddItem = () => {
      const newItem: PriceItem = {
          id: Math.random().toString(36).substr(2, 9),
          serviceGroup: 'Đo đạc',
          areaType: 'Đất nông thôn',
          serviceName: 'Dịch vụ mới',
          minArea: 0,
          maxArea: 99999999,
          unit: 'Thửa',
          price: 1000000,
          vatRate: 8,
          vatIsPercent: true
      };
      setItems(prev => [newItem, ...prev]);
      setStatusMessage({ type: 'info', text: 'Đã thêm 1 dòng dịch vụ mới vào danh sách. Hãy chỉnh sửa thông tin bên dưới và bấm "Lưu Thay Đổi".' });
  };

  const handleUpdateItem = (index: number, field: keyof PriceItem, value: any) => {
      setItems(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], [field]: value };
          return updated;
      });
  };

  const handleDeleteItem = (index: number) => {
      setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
      if (items.length === 0) return;
      setItems([]);
      setStatusMessage({ type: 'info', text: 'Đã dọn dẹp danh sách bảng giá. Bấm "Lưu Thay Đổi" để cập nhật.' });
  };

  const handleSave = async () => {
      setLoading(true);
      setStatusMessage(null);
      try {
          const success = await savePriceListBatch(items);
          setLoading(false);
          if (success) {
              setStatusMessage({ type: 'success', text: 'Đã lưu cập nhật bảng giá thành công!' });
              onUpdate();
              setTimeout(() => {
                  onClose();
              }, 600);
          } else {
              setStatusMessage({ type: 'error', text: 'Không thể lưu bảng giá. Vui lòng thử lại.' });
          }
      } catch (err) {
          setLoading(false);
          console.error("Lỗi khi lưu bảng giá:", err);
          setStatusMessage({ type: 'error', text: 'Có lỗi xảy ra trong quá trình lưu dữ liệu.' });
      }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">
                Cấu hình Bảng giá Dịch vụ Hợp đồng
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Quản lý đơn giá, loại hồ sơ, khu vực và thuế VAT áp dụng cho các hợp đồng dịch vụ
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-slate-100/60 border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImportExcel}
                    accept=".xlsx, .xls"
                    className="hidden"
                />
                <button 
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-2 rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-xs text-xs font-bold"
                >
                    <Plus size={16} /> Thêm dịch vụ
                </button>
                <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 bg-emerald-600 text-white px-3.5 py-2 rounded-xl hover:bg-emerald-700 active:scale-95 transition-all shadow-xs text-xs font-bold"
                >
                    <Upload size={16} /> Import Excel
                </button>
                <button 
                    type="button"
                    onClick={handleDownloadSample}
                    className="flex items-center gap-1.5 bg-white text-slate-700 border border-slate-300 px-3.5 py-2 rounded-xl hover:bg-slate-50 active:scale-95 transition-all shadow-xs text-xs font-bold"
                >
                    <Download size={16} /> Tải file mẫu
                </button>
                {items.length > 0 && (
                    <button 
                        type="button"
                        onClick={handleClearAll}
                        className="flex items-center gap-1.5 bg-rose-50 text-rose-600 border border-rose-200 px-3 py-2 rounded-xl hover:bg-rose-100 active:scale-95 transition-all text-xs font-bold ml-2"
                    >
                        <Trash2 size={15} /> Xóa tất cả ({items.length})
                    </button>
                )}
            </div>
            
            <div className="text-[11px] text-slate-600 font-semibold flex items-center bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                <AlertCircle size={14} className="mr-1.5 text-amber-600 shrink-0"/>
                Cột Excel cần: LOAIHS, KHUVUC, TENSANPHAM, DTMIN, DTMAX, DONVI, GIASANPHAM, VAT, VAT_IS_PERCENT
            </div>
        </div>

        {/* Notification Status Banner */}
        {statusMessage && (
            <div className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
                statusMessage.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : statusMessage.type === 'error'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
                <div className="flex items-center gap-2">
                    {statusMessage.type === 'success' && <CheckCircle2 size={16} className="text-emerald-600" />}
                    {statusMessage.type === 'error' && <AlertCircle size={16} className="text-rose-600" />}
                    {statusMessage.type === 'info' && <AlertCircle size={16} className="text-blue-600" />}
                    <span>{statusMessage.text}</span>
                </div>
                <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                </button>
            </div>
        )}

        {/* Table Container */}
        <div className="flex-1 overflow-y-auto p-0 bg-slate-50/30">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-[11px] font-black text-slate-600 uppercase tracking-wider sticky top-0 shadow-2xs z-10">
                    <tr>
                        <th className="p-3 border-b border-slate-200 w-32">Loại HS</th>
                        <th className="p-3 border-b border-slate-200 w-36">Khu vực</th>
                        <th className="p-3 border-b border-slate-200">Tên sản phẩm / Dịch vụ</th>
                        <th className="p-3 border-b border-slate-200 text-center w-24">DT Min</th>
                        <th className="p-3 border-b border-slate-200 text-center w-24">DT Max</th>
                        <th className="p-3 border-b border-slate-200 text-center w-24">ĐVT</th>
                        <th className="p-3 border-b border-slate-200 text-right w-36">Đơn giá (VNĐ)</th>
                        <th className="p-3 border-b border-slate-200 text-center w-20">VAT (%)</th>
                        <th className="p-3 border-b border-slate-200 text-center w-12">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100 bg-white">
                    {items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-blue-50/30 transition-colors">
                            {/* Loại HS */}
                            <td className="p-2">
                                <input 
                                    type="text" 
                                    value={item.serviceGroup || ''}
                                    onChange={(e) => handleUpdateItem(idx, 'serviceGroup', e.target.value)}
                                    placeholder="Loại HS..."
                                    className="w-full px-2 py-1 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 text-xs"
                                />
                            </td>
                            {/* Khu vực */}
                            <td className="p-2">
                                <input 
                                    type="text" 
                                    value={item.areaType || ''}
                                    onChange={(e) => handleUpdateItem(idx, 'areaType', e.target.value)}
                                    placeholder="Khu vực..."
                                    className="w-full px-2 py-1 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 text-xs"
                                />
                            </td>
                            {/* Tên sản phẩm */}
                            <td className="p-2">
                                <input 
                                    type="text" 
                                    value={item.serviceName || ''}
                                    onChange={(e) => handleUpdateItem(idx, 'serviceName', e.target.value)}
                                    placeholder="Tên sản phẩm/dịch vụ..."
                                    className="w-full px-2 py-1 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 font-semibold text-slate-800 text-xs"
                                />
                            </td>
                            {/* DT Min */}
                            <td className="p-2">
                                <input 
                                    type="number" 
                                    value={item.minArea ?? 0}
                                    onChange={(e) => handleUpdateItem(idx, 'minArea', Number(e.target.value))}
                                    className="w-full px-1.5 py-1 text-center border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 font-mono text-slate-700 text-xs"
                                />
                            </td>
                            {/* DT Max */}
                            <td className="p-2">
                                <input 
                                    type="number" 
                                    value={item.maxArea ?? 99999999}
                                    onChange={(e) => handleUpdateItem(idx, 'maxArea', Number(e.target.value))}
                                    className="w-full px-1.5 py-1 text-center border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 font-mono text-slate-700 text-xs"
                                />
                            </td>
                            {/* ĐVT */}
                            <td className="p-2">
                                <input 
                                    type="text" 
                                    value={item.unit || 'Thửa'}
                                    onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                                    className="w-full px-1.5 py-1 text-center border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 text-xs"
                                />
                            </td>
                            {/* Đơn giá */}
                            <td className="p-2">
                                <input 
                                    type="number" 
                                    value={item.price ?? 0}
                                    onChange={(e) => handleUpdateItem(idx, 'price', Number(e.target.value))}
                                    className="w-full px-2 py-1 text-right font-mono font-bold text-blue-700 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 text-xs"
                                />
                            </td>
                            {/* VAT */}
                            <td className="p-2">
                                <input 
                                    type="number" 
                                    value={item.vatRate ?? 8}
                                    onChange={(e) => handleUpdateItem(idx, 'vatRate', Number(e.target.value))}
                                    className="w-full px-1 py-1 text-center font-mono font-semibold text-slate-700 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 text-xs"
                                />
                            </td>
                            {/* Thao tác */}
                            <td className="p-2 text-center">
                                <button 
                                    type="button"
                                    onClick={() => handleDeleteItem(idx)}
                                    title="Xóa dòng"
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {items.length === 0 && (
                        <tr>
                            <td colSpan={9} className="p-12 text-center">
                                <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                    <FileSpreadsheet size={36} className="text-slate-300 stroke-[1.5]" />
                                    <p className="font-semibold text-slate-600 text-sm">Chưa có dữ liệu bảng giá hợp đồng</p>
                                    <p className="text-xs text-slate-400">
                                        Bấm nút <strong className="text-blue-600">"+ Thêm dịch vụ"</strong> hoặc <strong className="text-emerald-600">"Import Excel"</strong> để bổ sung danh mục bảng giá.
                                    </p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-slate-500">
                Tổng số dịch vụ: <strong className="text-slate-800 font-bold">{items.length}</strong> dòng
            </div>
            <div className="flex items-center gap-3">
                <button 
                    type="button"
                    onClick={onClose} 
                    className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-bold text-xs transition-all"
                >
                    Đóng
                </button>
                <button 
                    type="button"
                    onClick={handleSave} 
                    disabled={loading} 
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md active:scale-95 transition-all text-xs font-bold disabled:opacity-50"
                >
                    <Save size={16} /> {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default PriceConfigModal;
