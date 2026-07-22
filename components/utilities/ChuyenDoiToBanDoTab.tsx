import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Upload, Trash2, FileSpreadsheet, Loader2, Search, Download, MapPin, Grid, Building2, ChevronLeft, ChevronRight, X, Edit2 } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { NotifyFunction } from '../../types';
import { fetchMapSheetConversions, saveMapSheetConversions, deleteAllMapSheetConversions, MapSheetConversion } from '../../services/apiUtilities';

interface Props {
    notify: NotifyFunction;
}

const ChuyenDoiToBanDoTab: React.FC<Props> = ({ notify }) => {
    const [data, setData] = useState<MapSheetConversion[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Filter states
    const [searchXaPhuong, setSearchXaPhuong] = useState('');
    const [searchSoTo, setSearchSoTo] = useState('');
    const [appliedXaPhuong, setAppliedXaPhuong] = useState('');
    const [appliedSoTo, setAppliedSoTo] = useState('');
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    // Popup state
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [popupType, setPopupType] = useState<'old' | 'new'>('old');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await fetchMapSheetConversions();
            setData(result);
        } catch (error) {
            notify('Lỗi khi tải dữ liệu chuyển đổi', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const headers = ["Xã phường cũ", "Số tờ cũ", "Xã phường mới", "Số tờ mới"];
        const sampleData = [
            ["Phường Thạch Thang", "T05", "Phường Thạch Thang", "T12"],
            ["Phường Hòa Thuận Đông", "T08", "Phường Hòa Thuận Đông", "T21"]
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        ws['!cols'] = [{wch: 25}, {wch: 15}, {wch: 25}, {wch: 15}];
        XLSX.utils.book_append_sheet(wb, ws, "ChuyenDoi");
        XLSX.writeFile(wb, "Mau_Chuyen_Doi_To_Ban_Do.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const ab = evt.target?.result;
                const wb = XLSX.read(ab, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                if (jsonData.length < 2) {
                    notify('File Excel không có dữ liệu', 'error');
                    return;
                }

                let headerRowIdx = 0;
                for (let i = 0; i < Math.min(5, jsonData.length); i++) {
                    const row = jsonData[i];
                    if (row && row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('xã phường cũ'))) {
                        headerRowIdx = i;
                        break;
                    }
                }

                const newConversions: Partial<MapSheetConversion>[] = [];
                for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length < 4) continue;
                    
                    const xa_phuong_cu = row[0]?.toString().trim();
                    const so_to_cu = row[1]?.toString().trim();
                    const xa_phuong_moi = row[2]?.toString().trim();
                    const so_to_moi = row[3]?.toString().trim();

                    if (xa_phuong_cu && so_to_cu && xa_phuong_moi && so_to_moi) {
                        newConversions.push({
                            xa_phuong_cu,
                            so_to_cu,
                            xa_phuong_moi,
                            so_to_moi
                        });
                    }
                }

                if (newConversions.length > 0) {
                    handleSaveData(newConversions);
                } else {
                    notify('Không tìm thấy dữ liệu hợp lệ trong file', 'error');
                }
            } catch (error) {
                console.error(error);
                notify('Lỗi khi đọc file Excel', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSaveData = async (newConversions: Partial<MapSheetConversion>[]) => {
        setSaving(true);
        try {
            const success = await saveMapSheetConversions(newConversions);
            if (success) {
                notify(`Đã lưu ${newConversions.length} bản ghi thành công`, 'success');
                loadData();
            } else {
                notify('Lỗi khi lưu dữ liệu vào hệ thống', 'error');
            }
        } catch (error) {
            notify('Lỗi khi lưu dữ liệu', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu chuyển đổi? Hành động này không thể hoàn tác.')) return;
        
        setSaving(true);
        try {
            const success = await deleteAllMapSheetConversions();
            if (success) {
                notify('Đã xóa toàn bộ dữ liệu', 'success');
                setData([]);
            } else {
                notify('Lỗi khi xóa dữ liệu', 'error');
            }
        } catch (error) {
            notify('Lỗi khi xóa dữ liệu', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSearch = () => {
        setAppliedXaPhuong(searchXaPhuong);
        setAppliedSoTo(searchSoTo);
        setCurrentPage(1);
    };

    const handleReset = () => {
        setSearchXaPhuong('');
        setSearchSoTo('');
        setAppliedXaPhuong('');
        setAppliedSoTo('');
        setCurrentPage(1);
    };

    // Derived data
    const uniqueOldWards = useMemo(() => Array.from(new Set(data.map(d => d.xa_phuong_cu))).sort(), [data]);
    const uniqueNewWards = useMemo(() => Array.from(new Set(data.map(d => d.xa_phuong_moi))).sort(), [data]);

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const matchXaPhuong = appliedXaPhuong ? item.xa_phuong_cu === appliedXaPhuong : true;
            const matchSoTo = appliedSoTo ? item.so_to_cu.toLowerCase().includes(appliedSoTo.toLowerCase()) : true;
            return matchXaPhuong && matchSoTo;
        });
    }, [data, appliedXaPhuong, appliedSoTo]);

    // Pagination logic
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Summary logic
    const oldWardStats = useMemo(() => {
        const stats: Record<string, number> = {};
        data.forEach(d => {
            stats[d.xa_phuong_cu] = (stats[d.xa_phuong_cu] || 0) + 1;
        });
        return Object.entries(stats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    }, [data]);

    const newWardStats = useMemo(() => {
        const stats: Record<string, number> = {};
        data.forEach(d => {
            stats[d.xa_phuong_moi] = (stats[d.xa_phuong_moi] || 0) + 1;
        });
        return Object.entries(stats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    }, [data]);

    const openPopup = (type: 'old' | 'new') => {
        setPopupType(type);
        setIsPopupOpen(true);
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] animate-fade-in overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-4 flex justify-between items-start shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Chuyển đổi tờ bản đồ</h2>
                    <p className="text-slate-500 text-sm mt-1">Quản lý và đồng bộ dữ liệu giữa các đơn vị hành chính cũ và mới.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <Download size={18} /> Tải tệp mẫu
                    </button>
                    <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        Nhập từ Excel
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden px-6 pb-6 gap-6">
                
                {/* Sidebar Filter */}
                <div className="w-72 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col shrink-0 h-fit">
                    <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                        <Search className="text-blue-600" size={20} />
                        <h3 className="font-bold text-slate-800">Tra cứu thông tin</h3>
                    </div>
                    <div className="p-4 flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tìm theo xã phường cũ</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <select 
                                    value={searchXaPhuong}
                                    onChange={(e) => setSearchXaPhuong(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none text-slate-700 font-medium"
                                >
                                    <option value="">Tất cả xã phường</option>
                                    {uniqueOldWards.map(w => <option key={w} value={w}>{w}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tìm theo số tờ cũ</label>
                            <div className="relative">
                                <Grid className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Nhập số tờ (ví dụ: T05)" 
                                    value={searchSoTo}
                                    onChange={(e) => setSearchSoTo(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                            <button 
                                onClick={handleSearch}
                                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                            >
                                Tìm kiếm
                            </button>
                            <button 
                                onClick={handleReset}
                                className="w-full bg-white text-slate-600 border border-slate-200 py-2.5 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                            >
                                Làm mới
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Table Area */}
                <div className="flex-1 flex flex-col gap-6 min-w-0">
                    
                    {/* Table Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Thông tin chuyển đổi</h3>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-slate-500 font-medium">Đã chọn: <span className="text-blue-600">0</span></span>
                                {data.length > 0 && (
                                    <button 
                                        onClick={handleDeleteAll}
                                        disabled={saving}
                                        className="flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 size={16} /> Xóa tất cả
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            {loading ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader2 className="animate-spin text-blue-500" size={32} />
                                </div>
                            ) : paginatedData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                                    <FileSpreadsheet size={48} className="opacity-20" />
                                    <p>Không có dữ liệu hiển thị.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-white text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-4 text-center w-16">STT</th>
                                            <th className="px-6 py-4">XÃ PHƯỜNG CŨ</th>
                                            <th className="px-6 py-4 text-center">SỐ TỜ CŨ</th>
                                            <th className="px-6 py-4">XÃ PHƯỜNG MỚI <span className="text-slate-400">↓</span></th>
                                            <th className="px-6 py-4 text-center">SỐ TỜ MỚI</th>
                                            <th className="px-6 py-4 text-center w-24">THAO TÁC</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginatedData.map((row, index) => (
                                            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 text-center text-slate-500">
                                                    {String((currentPage - 1) * itemsPerPage + index + 1).padStart(2, '0')}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-700">{row.xa_phuong_cu}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-block bg-slate-100 text-slate-600 px-3 py-1 rounded-md font-bold text-xs">
                                                        {row.so_to_cu}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-blue-600">{row.xa_phuong_moi}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-block bg-blue-50 text-blue-600 px-3 py-1 rounded-md font-bold text-xs">
                                                        {row.so_to_moi}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center gap-2 text-slate-400">
                                                        <button className="hover:text-blue-600 transition-colors"><Edit2 size={16} /></button>
                                                        <button className="hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        {filteredData.length > 0 && (
                            <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white">
                                <span className="text-sm text-slate-500">
                                    Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} trong tổng số {filteredData.length} bản ghi
                                </span>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    
                                    {/* Simple pagination numbers for demo */}
                                    {[...Array(Math.min(3, totalPages))].map((_, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`w-8 h-8 rounded-md text-sm font-medium ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    {totalPages > 3 && <span className="px-1 text-slate-400">...</span>}
                                    {totalPages > 3 && (
                                        <button 
                                            onClick={() => setCurrentPage(totalPages)}
                                            className={`w-8 h-8 rounded-md text-sm font-medium ${currentPage === totalPages ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {totalPages}
                                        </button>
                                    )}

                                    <button 
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Summary Cards */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">TỔNG HỢP SỐ LƯỢNG</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                    <Building2 size={24} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">XÃ PHƯỜNG CŨ</p>
                                    <p className="text-3xl font-black text-slate-800 leading-none mt-1">{uniqueOldWards.length}</p>
                                    <button onClick={() => openPopup('old')} className="text-xs text-blue-600 hover:underline mt-1 font-medium">Xem chi tiết</button>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                    <Building2 size={24} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">XÃ PHƯỜNG MỚI</p>
                                    <p className="text-3xl font-black text-slate-800 leading-none mt-1">{uniqueNewWards.length}</p>
                                    <button onClick={() => openPopup('new')} className="text-xs text-indigo-600 hover:underline mt-1 font-medium">Xem chi tiết</button>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                    <Grid size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">TỔNG SỐ TỜ BẢN ĐỒ</p>
                                    <p className="text-3xl font-black text-slate-800 leading-none mt-1">{data.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Summary Details Popup */}
            {isPopupOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh] animate-scale-up">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">
                                Chi tiết số lượng tờ bản đồ
                            </h3>
                            <button onClick={() => setIsPopupOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 bg-slate-50 border-b">
                            <p className="text-sm text-slate-600">
                                Thống kê theo <span className="font-bold text-blue-600">{popupType === 'old' ? 'Xã phường cũ' : 'Xã phường mới'}</span>
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <ul className="space-y-2">
                                {(popupType === 'old' ? oldWardStats : newWardStats).map((stat, idx) => (
                                    <li key={idx} className="flex justify-between items-center p-3 bg-white border rounded-lg shadow-sm">
                                        <span className="font-medium text-slate-700">{stat.name}</span>
                                        <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-full text-sm">
                                            {stat.count} tờ
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex justify-end">
                            <button 
                                onClick={() => setIsPopupOpen(false)}
                                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChuyenDoiToBanDoTab;
