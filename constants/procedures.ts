export interface ProcedureDefinition {
  id: string;
  name: string;
  shortName: string;
  module: 'luutru' | 'dodac' | 'dangky' | 'khac';
  defaultDeadline: number;
  price?: number;
  prefixes: string[];
  keywords: string[];
  defaultDocs?: { name: string; type: 'Bản chính' | 'Bản sao'; note?: string }[];
}

export const PROCEDURE_CATALOG: ProcedureDefinition[] = [
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
    keywords: ['chuyển nhượng', 'tặng cho', 'thừa kế', 'chuyển quyền', 'qsdđ', 'qsh tài sản'],
    defaultDocs: [
      { name: 'Mẫu số 28. Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo quy định.', type: 'Bản chính' },
      { name: 'Giấy chứng nhận đã cấp (bản gốc).', type: 'Bản chính' },
      { name: 'Hợp đồng hoặc văn bản về việc chuyển quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất đối với trường hợp chuyển đổi, chuyển nhượng, thừa kế, góp vốn bằng quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất.', type: 'Bản chính' },
      { name: 'Quyết định xử phạt vi phạm hành chính trong lĩnh vực đất đai đối với trường hợp có vi phạm hành chính trong lĩnh vực đất đai và giấy tờ chứng minh đã thực hiện quyết định xử phạt (nếu có)', type: 'Bản chính' },
      { name: 'Tờ khai thuế theo quy định của pháp luật thuế hiện hành', type: 'Bản chính' }
    ]
  },
  {
    id: '3.1.2',
    name: '3.1.2 ĐKBĐ theo thỏa thuận vợ chồng, thỏa thuận phân chia của hộ gia đình',
    shortName: '3.1.2 Phân chia quyền',
    module: 'dangky',
    defaultDeadline: 13,
    prefixes: ['3.1.2', 'TT', 'PCQ'],
    keywords: ['thỏa thuận', 'thỏa thuận vợ chồng', 'phân chia', 'hộ gia đình', 'phân chia quyền'],
    defaultDocs: [
      { name: 'Mẫu số 28. Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo quy định.', type: 'Bản chính' },
      { name: 'Giấy chứng nhận đã cấp (bản gốc).', type: 'Bản chính' },
      { name: 'Hợp đồng hoặc văn bản về việc chuyển quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất đối với trường hợp chuyển đổi, chuyển nhượng, thừa kế, góp vốn bằng quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất.', type: 'Bản chính' },
      { name: 'Quyết định xử phạt vi phạm hành chính trong lĩnh vực đất đai đối với trường hợp có vi phạm hành chính trong lĩnh vực đất đai và giấy tờ chứng minh đã thực hiện quyết định xử phạt (nếu có)', type: 'Bản chính' },
      { name: 'Tờ khai thuế theo quy định của pháp luật thuế hiện hành', type: 'Bản chính' }
    ]
  },
  {
    id: '3.1.3',
    name: '3.1.3 ĐKBĐ theo Bản án Tòa án, Quyết định Thi hành án dân sự',
    shortName: '3.1.3 Chuyển quyền theo B/A/QĐ',
    module: 'dangky',
    defaultDeadline: 13,
    prefixes: ['3.1.3', 'QĐ-TA-THA', 'BẢN ÁN', 'THI HÀNH ÁN'],
    keywords: ['bản án', 'tòa án', 'thi hành án', 'quyết định thi hành án'],
    defaultDocs: [
      { name: 'Mẫu số 28. Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo quy định.', type: 'Bản chính' },
      { name: 'Giấy chứng nhận đã cấp (bản gốc).', type: 'Bản chính' },
      { name: 'Văn bản thỏa thuận về việc thay đổi quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất theo thỏa thuận của các thành viên hộ gia đình hoặc của vợ và chồng.', type: 'Bản chính' },
      { name: 'Văn bản về việc đại diện theo quy định của pháp luật về dân sự đối với trường hợp thực hiện thủ tục đăng ký đất đai, tài sản gắn liền với đất thông qua người đại diện.', type: 'Bản chính' },
      { name: 'Tờ khai thuế theo quy định của pháp luật thuế hiện hành', type: 'Bản chính' },
      { name: 'Bản trích lục bản đồ địa chính hoặc trích đo bản đồ địa chính', type: 'Bản chính' }
    ]
  },
  {
    id: '3.2.1',
    name: '3.2.1 Cấp đổi GCN (ố nhòe, rách nát, thêm tên vợ/chồng, không đổi diện tích)',
    shortName: '3.2.1 Cấp đổi',
    module: 'dangky',
    defaultDeadline: 10,
    prefixes: ['3.2.1', 'CD'],
    keywords: ['cấp đổi', 'ố nhòe', 'rách nát', 'thêm tên', 'không đổi diện tích'],
    defaultDocs: [
      { name: 'Mẫu số 28. Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo quy định.', type: 'Bản chính' },
      { name: 'Giấy chứng nhận đã cấp (bản gốc).', type: 'Bản chính' },
      { name: 'Mảnh trích đo bản đồ địa chính thửa đất (nếu có).', type: 'Bản chính' }
    ]
  },
  {
    id: '3.2.2',
    name: '3.2.2 Cấp đổi GCN do đo đạc lập bản đồ chính quy (có thay đổi kích thước/diện tích)',
    shortName: '3.2.2 Cấp đổi (có thuế)',
    module: 'dangky',
    defaultDeadline: 15,
    prefixes: ['3.2.2', 'CDT'],
    keywords: ['cấp đổi (có thuế)', 'cấp đổi có thuế', 'bản đồ chính quy', 'thay đổi kích thước', 'thay đổi diện tích'],
    defaultDocs: [
      { name: 'Mẫu số 28. Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo quy định.', type: 'Bản chính' },
      { name: 'Giấy chứng nhận đã cấp (bản gốc).', type: 'Bản chính' },
      { name: 'Mảnh trích đo bản đồ địa chính thửa đất (nếu có).', type: 'Bản chính' },
      { name: 'Tờ khai thuế theo quy định hiện hành', type: 'Bản chính' }
    ]
  },
  {
    id: '3.3.1',
    name: '3.3.1 Cấp lại Giấy chứng nhận do bị mất',
    shortName: '3.3.1 Cấp lại',
    module: 'dangky',
    defaultDeadline: 15,
    prefixes: ['3.3.1', 'CL'],
    keywords: ['cấp lại', 'bị mất', 'mất gcn', 'mất sổ'],
    defaultDocs: [
      { name: 'Mảnh trích đo bản đồ địa chính thửa đất đối với trường hợp người sử dụng đất có nhu cầu đo đạc để xác định lại kích thước các cạnh, diện tích của thửa đất.', type: 'Bản chính' },
      { name: 'Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo Mẫu số 18 ban hành kèm theo Nghị định số 151/2025/NĐ-CP.', type: 'Bản chính' },
      { name: 'Văn bản về việc đại diện theo quy định của pháp luật về dân sự đối với trường hợp thực hiện thủ tục đăng ký đất đai, tài sản gắn liền với đất thông qua người đại diện.', type: 'Bản chính' },
      { name: 'Hồ sơ Cung cấp thông tin', type: 'Bản chính' }
    ]
  },
  {
    id: '3.3.2',
    name: '3.3.2 Cấp lại Giấy chứng nhận do bị mất (có thay đổi kích thước/diện tích hoặc đồng thời...)',
    shortName: '3.3.2 Cấp lại (có thuế)',
    module: 'dangky',
    defaultDeadline: 15,
    prefixes: ['3.3.2', 'CLT'],
    keywords: ['cấp lại (có thuế)', 'cấp lại có thuế', 'cấp lại thay đổi diện tích'],
    defaultDocs: [
      { name: 'Mảnh trích đo bản đồ địa chính thửa đất đối với trường hợp người sử dụng đất có nhu cầu đo đạc để xác định lại kích thước các cạnh, diện tích của thửa đất.', type: 'Bản chính' },
      { name: 'Đơn đăng ký biến động đất đai, tài sản gắn liền với đất theo Mẫu số 18 ban hành kèm theo Nghị định số 151/2025/NĐ-CP.', type: 'Bản chính' },
      { name: 'Văn bản về việc đại diện theo quy định của pháp luật về dân sự đối với trường hợp thực hiện thủ tục đăng ký đất đai, tài sản gắn liền với đất thông qua người đại diện.', type: 'Bản chính' },
      { name: 'Hồ sơ Cung cấp thông tin', type: 'Bản chính' }
    ]
  },
  {
    id: '3.4.1',
    name: '3.4.1 Tách thửa đất hoặc Hợp thửa đất không đổi người sử dụng đất',
    shortName: '3.4.1 Tách - hợp thửa',
    module: 'dangky',
    defaultDeadline: 17,
    prefixes: ['3.4.1', 'DK-TT-HT', 'DK-TT', 'DK-HT', 'TÁCH-HỢP'],
    keywords: ['tách thửa', 'hợp thửa', 'tách - hợp thửa', 'không đổi người sử dụng đất'],
    defaultDocs: [
      { name: 'Mẫu số 29. Đơn đề nghị tách thửa đất, hợp thửa đất theo quy định.', type: 'Bản chính' },
      { name: 'Bản vẽ tách thửa đất, hợp thửa đất lập theo quy định.', type: 'Bản chính' },
      { name: 'Giấy chứng nhận đã cấp (bản gốc).', type: 'Bản chính' }
    ]
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
    keywords: ['gia hạn', 'tiếp tục sử dụng đất', 'hết hạn', 'đất nông nghiệp'],
    defaultDocs: [
      { name: 'Giấy chứng nhận đã cấp (bản gốc).', type: 'Bản chính' },
      { name: 'Mẫu số 31. Đơn xin xác nhận lại thời hạn sử dụng đất nông nghiệp.', type: 'Bản chính' }
    ]
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
export const RECORD_TYPES_LuuTru: string[] = ['1.1 Sao lục', '1.2 Công văn', 'Sao lục', 'Công văn'];

export const RECORD_TYPES_DoDac: string[] = [
  'Trích lục',
  'Trích đo',
  'Duyệt đơn & Cung cấp số thửa',
  'Cắm mốc',
  'Tách-Hợp thửa',
  '2.1 Trích lục',
  '2.2 Trích đo',
  '2.3 Duyệt đơn & Cung cấp số thửa',
  '2.4 Cắm mốc',
  '2.5 Tách-Hợp thửa'
];

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
    'Cấp lại': 15,
    'Cấp lại (có thuế)': 15,
    'Tách - hợp thửa': 17,
    'Tách thửa': 17,
    'Hợp thửa': 17,
    'Tách thửa chuyển quyền': 17,
    'Gia hạn': 12,
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

// Automatic detection logic
export const detectProcedureId = (code?: string | null, recordType?: string | null): string => {
  const codeStr = (code || '').toUpperCase().trim();
  const typeStr = (recordType || '').toLowerCase().trim();

  // 1. Direct ID match in code or type
  for (const proc of PROCEDURE_CATALOG) {
    if (codeStr.includes(proc.id) || typeStr.startsWith(proc.id.toLowerCase())) {
      return proc.id;
    }
  }

  // 2. Prefix match in code
  if (codeStr) {
    for (const proc of PROCEDURE_CATALOG) {
      for (const prefix of proc.prefixes) {
        if (codeStr.includes(prefix)) {
          return proc.id;
        }
      }
    }
  }

  // 3. Keyword match in recordType
  if (typeStr) {
    if (typeStr.includes('trích đo') || typeStr.includes('đo đạc')) {
      if (typeStr.includes('tách') || typeStr.includes('hợp')) return '2.5';
      if (typeStr.includes('cắm mốc')) return '2.4';
      if (typeStr.includes('số thửa') || typeStr.includes('duyệt đơn')) return '2.3';
      return '2.2';
    }

    for (const proc of PROCEDURE_CATALOG) {
      for (const kw of proc.keywords) {
        if (typeStr.includes(kw)) {
          return proc.id;
        }
      }
    }
  }

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

// Check if a record type belongs to Archive module (Lưu trữ)
export const isArchiveRecordType = (type?: string | null, code?: string | null): boolean => {
  if (!type && !code) return false;
  const short = getShortRecordType(type, code);
  if (short === '1.1 Sao lục' || short === '1.2 Công văn') return true;
  const tLower = (type || '').toLowerCase();
  const cLower = (code || '').toLowerCase();
  return tLower.includes('1.1') || tLower.includes('sao lục') || tLower.includes('1.2') || tLower.includes('công văn') || tLower.includes('cc dl đđ') || tLower.includes('cung cấp dữ liệu') ||
         cLower.includes('1.1') || cLower.includes('sl-') || cLower.includes('cv-') || cLower.includes('1.2');
};

// Check if a record belongs to Dang Ky (Đăng ký đất đai / Cấp giấy)
export const isDangKyRecordType = (type?: string | null, code?: string | null): boolean => {
  if (!type && !code) return false;
  const detectedId = detectProcedureId(code, type);
  if (detectedId && detectedId.startsWith('3.')) return true;

  const tLower = (type || '').toLowerCase();
  const cLower = (code || '').toLowerCase();

  if (tLower.startsWith('3.') || cLower.startsWith('3.')) return true;

  const dangKyKeywords = [
    'chuyển quyền', 'chuyển nhượng', 'tặng cho', 'thừa kế', 'cấp đổi', 'cấp lại',
    'đăng ký biến động', 'đkbđ', 'biến động', 'giao dịch bảo đảm', 'thế chấp', 'xóa thế chấp',
    'đính chính', 'cấp gcn', 'cấp giấy', 'phân chia quyền', 'tách hợp thửa đăng ký', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9'
  ];

  return dangKyKeywords.some(kw => tLower.includes(kw) || cLower.includes(kw));
};

// Check if a record belongs to Do Dac (Đo đạc)
export const isDoDacRecordType = (type?: string | null, code?: string | null): boolean => {
  if (isArchiveRecordType(type, code)) return false;
  if (isDangKyRecordType(type, code)) return false;
  return true;
};

// Get default attached documents for a procedure
export const getDefaultDocsForProcedure = (type?: string | null, code?: string | null): { id: string; name: string; type: 'Bản chính' | 'Bản sao' }[] => {
  if (!type && !code) return [];
  const detectedId = detectProcedureId(code, type);
  const proc = getProcedureById(detectedId);
  if (proc?.defaultDocs && proc.defaultDocs.length > 0) {
    return proc.defaultDocs.map((d, idx) => ({
      id: String(idx + 1),
      name: d.name,
      type: d.type
    }));
  }

  // Generic fallback if not specifically defined in procedure definition
  const tLower = (type || '').toLowerCase();
  if (tLower.includes('1.1') || tLower.includes('sao lục') || tLower.includes('cc dl đđ') || (type && type.startsWith('2.'))) {
    return [
      { id: '1', name: 'Phiếu yêu cầu lập hợp đồng đo đạc dịch vụ, Cắm mốc, trích lục, Cung cấp thông tin', type: 'Bản chính' },
      { id: '2', name: 'Giấy chứng nhận đã cấp', type: 'Bản sao' }
    ];
  }

  if (type && type.startsWith('3.')) {
    return [
      { id: '1', name: 'Giấy chứng nhận QSD đất', type: 'Bản chính' },
      { id: '2', name: 'Đơn đăng ký biến động', type: 'Bản chính' }
    ];
  }

  return [];
};

