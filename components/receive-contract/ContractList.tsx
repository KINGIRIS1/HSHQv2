import React, { useState, useEffect, useMemo } from 'react';
import { Contract, User, Employee, UserRole } from '../../types';
import { fetchContracts } from '../../services/api';
import { Search, RotateCcw, Edit, Printer, FileCheck, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface ContractListProps {
  contracts?: Contract[];
  onEdit: (c: Contract) => void;
  onDelete: (id: string) => void;
  onPrint: (c: Contract, type: 'contract' | 'liquidation') => void;
  onCreateLiquidation: (c: Contract) => void;
  viewMode: 'contract' | 'liquidation'; // Prop mới
  currentUser: User;
  employees: Employee[];
}

const ContractList: React.FC<ContractListProps> = ({ contracts: propContracts, onEdit, onDelete, onPrint, onCreateLiquidation, viewMode, currentUser, employees }) => {
  const [contracts, setContracts] = useState<Contract[]>(propContracts || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const loadContracts = async () => {
      setLoading(true);
      const data = await fetchContracts();
      setContracts(data);
      setLoading(false);
  };

  useEffect(() => {
      if (propContracts) {
          setContracts(propContracts);
      } else {
          loadContracts();
      }
  }, [propContracts]);

  // Reset page to 1 when search or viewMode changes
  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, viewMode]);

  const filtered = useMemo(() => {
      let list = [...contracts];
      
      // Sắp xếp danh sách hợp đồng/thanh lý theo ngày lập từ mới nhất đến cũ nhất
      list.sort((a, b) => {
          const timeA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
          const timeB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
          return timeB - timeA;
      });

      // Trong danh sách Thanh lý: Chỉ hiển thị các hợp đồng ĐÃ ĐƯỢC THANH LÝ THỰC TẾ (có liquidationAmount > 0 và liquidationDate)
      if (viewMode === 'liquidation') {
          list = list.filter(c => (c.contractType === 'Đo đạc' || c.contractType === 'Cắm mốc') && Boolean(c.liquidationAmount && c.liquidationAmount > 0 && c.liquidationDate));
      }

      if (!searchTerm) return list;
      const lower = searchTerm.toLowerCase();
      return list.filter(c => 
          (c.code || '').toLowerCase().includes(lower) || 
          (c.customerName || '').toLowerCase().includes(lower) ||
          (c.ward || '').toLowerCase().includes(lower)
      );
  }, [contracts, searchTerm, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

  const paginatedList = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const isLiquidationMode = viewMode === 'liquidation';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden animate-fade-in">
        <div className={`p-3 sm:p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0 ${isLiquidationMode ? 'bg-orange-50' : 'bg-purple-50'}`}>
            <h3 className={`font-bold text-base sm:text-lg ${isLiquidationMode ? 'text-orange-800' : 'text-purple-800'}`}>
                {isLiquidationMode ? 'Danh sách Thanh Lý' : 'Danh sách Hợp Đồng'}
            </h3>

            <div className="flex items-center gap-2 ml-auto">
                <div className="relative w-64 sm:w-72 md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm mã HĐ, khách hàng..." 
                        className="w-full pl-9 pr-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white shadow-2xs" 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                </div>
                <button onClick={loadContracts} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg border border-gray-200 bg-white" title="Tải lại"> 
                    <RotateCcw size={16} /> 
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-left table-fixed min-w-[1000px]">
                <thead className={`text-xs uppercase font-semibold sticky top-0 shadow-sm ${isLiquidationMode ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>
                    <tr> 
                        <th className="p-4 w-12 text-center">STT</th> 
                        <th className="p-4 w-[120px]">Số HĐ</th> 
                        <th className="p-4 w-[200px]">Khách hàng</th> 
                        <th className="p-4 w-[150px]">Loại HĐ</th> 
                        <th className="p-4 w-[120px]">Ngày lập</th> 
                        
                        {/* Cột hiển thị tiền thay đổi theo mode */}
                        {!isLiquidationMode && <th className="p-4 text-right w-[150px]">Giá trị HĐ</th>}
                        {isLiquidationMode && <th className="p-4 text-right w-[150px]">Giá trị HĐ</th>}
                        {isLiquidationMode && <th className="p-4 text-right w-[150px] bg-orange-200">Giá trị Thanh Lý</th>}
                        
                        <th className="p-4 text-center w-[160px]">Thao tác</th> 
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                    {paginatedList.length > 0 ? (
                        paginatedList.map((c, index) => (
                            <tr key={c.id} className={`hover:bg-purple-50/40 transition-colors ${isLiquidationMode ? 'hover:bg-orange-50/40' : ''}`}>
                                <td className="p-4 text-center text-gray-400 align-middle">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                <td className="p-4 font-bold text-gray-900 align-middle">{c.code}</td>
                                <td className="p-4 align-middle">
                                    <div className="font-medium text-gray-900">{c.customerName}</div>
                                    <div className="text-xs text-gray-500 truncate max-w-[200px]" title={c.customerAddress || ''}>{c.customerAddress}</div>
                                </td>
                                <td className="p-4 align-middle"><span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{c.contractType}</span></td>
                                <td className="p-4 text-gray-500 align-middle">{c.createdDate}</td>
                                
                                {/* Cột hiển thị tiền */}
                                {!isLiquidationMode && (
                                    <td className="p-4 text-right font-bold text-gray-900 align-middle">
                                        {(c.totalAmount || 0).toLocaleString('vi-VN')} đ
                                    </td>
                                )}
                                {isLiquidationMode && (
                                    <>
                                        <td className="p-4 text-right font-medium text-gray-500 align-middle">
                                            {(c.totalAmount || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="p-4 text-right font-bold text-orange-700 bg-orange-50/30 align-middle">
                                            {(c.liquidationAmount || 0).toLocaleString('vi-VN')} đ
                                        </td>
                                    </>
                                )}

                                <td className="p-4 text-center align-middle">
                                    <div className="flex justify-center gap-1">
                                        {/* Actions change based on viewMode */}
                                        {!isLiquidationMode ? (
                                            <>
                                                <button onClick={() => onEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Sửa Hợp Đồng"><Edit size={16} /></button>
                                                <button onClick={() => onPrint(c, 'contract')} className="p-1.5 text-purple-600 hover:bg-purple-100 rounded transition-colors" title="Xem trước & In Hợp Đồng"><Printer size={16} /></button>
                                                {(c.contractType === 'Đo đạc' || c.contractType === 'Cắm mốc') && <button onClick={() => onCreateLiquidation(c)} className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors" title="Chuyển sang Thanh Lý"><FileCheck size={16} /></button>}
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => onCreateLiquidation(c)} className="p-1.5 text-orange-600 hover:bg-orange-100 rounded transition-colors" title="Sửa/Lưu Thanh Lý"><Edit size={16} /></button>
                                                <button onClick={() => onPrint(c, 'liquidation')} className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors" title="Xem trước & In Thanh Lý"><Printer size={16} /></button>
                                            </>
                                        )}
                                        
                                        {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUBADMIN) && (
                                            <button onClick={() => onDelete(c.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors" title="Xóa"><Trash2 size={16} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : ( 
                        <tr><td colSpan={8} className="p-8 text-center text-gray-400">Không tìm thấy dữ liệu.</td></tr> 
                    )}
                </tbody>
            </table>
        </div>

        {/* STANDARDIZED PAGINATION FOOTER */}
        {filtered.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-white flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 text-xs">
                <span className="text-gray-500">
                    Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filtered.length)}</strong> trên tổng <strong className={isLiquidationMode ? "text-orange-700" : "text-purple-700"}>{filtered.length}</strong> bản ghi
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

export default ContractList;
