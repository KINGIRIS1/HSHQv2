import React, { useState, useMemo } from 'react';
import { X, FileCheck, CheckCircle, AlertCircle, Clock, User, FileText } from 'lucide-react';
import { RecordFile, DossierComponentItem } from '../../types';
import DossierComponentSection from './DossierComponentSection';

interface SignApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: RecordFile | null;
  records?: RecordFile[];
  onConfirm: (targetRecords: RecordFile[], newComponents: DossierComponentItem[]) => Promise<void> | void;
}

export const SignApprovalModal: React.FC<SignApprovalModalProps> = ({
  isOpen,
  onClose,
  record,
  records,
  onConfirm,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const effectiveRecords = useMemo(() => {
    if (records && records.length > 0) return records;
    if (record) return [record];
    return [];
  }, [record, records]);

  const primaryRecord = effectiveRecords[0] || null;

  // Parse initial components from the primary record
  const initialComponents: DossierComponentItem[] = useMemo(() => {
    if (!primaryRecord) return [];
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
  }, [primaryRecord]);

  const [components, setComponents] = useState<DossierComponentItem[]>(initialComponents);

  React.useEffect(() => {
    setComponents(initialComponents);
  }, [initialComponents]);

  if (!isOpen || effectiveRecords.length === 0 || !primaryRecord) return null;

  const handleConfirmSign = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(effectiveRecords, components);
      onClose();
    } catch (err) {
      console.error('Lỗi khi ký duyệt hồ sơ:', err);
      alert('Đã xảy ra lỗi trong quá trình ký duyệt hồ sơ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMultiple = effectiveRecords.length > 1;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <FileCheck size={22} className="text-purple-200" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {isMultiple ? `Ký duyệt đợt (${effectiveRecords.length} hồ sơ)` : `Ký duyệt hồ sơ: ${primaryRecord.code}`}
              </h3>
              <p className="text-xs text-purple-200 mt-0.5">
                Xác nhận phê duyệt & đính kèm tài liệu đã ký trước khi chuyển Chờ bàn giao
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
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Tóm tắt thông tin hồ sơ */}
          {isMultiple ? (
            <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 text-xs text-slate-700 space-y-2">
              <div className="font-bold text-purple-900">
                Danh sách {effectiveRecords.length} hồ sơ đang được ký duyệt:
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {effectiveRecords.map((r) => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-purple-200 text-purple-900 font-mono font-bold text-xs shadow-2xs"
                  >
                    {r.code}
                    {r.customerName && <span className="font-normal text-slate-500 text-[11px] truncate max-w-[120px]">({r.customerName})</span>}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 text-xs text-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">Chủ sử dụng / Người nộp:</span>{' '}
                <strong className="text-slate-800">{primaryRecord.customerName || '---'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Loại thủ tục:</span>{' '}
                <strong className="text-purple-700">{primaryRecord.recordType || '---'}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500">Nội dung yêu cầu:</span>{' '}
                <span className="text-slate-800">{primaryRecord.content || '---'}</span>
              </div>
            </div>
          )}

          {/* Khối Thành phần hồ sơ & Tệp đính kèm với nút "Thêm mới" */}
          <DossierComponentSection
            recordCode={primaryRecord.code || 'HS'}
            department="Ban Lãnh đạo"
            stage="Ký duyệt"
            components={components}
            onChange={setComponents}
            title="Thành phần hồ sơ & Tệp đính kèm ký duyệt"
          />
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirmSign}
            disabled={isSubmitting}
            className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle size={15} />
            {isSubmitting ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignApprovalModal;
