
import React, { useState, useEffect, useMemo } from 'react';
import { Contract, User, Employee, UserRole } from '../../types';
import { fetchContracts } from '../../services/api';
import { Search, RotateCcw, Edit, Printer, FileCheck, Trash2, Loader2, DollarSign, ExternalLink } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';

interface ContractListProps {
  onEdit: (c: Contract) => void;
  onDelete: (id: string) => void;
  onPrint: (c: Contract, type: 'contract' | 'liquidation') => void;
  onCreateLiquidation: (c: Contract) => void;
  viewMode: 'contract' | 'liquidation'; // Prop mới
  currentUser: User;
  employees: Employee[];
}

const ContractList: React.FC<ContractListProps> = ({ onEdit, onDelete, onPrint, onCreateLiquidation, viewMode, currentUser, employees }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const loadContracts = async () => {
      setLoading(true);
      const data = await fetchContracts();
      setContracts(data);
      setLoading(false);
  };

  useEffect(() => { loadContracts(); }, []);

  const filtered = useMemo(() => {
      let list = contracts;
      
      // Bỏ lọc theo quyền ONEDOOR để nhân viên Một cửa tra cứu được tất cả hợp đồng

      // Chỉ cho phép thanh lý với các hồ sơ 2.3 (Đo đạc) và 2.4 (Cắm mốc)
      if (viewMode === 'liquidation') {
          list = list.filter(c => c.contractType === 'Đo đạc' || c.contractType === 'Cắm mốc');
      }

      if (!searchTerm) return list;
      const lower = searchTerm.toLowerCase();
      return list.filter(c => 
          (c.code || '').toLowerCase().includes(lower) || 
          (c.customerName || '').toLowerCase().includes(lower) ||
          (c.ward || '').toLowerCase().includes(lower)
      );
  }, [contracts, searchTerm]);

  const isLiquidationMode = viewMode === 'liquidation';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden animate-fade-in">
        <div className={`p-4 border-b border-gray-200 flex items-center gap-3 shrink-0 ${isLiquidationMode ? 'bg-orange-50' : 'bg-purple-50'}`}>
            <h3 className={`font-bold text-lg ${isLiquidationMode ? 'text-orange-800' : 'text-purple-800'}`}>
                {isLiquidationMode ? 'Danh sách Thanh Lý' : 'Danh sách Hợp Đồng'}
            </h3>
            <div className="relative flex-1 max-w-sm ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Tìm kiếm..." 
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
            </div>
            <button onClick={loadContracts} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full" title="Tải lại"> 
                <RotateCcw size={18} /> 
            </button>
        </div>
        <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-left table-fixed min-w-[1000px]">
                <thead className={`text-xs uppercase font-semibold sticky top-0 shadow-sm ${isLiquidationMode ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>
                    <tr> 
                        <th className="p-4 w-12 text-center">STT</th> 
                        <th className="p-4 w-[120px]">Mã HĐ</th> 
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
                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                    {loading ? (
                        <tr>
                            <td colSpan={8} className="p-8 text-center">
                                <div className="flex items-center justify-center">
                                    <Loader2 className="animate-spin inline mr-2"/> Đang tải...
                                </div>
                            </td>
                        </tr>
                    ) : filtered.length > 0 ? (
                        filtered.map((c, index) => (
                            <tr key={c.id} className={`transition-colors group ${isLiquidationMode ? 'hover:bg-orange-50/50' : 'hover:bg-purple-50/50'}`}>
                                <td className="p-4 text-center text-gray-400 align-middle">{index + 1}</td>
                                <td className={`p-4 font-medium truncate align-middle ${isLiquidationMode ? 'text-orange-700' : 'text-purple-700'}`} title={c.code}>{c.code}</td>
                                <td className="p-4 font-medium truncate align-middle" title={c.customerName}>{c.customerName}</td>
                                <td className="p-4 align-middle"> 
                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs border border-gray-200">{c.contractType || 'Khác'}</span> 
                                </td>
                                <td className="p-4 text-gray-500 align-middle">{c.createdDate ? new Date(c.createdDate).toLocaleDateString('vi-VN') : '-'}</td>
                                
                                {/* Cột tiền */}
                                {!isLiquidationMode && <td className="p-4 text-right font-mono font-bold text-gray-800 align-middle">{c.totalAmount?.toLocaleString('vi-VN')}</td>}
                                
                                {isLiquidationMode && (
                                    <>
                                        <td className="p-4 text-right font-mono text-gray-500 align-middle">{c.totalAmount?.toLocaleString('vi-VN')}</td>
                                        <td className="p-4 text-right font-mono font-bold text-orange-700 align-middle bg-orange-50/30">
                                            {c.liquidationAmount ? c.liquidationAmount.toLocaleString('vi-VN') : '-'}
                                        </td>
                                    </>
                                )}

                                <td className="p-4 text-center align-middle">
                                    <div className="flex justify-center gap-1">
                                        {/* Actions change based on viewMode */}
                                        {!isLiquidationMode ? (
                                            <>
                                                <button onClick={() => onEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Sửa Hợp Đồng"><Edit size={16} /></button>
                                                <button onClick={() => onPrint(c, 'contract')} className="p-1.5 text-purple-600 hover:bg-purple-100 rounded transition-colors" title="Mở Hợp đồng"><ExternalLink size={16} /></button>
                                                {(c.contractType === 'Đo đạc' || c.contractType === 'Cắm mốc') && <button onClick={() => onCreateLiquidation(c)} className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors" title="Chuyển sang Thanh Lý"><FileCheck size={16} /></button>}
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => onCreateLiquidation(c)} className="p-1.5 text-orange-600 hover:bg-orange-100 rounded transition-colors" title="Sửa/Lưu Thanh Lý"><Edit size={16} /></button>
                                                <button onClick={() => onPrint(c, 'liquidation')} className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors" title="Mở Thanh Lý"><ExternalLink size={16} /></button>
                                            </>
                                        )}
                                        
                                        {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUBADMIN) && (
                                            <button onClick={async () => { if(await confirmAction('Xóa hợp đồng này?')) { onDelete(c.id); } }} className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors" title="Xóa"><Trash2 size={16} /></button>
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
    </div>
  );
};

export default ContractList;
