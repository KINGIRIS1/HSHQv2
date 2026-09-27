import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, VerticalAlign, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { ArchiveRecord } from "../services/apiArchive";

export const exportSoMucKe = async (records: ArchiveRecord[], wardName: string, fromDate: string, toDate: string) => {
    if (!records || records.length === 0) return;

    // Helper to create a cell
    const createCell = (text: string, width: number, bold = false, align: any = AlignmentType.CENTER, colSpan = 1, rowSpan = 1) => {
        const lines = text.split('\n');
        return new TableCell({
            width: { size: width, type: WidthType.PERCENTAGE },
            columnSpan: colSpan,
            rowSpan: rowSpan,
            verticalAlign: VerticalAlign.CENTER,
            children: lines.map(line => new Paragraph({
                alignment: align,
                children: [new TextRun({ text: line, bold, size: 22, font: "Times New Roman" })], // Size 22 = 11pt
            })),
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
        });
    };

    // Group records by so_to
    const recordsByTo: Record<string, ArchiveRecord[]> = {};
    records.forEach(record => {
        const soTo = record.data?.so_to || "KhongXacDinh";
        if (!recordsByTo[soTo]) {
            recordsByTo[soTo] = [];
        }
        recordsByTo[soTo].push(record);
    });

    const zip = new JSZip();

    for (const soTo of Object.keys(recordsByTo)) {
        // Sort by so_thua numerically
        const toRecords = recordsByTo[soTo].sort((a, b) => {
            const thuaA = parseInt(a.data?.so_thua || "0") || 0;
            const thuaB = parseInt(b.data?.so_thua || "0") || 0;
            return thuaA - thuaB;
        });

        const dataRows = toRecords.map(record => {
            const data = record.data || {};
            const soThua = data.so_thua || "";
            const formatNameForSMK = (nameStr: string) => {
                if (!nameStr) return "";
                return nameStr.split('\n').map(line => line.replace(/\s+CCCD:.*$/, '')).join(', ');
            };
            const tenChuSuDung = formatNameForSMK(data.ten_chu_su_dung || "");
            const maDoiTuong = "GDC"; // Default as per image

            const tongDienTich = parseFloat(data.tong_dien_tich || "0");
            const dienTichThoCu = parseFloat(data.dien_tich_tho_cu || "0");
            const dienTichCLN = tongDienTich - dienTichThoCu;

            let loaiDat = data.loai_dat || "";
            if (!loaiDat) {
                if (dienTichThoCu > 0 && dienTichCLN > 0) {
                    loaiDat = "ODT+CLN";
                } else if (dienTichThoCu > 0) {
                    loaiDat = "ODT";
                } else {
                    loaiDat = "CLN";
                }
            }

            const loaiBienDong = data.loai_bien_dong ? data.loai_bien_dong.toLowerCase() : "chuyển nhượng";
            const ghiChu = `Thửa đất số ${soThua} Nhận ${loaiBienDong} quyền sử dụng đất`;

            return new TableRow({
                children: [
                    createCell(soTo, 5),
                    createCell(soThua, 5),
                    createCell(tenChuSuDung, 20, false, AlignmentType.LEFT),
                    createCell(maDoiTuong, 10),
                    createCell("", 10), // Hiện trạng - Diện tích
                    createCell("", 10), // Hiện trạng - Loại đất
                    createCell(tongDienTich > 0 ? tongDienTich.toString() : "", 10), // Pháp lý - Diện tích
                    createCell(loaiDat, 10), // Pháp lý - Loại đất
                    createCell(ghiChu, 20, false, AlignmentType.LEFT),
                ],
                height: { value: 600, rule: "atLeast" }
            });
        });

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        size: {
                            width: 23811, // A3 width in twips (420mm)
                            height: 16838, // A3 height in twips (297mm)
                            orientation: "landscape",
                        },
                        margin: {
                            top: 1134, // 2cm
                            bottom: 1134, // 2cm
                            left: 1134, // 2cm
                            right: 1134, // 2cm
                        },
                    },
                },
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({ text: "(Mẫu các trang nội dung sổ mục kê đất đai)", size: 24, font: "Times New Roman", bold: true }),
                        ],
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                            new TextRun({ text: "Trang số......", size: 24, font: "Times New Roman", bold: true }),
                        ],
                        spacing: { after: 200 }
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            // Header Row 1
                            new TableRow({
                                children: [
                                    createCell("Tờ\nbản\nđồ số", 5, true, AlignmentType.CENTER, 1, 2),
                                    createCell("Thửa\nđất số", 5, true, AlignmentType.CENTER, 1, 2),
                                    createCell("Tên người sử\ndụng, quản lý\nđất", 20, true, AlignmentType.CENTER, 1, 2),
                                    createCell("Mã đối\ntượng\nsử dụng,\nquản lý\nđất", 10, true, AlignmentType.CENTER, 1, 2),
                                    createCell("Hiện trạng sử\ndụng đất", 20, true, AlignmentType.CENTER, 2, 1),
                                    createCell("Giấy tờ pháp lý\nvề QSDĐ", 20, true, AlignmentType.CENTER, 2, 1),
                                    createCell("Ghi chú", 20, true, AlignmentType.CENTER, 1, 2),
                                ],
                            }),
                            // Header Row 2
                            new TableRow({
                                children: [
                                    createCell("Diện\ntích\n(m2)", 10, true),
                                    createCell("Loại\nđất", 10, true),
                                    createCell("Diện\ntích\n(m2)", 10, true),
                                    createCell("Loại\nđất", 10, true),
                                ],
                            }),
                            // Header Row 3 (Numbers)
                            new TableRow({
                                children: [
                                    createCell("(1)", 5),
                                    createCell("(2)", 5),
                                    createCell("(3)", 20),
                                    createCell("(4)", 10),
                                    createCell("(5)", 10),
                                    createCell("(6)", 10),
                                    createCell("(7)", 10),
                                    createCell("(8)", 10),
                                    createCell("(9)", 20),
                                ],
                            }),
                            // Data Rows
                            ...dataRows
                        ],
                    }),
                ],
            }]
        });

        const blob = await Packer.toBlob(doc);
        zip.file(`SoMucKe_To_${soTo}.docx`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const safeWardName = wardName ? wardName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'all';
    saveAs(zipBlob, `SoMucKe_${safeWardName}_${fromDate}_to_${toDate}.zip`);
};
