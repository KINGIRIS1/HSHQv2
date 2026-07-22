
import React, { useState, useEffect } from 'react';
import { User as UserType, NotifyFunction } from '../../types';
import saveAs from 'file-saver';
import { Loader2, Download, ExternalLink, List, PlusCircle, Save, Settings, Trash2, X, Plus, Search } from 'lucide-react';
import BienBanForm from './bien-ban-tab/BienBanForm';
import BienBanPreview from './bien-ban-tab/BienBanPreview';
import BienBanList from './bien-ban-tab/BienBanList';
import { BienBanRecord, fetchBienBanRecords, saveBienBanRecord, deleteBienBanRecord } from '../../services/apiUtilities';
import { fetchRecords } from '../../services/apiRecords';

interface BoundaryChange {
  id: string;
  direction: 'Bắc' | 'Đông' | 'Nam' | 'Tây';
  type: 'tăng' | 'giảm';
  area: string;
  adjacentPlot: string;
  mapSheet: string;
  objectName: string;
  roadNumber?: string; 
}

interface SoanBienBanTabProps {
    currentUser: UserType;
    isActive: boolean;
    notify: NotifyFunction;
}

const DEFAULT_BDDC_CAUSE = "Khi đo đạc lập bản đồ địa chính không có sự chỉ ranh của chủ sử dụng đất và các chủ sử dụng giáp ranh dẫn đến ranh giới mốc giới chưa được các bên xác định chính xác";

const DEFAULT_ISSUING_AUTHORITIES = [
    "Sở Tài nguyên và Môi trường tỉnh Bình Phước",
    "Văn phòng Đăng ký Đất đai thành phố Đồng Nai - Chi nhánh Hớn Quản",
    "Chi nhánh Văn phòng Đăng ký Đất đai huyện Hớn Quản",
    "UBND huyện Hớn Quản",
    "UBND huyện Bình Long (cũ)"
];

const SoanBienBanTab: React.FC<SoanBienBanTabProps> = ({ currentUser, isActive, notify }) => {
  // Mode: 'create' or 'list'
  const [mode, setMode] = useState<'create' | 'list'>('create');
  
  // Data Lists
  const [savedRecords, setSavedRecords] = useState<BienBanRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [exportedFilePath, setExportedFilePath] = useState<string | null>(null);
  
  // State quản lý danh sách Cơ quan cấp
  const [issuingAuthorities, setIssuingAuthorities] = useState<string[]>(() => {
      const saved = localStorage.getItem('issuing_authorities_list');
      return saved ? JSON.parse(saved) : DEFAULT_ISSUING_AUTHORITIES;
  });
  const [isConfigAuthorities, setIsConfigAuthorities] = useState(false);
  const [tempAuthorities, setTempAuthorities] = useState<string[]>([]);

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
                  TEN_CHU: record.customerName || prev.TEN_CHU,
                  DIA_CHI_CHU: record.customerAddress || prev.DIA_CHI_CHU,
                  OWNERS: [{
                      id: Date.now().toString(),
                      title: 'Ông/Bà',
                      name: record.customerName || '',
                      address: record.customerAddress || '',
                      hasSpouse: false,
                      spouseTitle: 'Bà',
                      spouseName: '',
                      spouseAddress: ''
                  }],
                  SO_THUA_MOI: record.landPlot || prev.SO_THUA_MOI,
                  SO_TO_MOI: record.mapSheet || prev.SO_TO_MOI,
                  DIA_CHI_THUA: record.address || prev.DIA_CHI_THUA,
                  PHUONG: record.ward || prev.PHUONG,
                  SO_GCN: record.issueNumber || prev.SO_GCN,
                  SO_VAO_SO: record.entryNumber || prev.SO_VAO_SO,
                  NGAY_CAP: record.issueDate || prev.NGAY_CAP,
                  DT_CU: record.area ? record.area.toString() : prev.DT_CU,
                  DT_ODT: record.residentialArea ? record.residentialArea.toString() : prev.DT_ODT,
                  SO_THUA_CU: record.landPlot || prev.SO_THUA_CU,
                  SO_TO_CU: record.mapSheet || prev.SO_TO_CU,
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

  const [formData, setFormData] = useState({
    GIO_LAP: '',
    PHUT_LAP: '',
    NGAY_LAP: '',
    THANG_LAP: '',
    NAM_LAP: '',
    HO: 'Ông', TEN_CHU: '', DIA_CHI_CHU: '',
    OWNERS: [] as any[], // Mảng chứa danh sách chủ (New)
    SO_THUA_MOI: '', SO_TO_106: '', SO_TO_MOI: '', DIA_CHI_THUA: '', PHUONG: 'thị trấn Tân Khai',
    SO_GCN: '', SO_VAO_SO: '', DV_CAP_GCN: 'Sở Tài nguyên và Môi trường tỉnh Bình Phước', NGAY_CAP: '',
    SO_THUA_CU: '', SO_TO_CU: '', 
    DT_CU: '0', DT_ODT: '0', DT_CLN: '0',
    HIEN_TRANG: 'Đất trống', LOAI_COC: 'Cọc bê tông', DT_MOI: '0', 
    DT_BDDC_2024: '0',
    HO_GIAP_RANH: '...................................................................',
    NGUYEN_NHAN_TEXT: '', 
    NGUYEN_NHAN_BDDC: DEFAULT_BDDC_CAUSE,
    HIEN_THI_Y_KIEN_GIAP_RANH: true,
    HIEN_THI_PHONG_KT: false,
    LOAI_DAI_DIEN: 'PHONG_KT', 
    HIEN_THI_CAU_LUU_Y: true,
    HIEN_THI_BIEN_DONG_BDDC: false 
  });

  const [boundaryChanges, setBoundaryChanges] = useState<BoundaryChange[]>([]);
  const [boundaryChangesBDDC, setBoundaryChangesBDDC] = useState<BoundaryChange[]>([]);

  // Load list on mount
  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
      const data = await fetchBienBanRecords();
      setSavedRecords(data);
  };

  // --- PERSISTENCE: Tự động lưu/tải trạng thái từ LocalStorage ---
  useEffect(() => {
      if (!editingId && mode === 'create') {
          try {
              const savedForm = localStorage.getItem('SOAN_BIEN_BAN_FORM');
              const savedBoundary = localStorage.getItem('SOAN_BIEN_BAN_BOUNDARY');
              const savedBoundaryBDDC = localStorage.getItem('SOAN_BIEN_BAN_BOUNDARY_BDDC');

              if (savedForm) {
                  const parsedForm = JSON.parse(savedForm);
                  // Migration: Nếu form cũ chưa có mảng OWNERS, ta khởi tạo nó từ trường lẻ
                  if (!parsedForm.OWNERS) {
                      parsedForm.OWNERS = []; // Form component sẽ tự handle việc tạo default nếu rỗng
                  }
                  setFormData(parsedForm);
              }
              if (savedBoundary) setBoundaryChanges(JSON.parse(savedBoundary));
              if (savedBoundaryBDDC) setBoundaryChangesBDDC(JSON.parse(savedBoundaryBDDC));
          } catch (e) {
              console.error("Lỗi tải cache biên bản", e);
          }
      }
  }, [editingId, mode]);

  useEffect(() => {
      if (!editingId) { 
          localStorage.setItem('SOAN_BIEN_BAN_FORM', JSON.stringify(formData));
          localStorage.setItem('SOAN_BIEN_BAN_BOUNDARY', JSON.stringify(boundaryChanges));
          localStorage.setItem('SOAN_BIEN_BAN_BOUNDARY_BDDC', JSON.stringify(boundaryChangesBDDC));
      }
  }, [formData, boundaryChanges, boundaryChangesBDDC, editingId]);
  // -------------------------------------------------------------

  const handleResetForm = () => {
      setEditingId(null);
      setFormData({
        GIO_LAP: '', PHUT_LAP: '', NGAY_LAP: '', THANG_LAP: '', NAM_LAP: '',
        HO: 'Ông', TEN_CHU: '', DIA_CHI_CHU: '',
        OWNERS: [],
        SO_THUA_MOI: '', SO_TO_106: '', SO_TO_MOI: '', DIA_CHI_THUA: '', PHUONG: 'thị trấn Tân Khai',
        SO_GCN: '', SO_VAO_SO: '', DV_CAP_GCN: 'Sở Tài nguyên và Môi trường tỉnh Bình Phước', NGAY_CAP: '',
        SO_THUA_CU: '', SO_TO_CU: '', 
        DT_CU: '0', DT_ODT: '0', DT_CLN: '0',
        HIEN_TRANG: 'Đất trống', LOAI_COC: 'Cọc bê tông', DT_MOI: '0', 
        DT_BDDC_2024: '0',
        HO_GIAP_RANH: '...................................................................',
        NGUYEN_NHAN_TEXT: '', 
        NGUYEN_NHAN_BDDC: DEFAULT_BDDC_CAUSE,
        HIEN_THI_Y_KIEN_GIAP_RANH: true,
        HIEN_THI_PHONG_KT: false,
        LOAI_DAI_DIEN: 'PHONG_KT',
        HIEN_THI_CAU_LUU_Y: true,
        HIEN_THI_BIEN_DONG_BDDC: false
      });
      setBoundaryChanges([]);
      setBoundaryChangesBDDC([]);
      setExportedFilePath(null);
  };

  const handleSaveRecord = async (silent: boolean = false) => {
      if (!formData.TEN_CHU) {
          if (!silent) notify("Vui lòng nhập tên chủ sử dụng.", 'error');
          return;
      }

      const recordToSave: Partial<BienBanRecord> = {
          id: editingId || undefined,
          customer_name: formData.TEN_CHU,
          data: { formData, boundaryChanges, boundaryChangesBDDC },
          created_by: currentUser?.name || 'Unknown'
      };

      const success = await saveBienBanRecord(recordToSave);
      if (success) {
          await loadRecords();
          if (!silent) notify(editingId ? "Đã cập nhật biên bản!" : "Đã lưu biên bản mới!", 'success');
      } else {
          if (!silent) notify("Lỗi khi lưu dữ liệu.", 'error');
      }
      return success;
  };

  const handleEditFromList = (item: BienBanRecord) => {
      setEditingId(item.id);
      
      const loadedData = item.data.formData;
      // Migration khi load từ DB cũ
      if (!loadedData.OWNERS) loadedData.OWNERS = [];
      
      setFormData(loadedData);
      setBoundaryChanges(item.data.boundaryChanges || []);
      setBoundaryChangesBDDC(item.data.boundaryChangesBDDC || []);
      setMode('create');
  };

  const handleDeleteRecord = async (id: string) => {
      const success = await deleteBienBanRecord(id);
      if (success) {
          setSavedRecords(prev => prev.filter(r => r.id !== id));
          if (editingId === id) {
              setEditingId(null);
              handleResetForm();
          }
          notify("Đã xóa biên bản", 'success');
      }
  };

  const resetFile = () => setExportedFilePath(null);

  // LOGIC CONFIG ISSUING AUTHORITIES
  const openAuthorityConfig = () => {
      setTempAuthorities([...issuingAuthorities]);
      setIsConfigAuthorities(true);
  };

  const saveAuthorityConfig = () => {
      setIssuingAuthorities(tempAuthorities);
      localStorage.setItem('issuing_authorities_list', JSON.stringify(tempAuthorities));
      setIsConfigAuthorities(false);
      notify("Đã lưu danh sách cơ quan cấp.", 'success');
  };

  const addTempAuthority = () => {
      setTempAuthorities([...tempAuthorities, '']);
  };

  const updateTempAuthority = (index: number, value: string) => {
      const newArr = [...tempAuthorities];
      newArr[index] = value;
      setTempAuthorities(newArr);
  };

  const removeTempAuthority = (index: number) => {
      setTempAuthorities(tempAuthorities.filter((_, i) => i !== index));
  };

  // LOGIC KIỂM TRA KHỚP DIỆN TÍCH
  const checkAreaMismatch = () => {
      const dtCu = parseFloat(formData.DT_CU) || 0;
      const dtMoi = parseFloat(formData.DT_MOI) || 0;
      const totalDiff = dtMoi - dtCu;

      let detailsSum = 0;
      let hasDetailArea = false;

      boundaryChanges.forEach(row => {
          const areaVal = parseFloat(row.area);
          if (!isNaN(areaVal) && areaVal > 0) {
              hasDetailArea = true;
              if (row.type === 'tăng') {
                  detailsSum += areaVal;
              } else {
                  detailsSum -= areaVal;
              }
          }
      });

      if (hasDetailArea && Math.abs(totalDiff - detailsSum) > 0.1) {
          return true;
      }
      return false;
  };

  const checkAreaMismatchBDDC = () => {
      if (!formData.HIEN_THI_BIEN_DONG_BDDC) return false;

      const dtBddc = parseFloat(formData.DT_BDDC_2024) || 0;
      const dtMoi = parseFloat(formData.DT_MOI) || 0;
      const totalDiff = dtMoi - dtBddc;

      let detailsSum = 0;
      let hasDetailArea = false;

      boundaryChangesBDDC.forEach(row => {
          const areaVal = parseFloat(row.area);
          if (!isNaN(areaVal) && areaVal > 0) {
              hasDetailArea = true;
              if (row.type === 'tăng') {
                  detailsSum += areaVal;
              } else {
                  detailsSum -= areaVal;
              }
          }
      });

      if (hasDetailArea && Math.abs(totalDiff - detailsSum) > 0.1) {
          return true;
      }
      return false;
  };

  const isAreaMismatch = checkAreaMismatch();
  const isAreaMismatchBDDC = checkAreaMismatchBDDC();

  useEffect(() => {
    const total = parseFloat(formData.DT_CU) || 0;
    const odt = parseFloat(formData.DT_ODT) || 0;
    const cln = Math.max(0, total - odt).toFixed(1);
    setFormData(prev => ({ ...prev, DT_CLN: cln }));
  }, [formData.DT_CU, formData.DT_ODT]);

  const formatAreaLabel = (val: string) => {
    const num = parseFloat(val) || 0;
    return num.toFixed(1) + ' m²'; 
  };

  const generateContent = (isForWord: boolean = false) => {
    const toTitleCase = (str: string) => {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    // --- GENERATE OWNERS HTML (LOGIC MỚI CẬP NHẬT: GỘP NẾU CÙNG ĐỊA CHỈ) ---
    let ownersHtmlFull = "";
    let ownersHtmlSimple = "";

    if (formData.OWNERS && formData.OWNERS.length > 0) {
        
        // 1. Generate Full HTML
        ownersHtmlFull = formData.OWNERS.map((o: any) => {
            let html = "";
            
            // Check nếu có vợ/chồng
            if (o.hasSpouse) {
                // Kiểm tra xem có nhập địa chỉ riêng cho vợ/chồng không
                const isSameAddress = !o.spouseAddress || o.spouseAddress.trim() === '';

                if (isSameAddress) {
                    // TRƯỜNG HỢP CÙNG ĐỊA CHỈ: Gộp dòng tên
                    html += `<p style="margin-bottom: 5px;">${o.title}: <b>${o.name.toUpperCase()}</b> Và ${o.spouseTitle.toLowerCase()}: <b>${o.spouseName.toUpperCase()}</b></p>`;
                    // Hiển thị địa chỉ chung (của chồng/chủ)
                    if (o.address) {
                        html += `<p style="margin-bottom: 5px;">Địa chỉ thường trú: ${o.address}</p>`;
                    }
                } else {
                    // TRƯỜNG HỢP KHÁC ĐỊA CHỈ: Tách dòng
                    html += `<p style="margin-bottom: 5px;">${o.title}: <b>${o.name.toUpperCase()}</b></p>`;
                    if (o.address) {
                        html += `<p style="margin-bottom: 5px;">Địa chỉ thường trú: ${o.address}</p>`;
                    }
                    html += `<p style="margin-bottom: 5px;">Và ${o.spouseTitle.toLowerCase()}: <b>${o.spouseName.toUpperCase()}</b></p>`;
                    if (o.spouseAddress) {
                        html += `<p style="margin-bottom: 5px;">Địa chỉ thường trú: ${o.spouseAddress}</p>`;
                    }
                }
            } else {
                // Chỉ có 1 chủ
                html += `<p style="margin-bottom: 5px;">${o.title}: <b>${o.name.toUpperCase()}</b></p>`;
                if (o.address) {
                    html += `<p style="margin-bottom: 5px;">Địa chỉ thường trú: ${o.address}</p>`;
                }
            }
            return html;
        }).join('');

        // 2. Generate Simple HTML (Cho phần ký tên hoặc mục II)
        ownersHtmlSimple = formData.OWNERS.map((o: any) => {
            let line = `${o.title}: <b>${o.name.toUpperCase()}</b>`;
            if (o.hasSpouse) {
                line += ` và ${o.spouseTitle.toLowerCase()}: <b>${o.spouseName.toUpperCase()}</b>`;
            }
            return `<p style="margin-bottom: 5px;">${line}</p>`;
        }).join('');

    } else {
        // Fallback cho dữ liệu cũ (chưa có mảng OWNERS)
        const line = `${formData.HO}: <b>${toTitleCase(formData.TEN_CHU)}</b>`;
        ownersHtmlSimple = `<p style="margin-bottom: 5px;">${line}</p>`;
        
        ownersHtmlFull = `<p style="margin-bottom: 5px;">${line}</p>`;
        if (formData.DIA_CHI_CHU) {
            ownersHtmlFull += `<p style="margin-bottom: 5px;">Địa chỉ thường trú: ${formData.DIA_CHI_CHU}</p>`;
        }
    }

    const dtCu = parseFloat(formData.DT_CU) || 0;
    const dtMoi = parseFloat(formData.DT_MOI) || 0;
    const dtBddc = parseFloat(formData.DT_BDDC_2024) || 0;

    const absDiff = Math.abs(dtMoi - dtCu).toFixed(1);
    const absDiffBddc = Math.abs(dtMoi - dtBddc).toFixed(1);
    const indentStyle = isForWord ? "text-indent: 35.4pt;" : "text-indent: 48px;";

    let diffMainText = "";
    if (dtMoi > dtCu) diffMainText = `tăng ${absDiff} m² so với GCN`;
    else if (dtMoi < dtCu) diffMainText = `giảm ${absDiff} m² so với GCN`;
    else diffMainText = "khớp với GCN";

    let diffBddcText = "";
    if (dtMoi > dtBddc) diffBddcText = `tăng ${absDiffBddc} m² so với BĐĐC 2024`;
    else if (dtMoi < dtBddc) diffBddcText = `giảm ${absDiffBddc} m² so với BĐĐC 2024`;
    else diffBddcText = "trùng khớp với BĐĐC 2024";

    const generateBoundaryHtml = (changes: BoundaryChange[], comparisonTarget: string) => {
        return changes.map(row => {
            let detailText = "";
            const areaText = row.area ? `, diện tích thửa đất ${row.type} <b>${row.area} m²</b> so với ${comparisonTarget}` : "";
            const effectiveMapSheet = row.mapSheet || formData.SO_TO_106 || formData.SO_TO_MOI || '...';

            let displayObjectName = row.objectName;
            if (row.objectName === 'Đường' && row.roadNumber) {
                const roadVal = row.roadNumber.trim();
                displayObjectName = /^\d+$/.test(roadVal) ? `Đường số ${roadVal}` : `Đường ${roadVal}`;
            }

            const isPhysicalObject = ['đường', 'sông', 'suối', 'mương', 'cống'].some(k => displayObjectName.toLowerCase().includes(k));

            if (isPhysicalObject) {
                detailText = `Biến động <b>${row.type}</b> về phía <b>${row.direction}</b> giáp ranh với <b>${displayObjectName}</b>${areaText}.`;
            } else {
                detailText = `Biến động <b>${row.type}</b> về phía <b>${row.direction}</b> giáp ranh <b>${displayObjectName} ${row.adjacentPlot}</b> tờ bản đồ số <b>${effectiveMapSheet}</b>${areaText}.`;
            }

            return `<p style="${indentStyle} margin-bottom: 3px;">- ${detailText}</p>`;
        }).join('');
    };

    const boundaryHtmlGCN = generateBoundaryHtml(boundaryChanges, "GCN");
    const boundaryHtmlBDDC = generateBoundaryHtml(boundaryChangesBDDC, "BĐĐC 2024");

    const toBanDoMoTa = formData.SO_TO_106 || formData.SO_TO_MOI || '...';

    const nguyenNhanSection = formData.NGUYEN_NHAN_TEXT 
        ? `
        <p style="${indentStyle} margin-bottom: 0px; margin-top: 5px;"><b>Nguyên nhân:</b></p>
        <p style="${indentStyle} margin-bottom: 8px; margin-top: 0px;">${formData.NGUYEN_NHAN_TEXT}.</p>
        ` 
        : "";

    const bddcCauseText = formData.NGUYEN_NHAN_BDDC || DEFAULT_BDDC_CAUSE;
    
    // Tự động điều chỉnh đại từ nhân xưng trong đoạn kiến nghị
    const daiTuNhanXung = (formData.OWNERS && formData.OWNERS.length > 1) ? "các ông/bà" : `${formData.HO.toLowerCase()} ${toTitleCase(formData.TEN_CHU)}`;

    const bddcSection = formData.HIEN_THI_BIEN_DONG_BDDC 
        ? `
        <p style="${indentStyle} margin-bottom: 5px; font-weight: bold;">Biến động so với BĐĐC 2024. Như sau:</p>
        <p style="${indentStyle} margin-bottom: 5px;">Diện tích đo đạc theo hiện trạng là <b>${formData.DT_MOI} m²</b>, ${diffBddcText}. Cụ thể:</p>
        <div style="margin-bottom: 8px;">
            ${boundaryHtmlBDDC || `<p style="${indentStyle} font-style: italic; color: #666;">(Chưa nhập biến động so với BĐĐC 2024)</p>`}
        </div>
        <p style="${indentStyle} margin-bottom: 5px;"><b>Nguyên nhân:</b></p>
        <p style="${indentStyle} margin-bottom: 5px;">${bddcCauseText}.</p>
        <p style="${indentStyle} margin-bottom: 5px;">Nay chủ sử dụng đất và các chủ sử dụng đất giáp ranh tiến hành cắm mốc xác định lại ranh giới theo hiện trạng, cam kết không tranh chấp.</p>
        <p style="${indentStyle} margin-bottom: 12px;">Do đó, Kiến nghị Văn phòng Đăng ký đất đai thành phố Đồng Nai – Chi nhánh Hớn Quản cấp đổi GCNQSDĐ cho ${daiTuNhanXung}, đồng thời chỉnh lý bản đồ địa chính năm 2024 theo hiện trạng sử dụng đất thực tế.</p>
        `
        : "";

    const textKiemTraHienTrang = formData.HIEN_THI_BIEN_DONG_BDDC
        ? "Kiểm tra hiện trạng thực tế có biến động so với BĐĐC 2024 và GCNQSD đất."
        : "Kiểm tra hiện trạng thực tế trùng khớp với BĐĐC 2024.";

    const textKetLuanRanhGioi = formData.HIEN_THI_BIEN_DONG_BDDC
        ? "Ranh giới, mốc giới tại thời điểm sử dụng đất trùng khớp với kết quả đo đạc hiện trạng."
        : "Ranh giới, mốc giới tại thời điểm sử dụng đất trùng khớp với kết quả đo đạc bản đồ địa chính năm 2024.";

    const camKetNghiaVu = dtMoi > dtCu 
      ? `<p style="${indentStyle} margin-top: 8px;"><b>Cam kết thực hiện đầy đủ nghĩa vụ tài chính theo quy định.</b></p>` 
      : "";
    
    // Câu chênh lệch diện tích: Sử dụng đại từ nhân xưng phù hợp
    const diffClause = dtCu !== dtMoi 
      ? `<p style="${indentStyle} margin-top: 10px;">“Đối với phần diện tích ${dtMoi > dtCu ? 'tăng' : 'giảm'} ${absDiff} m² không phải do chuyển nhượng, tặng cho.”</p>` 
      : "";

    const yKienGiapRanhText = formData.HIEN_THI_Y_KIEN_GIAP_RANH 
      ? `
        <p style="${indentStyle} margin-bottom: 5px; margin-top: 12px;"><b>Ý kiến của các chủ sử dụng đất liên ranh:</b></p>
        <p style="${indentStyle} margin-bottom: 5px;">Ranh giới, mốc giới được xác định theo hiện trạng ${formData.LOAI_COC}. Cam kết không tranh chấp, khiếu nại.</p>
        ${dtCu !== dtMoi ? `<p style="${indentStyle} margin-bottom: 5px;">Đối với phần diện tích ${dtMoi > dtCu ? 'tăng' : 'giảm'} ${absDiff} m² thửa đất của ${daiTuNhanXung} không phải do chuyển nhượng, tặng cho.</p>` : ""}
      ` : "";

    let titleSectionII = "II. Đại Diện Phòng Kinh Tế - Hạ Tầng Và Đô Thị:";
    let footerSectionII = "Đại diện\nPhòng Kinh tế - Hạ tầng và Đô thị";

    if (formData.LOAI_DAI_DIEN === 'NGUOI_DAN_DAC') {
        titleSectionII = "II. Người dẫn đạc:";
        footerSectionII = "Người dẫn đạc";
    } else {
        titleSectionII = `II. Đại diện Phòng Kinh tế - Hạ tầng và Đô thị ${formData.PHUONG}:`;
        footerSectionII = `Đại diện\nPhòng Kinh tế - Hạ tầng và Đô thị`;
    }

    const yKienPhongKTText = formData.HIEN_THI_PHONG_KT
      ? `
        <p style="${indentStyle} margin-bottom: 5px; margin-top: 15px;"><b>Ý kiến của ${formData.LOAI_DAI_DIEN === 'NGUOI_DAN_DAC' ? 'người dẫn đạc' : 'đại diện Phòng Kinh tế - Hạ tầng và Đô thị'}:</b></p>
        <p style="${indentStyle} margin-bottom: 2px;">………………………………………………………………………………………..</p>
        <p style="${indentStyle} margin-bottom: 2px;">………………………………………………………………………………………..</p>
        <p style="${indentStyle} margin-bottom: 2px;">………………………………………………………………………………………..</p>
        <p style="${indentStyle} margin-bottom: 2px;">………………………………………………………………………………………..</p>
        <p style="${indentStyle} margin-bottom: 2px;">………………………………………………………………………………………..</p>
      ` : "";

    const formattedNgayCap = formData.NGAY_CAP ? formData.NGAY_CAP.split('-').reverse().join('/') : '...';
    
    const dtOdtNum = parseFloat(formData.DT_ODT) || 0;
    const phuongLower = formData.PHUONG.toLowerCase();
    let areaBreakdown = "";
    if (dtOdtNum > 0) {
        let odtType = (phuongLower.includes("minh hưng") || phuongLower.includes("chơn thành")) ? "Đất ở tại đô thị" : "Đất ở tại nông thôn";
        areaBreakdown = `(trong đó: ${odtType}: ${formatAreaLabel(formData.DT_ODT)}; Đất nông nghiệp: ${formatAreaLabel(formData.DT_CLN)})`;
    } else {
        areaBreakdown = `(trong đó: Đất nông nghiệp: ${formatAreaLabel(formData.DT_CLN)})`;
    }

    const phongKTSection = formData.HIEN_THI_PHONG_KT 
      ? `
        <p style="margin-bottom: 5px;"><b>${titleSectionII}</b></p>
        <p style="margin-bottom: 5px;">1. ........................................................... - Chức vụ: ...........................................</p>
        <p style="margin-bottom: 10px;">2. ........................................................... - Chức vụ: ...........................................</p>
      ` : "";

    const soHoaSection = `
        <div style="margin-top: 40px; page-break-before: always;">
            <p style="text-align: center; font-weight: bold; font-size: 14pt; margin-bottom: 10px;">SƠ HỌA RANH GIỚI, MỐC GIỚI THỬA ĐẤT</p>
            
            <table border="1" cellspacing="0" cellpadding="10" style="width: 100%; border-collapse: collapse; border: 1.5pt solid black;">
                <tr>
                    <td style="height: ${isForWord ? '560pt' : '750px'}; vertical-align: top; padding: 15pt;">
                        
                        <div>
                            ${formData.HIEN_THI_CAU_LUU_Y ? `
                            <p style="text-align: center; font-weight: bold; font-size: 11pt; line-height: 1.3; margin: 0 0 10pt 0;">
                                (Việc thể hiện biến động giữa GCNQSD đất và hiện trạng sử dụng đất chỉ mang tính chất tham khảo, do GCNQSD đất được đo đạc và cấp theo phương pháp đo đạc độc lập, không theo hệ tọa độ hiện hành)
                            </p>
                            ` : ''}
                        </div>

                        <div style="height: ${formData.HIEN_THI_CAU_LUU_Y ? '450pt' : '500pt'}; width: 100%;"></div>

                        <div style="text-align: center; font-size: 11pt; font-style: italic; line-height: 1.4; margin-top: 10pt;">
                            <p style="margin: 0;">Thể hiện rõ ranh giới thay đổi giữa ranh hiện trạng (nét liền) và ranh theo hồ sơ pháp lý (nét đứt).</p>
                            <p style="margin: 0;">Trường hợp sơ họa thửa đất không đủ thể hiện trong biên bản thì in đính kèm và đóng dấu giáp lai</p>
                        </div>

                    </td>
                </tr>
            </table>
        </div>
    `;

    const signatureTable = `
        <table style="width: 100%; margin-top: 40px; text-align: center; border-collapse: collapse;">
            <tr style="font-weight: bold; vertical-align: top;">
                <td style="width: 50%; padding-bottom: 80px;">Chủ sử dụng đất</td>
                <td style="width: 50%; padding-bottom: 80px;">Cán bộ đo đạc</td>
            </tr>
            <tr style="font-weight: bold; vertical-align: bottom;">
                <td style="width: 50%;"></td>
                <td style="width: 50%;">${toTitleCase(currentUser.name)}</td>
            </tr>
            <tr><td colspan="2" style="height: 40px;"></td></tr>
            <tr style="font-weight: bold; vertical-align: top;">
                <td style="width: 50%; padding-bottom: 80px;">
                    ${formData.HIEN_THI_Y_KIEN_GIAP_RANH ? 'Chủ sử dụng đất giáp ranh' : ''}
                </td>
                <td style="width: 50%; padding-bottom: 80px;">
                    ${formData.HIEN_THI_PHONG_KT ? `
                        <div style="line-height: 1.2;">
                            ${footerSectionII.replace(/\n/g, '<br>')}
                        </div>
                    ` : ''}
                </td>
            </tr>
        </table>
    `;

    const lineMottoHtml = `
        <table style="width: 185px; margin: 0 auto; border-collapse: collapse; border: none;">
            <tr><td style="border-bottom: 1px solid black; height: 1px;"></td></tr>
        </table>
    `;

    const gioLap = formData.GIO_LAP || '...';
    const phutLap = formData.PHUT_LAP || '...';
    const ngayLap = formData.NGAY_LAP || '...';
    const thangLap = formData.THANG_LAP || '...';
    const namLap = formData.NAM_LAP || '...';

    // --- CẬP NHẬT LOGIC TÍNH GIỜ KẾT THÚC ---
    let endGio = '...';
    let endPhut = phutLap; // Phút giữ nguyên
    
    if (formData.GIO_LAP) {
        let g = parseInt(formData.GIO_LAP, 10);
        if (!isNaN(g)) {
            // Cộng 1 giờ, nếu qua 24 thì reset về 0 (đơn giản hóa)
            g = (g + 1) % 24; 
            endGio = g.toString().padStart(2, '0');
        }
    }
    // ------------------------------------------

    const dienTichHienThi = formData.HIEN_THI_BIEN_DONG_BDDC ? formData.DT_BDDC_2024 : formData.DT_MOI;
    const textDienTich = `, diện tích: <b>${dienTichHienThi} m²</b>`;

    const textMap2024 = `Theo bản đồ địa chính mới được Sở Tài nguyên và Môi trường ký duyệt ngày 10/10/2024 thuộc thửa đất số <b>${formData.SO_THUA_MOI || '...'}</b>, tờ bản đồ số <b>${formData.SO_TO_MOI || '...'}</b>${textDienTich}.`;
    const textCV106 = `Theo Công văn số 106/VPĐK-KTĐC ngày 08/07/2025 của Văn phòng Đăng ký Đất đai thành phố Đồng Nai thuộc thửa đất số <b>${formData.SO_THUA_MOI || '...'}</b>, tờ bản đồ số <b>${formData.SO_TO_106}</b>${textDienTich}.`;

    let canCuBanDoHtml = `<p style="${indentStyle} margin-bottom: 8px;">${textMap2024}</p>`;
    
    if (formData.SO_TO_106) {
         canCuBanDoHtml += `<p style="${indentStyle} margin-bottom: 8px;">${textCV106}</p>`;
    }

    return `
      <div style="font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.3; color: black; text-align: justify; width: 100%;">
        
        <div style="text-align: center; font-weight: bold; margin-bottom: 0px; font-size: 11pt;">
            <p style="margin: 0;">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p style="margin: 0;">Độc lập - Tự do - Hạnh phúc</p>
            ${lineMottoHtml}
        </div>

        <p style="margin: 0; line-height: 1.5;">&nbsp;</p>

        <div style="text-align: center; font-weight: bold; margin: 15px 0 25px 0;">
            <div style="font-size: 15pt; margin-bottom: 5px;">BIÊN BẢN LÀM VIỆC</div>
            <div style="font-size: 13pt; font-weight: normal; font-style: italic;">(V/v đo đạc, xác minh hiện trạng sử dụng đất)</div>
        </div>

        <p style="margin-bottom: 8px;">Hôm nay, vào lúc ${gioLap} giờ ${phutLap} phút, ngày ${ngayLap} tháng ${thangLap} năm ${namLap},</p>
        <p style="margin-bottom: 8px;">Tại khu đất của:</p>
        ${ownersHtmlFull}
        
        <p style="margin-bottom: 5px;"><b>A. THÀNH PHẦN GỒM:</b></p>
        <p style="margin-bottom: 5px;"><b>I. Đại diện Văn phòng Đăng ký đất đai thành phố Đồng Nai – Chi nhánh Hớn Quản:</b></p>
        <p style="margin-bottom: 5px;">1. ........................................................... - Chức vụ: ...........................................</p>
        <p style="margin-bottom: 10px;">2. Ông: <b>${toTitleCase(currentUser.name)}</b> - Chức vụ: Nhân viên</p>

        ${phongKTSection}

        <p style="margin-bottom: 5px;"><b>${formData.HIEN_THI_PHONG_KT ? 'III' : 'II'}. Đại diện chủ sử dụng đất:</b></p>
        ${ownersHtmlSimple}
        
        <p style="margin-bottom: 5px;">Và các hộ sử dụng đất liền kề:</p>
        <p style="margin-bottom: 15px;">${formData.HO_GIAP_RANH}</p>

        <p style="margin-bottom: 8px;"><b>B. NỘI DUNG:</b></p>
        <p style="${indentStyle} margin-bottom: 8px;">Tiến hành đo đạc, kiểm tra, xác minh ranh giới, mốc giới thửa đất ngoài thực địa đối với khu đất:</p>
        <p style="${indentStyle} margin-bottom: 8px;">Thửa đất số <b>${formData.SO_THUA_MOI || '...'}</b>, tờ bản đồ số <b>${toBanDoMoTa}</b>, tọa lạc tại ${formData.DIA_CHI_THUA}, ${formData.PHUONG}, tỉnh Bình Phước.</p>

        <p style="${indentStyle} margin-bottom: 8px;"><b>1. Về hồ sơ thửa đất:</b></p>
        <p style="${indentStyle} margin-bottom: 8px;">Khu đất đã được cấp GCNQSDĐ số phát hành <b>${formData.SO_GCN}</b> vào sổ cấp GCN số <b>${formData.SO_VAO_SO}</b> do <b>${formData.DV_CAP_GCN}</b> cấp ngày <b>${formattedNgayCap}</b>, thửa đất số ${formData.SO_THUA_CU}, tờ bản đồ số ${formData.SO_TO_CU}, diện tích ${formData.DT_CU} m² ${areaBreakdown}.</p>
        
        ${canCuBanDoHtml}

        <p style="${indentStyle} margin-bottom: 8px;"><b>2. Kết quả đo đạc, kiểm tra, xác minh hiện trạng sử dụng đất:</b></p>
        <p style="${indentStyle} margin-bottom: 8px;">${textKiemTraHienTrang}</p>
        <p style="${indentStyle} margin-bottom: 8px;">Hiện trạng sử dụng đất: ${formData.HIEN_TRANG}, ranh giới mốc giới được xác định bằng ${formData.LOAI_COC}.</p>
        
        ${bddcSection}

        <p style="${indentStyle} margin-bottom: 5px; font-weight: bold;">Biến động so với GCN. Như sau:</p>
        <p style="${indentStyle} margin-bottom: 5px;">Diện tích đo đạc theo hiện trạng là <b>${formData.DT_MOI} m²</b>, ${diffMainText}. Cụ thể:</p>

        <div style="margin-bottom: 8px;">
            ${boundaryHtmlGCN || `<p style="${indentStyle} font-style: italic; color: #666;">(Chưa nhập biến động so với GCN)</p>`}
        </div>

        ${nguyenNhanSection}

        <p style="${indentStyle} margin-bottom: 8px;">${textKetLuanRanhGioi}</p>
        <p style="${indentStyle} margin-bottom: 8px;">Tại thời điểm kiểm tra ranh giới, mốc giới sử dụng ổn định, không tranh chấp.</p>
        <p style="${indentStyle} margin-bottom: 8px;">Thửa đất không thuộc trường hợp ngăn chặn, tranh chấp.</p>
        <p style="${indentStyle} margin-bottom: 12px;">Ranh giới thửa đất không thay đổi so với ranh tại thời điểm cấp Giấy nhận quyền sử dụng đất (việc thay đổi diện tích, kích thước các cạnh không phải do nhận chuyển quyền, do lấn chiếm,...).</p>

        <p style="${indentStyle} margin-bottom: 5px;"><b>Ý kiến của chủ sử dụng đất:</b></p>
        <p style="${indentStyle} margin-bottom: 5px;">Ranh giới mốc giới thửa đất của gia đình tôi sử dụng ổn định, không tranh chấp với các hộ giáp ranh. Đề nghị điều chỉnh GCNQSD đất của gia đình theo đúng hiện trạng sử dụng đất, không có khiếu nại, khiếu kiện có liên quan đến thửa đất nói trên.</p>
        ${diffClause}
        ${camKetNghiaVu}

        ${yKienGiapRanhText}

        ${yKienPhongKTText}

        <p style="${indentStyle} margin-top: 15px;">Biên bản kết thúc vào lúc ${endGio} giờ ${endPhut} phút cùng ngày và được lập thành 02 bản, có nội dung như nhau./.</p>

        ${signatureTable}

        ${soHoaSection}
      </div>
    `;
  };

  const handleExportWord = async () => {
    setIsProcessing(true);
    await handleSaveRecord(true);

    const content = generateContent(true);
    
    const cleanName = formData.TEN_CHU.replace(/\s+/g, '_') || 'Chua_Ten';
    const toHienThi = formData.SO_TO_106 || formData.SO_TO_MOI || '...';
    const fileName = `BB_${cleanName}_${toHienThi}_${formData.SO_THUA_MOI || 'Chua_Thua'}.doc`;

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
          body { font-family: "Times New Roman", serif; font-size: 13pt; text-align: justify; }
          p { margin: 0; margin-bottom: 2px; line-height: 1.3; }
          table { border-collapse: collapse; }
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
    
    setIsProcessing(false);
  };

  const handleOpenFile = async () => {
      if (exportedFilePath && window.electronAPI && window.electronAPI.openFilePath) {
          await window.electronAPI.openFilePath(exportedFilePath);
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] overflow-hidden">
        {/* SUB-HEADER TABS */}
        <div className="flex items-center gap-2 px-4 pt-2 border-b border-gray-200 bg-white shadow-sm shrink-0 z-20">
            <button 
                onClick={() => { setMode('create'); handleResetForm(); }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${mode === 'create' && !editingId ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                <PlusCircle size={16} /> Soạn biên bản mới
            </button>
            <button 
                onClick={() => { setMode('list'); handleResetForm(); loadRecords(); }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${mode === 'list' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
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

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden relative">
            {mode === 'create' ? (
                <div className="flex flex-col lg:flex-row h-full overflow-hidden">
                    <div className="flex-none lg:w-[500px] border-r border-gray-200 bg-gray-50 flex flex-col h-full">
                        <div className="p-3 bg-white border-b border-gray-200 flex gap-2 items-center shrink-0">
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
                        <BienBanForm 
                            formData={formData} 
                            setFormData={setFormData}
                            boundaryChanges={boundaryChanges}
                            setBoundaryChanges={setBoundaryChanges}
                            boundaryChangesBDDC={boundaryChangesBDDC}
                            setBoundaryChangesBDDC={setBoundaryChangesBDDC}
                            onResetFile={resetFile}
                            issuingAuthorities={issuingAuthorities}
                            onOpenConfig={openAuthorityConfig}
                        />
                        <div className="p-4 bg-white border-t border-gray-200 flex justify-end">
                            <button onClick={() => handleSaveRecord(false)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-sm">
                                <Save size={18} /> Lưu Dữ Liệu
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col min-w-0 bg-slate-300">
                        <div className="bg-white border-b border-gray-200 p-2 flex justify-end gap-2 shrink-0 z-20">
                            {exportedFilePath && (
                                <button onClick={handleOpenFile} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200 flex items-center gap-1 animate-bounce">
                                    <ExternalLink size={14} /> Mở File
                                </button>
                            )}
                            <button onClick={handleExportWord} disabled={isProcessing} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
                                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Xuất Word
                            </button>
                        </div>

                        <BienBanPreview 
                            generateContent={generateContent}
                            isAreaMismatch={isAreaMismatch}
                            isAreaMismatchBDDC={isAreaMismatchBDDC}
                        />
                    </div>
                </div>
            ) : (
                <div className="h-full p-4">
                    <BienBanList 
                        data={savedRecords}
                        onEdit={handleEditFromList}
                        onPrint={handleEditFromList} 
                        onDelete={handleDeleteRecord}
                        onRefresh={loadRecords}
                    />
                </div>
            )}
        </div>

        {/* MODAL CONFIG ISSUING AUTHORITIES */}
        {isConfigAuthorities && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-fade-in-up flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                        <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                            <Settings className="text-blue-600" size={18} /> Cấu hình Cơ quan cấp GCN
                        </h3>
                        <button onClick={() => setIsConfigAuthorities(false)}><X size={20} className="text-gray-400 hover:text-red-500"/></button>
                    </div>
                    
                    <div className="p-4 overflow-y-auto flex-1 bg-gray-50 space-y-3">
                        {tempAuthorities.map((auth, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <input 
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                    placeholder="Nhập tên cơ quan..." 
                                    value={auth} 
                                    onChange={e => updateTempAuthority(idx, e.target.value)} 
                                />
                                <button 
                                    onClick={() => removeTempAuthority(idx)} 
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Xóa"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        ))}
                        <button 
                            onClick={addTempAuthority} 
                            className="w-full border-2 border-dashed border-blue-200 text-blue-600 py-2 rounded-lg text-sm font-bold hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={16} /> Thêm cơ quan
                        </button>
                    </div>

                    <div className="p-4 border-t bg-white flex justify-end gap-3 rounded-b-xl">
                        <button onClick={() => setIsConfigAuthorities(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium text-sm">Hủy</button>
                        <button onClick={saveAuthorityConfig} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm shadow-md">Lưu Thay Đổi</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default SoanBienBanTab;
