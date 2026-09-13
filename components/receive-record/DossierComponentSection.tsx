import React, { useState, useRef } from 'react';
import { Plus, Trash2, Paperclip, Eye, Download, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { DossierComponentItem, AttachedFileMeta } from '../../types';
import { processAndSaveSingleAttachment, previewAttachment, downloadAttachment, isAllowedDocFile } from '../../services/attachmentStorage';

interface DossierComponentSectionProps {
  recordCode: string;
  department?: string;
  stage?: string;
  components: DossierComponentItem[];
  onChange: (items: DossierComponentItem[]) => void;
  readOnly?: boolean;
  title?: string;
}

export const DossierComponentSection: React.FC<DossierComponentSectionProps> = ({
  recordCode,
  department = 'Tổ Đo đạc',
  stage = 'Công đoạn',
  components = [],
  onChange,
  readOnly = false,
  title = 'Thành phần hồ sơ',
}) => {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Đếm số lượng cùng loại giấy tờ để sinh STT chuẩn: [Tên_Viết_Tắt] [STT]_[Mã_HS].[ext]
  const calculateSequence = (currentId: string, docName: string) => {
    let count = 1;
    for (const item of components) {
      if (item.id === currentId) break;
      if (item.name && item.name.trim().toLowerCase() === docName.trim().toLowerCase()) {
        count++;
      }
    }
    return count;
  };

  const handleAddNewRow = () => {
    const newItem: DossierComponentItem = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: '',
      stage,
      original: 1,
      copy: 0,
    };
    onChange([...components, newItem]);
  };

  const handleUpdateName = (id: string, name: string) => {
    onChange(
      components.map((c) => (c.id === id ? { ...c, name } : c))
    );
  };

  const handleRemoveRow = (id: string) => {
    onChange(components.filter((c) => c.id !== id));
  };

  const handleFileSelect = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const currentItem = components.find((c) => c.id === id);
    const docName = currentItem?.name?.trim() || 'Tài liệu thành phần';

    if (!isAllowedDocFile(file)) {
      setErrorMessage('Hệ thống đã bỏ hỗ trợ định dạng ảnh. Vui lòng chọn tệp văn bản/tài liệu (PDF, Word, Excel, CAD...)');
      e.target.value = '';
      return;
    }

    setUploadingId(id);
    setErrorMessage(null);

    try {
      const sequenceIndex = calculateSequence(id, docName);
      const meta = await processAndSaveSingleAttachment(
        file,
        recordCode || 'HS',
        docName,
        sequenceIndex,
        department,
        stage
      );

      onChange(
        components.map((c) => (c.id === id ? { ...c, attachedFile: meta, stage } : c))
      );
    } catch (err: any) {
      console.error('Lỗi tải tệp thành phần:', err);
      setErrorMessage(err.message || 'Lỗi khi tải tệp lên');
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  };

  const handleRemoveFile = (id: string) => {
    onChange(
      components.map((c) => (c.id === id ? { ...c, attachedFile: undefined } : c))
    );
  };

  return (
    <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-3.5 sm:p-4 space-y-3 mt-3">
      {/* Tiêu đề khối & Nút "+ Thêm mới" */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-blue-100 text-blue-700">
            <FileText size={16} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-tight">
              {title}
            </h4>
          </div>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={handleAddNewRow}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md border border-blue-200 text-xs font-bold active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={13} />
            Thêm mới
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-800 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bảng 2 cột: Cột 1 Tên giấy tờ, Cột 2 File đính kèm */}
      {components.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-2 px-3 w-10 text-center">STT</th>
                <th className="py-2 px-3">Tên giấy tờ / Thành phần</th>
                <th className="py-2 px-2 w-28 text-center">Tệp đính kèm</th>
                {!readOnly && <th className="py-2 px-2 w-10 text-center">Xóa</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {components.map((item, index) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-2 px-3 text-center text-slate-400 font-mono">
                    {index + 1}
                  </td>
                  
                  {/* Cột 1: Tên giấy tờ có thể nhập */}
                  <td className="py-2 px-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.stage && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 shrink-0">
                            {item.stage}
                          </span>
                        )}
                        {item.attachedFile && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono truncate max-w-[220px]" title={item.attachedFile.fileName}>
                            <Paperclip size={10} className="text-blue-500 shrink-0" />
                            <span className="truncate">{item.attachedFile.fileName}</span>
                          </span>
                        )}
                      </div>
                      {readOnly ? (
                        <span className="font-semibold text-slate-800 block">{item.name || 'Chưa đặt tên'}</span>
                      ) : (
                        <input
                          type="text"
                          placeholder="Nhập tên giấy tờ / thành phần (VD: Bản vẽ hiện trạng, Phiếu kiểm tra...)"
                          value={item.name}
                          onChange={(e) => handleUpdateName(item.id, e.target.value)}
                          className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/50 hover:bg-white transition-colors"
                        />
                      )}
                    </div>
                  </td>

                  {/* Cột 2: File đính kèm thu nhỏ bằng cột hình thức */}
                  <td className="py-2 px-2 text-center">
                    {item.attachedFile ? (
                      <div className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
                        <button
                          type="button"
                          onClick={() => previewAttachment(item.attachedFile!)}
                          title={`Xem tệp: ${item.attachedFile.fileName}`}
                          className="p-0.5 text-emerald-700 hover:text-emerald-900 rounded cursor-pointer"
                        >
                          <CheckCircle size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => previewAttachment(item.attachedFile!)}
                          className="p-0.5 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                          title={`Xem trước (${item.attachedFile.fileName})`}
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadAttachment(item.attachedFile!)}
                          className="p-0.5 text-slate-500 hover:text-emerald-700 rounded cursor-pointer"
                          title="Tải về"
                        >
                          <Download size={12} />
                        </button>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(item.id)}
                            className="p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                            title="Gỡ tệp"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ) : readOnly ? (
                      <span className="text-slate-400 italic text-[11px]">-</span>
                    ) : (
                      <div className="inline-flex items-center justify-center">
                        <input
                          type="file"
                          ref={(el) => (fileInputRefs.current[item.id] = el)}
                          onChange={(e) => handleFileSelect(item.id, e)}
                          accept=".pdf,.docx,.doc,.xlsx,.xls,.dwg,.dgn,.txt,.rtf"
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={uploadingId === item.id}
                          onClick={() => fileInputRefs.current[item.id]?.click()}
                          title="Đính kèm tệp"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200 transition-all cursor-pointer inline-flex items-center justify-center disabled:opacity-50"
                        >
                          {uploadingId === item.id ? (
                            <Loader2 size={13} className="animate-spin text-blue-600" />
                          ) : (
                            <Paperclip size={13} />
                          )}
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Nút xóa dòng */}
                  {!readOnly && (
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        title="Xóa thành phần này"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-4 bg-white rounded-lg border border-dashed border-slate-300 text-slate-400 text-xs">
          <span>Chưa có thành phần hồ sơ nào được thêm. Bấm </span>
          <strong className="text-blue-600 font-semibold cursor-pointer" onClick={handleAddNewRow}>
            "Thêm mới"
          </strong>
          <span> để bổ sung giấy tờ và file đính kèm.</span>
        </div>
      )}
    </div>
  );
};
export default DossierComponentSection;
