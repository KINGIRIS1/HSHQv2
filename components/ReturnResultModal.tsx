import React, { useState, useEffect } from 'react';
import { RecordFile } from '../types';
import { X, CheckCircle2, FileCheck, User, Receipt, DollarSign, Loader2, FileText } from 'lucide-react';
import { fetchContracts } from '../services/api';

interface ReturnResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  onConfirm: (receiptNumber: string, receiverName: string, returnedPrice: number, receiptType?: 'Biên Lai' | 'Hóa Đơn', returnReason?: string) => void;
}

const ReturnResultModal: React.FC<ReturnResultModalProps> = ({ 
  isOpen, onClose, record, onConfirm 
}) => {
  const [receiptType, setReceiptType] = useState<'Biên Lai' | 'Hóa Đơn'>('Biên Lai');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [returnedPrice, setReturnedPrice] = useState<string>('');
  const [returnReason, setReturnReason] = useState<string>('');
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const recTypeLower = (record?.recordType || '').toLowerCase();
  const isFreeProcedure = recTypeLower.includes('2.3') || recTypeLower.includes('dđ & cc số thửa') || recTypeLower.includes('dd & cc so thua');

  useEffect(() => {
    if (isOpen && record) {
        setReceiptType((record.receiptType as 'Biên Lai' | 'Hóa Đơn') || 'Biên Lai');
        setReceiptNumber(record.receiptNumber || '');
        setReceiverName(record.receiverName || record.customerName || '');
        setReturnReason('');
        setErrorMsg('');
        
        if (isFreeProcedure) {
            setReturnedPrice('0');
            return;
        }

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

                // 2. Nếu là Cung cấp tài liệu đất đai hoặc 1.2 Công văn
                const type = (record.recordType || '').toLowerCase();
                if (type.includes('cung cấp tài liệu') || type.includes('cung cấp tldđ') || type.includes('cung cấp tlđđ') || type.includes('1.2') || type.includes('công văn') || type.includes('cong van')) {
                    setReturnedPrice('310000');
                    return;
                }

                // 3. Tra cứu hợp đồng
                const fetchedContracts = await fetchContracts();
                const match = fetchedContracts.find(c => {
                    if (!c || !record) return false;
                    const cAddr = (c.customerAddress || '').trim().toLowerCase();
                    const cCode = (c.code || '').trim().toLowerCase();
                    const rCode = (record.code || '').trim().toLowerCase();
                    const cName = (c.customerName || '').trim().toLowerCase();
                    const rName = (record.customerName || '').trim().toLowerCase();
                    const cPlot = (c.landPlot || '').trim().toLowerCase();
                    const rPlot = (record.landPlot || '').trim().toLowerCase();
                    const cMap = (c.mapSheet || '').trim().toLowerCase();
                    const rMap = (record.mapSheet || '').trim().toLowerCase();

                    const clean = (str: string) => str.replace(/[^a-z0-9]/gi, '').toLowerCase();

                    if (rCode && (cAddr === rCode || cCode === rCode)) return true;
                    if (rCode && cCode && clean(rCode).length >= 3 && clean(rCode) === clean(cCode)) return true;
                    if (rCode && cAddr && clean(rCode).length >= 3 && clean(rCode) === clean(cAddr)) return true;
                    if (rName && cName && rName === cName) {
                        if (rPlot && cPlot && rPlot === cPlot) return true;
                        if (rMap && cMap && rMap === cMap) return true;
                    }
                    return false;
                });
                
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
  }, [isOpen, record, isFreeProcedure]);

  if (!isOpen || !record) return null;

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg('');

      if (!receiverName.trim()) {
          setErrorMsg('Vui lòng nhập họ tên người nhận kết quả!');
          return;
      }

      if (isFreeProcedure) {
          onConfirm('', receiverName.trim(), 0, undefined, returnReason.trim());
          onClose();
          return;
      }

      if (!receiptNumber.trim()) {
          setErrorMsg(`Vui lòng nhập số ${receiptType.toLowerCase()}!`);
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

      onConfirm(receiptNumber.trim(), receiverName.trim(), priceNum, receiptType, returnReason.trim());
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-fade-in-up border border-emerald-100">
        
        {/* Header */}
        <div className="px-5 py-4 bg-emerald-50/80 border-b border-emerald-100 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-emerald-900 text-lg flex items-center gap-2 leading-snug">
                    <FileCheck size={20} className="text-emerald-700" /> Trả Kết Quả Hồ Sơ
                </h3>
                <p className="text-xs text-emerald-600 font-bold font-mono mt-0.5">{record.code}</p>
            </div>
            <button 
                type="button"
                onClick={onClose} 
                className="text-gray-400 hover:text-gray-600 bg-white/80 hover:bg-white p-1.5 rounded-full transition-colors shadow-sm"
            >
                <X size={18}/>
            </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl animate-pulse">
                    {errorMsg}
                </div>
            )}

            <div className="space-y-4">
                {isFreeProcedure && (
                    <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                        <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">Miễn phí</span>
                        <span>Thủ tục 2.3 không thu phí (không có Biên lai/Hóa đơn).</span>
                    </div>
                )}

                {/* Field 1: Số Biên lai / Hóa đơn with toggle */}
                {!isFreeProcedure && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-gray-800 flex items-center gap-2">
                                <Receipt size={18} className="text-blue-600"/> 
                                <span>Số {receiptType === 'Biên Lai' ? 'Biên Lai' : 'Hóa Đơn'}</span> 
                                <span className="text-red-500">*</span>
                            </label>
                            <div className="bg-gray-100 p-0.5 rounded-lg flex items-center gap-1 border border-gray-200 text-xs font-medium">
                                <button
                                    type="button"
                                    onClick={() => setReceiptType('Biên Lai')}
                                    className={`px-3 py-1 rounded-md transition-all ${receiptType === 'Biên Lai' ? 'bg-white text-emerald-700 font-bold shadow-sm border border-emerald-200' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    Biên Lai
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setReceiptType('Hóa Đơn')}
                                    className={`px-3 py-1 rounded-md transition-all ${receiptType === 'Hóa Đơn' ? 'bg-white text-emerald-700 font-bold shadow-sm border border-emerald-200' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    Hóa Đơn
                                </button>
                            </div>
                        </div>
                        <input 
                            type="text"
                            required
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium text-gray-800 placeholder:text-gray-400"
                            placeholder={`Nhập số ${receiptType.toLowerCase()}...`}
                            value={receiptNumber}
                            onChange={(e) => setReceiptNumber(e.target.value)}
                        />
                    </div>
                )}

                {/* Field 2: Số tiền */}
                {!isFreeProcedure && (
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <DollarSign size={18} className="text-amber-500"/> 
                            <span>Số tiền (VNĐ)</span> 
                            <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input 
                                type="number"
                                required
                                min="0"
                                className="w-full border border-gray-300 rounded-xl pl-4 pr-12 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-emerald-700 placeholder:text-gray-400"
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
                            <p className="text-xs text-emerald-700 font-bold mt-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg inline-block border border-emerald-100">
                                Thành tiền: {parseFloat(returnedPrice).toLocaleString('vi-VN')} đ
                            </p>
                        )}
                    </div>
                )}

                {/* Field 3: Người nhận kết quả */}
                <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <User size={18} className="text-purple-600"/> 
                        <span>Người nhận kết quả</span> 
                        <span className="text-red-500">*</span>
                    </label>
                    <input 
                        type="text"
                        required
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium text-gray-800 placeholder:text-gray-400 uppercase"
                        placeholder="Họ tên người đến nhận..."
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                    />
                </div>

                {/* Field 4: Lý do / Nội dung trả kết quả */}
                <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <FileText size={18} className="text-blue-600"/> 
                        <span>Nội dung / Lý do trả kết quả (Ghi chú)</span> 
                    </label>
                    <input 
                        type="text"
                        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium text-gray-800 placeholder:text-gray-400"
                        placeholder="Ví dụ: Đã nhận GCN, Đã bàn giao kết quả..."
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                    />
                </div>
            </div>

            {/* Note notice */}
            <div className="bg-gray-50/90 p-3.5 rounded-xl text-xs text-gray-600 leading-relaxed border border-gray-200/80 italic">
                Lưu ý: Hệ thống sẽ tự động cập nhật trạng thái hồ sơ thành <strong className="text-gray-800 not-italic">Đã trả kết quả</strong> và ghi nhận ngày trả là hôm nay.
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-end gap-3 items-center">
                <button 
                    type="button" 
                    onClick={onClose} 
                    className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 font-medium text-sm transition-colors"
                >
                    Hủy bỏ
                </button>
                <button 
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95"
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
