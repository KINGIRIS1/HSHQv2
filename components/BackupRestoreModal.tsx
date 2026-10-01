import React from 'react';
import { X, HardDrive, ShieldCheck } from 'lucide-react';
import { BackupRestoreTab } from './settings/BackupRestoreTab';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordsUpdated?: () => void;
  records?: any[];
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  onRecordsUpdated,
  records = []
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-950 px-6 py-4 flex items-center justify-between shrink-0 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Sao lưu & Khôi phục Dữ liệu Hệ thống
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> An toàn dữ liệu
                </span>
              </h2>
              <p className="text-xs text-indigo-200 font-medium">
                Quản lý tự động sao lưu, tạo điểm khôi phục tức thì, xuất/nhập tệp dự phòng JSON & Excel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Đóng cửa sổ (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          <BackupRestoreTab onRecordsUpdated={onRecordsUpdated} records={records} />
        </div>
      </div>
    </div>
  );
};

export default BackupRestoreModal;
