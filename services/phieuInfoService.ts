
import PizZip from 'pizzip';

// --- TYPES ---
export interface PhieuInfoData {
    Ten_Nguoi_Yeu_Cau: string;
    // UQ (Cũ - giữ lại để tương thích ngược nếu cần, nhưng sẽ ưu tiên các trường chi tiết)
    UQ: string; 
    
    // UQ Chi tiết (Mới)
    UQ_Loai: string; // 'Giấy ủy quyền' | 'Hợp đồng ủy quyền' | ''
    UQ_So: string;
    UQ_Ngay: string;
    UQ_VPCC: string;

    Dia_Chi: string;
    Ngay_Nop: string;
    Ten_CSD: string;
    Dia_Chi_Thua_Dat: string;
    Phuong: string;
    Thua_Cu: string;
    To_Cu: string;
    
    // Diện tích cũ chi tiết
    DT_Cu: string; // Tổng diện tích
    DT_ODT: string; // Đất ở
    DT_CLN: string; // Đất NN
    
    To_2024: string;
    Thua_2024: string;
    DT_Moi: string;
    To_106: string;
    
    TBTH: string;
    QDTH: string;
    
    // Các trường dynamic sẽ được truy cập qua index signature hoặc (data as any)
    // Giữ lại các field cũ để tương thích type check tĩnh nếu cần, nhưng logic sẽ dùng dynamic
    QH_Value?: string;
    KH_Value?: string;
    QHC_Value?: string;
    QHC_DC_Value?: string;
    QHC_DC_Moi_Value?: string;
    QHPK_Value?: string;

    // Người cung cấp
    Nguoi_1: string;
    CV_1: string;
    Nguoi_2: string; // User đăng nhập
}

export interface PlanningConfig {
    key: string; // Mã định danh (VD: QH, KH, QHC...)
    Label: string; // Tên hiển thị ngắn gọn (VD: Quy hoạch sử dụng đất)
    TenDoAn: string;
    SoQuyetDinh: string;
    NgayQuyetDinh: string;
    CoQuanBanHanh: string;
}

// --- PRESETS (Mặc định ban đầu) ---
export const PLANNING_PRESETS: PlanningConfig[] = [
    {
        key: 'QH',
        Label: 'QH Sử dụng đất',
        TenDoAn: "Bản đồ Điều chỉnh Quy hoạch sử dụng đất huyện Hớn Quản đến năm 2030",
        SoQuyetDinh: "1238/QĐ-UBND",
        NgayQuyetDinh: "17/6/2025",
        CoQuanBanHanh: "UBND tỉnh Bình Phước"
    },
    {
        key: 'KH',
        Label: 'KH Sử dụng đất',
        TenDoAn: "Bản đồ điều chỉnh Kế hoạch sử dụng đất năm 2025",
        SoQuyetDinh: "1448/QĐ-UBND",
        NgayQuyetDinh: "27/06/2025",
        CoQuanBanHanh: "UBND tỉnh Bình Phước"
    },
    {
        key: 'QHC',
        Label: 'QH Chung (Cũ)',
        TenDoAn: "Bản đồ Quy hoạch chung đô thị Tân Khai",
        SoQuyetDinh: "2892/QĐ-UBND",
        NgayQuyetDinh: "31/12/2019",
        CoQuanBanHanh: "UBND tỉnh Bình Phước"
    },
    {
        key: 'QHC_DC',
        Label: 'QH Chung (ĐC Cục bộ)',
        TenDoAn: "Bản đồ điều chỉnh cục bộ quy hoạch chung đô thị Tân Khai",
        SoQuyetDinh: "424/QĐ-UBND",
        NgayQuyetDinh: "26/02/2025",
        CoQuanBanHanh: "UBND tỉnh Bình Phước"
    },
    {
        key: 'QHC_DC_Moi',
        Label: 'QH Chung 2040',
        TenDoAn: "Bản đồ điều chỉnh cục bộ quy hoạch chung đô thị Tân Khai đến năm 2040",
        SoQuyetDinh: "1574/QĐ-UBND",
        NgayQuyetDinh: "29/06/2025",
        CoQuanBanHanh: "UBND tỉnh Bình Phước"
    },
    {
        key: 'QHPK',
        Label: 'QH Phân khu',
        TenDoAn: "Bản đồ Quy hoạch phân khu tỷ lệ 1/2000 khu đô thị Minh Long",
        SoQuyetDinh: "2101/QĐ-UBND",
        NgayQuyetDinh: "18/09/2024",
        CoQuanBanHanh: "UBND huyện Hớn Quản"
    }
];

// --- HELPER FUNCTIONS ---

export const parseNumber = (val: string): number => {
    if (!val) return 0;
    let clean = val.trim();
    if (clean.includes(',') && clean.includes('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
    }
    return parseFloat(clean) || 0;
};

export const formatAreaLabel = (val: string) => {
    const num = parseNumber(val);
    return num.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' m²';
};

export const formatDateVN = (dateStr: string): string => {
    if (!dateStr) return '...';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '...';
    return `ngày ${d.getDate().toString().padStart(2, '0')} tháng ${(d.getMonth() + 1).toString().padStart(2, '0')} năm ${d.getFullYear()}`;
};

export const formatDateShort = (dateStr: string): string => {
    if (!dateStr) return '...';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '...';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
};

// --- LOGIC GENERATOR ---

export const generatePreviewData = (data: PhieuInfoData, planningConfigs: PlanningConfig[]) => {
    
    // 1. Xử lý Ủy quyền (Logic mới)
    let uqFullText = "";
    if (data.UQ_Loai) {
        const dateFmt = formatDateShort(data.UQ_Ngay);
        const tenCSD = data.Ten_CSD ? data.Ten_CSD.toUpperCase() : "...";
        uqFullText = `(người được ủy quyền của ông (bà) ${tenCSD} theo ${data.UQ_Loai} số ${data.UQ_So} ngày ${dateFmt} tại ${data.UQ_VPCC})`;
    } else if (data.UQ) {
        uqFullText = `- ${data.UQ}`;
    }

    // 2. Chênh lệch diện tích
    const dtCu = parseNumber(data.DT_Cu);
    const dtMoi = parseNumber(data.DT_Moi);
    const diff = dtMoi - dtCu;
    const absDiff = Math.abs(diff);
    
    const formatNum = (n: number) => n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    
    let chenhLechDT = "không thay đổi";
    if (diff > 0) chenhLechDT = `tăng ${formatNum(absDiff)} m²`;
    else if (diff < 0) chenhLechDT = `giảm ${formatNum(absDiff)} m²`;

    let chenhLechVanBan = "";
    if (diff !== 0 && dtCu > 0 && dtMoi > 0) {
        chenhLechVanBan = `- Diện tích thửa đất ${chenhLechDT} so với Giấy chứng nhận quyền sử dụng đất.`;
    }

    // 3. Điều chỉnh thửa đất
    let dieuChinhThuaDat = "";
    const dtMoiStr = isNaN(dtMoi) ? data.DT_Moi : `${formatNum(dtMoi)}m²`;

    if (data.To_106) {
        if (data.To_2024 && data.Thua_2024) {
            dieuChinhThuaDat = `đã được điều chỉnh thành thửa đất số ${data.Thua_2024}, tờ bản đồ số ${data.To_2024} theo bản đồ địa chính năm 2024, và chuyển đổi thành tờ bản đồ số ${data.To_106} theo Công văn số 106/VPĐK-KTĐC ngày 08/07/2025 của Văn phòng Đăng ký đất đai tỉnh Bình Phước, diện tích mới là ${dtMoiStr}.`;
        } else {
            dieuChinhThuaDat = `được chuyển đổi thành tờ bản đồ số ${data.To_106} theo Công văn số 106/VPĐK-KTĐC ngày 08/07/2025 của Văn phòng Đăng ký đất đai tỉnh Bình Phước, diện tích mới là ${dtMoiStr}.`;
        }
    } else if (data.To_2024) {
        dieuChinhThuaDat = `đã được điều chỉnh thành thửa đất số ${data.Thua_2024 || '...'}, tờ bản đồ số ${data.To_2024} theo bản đồ địa chính năm 2024, diện tích mới là ${dtMoiStr}.`;
    }

    // 4. Quy hoạch (DYNAMIC LOOP)
    const quyHoachLines: string[] = [];
    
    // Duyệt qua danh sách cấu hình để lấy dữ liệu
    planningConfigs.forEach(cfg => {
        // Truy cập giá trị động: data['QH_Value'], data['KH_Value']...
        const value = (data as any)[`${cfg.key}_Value`];
        
        if (value && value.trim()) {
            quyHoachLines.push(`- Căn cứ ${cfg.TenDoAn} được phê duyệt tại Quyết định số ${cfg.SoQuyetDinh} ngày ${cfg.NgayQuyetDinh} của ${cfg.CoQuanBanHanh}, thửa đất thuộc quy hoạch ${value}.`);
        }
    });

    const quyHoachVanBan = quyHoachLines.join('\n');

    // 5. Chữ ký & Chức vụ Giám đốc
    let chuKyGiamDoc = "";
    const pLower = (data.Phuong || "").toLowerCase();
    
    if (pLower.includes("nha bích")) {
        chuKyGiamDoc = "GIÁM ĐỐC";
    } else {
        chuKyGiamDoc = "KT.GIÁM ĐỐC\nPHÓ GIÁM ĐỐC";
    }

    // 6. Loại đất
    const dtOdtNum = parseNumber(data.DT_ODT);
    let loaiDatFmt = "";
    
    if (dtOdtNum > 0) {
        let odtType = (pLower.includes("minh hưng") || pLower.includes("chơn thành")) ? "Đất ở tại đô thị" : "Đất ở tại nông thôn";
        loaiDatFmt = `(trong đó: ${odtType}: ${formatAreaLabel(data.DT_ODT)}; Đất nông nghiệp: ${formatAreaLabel(data.DT_CLN)})`;
    } else {
        loaiDatFmt = `(trong đó: Đất nông nghiệp: ${formatAreaLabel(data.DT_CLN)})`;
    }

    const tbthVanBan = data.TBTH ? `Thửa đất đã có thông báo thu hồi đất số ${data.TBTH}.` : "";
    const qdthVanBan = data.QDTH ? `Thửa đất đã có quyết định thu hồi đất số ${data.QDTH}.` : "";

    return {
        ...data,
        UQ_FULL_TEXT: uqFullText, // Sử dụng trường này cho Word/Preview
        CHENHLECH_DT: chenhLechDT,
        CHENH_LECH_VANBAN: chenhLechVanBan,
        DIEU_CHINH_THUA_DAT: dieuChinhThuaDat,
        QUY_HOACH_VANBAN: quyHoachVanBan,
        CHUC_VU_GIAM_DOC: chuKyGiamDoc,
        Loai_Dat_Fmt: loaiDatFmt,
        TBTH_VANBAN: tbthVanBan,
        QDTH_VANBAN: qdthVanBan,
        Ngay_Nop_Fmt: formatDateVN(data.Ngay_Nop)
    };
};
