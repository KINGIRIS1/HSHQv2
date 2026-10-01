import React, { useState, useEffect } from 'react';
import { User as UserType, NotifyFunction } from '../../types';
import saveAs from 'file-saver';
import { Settings, List, PlusCircle, Save, Printer, FileText } from 'lucide-react';
import VPHCForm from './vphc-tab/VPHCForm';
import VPHCPreview from './vphc-tab/VPHCPreview';
import VPHCList from './vphc-tab/VPHCList';
import TemplateConfigModal from '../TemplateConfigModal';
import { generateDocxBlobAsync, STORAGE_KEYS, hasTemplate } from '../../services/docxService';
import { VphcRecord, fetchVphcRecords, saveVphcRecord, deleteVphcRecord } from '../../services/apiUtilities';

interface VPHCTabProps {
    currentUser?: UserType;
    notify: NotifyFunction;
}

const getDefaultVphcData = (user?: any) => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return {
        NGUOI: '', GIOITINH: 'Nam', NGAYSINH: '', NOIO: '', 
        CCCD: '', NGAYCAP: '', NOICAP: '',
        THUA: '', TO: '', DT: '', DC_THUA: '', XA_PHUONG: 'xã Tân Quan',
        SPH: '', SVS: '', NGAYCAPGCN: '', COQUANCAP: 'Sở Tài nguyên và Môi trường tỉnh Bình Phước',
        CHUSDGCN: '',
        LOAIHS: 'chuyển nhượng',
        SOCC: '', NGAYCC: '', VPCC: '',
        NGUOI_UY_QUYEN: '',
        SO_HD_UQ: '',
        NGAY_HD_UQ: '',
        VPCC_UQ: '',
        NGAY_LAP: `${d}/${m}/${y}`,
        GIO_LAP: h,
        PHUT_LAP: min,
        GIO_KT: h,
        PHUT_KT: String((now.getMinutes() + 20) % 60).padStart(2, '0'),
        NGUOI_LAP_BB: user?.name || user?.username || 'Trần Quốc Thuận',
        CHUCVU_NGUOI_LAP: 'Viên chức Tổ Hành chính – Tổng hợp',
        COQUAN_NGUOI_LAP: 'Văn phòng Đăng ký đất đai thành phố Đồng Nai – Chi nhánh Hớn Quản'
    };
};

const VPHCTab: React.FC<VPHCTabProps> = ({ currentUser, notify }) => {
    // Mode: 'create' (Soạn thảo) hoặc 'list' (Danh sách)
    const [mode, setMode] = useState<'create' | 'list'>('create');
    
    // Data State
    const [savedRecords, setSavedRecords] = useState<VphcRecord[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null); // ID nếu đang sửa bản ghi cũ

    const [formData, setFormData] = useState(() => getDefaultVphcData(currentUser));

    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);

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
            return false;
        }

        const recordToSave: Partial<VphcRecord> = {
            id: editingId || undefined, // Nếu có ID là update
            customer_name: formData.NGUOI,
            record_type: 'bienbanghinhan',
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

    const handleSaveAndPrint = async () => {
        if (!formData.NGUOI) {
            notify("Vui lòng nhập tên người vi phạm/liên quan trước khi in.", 'error');
            return;
        }

        // Open print window synchronously to prevent popup blockers
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Đang tải...</title></head><body style="font-family:sans-serif; text-align:center; padding-top:50px;"><h3>Đang chuẩn bị trang in...</h3></body></html>');
        }

        setLoading(true);
        await handleSaveRecord(true);
        setLoading(false);

        const content = renderPreviewHTML();
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Biên bản ghi nhận sự việc VPHC</title>
                        <style>
                            @page { size: A4; margin: 20mm 15mm 15mm 15mm; }
                            body { font-family: 'Times New Roman', serif; font-size: 13pt; color: black; line-height: 1.4; margin: 0; padding: 20px; background: white; -webkit-print-color-adjust: exact; }
                            @media print {
                                body { padding: 0; }
                                button { display: none !important; }
                            }
                        </style>
                    </head>
                    <body>
                        ${content}
                        <script>
                            window.onload = () => {
                                window.print();
                            };
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
        }
        notify("Đã lưu dữ liệu và mở hộp thoại in trực tiếp!", "success");
    };

    const handleExportWord = async () => {
        if (!formData.NGUOI) {
            notify("Vui lòng nhập tên người vi phạm/liên quan trước khi tải file Word.", 'error');
            return;
        }
        try {
            setLoading(true);
            const templateKey = STORAGE_KEYS.VPHC_TEMPLATE_01;
            const dataToExport = {
                ...formData,
                NGUOI: formData.NGUOI.toUpperCase()
            };

            if (hasTemplate(templateKey)) {
                const blob = await generateDocxBlobAsync(templateKey, dataToExport);
                if (blob) {
                    saveAs(blob, `Bien_Ban_VPHC_${formData.NGUOI.replace(/\s+/g, '_')}.docx`);
                    notify("Tải file Word từ mẫu thành công!", "success");
                    return;
                }
            }

            // Fallback xuất file Word trực tiếp từ nội dung mẫu biên bản
            const content = renderPreviewHTML();
            const cleanName = formData.NGUOI.replace(/\s+/g, '_') || 'Nguoi_Vi_Pham';
            const fileName = `Bien_Ban_VPHC_${cleanName}.doc`;

            const header = `
              <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
              <head>
                <meta charset='utf-8'>
                <style>
                  @page Section1 {
                    size: 595.3pt 841.9pt; 
                    margin: 56.7pt 42.5pt 56.7pt 70.9pt; 
                  }
                  div.Section1 { page: Section1; }
                  body { font-family: "Times New Roman", serif; font-size: 13pt; text-align: justify; line-height: 1.3; }
                  p { margin: 0; margin-bottom: 2px; line-height: 1.3; }
                  table { border-collapse: collapse; width: 100%; }
                  td, th { padding: 4px; vertical-align: top; }
                </style>
              </head>
              <body><div class="Section1">${content}</div></body></html>
            `;

            if (window.electronAPI && window.electronAPI.saveAndOpenFile) {
                const base64Data = btoa(unescape(encodeURIComponent('\ufeff' + header)));
                const outputFolder = localStorage.getItem('DEFAULT_EXPORT_PATH_BIENBAN');
                const result = await window.electronAPI.saveAndOpenFile({ fileName, base64Data, outputFolder });
                if (result.success) {
                    setExportedFilePath(result.path || null);
                    if (window.electronAPI.openFilePath && result.path) {
                        await window.electronAPI.openFilePath(result.path);
                    }
                    notify("Xuất và mở file Word thành công!", "success");
                } else {
                    notify(`Lỗi khi lưu file: ${result.message}`, 'error');
                }
            } else {
                const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
                saveAs(blob, fileName);
                notify("Tải file Word thành công!", "success");
            }
        } catch (e: any) {
            console.error("Export VPHC Word error:", e);
            notify("Lỗi khi xuất file Word: " + (e?.message || ''), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleEditFromList = (item: VphcRecord) => {
        setEditingId(item.id);
        setFormData(item.data);
        setMode('create');
    };

    const handlePrintFromList = (item: VphcRecord) => {
        setEditingId(item.id);
        setFormData(item.data);
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
        setFormData(getDefaultVphcData(currentUser));
        setExportedFilePath(null);
        localStorage.removeItem('CACHE_VPHC_FORM');
    };

    const renderPreviewHTML = () => {
        const data = { ...formData, NGUOI: formData.NGUOI.toUpperCase() };
        const currentYear = new Date().getFullYear();

        const lineLeftHtml = `
            <table style="width: 140px; margin: 0 auto; border-collapse: collapse; border: none;">
                <tr><td style="border-bottom: 1px solid black; height: 1px;"></td></tr>
            </table>
        `;

        const lineRightHtml = `
            <table style="width: 185px; margin: 0 auto; border-collapse: collapse; border: none;">
                <tr><td style="border-bottom: 1px solid black; height: 1px;"></td></tr>
            </table>
        `;

        return `
        <div style="font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.4; color: black; text-align: justify; width: 100%;">
            
            <table style="width: 100%; text-align: center; font-weight: bold; border-collapse: collapse; margin-bottom: 0px; border: none;">
                <tr style="vertical-align: top;">
                    <td style="width: 48%; padding: 0;">
                        <p style="margin: 0; font-size: 11pt; white-space: nowrap;">VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI</p>
                        <p style="margin: 0; font-size: 10.5pt; white-space: nowrap;">THÀNH PHỐ ĐỒNG NAI - CHI NHÁNH HỚN QUẢN</p>
                        ${lineLeftHtml}
                    </td>
                    <td style="width: 52%; padding: 0;">
                        <p style="margin: 0; font-size: 11pt; white-space: nowrap;">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                        <p style="margin: 0; font-size: 12.5pt; white-space: nowrap;">Độc lập - Tự do - Hạnh phúc</p>
                        ${lineRightHtml}
                    </td>
                </tr>
            </table>
            
            <p style="margin: 0;">&nbsp;</p>

            <div style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 5px;">BIÊN BẢN GHI NHẬN SỰ VIỆC</div>
            <div style="text-align: center; font-weight: bold; font-size: 13pt; margin-bottom: 20px;">Về việc chậm đăng ký biến động đất đai tại cơ quan có thẩm quyền</div>

            <p style="margin-bottom: 12px; text-indent: 30px;">Hôm nay, lúc ${data.GIO_LAP || '14'} giờ ${data.PHUT_LAP || '30'} phút, ngày ${data.NGAY_LAP || '04/9/2026'}, tại Trung Tâm Phục vụ Hành chính công ${data.XA_PHUONG}, thành phố Đồng Nai.</p>
            
            <p style="margin-bottom: 15px; text-indent: 30px;">Căn cứ điểm c khoản 2 Điều 32 Nghị định 123/NĐ-CP ngày 04/10/2024 của Chính phủ về việc quy định về xử phạt vi phạm hành chính trong lĩnh vực đất đai.</p>

            <p style="margin-bottom: 8px;"><b>I. Chúng tôi gồm:</b></p>
            <p style="margin-left: 20px; margin-bottom: 5px;">- Ông/Bà: <b>${data.NGUOI_LAP_BB || 'Trần Quốc Thuận'}</b>; Chức vụ: ${data.CHUCVU_NGUOI_LAP || 'Viên chức Tổ Hành chính – Tổng hợp'}</p>
            <p style="margin-left: 20px; margin-bottom: 15px;">- Đơn vị: ${data.COQUAN_NGUOI_LAP || 'Văn phòng Đăng ký đất đai thành phố Đồng Nai – Chi nhánh Hớn Quản'}</p>

            <p style="margin-bottom: 8px;"><b>II. Tiến hành lập biên bản ghi nhận sự việc đối với ông/bà có tên sau đây:</b></p>
            <p style="margin-left: 20px; margin-bottom: 4px;">- Họ và tên: <b>${data.NGUOI}</b> &nbsp;&nbsp;&nbsp;&nbsp; Giới tính: ${data.GIOITINH}</p>
            <p style="margin-left: 20px; margin-bottom: 4px;">- Ngày, tháng, năm sinh: ${data.NGAYSINH || '23/12/1979'} &nbsp;&nbsp;&nbsp;&nbsp; Quốc tịch: Việt Nam</p>
            <p style="margin-left: 20px; margin-bottom: 4px;">- Số CCCD/CMND/Hộ chiếu: ${data.CCCD || '034179022350'} &nbsp;&nbsp;&nbsp;&nbsp; Ngày cấp: ${data.NGAYCAP || '10/5/2021'}</p>
            <p style="margin-left: 20px; margin-bottom: 4px;">- Nơi cấp: ${data.NOICAP || 'Cục cảnh sát Quản lý hành chính về Trật tự xã hội'}</p>
            <p style="margin-left: 20px; margin-bottom: 15px;">- Địa chỉ: ${data.NOIO || 'xã Tân Quan, thành phố Đồng Nai'}</p>

            <p style="margin-bottom: 8px;"><b>III. Nội dung sự việc được ghi nhận:</b></p>
            <p style="margin-bottom: 10px; text-indent: 30px; text-align: justify;">
                - Ngày ${data.NGAY_LAP || '04/9/2026'}, ${data.NGUOI_UY_QUYEN ? `${data.NGUOI_UY_QUYEN} (người nhận ủy quyền từ bà ${data.NGUOI} theo Hợp đồng ủy quyền số ${data.SO_HD_UQ || '002054/2026/CCGD'} ngày ${data.NGAY_HD_UQ || '09/02/2026'} của ${data.VPCC_UQ || 'VPCC Nguyễn Cảnh'})` : `ông/bà <b>${data.NGUOI}</b>`} liên hệ Trung tâm Phục vụ Hành chính công ${data.XA_PHUONG} để nộp hồ sơ thực hiện thủ tục Đăng ký biến động đất đai theo quy định đối với thửa đất số <b>${data.THUA}</b>, tờ bản đồ số <b>${data.TO}</b>, diện tích <b>${data.DT}m²</b>, địa chỉ thửa đất: ${data.DC_THUA}, theo Giấy chứng nhận Quyền sử dụng đất số <b>${data.SPH}</b>, số vào sổ <b>${data.SVS}</b> do ${data.COQUANCAP} cấp ngày ${data.NGAYCAPGCN} cho ${data.CHUSDGCN || data.NGUOI}.
            </p>
            <p style="margin-bottom: 20px; text-indent: 30px; text-align: justify;">
                - Tuy nhiên, tính đến thời điểm hiện tại, Hợp đồng ${data.LOAIHS || 'chuyển nhượng'} quyền sử dụng đất số <b>${data.SOCC || '002053/2026/CCGD'}</b> do ${data.VPCC || 'VPCC Nguyễn Cảnh'} chứng nhận ngày ${data.NGAYCC || '09/02/2026'} đã quá 30 ngày kể từ ngày chứng nhận (phát sinh biến động) mà người sử dụng đất chưa Đăng ký biến động tại cơ quan có thẩm quyền, vi phạm quy định tại khoản 3 Điều 133 Luật đất đai năm 2024, thuộc trường hợp bị xử phạt theo quy định tại khoản 2 Điều 16 Nghị định 123/2024/NĐ-CP ngày 04/10/2024 của Chính Phủ quy định về xử phạt vi phạm hành chính trong lĩnh vực đất đai.
            </p>

            <p style="margin-bottom: 15px; text-indent: 30px; text-align: justify;">
                Biên bản lập xong lúc ${data.GIO_KT || '14'} giờ ${data.PHUT_KT || '50'} phút, ngày ${data.NGAY_LAP || '04/9/2026'}, gồm 02 tờ, được lập thành 03 bản có nội dung và giá trị như nhau; đã đọc lại cho những người có tên nêu trên cùng nghe, công nhận là đúng và cùng ký tên dưới đây; giao cho người đại diện/vi phạm 01 bản, 01 bản lưu hồ sơ, 01 bản chuyển Ủy ban nhân dân ${data.XA_PHUONG} để lập Biên bản vi phạm hành chính và ra quyết định xử phạt theo quy định.
            </p>

            <p style="margin-bottom: 25px; text-indent: 30px;">- Kính chuyển UBND ${data.XA_PHUONG} xử lý theo quy định./.</p>

            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; border: none;">
                <tr style="vertical-align: top;">
                    <td style="width: 50%; text-align: center;">
                        <p style="margin: 0; font-weight: bold;">CÁ NHÂN/ĐẠI DIỆN</p>
                        <p style="margin: 0; font-weight: bold;">CỦA NGƯỜI VI PHẠM</p>
                        <p style="margin: 0; font-style: italic; font-size: 11pt;">(Ký, ghi rõ họ và tên)</p>
                        <div style="height: 70px;"></div>
                        <p style="margin: 0; font-weight: bold;">${data.NGUOI}</p>
                    </td>
                    <td style="width: 50%; text-align: center;">
                        <p style="margin: 0; font-weight: bold;">NGƯỜI LẬP BIÊN BẢN</p>
                        <p style="margin: 0; font-style: italic; font-size: 11pt;">(Ký, ghi rõ họ và tên)</p>
                        <div style="height: 70px;"></div>
                        <p style="margin: 0; font-weight: bold;">${data.NGUOI_LAP_BB || 'Trần Quốc Thuận'}</p>
                    </td>
                </tr>
            </table>

        </div>
        `;
    };

    const handleOpenFile = async () => {
        if (exportedFilePath && window.electronAPI && window.electronAPI.openFilePath) {
            await window.electronAPI.openFilePath(exportedFilePath);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9] overflow-hidden">
            {/* SUB-HEADER TABS (MODE SWITCHER) */}
            <div className="flex items-center gap-2 px-4 pt-2 border-b border-gray-200 bg-white shadow-sm shrink-0 z-25">
                <button 
                    onClick={() => { setMode('create'); handleResetForm(); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors cursor-pointer ${mode === 'create' && !editingId ? 'border-red-600 text-red-600 bg-red-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <PlusCircle size={16} /> Soạn biên bản mới
                </button>
                <button 
                    onClick={() => { setMode('list'); handleResetForm(); loadRecords(); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors cursor-pointer ${mode === 'list' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
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
                            <VPHCForm formData={formData} handleChange={handleChange} />
                            
                            {/* ACTION BUTTONS */}
                            <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-gray-200 bg-white p-4 rounded-xl shadow-sm shrink-0">
                                <button 
                                    onClick={handleSaveAndPrint} 
                                    disabled={loading}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md active:scale-95 transition-all font-bold text-sm cursor-pointer disabled:opacity-50"
                                >
                                    <Printer size={18} /> {loading ? 'Đang xử lý...' : 'Lưu & In'}
                                </button>
                            </div>
                        </div>

                        {/* RIGHT: PREVIEW */}
                        <div className="flex-1 flex flex-col min-w-0 relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <VPHCPreview 
                                exportedFilePath={exportedFilePath}
                                handleOpenFile={handleOpenFile}
                                handleSaveAndPrint={handleSaveAndPrint}
                                handleExportWord={handleExportWord}
                                loading={loading}
                                renderPreviewHTML={renderPreviewHTML}
                                onConfig={() => setIsConfigOpen(true)} 
                            />
                        </div>
                    </div>
                ) : (
                    <div className="h-full p-4 overflow-y-auto">
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
