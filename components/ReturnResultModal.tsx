import React, { useState, useEffect } from 'react';
import { RecordFile, RecordStatus } from '../types';
import AutoResizeTextarea from './AutoResizeTextarea';
import { X, CheckCircle2, FileCheck, User, Receipt, DollarSign, Loader2, AlertCircle, FileText } from 'lucide-react';
import { fetchContracts } from '../services/api';
import { isProcedure2_3 } from '../utils/appHelpers';

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

  // Tự động nhận diện hồ sơ Trả hủy / CSD rút hồ sơ / Thủ tục 2.3 (Miễn thu phí)
  const isFeeExempt = Boolean(
    record?.status === RecordStatus.REJECTED || 
    record?.status === RecordStatus.WITHDRAWN ||
    isProcedure2_3(record?.recordType) ||
    (record?.statusLogs && record.statusLogs.some(l => l.newStatus === RecordStatus.REJECTED || l.newStatus === RecordStatus.WITHDRAWN || l.note?.includes('Trả hủy') || l.note?.includes('rút hồ sơ') || l.note?.includes('Miễn thu phí') || l.note?.includes('Thủ tục 2.3')))
  );
  
  useEffect(() => {
    if (isOpen && record) {
        setReceiptType((record.receiptType as 'Biên Lai' | 'Hóa Đơn') || 'Biên Lai');
        setReceiptNumber(record.receiptNumber || '');
        setReceiverName(record.receiverName || record.customerName || '');
        setReturnReason('');
        setErrorMsg('');

        // Nếu là hồ sơ miễn thu phí (Trả hủy / CSD rút / Thủ tục 2.3)
        if (record.status === RecordStatus.REJECTED || record.status === RecordStatus.WITHDRAWN || isProcedure2_3(record.recordType)) {
            setReturnedPrice('0');
            setReceiptNumber('');
            return;
        }
        
        const determinePrice = async () => {
            setIsLoadingPrice(true);
            try {
                if (isProcedure2_3(record.recordType)) {
                    setReturnedPrice('0');
                    return;
                }
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
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg('');

      if (isFeeExempt) {
          if (!receiverName.trim()) {
              setErrorMsg('Vui lòng nhập họ tên người đến nhận lại hồ sơ!');
              return;
          }
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

      if (!receiverName.trim()) {
          setErrorMsg('Vui lòng nhập họ tên người nhận kết quả!');
          return;
      }

      onConfirm(receiptNumber.trim(), receiverName.trim(), priceNum, receiptType, returnReason.trim());
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-fade-in-up border ${isFeeExempt ? 'border-amber-200' : 'border-emerald-100'}`}>
        
        {/* Header */}
        <div className={`px-5 py-4 ${isFeeExempt ? 'bg-amber-50/90 border-amber-200' : 'bg-emerald-50/80 border-emerald-100'} border-b flex justify-between items-center`}>
            <div>
                <h3 className={`font-bold ${isFeeExempt ? 'text-amber-900' : 'text-emerald-900'} text-lg flex items-center gap-2 leading-snug`}>
                    <FileCheck size={20} className={isFeeExempt ? 'text-amber-700' : 'text-emerald-700'} /> 
                    {isFeeExempt ? 'Bàn Giao Trả Hồ Sơ' : 'Trả Kết Quả Hồ Sơ'}
                </h3>
                <p className={`text-xs ${isFeeExempt ? 'text-amber-700' : 'text-emerald-600'} font-bold font-mono mt-0.5`}>
                    {record.code} {record.customerName ? `— ${record.customerName}` : ''}
                </p>
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

            {/* Thông báo miễn thu phí nếu là Trả hủy, CSD rút hồ sơ hoặc Thủ tục 2.3 */}
            {isFeeExempt ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 shadow-xs">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                        <AlertCircle size={18} className="text-amber-600 shrink-0" />
                        <span>
                            {record.status === RecordStatus.WITHDRAWN ? 'Hồ sơ CSD rút hồ sơ' : 
                             record.status === RecordStatus.REJECTED ? 'Hồ sơ Trả hủy' : 
                             'Hồ sơ Thủ tục 2.3'}
                        </span>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                        {isProcedure2_3(record.recordType) && record.status !== RecordStatus.WITHDRAWN && record.status !== RecordStatus.REJECTED
                            ? 'Thủ tục 2.3 Duyệt đơn — Tự động nhận diện & <strong>Miễn thu phí</strong>, không phát hành Hóa đơn/Biên lai.'
                            : 'Hồ sơ Trả hủy / CSD rút hồ sơ — <strong>Miễn thu phí</strong> và <strong>không phát hành Hóa đơn/Biên lai</strong>.'}
                    </p>
                </div>
            ) : null}

            <div className="space-y-4">
                {/* Khi không thuộc diện miễn phí: Nhập Số Biên lai / Hóa đơn & Số tiền */}
                {!isFeeExempt && (
                    <>
                        {/* Field 1: Số Biên lai / Hóa đơn with toggle */}
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

                        {/* Field 2: Số tiền */}
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
                    </>
                )}

                {/* Field 3: Người nhận kết quả / nhận lại hồ sơ */}
                <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <User size={18} className={isFeeExempt ? 'text-amber-600' : 'text-purple-600'}/> 
                        <span>{isFeeExempt ? 'Họ tên người đến nhận lại hồ sơ' : 'Người nhận kết quả'}</span> 
                        <span className="text-red-500">*</span>
                    </label>
                    <input 
                        type="text"
                        required
                        className={`w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 ${isFeeExempt ? 'focus:ring-amber-500 focus:border-amber-500' : 'focus:ring-emerald-500 focus:border-emerald-500'} outline-none font-medium text-gray-800 placeholder:text-gray-400 uppercase`}
                        placeholder={isFeeExempt ? "Họ tên người đến nhận lại hồ sơ..." : "Họ tên người đến nhận..."}
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                    />
                </div>

                {/* Field 4: Lý do / Nội dung bàn giao trả (nếu có) */}
                <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <FileText size={18} className="text-blue-600"/> 
                        <span>Lý do / Nội dung bàn giao trả</span>
                        <span className="text-xs font-normal text-gray-400">(Tùy chọn)</span>
                    </label>
                    <AutoResizeTextarea 
                        className={`w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 ${isFeeExempt ? 'focus:ring-amber-500 focus:border-amber-500' : 'focus:ring-emerald-500 focus:border-emerald-500'} outline-none font-medium text-gray-800 placeholder:text-gray-400`}
                        placeholder={isFeeExempt ? "Ghi chú lý do trả hoặc tình trạng giấy tờ khi bàn giao..." : "Nội dung ghi chú thêm khi trả kết quả (nếu có)..."}
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                    />
                </div>
            </div>

            {/* Note notice */}
            <div className="bg-gray-50/90 p-3.5 rounded-xl text-xs text-gray-600 leading-relaxed border border-gray-200/80 italic">
                {isFeeExempt ? (
                    <span>Lưu ý: Hệ thống sẽ tự động cập nhật trạng thái hồ sơ thành <strong className="text-gray-800 not-italic">Đã trả kết quả</strong> (với mức phí <strong>0đ - Miễn thu phí</strong>) và ghi nhận ngày trả là hôm nay.</span>
                ) : (
                    <span>Lưu ý: Hệ thống sẽ tự động cập nhật trạng thái hồ sơ thành <strong className="text-gray-800 not-italic">Đã trả kết quả</strong> và ghi nhận ngày trả là hôm nay.</span>
                )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex justify-end gap-3 items-center">
                <button 
                    type="button" 
                    onClick={onClose} 
                    className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 font-medium text-sm transition-colors cursor-pointer"
                >
                    Hủy bỏ
                </button>
                <button 
                    type="submit"
                    className={`flex items-center gap-2 px-5 py-2.5 ${isFeeExempt ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 cursor-pointer`}
                >
                    <CheckCircle2 size={18} /> {isFeeExempt ? 'Xác nhận bàn giao trả' : 'Xác nhận trả kết quả'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ReturnResultModal;

