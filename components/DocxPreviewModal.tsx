
import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { X, Printer, Download, Loader2, PenLine, AlertCircle } from 'lucide-react';
import saveAs from 'file-saver';
import RichTextToolbar from './RichTextToolbar';

interface DocxPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  docxBlob: Blob | null;
  fileName: string;
}

const DocxPreviewModal: React.FC<DocxPreviewModalProps> = ({ isOpen, onClose, docxBlob, fileName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && docxBlob && containerRef.current) {
      setLoading(true);
      containerRef.current.innerHTML = '';

      renderAsync(docxBlob, containerRef.current, undefined, {
        inWrapper: false,
        ignoreWidth: true,
        experimental: true,
        useBase64URL: true,
      })
        .then(() => setLoading(false))
        .catch((err) => {
          console.error(err);
          setLoading(false);
          if (containerRef.current) {
            containerRef.current.innerHTML = `<div class="text-red-500 p-4 text-center">Lỗi hiển thị xem trước. Vui lòng tải về để xem.<br/><span class="text-xs text-gray-500">${err.message}</span></div>`;
          }
        });
    }
  }, [isOpen, docxBlob]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  };

  const handlePrint = () => {
    if (!containerRef.current) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const content = containerRef.current.innerHTML;
    const doc = iframe.contentWindow?.document;

    if (doc) {
      doc.open();
      doc.write(`
        <html>
          <head>
            <title>${fileName}</title>
            <style>
              @page { 
                size: A4 portrait; 
                margin: 15mm 12mm 15mm 25mm; 
              }
              html, body { 
                width: 100%;
                margin: 0; 
                padding: 0;
                background: white;
                font-family: "Times New Roman", serif; 
                font-size: 13pt; 
                color: #000;
                -webkit-print-color-adjust: exact;
                line-height: 1.3;
              }
              .docx-wrapper { 
                background: white !important; 
                padding: 0 !important; 
                margin: 0 !important; 
              }
              section { 
                width: 100% !important; 
                margin: 0 auto !important; 
                padding: 0 !important; 
                box-shadow: none !important; 
                box-sizing: border-box;
                overflow: visible;
                page-break-after: always;
              }
              img { max-width: 100%; height: auto; }
              table { width: 100% !important; border-collapse: collapse; }
              hr {
                border: 0 !important;
                border-top: 1px solid #000 !important;
                display: block !important;
                width: 100% !important;
                height: 1px !important;
                margin: 10px 0 !important;
                background-color: #000 !important;
              }
              p[style*="border-bottom"] { border-bottom: 1px solid #000 !important; }
              table:last-of-type { margin-top: 20px; width: 100% !important; }
              table:last-of-type td, table:last-of-type th { border: none !important; padding: 5px; vertical-align: top; }
              table:last-of-type td { width: 50% !important; text-align: center !important; }
              section:last-child { page-break-after: auto; }
            </style>
          </head>
          <body>${content}</body>
        </html>
      `);
      doc.close();

      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  const handleDownload = () => {
    if (docxBlob) {
      saveAs(docxBlob, fileName.endsWith('.docx') ? fileName : `${fileName}.docx`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              Xem trước: <span className="text-blue-600 truncate max-w-[260px]">{fileName}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium text-sm transition-colors"
            >
              <Download size={18} /> Tải về
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm transition-colors shadow-sm"
            >
              <Printer size={18} /> In ngay
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-red-100 rounded-full text-gray-500 hover:text-red-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Toolbar Integration */}
        <RichTextToolbar editorRef={containerRef} />

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4 relative flex justify-center">
          <style>
            {`
              .docx-viewer-container .docx { width: 100% !important; max-width: 100% !important; }
              .docx-viewer-container section { width: 100% !important; max-width: 100% !important; }
              .docx-viewer-container hr { border-top: 1px solid #000 !important; display: block !important; margin: 10px 0 !important; opacity: 1 !important; }
            `}
          </style>

          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
              <Loader2 className="animate-spin text-blue-600 mb-2" size={40} />
              <p className="text-gray-500 font-medium">Đang tạo bản xem trước...</p>
            </div>
          )}

          <div
            ref={containerRef}
            contentEditable={true}
            suppressContentEditableWarning={true}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className="bg-white shadow-lg p-4 md:p-10 text-left transition-opacity duration-300 docx-viewer-container outline-none ring-0 focus:ring-4 focus:ring-blue-100/50 cursor-text border border-gray-200"
            style={{
              width: '100%',
              maxWidth: '210mm',
              minHeight: '297mm',
              margin: '0 auto',
              opacity: loading ? 0 : 1,
              fontFamily: '"Times New Roman", serif'
            }}
          />
        </div>

        <div className="p-2 text-center text-[10px] text-gray-500 bg-gray-50 border-t shrink-0 flex justify-center items-center gap-2">
          <AlertCircle size={12} className="text-orange-500" />
          <span>Lưu ý: Các thay đổi định dạng tại đây chỉ có tác dụng khi bấm "In ngay". Để thay đổi mẫu vĩnh viễn, hãy sửa file mẫu gốc.</span>
        </div>
      </div>
    </div>
  );
};

export default DocxPreviewModal;
