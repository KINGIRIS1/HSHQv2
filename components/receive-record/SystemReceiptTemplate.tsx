import React, { useRef } from 'react';
import Barcode from 'react-barcode';
import { RecordFile } from '../../types';
import { getNormalizedWard, getShortRecordType, getWardFullLabel } from '../../constants';
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

    const printHtml = (htmlContent: string, title: string) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @page { margin: 15mm; }
                        body { 
                            font-family: 'Times New Roman', Times, serif; 
                            font-size: 14px;
                            line-height: 1.3;
                            color: #000;
                            -webkit-print-color-adjust: exact;
                        }
                        .flex { display: flex; }
                        .flex-col { flex-direction: column; }
                        .justify-between { justify-content: space-between; }
                        .items-center { align-items: center; }
                        .items-end { align-items: flex-end; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .italic { font-style: italic; }
                        .underline { text-decoration: underline; }
                        .uppercase { text-transform: uppercase; }
                        .mb-1 { margin-bottom: 4px; }
                        .mb-2 { margin-bottom: 8px; }
                        .mb-4 { margin-bottom: 16px; }
                        .mt-4 { margin-top: 16px; }
                        .mt-8 { margin-top: 32px; }
                        .text-lg { font-size: 16px; }
                        .text-xl { font-size: 18px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 8px; }
                        th, td { border: 1px solid #000; padding: 4px 8px; text-align: left; }
                        th { text-align: center; font-weight: bold; }
                        .text-gray { color: #666; }
                        .footer-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 10px; }
                        .print-page-break { page-break-before: always; }
                        .avoid-break { page-break-inside: avoid; }
                    </style>
                </head>
                <body>
                    ${htmlContent}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 1500);
        }
    };

    const handlePrintAll = () => {
        if (!receiptRef.current || !controlSlipRef.current) return;
        const receiptHtml = receiptRef.current.innerHTML;
        // Print 2 identical receipts and 1 control slip
        const printContent = 
            receiptHtml + 
            '<div style="page-break-before: always; margin-top: 20px;" class="print-page-break"></div>' + 
            receiptHtml + 
            '<div style="page-break-before: always; margin-top: 20px;" class="print-page-break"></div>' + 
            controlSlipRef.current.innerHTML;
        printHtml(printContent, 'In Tất Cả (2 Biên Nhận + 1 Phiếu Kiểm Soát)');
    };

    const handlePrintReceipt = () => {
        if (!receiptRef.current) return;
        printHtml(receiptRef.current.innerHTML, 'In Biên Nhận');
    };

    const handlePrintControlSlip = () => {
        if (!controlSlipRef.current) return;
        printHtml(controlSlipRef.current.innerHTML, 'In Phiếu Kiểm Soát');
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
    let parsedDocs: { name: string; type: string }[] = [];
    try {
        if (data.otherDocs) {
            parsedDocs = JSON.parse(data.otherDocs);
        }
    } catch (e) {
        if (data.otherDocs) {
            const parts = data.otherDocs.split('|');
            parsedDocs = [{ name: parts[0], type: (parts[1] === 'Bản sao' ? 'Bản sao' : 'Bản chính') }];
        }
    }

    // Default base documents
    const defaultDocs = [
        { name: 'Phiếu yêu cầu lập hợp đồng đo đạc dịch vụ; trích lục ; Cung cấp thông tin thửa đất', type: 'Bản chính' },
        { name: 'Giấy chứng nhận đã cấp.', type: 'Bản sao' }
    ];

    const finalDocs = [...defaultDocs];

    // Append any additional ones, filtering out duplicate lookalikes
    parsedDocs.forEach(doc => {
        const docName = doc.name?.trim();
        if (!docName) return;

        const isDuplicate = defaultDocs.some(def => {
            const cleanDef = def.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanDoc = docName.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanDoc.includes(cleanDef) || cleanDef.includes(cleanDoc);
        });

        if (!isDuplicate) {
            finalDocs.push({
                name: docName,
                type: doc.type || 'Bản chính'
            });
        }
    });

    // We render exactly 4 empty blocks, each consisting of a 1.Giao row and a 2.Nhận row, matching the PDF's clean table structure
    const emptyBlocks = Array(4).fill(0).map((_, i) => (
        <React.Fragment key={`empty-block-${i}`}>
            <tr className="avoid-break">
                <td style={{ width: '12%', border: '1px solid black', padding: '6px', textAlign: 'left' }}>1.Giao</td>
                <td colSpan={2} style={{ width: '58%', border: '1px solid black', padding: '6px', textAlign: 'left' }}>
                    <span style={{ color: '#aaa' }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; giờ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; phút, ngày &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; tháng &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; năm .........</span>
                </td>
                <td rowSpan={2} style={{ width: '15%', border: '1px solid black' }}></td>
                <td rowSpan={2} style={{ width: '15%', border: '1px solid black' }}></td>
            </tr>
            <tr className="avoid-break" style={{ height: '110px' }}>
                <td style={{ width: '12%', border: '1px solid black', padding: '6px', textAlign: 'left', verticalAlign: 'top' }}>2.Nhận</td>
                <td style={{ width: '29%', border: '1px solid black', padding: '6px', textAlign: 'left', verticalAlign: 'top' }}>
                    <div className="font-bold">Người giao</div>
                    <div style={{ marginTop: '55px' }}>&nbsp;</div>
                </td>
                <td style={{ width: '29%', border: '1px solid black', padding: '6px', textAlign: 'left', verticalAlign: 'top' }}>
                    <div className="font-bold">Người nhận</div>
                    <div style={{ marginTop: '55px' }}>&nbsp;</div>
                </td>
            </tr>
        </React.Fragment>
    ));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold">In Biên Nhận & Phiếu Kiểm Soát</h2>
                    <div className="flex space-x-2">
                        {onCreateContract && data && data.recordType && (getShortRecordType(data.recordType).startsWith('2.3') || getShortRecordType(data.recordType).startsWith('2.4')) && (
                            <button onClick={() => { onCreateContract(data); onClose(); }} className="flex items-center px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700">
                                <FileSignature className="w-4 h-4 mr-2" /> Lập Hợp Đồng
                            </button>
                        )}
                        <button onClick={handlePrintReceipt} className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            <Printer className="w-4 h-4 mr-2" /> In Biên Nhận
                        </button>
                        <button onClick={handlePrintControlSlip} className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                            <Printer className="w-4 h-4 mr-2" /> In Phiếu Quy Trình
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
                        <div ref={receiptRef} className="bg-white p-10 shadow-sm border border-gray-200 mx-auto text-black" style={{ maxWidth: '210mm', minHeight: '297mm', fontFamily: "'Times New Roman', Times, serif", fontSize: '14px', lineHeight: '1.3' }}>
                            
                            {/* Header */}
                            <div className="flex justify-between mb-4">
                                <div className="text-center" style={{ width: '45%' }}>
                                    <div className="font-bold text-[15px]">SỞ NÔNG NGHIỆP VÀ MÔI TRƯỜNG</div>
                                    <div className="font-bold text-[16px]">BỘ PHẬN TIẾP NHẬN VÀ TRẢ KẾT QUẢ</div>
                                    
                                    {data.code && (
                                        <div className="mt-2 text-center" style={{ display: 'block' }}>
                                            <div className="font-bold text-[15px]" style={{ display: 'block', whiteSpace: 'nowrap' }}>{data.code}</div>
                                            <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center', marginTop: '-4px', display: 'inline-block' }}>
                                                <Barcode value={data.code} height={30} displayValue={false} margin={0} width={1.5} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="text-center" style={{ width: '50%' }}>
                                    <div className="font-bold text-[15px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                    <div className="font-bold underline mb-2">Độc lập - Tự do - Hạnh phúc</div>
                                    <div className="italic mt-4">{getNormalizedWard(receivingWard)}, {formatDateOnly(new Date())}</div>
                                </div>
                            </div>

                            {/* Title */}
                            <div className="text-center mt-6 mb-4">
                                <div className="font-bold text-[18px]">GIẤY TIẾP NHẬN HỒ SƠ VÀ HẸN TRẢ KẾT QUẢ</div>
                            </div>

                            {/* Content */}
                            <div className="space-y-[6px]">
                                <div>Bộ phận tiếp nhận và trả kết quả: <span className="font-bold">Sở Nông nghiệp và Môi trường</span></div>
                                <div>Tiếp nhận hồ sơ của: <span className="font-bold">{data.customerName}</span></div>
                                <div>CCCD/MST: <span className="font-bold">{data.cccd || ''}</span></div>
                                <div>Số điện thoại: {data.phoneNumber}</div>
                                <div className="flex">
                                    <div style={{ marginRight: '2cm' }}>Tờ: {data.mapSheet}</div>
                                    <div>Thửa: {data.landPlot}</div>
                                </div>
                                <div>Địa chỉ thửa đất: <span className="font-bold">{getDisplayLandAddress()}</span></div>
                                <div>Thủ tục hành chính cần giải quyết: <span className="font-bold">{data.recordType}</span></div>
                                
                                <div>1. Thành phần hồ sơ, yêu cầu và số lượng mỗi loại giấy tờ gồm:</div>
                                <table className="w-full border-collapse border border-black mt-1 mb-2">
                                    <thead>
                                        <tr>
                                            <th className="border border-black p-1 text-center w-12">STT</th>
                                            <th className="border border-black p-1 text-center">Tên giấy tờ</th>
                                            <th className="border border-black p-1 text-center w-24">Loại giấy tờ</th>
                                            <th className="border border-black p-1 text-center w-20">Số lượng</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {finalDocs.map((doc, idx) => (
                                            <tr key={`doc-${idx}`}>
                                                <td className="border border-black p-1 text-center">{idx + 1}</td>
                                                <td className="border border-black p-1">{doc.name}</td>
                                                <td className="border border-black p-1 text-center">{doc.type}</td>
                                                <td className="border border-black p-1 text-center">1</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div>2. Số lượng hồ sơ: 01 (bộ)</div>
                                <div>3. Thời gian nhận hồ sơ: <span className="font-bold">{formatDateTime(rDate)}</span></div>
                                <div>4. Thời gian dự kiến trả kết quả giải quyết hồ sơ: <span className="font-bold">{formatDateTime(dDate)}</span></div>
                                <div>5. Đăng ký trả kết quả tại: Trung tâm phục vụ hành chính công {getWardFullLabel(receivingWard)}</div>
                                <div>6. Phí, lệ phí (nếu có): <span className="font-bold">Chưa thanh toán</span></div>
                            </div>

                            {/* Signatures */}
                            <div className="flex justify-between mt-8 text-center">
                                <div className="w-1/2 flex flex-col justify-between" style={{ height: '140px' }}>
                                    <div>
                                        <div className="font-bold">NGƯỜI NỘP HỒ SƠ</div>
                                        <div className="italic text-[13px]">(Ký và ghi rõ họ tên)</div>
                                    </div>
                                    <div className="font-bold uppercase">&nbsp;</div>
                                </div>
                                <div className="w-1/2 flex flex-col justify-between" style={{ height: '140px' }}>
                                    <div>
                                        <div className="font-bold">NGƯỜI TIẾP NHẬN HỒ SƠ</div>
                                        <div className="italic text-[13px]">(Ký và ghi rõ họ tên)</div>
                                    </div>
                                    <div className="font-bold uppercase text-[15px]">{currentUserName}</div>
                                </div>
                            </div>

                            <div style={{ height: '30px' }}></div>

                            {/* Footer */}
                            <div className="pt-4 border-t border-gray-400">
                                <div><span className="font-bold">Chú ý:</span> Công dân đến nhận kết quả mang theo phiếu hẹn, CMTND/CCCD, lệ phí và giấy ủy quyền</div>
                                <div className="mt-1">(Trong trường hợp không phải chính chủ đến nhận)</div>
                                
                                <div className="flex justify-between items-end mt-4">
                                    <div className="text-gray-500 text-sm">Phiên bản mẫu phiếu: TNTKQ-V5.1</div>
                                    <div className="font-bold">TỔNG ĐÀI 0271.3636.836</div>
                                </div>
                            </div>

                        </div>

                        <div style={{ pageBreakBefore: 'always', marginTop: '20px' }} className="print-page-break"></div>
                        
                        <div ref={controlSlipRef} className="bg-white p-10 shadow-sm border border-gray-200 mx-auto text-black mt-8" style={{ maxWidth: '210mm', minHeight: '297mm', fontFamily: "'Times New Roman', Times, serif", fontSize: '14px', lineHeight: '1.3' }}>
                            {/* Control Slip Header */}
                            <div className="flex justify-between mb-4">
                                <div className="text-center" style={{ width: '45%' }}>
                                    <div className="font-bold text-[15px]">VĂN PHÒNG ĐKĐĐ TP ĐỒNG NAI</div>
                                    <div className="font-bold text-[16px]">CHI NHÁNH HỚN QUẢN</div>
                                </div>
                                <div className="text-center" style={{ width: '50%' }}>
                                    <div className="font-bold text-[15px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                    <div className="font-bold underline mb-2">Độc lập - Tự do - Hạnh phúc</div>
                                </div>
                            </div>

                            {/* Control Slip Title */}
                            <div className="text-center mt-6 mb-4">
                                <div className="font-bold text-[18px]">PHIẾU KIỂM SOÁT QUÁ TRÌNH GIẢI QUYẾT HỒ SƠ</div>
                                <div className="font-bold mt-2">Mã hồ sơ: {data.code || data.id}</div>
                            </div>

                            {/* Control Slip Table */}
                            <table className="w-full border-collapse border border-black mt-4">
                                <thead>
                                    <tr>
                                        <th style={{ width: '12%', border: '1px solid black', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>TÊN CƠ<br/>QUAN</th>
                                        <th colSpan={2} style={{ width: '58%', border: '1px solid black', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>THỜI GIAN GIAO, NHẬN HỒ SƠ</th>
                                        <th style={{ width: '15%', border: '1px solid black', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>KẾT QUẢ</th>
                                        <th style={{ width: '15%', border: '1px solid black', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Filled Row Block 1 */}
                                    <tr className="avoid-break">
                                        <td style={{ width: '12%', border: '1px solid black', padding: '6px', textAlign: 'left' }}>1.Giao</td>
                                        <td colSpan={2} style={{ width: '58%', border: '1px solid black', padding: '6px', textAlign: 'left' }}>
                                            {formatDateTime(rDate)}
                                        </td>
                                        <td rowSpan={2} style={{ width: '15%', border: '1px solid black' }}></td>
                                        <td rowSpan={2} style={{ width: '15%', border: '1px solid black' }}></td>
                                    </tr>
                                    <tr className="avoid-break" style={{ height: '110px' }}>
                                        <td style={{ width: '12%', border: '1px solid black', padding: '6px', textAlign: 'left', verticalAlign: 'top' }}>2.Nhận</td>
                                        <td style={{ width: '29%', border: '1px solid black', padding: '6px', textAlign: 'left', verticalAlign: 'top' }}>
                                            <div className="font-bold">Người giao</div>
                                            <div style={{ marginTop: '55px', textAlign: 'center' }} className="font-bold uppercase text-[12px]">{currentUserName}</div>
                                        </td>
                                        <td style={{ width: '29%', border: '1px solid black', padding: '6px', textAlign: 'left', verticalAlign: 'top' }}>
                                            <div className="font-bold">Người nhận</div>
                                            <div style={{ marginTop: '55px', textAlign: 'center' }} className="font-bold uppercase text-[12px]">&nbsp;</div>
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
