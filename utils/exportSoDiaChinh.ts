import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle, VerticalAlign } from "docx";
import { saveAs } from "file-saver";
import { ArchiveRecord } from "../services/apiArchive";

export const generateSoDiaChinhBlob = async (records: ArchiveRecord[], quyenSo: string = "", exportTocOnly: boolean = false): Promise<Blob> => {
    if (!records || records.length === 0) throw new Error("No records");

    // Helper to create a cell with specific text
    const createCell = (text: string, width: number, bold = false, align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.CENTER, colSpan = 1, rowSpan = 1) => {
        const lines = text.split('\n');
        return new TableCell({
            width: { size: width, type: WidthType.PERCENTAGE },
            columnSpan: colSpan,
            rowSpan: rowSpan,
            verticalAlign: VerticalAlign.CENTER,
            children: lines.map(line => new Paragraph({
                alignment: align,
                children: [new TextRun({ text: line, bold, size: 22, font: "Arial" })], // Size 22 = 11pt
            })),
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
        });
    };

    // Parse date
    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    const formatArea = (val: number) => {
        if (isNaN(val)) return "";
        return Number(val.toFixed(2)).toString();
    };

    const rowsPerPage = 33; // Changed from 40 to 33 to fit A3 page perfectly
    const itemsPerPage = rowsPerPage * 2; // 66 items per TOC page
    const tocPagesCount = Math.max(1, Math.ceil(records.length / itemsPerPage));

    const tocSections = [];
    
    for (let pageIdx = 0; pageIdx < tocPagesCount; pageIdx++) {
        const tocTableRows = [];
        
        // Header rows
        tocTableRows.push(
            new TableRow({
                children: [
                    createCell("Số\nthứ tự", 5, true, AlignmentType.CENTER, 1, 2),
                    createCell("Tên người sử dụng đất", 25, true, AlignmentType.CENTER, 1, 2),
                    createCell("Đăng ký tại\nsổ địa chính", 20, true, AlignmentType.CENTER, 2, 1),
                    createCell("Số\nthứ tự", 5, true, AlignmentType.CENTER, 1, 2),
                    createCell("Tên người sử dụng đất", 25, true, AlignmentType.CENTER, 1, 2),
                    createCell("Đăng ký tại\nsổ địa chính", 20, true, AlignmentType.CENTER, 2, 1),
                ],
                height: { value: 500, rule: "atLeast" }
            }),
            new TableRow({
                children: [
                    createCell("Quyển số", 10, true, AlignmentType.CENTER),
                    createCell("Trang số", 10, true, AlignmentType.CENTER),
                    createCell("Quyển số", 10, true, AlignmentType.CENTER),
                    createCell("Trang số", 10, true, AlignmentType.CENTER),
                ],
                height: { value: 500, rule: "atLeast" }
            })
        );

        for (let rowIdx = 0; rowIdx < rowsPerPage; rowIdx++) {
            const leftIndex = pageIdx * itemsPerPage + rowIdx;
            const rightIndex = pageIdx * itemsPerPage + rowsPerPage + rowIdx;
            
            const leftRecord = leftIndex < records.length ? records[leftIndex] : null;
            const rightRecord = rightIndex < records.length ? records[rightIndex] : null;

            const leftPageNum = leftIndex + 1;
            const rightPageNum = rightIndex + 1;

            const formatNameForTOC = (nameStr: string) => {
                if (!nameStr) return "";
                return nameStr.split('\n\n').map(block => {
                    const lines = block.split('\n');
                    let name = lines[0] || '';
                    const cccdMatch = name.match(/^(.*?)\s+(CCCD:\s*.*)$/);
                    if (cccdMatch) {
                        name = cccdMatch[1];
                    }
                    return name;
                }).filter(Boolean).join('; ');
            };

            tocTableRows.push(
                new TableRow({
                    children: [
                        createCell(leftRecord ? (leftIndex + 1).toString() : "", 5, false, AlignmentType.CENTER),
                        createCell(formatNameForTOC(leftRecord?.data?.ten_chu_su_dung || leftRecord?.noi_nhan_gui || ""), 25, false, AlignmentType.LEFT),
                        createCell(leftRecord ? quyenSo : "", 10, false, AlignmentType.CENTER),
                        createCell(leftRecord ? leftPageNum.toString() : "", 10, false, AlignmentType.CENTER),
                        
                        createCell(rightRecord ? (rightIndex + 1).toString() : "", 5, false, AlignmentType.CENTER),
                        createCell(formatNameForTOC(rightRecord?.data?.ten_chu_su_dung || rightRecord?.noi_nhan_gui || ""), 25, false, AlignmentType.LEFT),
                        createCell(rightRecord ? quyenSo : "", 10, false, AlignmentType.CENTER),
                        createCell(rightRecord ? rightPageNum.toString() : "", 10, false, AlignmentType.CENTER),
                    ],
                    height: { value: 400, rule: "atLeast" }
                })
            );
        }

        tocSections.push({
            properties: {
                page: {
                    size: {
                        width: 16838, // A3 width in twips (297mm)
                        height: 23811, // A3 height in twips (420mm)
                        orientation: "portrait",
                    },
                    margin: {
                        top: 567, // 1cm
                        bottom: 567, // 1cm
                        left: 1701, // 3cm
                        right: 1134, // 2cm
                    },
                },
            },
            children: [
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MỤC LỤC NGƯỜI SỬ DỤNG ĐẤT", bold: true, size: 28, font: "Arial" })] })],
                                    borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
                                }),
                                new TableCell({
                                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Chuyển tiếp trang số: ....................`, size: 22, font: "Arial", italics: true })] })],
                                    borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
                                }),
                            ]
                        })
                    ]
                }),
                new Paragraph({ text: "", spacing: { after: 200 } }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: tocTableRows
                })
            ]
        });
    }

    if (exportTocOnly) {
        return await Packer.toBlob(new Document({ sections: tocSections as any }));
    }

    const sections = records.map((record, index) => {
        const data = record.data || {};
        const ngayVaoSo = formatDate(data.ngay_nhan);
        const soPhatHanh = data.so_phat_hanh || "";
        const soVaoSo = data.so_vao_so || "";
        
        // Determine land use purpose and generate data rows
        const tongDienTich = parseFloat(data.tong_dien_tich?.toString().replace(',', '.') || "0");
        const dienTichThoCu = parseFloat(data.dien_tich_tho_cu?.toString().replace(',', '.') || "0");
        const dienTichCLN = tongDienTich - dienTichThoCu;

        const hasODT = dienTichThoCu > 0;
        const hasCLN = dienTichCLN > 0;
        const isMultiple = hasODT && hasCLN;

        let mucDichSuDung = "";
        let thoiHanSuDung = "";
        
        if (isMultiple) {
            mucDichSuDung = "";
            thoiHanSuDung = "";
        } else if (hasODT) {
            mucDichSuDung = "ODT";
            thoiHanSuDung = "Lâu dài";
        } else {
            mucDichSuDung = "CLN";
            thoiHanSuDung = ""; // CLN không phải đất ở nên để trống
        }

        const dataRows = [];
        
        // Hàng 1: Tổng diện tích
        dataRows.push(
            new TableRow({
                children: [
                    createCell(ngayVaoSo, 10),
                    createCell(data.so_thua || "", 8),
                    createCell(data.so_to || "", 8),
                    createCell(data.tong_dien_tich ? formatArea(tongDienTich) : "", 8),
                    createCell("", 8), // Chung
                    createCell(mucDichSuDung, 10),
                    createCell(thoiHanSuDung, 10),
                    createCell("", 12), // Nguồn gốc
                    createCell(soPhatHanh, 13),
                    createCell(soVaoSo, 13),
                ],
                height: { value: 375, rule: "exact" } // 30px
            })
        );

        // Chỉ thêm hàng 2 và 3 nếu có TỪ 2 LOẠI ĐẤT TRỞ LÊN
        if (isMultiple) {
            // Hàng 2: ODT
            dataRows.push(
                new TableRow({
                    children: [
                        createCell("", 10),
                        createCell("", 8),
                        createCell("", 8),
                        createCell(formatArea(dienTichThoCu), 8),
                        createCell("", 8),
                        createCell("ODT", 10),
                        createCell("Lâu dài", 10),
                        createCell("", 12),
                        createCell("", 13),
                        createCell("", 13),
                    ],
                    height: { value: 375, rule: "exact" }
                })
            );

            // Hàng 3: CLN
            dataRows.push(
                new TableRow({
                    children: [
                        createCell("", 10),
                        createCell("", 8),
                        createCell("", 8),
                        createCell(formatArea(dienTichCLN), 8),
                        createCell("", 8),
                        createCell("CLN", 10),
                        createCell("", 10), // CLN không ghi thời hạn
                        createCell("", 12),
                        createCell("", 13),
                        createCell("", 13),
                    ],
                    height: { value: 375, rule: "exact" }
                })
            );
        }

        const emptyRowsCount = 16 - dataRows.length; // 1 numbers + 16 data/empty = 17 total
        const emptyRows = Array(Math.max(0, emptyRowsCount)).fill(0).map(() => new TableRow({
            children: Array(10).fill(0).map((_, i) => createCell("", i === 3 || i === 4 ? 8 : (i === 0 ? 10 : (i === 1 || i === 2 ? 8 : (i === 5 || i === 6 ? 10 : (i === 7 ? 12 : 13)))))),
            height: { value: 375, rule: "exact" } // 30px
        }));

        return {
            properties: {
                page: {
                    size: {
                        width: 16838, // A3 width in twips (297mm)
                        height: 23811, // A3 height in twips (420mm)
                        orientation: "portrait",
                    },
                    margin: {
                        top: 567, // 1cm
                        bottom: 567, // 1cm
                        left: 1701, // 3cm
                        right: 1134, // 2cm
                    },
                },
            },
            children: [
                // Header: Page number placeholder
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: `(Tiếp theo trang số: ${index > 0 ? index : "............"})`, size: 22, font: "Arial" })] })],
                                    borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
                                }),
                                new TableCell({
                                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Trang số: ${index + 1}`, size: 22, font: "Arial" })] })],
                                    borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
                                }),
                            ]
                        })
                    ]
                }),
                new Paragraph({ text: "", spacing: { after: 200 } }),

                // Combined Table for all parts
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        // I - NGƯỜI SỬ DỤNG ĐẤT
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "I - NGƯỜI SỬ DỤNG ĐẤT", bold: true, size: 22, font: "Arial" })] })],
                                    columnSpan: 10,
                                    verticalAlign: VerticalAlign.CENTER,
                                }),
                            ],
                            height: { value: 585, rule: "atLeast" }
                        }),
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: (data.ten_chu_su_dung || record.noi_nhan_gui || "").split('\n\n').map((ownerBlock: string) => {
                                        const lines = ownerBlock.split('\n');
                                        let name = lines[0] || '';
                                        let cccd = '';
                                        let address = '';
                                        
                                        // Handle old format where CCCD is on the same line
                                        const cccdMatch = name.match(/^(.*?)\s+(CCCD:\s*.*)$/);
                                        if (cccdMatch) {
                                            name = cccdMatch[1];
                                            cccd = cccdMatch[2];
                                        }
                                        
                                        for (let i = 1; i < lines.length; i++) {
                                            if (lines[i].startsWith('CCCD: ')) {
                                                cccd = lines[i];
                                            } else if (lines[i].startsWith('Địa chỉ: ')) {
                                                address = lines[i];
                                            }
                                        }
                                        
                                        const parts = [];
                                        parts.push(new TextRun({ text: name, bold: true, size: 22, font: "Arial" }));
                                        
                                        if (cccd) {
                                            parts.push(new TextRun({ text: `; ${cccd}`, bold: false, size: 22, font: "Arial" }));
                                        }
                                        
                                        if (address) {
                                            parts.push(new TextRun({ text: `; ${address}`, bold: false, size: 22, font: "Arial" }));
                                        }
                                        
                                        return new Paragraph({
                                            children: parts,
                                            spacing: { after: 100 }
                                        });
                                    }),
                                    columnSpan: 10,
                                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                }),
                            ],
                            height: { value: 860, rule: "atLeast" }, // Min height for user info
                        }),

                        // II - THỬA ĐẤT Header
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "II - THỬA ĐẤT", bold: true, size: 22, font: "Arial" })] })],
                                    columnSpan: 10,
                                    verticalAlign: VerticalAlign.CENTER,
                                }),
                            ],
                            height: { value: 585, rule: "atLeast" }
                        }),
                        // Header Row 1
                        new TableRow({
                            children: [
                                createCell("Ngày\ntháng năm\nvào sổ", 10, false, AlignmentType.CENTER, 1, 2),
                                createCell("Số thứ tự\nthửa đất", 8, false, AlignmentType.CENTER, 1, 2),
                                createCell("Số thứ\ntự tờ\nbản đồ", 8, false, AlignmentType.CENTER, 1, 2),
                                new TableCell({
                                    width: { size: 20, type: WidthType.PERCENTAGE },
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Diện tích sử dụng (m2)", bold: false, size: 22, font: "Arial" })] })],
                                    columnSpan: 2,
                                    verticalAlign: VerticalAlign.CENTER,
                                }),
                                createCell("Mục đích\nsử dụng", 10, false, AlignmentType.CENTER, 1, 2),
                                createCell("Thời hạn\nsử dụng", 10, false, AlignmentType.CENTER, 1, 2),
                                createCell("Nguồn gốc\nsử dụng", 12, false, AlignmentType.CENTER, 1, 2),
                                createCell("Số phát hành\nGCNQSDĐ", 13, false, AlignmentType.CENTER, 1, 2),
                                createCell("Số vào sổ cấp\nGCNQSDĐ", 13, false, AlignmentType.CENTER, 1, 2),
                            ],
                        }),
                        // Header Row 2 (Sub-headers for Area)
                        new TableRow({
                            children: [
                                createCell("Riêng", 8),
                                createCell("Chung", 8),
                            ],
                        }),
                        // Header Row 3 (Numbers)
                        new TableRow({
                            children: [
                                createCell("1", 10),
                                createCell("2", 8),
                                createCell("3", 8),
                                createCell("4", 8),
                                createCell("5", 8),
                                createCell("6", 10),
                                createCell("7", 10),
                                createCell("8", 12),
                                createCell("9", 13),
                                createCell("10", 13),
                            ],
                            height: { value: 375, rule: "exact" } // 30px
                        }),
                        // Data Rows
                        ...dataRows,
                        // Empty rows to fill space
                        ...emptyRows,

                        // III - NHỮNG THAY ĐỔI
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "III - NHỮNG THAY ĐỔI TRONG QUÁ TRÌNH SỬ DỤNG ĐẤT VÀ GHI CHÚ", bold: true, size: 22, font: "Arial" })] })],
                                    columnSpan: 10,
                                    verticalAlign: VerticalAlign.CENTER,
                                }),
                            ],
                            height: { value: 585, rule: "atLeast" }
                        }),
                        // Header
                        new TableRow({
                            children: [
                                createCell("Số thứ tự thửa đất", 10, false, AlignmentType.CENTER, 1),
                                createCell("Ngày tháng năm", 16, false, AlignmentType.CENTER, 2),
                                createCell("Nội dung ghi chú hoặc biến động và căn cứ pháp lý", 74, false, AlignmentType.CENTER, 7),
                            ],
                        }),
                        // Data Row
                        new TableRow({
                            children: [
                                createCell(data.so_thua || "", 10, false, AlignmentType.CENTER, 1),
                                createCell(ngayVaoSo, 16, false, AlignmentType.CENTER, 2),
                                new TableCell({
                                    width: { size: 74, type: WidthType.PERCENTAGE },
                                    columnSpan: 7,
                                    verticalAlign: VerticalAlign.CENTER,
                                    children: [
                                        new Paragraph({
                                            children: [new TextRun({ text: `Nhận ${data.loai_ho_so || "chuyển nhượng"}`, size: 22, font: "Arial" })],
                                            alignment: AlignmentType.LEFT,
                                        }),
                                    ],
                                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                }),
                            ],
                            height: { value: 375, rule: "exact" } // 25px
                        }),
                        // Empty rows to fill space (20 rows to make it 21 total)
                        ...Array(17).fill(0).map(() => new TableRow({
                            children: [
                                createCell("", 10, false, AlignmentType.CENTER, 1),
                                createCell("", 16, false, AlignmentType.CENTER, 2),
                                createCell("", 74, false, AlignmentType.CENTER, 7),
                            ],
                            height: { value: 375, rule: "exact" } // 25px
                        }))
                    ],
                }),
                
                // Footer
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 300 },
                    children: [
                        new TextRun({ text: `Chuyển tiếp trang số: ${index < records.length - 1 ? index + 2 : "............"}`, size: 22, font: "Arial" }),
                    ],
                }),
            ],
        };
    });

    // Create the document
    const doc = new Document({
        sections: [...tocSections, ...sections] as any,
    });

    return await Packer.toBlob(doc);
};

export const exportSoDiaChinh = async (records: ArchiveRecord[], quyenSo: string = "", exportTocOnly: boolean = false) => {
    if (!records || records.length === 0) return;
    const blob = await generateSoDiaChinhBlob(records, quyenSo, exportTocOnly);
    const fileName = records.length === 1 
        ? `SoDiaChinh_${records[0].data?.so_vao_so || "new"}.docx`
        : `SoDiaChinh_Multiple_${records.length}_records.docx`;
    saveAs(blob, fileName);
};
