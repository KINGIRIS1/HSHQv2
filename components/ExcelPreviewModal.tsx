
import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { X, Printer, Download, Loader2, AlertTriangle, ZoomIn, ZoomOut, PenLine } from 'lucide-react';

interface ExcelPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  workbook: XLSX.WorkBook | null;
  fileName: string;
}

const ExcelPreviewModal: React.FC<ExcelPreviewModalProps> = ({ isOpen, onClose, workbook, fileName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  useEffect(() => {
    if (isOpen && workbook && containerRef.current) {
      setLoading(true);
      
      setTimeout(() => {
        try {
          const sheetName = workbook.SheetNames[0];
          const ws = workbook.Sheets[sheetName];
          
          const html = XLSX.utils.sheet_to_html(ws, { 
            id: "excel-table-content",
            editable: false 
          });

          if (containerRef.current) {
            containerRef.current.innerHTML = html;
            
            const table = containerRef.current.querySelector('table');
            
            if (table) {
                if (ws['!cols']) {
                    const colGroup = document.createElement('colgroup');
                    ws['!cols'].forEach((col: any) => {
                        const colElem = document.createElement('col');
                        let widthPx = 64; 
                        if (col.wpx) widthPx = col.wpx;
                        else if (col.wch) widthPx = col.wch * 8; 
                        colElem.style.width = `${widthPx}px`;
                        colGroup.appendChild(colElem);
                    });
                    table.prepend(colGroup);
                }

                // --- NEW: Áp dụng chiều cao dòng (Row Height) từ config !rows ---
                if (ws['!rows']) {
                    const rows = table.querySelectorAll('tr');
                    ws['!rows'].forEach((rowConfig: any, index: number) => {
                        if (rows[index]) {
                            // Ưu tiên hpx (pixel), nếu không có dùng hpt (point) * 1.33 để đổi ra px
                            const h = rowConfig.hpx || (rowConfig.hpt ? rowConfig.hpt * 1.33 : 20);
                            rows[index].style.height = `${h}px`;
                        }
                    });
                }

                table.style.width = '100%'; 
                table.style.borderCollapse = 'collapse';
                table.style.fontFamily = "'Times New Roman', serif";
                table.style.fontSize = "11pt";
                table.style.backgroundColor = "#ffffff";
                table.style.tableLayout = "fixed"; 
                table.style.margin = "0 auto"; 
                
                const rows = table.querySelectorAll('tr');
                let tableHeaderIndex = -1;

                rows.forEach((row, index) => {
                    if (row.innerText.includes('STT')) tableHeaderIndex = index;
                });

                rows.forEach((row, rowIndex) => {
                    const rowText = row.innerText.toLowerCase();
                    const cells = row.querySelectorAll('td, th');

                    if (tableHeaderIndex !== -1 && rowIndex < tableHeaderIndex) {
                        cells.forEach((cell: any) => {
                            cell.style.border = 'none';
                            cell.style.textAlign = 'center';
                            if (rowIndex === 0 || rowIndex === 1 || rowIndex === 3) cell.style.fontWeight = 'bold';
                            if (rowIndex === 1) cell.style.textDecoration = 'underline';
                        });
                    } 
                    else if (rowIndex === tableHeaderIndex) {
                        cells.forEach((cell: any) => {
                            cell.style.border = '1px solid black';
                            cell.style.fontWeight = 'bold';
                            cell.style.textAlign = 'center';
                            cell.style.backgroundColor = '#f0f0f0';
                            cell.style.verticalAlign = 'middle';
                        });
                    } 
                    else {
                        if (rowText.includes('bên giao') || rowText.includes('ký') && rowText.includes('họ tên') || rowText.includes('bên nhận')) {
                             cells.forEach((cell: any) => {
                                 cell.style.border = 'none';
                                 cell.style.textAlign = 'center';
                                 cell.style.paddingTop = '10px';
                                 cell.style.verticalAlign = 'top';
                                 if (rowText.includes('bên giao')) cell.style.fontWeight = 'bold';
                                 else cell.style.fontStyle = 'italic';
                             });
                        } else {
                             cells.forEach((cell: any) => {
                                 const cellText = cell.innerText.trim();
                                 if (!cell.style.border || cell.style.border === 'none') {
                                     cell.style.border = '1px solid black';
                                 }
                                 cell.style.verticalAlign = 'middle';
                                 cell.style.padding = '4px';
                                 if (cell.cellIndex === 0 || cell.cellIndex === 9) cell.style.textAlign = 'center';
                             });
                        }
                    }
                });
            }
          }
        } catch (error) {
          console.error("Lỗi render Excel:", error);
          if (containerRef.current) {
            containerRef.current.innerHTML = '<div class="text-red-500 p-4 text-center">Không thể hiển thị bản xem trước. Vui lòng tải về để xem.</div>';
          }
        } finally {
          setLoading(false);
        }
      }, 100);
    }
  }, [isOpen, workbook]);

  if (!isOpen) return null;

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
                        @page { size: A4 landscape; margin: 10mm; }
                        body { font-family: "Times New Roman", serif; margin: 0; padding: 0; }
                        table { width: 100%; border-collapse: collapse; font-size: 11pt; }
                        td, th { padding: 4px; }
                        /* Ensure custom heights are preserved in print */
                        tr { height: auto; } 
                    </style>
                </head>
                <body>${content}</body>
            </html>
        `);
        doc.close();

        iframe.contentWindow?.focus();
        setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => { document.body.removeChild(iframe); }, 1000);
        }, 500);
    }
  };

  const handleDownload = () => {
    if (workbook) {
      XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col relative overflow-hidden">
        
        <div className="flex justify-between items-center p-4 border-b bg-green-50 shrink-0">
            <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    Xem trước Excel: <span className="text-green-700">{fileName}</span>
                </h2>
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1 font-semibold">
                    <PenLine size={12} /> Bạn có thể bấm vào ô để sửa nội dung trước khi in
                </p>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center bg-white rounded border border-gray-300 mr-2">
                    <button onClick={() => setZoomLevel(z => Math.max(50, z - 10))} className="p-2 hover:bg-gray-100 text-gray-600"><ZoomOut size={16} /></button>
                    <span className="text-xs font-medium w-10 text-center">{zoomLevel}%</span>
                    <button onClick={() => setZoomLevel(z => Math.min(200, z + 10))} className="p-2 hover:bg-gray-100 text-gray-600"><ZoomIn size={16} /></button>
                </div>

                <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium text-sm transition-colors">
                    <Download size={18} /> Tải về
                </button>
                <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm transition-colors shadow-sm">
                    <Printer size={18} /> In ngay
                </button>
                <button onClick={onClose} className="p-2 hover:bg-red-100 rounded-full text-gray-500 hover:text-red-600 transition-colors">
                    <X size={24} />
                </button>
            </div>
        </div>

        {/* Changed bg-gray-100 to bg-white */}
        <div className="flex-1 overflow-auto bg-white p-8 text-left relative flex justify-center items-start">
            {loading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-green-600 mb-2" size={40} />
                    <p className="text-gray-500 font-medium">Đang tạo bản xem trước...</p>
                </div>
            )}

            {/* Added overflow: hidden */}
            <div 
                className="bg-white shadow-lg p-10 transition-transform origin-top outline-none ring-0 focus:ring-4 focus:ring-green-100 border border-gray-200"
                contentEditable={true} 
                suppressContentEditableWarning={true}
                spellCheck={false}
                style={{ 
                    transform: `scale(${zoomLevel / 100})`,
                    minWidth: '297mm', // A4 Ngang
                    minHeight: '210mm',
                    width: 'fit-content',
                    boxSizing: 'border-box',
                    overflow: 'hidden' // FORCE HIDE OVERFLOW
                }}
            >
                <div ref={containerRef} />
            </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelPreviewModal;
