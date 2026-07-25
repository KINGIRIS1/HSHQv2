
import React from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  record?: {
    code?: string;
    customerName?: string;
    receivedDate?: string | null;
    deadline?: string | null;
  } | null;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Xác nhận xóa", 
  message = "Bạn có chắc chắn muốn xóa hồ sơ này? Hành động này không thể hoàn tác.",
  record
}) => {
  if (!isOpen) return null;

  const formatDateDDMMYYYY = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-fade-in-up">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={20} />
            {title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-gray-600 text-sm">{message}</p>
          {record && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100 text-xs text-red-800 space-y-1">
              <div className="font-bold">Mã HS: {record.code || '---'}</div>
              {record.customerName && <div>Chủ HS: {record.customerName}</div>}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-700 mt-1.5 pt-1 border-t border-red-200/50">
                <span>Ngày nhận: {formatDateDDMMYYYY(record.receivedDate)}</span>
                <span>Hẹn trả: {formatDateDDMMYYYY(record.deadline)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-white text-sm font-medium"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
          >
            <Trash2 size={16} />
            Xóa ngay
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
