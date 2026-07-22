import React, { useState, useEffect } from 'react';
import { RecordFile } from '../types';
import { X, CheckCircle2, FileCheck, User, Receipt, DollarSign, Loader2 } from 'lucide-react';
import { fetchContracts } from '../services/api';

interface ReturnResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  onConfirm: (receiptNumber: string, receiverName: string, returnedPrice: number) => void;
}

const ReturnResultModal: React.FC<ReturnResultModalProps> = ({ 
  isOpen, onClose, record, onConfirm 
}) => {
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [returnedPrice, setReturnedPrice] = useState<string>('');
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  useEffect(() => {
    if (isOpen && record) {
        setReceiptNumber(record.receiptNumber || '');
        setReceiverName(record.receiverName || record.customerName || '');
        setErrorMsg('');
        
        const determinePrice = async () => {
            setIsLoadingPrice(true);
            try {
                // 1. Nếu hồ sơ đã có returnedPrice hoặc price được lưu
                if (record.returnedPrice !== undefined && record.returnedPrice !== null) {
                    setReturnedPrice(record.returnedPrice.toString());
                    return;
                }
                if (record.price && record.price > 0) {
                    setReturnedPrice(record.price.toString());
                    return;
                }

                // 2. Nếu là Cung cấp tài liệu đất đai
                const type = (record.recordType || '').toLowerCase();
                if (type.includes('cung cấp tài liệu') || type.includes('cung cấp tldđ') || type.includes('cung cấp tlđđ')) {
                    setReturnedPrice('310000');
                    return;
                }

                // 3. Tra cứu hợp đồng
                const fetchedContracts = await fetchContracts();
                const match = fetchedContracts.find(c => 
                    (c.customerAddress && record.code && c.customerAddress.trim().toLowerCase() === record.code.trim().toLowerCase()) ||
                    (c.code && record.code && c.code.trim().toLowerCase() === record.code.trim().toLowerCase())
                );
                
                if (match) {
                    const priceVal = match.liquidationAmount !== null && match.liquidationAmount !== undefined
                        ? match.liquidationAmount
                        : (match.totalAmount ?? 0);
                    setReturnedPrice(priceVal.toString());
                    return;
                }

                // 4. Nếu là Trích lục bản đồ địa chính
                if (type.includes('trích lục')) {
                    setReturnedPrice('53163');
                    return;
                }

                setReturnedPrice('0');
            } catch (err) {
                console.error("Error loading default price:", err);
                setReturnedPrice('0');
            } finally {
                setIsLoadingPrice(false);
            }
        };

        determinePrice();
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg('');

      if (!receiptNumber.trim()) {
          setErrorMsg('Vui lòng nhập số biên lai/hoá đơn!');
          return;
      }

      if (!returnedPrice.trim()) {
          setErrorMsg('Vui lòng nhập số tiền thực tế trước khi trả kết quả!');
          return;
      }

      const priceNum = parseFloat(returnedPrice);
      if (isNaN(priceNum) || priceNum < 0) {
          setErrorMsg('Vui lòng nhập số tiền hợp lệ!');
          return;
      }

      if (!receiverName.trim()) {
          setErrorMsg('Vui lòng nhập họ tên người nhận kết quả!');
          return;
      }

      onConfirm(receiptNumber.trim(), receiverName.trim(), priceNum);
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="p-5 border-b bg-emerald-50 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-emerald-800 text-lg flex items-center gap-2">
                    <FileCheck size={20} /> Trả Kết Quả Hồ Sơ
                </h3>
                <p className="text-xs text-emerald-600 mt-1 font-mono font-bold">{record.code}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 bg-white/50 p-1 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm font-bold rounded-lg animate-pulse">
                    {errorMsg}
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <Receipt size={16} className="text-blue-600"/> Số Biên Lai/Hoá Đơn <span className="text-red-500">*</span>
                    </label>
                    <input 
                        type="text"
                        required
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium"
                        placeholder="Nhập số biên lai/hoá đơn..."
                        value={receiptNumber}
                        onChange={(e) => setReceiptNumber(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <DollarSign size={16} className="text-emerald-600"/> Số Tiền Thực Tế Thu <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input 
                            type="number"
                            required
                            min="0"
                            className="w-full border border-gray-300 rounded-lg pl-4 pr-12 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-emerald-700"
                            placeholder="Nhập số tiền..."
                            value={returnedPrice}
                            onChange={(e) => setReturnedPrice(e.target.value)}
                            disabled={isLoadingPrice}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                            {isLoadingPrice ? <Loader2 size={16} className="animate-spin text-emerald-500" /> : 'đ'}
                        </div>
                    </div>
                    {returnedPrice.trim() && !isNaN(parseFloat(returnedPrice)) && (
                        <p className="text-xs text-green-600 font-bold mt-1 bg-green-50 px-2 py-1 rounded inline-block">
                            Thành tiền: {parseFloat(returnedPrice).toLocaleString('vi-VN')} đ
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <User size={16} className="text-purple-600"/> Người nhận kết quả <span className="text-red-500">*</span>
                    </label>
                    <input 
                        type="text"
                        required
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        placeholder="Họ tên người đến nhận..."
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500 italic border border-gray-200">
                Lưu ý: Hệ thống sẽ tự động cập nhật trạng thái hồ sơ thành <strong>Đã trả kết quả</strong> và ghi nhận số tiền, số biên lai, và ngày trả là hôm nay.
            </div>

            <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium text-sm transition-colors">
                    Hủy bỏ
                </button>
                <button 
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold text-sm shadow-md transition-all active:scale-95"
                >
                    <CheckCircle2 size={18} /> Xác nhận trả
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ReturnResultModal;
