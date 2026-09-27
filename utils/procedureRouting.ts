import { RecordFile } from '../types';
import { isArchiveRecordType, isCertificateRecordType, isSurveyRecordType } from '../constants';

export type TargetTable = 'land_records' | 'dangky_records' | 'luutru_records';

export interface ProcedureRoutingResult {
    targetTable: TargetTable;
    procedureGroup: '1' | '2' | '3';
    groupLabel: string;
    isExplicit: boolean;
    isConflict: boolean;
    conflictReason?: string;
}

/**
 * Phân tích và định tuyến bảng dữ liệu chuẩn hóa toàn hệ thống.
 * 
 * KIẾN TRÚC ĐỊNH TUYẾN CHÍNH THỨC:
 * 1. LƯU TRỮ (1.x, sao lục, công văn) → luutru_records
 * 2. ĐO ĐẠC (2.x, trích lục, trích đo, cắm mốc) → land_records
 * 3. CẤP GIẤY / ĐĂNG KÝ (3.x, cấp đổi, cấp mới, đăng ký biến động, vô số GCN) → dangky_records
 * 
 * QUY TẮC ĐỊNH TUYẾN:
 * - Ưu tiên 1: Mã thủ tục (procedureCode: 1.x, 2.x, 3.x)
 * - Ưu tiên 2: Tên loại hồ sơ chuẩn (recordType)
 * - Ưu tiên 3: Tên nhóm hồ sơ chuẩn (group)
 * - Module "Vô số GCN" dùng chung dangky_records với Module Cấp giấy.
 * - KHÔNG đoán bảng dựa trên định dạng mã ngẫu nhiên kiểu ngày tháng (260920-xxxx).
 */
export const resolveProcedureRouting = (
    record: Partial<RecordFile> | null | undefined,
    currentTable?: string | null
): ProcedureRoutingResult => {
    if (!record) {
        return {
            targetTable: 'land_records',
            procedureGroup: '2',
            groupLabel: '2. Đo đạc địa chính',
            isExplicit: false,
            isConflict: false
        };
    }

    const procedureCode = String((record as any).procedureCode || '').trim();
    const rawType = String(record.recordType || (record as any).content || '').trim();
    const groupStr = String(record.group || '').trim();
    const code = String(record.code || '').trim();

    // 1. KIỂM TRA ƯU TIÊN 1: Mã thủ tục (procedureCode: 1.x, 2.x, 3.x)
    if (/^1\./.test(procedureCode)) {
        return createRoutingResult('luutru_records', '1', '1. Lưu trữ hồ sơ', true, currentTable);
    }
    if (/^2\./.test(procedureCode)) {
        return createRoutingResult('land_records', '2', '2. Đo đạc địa chính', true, currentTable);
    }
    if (/^3\./.test(procedureCode)) {
        return createRoutingResult('dangky_records', '3', '3. Đăng ký đất đai, cấp GCN', true, currentTable);
    }

    // 2. KIỂM TRA ƯU TIÊN 2: Loại hồ sơ (recordType / content)
    if (/^1\.\d+/i.test(rawType) || isArchiveRecordType(rawType) || isArchiveRecordType(record.recordType)) {
        return createRoutingResult('luutru_records', '1', '1. Lưu trữ hồ sơ', true, currentTable);
    }
    if (/^2\.\d+/i.test(rawType) || isSurveyRecordType(rawType) || isSurveyRecordType(record.recordType)) {
        return createRoutingResult('land_records', '2', '2. Đo đạc địa chính', true, currentTable);
    }
    if (/^3\.\d+/i.test(rawType) || isCertificateRecordType(record) || isCertificateRecordType(rawType) || isCertificateRecordType(record.recordType || '')) {
        return createRoutingResult('dangky_records', '3', '3. Đăng ký đất đai, cấp GCN', true, currentTable);
    }

    // 3. KIỂM TRA ƯU TIÊN 3: Nhóm hồ sơ (group)
    if (/^1\./.test(groupStr) || groupStr.toLowerCase().includes('lưu trữ')) {
        return createRoutingResult('luutru_records', '1', '1. Lưu trữ hồ sơ', true, currentTable);
    }
    if (/^2\./.test(groupStr) || groupStr.toLowerCase().includes('đo đạc') || groupStr.toLowerCase().includes('do dac')) {
        return createRoutingResult('land_records', '2', '2. Đo đạc địa chính', true, currentTable);
    }
    if (/^3\./.test(groupStr) || groupStr.toLowerCase().includes('đăng ký') || groupStr.toLowerCase().includes('cấp gcn') || groupStr.toLowerCase().includes('cấp giấy') || groupStr.toLowerCase().includes('dang ky') || groupStr.toLowerCase().includes('cap giay')) {
        return createRoutingResult('dangky_records', '3', '3. Đăng ký đất đai, cấp GCN', true, currentTable);
    }

    // 4. KIỂM TRA TIỀN TỐ MÃ HỒ SƠ CHUYÊN DỤNG (Chỉ áp dụng mã phân hệ đặc thù)
    if (/^1\.\d+/i.test(code)) {
        return createRoutingResult('luutru_records', '1', '1. Lưu trữ hồ sơ', true, currentTable);
    }
    if (/^2\.\d+/i.test(code)) {
        return createRoutingResult('land_records', '2', '2. Đo đạc địa chính', true, currentTable);
    }
    if (/^3\.\d+/i.test(code)) {
        return createRoutingResult('dangky_records', '3', '3. Đăng ký đất đai, cấp GCN', true, currentTable);
    }

    // 5. NẾU CÓ SOURCE TABLE RÕ RÀNG TỪ TRƯỚC ĐÓ VÀ HỢP LỆ
    const srcTable = (record as any).sourceTable;
    if (srcTable === 'dangky_records') {
        return createRoutingResult('dangky_records', '3', '3. Đăng ký đất đai, cấp GCN', false, currentTable);
    }
    if (srcTable === 'luutru_records') {
        return createRoutingResult('luutru_records', '1', '1. Lưu trữ hồ sơ', false, currentTable);
    }
    if (srcTable === 'land_records') {
        return createRoutingResult('land_records', '2', '2. Đo đạc địa chính', false, currentTable);
    }

    // MẶC ĐỊNH AN TOÀN CHO HỒ SƠ ĐO ĐẠC PHỔ THÔNG
    return createRoutingResult('land_records', '2', '2. Đo đạc địa chính', false, currentTable);
};

const createRoutingResult = (
    targetTable: TargetTable,
    procedureGroup: '1' | '2' | '3',
    groupLabel: string,
    isExplicit: boolean,
    currentTable?: string | null
): ProcedureRoutingResult => {
    const isConflict = Boolean(
        isExplicit && currentTable && currentTable !== targetTable
    );
    const conflictReason = isConflict
        ? `Xung đột định tuyến: Hồ sơ thuộc nhóm ${groupLabel} (${targetTable}) nhưng đang được ghi/truy vấn tại ${currentTable}`
        : undefined;

    return {
        targetTable,
        procedureGroup,
        groupLabel,
        isExplicit,
        isConflict,
        conflictReason
    };
};

/**
 * Kiểm tra hợp lệ định tuyến trước khi thực hiện ghi dữ liệu.
 * Chặn các thao tác ghi nếu có xung đột bảng đích rõ ràng (ROUTING_CONFLICT).
 */
export const validateRecordRoutingForWrite = (
    record: Partial<RecordFile>,
    attemptedTable: TargetTable
): { isValid: boolean; targetTable: TargetTable; error?: string } => {
    const routing = resolveProcedureRouting(record, attemptedTable);
    if (routing.isConflict) {
        return {
            isValid: false,
            targetTable: routing.targetTable,
            error: `[ROUTING_CONFLICT] Không thể ghi hồ sơ sang '${attemptedTable}'. Bảng đích chính xác là '${routing.targetTable}' (${routing.groupLabel}).`
        };
    }
    return {
        isValid: true,
        targetTable: routing.targetTable
    };
};
