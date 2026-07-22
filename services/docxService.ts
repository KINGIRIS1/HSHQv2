
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import saveAs from 'file-saver';
import { saveSystemSetting, getSystemSetting } from './api';
import { supabase } from './supabaseClient';

// Khóa lưu trữ trong LocalStorage
export const STORAGE_KEYS = {
    RECEIPT_TEMPLATE: 'docx_template_receipt',
    CONTRACT_TEMPLATE_DODAC: 'docx_template_contract_dodac', 
    CONTRACT_TEMPLATE_CAMMOC: 'docx_template_contract_cammoc', 
    // Tách riêng các loại thanh lý
    CONTRACT_TEMPLATE_LIQ_DODAC: 'docx_template_liquidation_dodac', 
    CONTRACT_TEMPLATE_LIQ_CAMMOC: 'docx_template_liquidation_cammoc',
    CONTRACT_TEMPLATE_LIQ_TRICHLUC: 'docx_template_liquidation_trichluc', // MỚI: Mẫu thanh lý trích lục
    CONTRACT_TEMPLATE: 'docx_template_contract',
    CONTRACT_TEMPLATE_ANNEX: 'docx_template_contract_annex', // MỚI: Mẫu phụ lục gia hạn hợp đồng
    
    // MỚI: Template cho VPHC
    VPHC_TEMPLATE_01: 'docx_template_vphc_01', // Biên bản VPHC
    VPHC_TEMPLATE_02: 'docx_template_vphc_02'  // Biên bản Làm việc
};

// --- HELPERS ---

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64.split(',')[1]);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

// --- STORAGE MANAGEMENT ---

// Lưu File Upload (Base64) - CHỈ LƯU LOCALSTORAGE (Vì base64 nặng, không nên tống vào bảng settings)
export const saveTemplate = async (key: string, file: File) => {
    try {
        const base64 = await fileToBase64(file);
        if (base64.length > 5 * 1024 * 1024) {
             alert("File mẫu quá lớn (>5MB). Trình duyệt không thể lưu trữ. Vui lòng nén nhỏ file hoặc dùng Link Google Docs.");
             return false;
        }
        localStorage.setItem(key, base64);
        return true;
    } catch (e: any) {
        console.error("Lỗi lưu template:", e);
        if (e.name === 'QuotaExceededError' || e.code === 22) {
             alert("Bộ nhớ trình duyệt đã đầy! Vui lòng xóa bớt các mẫu cũ hoặc dùng Link Google Docs.");
        }
        return false;
    }
};

// Lưu URL Google Docs - LƯU CẢ LOCAL VÀ CLOUD (System Settings)
export const saveTemplateUrl = async (key: string, url: string): Promise<boolean> => {
    try {
        // Chuyển đổi link View/Edit thành link Export
        let exportUrl = url;
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            exportUrl = `https://docs.google.com/document/d/${match[1]}/export?format=docx`;
        }
        
        const value = `URL_MODE:${exportUrl}`;
        
        // 1. Lưu Local
        localStorage.setItem(key, value);
        
        // 2. Lưu Cloud (Để đồng bộ cho mọi user)
        const success = await saveSystemSetting(key, value);
        if (!success) console.warn("Không thể lưu cấu hình mẫu in lên Cloud.");
        
        return true;
    } catch (e) {
        console.error("Lỗi lưu URL template:", e);
        return false;
    }
};

export const hasTemplate = (key: string): boolean => {
    return !!localStorage.getItem(key);
};

export const getTemplateSourceType = (key: string): 'FILE' | 'URL' | 'NONE' => {
    const val = localStorage.getItem(key);
    if (!val) return 'NONE';
    if (val.startsWith('URL_MODE:')) return 'URL';
    return 'FILE';
};

export const removeTemplate = (key: string) => {
    localStorage.removeItem(key);
};

// --- SYNC TEMPLATES FROM CLOUD ---
export const syncTemplatesFromCloud = async () => {
    try {
        const keys = [
            STORAGE_KEYS.RECEIPT_TEMPLATE,
            STORAGE_KEYS.CONTRACT_TEMPLATE_DODAC,
            STORAGE_KEYS.CONTRACT_TEMPLATE_CAMMOC,
            STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_DODAC,
            STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_CAMMOC,
            STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_TRICHLUC, // Thêm vào danh sách đồng bộ
            STORAGE_KEYS.CONTRACT_TEMPLATE_ANNEX, // ĐỒNG BỘ MẪU PHỤ LỤC HỢP ĐỒNG
            STORAGE_KEYS.VPHC_TEMPLATE_01,
            STORAGE_KEYS.VPHC_TEMPLATE_02
        ];

        const { data, error } = await supabase
            .from('system_settings')
            .select('key, value')
            .in('key', keys);

        if (error) throw error;

        if (data) {
            data.forEach((setting: any) => {
                if (setting.value) {
                    localStorage.setItem(setting.key, setting.value);
                }
            });
        }
    } catch (e) {
        console.warn("Lỗi đồng bộ mẫu in từ Cloud:", e);
    }
};

// --- CORE GENERATION LOGIC ---

const getTemplateArrayBuffer = async (templateKey: string): Promise<ArrayBuffer> => {
    const storedValue = localStorage.getItem(templateKey);
    if (!storedValue) {
        throw new Error("Chưa có mẫu nào được cấu hình cho loại này.");
    }

    if (storedValue.startsWith('URL_MODE:')) {
        const url = storedValue.replace('URL_MODE:', '');
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Không thể tải mẫu từ Google Docs (Lỗi ${response.status}).`);
            }
            return await response.arrayBuffer();
        } catch (error: any) {
            throw new Error("Lỗi kết nối Google Docs: " + error.message);
        }
    }

    return base64ToArrayBuffer(storedValue);
};

const createDocAsync = async (templateKey: string, data: any) => {
    const content = await getTemplateArrayBuffer(templateKey);
    const zip = new PizZip(content);
    
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{{', end: '}}' },
        nullGetter: (part) => {
            if (!part.module) return "";
            if (part.module === "rawxml") return "";
            return "";
        }
    });

    doc.render(data);
    return doc;
};

export const generateDocxBlobAsync = async (templateKey: string, data: any): Promise<Blob | null> => {
    try {
        const doc = await createDocAsync(templateKey, data);
        const out = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        return out;
    } catch (error: any) {
        console.error("Lỗi tạo file Word:", error);
        alert("Lỗi tạo văn bản: " + error.message);
        return null;
    }
};
