
import React, { useState, useEffect } from 'react';
import { User as UserType, NotifyFunction } from '../../types';
import saveAs from 'file-saver';
import { Settings, List, PlusCircle, Save, Search, Loader2 } from 'lucide-react';
import VPHCForm from './vphc-tab/VPHCForm';
import VPHCPreview from './vphc-tab/VPHCPreview';
import VPHCList from './vphc-tab/VPHCList';
import TemplateConfigModal from '../TemplateConfigModal';
import { generateDocxBlobAsync, STORAGE_KEYS, hasTemplate } from '../../services/docxService';
import { VphcRecord, fetchVphcRecords, saveVphcRecord, deleteVphcRecord } from '../../services/apiUtilities';
import { fetchRecords } from '../../services/apiRecords';

interface VPHCTabProps {
    currentUser?: UserType;
    notify: NotifyFunction;
}

const VPHCTab: React.FC<VPHCTabProps> = ({ currentUser, notify }) => {
    // Mode: 'create' (Soạn thảo) hoặc 'list' (Danh sách)
    const [mode, setMode] = useState<'create' | 'list'>('create');
    
    // Data State
    const [savedRecords, setSavedRecords] = useState<VphcRecord[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null); // ID nếu đang sửa bản ghi cũ

    const [formData, setFormData] = useState({
        NGUOI: '', GIOITINH: 'Nam', NGAYSINH: '', NOIO: '', 
        CCCD: '', NGAYCAP: '', NOICAP: '',
        THUA: '', TO: '', DT: '', DC_THUA: '', XA_PHUONG: 'xã Tân Quan',
        SPH: '', SVS: '', NGAYCAPGCN: '', COQUANCAP: 'Sở Tài nguyên và Môi trường tỉnh Bình Phước',
        CHUSDGCN: '',
        LOAIHS: 'chuyển nhượng',
        SOCC: '', NGAYCC: '', VPCC: '',
        TGXRVV: '', // Thời gian xảy ra vụ việc
        STT: '' // Số thứ tự biên bản
    });

    const [templateType, setTemplateType] = useState<'mau01' | 'mau02'>('mau01');
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);

    const [searchCode, setSearchCode] = useState('');
    const [isLoadingInfo, setIsLoadingInfo] = useState(false);

    const handleLoadInfo = async () => {
        if (!searchCode.trim()) {
            notify("Vui lòng nhập số biên nhận", "info");
            return;
        }
        setIsLoadingInfo(true);
        try {
            const records = await fetchRecords();
            const record = records.find(r => r.code.toLowerCase() === searchCode.trim().toLowerCase());
            
            if (record) {
                setFormData(prev => ({
                    ...prev,
                    NGUOI: record.customerName || prev.NGUOI,
                    NOIO: record.customerAddress || prev.NOIO,
                    CCCD: record.cccd || prev.CCCD,
                    THUA: record.landPlot || prev.THUA,
                    TO: record.mapSheet || prev.TO,
                    DT: record.area ? record.area.toString() : prev.DT,
                    DC_THUA: record.address || prev.DC_THUA,
                    XA_PHUONG: record.ward || prev.XA_PHUONG,
                    SPH: record.issueNumber || prev.SPH,
                    SVS: record.entryNumber || prev.SVS,
                    NGAYCAPGCN: record.issueDate || prev.NGAYCAPGCN,
                }));
                notify("Đã tải thông tin thành công!", "success");
            } else {
                notify("Không tìm thấy hồ sơ với số biên nhận này", "error");
            }
        } catch (error) {
            console.error("Error loading info:", error);
            notify("Lỗi khi tải thông tin", "error");
        } finally {
            setIsLoadingInfo(false);
        }
    };

    // Initial Load
    useEffect(() => {
        loadRecords();
    }, []);

    // --- AUTO SAVE/LOAD CACHE ---
    useEffect(() => {
        if (mode === 'create' && !editingId) {
            const cachedForm = localStorage.getItem('CACHE_VPHC_FORM');
            if (cachedForm) {
                try {
                    setFormData(JSON.parse(cachedForm));
                } catch (e) { console.error(e); }
            }
        }
    }, [mode, editingId]);

    useEffect(() => {
        if (!editingId) {
            localStorage.setItem('CACHE_VPHC_FORM', JSON.stringify(formData));
        }
    }, [formData, editingId]);
    // ----------------------------

    const loadRecords = async () => {
        const data = await fetchVphcRecords();
        setSavedRecords(data);
    };

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (field === 'NGUOI' && !formData.CHUSDGCN) {
             setFormData(prev => ({ ...prev, CHUSDGCN: value.toUpperCase() }));
        }
        setExportedFilePath(null);
    };

    const handleSaveRecord = async (silent: boolean = false) => {
        if (!formData.NGUOI) {
            if (!silent) notify("Vui lòng nhập tên người vi phạm/liên quan.", 'error');
            return;
        }

        const recordToSave: Partial<VphcRecord> = {
            id: editingId || undefined, // Nếu có ID là update
            customer_name: formData.NGUOI,
            record_type: templateType,
            data: formData,
            created_by: currentUser?.name || 'Unknown'
        };

        const success = await saveVphcRecord(recordToSave);
        if (success) {
            await loadRecords();
            if (!silent) {
                notify(editingId ? "Đã cập nhật dữ liệu thành công!" : "Đã lưu biên bản mới vào danh sách!", 'success');
            }
        } else {
            if (!silent) notify("Lỗi khi lưu dữ liệu.", 'error');
        }
        return success;
    };

    const handleEditFromList = (item: VphcRecord) => {
        setEditingId(item.id);
        setFormData(item.data);
        setTemplateType(item.record_type);
        setMode('create');
    };

    const handlePrintFromList = (item: VphcRecord) => {
        setEditingId(item.id);
        setFormData(item.data);
        setTemplateType(item.record_type);
        setMode('create');
    };

    const handleDeleteRecord = async (id: string) => {
        const success = await deleteVphcRecord(id);
        if (success) {
            setSavedRecords(prev => prev.filter(r => r.id !== id));
            if (editingId === id) {
                setEditingId(null);
                handleResetForm();
            }
            notify("Đã xóa biên bản", 'success');
        }
    };

    const handleResetForm = () => {
        setEditingId(null);
        const resetData = {
            NGUOI: '', GIOITINH: 'Nam', NGAYSINH: '', NOIO: '', 
            CCCD: '', NGAYCAP: '', NOICAP: '',
            THUA: '', TO: '', DT: '', DC_THUA: '', XA_PHUONG: 'xã Tân Quan',
            SPH: '', SVS: '', NGAYCAPGCN: '', COQUANCAP: 'Sở Tài nguyên và Môi trường tỉnh Bình Phước',
            CHUSDGCN: '',
            LOAIHS: 'chuyển nhượng',
            SOCC: '', NGAYCC: '', VPCC: '',
            TGXRVV: '', STT: ''
        };
        setFormData(resetData);
        setExportedFilePath(null);
        localStorage.removeItem('CACHE_VPHC_FORM');
    };

    const renderPreviewHTML = () => {
        const data = { ...formData, NGUOI: formData.NGUOI.toUpperCase() };
        const creatorName = currentUser?.name || '...';
        
        const currentYear = new Date().getFullYear();
        
        // Logic xử lý tên địa danh cho Mẫu 01 (bỏ xã/phường)
        const placeName = data.XA_PHUONG 
            ? data.XA_PHUONG.replace(/^(xã|phường|thị trấn)\s+/i, '').trim() 
            : 'Tân Khai';

        // Kẻ ngang dưới tên cơ quan (bên trái)
        const lineLeftHtml = `
            <table style="width: 100px; margin: 0 auto; border-collapse: collapse; border: none;">
                <tr><td style="border-bottom: 1px solid black; height: 1px;"></td></tr>
            </table>
        `;

        // Kẻ ngang dưới tiêu ngữ (bên phải)
        const lineRightHtml = `
            <table style="width: 185px; margin: 0 auto; border-collapse: collapse; border: none;">
                <tr><td style="border-bottom: 1px solid black; height: 1px;"></td></tr>
            </table>
        `;

        if (templateType === 'mau01') {
            return `
            <div style="font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.3; color: black; text-align: justify; width: 100%;">
                
                <table style="width: 100%; text-align: center; font-weight: bold; border-collapse: collapse; margin-bottom: 0px; border: none;">
                    <tr style="vertical-align: top;">
                        <td style="width: 45%; padding: 0;">
                            <p style="margin: 0; font-size: 12pt;">VĂN PHÒNG ĐKĐĐ THÀNH PHỐ ĐỒNG NAI</p>
                            <p style="margin: 0; font-size: 13pt;">CHI NHÁNH HỚN QUẢN</p>
                            ${lineLeftHtml}
                            <p style="margin: 0; font-weight: normal; font-size: 13pt; margin-top: 5px;">Số: ${data.STT || '.....'} /BB-VPHV-HCTH</p>
                        </td>
                        <td style="width: 55%; padding: 0;">
                            <p style="margin: 0; font-size: 12pt;">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                            <p style="margin: 0; font-size: 13pt;">Độc lập - Tự do - Hạnh phúc</p>
                            ${lineRightHtml}
                            <p style="margin: 0; margin-top: 10px; font-weight: normal; font-style: italic;">${placeName}, ngày …. tháng …. năm ${currentYear}</p>
                        </td>
                    </tr>
                </table>
                
                <p style="margin: 0;">&nbsp;</p>

                <div style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 5px;">BIÊN BẢN VI PHẠM HÀNH CHÍNH*</div>
                <div style="text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 20px;">Về lĩnh vực đất đai(2)</div>

                <p style="margin-bottom: 10px;">Hôm nay, hồi …..giờ……phút, ngày .../.../${currentYear}, tại (3) Văn phòng Đăng ký đất đai thành phố Đồng Nai - Chi nhánh Hớn Quản.</p>
                <p style="text-align: justify; margin-bottom: 10px;">Lý do lập biên bản tại &lt;trụ sở cơ quan của người có thẩm quyền lập biên bản/địa điểm khác:&gt;(*) Hồ sơ vụ việc do Văn phòng Đăng ký đất đai thành phố Đồng Nai - Chi nhánh Hớn Quản phát hiện và chuyển đến Chủ tịch UBND ${data.XA_PHUONG} xử lý theo quy định.</p>
                <p style="text-align: justify; margin-bottom: 10px;">Căn cứ Biên bản làm việc số: ${data.STT || '...'} /BBLV ngày .../.../${currentYear} của Văn phòng Đăng ký đất đai thành phố Đồng Nai - Chi nhánh Hớn Quản tại Trung tâm hành chính công ${data.XA_PHUONG}, tỉnh Bình Phước.</p>

                <p><b>Chúng tôi gồm:</b></p>
                
                <p><b>1. Người có thẩm quyền lập biên bản:</b></p>
                <p style="margin-left: 20px;">Họ và tên: Cao Thị Dung. Chức vụ: Tổ trưởng Tổ Hành chính tổng hợp.</p>
                <p style="margin-left: 20px; margin-bottom: 10px;">Cơ quan: Văn phòng Đăng ký đất đai thành phố Đồng Nai - Chi nhánh Hớn Quản.</p>

                <p><b>2. Với sự chứng kiến của: (5)</b></p>
                <div style="margin-left: 20px; margin-bottom: 10px;">
                    <p>&lt;Họ và tên&gt;(*) ……………………… Nghề nghiệp: ……….……………</p>
                    <p>Địa chỉ: ……………………..…………………………..………………..</p>
                    <p>Hoặc &lt;Họ và tên&gt;(*) …………….…… Chức vụ: ……….…….…….…</p>
                    <p>Cơ quan: …………………………………………………..…….………</p>
                </div>

                <p><b>3. Người phiên dịch:</b></p>
                <div style="margin-left: 20px; margin-bottom: 10px;">
                    <p>&lt;Họ và tên&gt;(*) ………………… Nghề nghiệp: ………….……………</p>
                    <p>Địa chỉ: …………………………………………….…………………..</p>
                </div>

                <p><b>Tiến hành lập biên bản vi phạm hành chính đối với &lt;ông(bà)/tổ chức&gt; có tên sau đây:</b></p>
                <p style="margin-left: 20px;">&lt;1.Họ và tên&gt;(*) Ông/bà: <b>${data.NGUOI}</b> - Giới tính: ${data.GIOITINH}</p>
                <p style="margin-left: 20px;">Ngày, tháng, năm sinh: ${data.NGAYSINH} - Quốc tịch: Việt Nam</p>
                <p style="margin-left: 20px;">Nghề nghiệp: Lao động tự do</p>
                <p style="margin-left: 20px;">Nơi ở hiện tại: ${data.NOIO}</p>
                <p style="margin-left: 20px;">Số định danh cá nhân/CMND/Hộ chiếu: ${data.CCCD}; ngày cấp: ${data.NGAYCAP}; nơi cấp: ${data.NOICAP}</p>
                
                <div style="margin-left: 20px; margin-bottom: 10px; color: #666; font-size: 13pt;">
                    <p>&lt;1. Tên của tổ chức&gt; (*) : ………………………………………………..</p>
                    <p>Địa chỉ trụ sở chính: ……………………………………………………..</p>
                    <p>Mã số doanh nghiệp: …………………………………………………….</p>
                    <p>Số GCN đăng ký đầu tư/doanh nghiệp hoặc GP thành lập/đăng ký hoạt động: ………..; ngày cấp:..../..../……………….. ; nơi cấp: …………………</p>
                    <p>Người đại diện theo pháp luật: (6) …………….. Giới tính: ……………..</p>
                    <p>Chức danh: …………………………………………………..</p>
                    <p>Người đại diện theo ủy quyền: (7) …………….. Giới tính: ……………..</p>
                </div>

                <p><b>2. Đã có các hành vi vi phạm hành chính: (8)</b></p>
                <p style="margin-left: 20px; margin-bottom: 5px;">Không thực hiện đăng ký biến động đất đai theo quy định tại điểm a, khoản 1 Điều 133 luật đất đai.</p>
                <p style="margin-left: 20px; text-align: justify; margin-bottom: 10px;">
                    Cụ thể: Vào lúc…..giờ……phút, ngày .../.../${currentYear}, tại Trung Tâm phục vụ hành chính công ${data.XA_PHUONG}, nhân viên Văn phòng Đăng ký đất đai thành phố Đồng Nai – Chi nhánh Hớn Quản phát hiện đã quá 30 ngày kể từ ngày ký hợp đồng <b>${data.LOAIHS}</b> quyền sử dụng đất số: ${data.SOCC}, do Văn phòng Công chứng ${data.VPCC} lập ngày ${data.NGAYCC}. 
                    Ông/bà <b>${data.NGUOI}</b> không thực hiện đăng ký biến động đất đai theo quy định tại điểm a khoản 1 và khoản 3 Điều 133 Luật Đất đai năm 2024 đối với thửa đất số <b>${data.THUA}</b>, tờ bản đồ số <b>${data.TO}</b>, diện tích <b>${data.DT}m²</b> theo Giấy chứng nhận Quyền sử dụng đất số <b>${data.SPH}</b>, số vào sổ <b>${data.SVS}</b> do ${data.COQUANCAP} cấp ngày ${data.NGAYCAPGCN} cho <b>${data.CHUSDGCN}</b>. Thửa đất tọa lạc tại ${data.DC_THUA}, ${data.XA_PHUONG}.
                </p>

                <p><b>3. Quy định tại: (9)</b></p>
                <p style="margin-left: 20px; margin-bottom: 10px;">Khoản 2, Điều 16, Nghị định số 123/2024/NĐ-CP ngày 04/10/2024 của Chính phủ Quy định về xử phạt vi phạm hành chính trong lĩnh vực đất đai.</p>

                <p><b>4. &lt;Cá nhân/tổ chức&gt;(*) bị thiệt hại (nếu có): (10)</b> Không có.</p>
                
                <p><b>5. Ý kiến trình bày của &lt;cá nhân/người đại diện của tổ chức&gt;(*) vi phạm:</b> Thống nhất với nội dung ghi trong biên bản.</p>
                
                <p><b>6. Ý kiến trình bày của đại diện chính quyền, người chứng kiến (nếu có):</b> Không có.</p>
                
                <p><b>7. Ý kiến trình bày của &lt;cá nhân/tổ chức&gt;(*) bị thiệt hại (nếu có):</b> Không có.</p>
                
                <p><b>8. Chúng tôi đã yêu cầu &lt;cá nhân/tổ chức&gt;(*) vi phạm chấm dứt ngay hành vi vi phạm.</b></p>
                
                <p><b>9. Các biện pháp ngăn chặn và bảo đảm xử lý vi phạm hành chính được áp dụng (nếu có), gồm: (11)</b> Không có.</p>
                <p><i>&lt;Trường hợp thực hiện tạm giữ cùng thời điểm lập biên bản vi phạm hành chính thì không phải lập biên bản tạm giữ&gt;</i></p>
                <p>Tang vật, phương tiện vi phạm hành chính, giấy phép, chứng chỉ hành nghề bị tạm giữ, gồm:</p>
                
                <table style="width: 100%; border-collapse: collapse; text-align: center; margin-bottom: 10px; font-size: 13pt;">
                    <thead>
                        <tr>
                            <th style="border: 1px solid black; padding: 5px;">STT</th>
                            <th style="border: 1px solid black; padding: 5px;">Tên TVPTVPHC, GP, CCHN</th>
                            <th style="border: 1px solid black; padding: 5px;">ĐVT</th>
                            <th style="border: 1px solid black; padding: 5px;">Số lượng</th>
                            <th style="border: 1px solid black; padding: 5px;">Chủng loại</th>
                            <th style="border: 1px solid black; padding: 5px;">Tình trạng, đặc điểm</th>
                            <th style="border: 1px solid black; padding: 5px;">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td style="border: 1px solid black; height: 25px;"></td><td style="border: 1px solid black;"></td><td style="border: 1px solid black;"></td><td style="border: 1px solid black;"></td><td style="border: 1px solid black;"></td><td style="border: 1px solid black;"></td><td style="border: 1px solid black;"></td></tr>
                        <tr><td style="border: 1px solid black; height: 25px;"></td><td style="border: 1px solid black;"></td><td style="border: 1px solid black;"></td><td style="border: 1px solid black;"></td><td style="border: 1px solid black;"></td><td style="border: 1px solid black;"></td><td style="border: 1px solid black;"></td></tr>
                    </tbody>
                </table>
                <p>Ngoài những tang vật, phương tiện vi phạm hành chính và các giấy tờ nêu trên, chúng tôi không tạm giữ thêm thứ gì khác.</p>

                <p><b>10. Quyền và thời hạn giải trình (12)</b></p>
                <p>a) Không được quyền giải trình (do không thuộc trường hợp quy định tại khoản 1 Điều 61 Luật Xử lý vi phạm hành chính): □ đối với hành vi vi phạm quy định tại……………………………………………………………………..</p>
                <p>b) Được quyền giải trình (do thuộc trường hợp quy định tại khoản 1 Điều 61 Luật Xử lý vi phạm hành chính): □ đối với hành vi vi phạm quy định tại…..</p>
                <p style="text-align: justify;">Trong thời hạn 02 ngày làm việc, kể từ ngày lập biên bản này, ông (bà) (13) .......... là &lt;cá nhân/người đại diện của tổ chức&gt;(*) vi phạm có quyền gửi văn bản yêu cầu được giải trình trực tiếp đến (14) ………………… để thực hiện quyền giải trình.</p>
                <p style="text-align: justify;">Trong thời hạn 05 ngày làm việc, kể từ ngày lập biên bản này, ông (bà) (13)..... là &lt;cá nhân/người đại diện của tổ chức&gt;(*) vi phạm có quyền gửi văn bản giải trình đến (14)……. để thực hiện quyền giải trình.</p>
                
                <p><i>&lt;Trường hợp cá nhân/người đại diện của tổ chức vi phạm phải đến làm việc với người có thẩm quyền trước khi ra quyết định xử phạt vi phạm hành chính&gt;</i></p>
                <p>Yêu cầu ông (bà) (13)........ là &lt;cá nhân/người đại diện của tổ chức&gt;(*) vi phạm có mặt vào hồi ... giờ ... phút, ngày ...../....../....., tại (15) …………….. để giải quyết vụ việc.</p>

                <p style="text-align: justify; margin-top: 10px;">
                    Biên bản lập xong hồi …..giờ……phút, ngày .../.../${currentYear} gồm 02 tờ, được lập thành 03 bản có nội dung và giá trị như nhau; đã đọc lại cho những người có tên nêu trên cùng nghe, công nhận là đúng và cùng ký tên dưới đây; giao cho ông (bà) (13) <b>${data.NGUOI}</b> là &lt;cá nhân/người đại diện của tổ chức&gt;(*) vi phạm 01 bản, &lt;cha mẹ/người giám hộ của người chưa thành niên vi phạm 01 bản&gt;(*), 01 bản lưu hồ sơ.
                </p>

                <p><i>&lt;Trường hợp cá nhân/tổ chức nhận các biên bản, quyết định bằng phương thức điện tử&gt;</i></p>
                <p>Số điện thoại/địa chỉ thư điện tử/ứng dụng định danh quốc gia hoặc tài khoản định danh điện tử (có xác thực mức độ 2 trở lên) hoặc gửi qua ứng dụng được quy định trong các văn bản quy phạm pháp luật của ngành, lĩnh vực, địa phương:…………………………………………………………...</p>

                <p><i>&lt;Trường hợp cá nhân/người đại diện của tổ chức vi phạm không ký biên bản vi phạm hành chính&gt;</i></p>
                <p>Lý do ông (bà) (13) …………………… &lt;cá nhân/người đại diện của tổ chức&gt;(*) vi phạm không ký biên bản:...................................................</p>

                <p><i>&lt;Trường hợp người chứng kiến/đại diện chính quyền cấp xã không ký xác nhận việc cá nhân/người đại diện của tổ chức vi phạm không ký biên bản vi phạm hành chính&gt;</i></p>
                <p>Lý do ông (bà) (5)............................................ &lt;người chứng kiến/đại diện chính quyền cấp xã&gt; không ký xác nhận:………………………………………..</p>

                <table style="width: 100%; text-align: center; border-collapse: collapse; font-weight: bold; margin-top: 20px;">
                    <tr style="vertical-align: top;">
                        <td style="width: 50%; padding-bottom: 80px;">CÁ NHÂN/NGƯỜI ĐẠI DIỆN<br/>CỦA TỔ CHỨC VI PHẠM</td>
                        <td style="width: 50%; padding-bottom: 80px;">NGƯỜI LẬP BIÊN BẢN</td>
                    </tr>
                    <tr style="vertical-align: top;">
                        <td><i>(Ký, ghi rõ họ và tên)</i><br/><br/><br/><br/>${data.NGUOI}</td>
                        <td><i>(Ký, ghi rõ chức vụ, họ và tên)</i><br/><br/><br/><br/>Cao Thị Dung</td>
                    </tr>
                    
                    <tr><td colspan="2" style="height: 30px;"></td></tr>

                    <tr style="vertical-align: top;">
                        <td style="width: 50%; padding-bottom: 80px;">CÁ NHÂN/NGƯỜI ĐẠI DIỆN<br/>CỦA TỔ CHỨC BỊ THIỆT HẠI</td>
                        <td style="width: 50%; padding-bottom: 80px;">ĐẠI DIỆN CHÍNH QUYỀN</td>
                    </tr>
                    <tr style="vertical-align: top;">
                        <td><i>(Ký, ghi rõ họ và tên)</i></td>
                        <td><i>(Ký, ghi rõ chức vụ, họ và tên)</i></td>
                    </tr>

                    <tr><td colspan="2" style="height: 30px;"></td></tr>

                    <tr style="vertical-align: top;">
                        <td style="width: 50%; padding-bottom: 80px;">NGƯỜI PHIÊN DỊCH</td>
                        <td style="width: 50%; padding-bottom: 80px;">NGƯỜI CHỨNG KIẾN</td>
                    </tr>
                    <tr style="vertical-align: top;">
                        <td><i>(Ký, ghi rõ họ và tên)</i></td>
                        <td><i>(Ký, ghi rõ họ và tên)</i></td>
                    </tr>
                </table>

                <div style="margin-top: 20px; border-top: 1px solid black; width: 100%;"></div>
                <p style="font-size: 13pt; margin-top: 5px;"><i>&lt;In ở mặt sau&gt;</i>(**) Biên bản đã giao trực tiếp cho &lt;cá nhân/người đại diện của tổ chức&gt;(*) vi phạm vào hồi …..giờ……phút, ngày .../.../${currentYear}./.</p>
                
                <div style="text-align: right; margin-top: 20px; margin-right: 50px; font-weight: bold;">
                    <p>NGƯỜI NHẬN BIÊN BẢN</p>
                    <p style="font-weight: normal; font-style: italic;">(Ký, ghi rõ họ và tên)</p>
                </div>
            </div>
            `;
        } else {
            return `
            <div style="font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.3; color: black; text-align: justify; width: 100%;">
                
                <table style="width: 100%; text-align: center; font-weight: bold; border-collapse: collapse; margin-bottom: 10px; border: none;">
                    <tr style="vertical-align: top;">
                        <td style="width: 45%; padding: 0;">
                            <p style="margin: 0; font-size: 12pt;">VĂN PHÒNG ĐKĐĐ THÀNH PHỐ ĐỒNG NAI</p>
                            <p style="margin: 0; font-size: 13pt;">CHI NHÁNH HỚN QUẢN</p>
                            ${lineLeftHtml}
                            <p style="margin: 0; font-weight: normal; font-size: 13pt; margin-top: 5px;">Số: ${data.STT || '....'} /BBLV</p>
                        </td>
                        <td style="width: 55%; padding: 0;">
                            <p style="margin: 0; font-size: 12pt;">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                            <p style="margin: 0; font-size: 13pt;">Độc lập - Tự do - Hạnh phúc</p>
                            ${lineRightHtml}
                            <p style="margin: 0; margin-top: 10px; font-weight: normal; font-style: italic;">${placeName}, ngày …. tháng …. năm ${currentYear}</p>
                        </td>
                    </tr>
                </table>
                
                <p style="margin: 0;">&nbsp;</p>

                <div style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 5px;">BIÊN BẢN LÀM VIỆC*</div>
                <div style="text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 20px;">Ghi nhận sự việc liên quan đến vi phạm hành chính<br/>trong lĩnh vực đất đai</div>

                <p style="margin-bottom: 10px;">Hôm nay, hồi ... giờ ... phút, ngày …. tháng …. năm ${currentYear}, tại (2) Trung tâm phục vụ hành chính công ${data.XA_PHUONG}.</p>
                
                <p><b>Chúng tôi gồm có:</b></p>
                
                <p><b>1. Người có thẩm quyền lập biên bản:</b></p>
                <div style="margin-left: 20px;">
                    <p>1. Ông/bà: ${creatorName} - Chức vụ: Nhân viên Văn phòng Đăng ký đất đai thành phố Đồng Nai - Chi nhánh Hớn Quản – Phụ trách tiếp nhận hồ sơ lĩnh vực đất đai tại Trung tâm phục vụ hành chính công ${data.XA_PHUONG}.</p>
                </div>

                <p><b>2. Người chứng kiến (nếu có):</b></p>
                <div style="margin-left: 20px;">
                    <p>Họ và tên: ……………………………… Nghề nghiệp: ………….</p>
                    <p>Địa chỉ: …………………………………………………………</p>
                </div>

                <p><b>3. &lt;Cá nhân/Tổ chức&gt;(*) bị thiệt hại (nếu có):</b> (3) Không có</p>

                <p><b>4. &lt;Cá nhân/Tổ chức&gt;(*) có liên quan trực tiếp đến vụ việc:</b></p>
                <div style="margin-left: 20px;">
                    <p>&lt;Họ và tên&gt;(*) Ông/bà: <b>${data.NGUOI}</b> Giới tính: ${data.GIOITINH}</p>
                    <p>Ngày, tháng, năm sinh: ${data.NGAYSINH} Quốc tịch: Việt Nam</p>
                    <p>Nghề nghiệp: Lao động tự do</p>
                    <p>Nơi ở hiện tại: ${data.NOIO}</p>
                    <p>Số định danh cá nhân/CMND/Hộ chiếu: ${data.CCCD}; ngày cấp: ${data.NGAYCAP}; nơi cấp: ${data.NOICAP}</p>
                </div>

                <p style="margin-top: 10px;"><b>Tiến hành lập biên bản làm việc đối với &lt;ông (bà)&gt;(*) ${data.NGUOI} có liên quan trực tiếp đến vụ việc:</b></p>
                
                <div style="margin-left: 20px;">
                    <p>1. Thời gian xảy ra vụ việc: ngày …. tháng …. năm ${currentYear}</p>
                    <p>2. Địa điểm xảy ra vụ việc: Trung tâm PVHCC ${data.XA_PHUONG}</p>
                    <p style="text-align: justify;">
                        3. Diễn biến của vụ việc: ông/bà <b>${data.NGUOI}</b> nhận <b>${data.LOAIHS}</b> thửa đất số <b>${data.THUA}</b>, tờ bản đồ số <b>${data.TO}</b>, diện tích <b>${data.DT}m²</b>, tọa lạc tại ${data.DC_THUA}, ${data.XA_PHUONG} được cấp GCNQSD đất số phát hành <b>${data.SPH}</b>, số vào sổ <b>${data.SVS}</b>, cấp ngày ${data.NGAYCAPGCN} do ${data.COQUANCAP} cho <b>${data.CHUSDGCN}</b> theo Hợp đồng <b>${data.LOAIHS}</b> số: ${data.SOCC} do Văn Phòng Công chứng ${data.VPCC} lập ngày ${data.NGAYCC}. Tuy nhiên, đến thời điểm lập biên bản làm việc, ông/bà ${data.NGUOI} vẫn chưa thực hiện thủ tục đăng ký biến động đất đai. Như vậy, ông/bà ${data.NGUOI} đã quá thời hạn đăng ký biến động đất đai là 30 ngày kể từ ngày hợp đồng ${data.LOAIHS} được công chứng theo quy định tại điểm a khoản 1 và khoản 3 Điều 133 Luật Đất đai năm 2024.<br/>
                        Ông/bà ${data.NGUOI} đã vi phạm quy định tại khoản 2, Điều 16, Nghị định số 123/2024/NĐ-CP ngày 04/10/2024 của Chính phủ Quy định về xử phạt vi phạm hành chính trong lĩnh vực đất đai.
                    </p>
                    <p>Chúng tôi tiến hành lập biên bản ghi nhận sự việc và chuyển đến cơ quan có thẩm quyền để xử lý theo quy định</p>
                    <p>4. Hiện trường: Không có</p>
                    <p>5. Thiệt hại (nếu có): Không có</p>
                    <p>6. Ý kiến trình bày của &lt;cá nhân/tổ chức&gt;(*) bị thiệt hại (nếu có): Không có</p>
                    <p>7. Lời khai của &lt;cá nhân/tổ chức&gt;(*) có liên quan trực tiếp đến vụ việc: Không có</p>
                    <p>8. Ý kiến trình bày của người chứng kiến (nếu có): Không có</p>
                    <p>9. Các biện pháp xử lý và ngăn chặn hậu quả do sự việc gây ra (nếu có): Không có</p>
                    <p>10. Giấy tờ có liên quan đến vụ việc (nếu có):</p>
                    <p style="margin-left: 20px;">Hợp đồng ${data.LOAIHS} số: ${data.SOCC} quyển số …. do Văn Phòng Công chứng ${data.VPCC} lập ngày ${data.NGAYCC} (bản photo có đối chiếu với bản gốc).</p>
                </div>

                <p style="margin-top: 15px; text-align: justify;">
                    Biên bản lập xong hồi... giờ... phút, ngày …. tháng …. năm ${currentYear}, gồm 02 tờ, được lập thành 02 bản có nội dung và giá trị như nhau; đã đọc lại cho những người có tên nêu trên cùng nghe, công nhận là đúng và cùng ký tên dưới đây; giao cho ông (bà) (6) ${data.NGUOI} là &lt;cá nhân&gt;(*) có liên quan trực tiếp đến vụ việc 01 bản, 01 bản lưu hồ sơ.
                </p>
                <p><i>&lt;Trường hợp cá nhân/người đại diện của tổ chức có liên quan trực tiếp đến vụ việc không ký biên bản làm việc&gt;</i></p>
                <p>Lý do ông (bà) (6)................. là &lt;cá nhân/người đại diện của tổ chức&gt;(*) có liên quan trực tiếp đến vụ việc không ký biên bản:</p>

                <table style="width: 100%; text-align: center; border-collapse: collapse; font-weight: bold; margin-top: 20px;">
                    <tr style="vertical-align: top;">
                        <td style="width: 50%; padding-bottom: 80px;">CÁ NHÂN<br/>CÓ LIÊN QUAN ĐẾN VỤ VIỆC</td>
                        <td style="width: 50%; padding-bottom: 80px;">NGƯỜI LẬP BIÊN BẢN GHI NHẬN SỰ VIỆC</td>
                    </tr>
                    <tr style="vertical-align: top;">
                        <td><i>(Ký, ghi rõ họ và tên)</i><br/><br/><br/><br/>${data.NGUOI}</td>
                        <td><i>(Ký, ghi rõ chức vụ, họ và tên)</i><br/><br/><br/><br/>${creatorName}</td>
                    </tr>
                    
                    <tr><td colspan="2" style="height: 30px;"></td></tr>

                    <tr style="vertical-align: top;">
                        <td style="width: 50%; padding-bottom: 80px;">CÁ NHÂN/NGƯỜI ĐẠI DIỆN<br/>TỔ CHỨC BỊ THIỆT HẠI</td>
                        <td style="width: 50%; padding-bottom: 80px;">NGƯỜI CHỨNG KIẾN</td>
                    </tr>
                    <tr style="vertical-align: top;">
                        <td><i>(Ký, ghi rõ họ và tên)</i></td>
                        <td><i>(Ký, ghi rõ họ và tên)</i></td>
                    </tr>
                </table>

                <div style="margin-top: 20px; border-top: 1px solid black; width: 100%;"></div>
                <p style="font-size: 13pt; margin-top: 5px;"><i>&lt;In ở mặt sau&gt;</i> Biên bản đã giao trực tiếp cho &lt;cá nhân /người đại diện của tổ chức&gt; vi phạm vào hồi…..... giờ......... phút, ngày ....../…..../${currentYear}.</p>
                
                <div style="text-align: right; margin-top: 20px; margin-right: 50px; font-weight: bold;">
                    <p>NGƯỜI NHẬN BIÊN BẢN</p>
                    <p style="font-weight: normal; font-style: italic;">(Ký, ghi rõ họ và tên)</p>
                </div>
            </div>
            `;
        }
    };

    const handleExport = async () => {
        setLoading(true);
        await handleSaveRecord(true);

        const fileName = templateType === 'mau01' 
            ? `BB_VPHC_${formData.NGUOI.replace(/\s+/g, '')}.doc` 
            : `BB_LamViec_${formData.NGUOI.replace(/\s+/g, '')}.doc`;
        
        const templateKey = templateType === 'mau01' ? STORAGE_KEYS.VPHC_TEMPLATE_01 : STORAGE_KEYS.VPHC_TEMPLATE_02;

        if (hasTemplate(templateKey)) {
            const today = new Date();
            const dataToPrint = {
                ...formData,
                NGUOI: formData.NGUOI.toUpperCase(),
                CHUSDGCN: formData.CHUSDGCN || formData.NGUOI.toUpperCase(),
                NGAY: today.getDate().toString().padStart(2, '0'),
                THANG: (today.getMonth() + 1).toString().padStart(2, '0'),
                NAM: today.getFullYear().toString(),
                DIA_DANH: formData.XA_PHUONG ? formData.XA_PHUONG.replace(/^(xã|phường|thị trấn)\s+/i, '').trim() : ''
            };
            
            const blob = await generateDocxBlobAsync(templateKey, dataToPrint);
            if (blob) {
                if (window.electronAPI && window.electronAPI.saveAndOpenFile) {
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                        if (!window.electronAPI?.saveAndOpenFile) return; // Add check here
                        const base64Data = (reader.result as string).split(',')[1];
                        const outputFolder = localStorage.getItem('DEFAULT_EXPORT_PATH_BIENBAN');
                        const result = await window.electronAPI.saveAndOpenFile({ fileName: fileName.replace('.doc', '.docx'), base64Data, outputFolder });
                        if (result.success && result.path) setExportedFilePath(result.path);
                    };
                    reader.readAsDataURL(blob);
                } else {
                    saveAs(blob, fileName.replace('.doc', '.docx'));
                }
            }
        } else {
            const content = renderPreviewHTML();
            const header = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><style>@page Section1 {size: 595.3pt 841.9pt; margin: 2.0cm 1.5cm 2.0cm 2.5cm;} div.Section1 { page: Section1; } body { font-family: "Times New Roman", serif; font-size: 13pt; }</style></head>
                <body><div class="Section1">${content}</div></body></html>
            `;
            
            if (window.electronAPI && window.electronAPI.saveAndOpenFile) {
                const base64Data = btoa(unescape(encodeURIComponent('\ufeff' + header)));
                const outputFolder = localStorage.getItem('DEFAULT_EXPORT_PATH_BIENBAN');
                const result = await window.electronAPI.saveAndOpenFile({ fileName, base64Data, outputFolder });
                if (result.success && result.path) setExportedFilePath(result.path);
            } else {
                const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
                saveAs(blob, fileName);
            }
        }
        setLoading(false);
    };

    const handleOpenFile = async () => {
        if (exportedFilePath && window.electronAPI && window.electronAPI.openFilePath) {
            await window.electronAPI.openFilePath(exportedFilePath);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9] overflow-hidden">
            {/* SUB-HEADER TABS (MODE SWITCHER) */}
            <div className="flex items-center gap-2 px-4 pt-2 border-b border-gray-200 bg-white shadow-sm shrink-0 z-20">
                <button 
                    onClick={() => { setMode('create'); handleResetForm(); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${mode === 'create' && !editingId ? 'border-red-600 text-red-600 bg-red-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <PlusCircle size={16} /> Soạn biên bản mới
                </button>
                <button 
                    onClick={() => { setMode('list'); handleResetForm(); loadRecords(); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${mode === 'list' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <List size={16} /> Danh sách đã lập ({savedRecords.length})
                </button>
                {editingId && (
                    <button 
                        onClick={() => {}} 
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 border-orange-500 text-orange-600 bg-orange-50/50 transition-colors animate-pulse"
                    >
                        <Settings size={16} /> Đang chỉnh sửa
                    </button>
                )}
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-hidden relative">
                {mode === 'create' ? (
                    <div className="flex flex-col lg:flex-row gap-6 h-full p-4 overflow-hidden">
                        {/* LEFT: FORM */}
                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="mb-4 p-3 bg-white border border-gray-200 rounded-xl flex gap-2 items-center shadow-sm">
                                <input 
                                    type="text" 
                                    placeholder="Nhập số biên nhận..." 
                                    className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
                                    value={searchCode}
                                    onChange={(e) => setSearchCode(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleLoadInfo()}
                                />
                                <button 
                                    onClick={handleLoadInfo}
                                    disabled={isLoadingInfo}
                                    className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-indigo-700 flex items-center gap-1 disabled:opacity-50 shrink-0"
                                >
                                    {isLoadingInfo ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                    Load thông tin
                                </button>
                            </div>
                            <VPHCForm formData={formData} handleChange={handleChange} />
                            
                            {/* ACTION BUTTONS */}
                            <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-gray-200 bg-white p-4 rounded-xl shadow-sm">
                                <button 
                                    onClick={() => handleSaveRecord(false)} 
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-bold"
                                >
                                    <Save size={18} /> Lưu Dữ Liệu
                                </button>
                            </div>
                        </div>

                        {/* RIGHT: PREVIEW */}
                        <div className="flex-1 flex flex-col min-w-0 relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <VPHCPreview 
                                templateType={templateType}
                                setTemplateType={setTemplateType}
                                exportedFilePath={exportedFilePath}
                                handleOpenFile={handleOpenFile}
                                handleExport={handleExport}
                                loading={loading}
                                renderPreviewHTML={renderPreviewHTML}
                                onConfig={() => setIsConfigOpen(true)} 
                            />
                        </div>
                    </div>
                ) : (
                    <div className="h-full p-4">
                        <VPHCList 
                            data={savedRecords}
                            onEdit={handleEditFromList}
                            onPrint={handlePrintFromList}
                            onDelete={handleDeleteRecord}
                            onRefresh={loadRecords}
                        />
                    </div>
                )}
            </div>

            <TemplateConfigModal 
                isOpen={isConfigOpen} 
                onClose={() => setIsConfigOpen(false)} 
                type="vphc" 
            />
        </div>
    );
};

export default VPHCTab;
