import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, FileCheck, CheckCircle, Loader2 } from 'lucide-react';
import { RecordFile, DossierComponentItem } from '../../types';
import DossierComponentSection from './DossierComponentSection';

interface SignApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: RecordFile | null;
  records?: RecordFile[];
  onConfirm: (targetRecords: RecordFile[], newComponents?: DossierComponentItem[]) => Promise<void> | void;
}

export const SignApprovalModal: React.FC<SignApprovalModalProps> = ({
  isOpen,
  onClose,
  record,
  records,
  onConfirm,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [isOpen]);
  
  const effectiveRecords = useMemo(() => {
    if (records && records.length > 0) return records;
    if (record) return [record];
    return [];
  }, [record, records]);

  const isMultiple = effectiveRecords.length > 1;
  const primaryRecord = effectiveRecords[0] || null;

  // Thành phần hồ sơ cho trường hợp ký đơn lẻ 1 hồ sơ
  const initialComponents: DossierComponentItem[] = useMemo(() => {
    if (!primaryRecord || isMultiple) return [];
    if (Array.isArray(primaryRecord.dossierComponents)) return primaryRecord.dossierComponents;
    if (typeof primaryRecord.dossierComponents === 'string') {
      try {
        const parsed = JSON.parse(primaryRecord.dossierComponents);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [primaryRecord, isMultiple]);

  const [components, setComponents] = useState<DossierComponentItem[]>(initialComponents);

  useEffect(() => {
    setComponents(initialComponents);
  }, [initialComponents]);

  if (!isOpen || effectiveRecords.length === 0) return null;

  const handleConfirmSign = async () => {
    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onConfirm(effectiveRecords, isMultiple ? undefined : components);
      onClose();
    } catch (err) {
      console.error('Lỗi khi ký duyệt hồ sơ:', err);
      alert('Đã xảy ra lỗi trong quá trình ký duyệt hồ sơ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 ${isMultiple ? 'max-w-md' : 'max-w-2xl'} w-full overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up`}>
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileCheck size={22} className="text-purple-200" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {isMultiple ? `Ký duyệt ${effectiveRecords.length} hồ sơ` : `Ký duyệt hồ sơ: ${primaryRecord?.code}`}
              </h3>
              <p className="text-xs text-purple-200 mt-0.5">
                {isMultiple ? `Ký duyệt đợt ${effectiveRecords.length} hồ sơ` : `Đính kèm kết quả & ký duyệt hồ sơ`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-slate-700">
          {isMultiple ? (
            /* KÝ HÀNG LOẠT: Chỉ hiển thị duy nhất thông điệp "Ký duyệt X hồ sơ", bỏ toàn bộ danh sách, tóm tắt và đính kèm */
            <div className="py-4 text-center">
              <div className="text-base font-bold text-purple-900">
                Ký duyệt {effectiveRecords.length} hồ sơ
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Xác nhận chuyển trạng thái Đã ký duyệt cho tất cả {effectiveRecords.length} hồ sơ đã chọn.
              </p>
            </div>
          ) : (
            /* KÝ ĐƠN LẺ (1 hồ sơ): Bỏ tóm tắt thông tin hồ sơ, chỉ hiển thị Khối đính kèm kết quả / Thành phần hồ sơ */
            <div>
              <DossierComponentSection
                recordCode={primaryRecord?.code || 'HS'}
                department="Ban Lãnh đạo"
                stage="Ký duyệt"
                components={components}
                onChange={setComponents}
                title="Thành phần hồ sơ & Tệp đính kèm kết quả"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirmSign}
            disabled={isSubmitting}
            className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Đang duyệt</span>
              </>
            ) : (
              <>
                <CheckCircle size={15} />
                <span>Đồng ý</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignApprovalModal;

