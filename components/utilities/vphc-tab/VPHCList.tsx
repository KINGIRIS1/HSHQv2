import React, { useState, useMemo, useEffect } from 'react';
import { Edit, Trash2, FileText, Gavel, ChevronLeft, ChevronRight } from 'lucide-react';
import { VphcRecord } from '../../../services/apiUtilities';
import { confirmAction } from '../../../utils/appHelpers';

interface VPHCListProps {
    data: VphcRecord[];
    onEdit: (item: VphcRecord) => void;
    onDelete: (id: string) => void;
    onRefresh: () => void;
    onPrint: (item: VphcRecord) => void;
}

const VPHCList: React.FC<VPHCListProps> = ({ data, onEdit, onDelete, onPrint }) => {
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Reset pagination when data changes
    useEffect(() => {
        setCurrentPage(1);
    }, [data]);

    const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return data.slice(startIndex, startIndex + itemsPerPage);
    }, [data, currentPage, itemsPerPage]);

    const handleDelete = async (item: VphcRecord) => {
        const codeNumber = item.customer_name || item.id;
        if (await confirmAction(`Bạn có đồng ý xóa biên bản của ${codeNumber} không?`, 'Xác nhận xóa hồ sơ')) {
            onDelete(item.id);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* TABLE */}
            <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3.5 w-12 text-center">STT</th>
                            <th className="p-3.5">Họ và tên</th>
                            <th className="p-3.5">Loại biên bản</th>
                            <th className="p-3.5">Ngày lập</th>
                            <th className="p-3.5">Người lập</th>
                            <th className="p-3.5 text-center w-36">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-100">
                        {paginatedData.length > 0 ? paginatedData.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                                <td className="p-3.5 text-center text-gray-500">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                <td className="p-3.5">
                                    <div className="font-bold text-gray-800">{item.customer_name}</div>
                                    <div className="text-xs text-gray-500 truncate max-w-[280px]" title={item.data?.DC_THUA || item.data?.NOIO}>
                                        {item.data?.DC_THUA || item.data?.NOIO || '...'}
                                    </div>
                                </td>
                                <td className="p-3.5">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.record_type === 'mau01' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                        {item.record_type === 'mau01' ? <Gavel size={12}/> : <FileText size={12}/>}
                                        {item.record_type === 'mau01' ? 'Biên bản VPHC' : 'Biên bản Làm việc'}
                                    </span>
                                </td>
                                <td className="p-3.5 text-gray-600 font-mono text-xs">{formatDate(item.created_at)}</td>
                                <td className="p-3.5 text-gray-600 text-xs">{item.created_by}</td>
                                <td className="p-3.5 text-center">
                                    <div className="flex justify-center gap-1.5">
                                        <button 
                                            onClick={() => onPrint(item)} 
                                            className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer" 
                                            title="Xem & In"
                                        >
                                            <FileText size={16}/>
                                        </button>
                                        <button 
                                            onClick={() => onEdit(item)} 
                                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer" 
                                            title="Sửa"
                                        >
                                            <Edit size={16}/>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(item)} 
                                            className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors cursor-pointer" 
                                            title="Xóa"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-400 italic">Không tìm thấy dữ liệu phù hợp.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* STANDARDIZED PAGINATION FOOTER */}
            {data.length > 0 && (
                <div className="p-3 border-t border-gray-200 bg-white flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 text-xs">
                    <span className="text-gray-500">
                        Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, data.length)}</strong> trên tổng <strong>{data.length}</strong> biên bản
                    </span>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-gray-500">
                            <span>Số dòng:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="border border-gray-300 rounded px-2 py-1 bg-white text-xs outline-none focus:ring-1 focus:ring-blue-500 font-bold cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-gray-600"
                                title="Trang trước"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <span className="font-medium mx-2 text-gray-700">
                                Trang {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-gray-600"
                                title="Trang sau"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VPHCList;
