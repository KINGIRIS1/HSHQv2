import React, { useRef } from 'react';
import Barcode from 'react-barcode';
import { RecordFile } from '../../types';
import { getNormalizedWard, getShortRecordType, getFullRecordType, getWardFullLabel } from '../../constants';
import { Printer, FileSignature } from 'lucide-react';

interface SystemReceiptTemplateProps {
    data: Partial<RecordFile>;
    receivingWard: string;
    onClose: () => void;
    currentUser?: any;
    onCreateContract?: (record: Partial<RecordFile>) => void;
}

const SystemReceiptTemplate: React.FC<SystemReceiptTemplateProps> = ({ data, receivingWard, onClose, currentUser, onCreateContract }) => {
    const receiptRef = useRef<HTMLDivElement>(null);
    const controlSlipRef = useRef<HTMLDivElement>(null);

    const printPages = (pages: string[], title: string) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            const renderedPages = pages.map(pageContent => `
                <div class="print-page">
                    ${pageContent}
                </div>
            `).join('\n');

            printWindow.document.open();
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8" />
                    <title>${title}</title>
                    <style>
                        @page { 
                            size: A4 portrait; 
                            margin: 10mm 15mm 10mm 15mm; 
                        }
                        * {
                            box-sizing: border-box !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        html, body { 
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #fff !important;
                            font-family: 'Times New Roman', Times, serif !important; 
                            font-size: 14px !important;
                            line-height: 1.35 !important;
                            color: #000 !important;
                            height: auto !important;
                            min-height: auto !important;
                            overflow: visible !important;
                        }
                        .print-page {
                            display: block !important;
                            width: 100% !important;
                            max-width: 100% !important;
                            margin: 0 auto !important;
                            padding: 0 !important;
                            background: #fff !important;
                            color: #000 !important;
                            font-family: 'Times New Roman', Times, serif !important;
                            font-size: 14px !important;
                            line-height: 1.35 !important;
                            box-sizing: border-box !important;
                            clear: both !important;
                            position: relative !important;
                            page-break-after: always !important;
                            break-after: page !important;
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                        }
                        .print-page:last-child {
                            page-break-after: auto !important;
                            break-after: auto !important;
                        }
                        .avoid-break { 
                            page-break-inside: avoid !important; 
                            break-inside: avoid !important;
                        }
                        .flex { display: flex !important; }
                        .flex-col { flex-direction: column !important; }
                        .justify-between { justify-content: space-between !important; }
                        .items-center { align-items: center !important; }
                        .items-end { align-items: flex-end !important; }
                        .text-center { text-align: center !important; }
                        .text-left { text-align: left !important; }
                        .text-right { text-align: right !important; }
                        .font-bold { font-weight: bold !important; }
                        .italic { font-style: italic !important; }
                        .underline { text-decoration: underline !important; }
                        .uppercase { text-transform: uppercase !important; }
                        .whitespace-nowrap { white-space: nowrap !important; }
                        .w-full { width: 100% !important; }
                        .w-half, .w-1\\/2 { width: 50% !important; }
                        .w-12 { width: 48px !important; }
                        .w-20 { width: 80px !important; }
                        .w-24 { width: 96px !important; }
                        .mb-1 { margin-bottom: 4px !important; }
                        .mb-2 { margin-bottom: 8px !important; }
                        .mb-4 { margin-bottom: 14px !important; }
                        .mt-1 { margin-top: 4px !important; }
                        .mt-2 { margin-top: 8px !important; }
                        .mt-4 { margin-top: 14px !important; }
                        .mt-6 { margin-top: 18px !important; }
                        .mt-8 { margin-top: 24px !important; }
                        .text-sm { font-size: 12px !important; }
                        .text-gray-500 { color: #555 !important; }
                        .border-t { border-top: 1px solid #777 !important; }
                        .border-gray-400 { border-color: #777 !important; }
                        .pt-4 { padding-top: 12px !important; }
                        table { 
                            width: 100% !important; 
                            border-collapse: collapse !important; 
                            margin-top: 6px !important; 
                            margin-bottom: 8px !important; 
                        }
                        th, td { 
                            border: 1px solid #000 !important; 
                            padding: 4px 6px !important; 
                            font-size: 13.5px !important;
                        }
                        th { 
                            text-align: center !important; 
                            font-weight: bold !important; 
                        }
                        .receipt-line {
                            margin-bottom: 5px !important;
                            font-size: 14px !important;
                            line-height: 1.35 !important;
                        }
                        @media print {
                            html, body {
                                margin: 0 !important;
                                padding: 0 !important;
                                height: auto !important;
                                overflow: visible !important;
                            }
                            .print-page {
                                page-break-after: always !important;
                                break-after: page !important;
                                page-break-inside: avoid !important;
                                break-inside: avoid !important;
                            }
                            .print-page:last-child {
                                page-break-after: auto !important;
                                break-after: auto !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${renderedPages}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 600);
        }
    };

    const handlePrintAll = () => {
        if (!receiptRef.current || !controlSlipRef.current) return;
        printPages([
            receiptRef.current.innerHTML,
            receiptRef.current.innerHTML,
            controlSlipRef.current.innerHTML
        ], 'In Tất Cả (2 Biên Nhận + 1 Phiếu Kiểm Soát)');
    };

    const handlePrintReceipt = () => {
        if (!receiptRef.current) return;
        printPages([receiptRef.current.innerHTML], 'In Biên Nhận');
    };

    const handlePrintControlSlip = () => {
        if (!controlSlipRef.current) return;
        printPages([controlSlipRef.current.innerHTML], 'In Phiếu Kiểm Soát');
    };

    const now = new Date();
    
    const safeParseDate = (dateVal: any, fallback: Date = new Date()) => {
        if (!dateVal) return fallback;
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? fallback : d;
    };

    const rDate = safeParseDate(data.receivedDate, now);
    const dDate = safeParseDate(data.deadline, now);

    let rHour = now.getHours();
    let rMin = now.getMinutes();
    if (data.receivedDate && (String(data.receivedDate).includes('T') || String(data.receivedDate).includes(' '))) {
        const parsedReceived = new Date(data.receivedDate);
        if (!isNaN(parsedReceived.getTime())) {
            rHour = parsedReceived.getHours();
            rMin = parsedReceived.getMinutes();
        }
    }

    if (!isNaN(rDate.getTime())) {
        rDate.setHours(rHour, rMin);
    }
    if (!isNaN(dDate.getTime())) {
        if (rHour >= 15) {
            dDate.setHours(9, 0, 0); // After 15h: return in the morning (next working day already calculated)
        } else if (rHour >= 11) {
            dDate.setHours(14, 0, 0); // After 11h but before 15h: return in the afternoon
        } else {
            dDate.setHours(9, 0, 0); // Before 11h: return in the morning
        }
    }

    const formatDateTime = (d: Date) => {
        if (!d || isNaN(d.getTime())) {
            return '..... giờ ..... phút, ngày ..... tháng ..... năm .........';
        }
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${hours} giờ ${minutes} phút, ngày ${day} tháng ${month} năm ${year}`;
    };

    const formatDateOnly = (d: Date) => {
        if (!d || isNaN(d.getTime())) {
            return 'ngày ..... tháng ..... năm .........';
        }
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `ngày ${day} tháng ${month} năm ${year}`;
    };

    const currentUserName = currentUser?.name || currentUser?.username || 'NGUYỄN HỮU TRÍ';
    const wardName = getNormalizedWard(data.ward || '');

    const getDisplayLandAddress = () => {
        let addr = '';
        if (data.address) {
            let cleanAddress = data.address.trim();
            // Nếu viết hoa hết thì chuyển về dạng chữ thường trước khi định dạng
            if (cleanAddress === cleanAddress.toUpperCase()) {
                cleanAddress = cleanAddress.toLowerCase();
                cleanAddress = cleanAddress.charAt(0).toUpperCase() + cleanAddress.slice(1);
            }
            addr = cleanAddress;
            
            const normalizedWard = getNormalizedWard(data.ward);
            if (normalizedWard && !addr.toLowerCase().includes(normalizedWard.toLowerCase())) {
                const wardLabel = getWardFullLabel(data.ward);
                if (wardLabel) {
                    const lowerWardLabel = wardLabel.charAt(0).toLowerCase() + wardLabel.slice(1);
                    addr += `, ${lowerWardLabel}`;
                }
            }
        } else {
            addr = getWardFullLabel(data.ward);
        }
        
        if (!addr) return '';
        return addr.charAt(0).toUpperCase() + addr.slice(1);
    };

    // Parse files list
    // Parse attached documents from data.otherDocs
    let parsedDocs: { name: string; type?: string; copyType?: string; isChecked?: boolean }[] = [];
    if (data.otherDocs) {
        try {
            const raw = JSON.parse(data.otherDocs);
            if (Array.isArray(raw)) {
                parsedDocs = raw;
            }
        } catch (e) {
            if (typeof data.otherDocs === 'string' && data.otherDocs.trim()) {
                const parts = data.otherDocs.split('|');
                parsedDocs = parts.map((p, idx) => ({
                    name: p.trim(),
                    type: idx === 1 ? 'Bản sao' : 'Bản chính'
                }));
            }
        }
    }

    // Filter valid docs (must have non-empty name and not explicitly un-checked)
    const validParsedDocs = parsedDocs.filter(d => d && d.name && d.name.trim() !== '' && d.isChecked !== false);

    let finalDocs: { name: string; type: string }[] = [];

    if (validParsedDocs.length > 0) {
        const seenNames = new Set<string>();
        let hasPhieuYeuCau = false;

        validParsedDocs.forEach(doc => {
            const docName = doc.name.trim();
            const lowerName = docName.toLowerCase();

            // Prevent duplicate "Phiếu yêu cầu..." items
            if (lowerName.includes('phiếu yêu cầu') || lowerName.includes('phieu yeu cau')) {
                if (hasPhieuYeuCau) return;
                hasPhieuYeuCau = true;
            }

            if (!seenNames.has(lowerName)) {
                seenNames.add(lowerName);
                finalDocs.push({
                    name: docName,
                    type: doc.type || doc.copyType || 'Bản chính'
                });
            }
        });
    } else {
        // Fallback default base documents if none attached
        finalDocs = [
            { name: `Phiếu yêu cầu ${data.content || 'lập hợp đồng đo đạc dịch vụ; trích lục ; Cung cấp thông tin thửa đất'}`, type: 'Bản chính' },
            { name: 'Giấy chứng nhận đã cấp.', type: 'Bản sao' }
        ];
    }

    // We render exactly 4 empty blocks, each consisting of a 1.Giao row and a 2.Nhận row, matching the PDF's clean table structure
    const emptyBlocks = Array(4).fill(0).map((_, i) => (
        <React.Fragment key={`empty-block-${i}`}>
            <tr className="avoid-break" style={{ pageBreakInside: 'avoid' }}>
                <td style={{ width: '12%', border: '1px solid black', padding: '5px 6px', textAlign: 'left', fontSize: '13px' }}>1.Giao</td>
                <td colSpan={2} style={{ width: '58%', border: '1px solid black', padding: '5px 6px', textAlign: 'left', fontSize: '13px' }}>
                    <span style={{ color: '#aaa' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; giờ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; phút, ngày &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; tháng &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; năm .........</span>
                </td>
                <td rowSpan={2} style={{ width: '15%', border: '1px solid black' }}></td>
                <td rowSpan={2} style={{ width: '15%', border: '1px solid black' }}></td>
            </tr>
            <tr className="avoid-break" style={{ height: '90px', pageBreakInside: 'avoid' }}>
                <td style={{ width: '12%', border: '1px solid black', padding: '5px 6px', textAlign: 'left', verticalAlign: 'top', fontSize: '13px' }}>2.Nhận</td>
                <td style={{ width: '29%', border: '1px solid black', padding: '5px 6px', textAlign: 'left', verticalAlign: 'top', fontSize: '13px' }}>
                    <div style={{ fontWeight: 'bold' }}>Người giao</div>
                    <div style={{ marginTop: '45px' }}>&nbsp;</div>
                </td>
                <td style={{ width: '29%', border: '1px solid black', padding: '5px 6px', textAlign: 'left', verticalAlign: 'top', fontSize: '13px' }}>
                    <div style={{ fontWeight: 'bold' }}>Người nhận</div>
                    <div style={{ marginTop: '45px' }}>&nbsp;</div>
                </td>
            </tr>
        </React.Fragment>
    ));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold">In Biên Nhận & Quy trình</h2>
                    <div className="flex space-x-2">
                        {onCreateContract && data && data.recordType && (getShortRecordType(data.recordType).startsWith('2.2') || getShortRecordType(data.recordType).startsWith('2.4')) && (
                            <button onClick={() => { onCreateContract(data); onClose(); }} className="flex items-center px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700">
                                <FileSignature className="w-4 h-4 mr-2" /> Lập Hợp Đồng
                            </button>
                        )}
                        <button onClick={handlePrintReceipt} className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            <Printer className="w-4 h-4 mr-2" /> In Biên Nhận
                        </button>
                        <button onClick={handlePrintControlSlip} className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                            <Printer className="w-4 h-4 mr-2" /> In Quy Trình
                        </button>
                        <button onClick={handlePrintAll} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            <Printer className="w-4 h-4 mr-2" /> In Tất Cả
                        </button>
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                            Đóng
                        </button>
                    </div>
                </div>
                
                <div className="p-8 overflow-y-auto flex-1 bg-gray-50">
                    <div>
                        <div ref={receiptRef} className="bg-white p-10 shadow-sm border border-gray-200 mx-auto text-black" style={{ maxWidth: '210mm', minHeight: '297mm', fontFamily: "'Times New Roman', Times, serif", fontSize: '14px', lineHeight: '1.35' }}>
                            
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                                <div style={{ width: '50%', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '13.5px', whiteSpace: 'nowrap' }}>VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '12.5px', whiteSpace: 'nowrap' }}>THÀNH PHỐ ĐỒNG NAI - CHI NHÁNH HỚN QUẢN</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '14.5px', whiteSpace: 'nowrap' }}>BỘ PHẬN TIẾP NHẬN VÀ TRẢ KẾT QUẢ</div>
                                    
                                    {data.code && (
                                        <div style={{ marginTop: '6px', textAlign: 'center', display: 'block' }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '15px', display: 'block', whiteSpace: 'nowrap' }}>{data.code}</div>
                                            <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center', marginTop: '-4px', display: 'inline-block' }}>
                                                <Barcode value={data.code} height={28} displayValue={false} margin={0} width={1.5} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div style={{ width: '48%', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '14.5px', whiteSpace: 'nowrap' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                    <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '4px', fontSize: '14px' }}>Độc lập - Tự do - Hạnh phúc</div>
                                    <div style={{ fontStyle: 'italic', marginTop: '10px', fontSize: '13.5px' }}>{getNormalizedWard(receivingWard)}, {formatDateOnly(new Date())}</div>
                                </div>
                            </div>

                            {/* Title */}
                            <div style={{ textAlign: 'center', marginTop: '14px', marginBottom: '12px' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '18px', textTransform: 'uppercase' }}>GIẤY TIẾP NHẬN HỒ SƠ VÀ HẸN TRẢ KẾT QUẢ</div>
                            </div>

                            {/* Content */}
                            <div>
                                <div className="receipt-line" style={{ marginBottom: '5px' }}>Bộ phận tiếp nhận và trả kết quả: <span style={{ fontWeight: 'bold' }}>Văn phòng Đăng ký đất đai Thành phố Đồng Nai - Chi nhánh Hớn Quản</span></div>
                                <div className="receipt-line" style={{ marginBottom: '5px' }}>Tiếp nhận hồ sơ của: <span style={{ fontWeight: 'bold' }}>{data.customerName}</span></div>
                                <div className="receipt-line" style={{ marginBottom: '5px' }}>CCCD/MST: <span style={{ fontWeight: 'bold' }}>{data.cccd || ''}</span></div>
                                <div className="receipt-line" style={{ marginBottom: '5px' }}>Số điện thoại: {data.phoneNumber}</div>
                                <div className="receipt-line" style={{ display: 'flex', marginBottom: '5px' }}>
                                    <div style={{ marginRight: '2cm' }}>Tờ: {data.mapSheet}</div>
                                    <div>Thửa: {data.landPlot}</div>
                                </div>
                                <div className="receipt-line" style={{ marginBottom: '5px' }}>Địa chỉ thửa đất: <span style={{ fontWeight: 'bold' }}>{getDisplayLandAddress()}</span></div>
                                <div className="receipt-line" style={{ marginBottom: '5px' }}>Thủ tục hành chính cần giải quyết: <span style={{ fontWeight: 'bold' }}>{getFullRecordType(data.recordType)}</span></div>
                                
                                <div className="receipt-line" style={{ marginTop: '4px', marginBottom: '4px' }}>1. Thành phần hồ sơ, yêu cầu và số lượng mỗi loại giấy tờ gồm:</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginTop: '4px', marginBottom: '6px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ border: '1px solid black', padding: '4px', textAlign: 'center', width: '48px', fontWeight: 'bold' }}>STT</th>
                                            <th style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>Tên giấy tờ</th>
                                            <th style={{ border: '1px solid black', padding: '4px', textAlign: 'center', width: '100px', fontWeight: 'bold' }}>Loại giấy tờ</th>
                                            <th style={{ border: '1px solid black', padding: '4px', textAlign: 'center', width: '80px', fontWeight: 'bold' }}>Số lượng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {finalDocs.map((doc, idx) => (
                                            <tr key={`doc-${idx}`}>
                                                <td style={{ border: '1px solid black', padding: '4px', textAlign: 'center' }}>{idx + 1}</td>
                                                <td style={{ border: '1px solid black', padding: '4px 6px' }}>{doc.name}</td>
                                                <td style={{ border: '1px solid black', padding: '4px', textAlign: 'center' }}>{doc.type}</td>
                                                <td style={{ border: '1px solid black', padding: '4px', textAlign: 'center' }}>1</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="receipt-line" style={{ marginBottom: '5px' }}>2. Số lượng hồ sơ: 01 (bộ)</div>
                                <div className="receipt-line" style={{ marginBottom: '5px' }}>3. Thời gian nhận hồ sơ: <span style={{ fontWeight: 'bold' }}>{formatDateTime(rDate)}</span></div>
                                <div className="receipt-line" style={{ marginBottom: '5px' }}>4. Thời gian dự kiến trả kết quả giải quyết hồ sơ: <span style={{ fontWeight: 'bold' }}>{formatDateTime(dDate)}</span></div>
                                {data.recordType && (getShortRecordType(data.recordType) === '2.2 Trích đo' || data.recordType.includes('2.2')) ? (
                                    <>
                                        <div className="receipt-line" style={{ fontWeight: 'bold', marginBottom: '5px' }}>5. YÊU CẦU CHỦ SỬ DỤNG ĐẤT CẮM RANH THỬA ĐẤT CẦN ĐO, MỜI LIÊN RANH LIỀN KỀ XÁC MINH RANH MỐC VÀ KÝ RANH TẠI THỬA ĐẤT</div>
                                        <div className="receipt-line" style={{ marginBottom: '5px' }}>6. Đăng ký trả kết quả tại: Trung tâm phục vụ hành chính công {getWardFullLabel(receivingWard)}</div>
                                        <div className="receipt-line" style={{ marginBottom: '5px' }}>7. Phí, lệ phí (nếu có): <span style={{ fontWeight: 'bold' }}>Chưa thanh toán</span></div>
                                    </>
                                ) : (
                                    <>
                                        <div className="receipt-line" style={{ marginBottom: '5px' }}>5. Đăng ký trả kết quả tại: Trung tâm phục vụ hành chính công {getWardFullLabel(receivingWard)}</div>
                                        <div className="receipt-line" style={{ marginBottom: '5px' }}>6. Phí, lệ phí (nếu có): <span style={{ fontWeight: 'bold' }}>Chưa thanh toán</span></div>
                                    </>
                                )}
                            </div>

                            {/* Signatures - Match image exactly */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', textAlign: 'center' }}>
                                <div style={{ width: '48%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '125px', textAlign: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>NGƯỜI NỘP HỒ SƠ</div>
                                        <div style={{ fontStyle: 'italic', fontSize: '13px', marginTop: '2px' }}>(Ký và ghi rõ họ tên)</div>
                                    </div>
                                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase', minHeight: '18px' }}>&nbsp;</div>
                                </div>
                                <div style={{ width: '48%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '125px', textAlign: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>NGƯỜI TIẾP NHẬN HỒ SƠ</div>
                                        <div style={{ fontStyle: 'italic', fontSize: '13px', marginTop: '2px' }}>(Ký và ghi rõ họ tên)</div>
                                    </div>
                                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '14px' }}>{currentUserName}</div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #777', fontSize: '13px' }}>
                                <div><span style={{ fontWeight: 'bold' }}>Chú ý:</span> Công dân đến nhận kết quả mang theo phiếu hẹn, CMTND/CCCD, lệ phí và giấy ủy quyền</div>
                                <div style={{ marginTop: '2px' }}>(Trong trường hợp không phải chính chủ đến nhận)</div>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px' }}>
                                    <div style={{ color: '#555', fontSize: '12px' }}>Phiên bản mẫu phiếu: TNTKQ-V5.1</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>TỔNG ĐÀI 0271.3636.836</div>
                                </div>
                            </div>

                        </div>

                        <div style={{ pageBreakBefore: 'always', marginTop: '20px' }} className="print-page-break"></div>
                        
                        <div ref={controlSlipRef} className="bg-white p-10 shadow-sm border border-gray-200 mx-auto text-black mt-8" style={{ maxWidth: '210mm', minHeight: '297mm', fontFamily: "'Times New Roman', Times, serif", fontSize: '14px', lineHeight: '1.35' }}>
                            {/* Control Slip Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                                <div style={{ width: '50%', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '13.5px', whiteSpace: 'nowrap' }}>VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '12.5px', whiteSpace: 'nowrap' }}>THÀNH PHỐ ĐỒNG NAI - CHI NHÁNH HỚN QUẢN</div>
                                </div>
                                <div style={{ width: '48%', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '14.5px', whiteSpace: 'nowrap' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                    <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '4px', fontSize: '14px' }}>Độc lập - Tự do - Hạnh phúc</div>
                                </div>
                            </div>

                            {/* Control Slip Title */}
                            <div style={{ textAlign: 'center', marginTop: '16px', marginBottom: '14px' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '17px', textTransform: 'uppercase' }}>PHIẾU KIỂM SOÁT QUÁ TRÌNH GIẢI QUYẾT HỒ SƠ</div>
                                <div style={{ fontWeight: 'bold', marginTop: '4px', fontSize: '14px' }}>Mã hồ sơ: {data.code || data.id}</div>
                            </div>

                            {/* Control Slip Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginTop: '12px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: '12%', border: '1px solid black', padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>TÊN CƠ<br/>QUAN</th>
                                        <th colSpan={2} style={{ width: '58%', border: '1px solid black', padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>THỜI GIAN GIAO, NHẬN HỒ SƠ</th>
                                        <th style={{ width: '15%', border: '1px solid black', padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>KẾT QUẢ</th>
                                        <th style={{ width: '15%', border: '1px solid black', padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Filled Row Block 1 */}
                                    <tr className="avoid-break" style={{ pageBreakInside: 'avoid' }}>
                                        <td style={{ width: '12%', border: '1px solid black', padding: '5px 6px', textAlign: 'left', fontSize: '13px' }}>1.Giao</td>
                                        <td colSpan={2} style={{ width: '58%', border: '1px solid black', padding: '5px 6px', textAlign: 'left', fontSize: '13px' }}>
                                            {formatDateTime(rDate)}
                                        </td>
                                        <td rowSpan={2} style={{ width: '15%', border: '1px solid black' }}></td>
                                        <td rowSpan={2} style={{ width: '15%', border: '1px solid black' }}></td>
                                    </tr>
                                    <tr className="avoid-break" style={{ height: '90px', pageBreakInside: 'avoid' }}>
                                        <td style={{ width: '12%', border: '1px solid black', padding: '5px 6px', textAlign: 'left', verticalAlign: 'top', fontSize: '13px' }}>2.Nhận</td>
                                        <td style={{ width: '29%', border: '1px solid black', padding: '5px 6px', textAlign: 'left', verticalAlign: 'top', fontSize: '13px' }}>
                                            <div style={{ fontWeight: 'bold' }}>Người giao</div>
                                            <div style={{ marginTop: '45px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>{currentUserName}</div>
                                        </td>
                                        <td style={{ width: '29%', border: '1px solid black', padding: '5px 6px', textAlign: 'left', verticalAlign: 'top', fontSize: '13px' }}>
                                            <div style={{ fontWeight: 'bold' }}>Người nhận</div>
                                            <div style={{ marginTop: '45px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>&nbsp;</div>
                                        </td>
                                    </tr>
                                    {/* Empty Row Blocks 2, 3, 4, 5 */}
                                    {emptyBlocks}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemReceiptTemplate;
