import React, { useState, useRef } from 'react';
import { 
  Upload, FileText, Trash2, Download, Eye, AlertCircle, 
  CheckCircle2, Folder, ExternalLink, HelpCircle 
} from 'lucide-react';
import { AttachedFileMeta, AttachmentDocType } from '../../types';
import { 
  DOC_TYPES, 
  DOC_TYPE_LABELS, 
  isImageFile, 
  isAllowedDocFile, 
  generateStandardizedFileName, 
  saveAttachmentBlob, 
  downloadAttachment, 
  previewAttachment, 
  deleteAttachmentBlob,
  getGoogleDriveIncomingUrl 
} from '../../services/attachmentStorage';

interface RecordAttachmentManagerProps {
  recordCode: string;
  department: string;
  attachedFiles: AttachedFileMeta[];
  onChange: (files: AttachedFileMeta[]) => void;
  readOnly?: boolean;
}

export const RecordAttachmentManager: React.FC<RecordAttachmentManagerProps> = ({
  recordCode,
  department,
  attachedFiles = [],
  onChange,
  readOnly = false,
}) => {
  const [selectedDocType, setSelectedDocType] = useState<AttachmentDocType>('GCN');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const driveUrl = getGoogleDriveIncomingUrl();

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsProcessing(true);

    const newFiles: AttachedFileMeta[] = [...attachedFiles];
    let rejectedImagesCount = 0;
    let addedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Bỏ hỗ trợ lưu định dạng ảnh theo chỉ đạo của người dùng
      if (isImageFile(file)) {
        rejectedImagesCount++;
        continue;
      }

      // Đếm số lượng tệp cùng loại đã có để tính số thứ tự STT
      const existingSameTypeCount = newFiles.filter(f => f.docType === selectedDocType).length;
      const sequenceIndex = existingSameTypeCount + 1;

      // Đổi tên tệp tự động theo cú pháp: [Mã_HS]_[Tên_Viết_Tắt]_[STT].[ext]
      const standardizedName = generateStandardizedFileName(
        recordCode || 'HS-MOI',
        selectedDocType,
        sequenceIndex,
        file.name
      );

      const fileId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Đọc base64 cho tệp nhỏ < 1.5MB để dự phòng offline
      let base64Data: string | undefined = undefined;
      if (file.size <= 1.5 * 1024 * 1024) {
        try {
          base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(undefined);
            reader.readAsDataURL(file);
          });
        } catch {
          base64Data = undefined;
        }
      }

      const meta: AttachedFileMeta = {
        id: fileId,
        recordCode: recordCode || 'HS-MOI',
        originalName: file.name,
        fileName: standardizedName,
        docType: selectedDocType,
        docTypeLabel: DOC_TYPE_LABELS[selectedDocType] || 'Tài liệu',
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        department: department || 'Tổ Đo đạc',
        storageId: fileId,
        base64Data,
      };

      // Lưu trữ Blob vào IndexedDB
      await saveAttachmentBlob(meta, file);
      newFiles.push(meta);
      addedCount++;
    }

    setIsProcessing(false);
    onChange(newFiles);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (rejectedImagesCount > 0 && addedCount > 0) {
      setErrorMsg(`Đã tiếp nhận ${addedCount} tệp hợp lệ. Đã từ chối ${rejectedImagesCount} tệp ảnh do hệ thống không hỗ trợ định dạng ảnh.`);
    } else if (rejectedImagesCount > 0 && addedCount === 0) {
      setErrorMsg(`Từ chối ${rejectedImagesCount} tệp ảnh! Hệ thống chỉ hỗ trợ lưu trữ tệp tài liệu (PDF, Word, Excel, CAD/DWG...), không lưu tệp ảnh.`);
    } else if (addedCount > 0) {
      setSuccessMsg(`Đã thêm thành công ${addedCount} tệp đính kèm và tự động đổi tên theo mã hồ sơ.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (readOnly) return;
    await deleteAttachmentBlob(fileId);
    const updated = attachedFiles.filter(f => f.id !== fileId);
    onChange(updated);
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 space-y-4 shadow-sm">
      {/* Tiêu đề phần đính kèm */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Folder size={18} />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              Tệp đính kèm hồ sơ đầu vào
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-semibold">
                {attachedFiles.length} tệp
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Phân loại: <strong className="text-blue-700">{department || 'Tổ chuyên môn'}</strong> | Mã hồ sơ: <strong className="text-slate-700">{recordCode || 'Chưa đặt mã'}</strong>
            </p>
          </div>
        </div>

        {/* Nút liên kết Google Drive */}
        {driveUrl && (
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
            title="Mở thư mục Google Drive lưu trữ dữ liệu"
          >
            <ExternalLink size={13} />
            Mở Google Drive tiếp nhận
          </a>
        )}
      </div>

      {/* Thông báo lỗi / thành công */}
      {errorMsg && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-medium">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Khu vực tải lên tệp (nếu không phải readOnly) */}
      {!readOnly && (
        <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="w-full sm:w-auto">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Chọn loại tài liệu (đổi tên viết tắt tự động):
              </label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value as AttachmentDocType)}
                className="w-full sm:w-72 text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {DOC_TYPES.map(dt => (
                  <option key={dt.type} value={dt.type}>
                    [{dt.type}] {dt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 w-full flex items-end">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dgn,.txt,.rtf,.csv"
                onChange={handleFileSelection}
                className="hidden"
                id={`attachment-input-${recordCode || 'new'}`}
                disabled={isProcessing}
              />
              <label
                htmlFor={`attachment-input-${recordCode || 'new'}`}
                className={`w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all ${
                  isProcessing ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
                }`}
              >
                <Upload size={15} />
                {isProcessing ? 'Đang xử lý...' : 'Chọn tệp đính kèm'}
              </label>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <HelpCircle size={13} className="text-slate-400 shrink-0" />
            <span>Hỗ trợ: PDF, Word, Excel, CAD/DWG. <strong className="text-rose-600">Không hỗ trợ ảnh</strong> (JPG, PNG). Tên tệp tự đổi thành: <code>[Mã_HS]_[Loại]_[STT].[ext]</code></span>
          </div>
        </div>
      )}

      {/* Danh sách tệp đã đính kèm */}
      {attachedFiles.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <FileText size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-medium text-slate-500">Chưa có tệp đính kèm nào cho hồ sơ này</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Tải lên tài liệu PDF, hồ sơ kỹ thuật, đơn đăng ký...</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
          {attachedFiles.map((file, idx) => (
            <div 
              key={file.id || idx}
              className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                  {file.docType || 'TL'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-800 truncate" title={file.fileName}>
                    {file.fileName}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-2 truncate">
                    <span>{file.docTypeLabel}</span>
                    <span>•</span>
                    <span>{formatFileSize(file.fileSize)}</span>
                    {file.originalName && file.originalName !== file.fileName && (
                      <>
                        <span>•</span>
                        <span className="text-slate-400 italic truncate" title={`Tên gốc: ${file.originalName}`}>
                          Gốc: {file.originalName}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Thao tác Xem / Tải về / Xóa */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => previewAttachment(file)}
                  className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Xem trước"
                >
                  <Eye size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => downloadAttachment(file)}
                  className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                  title="Tải về tệp này"
                >
                  <Download size={15} />
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDelete(file.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                    title="Xóa tệp"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default RecordAttachmentManager;
