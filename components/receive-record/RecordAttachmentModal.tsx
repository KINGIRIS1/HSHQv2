import React, { useState } from 'react';
import { X, Folder, Paperclip, ExternalLink, Download, FileText, CheckCircle2, Loader2, Save } from 'lucide-react';
import { RecordFile, AttachedFileMeta } from '../../types';
import { getDepartmentForRecord } from '../../utils/appHelpers';
import { RecordAttachmentManager } from './RecordAttachmentManager';
import { getGoogleDriveIncomingUrl, downloadAttachment, enqueueRecordForBackgroundDriveSync } from '../../services/attachmentStorage';

interface RecordAttachmentModalProps {
  record: RecordFile | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateRecordFiles?: (recordId: string, files: AttachedFileMeta[]) => void;
  readOnly?: boolean;
}

export const RecordAttachmentModal: React.FC<RecordAttachmentModalProps> = ({
  record,
  isOpen,
  onClose,
  onUpdateRecordFiles,
  readOnly = false,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentFiles, setCurrentFiles] = useState<AttachedFileMeta[]>([]);

  React.useEffect(() => {
    if (record) {
      setCurrentFiles(record.attachedFiles || []);
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const department = getDepartmentForRecord(record);
  const driveUrl = getGoogleDriveIncomingUrl();
  const hasPendingFiles = currentFiles.some(f => !f.driveUrl && !f.driveFileId);

  const handleFilesChange = (newFiles: AttachedFileMeta[]) => {
    setCurrentFiles(newFiles);
  };

  const handleSaveAndSync = async () => {
    if (!record.id) return;
    try {
      // 1. Cập nhật ngay tệp trong giao diện và đóng hộp thoại tức thì 0ms
      if (onUpdateRecordFiles) {
        onUpdateRecordFiles(record.id, currentFiles);
      }
      onClose();

      // 2. Kích hoạt đồng bộ ngầm tệp lên Google Drive trong nền (Background Sync)
      const updatedRecord: RecordFile = {
        ...record,
        attachedFiles: currentFiles,
      };
      enqueueRecordForBackgroundDriveSync(updatedRecord);
    } catch (err: any) {
      console.error('Lỗi khi lưu tệp đính kèm:', err);
    }
  };

  // Tải về từng tệp riêng rẽ của mã hồ sơ (không đóng gói zip theo yêu cầu)
  const handleDownloadAllSeparate = async () => {
    if (currentFiles.length === 0) {
      alert('Hồ sơ này hiện chưa có tệp đính kèm nào.');
      return;
    }

    for (let i = 0; i < currentFiles.length; i++) {
      const file = currentFiles[i];
      await downloadAttachment(file);
      // Giãn cách một chút để trình duyệt không chặn nhiều lượt tải
      if (i < currentFiles.length - 1) {
        await new Promise(r => setTimeout(r, 400));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Paperclip size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Tệp đính kèm: <span className="font-mono text-blue-700">{record.code}</span>
              </h3>
              <p className="text-xs text-slate-500">
                Chủ hồ sơ: <strong>{record.customerName}</strong> | Tổ chuyên môn:{' '}
                <span className="font-bold text-indigo-700">{department}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Thông tin phân loại và quy định lưu trữ */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-slate-700">Quy định lưu trữ tệp:</span>
              <p className="text-slate-500 mt-0.5">
                Mỗi mã hồ sơ lưu tệp độc lập, đổi tên chuẩn <code>[Mã_HS]_[Loại_Viết_Tắt]_[STT].[ext]</code>. Không hỗ trợ định dạng ảnh.
              </p>
            </div>

            {currentFiles.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadAllSeparate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
                title="Tải về lần lượt từng tệp đã đổi tên riêng rẽ của mã hồ sơ này"
              >
                <Download size={14} />
                Tải từng tệp của mã hồ sơ ({currentFiles.length})
              </button>
            )}
          </div>

          {/* Trình quản lý đính kèm tệp */}
          <RecordAttachmentManager
            recordCode={record.code}
            department={department}
            attachedFiles={currentFiles}
            onChange={handleFilesChange}
            readOnly={readOnly}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {driveUrl ? (
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:underline inline-flex items-center gap-1 font-semibold"
              >
                <ExternalLink size={13} />
                Đường dẫn Google Drive lưu trữ
              </a>
            ) : (
              <span className="text-slate-400 italic">Chưa cài đặt link Google Drive trong tab Dữ liệu</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              disabled={isSyncing}
            >
              Hủy / Đóng
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={handleSaveAndSync}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={14} />
                Lưu tệp & Đóng
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default RecordAttachmentModal;
