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
    price: 310000,
    prefixes: ['1.1', 'SL', 'SAOLUC', 'CCDL'],
    keywords: ['sao lục', 'cung cấp tài liệu', 'cung cấp dữ liệu', 'cc dl đđ']
  },
  {
    id: '1.2',
    name: '1.2 Công văn',
    shortName: '1.2 Công văn',
    module: 'luutru',
    defaultDeadline: 10,
    price: 310000,
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
    prefixes: ['2.1', 'TL', 'TRICHLUC'],
    keywords: ['trích lục', 'quy hoạch', 'trích lục qh']
  },
  {
    id: '2.2',
    name: '2.2 Trích đo',
    shortName: '2.2 Trích đo',
    module: 'dodac',
    defaultDeadline: 30,
    prefixes: ['2.2', 'TD', 'TRICHDO'],
    keywords: ['trích đo']
  },
  {
    id: '2.3',
    name: '2.3 Duyệt đơn & Cung cấp số thửa',
    shortName: '2.3 DĐ & CC số thửa',
    module: 'dodac',
    defaultDeadline: 12,
    prefixes: ['2.3', '2.6', 'DD', 'SOTHUA'],
    keywords: ['duyệt đơn', 'cung cấp số thửa', 'dđ & cc', 'số thửa', 'cập nhật số thửa', 'cập nhập số thửa']
  },
  {
    id: '2.4',
    name: '2.4 Trích đo Cắm mốc',
    shortName: '2.4 Cắm mốc',
    module: 'dodac',
    defaultDeadline: 30,
    prefixes: ['2.4', 'CM', 'CAMMOC'],
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
    name: '3.1.1 Chuyển nhượng',
    shortName: '3.1.1 Chuyển nhượng',
    module: 'dangky',
    defaultDeadline: 13,
    prefixes: ['3.1.1', 'CN'],
    keywords: ['chuyển nhượng']
  },
  {
    id: '3.1.2',
    name: '3.1.2 Tặng cho',
    shortName: '3.1.2 Tặng cho',
    module: 'dangky',
    defaultDeadline: 13,
    prefixes: ['3.1.2', 'TC'],
    keywords: ['tặng cho']
  },
  {
    id: '3.1.3',
    name: '3.1.3 Thừa kế',
    shortName: '3.1.3 Thừa kế',
    module: 'dangky',
    defaultDeadline: 13,
    prefixes: ['3.1.3', 'TK'],
    keywords: ['thừa kế']
  },
  {
    id: '3.1.4',
    name: '3.1.4 Thỏa thuận',
    shortName: '3.1.4 Thỏa thuận',
    module: 'dangky',
    defaultDeadline: 13,
    prefixes: ['3.1.4', 'TT'],
    keywords: ['thỏa thuận']
  },
  {
    id: '3.2.1',
    name: '3.2.1 Cấp đổi',
    shortName: '3.2.1 Cấp đổi',
    module: 'dangky',
    defaultDeadline: 10,
    prefixes: ['3.2.1', 'CD'],
    keywords: ['cấp đổi']
  },
  {
    id: '3.2.2',
    name: '3.2.2 Cấp đổi (có thuế)',
    shortName: '3.2.2 Cấp đổi (có thuế)',
    module: 'dangky',
    defaultDeadline: 15,
    prefixes: ['3.2.2', 'CDT'],
    keywords: ['cấp đổi (có thuế)', 'cấp đổi có thuế']
  },
  {
    id: '3.3.1',
    name: '3.3.1 Cấp lại',
    shortName: '3.3.1 Cấp lại',
    module: 'dangky',
    defaultDeadline: 10,
    prefixes: ['3.3.1', 'CL'],
    keywords: ['cấp lại']
  },
  {
    id: '3.3.2',
    name: '3.3.2 Cấp lại (có thuế)',
    shortName: '3.3.2 Cấp lại (có thuế)',
    module: 'dangky',
    defaultDeadline: 15,
    prefixes: ['3.3.2', 'CLT'],
    keywords: ['cấp lại (có thuế)', 'cấp lại có thuế']
  },
  {
    id: '3.4.1',
    name: '3.4.1 Tách - hợp thửa',
    shortName: '3.4.1 Tách - hợp thửa',
    module: 'dangky',
    defaultDeadline: 17,
    prefixes: ['3.4.1', 'DK-TT', 'DK-HT', 'TÁCH-HỢP'],
    keywords: ['tách - hợp thửa', 'tách thửa', 'hợp thửa']
  },
  {
    id: '3.5.1',
    name: '3.5.1 Gia hạn',
    shortName: '3.5.1 Gia hạn',
    module: 'dangky',
    defaultDeadline: 7,
    prefixes: ['3.5.1', 'GH'],
    keywords: ['gia hạn']
  },
  {
    id: '3.6.1',
    name: '3.6.1 Chuyển mục đích không xin phép',
    shortName: '3.6.1 Chuyển mục đích',
    module: 'dangky',
    defaultDeadline: 10,
    prefixes: ['3.6.1', 'CMD'],
    keywords: ['chuyển mục đích']
  },
  {
    id: '3.7.1',
    name: '3.7.1 Đính chính GCN',
    shortName: '3.7.1 Đính chính',
    module: 'dangky',
    defaultDeadline: 7,
    prefixes: ['3.7.1', 'DC'],
    keywords: ['đính chính']
  },
  {
    id: '3.8.1',
    name: '3.8.1 Đăng ký GDBD',
    shortName: '3.8.1 Đăng ký GDBD',
    module: 'dangky',
    defaultDeadline: 3,
    prefixes: ['3.8.1', 'GDBD'],
    keywords: ['đăng ký gdbd', 'thế chấp', 'giao dịch bảo đảm']
  },
  {
    id: '3.8.2',
    name: '3.8.2 Xóa ĐK GDBD',
    shortName: '3.8.2 Xóa ĐK GDBD',
    module: 'dangky',
    defaultDeadline: 3,
    prefixes: ['3.8.2', 'XGDBD', 'XTC'],
    keywords: ['xóa đk gdbd', 'xóa thế chấp', 'xóa gdbd']
  },
  {
    id: '3.9.1',
    name: '3.9.1 Cấp mới / Cấp lần đầu',
    shortName: '3.9.1 Cấp mới',
    module: 'dangky',
    defaultDeadline: 30,
    prefixes: ['3.9.1', 'CLD'],
    keywords: ['cấp mới', 'cấp lần đầu', 'công nhận']
  },
  {
    id: '3.9.9',
    name: '3.9.9 Khác',
    shortName: 'Khác',
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
  .map(p => p.name);

// Derived extended record types list
export const EXTENDED_RECORD_TYPES: string[] = PROCEDURE_CATALOG.map(p => p.name);

// Derived per-module procedure lists
export const RECORD_TYPES_LuuTru = PROCEDURE_CATALOG
  .filter(p => p.module === 'luutru')
  .map(p => p.name);

export const RECORD_TYPES_DoDac = PROCEDURE_CATALOG
  .filter(p => p.module === 'dodac')
  .map(p => p.name);

export const DANG_KY_RECORD_TYPES = PROCEDURE_CATALOG
  .filter(p => p.module === 'dangky')
  .map(p => p.name);

// Derived Deadline Map for Registration (Đăng ký)
export const DANG_KY_DEADLINE_MAP: Record<string, number> = PROCEDURE_CATALOG
  .filter(p => p.module === 'dangky')
  .reduce((acc, p) => {
    acc[p.name] = p.defaultDeadline;
    acc[p.shortName] = p.defaultDeadline;
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
    'Gia hạn': 7,
    'Chuyển mục đích không xin phép': 10,
    'Đính chính GCN': 7,
    'Đăng ký GDBD': 3,
    'Xóa ĐK GDBD': 3,
    'Khác': 10
  } as Record<string, number>);

// Master lookup function by ID
export const getProcedureById = (id?: string | null): ProcedureDefinition | undefined => {
  if (!id) return undefined;
  return PROCEDURE_MAP_BY_ID[id] || PROCEDURE_CATALOG.find(p => p.id === id);
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
export const isArchiveRecordType = (type?: string | null): boolean => {
  const short = getShortRecordType(type);
  return short === '1.1 Sao lục' || short === '1.2 Công văn';
};
