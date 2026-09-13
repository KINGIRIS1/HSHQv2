import { AttachedFileMeta, AttachmentDocType } from '../types';

export const DOC_TYPE_LABELS: Record<AttachmentDocType, string> = {
  GCN: 'Giấy chứng nhận (Sổ đỏ / Sổ hồng)',
  DON: 'Đơn đăng ký / đề nghị / xin đo đạc',
  VBUQ: 'Văn bản ủy quyền / Hợp đồng ủy quyền',
  BANVE: 'Bản vẽ hiện trạng / Trích đo / Trích lục',
  BIENBAN: 'Biên bản xác minh / Kiểm tra kỹ thuật',
  TAICHINH: 'Biên lai / Nghĩa vụ tài chính',
  PHIEU_KT: 'Phiếu kiểm tra kỹ thuật',
  TO_TRINH: 'Tờ trình ký duyệt',
  TLKHAC: 'Tài liệu pháp lý khác',
};

export const DOC_TYPES: { type: AttachmentDocType; label: string }[] = [
  { type: 'GCN', label: 'Giấy chứng nhận (Sổ đỏ / Sổ hồng)' },
  { type: 'DON', label: 'Đơn đăng ký / Đề nghị / Xin đo đạc' },
  { type: 'BANVE', label: 'Bản vẽ hiện trạng / Trích đo / Trích lục' },
  { type: 'VBUQ', label: 'Văn bản ủy quyền / Hợp đồng' },
  { type: 'BIENBAN', label: 'Biên bản xác minh / Kiểm tra' },
  { type: 'TAICHINH', label: 'Biên lai / Nghĩa vụ tài chính' },
  { type: 'PHIEU_KT', label: 'Phiếu kiểm tra kỹ thuật' },
  { type: 'TO_TRINH', label: 'Tờ trình ký duyệt' },
  { type: 'TLKHAC', label: 'Tài liệu pháp lý khác' },
];

/**
 * Trích xuất mã viết tắt chuẩn hóa từ tên giấy tờ hoặc loại tài liệu
 * Ví dụ: "Giấy chứng nhận QSDĐ" -> "GCN", "Bản vẽ trích đo" -> "BANVE"
 */
export const getAbbreviationForDocName = (nameOrType: string): string => {
  if (!nameOrType) return 'TLKHAC';
  const clean = nameOrType.trim();
  const lower = clean.toLowerCase();

  if (clean === 'GCN' || lower.includes('chứng nhận') || lower.includes('sổ đỏ') || lower.includes('sổ hồng') || lower.includes('gcn')) {
    return 'GCN';
  }
  if (clean === 'DON' || lower.includes('đơn') || lower.includes('don ')) {
    return 'DON';
  }
  if (clean === 'BANVE' || lower.includes('bản vẽ') || lower.includes('trích đo') || lower.includes('trích lục') || lower.includes('bản đồ') || lower.includes('sơ đồ')) {
    return 'BANVE';
  }
  if (clean === 'VBUQ' || lower.includes('ủy quyền') || lower.includes('hợp đồng')) {
    return 'VBUQ';
  }
  if (clean === 'BIENBAN' || lower.includes('biên bản') || lower.includes('xác minh')) {
    return 'BIENBAN';
  }
  if (clean === 'TAICHINH' || lower.includes('tài chính') || lower.includes('biên lai') || lower.includes('hóa đơn') || lower.includes('thuế')) {
    return 'TAICHINH';
  }
  if (clean === 'PHIEU_KT' || lower.includes('kiểm tra') || lower.includes('phiếu kt')) {
    return 'PHIEU_KT';
  }
  if (clean === 'TO_TRINH' || lower.includes('tờ trình') || lower.includes('trình ký')) {
    return 'TO_TRINH';
  }
  if (clean === 'TLKHAC') return 'TLKHAC';

  // Nếu là mã viết tắt ngắn đã viết hoa không dấu (2-6 ký tự)
  if (/^[A-Z0-9_-]{2,8}$/.test(clean)) {
    return clean;
  }

  // Tự động tạo chữ viết tắt từ các chữ cái đầu không dấu
  const nonDiacritics = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd');
  
  const words = nonDiacritics.split(/[\s_-]+/).filter(Boolean);
  if (words.length > 1) {
    const abbr = words.map(w => w[0]?.toUpperCase() || '').join('');
    if (abbr.length >= 2 && abbr.length <= 6) return abbr;
  }

  return 'TLKHAC';
};

/**
 * Kiểm tra xem tệp có phải định dạng ảnh hay không (để từ chối theo yêu cầu)
 */
export const isImageFile = (file: File | string): boolean => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'heic', 'tiff', 'ico', 'jfif'];
  if (typeof file === 'string') {
    const ext = file.split('.').pop()?.toLowerCase() || '';
    return imageExtensions.includes(ext);
  }
  if (file.type && file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return imageExtensions.includes(ext);
};

/**
 * Kiểm tra định dạng tệp văn bản/tài liệu/bản vẽ hợp lệ
 */
export const isAllowedDocFile = (file: File): boolean => {
  if (isImageFile(file)) return false;
  const allowedExtensions = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'dwg', 'dgn', 'txt', 'rtf', 'csv'];
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return allowedExtensions.includes(ext);
};

/**
 * Tạo tên tệp chuẩn hóa theo yêu cầu:
 * Cú pháp: [Tên_Viết_Tắt] [STT]_[Mã_HS].[ext]
 * Ví dụ: GCN 1_260907-0002.pdf, BANVE 1_260907-0002.dwg
 */
export const generateStandardizedFileName = (
  recordCode: string,
  docTypeOrName: AttachmentDocType | string,
  sequenceIndex: number,
  originalFileName: string
): string => {
  const sanitizedCode = (recordCode || 'HS')
    .trim()
    .replace(/[/\\?%*:|"<> ]/g, '-');
  
  const ext = originalFileName.split('.').pop()?.toLowerCase() || 'pdf';
  const abbr = getAbbreviationForDocName(docTypeOrName);
  const idx = sequenceIndex > 0 ? sequenceIndex : 1;
  
  return `${abbr} ${idx}_${sanitizedCode}.${ext}`;
};

// --- QUẢN LÝ ĐƯỜNG DẪN GOOGLE DRIVE LƯU DỮ LIỆU TIẾP NHẬN ---
export const GOOGLE_DRIVE_INCOMING_URL_KEY = 'setting_google_drive_incoming_url';

export const getGoogleDriveIncomingUrl = (): string => {
  try {
    return localStorage.getItem(GOOGLE_DRIVE_INCOMING_URL_KEY) || '';
  } catch {
    return '';
  }
};

export const setGoogleDriveIncomingUrl = (url: string): void => {
  try {
    localStorage.setItem(GOOGLE_DRIVE_INCOMING_URL_KEY, url.trim());
  } catch (e) {
    console.error('Không thể lưu đường dẫn Google Drive:', e);
  }
};

// --- INDEXED DB STORAGE CHO TỆP ĐÍNH KÈM HỒ SƠ ---
const DB_NAME = 'TNHS_Attachments_DB';
const DB_VERSION = 1;
const STORE_NAME = 'attached_files';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB không được hỗ trợ trên trình duyệt này.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('recordCode', 'recordCode', { unique: false });
      }
    };
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

/**
 * Lưu tệp đính kèm vào IndexedDB
 */
export const saveAttachmentBlob = async (meta: AttachedFileMeta, fileBlob: Blob | File): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        id: meta.id,
        recordCode: meta.recordCode,
        fileName: meta.fileName,
        docType: meta.docType,
        docTypeLabel: meta.docTypeLabel,
        fileSize: meta.fileSize,
        fileType: meta.fileType,
        uploadedAt: meta.uploadedAt,
        department: meta.department,
        blob: fileBlob,
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('Lỗi khi lưu IndexedDB, dùng fallback base64 nếu nhỏ:', error);
  }
};

/**
 * Lấy Blob tệp đính kèm từ IndexedDB
 */
export const getAttachmentBlob = async (id: string): Promise<Blob | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('Lỗi đọc tệp từ IndexedDB:', error);
    return null;
  }
};

/**
 * Xóa tệp đính kèm khỏi IndexedDB
 */
export const deleteAttachmentBlob = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn('Lỗi khi xóa tệp khỏi IndexedDB:', error);
  }
};

/**
 * Tải xuống tệp riêng lẻ theo tên chuẩn hóa của mã hồ sơ
 */
export const downloadAttachment = async (meta: AttachedFileMeta, blobOverride?: Blob): Promise<void> => {
  let blob: Blob | null = blobOverride || null;
  if (!blob) {
    blob = await getAttachmentBlob(meta.id);
  }

  if (!blob && meta.base64Data) {
    // Chuyển base64 sang blob
    try {
      const byteCharacters = atob(meta.base64Data.split(',')[1] || meta.base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: meta.fileType || 'application/octet-stream' });
    } catch (e) {
      console.error('Không thể giải mã dữ liệu base64:', e);
    }
  }

  if (!blob) {
    alert(`Không tìm thấy dữ liệu nội dung của tệp "${meta.fileName}". Tệp có thể đã được lưu trực tiếp trên Google Drive.`);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = meta.fileName || meta.originalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

/**
 * Xử lý tải lên và đổi tên chuẩn hóa cho 1 tệp đính kèm:
 * Cú pháp: [Tên_Viết_Tắt] [STT]_[Mã_HS].[ext] (VD: GCN 1_260907-0002.pdf)
 */
export const processAndSaveSingleAttachment = async (
  file: File,
  recordCode: string,
  docNameOrType: string,
  sequenceIndex: number,
  department: string,
  stage?: string
): Promise<AttachedFileMeta> => {
  if (isImageFile(file)) {
    throw new Error('Hệ thống đã bỏ hỗ trợ định dạng ảnh. Vui lòng tải lên tệp văn bản (PDF, Word, Excel, CAD...)');
  }

  const sanitizedCode = (recordCode || 'HS').trim();
  const standardizedName = generateStandardizedFileName(
    sanitizedCode,
    docNameOrType,
    sequenceIndex,
    file.name
  );

  const fileId = `att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const abbr = getAbbreviationForDocName(docNameOrType);
  const docTypeLabel = (DOC_TYPE_LABELS as any)[abbr] || docNameOrType || abbr;

  let base64Data: string | undefined;
  if (file.size < 1.5 * 1024 * 1024) {
    try {
      base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    } catch {
      // bỏ qua nếu lỗi
    }
  }

  const meta: AttachedFileMeta = {
    id: fileId,
    recordCode: sanitizedCode,
    originalName: file.name,
    fileName: standardizedName,
    docType: abbr,
    docTypeLabel,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
    department: department || 'Tổ Đo đạc',
    stage: stage || 'Tiếp nhận',
    base64Data,
  };

  await saveAttachmentBlob(meta, file);
  return meta;
};

/**
 * Mở xem trực tiếp tệp nếu trình duyệt hỗ trợ (ví dụ PDF)
 */
export const previewAttachment = async (meta: AttachedFileMeta, blobOverride?: Blob): Promise<void> => {
  let blob: Blob | null = blobOverride || null;
  if (!blob) {
    blob = await getAttachmentBlob(meta.id);
  }

  if (!blob && meta.base64Data) {
    try {
      const byteCharacters = atob(meta.base64Data.split(',')[1] || meta.base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: meta.fileType || 'application/pdf' });
    } catch (e) {
      console.error('Lỗi chuyển base64 preview:', e);
    }
  }

  if (!blob) {
    alert(`Không tìm thấy dữ liệu tệp "${meta.fileName}" để xem trước.`);
    return;
  }

  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};
