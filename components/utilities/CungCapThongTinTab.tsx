
import React, { useState, useEffect } from 'react';
import { PhieuInfoData, generatePreviewData, PLANNING_PRESETS, PlanningConfig, parseNumber } from '../../services/phieuInfoService';
import { Settings, X, Plus, Trash2, RotateCcw, RefreshCw, Download, List, PlusCircle, Save, Search, Loader2 } from 'lucide-react';
import saveAs from 'file-saver';
import { User as UserType, NotifyFunction } from '../../types';
import InfoForm from './info-tab/InfoForm';
import InfoPreview from './info-tab/InfoPreview';
import InfoList from './info-tab/InfoList';
import { ThongTinRecord, fetchThongTinRecords, saveThongTinRecord, deleteThongTinRecord } from '../../services/apiUtilities';
import { fetchRecords } from '../../services/apiRecords';

interface ProviderConfig {
    name: string;
    title: string;
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
    { name: 'Đỗ Tiến Dũng', title: 'Tổ trưởng tổ đo đạc' },
    { name: 'Phạm Ngọc Tân', title: 'Tổ phó tổ đo đạc' }
];

interface CungCapThongTinTabProps {
    currentUser?: UserType;
    notify: NotifyFunction;
}

const CungCapThongTinTab: React.FC<CungCapThongTinTabProps> = ({ currentUser, notify }) => {
    // Mode switcher
    const [mode, setMode] = useState<'create' | 'list'>('create');
    const [savedRecords, setSavedRecords] = useState<ThongTinRecord[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Load Provider Config from LocalStorage
    const [providers, setProviders] = useState<ProviderConfig[]>(() => {
        const saved = localStorage.getItem('phieu_info_providers');
        return saved ? JSON.parse(saved) : DEFAULT_PROVIDERS;
    });

    // --- CONFIG PLANNING STATE ---
    const [planningConfigs, setPlanningConfigs] = useState<PlanningConfig[]>(() => {
        const saved = localStorage.getItem('planning_settings_v2');
        return saved ? JSON.parse(saved) : PLANNING_PRESETS;
    });
    
    // Modal state for Planning Settings
    const [isPlanningSettingsOpen, setIsPlanningSettingsOpen] = useState(false);
    const [tempPlanningConfigs, setTempPlanningConfigs] = useState<PlanningConfig[]>([]);

    const [formData, setFormData] = useState<PhieuInfoData>({
        Ten_Nguoi_Yeu_Cau: '', UQ: '', Dia_Chi: '', Ngay_Nop: new Date().toISOString(),
        UQ_Loai: '', UQ_So: '', UQ_Ngay: '', UQ_VPCC: '',
        Ten_CSD: '', Dia_Chi_Thua_Dat: '', Phuong: 'thị trấn Tân Khai',
        Thua_Cu: '', To_Cu: '', 
        DT_Cu: '0', DT_ODT: '0', DT_CLN: '0', 
        To_2024: '', Thua_2024: '', DT_Moi: '', To_106: '',
        TBTH: '', QDTH: '',
        QH_Value: '', KH_Value: '', QHC_Value: '', QHC_DC_Value: '', QHC_DC_Moi_Value: '', QHPK_Value: '',
        Nguoi_1: providers[0]?.name || '', 
        CV_1: providers[0]?.title || '', 
        Nguoi_2: currentUser?.name || '...',
    });

    const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    
    const [isConfigProviders, setIsConfigProviders] = useState(false);
    const [tempProviders, setTempProviders] = useState<ProviderConfig[]>([]);

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
                    Ten_Nguoi_Yeu_Cau: record.customerName || prev.Ten_Nguoi_Yeu_Cau,
                    Dia_Chi: record.customerAddress || prev.Dia_Chi,
                    Ten_CSD: record.customerName || prev.Ten_CSD,
                    Dia_Chi_Thua_Dat: record.address || prev.Dia_Chi_Thua_Dat,
                    Phuong: record.ward || prev.Phuong,
                    Thua_Cu: record.landPlot || prev.Thua_Cu,
                    To_Cu: record.mapSheet || prev.To_Cu,
                    DT_Cu: record.area ? record.area.toString() : prev.DT_Cu,
                    DT_ODT: record.residentialArea ? record.residentialArea.toString() : prev.DT_ODT,
                    Thua_2024: record.landPlot || prev.Thua_2024,
                    To_2024: record.mapSheet || prev.To_2024,
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

    useEffect(() => { loadRecords(); }, []);

    // --- AUTO SAVE/LOAD CACHE ---
    useEffect(() => {
        if (mode === 'create' && !editingId) {
            const cachedForm = localStorage.getItem('CACHE_CCTT_FORM');
            if (cachedForm) {
                try {
                    const parsed = JSON.parse(cachedForm);
                    setFormData({ ...parsed, Nguoi_2: currentUser?.name || parsed.Nguoi_2 });
                } catch (e) { console.error(e); }
            }
        }
    }, [mode, editingId]);

    useEffect(() => {
        if (!editingId) {
            localStorage.setItem('CACHE_CCTT_FORM', JSON.stringify(formData));
        }
    }, [formData, editingId]);
    // -----------------------------

    const loadRecords = async () => {
        const data = await fetchThongTinRecords();
        setSavedRecords(data);
    };

    useEffect(() => {
        if (currentUser) {
            setFormData(prev => ({ ...prev, Nguoi_2: currentUser.name }));
        }
    }, [currentUser]);

    useEffect(() => {
        const total = parseNumber(formData.DT_Cu);
        const odt = parseNumber(formData.DT_ODT);
        const cln = Math.max(0, total - odt).toFixed(1); 
        setFormData(prev => ({ ...prev, DT_CLN: cln }));
    }, [formData.DT_Cu, formData.DT_ODT]);

    useEffect(() => {
        const data = generatePreviewData(formData, planningConfigs);
        setPreviewData(data);
    }, [formData, planningConfigs]);

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setExportedFilePath(null);
    };

    // --- API Handlers ---
    const handleSaveRecord = async (silent: boolean = false) => {
        if (!formData.Ten_Nguoi_Yeu_Cau) {
            if (!silent) notify("Vui lòng nhập tên người yêu cầu.", 'error');
            return;
        }

        const recordToSave: Partial<ThongTinRecord> = {
            id: editingId || undefined,
            customer_name: formData.Ten_CSD || formData.Ten_Nguoi_Yeu_Cau,
            data: { formData },
            created_by: currentUser?.name || 'Unknown'
        };

        const success = await saveThongTinRecord(recordToSave);
        if (success) {
            await loadRecords();
            if (!silent) notify(editingId ? "Đã cập nhật phiếu!" : "Đã lưu phiếu mới!", 'success');
        } else {
            if (!silent) notify("Lỗi khi lưu dữ liệu.", 'error');
        }
        return success;
    };

    const handleEditFromList = (item: ThongTinRecord) => {
        setEditingId(item.id);
        setFormData(item.data.formData);
        setMode('create');
    };

    const handleDeleteRecord = async (id: string) => {
        const success = await deleteThongTinRecord(id);
        if (success) {
            setSavedRecords(prev => prev.filter(r => r.id !== id));
            if (editingId === id) {
                setEditingId(null);
                handleResetForm();
            }
            notify("Đã xóa phiếu cung cấp thông tin.", 'success');
        }
    };

    const handleResetForm = () => {
        setEditingId(null);
        const resetData: PhieuInfoData = {
            Ten_Nguoi_Yeu_Cau: '', UQ: '', Dia_Chi: '', Ngay_Nop: new Date().toISOString(),
            UQ_Loai: '', UQ_So: '', UQ_Ngay: '', UQ_VPCC: '',
            Ten_CSD: '', Dia_Chi_Thua_Dat: '', Phuong: 'thị trấn Tân Khai',
            Thua_Cu: '', To_Cu: '', 
            DT_Cu: '0', DT_ODT: '0', DT_CLN: '0', 
            To_2024: '', Thua_2024: '', DT_Moi: '', To_106: '',
            TBTH: '', QDTH: '',
            QH_Value: '', KH_Value: '', QHC_Value: '', QHC_DC_Value: '', QHC_DC_Moi_Value: '', QHPK_Value: '',
            Nguoi_1: providers[0]?.name || '', 
            CV_1: providers[0]?.title || '', 
            Nguoi_2: currentUser?.name || '...',
        };
        setFormData(resetData);
        setExportedFilePath(null);
        localStorage.removeItem('CACHE_CCTT_FORM');
    };

    const handleProvider1Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedName = e.target.value;
        const provider = providers.find(p => p.name === selectedName);
        if (provider) {
            setFormData(prev => ({ ...prev, Nguoi_1: provider.name, CV_1: provider.title }));
        } else {
            setFormData(prev => ({ ...prev, Nguoi_1: selectedName, CV_1: '' }));
        }
        setExportedFilePath(null);
    };

    const openProviderConfig = () => {
        setTempProviders([...providers]);
        setIsConfigProviders(true);
    };

    const saveProviderConfig = () => {
        setProviders(tempProviders);
        localStorage.setItem('phieu_info_providers', JSON.stringify(tempProviders));
        setIsConfigProviders(false);
        if (tempProviders.length > 0 && !tempProviders.find(p => p.name === formData.Nguoi_1)) {
             setFormData(prev => ({ ...prev, Nguoi_1: tempProviders[0].name, CV_1: tempProviders[0].title }));
        }
    };

    const updateTempProvider = (index: number, field: keyof ProviderConfig, value: string) => {
        const newArr = [...tempProviders];
        newArr[index] = { ...newArr[index], [field]: value };
        setTempProviders(newArr);
    };

    const addTempProvider = () => {
        setTempProviders([...tempProviders, { name: '', title: '' }]);
    };

    const removeTempProvider = (index: number) => {
        setTempProviders(tempProviders.filter((_, i) => i !== index));
    };

    const openPlanningConfig = () => {
        setTempPlanningConfigs([...planningConfigs]);
        setIsPlanningSettingsOpen(true);
    };

    const savePlanningConfig = () => {
        setPlanningConfigs(tempPlanningConfigs);
        localStorage.setItem('planning_settings_v2', JSON.stringify(tempPlanningConfigs));
        setIsPlanningSettingsOpen(false);
    };

    const updateTempPlanning = (index: number, field: keyof PlanningConfig, value: string) => {
        const newArr = [...tempPlanningConfigs];
        newArr[index] = { ...newArr[index], [field]: value };
        setTempPlanningConfigs(newArr);
    };

    const addTempPlanning = () => {
        const newKey = `CUSTOM_${Math.floor(Math.random() * 1000)}`;
        setTempPlanningConfigs([...tempPlanningConfigs, {
            key: newKey,
            Label: 'Quy hoạch mới',
            TenDoAn: '',
            SoQuyetDinh: '',
            NgayQuyetDinh: '',
            CoQuanBanHanh: ''
        }]);
    };

    const removeTempPlanning = (index: number) => {
        if (confirm("Bạn có chắc muốn xóa loại quy hoạch này?")) {
            setTempPlanningConfigs(tempPlanningConfigs.filter((_, i) => i !== index));
        }
    };

    const resetPlanningToDefault = () => {
        if (confirm("Khôi phục danh sách mặc định? Các cấu hình tùy chỉnh sẽ bị mất.")) {
            setTempPlanningConfigs(PLANNING_PRESETS);
        }
    };

    const sanitizeFilename = (str: string) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d").replace(/Đ/g, "D")
            .replace(/[^a-zA-Z0-9]/g, "_");
    };

    const handleExport = async () => {
        setLoading(true);
        await handleSaveRecord(true);

        try {
            const content = renderPreviewHTML(); 
            const namePart = sanitizeFilename(formData.Ten_CSD || 'Khach');
            const toPart = sanitizeFilename(formData.To_2024 || formData.To_Cu || '0');
            const thuaPart = sanitizeFilename(formData.Thua_2024 || formData.Thua_Cu || '0');
            const fileName = `Phieu_TT_${namePart}_To${toPart}_Thua${thuaPart}.doc`;

            const header = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                      xmlns:w='urn:schemas-microsoft-com:office:word' 
                      xmlns='http://www.w3.org/TR/REC-html40'>
                <head>
                    <meta charset='utf-8'>
                    <style>
                        @page Section1 {
                            size: 595.3pt 841.9pt; 
                            margin: 2.0cm 2.0cm 2.0cm 3.0cm; 
                        }
                        div.Section1 { page: Section1; }
                        body { 
                            font-family: "Times New Roman", serif; 
                            font-size: 13pt; 
                            line-height: 1.3; 
                        }
                        p { margin: 0; margin-bottom: 2px; }
                        table { border-collapse: collapse; }
                    </style>
                </head>
                <body>
                    <div class="Section1">
                        ${content}
                    </div>
                </body>
                </html>
            `;

            if (window.electronAPI && window.electronAPI.saveAndOpenFile) {
                const base64Data = btoa(unescape(encodeURIComponent(header)));
                const outputFolder = localStorage.getItem('DEFAULT_EXPORT_PATH_THONGTIN');
                
                const result = await window.electronAPI.saveAndOpenFile({
                    fileName: fileName,
                    base64Data: base64Data,
                    outputFolder: outputFolder
                });
                
                if (result.success) {
                    setExportedFilePath(result.path || null);
                    if (result.path && window.electronAPI.openFilePath) {
                        await window.electronAPI.openFilePath(result.path);
                    }
                } else {
                    if (typeof result.message === 'string' && result.message.includes('EBUSY')) {
                        notify("Lỗi: File đang mở hoặc trùng tên file. Vui lòng đóng file Word cũ.", 'error');
                    } else {
                        notify(`Lỗi khi lưu file: ${result.message}`, 'error');
                    }
                }
            } else {
                const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
                saveAs(blob, fileName);
            }
        } catch (error: any) {
            console.error(error);
            notify(`Lỗi xuất file: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenFile = async () => {
        if (exportedFilePath && window.electronAPI && window.electronAPI.openFilePath) {
            await window.electronAPI.openFilePath(exportedFilePath);
        }
    };

    const renderPreviewHTML = () => {
        if (!previewData) return '';

        const today = new Date();
        const day = today.getDate().toString().padStart(2, '0');
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const year = today.getFullYear();

        const uqText = previewData.UQ_FULL_TEXT ? previewData.UQ_FULL_TEXT : '';
        const quyHoachHtml = previewData.QUY_HOACH_VANBAN 
            ? previewData.QUY_HOACH_VANBAN.split('\n').map((line: string) => `<p style="margin: 0; margin-bottom: 5px;">${line}</p>`).join('') 
            : '';

        const toTitleCase = (str: string) => {
            if (!str) return '';
            return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        };

        const lineLeftHtml = `
            <table style="width: 85px; margin: 0 auto; border-collapse: collapse; border: none;">
                <tr><td style="border-bottom: 1px solid black; height: 1px;"></td></tr>
            </table>
        `;

        const lineRightHtml = `
            <table style="width: 185px; margin: 0 auto; border-collapse: collapse; border: none;">
                <tr><td style="border-bottom: 1px solid black; height: 1px;"></td></tr>
            </table>
        `;

        return `
            <div style="font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.3; color: black; text-align: justify;">
                
                <table style="width: 100%; text-align: center; font-weight: bold; border-collapse: collapse; margin-bottom: 0px; font-size: 11pt; border: none;">
                    <tr style="vertical-align: top;">
                        <td style="width: 45%; padding: 0;">
                            <p style="margin: 0;">VĂN PHÒNG ĐKĐĐ THÀNH PHỐ ĐỒNG NAI</p>
                            <p style="margin: 0;">CHI NHÁNH HỚN QUẢN</p>
                            ${lineLeftHtml}
                        </td>
                        <td style="width: 55%; padding: 0;">
                            <p style="margin: 0;">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                            <p style="margin: 0;">Độc lập - Tự do - Hạnh phúc</p>
                            ${lineRightHtml}
                        </td>
                    </tr>
                </table>

                <div style="text-align: right; font-style: italic; margin-bottom: 45px; margin-top: 25px;">
                    Tân Khai, ngày ${day} tháng ${month} năm ${year}
                </div>

                <div style="text-align: center; font-weight: bold; font-size: 15pt; margin-bottom: 20px;">
                    PHIẾU CUNG CẤP THÔNG TIN
                </div>

                <div style="margin-bottom: 5px;"><b>I. Người yêu cầu cung cấp thông tin:</b></div>
                <div style="margin-left: 20px; margin-bottom: 5px;">Ông (bà): <b>${toTitleCase(formData.Ten_Nguoi_Yeu_Cau)}</b></div>
                <div style="margin-left: 20px; margin-bottom: 10px;">Địa chỉ: ${formData.Dia_Chi}</div>

                <div style="margin-bottom: 5px;"><b>II. Người cung cấp thông tin:</b></div>
                <table style="width: 100%; margin-left: 20px; margin-bottom: 10px; border-collapse: collapse;">
                    <tr>
                        <td style="width: 50%;">1. Ông (bà): <b>${formData.Nguoi_1}</b></td>
                        <td>Chức vụ: ${formData.CV_1}</td>
                    </tr>
                    <tr>
                        <td style="width: 50%;">2. Ông (bà): <b>${formData.Nguoi_2}</b></td>
                        <td>Chức vụ: Nhân viên</td>
                    </tr>
                </table>

                <div style="margin-bottom: 5px;"><b>III. Nội dung cần cung cấp:</b></div>
                <p style="text-indent: 30px; margin-bottom: 5px;">
                    Ông (bà): <b>${toTitleCase(formData.Ten_Nguoi_Yeu_Cau)}</b> ${uqText} nộp phiếu yêu cầu cung cấp thông tin tại Trung tâm phục vụ hành chính công ${formData.Phuong} ${previewData.Ngay_Nop_Fmt}.
                </p>
                <p style="text-indent: 30px; margin-bottom: 5px;">
                    Nội dung yêu cầu cung cấp thông tin quy hoạch thửa đất số <b>${formData.Thua_Cu}</b>, tờ bản đồ số <b>${formData.To_Cu}</b>, diện tích <b>${formData.DT_Cu}m²</b> ${previewData.Loai_Dat_Fmt} tọa lạc tại ${formData.Dia_Chi_Thua_Dat}, ${formData.Phuong}, tỉnh Bình Phước của ông (bà) <b>${formData.Ten_CSD}</b>.
                </p>
                <p style="text-indent: 30px; margin-bottom: 5px;">
                    Căn cứ chức năng, nhiệm vụ Văn phòng Đăng ký Đất đai thành phố Đồng Nai – Chi nhánh Hớn Quản cung cấp thông tin cho ông (bà) ${formData.Ten_Nguoi_Yeu_Cau} với các nội dung như sau:
                </p>

                <div style="margin-top: 10px; font-weight: bold; font-style: italic;">* Thông tin về thửa đất:</div>
                <div style="margin-left: 10px;">
                    <p style="margin-bottom: 5px; text-align: justify;">
                        - Thửa đất số <b>${formData.Thua_Cu}</b>, tờ bản đồ số <b>${formData.To_Cu}</b>, diện tích <b>${formData.DT_Cu}m²</b> ${previewData.Loai_Dat_Fmt} ${previewData.DIEU_CHINH_THUA_DAT}
                    </p>
                    ${previewData.CHENH_LECH_VANBAN ? `<p style="margin-bottom: 5px;">${previewData.CHENH_LECH_VANBAN}</p>` : ''}
                </div>

                <div style="margin-top: 10px; font-weight: bold; font-style: italic;">* Về quy hoạch, kế hoạch sử dụng đất:</div>
                <div style="margin-left: 10px; text-align: justify;">
                    ${quyHoachHtml}
                    ${previewData.TBTH_VANBAN ? `<p style="margin-top: 5px;">${previewData.TBTH_VANBAN}</p>` : ''}
                    ${previewData.QDTH_VANBAN ? `<p style="margin-top: 5px;">${previewData.QDTH_VANBAN}</p>` : ''}
                </div>

                <p style="text-indent: 30px; margin-top: 15px;">
                    Vậy Văn phòng Đăng ký Đất đai thành phố Đồng Nai – Chi nhánh Hớn Quản cung cấp thông tin cho ông (bà) được biết.
                </p>

                <table style="width: 100%; margin-top: 30px; text-align: center; border-collapse: collapse;">
                    <tr style="vertical-align: top;">
                        <td style="width: 50%;">
                            <b>Người cung cấp</b><br><br><br><br><br>
                        </td>
                        <td style="width: 50%;">
                            <b>${previewData.CHUC_VU_GIAM_DOC.replace(/\n/g, '<br>')}</b><br><br><br><br><br>
                        </td>
                    </tr>
                </table>
            </div>
        `;
    };

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9] overflow-hidden">
            {/* MODE SWITCHER */}
            <div className="flex items-center gap-2 px-4 pt-2 border-b border-gray-200 bg-white shadow-sm shrink-0 z-20">
                <button 
                    onClick={() => { setMode('create'); handleResetForm(); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${mode === 'create' && !editingId ? 'border-purple-600 text-purple-600 bg-purple-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <PlusCircle size={16} /> Tạo phiếu mới
                </button>
                <button 
                    onClick={() => { setMode('list'); handleResetForm(); loadRecords(); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${mode === 'list' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <List size={16} /> Danh sách đã lưu ({savedRecords.length})
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

            <div className="flex-1 overflow-hidden relative">
                {mode === 'create' ? (
                    <div className="flex flex-col lg:flex-row gap-6 h-full p-4 overflow-hidden">
                        {/* LEFT: FORM INPUT */}
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
                            <InfoForm 
                                formData={formData}
                                handleChange={handleChange}
                                providers={providers}
                                handleProvider1Change={handleProvider1Change}
                                openProviderConfig={openProviderConfig}
                                planningConfigs={planningConfigs}
                                openPlanningConfig={openPlanningConfig}
                            />
                            
                            {/* ACTION BUTTON */}
                            <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-gray-200 bg-white p-4 rounded-xl shadow-sm">
                                <button onClick={() => handleSaveRecord(false)} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-sm">
                                    <Save size={18} /> Lưu Dữ Liệu
                                </button>
                            </div>
                        </div>

                        {/* RIGHT: A4 PREVIEW */}
                        <InfoPreview 
                            exportedFilePath={exportedFilePath}
                            handleOpenFile={handleOpenFile}
                            handleExport={handleExport}
                            loading={loading}
                            renderPreviewHTML={renderPreviewHTML}
                        />
                    </div>
                ) : (
                    <div className="h-full p-4">
                        <InfoList 
                            data={savedRecords}
                            onEdit={handleEditFromList}
                            onPrint={handleEditFromList} 
                            onDelete={handleDeleteRecord}
                            onRefresh={loadRecords}
                        />
                    </div>
                )}
            </div>

            {/* MODAL CẤU HÌNH NGƯỜI CUNG CẤP */}
            {isConfigProviders && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-xl animate-fade-in-up">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Danh sách người cung cấp (Mục 1)</h3>
                            <button onClick={() => setIsConfigProviders(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
                        </div>
                        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                            {tempProviders.map((p, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                    <div className="flex-1 space-y-1">
                                        <input className="w-full border rounded px-2 py-1 text-sm" placeholder="Họ tên" value={p.name} onChange={e => updateTempProvider(idx, 'name', e.target.value)} />
                                        <input className="w-full border rounded px-2 py-1 text-xs text-gray-500" placeholder="Chức vụ" value={p.title} onChange={e => updateTempProvider(idx, 'title', e.target.value)} />
                                    </div>
                                    <button onClick={() => removeTempProvider(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                </div>
                            ))}
                            <button onClick={addTempProvider} className="w-full border border-dashed border-blue-300 text-blue-600 py-2 rounded text-sm font-bold hover:bg-blue-50">+ Thêm người</button>
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2">
                            <button onClick={() => setIsConfigProviders(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
                            <button onClick={saveProviderConfig} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-bold">Lưu thay đổi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CẤU HÌNH QUY HOẠCH */}
            {isPlanningSettingsOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                <Settings className="text-purple-600" /> Cấu hình Loại Quy Hoạch
                            </h3>
                            <button onClick={() => setIsPlanningSettingsOpen(false)}><X size={24} className="text-gray-400 hover:text-red-500"/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto bg-gray-50 flex-1 space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-sm text-gray-600">Quản lý các thông tin quy hoạch (Tên đồ án, Quyết định...).</p>
                                <button onClick={addTempPlanning} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700">
                                    <Plus size={14} /> Thêm loại mới
                                </button>
                            </div>

                            <div className="space-y-4">
                                {tempPlanningConfigs.map((cfg, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => removeTempPlanning(idx)} className="text-red-400 hover:text-red-600 p-1.5 bg-red-50 rounded-lg hover:bg-red-100" title="Xóa">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Mã (Key)</label>
                                                <input className="w-full border bg-gray-50 rounded px-2 py-1.5 text-xs font-mono text-gray-500" value={cfg.key} readOnly disabled />
                                            </div>
                                            <div className="md:col-span-3">
                                                <label className="text-[10px] font-bold text-blue-600 uppercase block mb-1">Tên hiển thị (Label)</label>
                                                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-bold text-blue-800" value={cfg.Label || ''} onChange={e => updateTempPlanning(idx, 'Label', e.target.value)} placeholder="VD: QH Sử dụng đất" />
                                            </div>
                                            <div className="md:col-span-7">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tên đồ án quy hoạch</label>
                                                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={cfg.TenDoAn} onChange={e => updateTempPlanning(idx, 'TenDoAn', e.target.value)} placeholder="Tên đầy đủ của đồ án..." />
                                            </div>
                                            
                                            <div className="md:col-span-3">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Số Quyết định</label>
                                                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={cfg.SoQuyetDinh} onChange={e => updateTempPlanning(idx, 'SoQuyetDinh', e.target.value)} />
                                            </div>
                                            <div className="md:col-span-3">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Ngày QĐ</label>
                                                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={cfg.NgayQuyetDinh} onChange={e => updateTempPlanning(idx, 'NgayQuyetDinh', e.target.value)} />
                                            </div>
                                            <div className="md:col-span-6">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Cơ quan ban hành</label>
                                                <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" value={cfg.CoQuanBanHanh} onChange={e => updateTempPlanning(idx, 'CoQuanBanHanh', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-5 border-t bg-white flex justify-between items-center rounded-b-xl shrink-0">
                            <button onClick={resetPlanningToDefault} className="text-xs text-orange-600 hover:text-orange-800 underline flex items-center gap-1">
                                <RotateCcw size={12} /> Khôi phục mặc định
                            </button>
                            <div className="flex gap-2">
                                <button onClick={() => setIsPlanningSettingsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Hủy</button>
                                <button onClick={savePlanningConfig} className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-bold shadow-md">Lưu Cấu Hình</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CungCapThongTinTab;
