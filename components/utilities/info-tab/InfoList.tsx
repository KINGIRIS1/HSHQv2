
import React, { useState, useMemo } from 'react';
import { Search, Edit, Trash2, Calendar, FileText, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { ThongTinRecord } from '../../../services/apiUtilities';
import { confirmAction } from '../../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface InfoListProps {
    data: ThongTinRecord[];
    onEdit: (item: ThongTinRecord) => void;
    onDelete: (id: string) => void;
    onRefresh: () => void;
    onPrint: (item: ThongTinRecord) => void;
}

const InfoList: React.FC<InfoListProps> = ({ data, onEdit, onDelete, onRefresh, onPrint }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = (item.customer_name || '').toLowerCase().includes(searchLower) || 
                                  (item.data.formData?.Ten_Nguoi_Yeu_Cau || '').toLowerCase().includes(searchLower);
            
            let matchesDate = true;
            if (filterDate) {
                const itemDate = item.created_at.split('T')[0];
                matchesDate = itemDate === filterDate;
            }
            return matchesSearch && matchesDate;
        });
    }, [data, searchTerm, filterDate]);

    const handleDelete = async (id: string) => {
        if (await confirmAction("Xóa phiếu cung cấp thông tin này?")) {
            onDelete(id);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    const handleExportExcel = () => {
        if (filteredData.length === 0) { alert("Không có dữ liệu."); return; }
        const dataRows = filteredData.map((item, index) => {
            const d = item.data?.formData || {};
            return [
                index + 1,
                d.Ten_Nguoi_Yeu_Cau,
                item.customer_name, // Ten CSD
                d.Phuong,
                `${d.To_Cu || '-'} / ${d.Thua_Cu || '-'}`,
                formatDate(item.created_at),
                item.created_by
            ];
        });
        const headers = ['STT', 'Người yêu cầu', 'Chủ sử dụng', 'Địa chỉ đất', 'Tờ/Thửa', 'Ngày lập', 'Người lập'];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([["DANH SÁCH PHIẾU CUNG CẤP THÔNG TIN"], ["Data Export"], [""], headers, ...dataRows]);
        ws['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, "DS_CCTT");
        XLSX.writeFile(wb, `DS_CCTT_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center bg-gray-50 rounded-t-lg">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder="Tìm tên chủ sử dụng hoặc người yêu cầu..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 bg-white px-2 py-1 border border-gray-300 rounded-lg">
                    <Calendar size={16} className="text-gray-500" />
                    <input type="date" className="text-sm border-none outline-none text-gray-700 cursor-pointer" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                    {filterDate && <button onClick={() => setFilterDate('')} className="text-xs text-red-500 font-bold hover:underline">Xóa</button>}
                </div>
                <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm transition-colors text-sm font-bold">
                    <FileSpreadsheet size={18} /> Xuất Excel
                </button>
                <button onClick={onRefresh} className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-600" title="Tải lại">
                    <RefreshCw size={18} />
                </button>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3 w-12 text-center">STT</th>
                            <th className="p-3">Người yêu cầu</th>
                            <th className="p-3">Chủ sử dụng (GCN)</th>
                            <th className="p-3">Xã / Phường</th>
                            <th className="p-3 text-center">Tờ / Thửa (Cũ)</th>
                            <th className="p-3 text-center">Ngày lập</th>
                            <th className="p-3">Người lập</th>
                            <th className="p-3 text-center w-40">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-100">
                        {filteredData.length > 0 ? filteredData.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                                <td className="p-3 text-center text-gray-500">{idx + 1}</td>
                                <td className="p-3 font-bold text-blue-700">{item.data.formData?.Ten_Nguoi_Yeu_Cau}</td>
                                <td className="p-3 font-bold text-gray-800">{item.customer_name}</td>
                                <td className="p-3 text-gray-600 text-xs">{item.data.formData?.Phuong}</td>
                                <td className="p-3 text-center font-mono text-xs">{item.data.formData?.To_Cu || '-'} / {item.data.formData?.Thua_Cu || '-'}</td>
                                <td className="p-3 text-center text-gray-600 font-mono text-xs">{formatDate(item.created_at)}</td>
                                <td className="p-3 text-gray-600 text-xs">{item.created_by}</td>
                                <td className="p-3 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => onPrint(item)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded border border-transparent hover:border-purple-200" title="Xem & In"><FileText size={16}/></button>
                                        <button onClick={() => onEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200" title="Sửa"><Edit size={16}/></button>
                                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded border border-transparent hover:border-red-200" title="Xóa"><Trash2 size={16}/></button>
                                    </div>
                                </td>
                            </tr>
                        )) : <tr><td colSpan={8} className="p-8 text-center text-gray-400 italic">Không tìm thấy dữ liệu.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default InfoList;
