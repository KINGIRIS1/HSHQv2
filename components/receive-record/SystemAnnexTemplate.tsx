import React, { useState, useRef } from 'react';
import { RecordFile, Employee } from '../../types';
import { Printer, X, Edit, Info, FileDown } from 'lucide-react';
import { getNormalizedWard, getWardFullLabel } from '../../constants';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../../services/docxService';
import saveAs from 'file-saver';
import { 
    Document, 
    Packer, 
    Paragraph, 
    TextRun, 
    AlignmentType, 
    Table, 
    TableRow, 
    TableCell, 
    WidthType, 
    BorderStyle 
} from "docx";

interface SystemAnnexTemplateProps {
    data: Partial<RecordFile>;
    employees: Employee[];
    onClose: () => void;
}

const SystemAnnexTemplate: React.FC<SystemAnnexTemplateProps> = ({ data, employees = [], onClose }) => {
    const annexRef = useRef<HTMLDivElement>(null);

    // Thời gian hiện tại cho phụ lục
    const now = new Date();

    const safeParseDate = (dateVal: any, fallback: Date = new Date()) => {
        if (!dateVal) return fallback;
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? fallback : d;
    };

    const formatDateToInput = (date: Date) => {
        const validDate = safeParseDate(date, now);
        const y = validDate.getFullYear();
        const m = String(validDate.getMonth() + 1).padStart(2, '0');
        const d = String(validDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const [annexRawDate, setAnnexRawDate] = useState<string>(formatDateToInput(now));
    const [contractRawDate, setContractRawDate] = useState<string>(
        formatDateToInput(safeParseDate(data.receivedDate, now))
    );

    // Lấy ngày, tháng, năm từ annexRawDate
    const getSplitDate = (dateStr: string) => {
        if (!dateStr || dateStr.includes('NaN')) return { day: '.....', month: '.....', year: '.........' };
        const parts = dateStr.split('-');
        if (parts.length < 3) return { day: '.....', month: '.....', year: '.........' };
        return {
            day: parts[2] || '.....',
            month: parts[1] || '.....',
            year: parts[0] || '.........'
        };
    };

    const { day: dayHD, month: monthHD, year: yearHD } = getSplitDate(annexRawDate);
    const { day: dayContract, month: monthContract, year: yearContract } = getSplitDate(contractRawDate);

    const [customerName, setCustomerName] = useState<string>((data.customerName || '').toUpperCase());
    const [address, setAddress] = useState<string>(data.address || data.customerAddress || getWardFullLabel(data.ward));
    const [phone, setPhone] = useState<string>(data.phoneNumber || '');
    const [contractCode, setContractCode] = useState<string>(data.code || '');

    // Đại diện bên B - Tự động tải từ danh sách Ban Giám đốc làm giá trị mặc định đầu tiên
    const [representativeB, setRepresentativeB] = useState<string>(() => {
        const firstLeader = employees.find(e => 
            e.department?.toLowerCase().includes('lãnh đạo') || 
            e.department?.toLowerCase().includes('giám đốc') ||
            e.position?.toLowerCase().includes('giám đốc') ||
            e.position?.toLowerCase().includes('lãnh đạo')
        );
        return firstLeader ? firstLeader.name : '';
    });
    const [positionB, setPositionB] = useState<string>(() => {
        const firstLeader = employees.find(e => 
            e.department?.toLowerCase().includes('lãnh đạo') || 
            e.department?.toLowerCase().includes('giám đốc') ||
            e.position?.toLowerCase().includes('giám đốc') ||
            e.position?.toLowerCase().includes('lãnh đạo')
        );
        return firstLeader ? (firstLeader.position || 'Giám đốc') : '';
    });

    // Các điều khoản gia hạn thêm
    const [clause1, setClause1] = useState<string>('');
    const [clause2, setClause2] = useState<string>('');

    const printHtml = (htmlContent: string, title: string) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @page { 
                            size: A4;
                            margin: 20mm 15mm 15mm 15mm; 
                        }
                        body { 
                            font-family: 'Times New Roman', Times, serif; 
                            font-size: 13pt;
                            line-height: 1.45;
                            color: #000;
                            margin: 0;
                            padding: 0;
                            -webkit-print-color-adjust: exact;
                        }
                        .w-full { width: 100%; }
                        .flex { display: flex; }
                        .flex-col { flex-direction: column; }
                        .justify-between { justify-content: space-between; }
                        .items-center { align-items: center; }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: bold; }
                        .italic { font-style: italic; }
                        .underline { text-decoration: underline; }
                        .uppercase { text-transform: uppercase; }
                        .mb-1 { margin-bottom: 4px; }
                        .mb-2 { margin-bottom: 8px; }
                        .mb-4 { margin-bottom: 16px; }
                        .mb-6 { margin-bottom: 24px; }
                        .mt-4 { margin-top: 16px; }
                        .mt-6 { margin-top: 24px; }
                        .mt-8 { margin-top: 32px; }
                        .ml-8 { margin-left: 28pt; }
                        .ml-6 { margin-left: 20pt; }
                        .space-y-0.5 > * + * { margin-top: 4px; }
                        .space-y-2 > * + * { margin-top: 12px; }
                        .text-xs { font-size: 11pt; }
                        .text-lg { font-size: 14pt; }
                        .text-xl { font-size: 16pt; }
                        .line-title { border-bottom: 1.5px solid #000; width: 100px; margin: 4px auto 0 auto; }
                        .line-sub { border-bottom: 1.5px solid #000; width: 150px; margin: 4px auto 0 auto; }
                        .content-indent {
                            text-indent: 10mm;
                            margin-bottom: 8px;
                            text-align: justify;
                        }
                        .clause-list {
                            margin-left: 10mm;
                            margin-bottom: 12px;
                        }
                        .clause-item {
                            margin-bottom: 6px;
                            text-align: justify;
                        }
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
            }, 1000);
        }
    };

    // Lọc danh sách Ban Lãnh đạo/Giám đốc
    const leaders = React.useMemo(() => {
        return employees.filter(e => 
            e.department?.toLowerCase().includes('lãnh đạo') || 
            e.department?.toLowerCase().includes('giám đốc') ||
            e.position?.toLowerCase().includes('giám đốc') ||
            e.position?.toLowerCase().includes('phó giám đốc') ||
            e.position?.toLowerCase().includes('lãnh đạo')
        );
    }, [employees]);

    const handlePrint = () => {
        if (!annexRef.current) return;
        printHtml(annexRef.current.innerHTML, `Phu_Luc_Gia_Han_HD_${contractCode || 'Doc'}`);
    };

    const handleDownloadWord = async () => {
        try {
            // Khởi tạo Document của thư viện docx
            const doc = new Document({
                sections: [
                    {
                        properties: {
                            page: {
                                margin: {
                                    top: 1134, // 20mm
                                    bottom: 1134,
                                    left: 1134,
                                    right: 1134,
                                }
                            }
                        },
                        children: [
                            // 1. Header Quốc hiệu và Đơn vị chủ quản
                            new Table({
                                width: {
                                    size: 100,
                                    type: WidthType.PERCENTAGE,
                                },
                                borders: {
                                    top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                },
                                rows: [
                                    new TableRow({
                                        children: [
                                            new TableCell({
                                                width: {
                                                    size: 45,
                                                    type: WidthType.PERCENTAGE,
                                                },
                                                children: [
                                                    new Paragraph({
                                                        alignment: AlignmentType.CENTER,
                                                        children: [
                                                            new TextRun({ text: "VĂN PHÒNG ĐKĐĐ TP ĐỒNG NAI", bold: true, size: 20, font: "Times New Roman" }),
                                                        ],
                                                    }),
                                                    new Paragraph({
                                                        alignment: AlignmentType.CENTER,
                                                        children: [
                                                            new TextRun({ text: "CHI NHÁNH HỚN QUẢN", bold: true, size: 22, font: "Times New Roman" }),
                                                        ],
                                                    }),
                                                    new Paragraph({
                                                        alignment: AlignmentType.CENTER,
                                                        children: [
                                                            new TextRun({ text: "-------------", size: 16, font: "Times New Roman" }),
                                                        ],
                                                    }),
                                                ],
                                            }),
                                            new TableCell({
                                                width: {
                                                    size: 55,
                                                    type: WidthType.PERCENTAGE,
                                                },
                                                children: [
                                                    new Paragraph({
                                                        alignment: AlignmentType.CENTER,
                                                        children: [
                                                            new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, size: 20, font: "Times New Roman" }),
                                                        ],
                                                    }),
                                                    new Paragraph({
                                                        alignment: AlignmentType.CENTER,
                                                        children: [
                                                            new TextRun({ text: "Độc lập - Tự do - Hạnh phúc", bold: true, size: 22, font: "Times New Roman" }),
                                                        ],
                                                    }),
                                                    new Paragraph({
                                                        alignment: AlignmentType.CENTER,
                                                        children: [
                                                            new TextRun({ text: "____________________", bold: true, size: 18, font: "Times New Roman" }),
                                                        ],
                                                    }),
                                                ],
                                            }),
                                        ],
                                    }),
                                ],
                            }),

                            // Khoảng trống cách dòng
                            new Paragraph({ spacing: { before: 200 } }),

                            // Tiêu đề phụ lục
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 240, after: 240 },
                                children: [
                                    new TextRun({ text: "PHỤ LỤC GIA HẠN HỢP ĐỒNG", bold: true, size: 28, font: "Times New Roman" }),
                                ],
                            }),

                            // Nội dung căn cứ
                            new Paragraph({
                                alignment: AlignmentType.JUSTIFIED,
                                spacing: { after: 60 },
                                children: [
                                    new TextRun({ text: "Căn cứ theo HĐDV số: ", font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: contractCode || '..........................', bold: true, font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: " và khả năng thực hiện công việc của Văn phòng Đăng ký đất đai thành phố Đồng Nai - Chi nhánh Hớn Quản.", font: "Times New Roman", size: 26 }),
                                ],
                            }),
                            new Paragraph({
                                alignment: AlignmentType.JUSTIFIED,
                                spacing: { after: 60 },
                                children: [
                                    new TextRun({ text: `Hôm nay, ngày ${dayHD || '.....'} tháng ${monthHD || '.....'} năm ${yearHD || '.........'}, chúng tôi gồm có:`, font: "Times New Roman", size: 26 }),
                                ],
                            }),

                            // BÊN A
                            new Paragraph({
                                spacing: { before: 600, after: 60 },
                                children: [
                                    new TextRun({ text: "BÊN A: CHỦ SỬ DỤNG ĐẤT", bold: true, font: "Times New Roman", size: 26 }),
                                ],
                            }),
                            new Paragraph({
                                indent: { left: 360 },
                                spacing: { after: 40 },
                                children: [
                                    new TextRun({ text: "- Đại diện ông/bà: ", font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: customerName || '.......................................................................', bold: true, font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: " - Chủ sử dụng", font: "Times New Roman", size: 26 }),
                                ],
                            }),
                            new Paragraph({
                                indent: { left: 360 },
                                spacing: { after: 40 },
                                children: [
                                    new TextRun({ text: `- Địa chỉ: ${address || '................................................................................................................................'}`, font: "Times New Roman", size: 26 }),
                                ],
                            }),
                            new Paragraph({
                                indent: { left: 360 },
                                spacing: { after: 0 },
                                children: [
                                    new TextRun({ text: `- Điện thoại: ${phone || '......................................................'}`, font: "Times New Roman", size: 26 }),
                                ],
                            }),

                            // BÊN B
                            new Paragraph({
                                spacing: { before: 60, after: 60 },
                                children: [
                                    new TextRun({ text: "BÊN B: VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI – CHI NHÁNH HỚN QUẢN", bold: true, font: "Times New Roman", size: 26 }),
                                ],
                            }),
                            new Paragraph({
                                indent: { left: 360 },
                                spacing: { after: 40 },
                                children: [
                                    new TextRun({ text: "- Đại diện ông/bà: ", font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: representativeB || '......................................................................', bold: true, font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: ` - Chức vụ: ${positionB || '...............................................'}`, font: "Times New Roman", size: 26 }),
                                ],
                            }),
                            new Paragraph({
                                indent: { left: 360 },
                                spacing: { after: 40 },
                                children: [
                                    new TextRun({ text: "- Địa chỉ: Kp 1, phường Tân Khai, TP Đồng Nai", font: "Times New Roman", size: 26 }),
                                ],
                            }),
                            new Paragraph({
                                indent: { left: 360 },
                                spacing: { after: 40 },
                                children: [
                                    new TextRun({ text: "- Tài khoản số: 119002938108 tại Ngân hàng Vietinbank – CN Hớn Quản.", font: "Times New Roman", size: 26 }),
                                ],
                            }),
                            new Paragraph({
                                indent: { left: 360 },
                                spacing: { after: 0 },
                                children: [
                                    new TextRun({ text: "- Điện thoại: 02713 636 836          - Mã số thuế: 3600727427-020", font: "Times New Roman", size: 26 }),
                                ],
                            }),

                            // Thỏa thuận chung
                            new Paragraph({
                                alignment: AlignmentType.JUSTIFIED,
                                spacing: { before: 60, after: 120 },
                                children: [
                                    new TextRun({ text: "Sau khi xem xét, thỏa thuận hai bên đã đi đến thống nhất ký Phụ Lục HĐDV số ", font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: contractCode || '...................', bold: true, font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: " về gia hạn hợp đồng đã ký số ", font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: contractCode || '...................', bold: true, font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: `, ngày ${dayContract || '.....'} tháng ${monthContract || '.....'} năm ${yearContract || '.........'} cụ thể như sau:`, font: "Times New Roman", size: 26 }),
                                ],
                            }),

                            // Điều khoản 1, 2, 3
                            ...(clause1 ? [
                                new Paragraph({
                                    alignment: AlignmentType.JUSTIFIED,
                                    indent: { left: 360 },
                                    spacing: { after: 80 },
                                    children: [
                                        new TextRun({ text: "1. ", bold: true, font: "Times New Roman", size: 26 }),
                                        new TextRun({ text: clause1, font: "Times New Roman", size: 26 }),
                                    ],
                                })
                            ] : [
                                new Paragraph({
                                    alignment: AlignmentType.JUSTIFIED,
                                    indent: { left: 360 },
                                    spacing: { after: 40 },
                                    children: [
                                        new TextRun({ text: "1. ", bold: true, font: "Times New Roman", size: 26 }),
                                        new TextRun({ text: ".........................................................................................................................................", font: "Times New Roman", size: 26 }),
                                    ],
                                }),
                                new Paragraph({
                                    alignment: AlignmentType.JUSTIFIED,
                                    indent: { left: 360 },
                                    spacing: { after: 80 },
                                    children: [
                                        new TextRun({ text: ".................................................................................................................................................", font: "Times New Roman", size: 26 }),
                                    ],
                                })
                            ]),
                            ...(clause2 ? [
                                new Paragraph({
                                    alignment: AlignmentType.JUSTIFIED,
                                    indent: { left: 360 },
                                    spacing: { after: 80 },
                                    children: [
                                        new TextRun({ text: "2. ", bold: true, font: "Times New Roman", size: 26 }),
                                        new TextRun({ text: clause2, font: "Times New Roman", size: 26 }),
                                    ],
                                })
                            ] : [
                                new Paragraph({
                                    alignment: AlignmentType.JUSTIFIED,
                                    indent: { left: 360 },
                                    spacing: { after: 40 },
                                    children: [
                                        new TextRun({ text: "2. ", bold: true, font: "Times New Roman", size: 26 }),
                                        new TextRun({ text: ".........................................................................................................................................", font: "Times New Roman", size: 26 }),
                                    ],
                                }),
                                new Paragraph({
                                    alignment: AlignmentType.JUSTIFIED,
                                    indent: { left: 360 },
                                    spacing: { after: 80 },
                                    children: [
                                        new TextRun({ text: ".................................................................................................................................................", font: "Times New Roman", size: 26 }),
                                    ],
                                })
                            ]),
                            new Paragraph({
                                alignment: AlignmentType.JUSTIFIED,
                                indent: { left: 360 },
                                spacing: { after: 40 },
                                children: [
                                    new TextRun({ text: "3. Điều khoản chung :", bold: true, font: "Times New Roman", size: 26 }),
                                ],
                            }),
                            new Paragraph({
                                alignment: AlignmentType.JUSTIFIED,
                                indent: { left: 360 },
                                spacing: { after: 40 },
                                children: [
                                    new TextRun({ text: "3.1 Quyền và nghĩa vụ của mỗi bên được quy định trong hợp đồng số ", font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: contractCode || '...................', bold: true, font: "Times New Roman", size: 26 }),
                                ],
                            }),
                            new Paragraph({
                                alignment: AlignmentType.JUSTIFIED,
                                indent: { left: 360 },
                                spacing: { after: 40 },
                                children: [
                                    new TextRun({ text: "3.2 PLHĐ được lập thành 02 bản, có nội dung & giá trị pháp lý như nhau, mỗi bên giữ 01 bản", font: "Times New Roman", size: 26 }),
                                ],
                            }),
                            new Paragraph({
                                alignment: AlignmentType.JUSTIFIED,
                                indent: { left: 360 },
                                spacing: { after: 180 },
                                children: [
                                    new TextRun({ text: "3.3 Phụ lục này là một phần không thể tách rời của Hợp đồng số ", font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: contractCode || '...................', bold: true, font: "Times New Roman", size: 26 }),
                                    new TextRun({ text: " và có giá trị kể từ ngày ký", font: "Times New Roman", size: 26 }),
                                ],
                            }),

                            // Ký tên hai bên
                            new Table({
                                width: {
                                    size: 100,
                                    type: WidthType.PERCENTAGE,
                                },
                                borders: {
                                    top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                },
                                rows: [
                                    new TableRow({
                                        children: [
                                            new TableCell({
                                                width: {
                                                    size: 50,
                                                    type: WidthType.PERCENTAGE,
                                                },
                                                children: [
                                                    new Paragraph({
                                                        alignment: AlignmentType.CENTER,
                                                        children: [
                                                            new TextRun({ text: "ĐẠI DIỆN BÊN A", bold: true, size: 24, font: "Times New Roman" }),
                                                        ],
                                                    }),
                                                    new Paragraph({
                                                        alignment: AlignmentType.CENTER,
                                                        children: [
                                                            new TextRun({ text: "(Chủ sử dụng ký và ghi rõ họ tên)", italics: true, size: 20, font: "Times New Roman" }),
                                                        ],
                                                    }),
                                                    new Paragraph({ spacing: { before: 1200 } }),
                                                    new Paragraph({
                                                        alignment: AlignmentType.CENTER,
                                                        children: [
                                                            new TextRun({ text: customerName || '', bold: true, size: 24, font: "Times New Roman" }),
                                                        ],
                                                    }),
                                                ],
                                            }),
                                            new TableCell({
                                                width: {
                                                    size: 50,
                                                    type: WidthType.PERCENTAGE,
                                                },
                                                children: [
                                                    new Paragraph({
                                                        alignment: AlignmentType.CENTER,
                                                        children: [
                                                            new TextRun({ text: "ĐẠI DIỆN BÊN B", bold: true, size: 24, font: "Times New Roman" }),
                                                        ],
                                                    }),
                                                    new Paragraph({
                                                        alignment: AlignmentType.CENTER,
                                                        children: [
                                                            new TextRun({ text: "(Ký tên và đóng dấu)", italics: true, size: 20, font: "Times New Roman" }),
                                                        ],
                                                    }),
                                                    new Paragraph({ spacing: { before: 1200 } }),
                                                    new Paragraph({
                                                        alignment: AlignmentType.CENTER,
                                                        children: [
                                                            new TextRun({ text: representativeB || '', bold: true, size: 24, font: "Times New Roman" }),
                                                        ],
                                                    }),
                                                ],
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    },
                ],
            });

            // Biên dịch document thành Blob
            const blob = await Packer.toBlob(doc);
            const fileName = `Phu_Luc_Gia_Han_${contractCode || 'HS'}.docx`;

            const electron = (window as any).electronAPI;
            if (electron && electron.saveAndOpenFile) {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    if (!electron?.saveAndOpenFile) return;
                    const base64Data = (reader.result as string).split(',')[1];
                    const result = await electron.saveAndOpenFile({
                        fileName: fileName,
                        base64Data: base64Data
                    });
                    if (!result.success) {
                        alert(`Lỗi khi lưu file: ${result.message}`);
                    }
                };
            } else {
                saveAs(blob, fileName);
            }
        } catch (err: any) {
            console.error("Lỗi khi tải file Word tự sinh:", err);
            alert("Lỗi tải xuống file Word tự sinh: " + err.message);
        }
    };

    return (
        <div id="system-annex-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
                
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-pink-100 text-pink-700 rounded-lg">
                            <Printer size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-850">Mẫu Hệ Thống: Phụ Lục Gia Hạn Hợp Đồng</h2>
                            <p className="text-xs text-slate-500">Chỉnh sửa nội dung nhanh và in trực tiếp theo quy chuẩn A4</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleDownloadWord} 
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md transition-all cursor-pointer"
                            title="Tải phụ lục mẫu Word định dạng .docx"
                        >
                            <FileDown size={16} /> Tải file Word
                        </button>
                        <button 
                            onClick={handlePrint} 
                            className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-sm font-bold shadow-md transition-all cursor-pointer"
                        >
                            <Printer size={16} /> In Phụ Lục
                        </button>
                        <button 
                            onClick={onClose} 
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Workspace Split */}
                <div className="flex-1 flex overflow-hidden">
                    
                    {/* Left: Input Editor Panel */}
                    <div className="w-1/3 border-r border-slate-100 p-5 overflow-y-auto bg-slate-50/50 space-y-4">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Edit size={12} /> Biên tập nội dung phụ lục
                        </div>

                        {/* Thông tin hợp đồng gốc */}
                        <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 border-b pb-1.5 flex items-center gap-1">
                                <Info size={12} className="text-pink-600" /> Hơp đồng gốc & Khách hàng
                            </h3>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Số HĐDV / Mã HS</label>
                                <input 
                                    type="text" 
                                    value={contractCode} 
                                    onChange={(e) => setContractCode(e.target.value)}
                                    className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-pink-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày ký Hợp đồng gốc</label>
                                <input 
                                    type="date" 
                                    value={contractRawDate} 
                                    onChange={(e) => setContractRawDate(e.target.value)}
                                    className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-pink-500 bg-white shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Ngày ký Phụ lục</label>
                                <input 
                                    type="date" 
                                    value={annexRawDate} 
                                    onChange={(e) => setAnnexRawDate(e.target.value)}
                                    className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-pink-500 bg-white shadow-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Đại diện Bên A (TÊN VIẾT HOA)</label>
                                <input 
                                    type="text" 
                                    value={customerName} 
                                    onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                                    className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-pink-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Địa chỉ bên A</label>
                                <input 
                                    type="text" 
                                    value={address} 
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-pink-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Điện thoại bên A</label>
                                <input 
                                    type="text" 
                                    value={phone} 
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-pink-500"
                                />
                            </div>
                        </div>

                        {/* Thông tin Đại diện Bên B */}
                        <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 border-b pb-1.5 flex items-center gap-1">
                                <Info size={12} className="text-pink-600" /> Đại diện bên B
                            </h3>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Chọn nhanh thành viên Ban Giám đốc</label>
                                <select 
                                    className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-pink-500 bg-white"
                                    onChange={(e) => {
                                        const empId = e.target.value;
                                        if (empId) {
                                            const found = leaders.find(l => l.id === empId);
                                            if (found) {
                                                setRepresentativeB(found.name);
                                                setPositionB(found.position || 'Giám đốc');
                                            }
                                        }
                                    }}
                                    defaultValue=""
                                >
                                    <option value="" disabled>-- Chọn thành viên Ban Giám đốc --</option>
                                    {leaders.map(l => (
                                        <option key={l.id} value={l.id}>
                                            {l.name} - {l.position || 'Lãnh đạo'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Đại diện ông/bà (Tự chỉnh sửa)</label>
                                <input 
                                    type="text" 
                                    value={representativeB} 
                                    onChange={(e) => setRepresentativeB(e.target.value)}
                                    placeholder="Ví dụ: Lê Văn Sơn"
                                    className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-pink-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Chức vụ (Tự chỉnh sửa)</label>
                                <input 
                                    type="text" 
                                    value={positionB} 
                                    onChange={(e) => setPositionB(e.target.value)}
                                    placeholder="Ví dụ: Giám đốc / Trưởng phòng kỹ thuật"
                                    className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-pink-500"
                                />
                            </div>
                        </div>

                        {/* Thỏa thuận điều khoản gia hạn */}
                        <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 border-b pb-1.5 flex items-center gap-1">
                                <Info size={12} className="text-pink-600" /> Thỏa thuận gia hạn
                            </h3>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Nội dung thỏa thuận 1</label>
                                <textarea 
                                    rows={3}
                                    value={clause1} 
                                    onChange={(e) => setClause1(e.target.value)}
                                    className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-pink-500 resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Nội dung thỏa thuận 2</label>
                                <textarea 
                                    rows={3}
                                    value={clause2} 
                                    onChange={(e) => setClause2(e.target.value)}
                                    className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-pink-500 resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right: Preview Paper A4 */}
                    <div className="flex-1 bg-slate-200/60 p-6 overflow-y-auto flex justify-center shadow-inner">
                        <div className="w-[210mm] min-h-[297mm] bg-white p-16 shadow-lg border border-slate-300 self-start text-black flex flex-col justify-between"
                             style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                            
                            {/* Nội dung để In */}
                            <div ref={annexRef} className="w-full text-black select-text" style={{ fontSize: '13pt', lineHeight: '1.45', fontFamily: "'Times New Roman', Times, serif" }}>
                                
                                {/* Header Quốc hiệu */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className="text-center" style={{ width: '45%' }}>
                                        <div className="font-bold uppercase" style={{ fontSize: '12pt' }}>VĂN PHÒNG ĐKĐĐ TP ĐỒNG NAI</div>
                                        <div className="font-bold uppercase" style={{ fontSize: '13pt' }}>CHI NHÁNH HỚN QUẢN</div>
                                        <div className="line-title"></div>
                                    </div>
                                    <div className="text-center" style={{ width: '53%' }}>
                                        <div className="font-bold" style={{ fontSize: '12pt' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                        <div className="font-bold" style={{ fontSize: '13pt' }}>Độc lập - Tự do - Hạnh phúc</div>
                                        <div className="line-sub"></div>
                                    </div>
                                </div>

                                {/* Title */}
                                <div className="text-center mt-8 mb-6">
                                    <div className="font-bold uppercase tracking-wide" style={{ fontSize: '16pt' }}>PHỤ LỤC GIA HẠN HỢP ĐỒNG</div>
                                </div>

                                {/* Base info */}
                                <div className="content-indent">
                                    Căn cứ theo HĐDV số: <span className="font-bold">{contractCode || '..........................'}</span> và khả năng thực hiện công việc của Văn phòng Đăng ký đất đai thành phố Đồng Nai - Chi nhánh Hớn Quản.
                                </div>
                                <div className="content-indent">
                                    Hôm nay, ngày {dayHD || '.....'} tháng {monthHD || '.....'} năm {yearHD || '.........'}, chúng tôi gồm có:
                                </div>

                                {/* Bên A */}
                                <div className="font-bold uppercase mb-1" style={{ marginTop: '2px' }}>BÊN A: CHỦ SỬ DỤNG ĐẤT</div>
                                <div className="ml-8 space-y-0.5">
                                    <div>- Đại diện ông/bà: <span className="font-bold">{customerName || '.......................................................................'}</span> - Chủ sử dụng</div>
                                    <div>- Địa chỉ: {address || '................................................................................................................................'}</div>
                                    <div>- Điện thoại: {phone || '......................................................'}</div>
                                </div>

                                {/* Bên B */}
                                <div className="font-bold uppercase mb-1" style={{ marginTop: '2px' }}>BÊN B: VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI – CHI NHÁNH HỚN QUẢN</div>
                                <div className="ml-8 space-y-0.5">
                                    <div>- Đại diện ông/bà: <span className="font-bold">{representativeB || '......................................................................'}</span> - Chức vụ: {positionB || '...............................................'}</div>
                                    <div>- Địa chỉ: Kp 1, phường Tân Khai, TP Đồng Nai</div>
                                    <div>- Tài khoản số: 119002938108 tại Ngân hàng Vietinbank – CN Hớn Quản.</div>
                                    <div className="flex justify-between">
                                        <div style={{ flex: 1 }}>- Điện thoại: 02713 636 836</div>
                                        <div style={{ width: '45%' }}>- Mã số thuế: 3600727427-020</div>
                                    </div>
                                </div>

                                {/* Agreement intro */}
                                <div className="content-indent" style={{ marginTop: '2px' }}>
                                    Sau khi xem xét, thỏa thuận hai bên đã đi đến thống nhất ký Phụ Lục HĐDV số <span className="font-bold">{contractCode || '...................'}</span> về gia hạn hợp đồng đã ký số <span className="font-bold">{contractCode || '...................'}</span>, ngày {dayContract || '.....'} tháng {monthContract || '.....'} năm {yearContract || '.........'} cụ thể như sau:
                                </div>

                                {/* Clauses */}
                                <div className="clause-list space-y-2">
                                    <div className="clause-item">
                                        {clause1 ? (
                                            <>
                                                <span className="font-bold">1. </span>{clause1}
                                            </>
                                        ) : (
                                            <div className="space-y-1">
                                                <div><span className="font-bold">1. </span>.........................................................................................................................................</div>
                                                <div>.................................................................................................................................................</div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="clause-item">
                                        {clause2 ? (
                                            <>
                                                <span className="font-bold">2. </span>{clause2}
                                            </>
                                        ) : (
                                            <div className="space-y-1">
                                                <div><span className="font-bold">2. </span>.........................................................................................................................................</div>
                                                <div>.................................................................................................................................................</div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="clause-item">
                                        <span className="font-bold">3. Điều khoản chung :</span>
                                        <div className="space-y-0.5 mt-1">
                                            <div>3.1 Quyền và nghĩa vụ của mỗi bên được quy định trong hợp đồng số <span className="font-bold">{contractCode || '...................'}</span></div>
                                            <div>3.2 PLHĐ được lập thành 02 bản, có nội dung & giá trị pháp lý như nhau, mỗi bên giữ 01 bản</div>
                                            <div>3.3 Phụ lục này là một phần không thể tách rời của Hợp đồng số <span className="font-bold">{contractCode || '...................'}</span> và có giá trị kể từ ngày ký</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Signatures block */}
                                <div className="flex justify-between mt-12 text-center" style={{ pageBreakInside: 'avoid' }}>
                                    <div style={{ width: '45%' }}>
                                        <div className="font-bold uppercase" style={{ fontSize: '13pt' }}>ĐẠI DIỆN BÊN A</div>
                                        <div className="italic" style={{ fontSize: '11pt' }}>(Chủ sử dụng ký và ghi rõ họ tên)</div>
                                        <div style={{ height: '70px' }}></div>
                                        <div className="font-bold uppercase" style={{ fontSize: '13pt' }}>{customerName}</div>
                                    </div>
                                    <div style={{ width: '45%' }}>
                                        <div className="font-bold uppercase" style={{ fontSize: '13pt' }}>ĐẠI DIỆN BÊN B</div>
                                        <div className="italic" style={{ fontSize: '11pt' }}>(Ký tên và đóng dấu)</div>
                                        <div style={{ height: '70px' }}></div>
                                        <div className="font-bold uppercase" style={{ fontSize: '13pt' }}>{representativeB}</div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default SystemAnnexTemplate;
