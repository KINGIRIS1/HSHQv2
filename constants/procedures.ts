export interface ProcedureDefinition {
  id: string;
  name: string;
  shortName: string;
  module: 'luutru' | 'dodac' | 'dangky' | 'khac';
  defaultDeadline: number;
  price?: number;
  prefixes: string[];
  keywords: string[];
}

export const PROCEDURE_CATALOG: ProcedureDefinition[] = [
  // ==========================================
  // MODULE 1: LƯU TRỮ
  // ==========================================
  {
    id: '1.1',
    name: '1.1 Sao lục hồ sơ',
    shortName: '1.1 Sao lục',
    module: 'luutru',
    defaultDeadline: 10,
    prefixes: ['1.1', 'SL', 'SAOLUC', 'CCDL'],
    keywords: ['sao lục', 'cung cấp tài liệu', 'cung cấp dữ liệu', 'cc dl đđ']
  },
  {
    id: '1.2',
    name: '1.2 Công văn',
    shortName: '1.2 Công văn',
    module: 'luutru',
    defaultDeadline: 10,
    prefixes: ['1.2', 'CV', 'CONGVAN'],
    keywords: ['công văn']
  },

  // ==========================================
  // MODULE 2: ĐO ĐẠC
  // ==========================================
  {
    id: '2.1',
    name: '2.1 Trích lục',
    shortName: '2.1 Trích lục',
    module: 'dodac',
    defaultDeadline: 10,
    prefixes: ['2.1', 'TL', 'TRICHLUC', 'TL-'],
    keywords: ['trích lục', 'quy hoạch', 'trích lục qh']
  },
  {
    id: '2.2',
    name: '2.2 Trích đo',
    shortName: '2.2 Trích đo',
    module: 'dodac',
    defaultDeadline: 30,
    prefixes: ['2.2', 'TD', 'TRICHDO', 'TD-', 'YC', 'YC-', 'YCDD', 'YCDD-'],
    keywords: ['trích đo', 'yêu cầu đo đạc', 'yêu cầu']
  },
  {
    id: '2.3',
    name: '2.3 Duyệt đơn & Cung cấp số thửa',
    shortName: '2.3 DĐ & CC số thửa',
    module: 'dodac',
    defaultDeadline: 12,
    prefixes: ['2.3', '2.6', 'DD', 'SOTHUA', 'DD-'],
    keywords: ['duyệt đơn', 'cung cấp số thửa', 'dđ & cc', 'số thửa', 'cập nhật số thửa', 'cập nhập số thửa']
  },
  {
    id: '2.4',
    name: '2.4 Trích đo Cắm mốc',
    shortName: '2.4 Cắm mốc',
    module: 'dodac',
    defaultDeadline: 30,
    prefixes: ['2.4', 'CM', 'CAMMOC', 'CM-'],
    keywords: ['cắm mốc', 'trích đo cắm mốc']
  },
  {
    id: '2.5',
    name: '2.5 Trích đo Tách - Hợp thửa',
    shortName: '2.5 Tách-Hợp thửa',
    module: 'dodac',
    defaultDeadline: 30,
    prefixes: ['2.5', 'TD-TT', 'TD-HT', 'TD-TÁCH'],
    keywords: ['trích đo tách', 'trích đo tách - hợp thửa', 'tách hợp thửa đo đạc']
  },

  // ==========================================
  // MODULE 3: ĐĂNG KÝ ĐẤT ĐAI
  // ==========================================
  {
    id: '3.1.1',
    name: '3.1.1 ĐKBĐ Chuyển nhượng, Tặng cho, Thừa kế QSDĐ, QSH tài sản',
    shortName: '3.1.1 Chuyển quyền',
    module: 'dangky',
    defaultDeadline: 13,
    prefixes: ['3.1.1', 'CN', 'TA', 'TK', 'CQ'],
    keywords: ['chuyển nhượng', 'tặng cho', 'thừa kế', 'chuyển quyền', 'qsdđ', 'qsh tài sản']
  },
  {
    id: '3.1.2',
    name: '3.1.2 ĐKBĐ theo thỏa thuận vợ chồng, thỏa thuận phân chia của hộ gia đình',
    shortName: '3.1.2 Phân chia quyền',
    module: 'dangky',
    defaultDeadline: 13,
    prefixes: ['3.1.2', 'TT', 'PCQ'],
    keywords: ['thỏa thuận', 'thỏa thuận vợ chồng', 'phân chia', 'hộ gia đình', 'phân chia quyền']
  },
  {
    id: '3.1.3',
    name: '3.1.3 ĐKBĐ theo Bản án Tòa án, Quyết định Thi hành án dân sự',
    shortName: '3.1.3 Chuyển quyền theo B/A/QĐ',
    module: 'dangky',
    defaultDeadline: 13,
    prefixes: ['3.1.3', 'QĐ-TA-THA', 'BẢN ÁN', 'THI HÀNH ÁN'],
    keywords: ['bản án', 'tòa án', 'thi hành án', 'quyết định thi hành án']
  },
  {
    id: '3.2.1',
    name: '3.2.1 Cấp đổi GCN (ố nhòe, rách nát, thêm tên vợ/chồng, không đổi diện tích)',
    shortName: '3.2.1 Cấp đổi',
    module: 'dangky',
    defaultDeadline: 10,
    prefixes: ['3.2.1', 'CD'],
    keywords: ['cấp đổi', 'ố nhòe', 'rách nát', 'thêm tên', 'không đổi diện tích']
  },
  {
    id: '3.2.2',
    name: '3.2.2 Cấp đổi GCN do đo đạc lập bản đồ chính quy (có thay đổi kích thước/diện tích)',
    shortName: '3.2.2 Cấp đổi (có thuế)',
    module: 'dangky',
    defaultDeadline: 15,
    prefixes: ['3.2.2', 'CDT'],
    keywords: ['cấp đổi (có thuế)', 'cấp đổi có thuế', 'bản đồ chính quy', 'thay đổi kích thước', 'thay đổi diện tích']
  },
  {
    id: '3.3.1',
    name: '3.3.1 Cấp lại Giấy chứng nhận do bị mất',
    shortName: '3.3.1 Cấp lại',
    module: 'dangky',
    defaultDeadline: 10,
    prefixes: ['3.3.1', 'CL'],
    keywords: ['cấp lại', 'bị mất', 'mất gcn', 'mất sổ']
  },
  {
    id: '3.3.2',
    name: '3.3.2 Cấp lại Giấy chứng nhận do bị mất (có thay đổi kích thước/diện tích hoặc đồng thời...)',
    shortName: '3.3.2 Cấp lại (có thuế)',
    module: 'dangky',
    defaultDeadline: 15,
    prefixes: ['3.3.2', 'CLT'],
    keywords: ['cấp lại (có thuế)', 'cấp lại có thuế', 'cấp lại thay đổi diện tích']
  },
  {
    id: '3.4.1',
    name: '3.4.1 Tách thửa đất hoặc Hợp thửa đất không đổi người sử dụng đất',
    shortName: '3.4.1 Tách - hợp thửa',
    module: 'dangky',
    defaultDeadline: 17,
    prefixes: ['3.4.1', 'DK-TT-HT', 'DK-TT', 'DK-HT', 'TÁCH-HỢP'],
    keywords: ['tách thửa', 'hợp thửa', 'tách - hợp thửa', 'không đổi người sử dụng đất']
  },
  {
    id: '3.4.2',
    name: '3.4.2 Tách thửa đất đồng thời thực hiện thủ tục Chuyển quyền',
    shortName: '3.4.2 Tách thửa chuyển quyền',
    module: 'dangky',
    defaultDeadline: 17,
    prefixes: ['3.4.2', 'TT-CQ', 'DK-TTCQ'],
    keywords: ['tách thửa đồng thời chuyển quyền', 'tách thửa chuyển quyền', 'tách chuyển quyền']
  },
  {
    id: '3.5.1',
    name: '3.5.1 Xác nhận tiếp tục sử dụng đất nông nghiệp khi hết hạn',
    shortName: '3.5.1 Gia hạn',
    module: 'dangky',
    defaultDeadline: 12,
    prefixes: ['3.5.1', 'GH'],
    keywords: ['gia hạn', 'tiếp tục sử dụng đất', 'hết hạn', 'đất nông nghiệp']
  },
  {
    id: '3.6.1',
    name: '3.6.1 ĐKBĐ chuyển mục đích sử dụng đất không phải xin phép',
    shortName: '3.6.1 Chuyển mục đích',
    module: 'dangky',
    defaultDeadline: 7,
    prefixes: ['3.6.1', 'CMD'],
    keywords: ['chuyển mục đích', 'không phải xin phép']
  },
  {
    id: '3.7.1',
    name: '3.7.1 Đính chính Giấy chứng nhận đã cấp có sai sót (trong giai đoạn ĐKBĐ)',
    shortName: '3.7.1 Đính chính',
    module: 'dangky',
    defaultDeadline: 7,
    prefixes: ['3.7.1', 'DC'],
    keywords: ['đính chính', 'sai sót']
  },
  {
    id: '3.7.2',
    name: '3.7.2 ĐKBĐ thay đổi thông tin cá nhân (CCCD, Họ tên), thay đổi số hiệu/địa chỉ thửa',
    shortName: '3.7.2 ĐKBĐ đổi thông tin',
    module: 'dangky',
    defaultDeadline: 7,
    prefixes: ['3.7.2', 'ĐKBĐ', 'DKBD', 'DOI-TT'],
    keywords: ['thay đổi thông tin cá nhân', 'thay đổi số hiệu', 'thay đổi địa chỉ thửa', 'đổi cccd', 'đổi họ tên', 'đổi số nhà']
  },
  {
    id: '3.8.1',
    name: '3.8.1 Đăng ký GDBD (Giao dịch bảo đảm / Thế chấp)',
    shortName: '3.8.1 Đăng ký GDBD',
    module: 'dangky',
    defaultDeadline: 3,
    prefixes: ['3.8.1', 'GDBD'],
    keywords: ['đăng ký gdbd', 'thế chấp', 'giao dịch bảo đảm', 'đăng ký thế chấp']
  },
  {
    id: '3.8.2',
    name: '3.8.2 Xóa ĐK GDBD (Xóa thế chấp)',
    shortName: '3.8.2 Xóa ĐK GDBD',
    module: 'dangky',
    defaultDeadline: 1,
    prefixes: ['3.8.2', 'XGDBD', 'XTC'],
    keywords: ['xóa đk gdbd', 'xóa thế chấp', 'xóa gdbd']
  },
  {
    id: '3.9.9',
    name: '3.9.9 Khác',
    shortName: '3.9.9 Khác',
    module: 'dangky',
    defaultDeadline: 10,
    prefixes: ['3.9.9'],
    keywords: ['khác']
  },

  // ==========================================
  // KHÁC / LEGACY
  // ==========================================
  {
    id: 'CMD',
    name: 'CMD',
    shortName: 'CMD',
    module: 'khac',
    defaultDeadline: 10,
    prefixes: ['CMD'],
    keywords: ['cmd']
  },
  {
    id: 'THA',
    name: 'Thi hành án',
    shortName: 'Thi hành án',
    module: 'khac',
    defaultDeadline: 10,
    prefixes: ['THA'],
    keywords: ['thi hành án']
  },
  {
    id: 'TA',
    name: 'Tòa án',
    shortName: 'Tòa án',
    module: 'khac',
    defaultDeadline: 10,
    prefixes: ['TA'],
    keywords: ['tòa án']
  }
];

// Map lookup by Procedure ID
export const PROCEDURE_MAP_BY_ID: Record<string, ProcedureDefinition> = PROCEDURE_CATALOG.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<string, ProcedureDefinition>
);

// Derived list of basic procedure names
export const RECORD_TYPES: string[] = PROCEDURE_CATALOG
  .filter(p => p.module !== 'khac')
  .map(p => p.shortName);

// Derived extended record types list
export const EXTENDED_RECORD_TYPES: string[] = PROCEDURE_CATALOG.map(p => p.shortName);

// Derived per-module procedure lists
export const RECORD_TYPES_LuuTru = PROCEDURE_CATALOG
  .filter(p => p.module === 'luutru')
  .map(p => p.shortName);

export const RECORD_TYPES_DoDac = PROCEDURE_CATALOG
  .filter(p => p.module === 'dodac')
  .map(p => p.shortName);

export const DANG_KY_RECORD_TYPES = PROCEDURE_CATALOG
  .filter(p => p.module === 'dangky')
  .map(p => p.shortName);

// Derived Deadline Map for Registration (Đăng ký)
export const DANG_KY_DEADLINE_MAP: Record<string, number> = PROCEDURE_CATALOG
  .filter(p => p.module === 'dangky')
  .reduce((acc, p) => {
    acc[p.name] = p.defaultDeadline;
    acc[p.shortName] = p.defaultDeadline;
    acc[p.id] = p.defaultDeadline;
    return acc;
  }, {
    'Chuyển nhượng': 13,
    'Tặng cho': 13,
    'Thừa kế': 13,
    'Thỏa thuận': 13,
    'Cấp đổi': 10,
    'Cấp đổi (có thuế)': 15,
    'Cấp lại': 10,
    'Cấp lại (có thuế)': 15,
    'Tách - hợp thửa': 17,
    'Tách thửa': 17,
    'Hợp thửa': 17,
    'Tách thửa chuyển quyền': 17,
    'Gia hạn': 7,
    'Chuyển mục đích không xin phép': 7,
    'Chuyển mục đích': 7,
    'Đính chính GCN': 7,
    'Đính chính': 7,
    'ĐKBĐ': 7,
    'Đăng ký GDBD': 3,
    'Thế chấp': 3,
    'Xóa ĐK GDBD': 1,
    'Xóa thế chấp': 1,
    'Cấp mới': 30,
    'Cấp lần đầu': 30,
    'Khác': 10
  } as Record<string, number>);

// Master lookup function by ID
export const getProcedureById = (id?: string | null): ProcedureDefinition | undefined => {
  if (!id) return undefined;
  return PROCEDURE_MAP_BY_ID[id] || PROCEDURE_CATALOG.find(p => p.id === id || p.name === id || p.shortName === id);
};

// Automatic detection logic based 100% on Procedure Code / ID prefix
export const detectProcedureId = (code?: string | null, recordType?: string | null): string => {
  const codeStr = (code || '').trim().toUpperCase();
  const typeStr = (recordType || '').trim().toUpperCase();

  // 1. Check direct match with sorted procedure IDs (longer IDs matched first, e.g. 3.4.1 before 3.4)
  const sortedCatalog = [...PROCEDURE_CATALOG].sort((a, b) => b.id.length - a.id.length);
  for (const proc of sortedCatalog) {
    const pId = proc.id.toUpperCase();
    if (codeStr === pId || codeStr.startsWith(pId + '-') || codeStr.startsWith(pId + '_') || codeStr.startsWith(pId + '.') || codeStr.startsWith(pId + '/') || codeStr.startsWith(pId + ' ') ||
        typeStr === pId || typeStr.startsWith(pId + '-') || typeStr.startsWith(pId + '_') || typeStr.startsWith(pId + '.') || typeStr.startsWith(pId + '/') || typeStr.startsWith(pId + ' ')) {
      return proc.id;
    }
  }

  // 2. Check clear Survey (Đo đạc) prefixes: YC, YCDD, TD, TL, CM, DD
  if (codeStr.startsWith('YC-') || codeStr.startsWith('YCDD-') || codeStr.startsWith('YC_') || codeStr.startsWith('YC/') || /^YC[0-9\-_\/]/.test(codeStr)) {
    return '2.2'; // Yêu cầu đo đạc / Trích đo
  }
  if (codeStr.startsWith('TD-') || codeStr.startsWith('TD_') || codeStr.startsWith('TRICHDO')) return '2.2';
  if (codeStr.startsWith('TL-') || codeStr.startsWith('TL_') || codeStr.startsWith('TRICHLUC')) return '2.1';
  if (codeStr.startsWith('CM-') || codeStr.startsWith('CM_') || codeStr.startsWith('CAMMOC')) return '2.4';
  if (codeStr.startsWith('DD-') || codeStr.startsWith('DD_') || codeStr.startsWith('SOTHUA')) return '2.3';

  // 3. Check clear Archive (Lưu trữ) prefixes: SL, CV, CCDL
  if (codeStr.startsWith('SL-') || codeStr.startsWith('SL_') || codeStr.startsWith('SAOLUC')) return '1.1';
  if (codeStr.startsWith('CV-') || codeStr.startsWith('CV_') || codeStr.startsWith('CONGVAN')) return '1.2';
  if (codeStr.startsWith('CCDL-') || codeStr.startsWith('CCDL_')) return '1.1';

  // 4. Check procedure catalog definition prefixes & keywords
  for (const proc of PROCEDURE_CATALOG) {
    if (codeStr.includes(proc.id) || typeStr.startsWith(proc.id)) {
      return proc.id;
    }
    for (const prefix of proc.prefixes) {
      const pUpper = prefix.toUpperCase();
      if (pUpper.length > 2) {
        if (codeStr.includes(pUpper) || typeStr.includes(pUpper)) {
          return proc.id;
        }
      } else {
        if (codeStr.startsWith(pUpper + '-') || codeStr.startsWith(pUpper + '_') || codeStr.startsWith(pUpper + '.') || codeStr.startsWith(pUpper + '/') ||
            typeStr.startsWith(pUpper + ' ') || typeStr.startsWith(pUpper + '-') || typeStr.startsWith(pUpper + '.')) {
          return proc.id;
        }
      }
    }
    for (const kw of proc.keywords) {
      const kwUpper = kw.toUpperCase();
      if (typeStr.includes(kwUpper)) {
        return proc.id;
      }
    }
  }

  // 5. Fallback check for major module prefixes if no specific sub-ID matched
  if (codeStr.startsWith('1.') || typeStr.startsWith('1.')) return '1.1';
  if (codeStr.startsWith('2.') || typeStr.startsWith('2.')) return '2.1';
  if (codeStr.startsWith('3.') || typeStr.startsWith('3.')) return '3.1.1';

  // 6. Check keywords in text
  if (typeStr.includes('SAO LỤC') || typeStr.includes('CÔNG VĂN') || typeStr.includes('LƯU TRỮ')) return '1.1';
  if (typeStr.includes('TRÍCH ĐO') || typeStr.includes('ĐO ĐẠC') || typeStr.includes('TRÍCH LỤC') || typeStr.includes('CẮM MỐC') || typeStr.includes('SỐ THỬA')) return '2.1';
  if (typeStr.includes('CHUYỂN NHƯỢNG') || typeStr.includes('TẶNG CHO') || typeStr.includes('THỪA KẾ') || typeStr.includes('CẤP ĐỔI') || typeStr.includes('CẤP LẠI') || typeStr.includes('THẾ CHẤP')) return '3.1.1';

  return '3.9.9';
};

// Get short name
export const getShortRecordType = (type?: string | null, code?: string | null): string => {
  if (!type) return '---';
  const procById = getProcedureById(type);
  if (procById) return procById.shortName;

  const detectedId = detectProcedureId(code, type);
  const proc = getProcedureById(detectedId);
  if (proc) return proc.shortName;

  return type;
};

// Get full canonical name
export const getCanonicalRecordType = (type?: string | null, code?: string | null): string => {
  if (!type) return '';
  const procById = getProcedureById(type);
  if (procById) return procById.name;

  const detectedId = detectProcedureId(code, type);
  const proc = getProcedureById(detectedId);
  if (proc) return proc.name;

  return type;
};

// Check if a record type belongs to Archive module (Lưu trữ - Mã 1.x)
export const isArchiveRecordType = (type?: string | null, code?: string | null): boolean => {
  const c = (code || '').trim().toUpperCase();
  const t = (type || '').trim().toUpperCase();

  if (c.startsWith('1.') || t.startsWith('1.')) return true;
  if (c.startsWith('SL-') || c.startsWith('CV-') || c.startsWith('CCDL-')) return true;
  if (t.includes('SAO LỤC') || t.includes('CÔNG VĂN') || t.includes('LƯU TRỮ') || t.includes('CUNG CẤP THÔNG TIN')) return true;

  const procId = detectProcedureId(c, t);
  return procId.startsWith('1.');
};

// Check if a record type belongs to Survey module (Đo đạc - Mã 2.x)
export const isDoDacRecordType = (type?: string | null, code?: string | null): boolean => {
  const c = (code || '').trim().toUpperCase();
  const t = (type || '').trim().toUpperCase();

  if (c.startsWith('2.') || t.startsWith('2.')) return true;
  if (c.startsWith('YC-') || c.startsWith('YCDD-') || c.startsWith('YC_') || c.startsWith('YC/') || /^YC[0-9\-_\/]/.test(c)) return true;
  if (c.startsWith('TL-') || c.startsWith('TD-') || c.startsWith('CM-') || c.startsWith('DD-')) return true;
  if (t.includes('ĐO ĐẠC') || t.includes('TRÍCH ĐO') || t.includes('TRÍCH LỤC') || t.includes('CẮM MỐC') || t.includes('DUYỆT ĐƠN') || t.includes('SỐ THỬA')) return true;

  const procId = detectProcedureId(c, t);
  return procId.startsWith('2.');
};

// Check if a record type belongs to Registration module (Đăng ký - Mã 3.x)
export const isDangKyRecordType = (type?: string | null, code?: string | null): boolean => {
  if (isArchiveRecordType(type, code) || isDoDacRecordType(type, code)) return false;

  const c = (code || '').trim().toUpperCase();
  const t = (type || '').trim().toUpperCase();
  if (c.startsWith('3.') || t.startsWith('3.')) return true;

  const procId = detectProcedureId(c, t);
  return procId.startsWith('3.');
};

export interface AttachedDocItem {
  name: string;
  type: string;
}

// Get default attached documents for registration and other procedures
export const getDefaultDocsForProcedure = (procIdOrType?: string | null, code?: string | null): AttachedDocItem[] => {
  const procId = detectProcedureId(code, procIdOrType) || procIdOrType;
  switch (procId) {
    case '3.1.3':
      return [
        { name: 'Mẫu số 28. Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo quy định', type: 'Bản chính' },
        { name: 'Giấy chứng nhận đã cấp (bản gốc)', type: 'Bản chính' },
        { name: 'Văn bản thỏa thuận về việc thay đổi quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất theo thỏa thuận của các thành viên hộ gia đình hoặc của vợ và chồng', type: 'Bản chính' },
        { name: 'Văn bản về việc đại diện theo quy định của pháp luật về dân sự đối với trường hợp thực hiện thủ tục đăng ký đất đai, tài sản gắn liền với đất thông qua người đại diện', type: 'Bản chính' },
        { name: 'Tờ khai thuế theo quy định của pháp luật thuế hiện hành', type: 'Bản chính' },
        { name: 'Bản trích lục bản đồ địa chính hoặc trích đo bản đồ địa chính', type: 'Bản chính' }
      ];
    case '3.3.2':
      return [
        { name: 'Bản trích lục bản đồ địa chính hoặc trích đo bản đồ địa chính', type: 'Bản chính' },
        { name: 'Mẫu số 28. Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo quy định', type: 'Bản chính' },
        { name: 'Hồ sơ Cung cấp thông tin', type: 'Bản chính' }
      ];
    case '3.5.1':
      return [
        { name: 'Giấy chứng nhận đã cấp (bản gốc)', type: 'Bản chính' },
        { name: 'Mẫu số 31. Đơn xin xác nhận lại thời hạn sử dụng đất nông nghiệp', type: 'Bản chính' }
      ];
    case '3.4.1':
      return [
        { name: 'Mẫu số 29: Đơn đề nghị tách thửa đất, hợp thửa đất theo quy định', type: 'Bản chính' },
        { name: 'Bản vẽ: Bản vẽ tách thửa đất, hợp thửa đất lập theo quy định', type: 'Bản chính' },
        { name: 'Giấy chứng nhận đã cấp (bản gốc)', type: 'Bản chính' }
      ];
    default:
      if (procId && procId.startsWith('3.')) {
        return [
          { name: 'Giấy chứng nhận QSD đất', type: 'Bản chính' },
          { name: 'Đơn đăng ký biến động', type: 'Bản chính' }
        ];
      }
      return [];
  }
};

