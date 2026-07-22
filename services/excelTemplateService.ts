
import * as XLSX from 'xlsx-js-style';

export const EXCEL_STORAGE_KEYS = {
    DAILY_LIST_TEMPLATE: 'excel_template_daily_list',
    DAILY_LIST_START_ROW: 'excel_template_daily_list_start_row' // Lưu chỉ số dòng bắt đầu
};

// Lưu file template vào LocalStorage (dưới dạng Base64)
export const saveExcelTemplate = async (key: string, file: File, startRow: number) => {
    try {
        const reader = new FileReader();
        return new Promise<boolean>((resolve) => {
            reader.onload = (e) => {
                const base64 = e.target?.result as string;
                // Kiểm tra dung lượng (khoảng 3MB giới hạn an toàn của LocalStorage)
                if (base64.length > 3 * 1024 * 1024) {
                    alert("File mẫu quá lớn (>2MB). Vui lòng xóa bớt ảnh hoặc định dạng thừa.");
                    resolve(false);
                    return;
                }
                localStorage.setItem(key, base64);
                localStorage.setItem(key + '_start_row', startRow.toString());
                resolve(true);
            };
            reader.readAsDataURL(file);
        });
    } catch (error) {
        console.error("Lỗi lưu Excel template:", error);
        return false;
    }
};

export const hasExcelTemplate = (key: string): boolean => {
    return !!localStorage.getItem(key);
};

export const removeExcelTemplate = (key: string) => {
    localStorage.removeItem(key);
    localStorage.removeItem(key + '_start_row');
};

// Hàm chính: Điền dữ liệu vào Template
export const generateExcelFromTemplate = (templateKey: string, dataRows: any[][], fileName: string, footerData?: any[][]) => {
    try {
        const base64 = localStorage.getItem(templateKey);
        const startRowStr = localStorage.getItem(templateKey + '_start_row');
        
        if (!base64 || !startRowStr) {
            throw new Error("Không tìm thấy file mẫu hoặc cấu hình bị lỗi.");
        }

        const startRow = parseInt(startRowStr, 10) - 1; // Excel tính từ 1, Code tính từ 0
        if (isNaN(startRow) || startRow < 0) throw new Error("Dòng bắt đầu không hợp lệ.");

        // 1. Đọc file mẫu
        // Chuyển Base64 -> ArrayBuffer
        const binaryString = window.atob(base64.split(',')[1]);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        
        const wb = XLSX.read(bytes.buffer, { type: 'array', cellStyles: true });
        const ws = wb.Sheets[wb.SheetNames[0]]; // Lấy sheet đầu tiên

        // 2. Điền dữ liệu danh sách (Ghi đè từ dòng startRow)
        // origin: -1 nghĩa là append, nhưng ở đây ta muốn insert vào vị trí cụ thể
        XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: { r: startRow, c: 0 } });

        // 3. Xử lý Style cho các dòng dữ liệu mới thêm vào
        // Mặc định sheet_add_aoa không copy style dòng trên xuống.
        // Ta sẽ định dạng cơ bản: Border + Font Times New Roman
        const range = XLSX.utils.decode_range(ws['!ref'] || "A1:G100");
        // Cập nhật lại range của sheet vì dữ liệu mới có thể dài hơn
        const lastDataRow = startRow + dataRows.length;
        
        const borderStyle = {
            top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }
        };
        const dataStyle = {
            font: { name: "Times New Roman", sz: 11 },
            border: borderStyle,
            alignment: { vertical: "center", wrapText: true }
        };
        const centerStyle = { ...dataStyle, alignment: { ...dataStyle.alignment, horizontal: "center" } };

        // Duyệt qua các ô vừa thêm để gán style
        for (let r = startRow; r < lastDataRow; r++) {
            for (let c = 0; c < 7; c++) { // Giả sử bảng có 7 cột (A->G)
                const cellRef = XLSX.utils.encode_cell({ r, c });
                if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
                
                // Căn giữa cho STT(0), Hẹn trả(5)
                if (c === 0 || c === 5) ws[cellRef].s = centerStyle;
                else ws[cellRef].s = dataStyle;
            }
        }

        // 4. Thêm Footer (Chữ ký) ngay sau dòng dữ liệu cuối cùng
        if (footerData) {
            const footerStartRow = lastDataRow + 2; // Cách 2 dòng
            XLSX.utils.sheet_add_aoa(ws, footerData, { origin: { r: footerStartRow, c: 0 } });
            
            // Style cho Footer
            const footerTitleStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } };
            const footerNoteStyle = { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center" } };

            // Merge cells cho footer (chia đôi trang giấy)
            if(!ws['!merges']) ws['!merges'] = [];
            ws['!merges'].push(
                { s: { r: footerStartRow, c: 0 }, e: { r: footerStartRow, c: 2 } }, // Bên trái (A-C)
                { s: { r: footerStartRow + 1, c: 0 }, e: { r: footerStartRow + 1, c: 2 } },
                { s: { r: footerStartRow, c: 4 }, e: { r: footerStartRow, c: 6 } }, // Bên phải (E-G)
                { s: { r: footerStartRow + 1, c: 4 }, e: { r: footerStartRow + 1, c: 6 } }
            );

            // Gán style footer
            const leftTitle = XLSX.utils.encode_cell({r: footerStartRow, c: 0});
            const leftNote = XLSX.utils.encode_cell({r: footerStartRow + 1, c: 0});
            const rightTitle = XLSX.utils.encode_cell({r: footerStartRow, c: 4});
            const rightNote = XLSX.utils.encode_cell({r: footerStartRow + 1, c: 4});

            if(ws[leftTitle]) ws[leftTitle].s = footerTitleStyle;
            if(ws[leftNote]) ws[leftNote].s = footerNoteStyle;
            if(ws[rightTitle]) ws[rightTitle].s = footerTitleStyle;
            if(ws[rightNote]) ws[rightNote].s = footerNoteStyle;
        }

        // 5. Xuất file
        XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
        return true;

    } catch (error: any) {
        console.error("Lỗi xuất Excel từ template:", error);
        alert(`Lỗi xuất file: ${error.message}`);
        return false;
    }
};
