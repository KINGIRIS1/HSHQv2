import { AttachedFileMeta, AttachmentDocType } from '../types';

export type DriveToastType = 'success' | 'warning' | 'error' | 'info';
export type DriveToastCallback = (item: { type: DriveToastType; title: string; message: string }) => void;
const driveToastListeners = new Set<DriveToastCallback>();

export const subscribeDriveToast = (cb: DriveToastCallback) => {
  driveToastListeners.add(cb);
  return () => {
    driveToastListeners.delete(cb);
  };
};

export const notifyDriveToast = (type: DriveToastType, title: string, message: string) => {
  driveToastListeners.forEach((cb) => cb({ type, title, message }));
};

/**
 * Tính mã băm SHA-256 cho tệp (Blob hoặc File) sử dụng Web Crypto API
 */
export const calculateFileHash = async (fileOrBlob: Blob | File): Promise<string> => {
  try {
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('Không thể tính mã băm SHA-256:', err);
    return '';
  }
};

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
 * Kiểm tra xem tệp có xem trực tiếp được bằng trình duyệt hay không (PDF, TXT, HTML, Ảnh).
 * Các định dạng khác như Word, Excel, CAD, ZIP... không thể xem trực tiếp nên chỉ hiển thị nút Tải về.
 */
export const isPreviewableFile = (fileOrMeta?: AttachedFileMeta | File | string | null): boolean => {
  if (!fileOrMeta) return false;

  let fileName = '';
  let fileType = '';

  if (typeof fileOrMeta === 'string') {
    fileName = fileOrMeta;
  } else if ('fileName' in fileOrMeta || 'originalName' in fileOrMeta) {
    const meta = fileOrMeta as AttachedFileMeta;
    fileName = meta.fileName || meta.originalName || '';
    fileType = meta.fileType || '';
  } else if (fileOrMeta instanceof File) {
    fileName = fileOrMeta.name;
    fileType = fileOrMeta.type;
  }

  if (!fileName) return false;

  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Định dạng có thể xem trực tiếp trong trình duyệt
  const previewableExtensions = ['pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'htm', 'html'];
  if (previewableExtensions.includes(ext)) {
    return true;
  }

  if (fileType.includes('pdf') || fileType.includes('text/plain') || fileType.startsWith('image/')) {
    return true;
  }

  return false;
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
export const GOOGLE_DRIVE_SCRIPT_URL_KEY = 'setting_google_drive_script_url';

export const extractGoogleDriveFolderId = (url: string): string => {
  if (!url) return '';
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return url.trim();
  return '';
};

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

export const getGoogleDriveScriptUrl = (): string => {
  try {
    return localStorage.getItem(GOOGLE_DRIVE_SCRIPT_URL_KEY) || '';
  } catch {
    return '';
  }
};

export const cleanGoogleDriveScriptUrl = (url: string): string => {
  if (!url) return '';
  let cleaned = url.trim().replace(/^['"]+|['"]+$/g, '');
  // Chuyển /dev thành /exec nếu dán nhầm link dev
  if (cleaned.endsWith('/dev')) {
    cleaned = cleaned.replace(/\/dev$/, '/exec');
  }
  // Bỏ dấu gạch chéo dư thừa ở cuối nếu không kết thúc bằng exec
  if (cleaned.endsWith('/exec/')) {
    cleaned = cleaned.replace(/\/exec\/$/, '/exec');
  }
  return cleaned;
};

export const setGoogleDriveScriptUrl = (url: string): void => {
  try {
    const cleanUrl = cleanGoogleDriveScriptUrl(url);
    localStorage.setItem(GOOGLE_DRIVE_SCRIPT_URL_KEY, cleanUrl);
  } catch (e) {
    console.error('Không thể lưu WebApp Script Google Drive:', e);
  }
};

/**
 * Kiểm tra sức khỏe kết nối Google Apps Script Web App thông qua GET request (Health Check)
 */
export const checkGoogleDriveHealth = async (
  testUrl?: string
): Promise<{ success: boolean; message: string; drive?: boolean }> => {
  let scriptUrl = cleanGoogleDriveScriptUrl(testUrl || getGoogleDriveScriptUrl());
  if (!scriptUrl) {
    return { success: false, message: 'Chưa cấu hình Google Apps Script WebApp URL trong Cài đặt hệ thống.' };
  }

  if (scriptUrl.includes('/edit') || scriptUrl.includes('/home/projects')) {
    return { success: false, message: 'Đường dẫn WebApp URL không hợp lệ (Bạn đang dán nhầm link Chỉnh sửa Code).' };
  }

  try {
    const res = await fetch(scriptUrl, {
      method: 'GET',
      cache: 'no-store'
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { success: false, message: 'Lỗi HTTP 404: WebApp URL bị sai hoặc chưa Triển khai phiên bản mới.' };
      }
      return { success: false, message: `Lỗi HTTP ${res.status}: ${res.statusText || 'Không thể kết nối máy chủ Google'}` };
    }

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return { success: false, message: 'Phản hồi từ Google Apps Script không phải định dạng JSON hợp lệ.' };
    }

    if (json.status === 'ok' && json.drive === true) {
      return { success: true, message: json.message || 'Google Drive hoạt động bình thường', drive: true };
    }

    if (json.status === 'error' || json.drive === false) {
      return { success: false, message: json.message || 'Không thể truy cập Google Drive', drive: false };
    }

    return { success: true, message: 'Đã kết nối được máy chủ Google Apps Script', drive: true };
  } catch (e: any) {
    const rawMsg = String(e?.message || '');
    if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
      return {
        success: false,
        message: 'Không kết nối được máy chủ lưu file Google Drive (Vui lòng kiểm tra lại cấu hình Quyền "Bất kỳ ai / Anyone" khi Triển khai Google Apps Script Web App).'
      };
    }
    return { success: false, message: `Không thể kết nối máy chủ Google: ${rawMsg}` };
  }
};

/**
 * Đẩy tệp đính kèm trực tiếp lên Google Drive thông qua Google Apps Script WebApp
 */
export const uploadFileToGoogleDriveScript = async (
  file: File | Blob,
  fileName: string,
  targetScriptUrl?: string,
  recordCode?: string,
  existingSha256?: string
): Promise<{ driveUrl?: string; driveFileId?: string; sha256?: string; error?: string } | null> => {
  let scriptUrl = cleanGoogleDriveScriptUrl(targetScriptUrl || getGoogleDriveScriptUrl());
  if (!scriptUrl) {
    const msg = 'Chưa cấu hình Google Apps Script WebApp URL trong Cài đặt hệ thống.';
    notifyDriveToast('warning', 'Chưa cấu hình Google Drive', msg);
    return { error: msg };
  }

  if (scriptUrl.includes('/edit') || scriptUrl.includes('/home/projects')) {
    const msg = 'Đường dẫn WebApp URL không hợp lệ (Bạn đang dán nhầm link Chỉnh sửa Code).';
    notifyDriveToast('error', 'Lỗi URL Google Apps Script', msg);
    return { error: msg };
  }

  // Kiểm tra kích thước tệp đính kèm (Giới hạn an toàn 15MB)
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
  if (file.size > MAX_FILE_SIZE) {
    const msg = `File "${fileName}" vượt quá giới hạn upload cho phép (tối đa 15MB).`;
    notifyDriveToast('error', 'Tệp quá lớn', msg);
    return { error: msg };
  }

  // Thực hiện Health Check GET trước khi tải file
  const healthCheck = await checkGoogleDriveHealth(scriptUrl);
  if (!healthCheck.success) {
    notifyDriveToast('error', 'Sự cố kết nối Google Drive', healthCheck.message);
    return { error: healthCheck.message };
  }

  try {
    const sha256Hash = existingSha256 || await calculateFileHash(file);

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res.includes(',') ? res.split(',')[1] : res);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const folderUrl = getGoogleDriveIncomingUrl();
    const folderId = extractGoogleDriveFolderId(folderUrl);

    const payload = {
      action: 'uploadFile',
      recordCode: recordCode || 'HO_SO_CHUNG',
      fileName,
      mimeType: file.type || 'application/octet-stream',
      base64Data: base64,
      folderId: folderId || undefined,
      sha256: sha256Hash
    };

    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errMsg = res.status === 404 
        ? 'Lỗi HTTP 404: WebApp URL bị sai hoặc chưa Triển khai phiên bản mới.' 
        : `Lỗi HTTP ${res.status}: ${res.statusText || 'Không thể kết nối máy chủ Google'}`;
      notifyDriveToast('error', 'Sự cố kết nối Google Drive', errMsg);
      return { error: errMsg };
    }

    const text = await res.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      const errMsg = 'Phản hồi từ Google Apps Script không phải định dạng JSON hợp lệ.';
      notifyDriveToast('error', 'Lỗi đồng bộ Google Drive', errMsg);
      return { error: errMsg };
    }

    if (json.status === 'error' || json.error) {
      const errDetail = String(json.message || json.error || '');
      notifyDriveToast('error', 'Google Apps Script báo lỗi', errDetail);
      return { error: errDetail };
    }

    const fileId = json.driveFileId || json.fileId || json.id;
    const url = json.driveUrl || json.fileUrl || json.url || json.webViewLink || json.webContentLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : undefined);

    if (url || fileId) {
      notifyDriveToast('success', 'Đã đồng bộ Google Drive', `Tệp "${fileName}" đã được tải lên Drive.`);
      return {
        driveUrl: url,
        driveFileId: fileId,
        sha256: sha256Hash
      };
    }

    const errMsg = 'WebApp phản hồi thành công nhưng không có fileId/fileUrl.';
    notifyDriveToast('warning', 'Lỗi dữ liệu Google Drive', errMsg);
    return { error: errMsg };
  } catch (e: any) {
    const rawMsg = String(e?.message || '');
    let friendlyMsg = 'Không thể kết nối đến Google WebApp';
    if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError')) {
      friendlyMsg = 'Không kết nối được máy chủ lưu file Google Drive. Vui lòng kiểm tra lại đường dẫn WebApp URL và đảm bảo quyền truy cập đã chọn là "Bất kỳ ai / Anyone" khi Triển khai.';
    } else {
      friendlyMsg = `Lỗi kết nối mạng: ${rawMsg}`;
    }
    notifyDriveToast('error', 'Sự cố kết nối Google Drive', friendlyMsg);
    return { error: friendlyMsg };
  }
};

/**
 * Kiểm tra kết nối thử nghiệm tới Google Apps Script WebApp
 */
export const testGoogleDriveScriptConnection = async (testUrl?: string): Promise<{ success: boolean; message: string; driveUrl?: string }> => {
  let scriptUrl = (testUrl || getGoogleDriveScriptUrl()).trim();
  if (!scriptUrl) {
    return { success: false, message: 'Chưa nhập WebApp URL.' };
  }

  if (scriptUrl.endsWith('/dev')) {
    scriptUrl = scriptUrl.replace(/\/dev$/, '/exec');
  }

  // Bước 1: Gọi Health Check GET
  const healthRes = await checkGoogleDriveHealth(scriptUrl);
  if (!healthRes.success) {
    return {
      success: false,
      message: `[Health Check GET thất bại] ${healthRes.message}`
    };
  }

  // Bước 2: Gọi POST upload thử nghiệm 1 file văn bản nhỏ
  try {
    const dummyBlob = new Blob(['File kiem tra ket noi tu He thong Quan ly Ho so'], { type: 'text/plain' });
    const fileName = `TEST_CONNECT_${Date.now()}.txt`;

    const result = await uploadFileToGoogleDriveScript(dummyBlob, fileName, scriptUrl, 'TEST_CONNECT');
    if (result && (result.driveUrl || result.driveFileId)) {
      return {
        success: true,
        message: 'Kết nối (GET Health Check) và Tải tệp thử nghiệm (POST Upload) lên Google Drive thành công!',
        driveUrl: result.driveUrl,
      };
    } else {
      return {
        success: false,
        message: result?.error || 'Không nhận được phản hồi hợp lệ từ WebApp khi gửi POST.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Lỗi kết nối POST: ${err?.message || 'Không thể truy cập WebApp'}`,
    };
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
  if (meta.driveUrl) {
    window.open(meta.driveUrl, '_blank');
    return;
  }

  if (meta.driveFileId) {
    window.open(`https://drive.google.com/uc?export=download&id=${meta.driveFileId}`, '_blank');
    return;
  }

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
    alert(`Tệp "${meta.fileName}" không có liên kết Google Drive. Vui lòng kiểm tra lại cấu hình WebApp Google Drive trong Cài đặt hệ thống.`);
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
 * Chuẩn bị lưu tạm 1 tệp đính kèm vào bộ nhớ cục bộ (IndexedDB / Base64) - PHẢN HỒI TỨC THÌ 0MS
 * Không tải lên Google Drive ngay lúc này.
 */
export const preparePendingSingleAttachment = async (
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

  // Đọc base64 cho tệp nhỏ (<2MB) để hỗ trợ xem trước tức thì
  let base64Data: string | undefined;
  if (file.size <= 2 * 1024 * 1024) {
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

  // Tính mã băm SHA-256 cho tệp
  let sha256: string | undefined;
  try {
    sha256 = await calculateFileHash(file);
  } catch {
    // bỏ qua nếu không tính được
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
    storageId: fileId,
    base64Data,
    driveUrl: undefined, // Chưa lưu Drive
    driveFileId: undefined,
    sha256,
    status: 'idle',
  };

  // Lưu Blob dữ liệu vào IndexedDB để chờ đồng bộ ngầm
  await saveAttachmentBlob(meta, file);
  return meta;
};

/**
 * Xóa tệp khỏi Google Drive (chuyển vào Thùng rác) thông qua Google Apps Script WebApp
 */
export const deleteFileFromGoogleDriveScript = async (
  driveFileId: string,
  targetScriptUrl?: string
): Promise<{ success: boolean; error?: string }> => {
  if (!driveFileId) return { success: false, error: 'Thiếu fileId' };
  let scriptUrl = cleanGoogleDriveScriptUrl(targetScriptUrl || getGoogleDriveScriptUrl());
  if (!scriptUrl) {
    notifyDriveToast('warning', 'Chưa cấu hình Google Drive', 'Chưa nhập WebApp URL để xóa tệp trên Google Drive.');
    return { success: false, error: 'Chưa cấu hình Google Apps Script WebApp URL.' };
  }

  try {
    const payload = {
      action: 'deleteFile',
      fileId: driveFileId,
    };

    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const msg = `Mã lỗi HTTP ${res.status} khi xóa tệp trên Drive.`;
      notifyDriveToast('error', 'Lỗi xóa tệp Drive', msg);
      return { success: false, error: msg };
    }

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.status === 'success' || json.success) {
        notifyDriveToast('info', 'Google Drive', 'Đã xóa và chuyển tệp vào Thùng rác Google Drive.');
        return { success: true };
      }
      const errMsg = json.error || json.message || 'Không thể xóa tệp trên Google Drive';
      notifyDriveToast('warning', 'Sự cố xóa tệp Drive', errMsg);
      return { success: false, error: errMsg };
    } catch {
      notifyDriveToast('error', 'Lỗi xóa tệp Drive', 'Phản hồi từ máy chủ không phải JSON hợp lệ');
      return { success: false, error: 'Phản hồi không phải JSON hợp lệ' };
    }
  } catch (err: any) {
    console.warn('Lỗi khi xóa tệp trên Google Drive:', err);
    notifyDriveToast('error', 'Sự cố kết nối Google Drive', err?.message || 'Lỗi kết nối mạng khi xóa tệp');
    return { success: false, error: err?.message || 'Lỗi kết nối mạng' };
  }
};

/**
 * Tải danh sách tệp đính kèm đang chờ lên Google Drive theo mã hồ sơ chính thức
 * Thực thi tải song song (Parallel) và chống tải trùng lặp tệp
 */
export const uploadPendingAttachmentsToDrive = async (
  metas: AttachedFileMeta[],
  finalRecordCode: string
): Promise<AttachedFileMeta[]> => {
  if (!metas || metas.length === 0) return [];

  const sanitizedCode = (finalRecordCode || 'HS-CHUNG').trim();
  
  // Bộ nhớ đệm lưu kết quả tải đợt hiện tại để tránh tải trùng lặp
  const uploadCache = new Map<string, { driveUrl: string; driveFileId?: string; fileName: string }>();

  // Tải đồng thời song song các tệp để tối đa hóa tốc độ
  const updatedMetas = await Promise.all(
    metas.map(async (itemOrig, i) => {
      const item = { ...itemOrig };

      // Nếu tệp đã được tải lên Google Drive trước đó thì giữ nguyên
      if (item.driveUrl || item.driveFileId) {
        return item;
      }

      // Nếu tệp này đã được tải ở một mục khác trong cùng lượt
      if (uploadCache.has(item.id)) {
        const cached = uploadCache.get(item.id)!;
        item.driveUrl = cached.driveUrl;
        item.driveFileId = cached.driveFileId;
        item.fileName = cached.fileName;
        item.base64Data = undefined;
        return item;
      }

      // Lấy dữ liệu file từ IndexedDB hoặc Base64
      let blob: Blob | null = await getAttachmentBlob(item.id);
      if (!blob && item.base64Data) {
        try {
          const byteCharacters = atob(item.base64Data.split(',')[1] || item.base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let j = 0; j < byteCharacters.length; j++) {
            byteNumbers[j] = byteCharacters.charCodeAt(j);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray], { type: item.fileType || 'application/octet-stream' });
        } catch (e) {
          console.error('Lỗi giải mã base64 để tải lên Drive:', e);
        }
      }

      if (!blob) {
        console.warn(`Không tìm thấy dữ liệu nội dung tệp "${item.fileName}" để tải lên Drive.`);
        return item;
      }

      // Đảm bảo tên tệp cập nhật theo Mã hồ sơ chính thức
      const seqIndex = i + 1;
      const finalFileName = generateStandardizedFileName(
        sanitizedCode,
        item.docType || item.docTypeLabel || 'TLKHAC',
        seqIndex,
        item.originalName || item.fileName
      );

      // Tính mã băm SHA-256 của tệp nếu chưa có
      if (!item.sha256) {
        try {
          item.sha256 = await calculateFileHash(blob);
        } catch {}
      }

      // Thiết lập trạng thái đang tải lên
      item.status = 'uploading';

      // Tiến hành đẩy tệp lên Google Drive
      const driveResult = await uploadFileToGoogleDriveScript(
        blob,
        finalFileName,
        undefined,
        sanitizedCode,
        item.sha256
      );

      if (driveResult && (driveResult.driveUrl || driveResult.driveFileId)) {
        item.recordCode = sanitizedCode;
        item.fileName = finalFileName;
        item.driveUrl = driveResult.driveUrl;
        item.driveFileId = driveResult.driveFileId;
        item.sha256 = driveResult.sha256 || item.sha256;
        item.status = 'idle';
        item.base64Data = undefined; // Dọn dẹp base64 để nhẹ cơ sở dữ liệu Supabase

        uploadCache.set(item.id, {
          driveUrl: driveResult.driveUrl!,
          driveFileId: driveResult.driveFileId,
          fileName: finalFileName
        });

        // Dọn dẹp tệp tạm trong IndexedDB
        await deleteAttachmentBlob(item.id);
      } else {
        const errMsg = driveResult?.error || 'Không nhận được phản hồi từ Google WebApp.';
        console.warn(`Cảnh báo đẩy tệp "${finalFileName}" lên Drive: ${errMsg}`);
        item.uploadError = errMsg;
        item.status = 'error';
      }

      return item;
    })
  );

  return updatedMetas;
};

/**
 * Kiểm tra xem một hồ sơ có bất kỳ tệp đính kèm nào đang ở trạng thái lưu tạm (chưa có driveUrl) hay không
 */
export const hasPendingRecordAttachments = (record: any): boolean => {
  if (!record) return false;

  // 1. Kiểm tra attachedFiles
  if (Array.isArray(record.attachedFiles) && record.attachedFiles.some((f: any) => f && !f.driveUrl && !f.driveFileId)) {
    return true;
  }

  // 2. Kiểm tra otherDocs / attachedDocs
  let docs: any[] = [];
  if (Array.isArray(record.otherDocs)) {
    docs = record.otherDocs;
  } else if (typeof record.otherDocs === 'string' && record.otherDocs.trim()) {
    try {
      docs = JSON.parse(record.otherDocs);
    } catch {}
  }
  if (Array.isArray(docs) && docs.some((d: any) => d && d.attachedFile && !d.attachedFile.driveUrl && !d.attachedFile.driveFileId)) {
    return true;
  }

  // 3. Kiểm tra dossierComponents
  let comps: any[] = [];
  if (Array.isArray(record.dossierComponents)) {
    comps = record.dossierComponents;
  } else if (typeof record.dossierComponents === 'string' && record.dossierComponents.trim()) {
    try {
      comps = JSON.parse(record.dossierComponents);
    } catch {}
  }
  if (Array.isArray(comps) && comps.some((c: any) => c && c.attachedFile && !c.attachedFile.driveUrl && !c.attachedFile.driveFileId)) {
    return true;
  }

  return false;
};

/**
 * Hàng đợi đồng bộ tệp ngầm trong nền (Background Sync Queue)
 * Cho phép người dùng lưu tạm vào bộ nhớ máy và tiếp tục làm việc tức thì 0ms,
 * trong khi các tệp được tự động tải ngầm lên Google Drive.
 */
interface QueuedRecordSync {
  record: any;
  addedAt: number;
}

const backgroundSyncQueue = new Map<string, QueuedRecordSync>();
let isBackgroundSyncRunning = false;

const runBackgroundSyncQueue = async () => {
  if (isBackgroundSyncRunning) return;
  isBackgroundSyncRunning = true;

  try {
    while (backgroundSyncQueue.size > 0) {
      // Lấy phần tử đầu tiên trong hàng đợi
      const firstEntry = backgroundSyncQueue.entries().next().value;
      if (!firstEntry) break;
      const [recordId, queueItem] = firstEntry;
      backgroundSyncQueue.delete(recordId);

      const record = queueItem.record;
      const finalCode = (record.code || 'HS').trim();

      try {
        let hasChanges = false;
        let syncedAttachedFiles: AttachedFileMeta[] = Array.isArray(record.attachedFiles) ? [...record.attachedFiles] : [];
        let syncedAttachedDocs: any[] = [];
        let syncedDossierComponents: any[] = [];

        // Parse otherDocs
        if (Array.isArray(record.otherDocs)) {
          syncedAttachedDocs = [...record.otherDocs];
        } else if (typeof record.otherDocs === 'string' && record.otherDocs.trim()) {
          try {
            syncedAttachedDocs = JSON.parse(record.otherDocs);
          } catch {}
        }

        // Parse dossierComponents
        if (Array.isArray(record.dossierComponents)) {
          syncedDossierComponents = [...record.dossierComponents];
        } else if (typeof record.dossierComponents === 'string' && record.dossierComponents.trim()) {
          try {
            syncedDossierComponents = JSON.parse(record.dossierComponents);
          } catch {}
        }

        // 1. Đồng bộ attachedFiles
        const pendingAttachedFiles = syncedAttachedFiles.filter(f => f && !f.driveUrl && !f.driveFileId);
        if (pendingAttachedFiles.length > 0) {
          notifyDriveToast('info', 'Đồng bộ Drive ngầm', `Đang tải ${pendingAttachedFiles.length} tệp của hồ sơ ${finalCode} lên Google Drive trong nền...`);
          syncedAttachedFiles = await uploadPendingAttachmentsToDrive(syncedAttachedFiles, finalCode);
          hasChanges = true;
        }

        // 2. Đồng bộ otherDocs (attachedDocs)
        const pendingDocs = syncedAttachedDocs.filter(d => d && d.attachedFile && !d.attachedFile.driveUrl && !d.attachedFile.driveFileId);
        if (pendingDocs.length > 0) {
          const docMetas = pendingDocs.map(d => d.attachedFile);
          const syncedDocMetas = await uploadPendingAttachmentsToDrive(docMetas, finalCode);
          const metaMap = new Map(syncedDocMetas.map(m => [m.id, m]));
          syncedAttachedDocs = syncedAttachedDocs.map(d => {
            if (d && d.attachedFile && metaMap.has(d.attachedFile.id)) {
              return { ...d, attachedFile: metaMap.get(d.attachedFile.id) };
            }
            return d;
          });
          hasChanges = true;
        }

        // 3. Đồng bộ dossierComponents
        const pendingComps = syncedDossierComponents.filter(c => c && c.attachedFile && !c.attachedFile.driveUrl && !c.attachedFile.driveFileId);
        if (pendingComps.length > 0) {
          const compMetas = pendingComps.map(c => c.attachedFile);
          const syncedCompMetas = await uploadPendingAttachmentsToDrive(compMetas, finalCode);
          const compMap = new Map(syncedCompMetas.map(m => [m.id, m]));
          syncedDossierComponents = syncedDossierComponents.map(c => {
            if (c && c.attachedFile && compMap.has(c.attachedFile.id)) {
              return { ...c, attachedFile: compMap.get(c.attachedFile.id) };
            }
            return c;
          });
          hasChanges = true;
        }

        if (hasChanges) {
          const updatedRecord: any = {
            ...record,
            attachedFiles: syncedAttachedFiles,
            otherDocs: typeof record.otherDocs === 'string' ? JSON.stringify(syncedAttachedDocs) : syncedAttachedDocs,
            dossierComponents: syncedDossierComponents,
          };

          // Lưu vào CSDL Supabase
          try {
            const { updateRecordApi } = await import('./apiRecords');
            await updateRecordApi(updatedRecord);
          } catch (dbErr) {
            console.warn('Cập nhật database sau khi đồng bộ Drive:', dbErr);
          }

          // Phát sự kiện để cập nhật UI ngay lập tức
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('RECORD_ATTACHMENTS_UPDATED', { detail: updatedRecord }));
          }

          notifyDriveToast('success', 'Đã lưu Google Drive', `Đã đồng bộ thành công các tệp của hồ sơ ${finalCode} lên Google Drive.`);
        }
      } catch (err: any) {
        console.warn(`Lỗi khi đồng bộ tệp hồ sơ ${finalCode} lên Google Drive:`, err);
        notifyDriveToast('warning', 'Chưa đồng bộ Drive', `Tệp của hồ sơ ${finalCode} đã được lưu tạm an toàn trong máy và sẽ thử lại sau.`);
      }
    }
  } finally {
    isBackgroundSyncRunning = false;
  }
};

/**
 * Đưa hồ sơ vào hàng đợi đồng bộ ngầm Google Drive (Background Sync)
 * Không chặn giao diện người dùng, trả về ngay lập tức 0ms
 */
export const enqueueRecordForBackgroundDriveSync = (record: any): void => {
  if (!record || !record.id) return;
  if (!hasPendingRecordAttachments(record)) return;

  backgroundSyncQueue.set(record.id, { record, addedAt: Date.now() });

  // Kích hoạt tiến trình ngầm
  setTimeout(() => {
    runBackgroundSyncQueue();
  }, 100);
};

/**
 * Xử lý tải lên và đổi tên chuẩn hóa cho 1 tệp đính kèm (Gọi trực tiếp)
 */
export const processAndSaveSingleAttachment = async (
  file: File,
  recordCode: string,
  docNameOrType: string,
  sequenceIndex: number,
  department: string,
  stage?: string
): Promise<AttachedFileMeta> => {
  const pendingMeta = await preparePendingSingleAttachment(
    file,
    recordCode,
    docNameOrType,
    sequenceIndex,
    department,
    stage
  );

  const syncedList = await uploadPendingAttachmentsToDrive([pendingMeta], recordCode);
  return syncedList[0] || pendingMeta;
};

/**
 * Mở xem trực tiếp tệp nếu trình duyệt hỗ trợ (xem trước Drive hoặc Blob tạm)
 */
export const previewAttachment = async (meta: AttachedFileMeta, blobOverride?: Blob): Promise<void> => {
  if (meta.driveUrl) {
    window.open(meta.driveUrl, '_blank');
    return;
  }

  if (meta.driveFileId) {
    window.open(`https://drive.google.com/file/d/${meta.driveFileId}/view`, '_blank');
    return;
  }

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
