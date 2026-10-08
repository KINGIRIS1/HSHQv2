import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { RecordFile, RecordStatus, User, NotifyFunction } from '../../types';
import { 
    deleteRecordsBatchApi, 
    scanEmptyRecordsInDatabaseDirect, 
    deleteEmptyRecordsDirectly, 
    EmptyRecordScanResult,
    updateRecordApi,
    sanitizeRecordPayloadForTable,
    getTargetTable
} from '../../services/apiRecords';
import { supabase, isConfigured } from '../../services/supabaseClient';
import { mapRecordFromDb, saveToCache, getFromCache, CACHE_KEYS } from '../../services/apiCore';
import { STATUS_LABELS, RECORD_TYPES, getShortRecordType, getFullRecordType, getNormalizedWard, DEFAULT_WARDS } from '../../constants';
import { confirmAction } from '../../utils/appHelpers';
import { 
    Copy, Trash2, Search, CheckSquare, Square, RefreshCw, 
    ShieldCheck, CheckCircle2, FileX2, AlertOctagon, Eye,
    GitMerge, ArrowRight, Sparkles, Check, AlertCircle,
    FilterX, FolderX, Tag
} from 'lucide-react';

interface DuplicateRemovalTabProps {
    records: RecordFile[];
    currentUser?: User;
    notify: NotifyFunction;
    onDeleteBatchRecords?: (ids: string[]) => Promise<boolean>;
    onRefreshData?: () => void | Promise<void>;
}

export interface RecordQualityAssessment {
    recordId: string;
    inputScore: number;
    workflowScore: number;
    totalScore: number;
    statusRank: number;
    presentInputLabels: string[];
    missingInputLabels: string[];
    presentWorkflowLabels: string[];
}

export interface MergePreviewInfo {
    hasChanges: boolean;
    upgradedStatus?: { from: string; to: string };
    filledInputFields: string[];
    filledWorkflowFields: string[];
    mergedRecord: RecordFile;
}

interface DuplicateGroup {
    groupKey: string;
    code: string;
    customerName: string;
    mapSheet: string;
    landPlot: string;
    records: RecordFile[];
    keepRecordId: string;
    assessments: Record<string, RecordQualityAssessment>;
    mergePreview: MergePreviewInfo;
    hasDifferentWorkflow: boolean;
}

export interface ForeignProcedureRecordItem {
    record: RecordFile;
    rawType: string;
    rawContent: string;
    normalizedShortType: string;
    isOfficialType: boolean;
    isForeignKeywordMatch: boolean;
    isMissingCodePrefix: boolean;
    isForeignWard: boolean;
    reasons: string[];
}

const normStr = (s?: string | number | null): string => {
    if (s === null || s === undefined) return '';
    return String(s).trim().normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
};

const normCodeKey = (s?: string | number | null): string => {
    if (s === null || s === undefined) return '';
    const raw = String(s).trim().normalize('NFC').toLowerCase().replace(/\s+/g, '');
    if (!raw || raw === '--' || raw === 'hs' || raw === 'null' || raw === 'undefined' || raw === '(trống)') {
        return '';
    }
    return raw;
};

const hasValidValue = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'boolean') return val === true;
    if (typeof val === 'number') return !isNaN(val) && val > 0;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    const str = String(val).trim();
    if (!str) return false;
    const lower = str.toLowerCase();
    return lower !== '--' && lower !== 'null' && lower !== 'undefined' && lower !== 'n/a' && lower !== '(trống)';
};

// Tập hợp 22 loại thủ tục chuẩn của phần mềm
const OFFICIAL_SHORT_TYPES_SET = new Set<string>(RECORD_TYPES.map(t => t.trim().toLowerCase()));
const OFFICIAL_FULL_TYPES_SET = new Set<string>(RECORD_TYPES.map(t => getFullRecordType(t).trim().toLowerCase()));
const OFFICIAL_CODE_PREFIXES = [
    '1.1', '1.2',
    '2.1', '2.2', '2.3', '2.4', '2.5', '2.6',
    '3.1.1', '3.1.2', '3.1.3',
    '3.2.1', '3.2.2',
    '3.3.1', '3.3.2',
    '3.4.1', '3.4.2',
    '3.5.1',
    '3.6.1',
    '3.7.1', '3.7.2',
    '3.8.1', '3.8.2',
    '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8'
];

// Các từ khóa thủ tục của đơn vị khác (UBND cấp xã/huyện, Phòng TNMT, Xây dựng, Tư pháp, Thuế...) dễ bị nhập nhầm
const FOREIGN_UNIT_PROCEDURE_KEYWORDS = [
    'lần đầu',
    'cấp lần đầu',
    'đăng ký đất đai lần đầu',
    'giao đất',
    'cho thuê đất',
    'thu hồi đất',
    'bồi thường',
    'hỗ trợ, tái định cư',
    'tái định cư',
    'giải phóng mặt bằng',
    'phải xin phép',
    'xin phép chuyển mục đích',
    'cấp phép xây dựng',
    'giấy phép xây dựng',
    'hoàn công',
    'chứng thực',
    'hộ tịch',
    'khai sinh',
    'kết hôn',
    'khai tử',
    'hòa giải',
    'tranh chấp đất đai',
    'giải quyết tranh chấp',
    'khiếu nại',
    'tố cáo',
    'đấu giá quyền sử dụng đất',
    'khoáng sản',
    'môi trường',
    'tài nguyên nước',
    'miễn, giảm tiền sử dụng đất',
    'xác định giá đất',
    'quyết định giá đất'
];

const OFFICIAL_WARDS_SET = new Set<string>(DEFAULT_WARDS.map(w => w.toLowerCase()));

// Địa bàn ngoài phần mềm (Minh Hưng, Chơn Thành, Nha Bích) — nếu địa chỉ thửa đất hoặc xã/phường chứa các địa danh này thì tự động coi là hồ sơ ngoài phần mềm
const FOREIGN_LAND_PLOT_LOCATIONS: Array<{ label: string; patterns: string[] }> = [
    { label: 'Minh Hưng', patterns: ['minh hưng', 'minh hung', 'minhhung'] },
    { label: 'Chơn Thành', patterns: ['chơn thành', 'chon thanh', 'chonthanh'] },
    { label: 'Nha Bích', patterns: ['nha bích', 'nha bich', 'nhabich'] }
];

export const detectForeignLandPlotLocation = (rec: RecordFile): string | null => {
    const landPlotText = [rec.address, rec.ward, rec.group, rec.handoverWard]
        .filter(Boolean)
        .join(' | ')
        .toLowerCase()
        .normalize('NFC');

    if (!landPlotText) return null;

    const matched: string[] = [];
    for (const loc of FOREIGN_LAND_PLOT_LOCATIONS) {
        if (loc.patterns.some(p => landPlotText.includes(p))) {
            matched.push(loc.label);
        }
    }

    return matched.length > 0 ? matched.join(', ') : null;
};

/**
 * Phân tích một hồ sơ xem có phải là hồ sơ sai loại thủ tục / nhập nhầm từ đơn vị khác hay không
 */
export const analyzeForeignProcedureRecord = (
    rec: RecordFile,
    options: {
        requireStandardCodePrefix?: boolean;
        includeEmptyProcedure?: boolean;
        includeForeignWard?: boolean;
    } = {}
): ForeignProcedureRecordItem => {
    const rawType = String(rec.recordType || '').trim();
    const rawContent = String(rec.content || '').trim();
    const effectiveTypeStr = rawType || rawContent;
    const lowerEffective = effectiveTypeStr.toLowerCase().normalize('NFC');

    const shortMapped = effectiveTypeStr ? getShortRecordType(effectiveTypeStr) : '';
    const lowerShort = shortMapped.trim().toLowerCase();

    // Kiểm tra có khớp với 22 thủ tục chuẩn không
    const isMatchedInOfficialSet =
        Boolean(effectiveTypeStr) &&
        (OFFICIAL_SHORT_TYPES_SET.has(lowerShort) ||
            OFFICIAL_SHORT_TYPES_SET.has(lowerEffective) ||
            OFFICIAL_FULL_TYPES_SET.has(lowerEffective));

    // Kiểm tra có chứa từ khóa thủ tục của đơn vị khác (VD: "cấp GCN lần đầu", "giao đất", "cho thuê đất", "xây dựng"...)
    const matchedForeignKeyword = FOREIGN_UNIT_PROCEDURE_KEYWORDS.find(kw =>
        lowerEffective.includes(kw) || rawContent.toLowerCase().normalize('NFC').includes(kw)
    );
    const isForeignKeywordMatch = Boolean(matchedForeignKeyword);

    // Kiểm tra tiền tố mã số thủ tục (1.1 -> 3.8.2)
    const hasStandardPrefix = OFFICIAL_CODE_PREFIXES.some(
        prefix => lowerEffective.startsWith(prefix) || lowerShort.startsWith(prefix)
    );
    const isMissingCodePrefix = Boolean(effectiveTypeStr) && !hasStandardPrefix;

    // Kiểm tra địa chỉ thửa đất thuộc Minh Hưng, Chơn Thành, Nha Bích (luôn tự động bắt là hồ sơ ngoài phần mềm)
    const matchedChonThanhLocation = detectForeignLandPlotLocation(rec);

    // Kiểm tra xã/phường ngoài 4 xã/phường của đơn vị
    const normWard = getNormalizedWard(rec.ward).toLowerCase();
    const isForeignWard = Boolean(matchedChonThanhLocation) || (Boolean(normWard) && !OFFICIAL_WARDS_SET.has(normWard));

    const isOfficialType = isMatchedInOfficialSet && !isForeignKeywordMatch;

    const reasons: string[] = [];
    if (!effectiveTypeStr) {
        if (options.includeEmptyProcedure) {
            reasons.push('Trống loại thủ tục (recordType & content đều rỗng)');
        }
    } else {
        if (!isMatchedInOfficialSet) {
            reasons.push(`Thủ tục lạ không có trong phần mềm: "${effectiveTypeStr}"`);
        }
        if (isForeignKeywordMatch) {
            reasons.push(`Thủ tục thuộc thẩm quyền đơn vị khác (chứa "${matchedForeignKeyword}")`);
        }
        if (options.requireStandardCodePrefix && !rawType.match(/^[123]\.\d+/)) {
            reasons.push(`Tên thủ tục gốc không đánh mã chuẩn 1.x / 2.x / 3.x: "${rawType || '(Trống)'}"`);
        }
    }

    if (matchedChonThanhLocation) {
        const fullLandAddr = [rec.address, rec.ward].filter(Boolean).join(' - ') || matchedChonThanhLocation;
        reasons.push(`Địa chỉ thửa đất thuộc ${matchedChonThanhLocation} (hồ sơ ngoài phần mềm): "${fullLandAddr}"`);
    } else if (options.includeForeignWard && isForeignWard) {
        reasons.push(`Địa bàn Xã/Phường ngoài đơn vị: "${rec.ward}"`);
    }

    return {
        record: rec,
        rawType: rawType || '(Trống loại thủ tục)',
        rawContent,
        normalizedShortType: shortMapped || '(Không xác định)',
        isOfficialType,
        isForeignKeywordMatch,
        isMissingCodePrefix,
        isForeignWard,
        reasons
    };
};

const STATUS_WORKFLOW_RANK: Record<string, number> = {
    [RecordStatus.RECEIVED]: 10,
    [RecordStatus.WITHDRAWN]: 20,
    [RecordStatus.REJECTED]: 20,
    [RecordStatus.PENDING_SUPPLEMENT]: 22,
    [RecordStatus.ASSIGNED]: 25,
    [RecordStatus.IN_PROGRESS]: 35,
    [RecordStatus.FIELD_WORK]: 38,
    [RecordStatus.OFFICE_WORK]: 42,
    [RecordStatus.APPRAISAL]: 48,
    [RecordStatus.PENDING_POSTING]: 52,
    [RecordStatus.COMPLETED_WORK]: 55,
    [RecordStatus.PENDING_CHECK]: 60,
    [RecordStatus.TAX_TRANSFER]: 63,
    [RecordStatus.PENDING_TAX_KV7]: 65,
    [RecordStatus.PENDING_TAX_NOTICE]: 67,
    [RecordStatus.PENDING_TAX_PAYMENT]: 70,
    [RecordStatus.PENDING_SIGN]: 75,
    [RecordStatus.PENDING_PRINT_CERT]: 80,
    [RecordStatus.PENDING_HANDOVER]: 84,
    [RecordStatus.SIGNED]: 88,
    [RecordStatus.HANDOVER]: 100,
    [RecordStatus.RETURNED]: 110
};

const getStatusRank = (status?: RecordStatus | string | null): number => {
    if (!status) return 0;
    const raw = String(status).trim();
    if (STATUS_WORKFLOW_RANK[raw] !== undefined) {
        return STATUS_WORKFLOW_RANK[raw];
    }
    const upper = raw.toUpperCase();
    if (STATUS_WORKFLOW_RANK[upper] !== undefined) {
        return STATUS_WORKFLOW_RANK[upper];
    }
    if (raw === 'Đã trả kết quả') return 110;
    if (raw === 'Đã giao 1 cửa' || upper === 'COMPLETED' || upper === 'HANDED_OVER' || upper === 'GIAO_1_CUA') return 100;
    if (raw === 'Đã ký' || raw === 'Đã ký duyệt') return 88;
    if (raw === 'Chờ ký duyệt' || raw === 'Trình ký') return 75;
    if (raw === 'Chờ kiểm tra') return 60;
    if (raw === 'Đã thực hiện') return 55;
    if (raw === 'Đang thực hiện') return 35;
    if (raw === 'Giao nhân viên') return 25;
    if (raw === 'Tiếp nhận') return 10;
    return 5;
};

const getStatusDisplayLabel = (status?: RecordStatus | string | null): string => {
    if (!status) return 'Chưa có trạng thái';
    const key = String(status).trim() as RecordStatus;
    return STATUS_LABELS[key] || String(status);
};

// Danh mục các trường THÔNG TIN ĐẦU VÀO (Ưu tiên cao nhất khi chọn bản giữ lại)
const INPUT_FIELD_DEFINITIONS: Array<{
    key: keyof RecordFile;
    label: string;
    weight: number;
    isCriticalInput?: boolean;
}> = [
    { key: 'customerName', label: 'Họ tên CSD', weight: 25, isCriticalInput: true },
    { key: 'phoneNumber', label: 'Số điện thoại', weight: 32, isCriticalInput: true },
    { key: 'cccd', label: 'Số CCCD', weight: 32, isCriticalInput: true },
    { key: 'customerAddress', label: 'Địa chỉ chủ SD', weight: 26, isCriticalInput: true },
    { key: 'address', label: 'Địa chỉ thửa đất', weight: 22, isCriticalInput: true },
    { key: 'ward', label: 'Xã/Phường', weight: 16, isCriticalInput: true },
    { key: 'mapSheet', label: 'Số tờ', weight: 15, isCriticalInput: true },
    { key: 'landPlot', label: 'Số thửa', weight: 15, isCriticalInput: true },
    { key: 'area', label: 'Diện tích', weight: 12 },
    { key: 'residentialArea', label: 'Đất ở', weight: 8 },
    { key: 'recordType', label: 'Loại hồ sơ', weight: 14 },
    { key: 'content', label: 'Nội dung', weight: 10 },
    { key: 'receivedDate', label: 'Ngày tiếp nhận', weight: 10 },
    { key: 'deadline', label: 'Ngày hẹn trả', weight: 10 },
    { key: 'certificateOwner', label: 'Người đứng tên GCN', weight: 10 },
    { key: 'certificateOwners', label: 'Đồng sở hữu GCN', weight: 10 },
    { key: 'issueNumber', label: 'Số phát hành GCN', weight: 9 },
    { key: 'entryNumber', label: 'Số vào sổ GCN', weight: 9 },
    { key: 'issueDate', label: 'Ngày cấp GCN', weight: 8 },
    { key: 'authorizedBy', label: 'Người ủy quyền', weight: 8 },
    { key: 'authDocType', label: 'Giấy ủy quyền', weight: 6 },
    { key: 'otherDocs', label: 'Giấy tờ khác', weight: 6 },
    { key: 'attachedFiles', label: 'Tệp đính kèm', weight: 10 },
    { key: 'dossierComponents', label: 'Thành phần hồ sơ', weight: 10 }
];

// Danh mục các trường QUY TRÌNH & TIẾN ĐỘ XỬ LÝ
const WORKFLOW_FIELD_DEFINITIONS: Array<{
    key: keyof RecordFile;
    label: string;
    weight: number;
}> = [
    { key: 'assignedTo', label: 'Chuyên viên xử lý', weight: 12 },
    { key: 'assignedDate', label: 'Ngày giao việc', weight: 8 },
    { key: 'surveyorId', label: 'NV Ngoại nghiệp', weight: 8 },
    { key: 'surveyAssignedDate', label: 'Ngày giao ngoại nghiệp', weight: 5 },
    { key: 'fieldAssignedDate', label: 'Ngày giao đo đạc', weight: 5 },
    { key: 'fieldCompletedDate', label: 'Ngày xong ngoại nghiệp', weight: 8 },
    { key: 'drafterId', label: 'NV Nội nghiệp', weight: 8 },
    { key: 'officeAssignedDate', label: 'Ngày giao nội nghiệp', weight: 5 },
    { key: 'officeCompletedDate', label: 'Ngày xong nội nghiệp', weight: 8 },
    { key: 'completedWorkDate', label: 'Ngày thực hiện xong', weight: 10 },
    { key: 'pendingCheckDate', label: 'Ngày trình kiểm tra', weight: 8 },
    { key: 'checkedBy', label: 'Người kiểm tra', weight: 8 },
    { key: 'checkedDate', label: 'Ngày kiểm tra', weight: 8 },
    { key: 'submissionDate', label: 'Ngày trình ký', weight: 12 },
    { key: 'submittedTo', label: 'Người ký duyệt', weight: 8 },
    { key: 'approvalDate', label: 'Ngày ký duyệt', weight: 14 },
    { key: 'completedDate', label: 'Ngày hoàn thành', weight: 14 },
    { key: 'exportBatch', label: 'Đợt bàn giao 1 cửa', weight: 16 },
    { key: 'exportDate', label: 'Ngày bàn giao 1 cửa', weight: 16 },
    { key: 'handoverWard', label: 'Nơi bàn giao', weight: 6 },
    { key: 'isHandedOver', label: 'Cờ đã giao 1 cửa', weight: 8 },
    { key: 'measurementNumber', label: 'Số trích đo', weight: 10 },
    { key: 'excerptNumber', label: 'Số trích lục', weight: 10 },
    { key: 'receiptNumber', label: 'Số biên lai', weight: 10 },
    { key: 'receiptType', label: 'Loại chứng từ', weight: 5 },
    { key: 'receiverName', label: 'Người nhận KQ', weight: 8 },
    { key: 'returnedBy', label: 'Người trả KQ', weight: 6 },
    { key: 'resultReturnedDate', label: 'Ngày trả kết quả', weight: 14 },
    { key: 'returnedPrice', label: 'Tiền thu thực tế', weight: 6 },
    { key: 'returnBatch', label: 'Đợt trả KQ', weight: 6 },
    { key: 'returnBatchDate', label: 'Ngày chốt đợt trả', weight: 6 },
    { key: 'returnHandoverDept', label: 'Phòng nhận bàn giao', weight: 5 },
    { key: 'needsMapCorrection', label: 'Cần chỉnh lý BĐ', weight: 5 },
    { key: 'explanationPlan', label: 'Phương án giải trình', weight: 6 },
    { key: 'price', label: 'Đơn giá', weight: 6 },
    { key: 'advancePayment', label: 'Tạm ứng', weight: 5 },
    { key: 'archiveHandoverDate', label: 'Ngày giao kho lưu', weight: 8 },
    { key: 'archiveHandoverBatch', label: 'Đợt giao kho lưu', weight: 8 },
    { key: 'appraisalStaff', label: 'CB Thẩm định', weight: 8 },
    { key: 'appraisalDate', label: 'Ngày thẩm định', weight: 8 },
    { key: 'postingDate', label: 'Ngày niêm yết xã', weight: 8 },
    { key: 'postingEndDate', label: 'Hạn niêm yết xã', weight: 6 },
    { key: 'taxStaff', label: 'CB Chuyển thuế', weight: 8 },
    { key: 'taxTransferStaff', label: 'CB Thuế (đồng bộ)', weight: 5 },
    { key: 'taxTransferAssignedDate', label: 'Ngày giao thuế', weight: 6 },
    { key: 'taxTransferDate', label: 'Ngày chuyển thuế', weight: 8 },
    { key: 'taxKv7Date', label: 'Ngày thuế KV7', weight: 6 },
    { key: 'taxNoticeDate', label: 'Ngày thông báo thuế', weight: 8 },
    { key: 'taxPaymentDate', label: 'Ngày nộp thuế', weight: 8 },
    { key: 'printCertDate', label: 'Ngày in GCN', weight: 10 },
    { key: 'pendingHandoverDate', label: 'Ngày chờ bàn giao', weight: 8 },
    { key: 'printStaff', label: 'CB In GCN', weight: 6 },
    { key: 'printStaffId', label: 'Mã CB In GCN', weight: 5 },
    { key: 'printStaffAssignedAt', label: 'Ngày giao in GCN', weight: 5 },
    { key: 'printAssignmentStatus', label: 'Trạng thái giao in', weight: 5 },
    { key: 'printDeadlineStartAt', label: 'Mốc tính hạn in', weight: 5 },
    { key: 'paymentReceivedAt', label: 'Ngày nhận GNT', weight: 6 },
    { key: 'paymentReceiptDate', label: 'Ngày biên lai thuế', weight: 6 }
];

export const evaluateRecordQuality = (rec: RecordFile): RecordQualityAssessment => {
    let inputScore = 0;
    const presentInputLabels: string[] = [];
    const missingInputLabels: string[] = [];

    for (const def of INPUT_FIELD_DEFINITIONS) {
        const val = rec[def.key];
        if (hasValidValue(val)) {
            inputScore += def.weight;
            if (typeof val === 'string' && (def.key === 'customerAddress' || def.key === 'address' || def.key === 'customerName')) {
                inputScore += Math.min(5, Math.floor(val.trim().length / 10));
            }
            presentInputLabels.push(def.label);
        } else if (def.isCriticalInput) {
            missingInputLabels.push(def.label);
        }
    }

    const statusRank = getStatusRank(rec.status);
    let workflowScore = statusRank;
    const presentWorkflowLabels: string[] = [];

    for (const wDef of WORKFLOW_FIELD_DEFINITIONS) {
        const val = rec[wDef.key];
        if (hasValidValue(val)) {
            workflowScore += wDef.weight;
            presentWorkflowLabels.push(wDef.label);
        }
    }

    if (Array.isArray(rec.statusLogs) && rec.statusLogs.length > 0) {
        workflowScore += Math.min(20, rec.statusLogs.length * 3);
        presentWorkflowLabels.push(`Lịch sử (${rec.statusLogs.length} bước)`);
    }

    const totalScore = inputScore * 2.5 + workflowScore;

    return {
        recordId: rec.id,
        inputScore,
        workflowScore,
        totalScore,
        statusRank,
        presentInputLabels,
        missingInputLabels,
        presentWorkflowLabels
    };
};

export const buildMergedKeepRecord = (
    keepRecord: RecordFile,
    donorRecords: RecordFile[]
): MergePreviewInfo => {
    const merged: RecordFile = { ...keepRecord };
    const filledInputFields: string[] = [];
    const filledWorkflowFields: string[] = [];
    let upgradedStatus: { from: string; to: string } | undefined = undefined;
    let hasChanges = false;

    const sortedDonors = [...donorRecords].sort(
        (a, b) => evaluateRecordQuality(b).workflowScore - evaluateRecordQuality(a).workflowScore
    );

    for (const donor of sortedDonors) {
        if (!donor || donor.id === keepRecord.id) continue;

        const currentRank = getStatusRank(merged.status);
        const donorRank = getStatusRank(donor.status);
        const donorHasHigherWorkflow = donorRank > currentRank;

        if (donorHasHigherWorkflow && donor.status) {
            const oldLabel = getStatusDisplayLabel(merged.status);
            const newLabel = getStatusDisplayLabel(donor.status);
            merged.status = donor.status;
            upgradedStatus = { from: oldLabel, to: newLabel };
            hasChanges = true;
        }

        for (const wDef of WORKFLOW_FIELD_DEFINITIONS) {
            const key = wDef.key;
            const keepVal = merged[key];
            const donorVal = donor[key];

            if (!hasValidValue(donorVal)) continue;

            if (!hasValidValue(keepVal) || (donorHasHigherWorkflow && String(keepVal) !== String(donorVal))) {
                (merged as any)[key] = donorVal;
                if (!filledWorkflowFields.includes(wDef.label)) {
                    filledWorkflowFields.push(wDef.label);
                }
                hasChanges = true;
            }
        }

        if (donor.is_handover && !merged.is_handover) {
            merged.is_handover = true;
            hasChanges = true;
        }
        if (hasValidValue(donor.handover_date) && !hasValidValue(merged.handover_date)) {
            merged.handover_date = donor.handover_date;
            hasChanges = true;
        }

        for (const iDef of INPUT_FIELD_DEFINITIONS) {
            const key = iDef.key;
            const keepVal = merged[key];
            const donorVal = donor[key];

            if (!hasValidValue(donorVal)) continue;

            if (!hasValidValue(keepVal)) {
                (merged as any)[key] = donorVal;
                if (!filledInputFields.includes(iDef.label)) {
                    filledInputFields.push(iDef.label);
                }
                hasChanges = true;
            } else if (
                (key === 'customerAddress' || key === 'address') &&
                typeof keepVal === 'string' &&
                typeof donorVal === 'string' &&
                donorVal.trim().length > keepVal.trim().length + 8
            ) {
                (merged as any)[key] = donorVal;
                if (!filledInputFields.includes(iDef.label)) {
                    filledInputFields.push(`${iDef.label} (chi tiết hơn)`);
                }
                hasChanges = true;
            }
        }

        const noteKeys: Array<{ key: 'notes' | 'privateNotes' | 'personalNotes'; label: string }> = [
            { key: 'notes', label: 'Ghi chú' },
            { key: 'privateNotes', label: 'Ghi chú nội bộ' },
            { key: 'personalNotes', label: 'Ghi chú cá nhân' }
        ];
        for (const nItem of noteKeys) {
            const kVal = String(merged[nItem.key] || '').trim();
            const dVal = String(donor[nItem.key] || '').trim();
            if (dVal && !kVal) {
                merged[nItem.key] = dVal;
                if (!filledWorkflowFields.includes(nItem.label)) {
                    filledWorkflowFields.push(nItem.label);
                }
                hasChanges = true;
            } else if (dVal && kVal && !kVal.toLowerCase().includes(dVal.toLowerCase())) {
                merged[nItem.key] = `${kVal} | ${dVal}`;
                if (!filledWorkflowFields.includes(nItem.label)) {
                    filledWorkflowFields.push(nItem.label);
                }
                hasChanges = true;
            }
        }

        // 5. Hợp nhất Lịch sử xử lý (statusLogs)
        if (Array.isArray(donor.statusLogs) && donor.statusLogs.length > 0) {
            const currentLogs = Array.isArray(merged.statusLogs) ? [...merged.statusLogs] : [];
            const getLogUniqueKey = (l: any) =>
                `${l.newStatus || l.status || ''}_${l.changedAt || l.timestamp || ''}_${l.note || l.action || ''}`;
            const seenLogKeys = new Set(currentLogs.map(getLogUniqueKey));
            let addedLogs = 0;
            for (const dLog of donor.statusLogs) {
                const logKey = getLogUniqueKey(dLog);
                if (!seenLogKeys.has(logKey)) {
                    seenLogKeys.add(logKey);
                    currentLogs.push(dLog);
                    addedLogs++;
                }
            }
            if (addedLogs > 0) {
                currentLogs.sort((a: any, b: any) => {
                    const tA = new Date(a.changedAt || a.timestamp || 0).getTime();
                    const tB = new Date(b.changedAt || b.timestamp || 0).getTime();
                    return tA - tB;
                });
                merged.statusLogs = currentLogs;
                if (!filledWorkflowFields.includes('Lịch sử quy trình')) {
                    filledWorkflowFields.push('Lịch sử quy trình');
                }
                hasChanges = true;
            }
        }

        if (donor.data && typeof donor.data === 'object') {
            const currentData = (merged.data && typeof merged.data === 'object') ? { ...merged.data } : {};
            let dataChanged = false;
            for (const [dKey, dVal] of Object.entries(donor.data)) {
                if (hasValidValue(dVal) && !hasValidValue(currentData[dKey])) {
                    currentData[dKey] = dVal;
                    dataChanged = true;
                }
            }
            if (dataChanged) {
                merged.data = currentData;
                hasChanges = true;
            }
        }
    }

    return {
        hasChanges,
        upgradedStatus,
        filledInputFields,
        filledWorkflowFields,
        mergedRecord: merged
    };
};

export const DuplicateRemovalTab: React.FC<DuplicateRemovalTabProps> = ({
    records = [],
    notify,
    onDeleteBatchRecords,
    onRefreshData
}) => {
    // 3 chế độ dọn dẹp CSDL:
    // - 'DUPLICATE': Lọc trùng Mã hồ sơ & Gộp quy trình
    // - 'FOREIGN_PROCEDURES': Loại bỏ hồ sơ sai loại thủ tục / nhập nhầm của đơn vị khác
    // - 'EMPTY_RECORDS': Loại bỏ hồ sơ rỗng không có thông tin
    const [subMode, setSubMode] = useState<'DUPLICATE' | 'FOREIGN_PROCEDURES' | 'EMPTY_RECORDS'>('DUPLICATE');

    // --- STATE CHO PHẦN LỌC TRÙNG & HỢP NHẤT THÔNG MINH ---
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTable, setFilterTable] = useState<'ALL' | 'land_records' | 'dangky_records' | 'luutru_records'>('ALL');
    const [duplicateMatchMode, setDuplicateMatchMode] = useState<'BY_CODE' | 'STRICT_4_FIELDS'>('BY_CODE');
    const [onlyShowWorkflowDiff, setOnlyShowWorkflowDiff] = useState(false);
    const [autoMergeBeforeDelete, setAutoMergeBeforeDelete] = useState(true);
    const [manualKeepByGroup, setManualKeepByGroup] = useState<Record<string, string>>({});
    const [selectedDeleteIds, setSelectedDeleteIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [isScanningDbDuplicates, setIsScanningDbDuplicates] = useState(false);
    const [dbScannedRecords, setDbScannedRecords] = useState<RecordFile[] | null>(null);
    const [processingGroupKey, setProcessingGroupKey] = useState<string | null>(null);

    // --- STATE CHO PHẦN LOẠI BỎ HỒ SƠ SAI THỦ TỤC / ĐƠN VỊ KHÁC ---
    const [foreignSearchTerm, setForeignSearchTerm] = useState('');
    const [foreignTableFilter, setForeignTableFilter] = useState<'ALL' | 'land_records' | 'dangky_records' | 'luutru_records'>('ALL');
    const [requireStandardCodePrefix, setRequireStandardCodePrefix] = useState(false);
    const [includeEmptyProcedure, setIncludeEmptyProcedure] = useState(false);
    const [includeForeignWard, setIncludeForeignWard] = useState(false);
    const [customSelectedRawTypes, setCustomSelectedRawTypes] = useState<Set<string>>(new Set());
    const [showAllDbTypesExplorer, setShowAllDbTypesExplorer] = useState(false);
    const [selectedForeignDeleteIds, setSelectedForeignDeleteIds] = useState<Set<string>>(new Set());
    const [isDeletingForeign, setIsDeletingForeign] = useState(false);

    // --- STATE CHO PHẦN HỒ SƠ KHÔNG CÓ THÔNG TIN (HỒ SƠ RỖNG) ---
    const [isScanningEmpty, setIsScanningEmpty] = useState(false);
    const [emptyScanResults, setEmptyScanResults] = useState<EmptyRecordScanResult[]>([]);
    const [selectedEmptyIds, setSelectedEmptyIds] = useState<Set<string>>(new Set());
    const [emptyTableFilter, setEmptyTableFilter] = useState<'ALL' | 'land_records' | 'dangky_records' | 'luutru_records' | 'LOCAL'>('ALL');
    const [emptySearchTerm, setEmptySearchTerm] = useState('');
    const [isDeletingEmpty, setIsDeletingEmpty] = useState(false);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
    const [emptyStats, setEmptyStats] = useState({
        totalEmpty: 0,
        landCount: 0,
        dangkyCount: 0,
        luutruCount: 0,
        localCount: 0
    });

    // --- CẤU HÌNH PHÂN MẢNH XỬ LÝ LẦN LƯỢT (CHỐNG GIẬT LAG DỮ LIỆU) ---
    const [chunkSize, setChunkSize] = useState<number>(25);
    const [chunkProgress, setChunkProgress] = useState<{
        active: boolean;
        phase: string;
        currentChunk: number;
        totalChunks: number;
        processedItems: number;
        totalItems: number;
    } | null>(null);
    const cancelBatchRef = React.useRef<boolean>(false);

    // Giới hạn số lượng dòng render trên DOM mỗi lần để chống giật lag giao diện khi có hàng trăm/ngàn hồ sơ
    const [duplicateRenderLimit, setDuplicateRenderLimit] = useState<number>(40);
    const [foreignRenderLimit, setForeignRenderLimit] = useState<number>(50);
    const [emptyRenderLimit, setEmptyRenderLimit] = useState<number>(50);

    // Helper nhường luồng chính (Main Thread) giữa mỗi lô để UI mượt 60fps
    const yieldToMain = (ms = 65) => new Promise<void>(resolve => setTimeout(resolve, ms));

    const isScanningRef = React.useRef(false);
    const recordsRef = React.useRef(records);
    recordsRef.current = records;
    const notifyRef = React.useRef(notify);
    notifyRef.current = notify;

    // Quét sâu trực tiếp 3 bảng Supabase
    const handleDeepScanDuplicatesFromDb = useCallback(async (isManual = false) => {
        if (!isConfigured) {
            if (isManual) notifyRef.current('Chế độ Offline: Đang sử dụng dữ liệu trên bộ nhớ ứng dụng.', 'info');
            return;
        }
        setIsScanningDbDuplicates(true);
        try {
            const tables: Array<'land_records' | 'dangky_records' | 'luutru_records'> = [
                'land_records',
                'dangky_records',
                'luutru_records'
            ];
            const allRows: RecordFile[] = [];
            const seenTableId = new Set<string>();

            await Promise.allSettled(
                tables.map(async (tbl) => {
                    const step = 1000;
                    let from = 0;
                    while (from < 10000) {
                        const { data, error } = await supabase
                            .from(tbl)
                            .select('*')
                            .range(from, from + step - 1);
                        if (error || !data || data.length === 0) break;
                        for (const raw of data) {
                            const mapped = mapRecordFromDb({ ...raw, sourceTable: tbl });
                            if (mapped && mapped.id) {
                                const uniqueKey = `${tbl}:${mapped.id}`;
                                if (!seenTableId.has(uniqueKey)) {
                                    seenTableId.add(uniqueKey);
                                    allRows.push({ ...mapped, sourceTable: tbl });
                                }
                            }
                        }
                        if (data.length < step) break;
                        from += step;
                    }
                })
            );

            for (const localRec of recordsRef.current) {
                if (!localRec || !localRec.id) continue;
                const tbl = localRec.sourceTable || 'land_records';
                const uniqueKey = `${tbl}:${localRec.id}`;
                if (!seenTableId.has(uniqueKey)) {
                    seenTableId.add(uniqueKey);
                    allRows.push(localRec);
                }
            }

            setDbScannedRecords(allRows);
            if (isManual) {
                notifyRef.current(`Đã quét sâu CSDL: Tổng cộng ${allRows.length} bản ghi trên cả 3 bảng.`, 'success');
            }
        } catch (err: any) {
            console.warn('[DUPLICATE_SCAN] Deep scan error:', err);
            if (isManual) {
                notifyRef.current(`Lỗi khi quét CSDL: ${err?.message || 'Không xác định'}`, 'error');
            }
        } finally {
            setIsScanningDbDuplicates(false);
        }
    }, []);

    // 1. Quét hồ sơ không có thông tin từ CSDL và Local State
    const handleScanEmptyRecords = useCallback(async (isManualTrigger = false) => {
        if (isScanningRef.current) return;
        isScanningRef.current = true;
        setIsScanningEmpty(true);
        try {
            const scan = await scanEmptyRecordsInDatabaseDirect(recordsRef.current);
            setEmptyScanResults(scan.results);
            setEmptyStats(scan.stats);
            setSelectedEmptyIds(new Set(scan.results.map(r => `${r.table}:${r.id}`)));
            if (isManualTrigger) {
                if (scan.results.length === 0) {
                    notifyRef.current("Không phát hiện hồ sơ rỗng/không có thông tin nào trong CSDL!", "success");
                } else {
                    notifyRef.current(`Đã quét xong: Phát hiện ${scan.results.length} hồ sơ không có thông tin cần xử lý.`, "info");
                }
            }
        } catch (err: any) {
            console.error("Scan empty records error:", err);
            if (isManualTrigger) {
                notifyRef.current(`Lỗi khi quét hồ sơ không có thông tin: ${err?.message || 'Lỗi không xác định'}`, "error");
            }
        } finally {
            setIsScanningEmpty(false);
            isScanningRef.current = false;
        }
    }, []);

    useEffect(() => {
        handleScanEmptyRecords(false);
        handleDeepScanDuplicatesFromDb(false);
    }, [handleScanEmptyRecords, handleDeepScanDuplicatesFromDb]);

    // Nguồn dữ liệu hợp nhất từ 3 bảng DB + bộ nhớ
    const effectiveRecords = useMemo(() => {
        if (!dbScannedRecords || dbScannedRecords.length === 0) return records;
        const mapByComposite = new Map<string, RecordFile>();
        for (const r of dbScannedRecords) {
            if (!r || !r.id) continue;
            mapByComposite.set(`${r.sourceTable || 'land_records'}:${r.id}`, r);
        }
        for (const r of records) {
            if (!r || !r.id) continue;
            const key = `${r.sourceTable || 'land_records'}:${r.id}`;
            if (!mapByComposite.has(key)) {
                mapByComposite.set(key, r);
            } else {
                mapByComposite.set(key, { ...mapByComposite.get(key)!, ...r });
            }
        }
        return Array.from(mapByComposite.values());
    }, [dbScannedRecords, records]);

    // ============================================================================
    // LOGIC TAB 3: PHÁT HIỆN & LOẠI BỎ HỒ SƠ SAI LOẠI THỦ TỤC (ĐƠN VỊ KHÁC)
    // ============================================================================
    // Bảng tổng hợp tất cả các chuỗi recordType thực tế đang tồn tại trong CSDL
    const allDatabaseTypeSummary = useMemo(() => {
        const typeMap = new Map<string, {
            rawType: string;
            shortType: string;
            count: number;
            isAutoFlaggedForeign: boolean;
        }>();

        for (const r of effectiveRecords) {
            if (!r || !r.id) continue;
            if (foreignTableFilter !== 'ALL' && r.sourceTable && r.sourceTable !== foreignTableFilter) continue;

            const analysis = analyzeForeignProcedureRecord(r, {
                requireStandardCodePrefix,
                includeEmptyProcedure: true,
                includeForeignWard: false
            });
            const key = analysis.rawType;
            const existing = typeMap.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                typeMap.set(key, {
                    rawType: key,
                    shortType: analysis.normalizedShortType,
                    count: 1,
                    isAutoFlaggedForeign: !analysis.isOfficialType
                });
            }
        }

        return Array.from(typeMap.values()).sort((a, b) => {
            if (a.isAutoFlaggedForeign !== b.isAutoFlaggedForeign) {
                return a.isAutoFlaggedForeign ? -1 : 1;
            }
            return b.count - a.count;
        });
    }, [effectiveRecords, foreignTableFilter, requireStandardCodePrefix]);

    // Danh sách các hồ sơ bị phát hiện là thủ tục của đơn vị khác (hoặc thuộc loại thủ tục người dùng tick chọn thêm)
    const foreignProcedureItems: ForeignProcedureRecordItem[] = useMemo(() => {
        const list: ForeignProcedureRecordItem[] = [];

        for (const r of effectiveRecords) {
            if (!r || !r.id) continue;
            if (foreignTableFilter !== 'ALL' && r.sourceTable && r.sourceTable !== foreignTableFilter) continue;

            const item = analyzeForeignProcedureRecord(r, {
                requireStandardCodePrefix,
                includeEmptyProcedure,
                includeForeignWard
            });

            const isManuallyPickedType = customSelectedRawTypes.has(item.rawType);
            if (item.reasons.length > 0 || isManuallyPickedType) {
                if (isManuallyPickedType && item.reasons.length === 0) {
                    item.reasons.push(`Được chọn lọc thủ công theo tên thủ tục: "${item.rawType}"`);
                }
                list.push(item);
            }
        }

        return list;
    }, [effectiveRecords, foreignTableFilter, requireStandardCodePrefix, includeEmptyProcedure, includeForeignWard, customSelectedRawTypes]);

    const filteredForeignItems = useMemo(() => {
        if (!foreignSearchTerm.trim()) return foreignProcedureItems;
        const lower = foreignSearchTerm.toLowerCase();
        return foreignProcedureItems.filter(item => {
            const r = item.record;
            return (
                String(r.code || '').toLowerCase().includes(lower) ||
                String(r.customerName || '').toLowerCase().includes(lower) ||
                item.rawType.toLowerCase().includes(lower) ||
                item.rawContent.toLowerCase().includes(lower) ||
                String(r.ward || '').toLowerCase().includes(lower) ||
                String(r.address || '').toLowerCase().includes(lower) ||
                item.reasons.some(reason => reason.toLowerCase().includes(lower))
            );
        });
    }, [foreignProcedureItems, foreignSearchTerm]);

    // Mặc định chọn tất cả các hồ sơ sai thủ tục phát hiện được
    useEffect(() => {
        setSelectedForeignDeleteIds(new Set(foreignProcedureItems.map(item => item.record.id)));
    }, [foreignProcedureItems]);

    const handleToggleCustomRawType = (rawType: string) => {
        setCustomSelectedRawTypes(prev => {
            const next = new Set(prev);
            if (next.has(rawType)) next.delete(rawType);
            else next.add(rawType);
            return next;
        });
    };

    const handleToggleSelectByRawTypeGroup = (rawType: string) => {
        const idsInGroup = foreignProcedureItems
            .filter(i => i.rawType === rawType)
            .map(i => i.record.id);
        if (idsInGroup.length === 0) return;

        setSelectedForeignDeleteIds(prev => {
            const next = new Set(prev);
            const allSelected = idsInGroup.every(id => next.has(id));
            if (allSelected) {
                idsInGroup.forEach(id => next.delete(id));
            } else {
                idsInGroup.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const handleToggleAllForeign = () => {
        const visibleIds = filteredForeignItems.map(i => i.record.id);
        const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedForeignDeleteIds.has(id));
        if (allSelected) {
            setSelectedForeignDeleteIds(new Set());
        } else {
            setSelectedForeignDeleteIds(new Set(visibleIds));
        }
    };

    const handleToggleSingleForeign = (id: string) => {
        setSelectedForeignDeleteIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Gom nhóm thống kê theo tên thủ tục lạ trong kết quả đang hiển thị
    const foreignTypeBreakdown = useMemo(() => {
        const map = new Map<string, number>();
        for (const item of foreignProcedureItems) {
            map.set(item.rawType, (map.get(item.rawType) || 0) + 1);
        }
        return Array.from(map.entries())
            .map(([rawType, count]) => ({ rawType, count }))
            .sort((a, b) => b.count - a.count);
    }, [foreignProcedureItems]);

    // ============================================================================
    // LOGIC TAB 1: HỒ SƠ RỖNG KHÔNG CÓ THÔNG TIN
    // ============================================================================
    const filteredEmptyResults = useMemo(() => {
        return emptyScanResults.filter(r => {
            if (emptyTableFilter !== 'ALL' && r.table !== emptyTableFilter) return false;
            if (emptySearchTerm.trim()) {
                const term = emptySearchTerm.toLowerCase();
                const matchId = r.id.toLowerCase().includes(term);
                const matchCode = r.code.toLowerCase().includes(term);
                const matchName = r.customerName.toLowerCase().includes(term);
                const matchReason = r.reason.toLowerCase().includes(term);
                if (!matchId && !matchCode && !matchName && !matchReason) return false;
            }
            return true;
        });
    }, [emptyScanResults, emptyTableFilter, emptySearchTerm]);

    const handleToggleEmptyRecord = (table: string, id: string) => {
        const key = `${table}:${id}`;
        setSelectedEmptyIds(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleToggleAllEmpty = () => {
        const allKeys = filteredEmptyResults.map(r => `${r.table}:${r.id}`);
        const allSelected = allKeys.length > 0 && allKeys.every(k => selectedEmptyIds.has(k));
        if (allSelected) {
            setSelectedEmptyIds(new Set());
        } else {
            setSelectedEmptyIds(new Set(allKeys));
        }
    };

    const handleExecuteDeleteEmptyRecords = async (onlySingleChunk = false) => {
        const allItemsToDelete = emptyScanResults.filter(r => selectedEmptyIds.has(`${r.table}:${r.id}`));
        if (allItemsToDelete.length === 0) {
            notify("Vui lòng chọn ít nhất một hồ sơ không có thông tin để xóa!", "info");
            return;
        }

        const safeChunkSize = Math.max(10, chunkSize || 25);
        const itemsToDelete = onlySingleChunk ? allItemsToDelete.slice(0, safeChunkSize) : allItemsToDelete;
        const totalChunks = Math.ceil(itemsToDelete.length / safeChunkSize);

        const confirm = await confirmAction(
            `XÁC NHẬN XÓA PHÂN MẢNH HỒ SƠ RỖNG:\n\n` +
            `• Số lượng xóa: ${itemsToDelete.length} hồ sơ${onlySingleChunk ? ` (1 đợt đầu tiên ${safeChunkSize} HS)` : ''}\n` +
            `• Chế độ phân mảnh: Chia làm ${totalChunks} đợt (${safeChunkSize} hồ sơ/đợt) lần lượt để chống giật lag dữ liệu.`,
            'Xác nhận loại bỏ hồ sơ rác'
        );
        if (!confirm) return;

        setIsDeletingEmpty(true);
        cancelBatchRef.current = false;
        const deletedIdsSet = new Set<string>();
        const deletedCompositeSet = new Set<string>();

        try {
            for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
                if (cancelBatchRef.current) break;

                const slice = itemsToDelete.slice(chunkIdx * safeChunkSize, (chunkIdx + 1) * safeChunkSize);
                setChunkProgress({
                    active: true,
                    phase: `Đang xóa phân mảnh hồ sơ rỗng (Đợt ${chunkIdx + 1}/${totalChunks})`,
                    currentChunk: chunkIdx + 1,
                    totalChunks,
                    processedItems: deletedIdsSet.size,
                    totalItems: itemsToDelete.length
                });

                await deleteEmptyRecordsDirectly(
                    slice.map(r => ({ id: r.id, table: r.table }))
                );

                for (const item of slice) {
                    deletedIdsSet.add(item.id);
                    deletedCompositeSet.add(`${item.table}:${item.id}`);
                }

                setChunkProgress({
                    active: true,
                    phase: `Đã xóa xong đợt ${chunkIdx + 1}/${totalChunks}`,
                    currentChunk: chunkIdx + 1,
                    totalChunks,
                    processedItems: deletedIdsSet.size,
                    totalItems: itemsToDelete.length
                });

                // Nhường luồng UI giữa các đợt để không bị đơ/giật trình duyệt
                await yieldToMain(65);
            }

            const deletedIdsArray = Array.from(deletedIdsSet);

            // Đồng bộ Cache 1 lần duy nhất bằng Set O(N)
            if (deletedIdsSet.size > 0) {
                try {
                    const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
                    if (cached.length > 0) {
                        saveToCache(
                            CACHE_KEYS.RECORDS,
                            cached.filter(r => !deletedIdsSet.has(r.id))
                        );
                    }
                } catch {}
            }

            setEmptyScanResults(prev => prev.filter(r => !deletedCompositeSet.has(`${r.table}:${r.id}`)));
            setSelectedEmptyIds(prev => {
                const next = new Set(prev);
                deletedCompositeSet.forEach(k => next.delete(k));
                return next;
            });
            setDbScannedRecords(prev => (prev ? prev.filter(r => !deletedIdsSet.has(r.id)) : prev));

            notify(
                `Đã xóa phân mảnh thành công ${deletedIdsArray.length} hồ sơ rỗng (${totalChunks} đợt) mượt mà!`,
                'success'
            );

            if (onRefreshData) {
                await onRefreshData();
            }
        } catch (err: any) {
            console.error("Delete empty records error:", err);
            notify(`Lỗi khi xóa hồ sơ không có thông tin: ${err?.message || 'Lỗi Supabase'}`, 'error');
        } finally {
            setChunkProgress(null);
            setIsDeletingEmpty(false);
        }
    };

    // ============================================================================
    // LOGIC TAB 2: LỌC TRÙNG LẶP THÔNG MINH (ƯU TIÊN THÔNG TIN ĐẦU VÀO & BÙ QUY TRÌNH)
    // ============================================================================
    const duplicateGroups: DuplicateGroup[] = useMemo(() => {
        const groupsMap = new Map<string, RecordFile[]>();

        for (const r of effectiveRecords) {
            if (!r || !r.id) continue;
            if (filterTable !== 'ALL') {
                if (r.sourceTable && r.sourceTable !== filterTable) continue;
            }

            const cCode = normCodeKey(r.code);
            if (!cCode) continue;

            let groupKey = cCode;
            if (duplicateMatchMode === 'STRICT_4_FIELDS') {
                const cName = normStr(r.customerName);
                const cMap = normStr(r.mapSheet);
                const cPlot = normStr(r.landPlot);
                if (!cName) continue;
                groupKey = `${cCode}__${cName}__${cMap}__${cPlot}`;
            }

            if (!groupsMap.has(groupKey)) {
                groupsMap.set(groupKey, []);
            }
            const list = groupsMap.get(groupKey)!;
            if (!list.some(existing => existing.id === r.id && existing.sourceTable === r.sourceTable)) {
                list.push(r);
            }
        }

        const result: DuplicateGroup[] = [];

        groupsMap.forEach((groupRecords, key) => {
            if (groupRecords.length > 1) {
                const assessments: Record<string, RecordQualityAssessment> = {};
                for (const rec of groupRecords) {
                    assessments[rec.id] = evaluateRecordQuality(rec);
                }

                const sorted = [...groupRecords].sort((a, b) => {
                    const qa = assessments[a.id];
                    const qb = assessments[b.id];
                    const inputDiff = qb.inputScore - qa.inputScore;
                    if (Math.abs(inputDiff) >= 8) {
                        return inputDiff;
                    }
                    const workflowDiff = qb.workflowScore - qa.workflowScore;
                    if (workflowDiff !== 0) {
                        return workflowDiff;
                    }
                    if (inputDiff !== 0) {
                        return inputDiff;
                    }
                    const timeA = new Date((a as any).createdAt || (a as any).created_at || a.receivedDate || 0).getTime();
                    const timeB = new Date((b as any).createdAt || (b as any).created_at || b.receivedDate || 0).getTime();
                    return timeA - timeB;
                });

                const manualKeepId = manualKeepByGroup[key];
                const keepRecord = (manualKeepId && sorted.find(r => r.id === manualKeepId)) || sorted[0];
                const donorRecords = sorted.filter(r => r.id !== keepRecord.id);

                const mergePreview = buildMergedKeepRecord(keepRecord, donorRecords);
                const statusSet = new Set(sorted.map(r => String(r.status || '')));

                result.push({
                    groupKey: key,
                    code: keepRecord.code || sorted[0].code || '--',
                    customerName: mergePreview.mergedRecord.customerName || keepRecord.customerName || '--',
                    mapSheet: String(mergePreview.mergedRecord.mapSheet || keepRecord.mapSheet || '--'),
                    landPlot: String(mergePreview.mergedRecord.landPlot || keepRecord.landPlot || '--'),
                    records: sorted,
                    keepRecordId: keepRecord.id,
                    assessments,
                    mergePreview,
                    hasDifferentWorkflow: statusSet.size > 1 || Boolean(mergePreview.upgradedStatus)
                });
            }
        });

        result.sort((a, b) => {
            if (a.mergePreview.hasChanges !== b.mergePreview.hasChanges) {
                return a.mergePreview.hasChanges ? -1 : 1;
            }
            return a.code.localeCompare(b.code);
        });

        return result;
    }, [effectiveRecords, filterTable, duplicateMatchMode, manualKeepByGroup]);

    const filteredGroups = useMemo(() => {
        return duplicateGroups.filter(g => {
            if (onlyShowWorkflowDiff && !g.mergePreview.hasChanges && !g.hasDifferentWorkflow) {
                return false;
            }
            if (!searchTerm.trim()) return true;
            const lower = searchTerm.toLowerCase();
            return (
                g.code.toLowerCase().includes(lower) ||
                g.customerName.toLowerCase().includes(lower) ||
                g.mapSheet.toLowerCase().includes(lower) ||
                g.landPlot.toLowerCase().includes(lower) ||
                g.records.some(r =>
                    String(r.phoneNumber || '').toLowerCase().includes(lower) ||
                    String(r.cccd || '').toLowerCase().includes(lower) ||
                    String(r.customerAddress || '').toLowerCase().includes(lower)
                )
            );
        });
    }, [duplicateGroups, searchTerm, onlyShowWorkflowDiff]);

    useEffect(() => {
        const defaultDeleteSet = new Set<string>();
        duplicateGroups.forEach(g => {
            g.records.forEach(r => {
                if (r.id !== g.keepRecordId) {
                    defaultDeleteSet.add(r.id);
                }
            });
        });
        setSelectedDeleteIds(defaultDeleteSet);
    }, [duplicateGroups]);

    const totalDuplicatesCount = useMemo(() => {
        return duplicateGroups.reduce((acc, g) => acc + (g.records.length - 1), 0);
    }, [duplicateGroups]);

    const handleSelectKeepRecord = (groupKey: string, newKeepId: string, groupRecords: RecordFile[]) => {
        setManualKeepByGroup(prev => ({ ...prev, [groupKey]: newKeepId }));
        setSelectedDeleteIds(prev => {
            const next = new Set(prev);
            next.delete(newKeepId);
            for (const r of groupRecords) {
                if (r.id !== newKeepId) {
                    next.add(r.id);
                }
            }
            return next;
        });
    };

    const handleToggleSelectAllDuplicates = () => {
        const allDuplicateIds = new Set<string>();
        filteredGroups.forEach(g => {
            g.records.forEach(r => {
                if (r.id !== g.keepRecordId) {
                    allDuplicateIds.add(r.id);
                }
            });
        });

        const allCurrentlySelected =
            allDuplicateIds.size > 0 && Array.from(allDuplicateIds).every(id => selectedDeleteIds.has(id));

        if (allCurrentlySelected) {
            setSelectedDeleteIds(new Set());
        } else {
            setSelectedDeleteIds(allDuplicateIds);
        }
    };

    const handleToggleDuplicateRecord = (id: string) => {
        setSelectedDeleteIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const resolveRecordTable = (rec: RecordFile): 'land_records' | 'dangky_records' | 'luutru_records' => {
        if (rec.sourceTable === 'dangky_records' || rec.sourceTable === 'luutru_records' || rec.sourceTable === 'land_records') {
            return rec.sourceTable;
        }
        try {
            return getTargetTable(rec);
        } catch {
            return 'land_records';
        }
    };

    // Lưu 1 bản ghi giữ lại (dùng khi bấm xử lý lẻ 1 nhóm)
    const persistMergedKeepRecord = async (mergedRecord: RecordFile): Promise<boolean> => {
        const okSet = await persistMergedKeepRecordsInChunks([mergedRecord]);
        return okSet.has(mergedRecord.id);
    };

    /**
     * CẬP NHẬT PHÂN MẢNH CÁC BẢN GHI GIỮ LẠI:
     * Chia thành từng lô nhỏ (chunkSize), cập nhật lần lượt và nghỉ 65ms giữa mỗi lô.
     * Chỉ ghi Cache & cập nhật State 1 lần duy nhất sau khi hoàn tất -> Không bao giờ gây giật lag!
     */
    const persistMergedKeepRecordsInChunks = async (mergedRecords: RecordFile[]): Promise<Set<string>> => {
        const succeededIds = new Set<string>();
        if (mergedRecords.length === 0) return succeededIds;

        const safeChunk = Math.max(10, Math.min(50, chunkSize || 25));
        const totalChunks = Math.ceil(mergedRecords.length / safeChunk);
        const nowIso = new Date().toISOString();
        const savedMap = new Map<string, RecordFile>();

        for (let c = 0; c < totalChunks; c++) {
            if (cancelBatchRef.current) break;

            const slice = mergedRecords.slice(c * safeChunk, (c + 1) * safeChunk);
            setChunkProgress({
                active: true,
                phase: `Đang gộp quy trình vào bản gốc (Đợt ${c + 1}/${totalChunks})`,
                currentChunk: c + 1,
                totalChunks,
                processedItems: succeededIds.size,
                totalItems: mergedRecords.length
            });

            if (isConfigured) {
                const byTable: Record<'land_records' | 'dangky_records' | 'luutru_records', RecordFile[]> = {
                    land_records: [],
                    dangky_records: [],
                    luutru_records: []
                };

                for (const rec of slice) {
                    const tbl = resolveRecordTable(rec);
                    byTable[tbl].push({
                        ...rec,
                        sourceTable: tbl,
                        updated_at: nowIso,
                        updatedAt: nowIso
                    });
                }

                for (const tbl of ['land_records', 'dangky_records', 'luutru_records'] as const) {
                    const tblRecs = byTable[tbl];
                    if (tblRecs.length === 0) continue;

                    const payloads = tblRecs.map(r => {
                        const p = sanitizeRecordPayloadForTable(r, tbl);
                        p.id = r.id;
                        p.updated_at = nowIso;
                        return p;
                    });

                    // Thử upsert cả lô trước để đạt tốc độ cao nhất
                    const { error: batchErr } = await supabase
                        .from(tbl)
                        .upsert(payloads, { onConflict: 'id' });

                    if (!batchErr) {
                        for (const r of tblRecs) {
                            succeededIds.add(r.id);
                            savedMap.set(r.id, r);
                        }
                    } else {
                        // Fallback: nếu lô vướng lỗi schema/ràng buộc, cập nhật từng bản trong lô nhỏ này
                        for (const r of tblRecs) {
                            try {
                                const singlePayload = sanitizeRecordPayloadForTable(r, tbl);
                                delete singlePayload.id;
                                singlePayload.updated_at = nowIso;
                                const { error: sErr } = await supabase
                                    .from(tbl)
                                    .update(singlePayload)
                                    .eq('id', r.id);
                                if (!sErr) {
                                    succeededIds.add(r.id);
                                    savedMap.set(r.id, r);
                                } else {
                                    await updateRecordApi(r, tbl);
                                    succeededIds.add(r.id);
                                    savedMap.set(r.id, r);
                                }
                            } catch (innerErr) {
                                console.warn('[CHUNK_MERGE] Single fallback error:', r.code, innerErr);
                            }
                        }
                    }
                }
            } else {
                for (const r of slice) {
                    succeededIds.add(r.id);
                    savedMap.set(r.id, r);
                }
            }

            setChunkProgress({
                active: true,
                phase: `Đã gộp quy trình đợt ${c + 1}/${totalChunks}`,
                currentChunk: c + 1,
                totalChunks,
                processedItems: succeededIds.size,
                totalItems: mergedRecords.length
            });

            // Nhường luồng chính để UI không bị đơ
            await yieldToMain(65);
        }

        // Cập nhật Cache và State đúng 1 lần duy nhất O(N)
        if (savedMap.size > 0) {
            try {
                const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
                if (cached.length > 0) {
                    const updatedCache = cached.map(r => savedMap.get(r.id) || r);
                    saveToCache(CACHE_KEYS.RECORDS, updatedCache);
                }
            } catch {}

            setDbScannedRecords(prev => (prev ? prev.map(r => savedMap.get(r.id) || r) : prev));
        }

        return succeededIds;
    };

    /**
     * XÓA PHÂN MẢNH LẦN LƯỢT (SEQUENTIAL CHUNKED DELETE):
     * - Chia danh sách cần xóa thành từng lô nhỏ (mặc định 25 hồ sơ / lô).
     * - Xóa trực tiếp trên từng bảng Supabase, cập nhật thanh tiến trình và nhường luồng UI 65ms sau mỗi lô.
     * - Loại bỏ hoàn toàn việc gọi chồng chéo 3 tầng API gây treo ứng dụng.
     */
    const deleteAuthorizedDuplicateRecords = async (recordsToDelete: RecordFile[]): Promise<number> => {
        if (recordsToDelete.length === 0) return 0;

        const safeChunk = Math.max(10, Math.min(100, chunkSize || 25));
        const totalChunks = Math.ceil(recordsToDelete.length / safeChunk);
        const deletedIdsSet = new Set<string>();

        for (let c = 0; c < totalChunks; c++) {
            if (cancelBatchRef.current) break;

            const slice = recordsToDelete.slice(c * safeChunk, (c + 1) * safeChunk);
            setChunkProgress({
                active: true,
                phase: `Đang xóa phân mảnh (Đợt ${c + 1}/${totalChunks} — ${slice.length} hồ sơ)`,
                currentChunk: c + 1,
                totalChunks,
                processedItems: deletedIdsSet.size,
                totalItems: recordsToDelete.length
            });

            if (isConfigured) {
                const byTable: Record<'land_records' | 'dangky_records' | 'luutru_records', string[]> = {
                    land_records: [],
                    dangky_records: [],
                    luutru_records: []
                };

                for (const rec of slice) {
                    const tbl = resolveRecordTable(rec);
                    byTable[tbl].push(rec.id);
                }

                // Thực thi xóa song song 3 bảng trong phạm vi lô nhỏ (tối đa 25 ID)
                await Promise.all(
                    (['land_records', 'dangky_records', 'luutru_records'] as const).map(async (tbl) => {
                        const tblIds = byTable[tbl];
                        if (tblIds.length === 0) return;
                        const { error } = await supabase.from(tbl).delete().in('id', tblIds);
                        if (error) {
                            console.warn(`[CHUNK_DELETE] Retry single deletes on ${tbl}:`, error.message);
                            for (const singleId of tblIds) {
                                await supabase.from(tbl).delete().eq('id', singleId);
                            }
                        }
                    })
                );
            }

            for (const rec of slice) {
                deletedIdsSet.add(rec.id);
            }

            setChunkProgress({
                active: true,
                phase: `Đã xóa xong đợt ${c + 1}/${totalChunks} (${deletedIdsSet.size}/${recordsToDelete.length} hồ sơ)`,
                currentChunk: c + 1,
                totalChunks,
                processedItems: deletedIdsSet.size,
                totalItems: recordsToDelete.length
            });

            // Nhường luồng chính giữa các đợt xóa để giao diện luôn mượt mà
            await yieldToMain(65);
        }

        // Đồng bộ Cache & State đúng 1 lần duy nhất bằng Set O(N)
        if (deletedIdsSet.size > 0) {
            try {
                const cached: RecordFile[] = getFromCache(CACHE_KEYS.RECORDS, []);
                if (cached.length > 0) {
                    saveToCache(
                        CACHE_KEYS.RECORDS,
                        cached.filter(r => !deletedIdsSet.has(r.id))
                    );
                }
            } catch {}

            setDbScannedRecords(prev => (prev ? prev.filter(r => !deletedIdsSet.has(r.id)) : prev));
        }

        return deletedIdsSet.size;
    };

    const handleProcessSingleGroup = async (group: DuplicateGroup) => {
        const duplicatesToDelete = group.records.filter(r => r.id !== group.keepRecordId);
        if (duplicatesToDelete.length === 0) return;

        const mergeDesc =
            autoMergeBeforeDelete && group.mergePreview.hasChanges
                ? `\n• Tự động GỘP quy trình & thông tin còn thiếu vào bản giữ lại (${
                      group.mergePreview.upgradedStatus
                          ? `Trạng thái: ${group.mergePreview.upgradedStatus.from} → ${group.mergePreview.upgradedStatus.to}`
                          : 'Bù trường dữ liệu khuyết'
                  })`
                : '';

        const confirmed = await confirmAction(
            `XÁC NHẬN HỢP NHẤT & DỌN TRÙNG MÃ [${group.code}]:\n\n• Giữ lại bản đầy đủ thông tin: ${group.customerName} (ID: ${group.keepRecordId.slice(0, 8)}...)${mergeDesc}\n• Xóa vĩnh viễn ${duplicatesToDelete.length} bản ghi trùng bị thiếu thông tin.`,
            `Xử lý mã trùng ${group.code}`
        );
        if (!confirmed) return;

        setProcessingGroupKey(group.groupKey);
        cancelBatchRef.current = false;
        try {
            if (autoMergeBeforeDelete) {
                const preview = buildMergedKeepRecord(
                    group.records.find(r => r.id === group.keepRecordId)!,
                    duplicatesToDelete
                );
                if (preview.hasChanges) {
                    const ok = await persistMergedKeepRecord(preview.mergedRecord);
                    if (!ok) {
                        notify(
                            `Không thể cập nhật quy trình vào bản giữ lại của mã ${group.code}. Đã dừng xóa để bảo toàn dữ liệu!`,
                            'error'
                        );
                        return;
                    }
                }
            }

            await deleteAuthorizedDuplicateRecords(duplicatesToDelete);
            notify(`Đã gộp quy trình & xóa ${duplicatesToDelete.length} bản trùng của mã ${group.code}!`, 'success');
            if (onRefreshData) {
                await onRefreshData();
            }
        } catch (err: any) {
            notify(`Lỗi khi xử lý mã ${group.code}: ${err?.message || 'Lỗi không xác định'}`, 'error');
        } finally {
            setChunkProgress(null);
            setProcessingGroupKey(null);
        }
    };

    const handleExecuteDeleteDuplicates = async (onlySingleChunk = false) => {
        if (selectedDeleteIds.size === 0) {
            notify("Vui lòng chọn ít nhất một hồ sơ trùng lặp để xóa!", "info");
            return;
        }

        const allAffectedGroups = duplicateGroups.filter(g =>
            g.records.some(r => r.id !== g.keepRecordId && selectedDeleteIds.has(r.id))
        );

        const safeChunk = Math.max(10, chunkSize || 25);
        const affectedGroups = onlySingleChunk
            ? allAffectedGroups.slice(0, safeChunk)
            : allAffectedGroups;

        const targetDeleteCount = affectedGroups.reduce(
            (sum, g) => sum + g.records.filter(r => r.id !== g.keepRecordId && selectedDeleteIds.has(r.id)).length,
            0
        );
        const groupsNeedMergeCount = affectedGroups.filter(g => g.mergePreview.hasChanges).length;
        const estimatedChunks = Math.ceil(targetDeleteCount / safeChunk);

        const confirm = await confirmAction(
            `XÁC NHẬN GỘP QUY TRÌNH & XÓA PHÂN MẢNH (${targetDeleteCount} HỒ SƠ TRÙNG MÃ):\n\n` +
            `1. Ưu tiên giữ lại bản có ĐẦY ĐỦ THÔNG TIN ĐẦU VÀO (Họ tên, SĐT, CCCD, Địa chỉ chủ SD, Địa chỉ thửa đất...).\n` +
            (autoMergeBeforeDelete
                ? `2. Tự động ĐIỀN BÙ bước quy trình cao nhất & các trường còn thiếu vào ${groupsNeedMergeCount} hồ sơ gốc.\n`
                : `2. Chế độ tự động gộp đang TẮT (chỉ xóa bản trùng đã chọn).\n`) +
            `3. Chia nhỏ thành ${estimatedChunks} đợt (${safeChunk} bản ghi/đợt) xóa lần lượt để KHÔNG gây giật lag dữ liệu.`,
            'Xác nhận Gộp & Xóa Phân Mảnh'
        );
        if (!confirm) return;

        setIsDeleting(true);
        cancelBatchRef.current = false;

        try {
            // Bước 1: Tính toán danh sách các bản ghi gốc cần gộp quy trình trên RAM
            const keepRecordsToMerge: RecordFile[] = [];
            const groupByKeepId = new Map<string, { group: DuplicateGroup; donors: RecordFile[] }>();

            for (const group of affectedGroups) {
                const keepRec = group.records.find(r => r.id === group.keepRecordId);
                const selectedDonors = group.records.filter(
                    r => r.id !== group.keepRecordId && selectedDeleteIds.has(r.id)
                );
                if (!keepRec || selectedDonors.length === 0) continue;

                groupByKeepId.set(keepRec.id, { group, donors: selectedDonors });

                if (autoMergeBeforeDelete) {
                    const mergeInfo = buildMergedKeepRecord(keepRec, selectedDonors);
                    if (mergeInfo.hasChanges) {
                        keepRecordsToMerge.push(mergeInfo.mergedRecord);
                    }
                }
            }

            // Bước 2: Lưu các bản ghi gốc cần nâng cấp quy trình theo từng đợt (Phân mảnh)
            let mergedSuccessIds = new Set<string>();
            if (autoMergeBeforeDelete && keepRecordsToMerge.length > 0) {
                mergedSuccessIds = await persistMergedKeepRecordsInChunks(keepRecordsToMerge);
            }

            // Bước 3: Chỉ đưa vào danh sách xóa những nhóm đã gộp thành công (hoặc không cần gộp)
            const recordsReadyToDelete: RecordFile[] = [];
            const skippedGroupCodes: string[] = [];
            const needMergeIds = new Set(keepRecordsToMerge.map(r => r.id));

            groupByKeepId.forEach(({ group, donors }, keepId) => {
                if (autoMergeBeforeDelete && needMergeIds.has(keepId) && !mergedSuccessIds.has(keepId)) {
                    skippedGroupCodes.push(group.code);
                } else {
                    recordsReadyToDelete.push(...donors);
                }
            });

            // Bước 4: Xóa phân mảnh lần lượt từng đợt
            const deletedCount = await deleteAuthorizedDuplicateRecords(recordsReadyToDelete);

            if (skippedGroupCodes.length > 0) {
                notify(
                    `Đã gộp ${mergedSuccessIds.size} mã & xóa phân mảnh ${deletedCount} bản trùng. Tạm giữ lại ${skippedGroupCodes.length} mã (${skippedGroupCodes.slice(0, 5).join(', ')}) do lỗi kết nối.`,
                    'info'
                );
            } else {
                notify(
                    `Hoàn tất mượt mà! Đã gộp quy trình ${mergedSuccessIds.size} hồ sơ gốc và xóa phân mảnh ${deletedCount} bản ghi trùng!`,
                    'success'
                );
            }

            if (onRefreshData) {
                await onRefreshData();
            }
        } catch (err: any) {
            console.error("Execute duplicate merge & delete error:", err);
            notify(`Lỗi khi xử lý hồ sơ trùng: ${err?.message || 'Lỗi Supabase'}`, 'error');
        } finally {
            setChunkProgress(null);
            setIsDeleting(false);
        }
    };

    // Thực thi XÓA PHÂN MẢNH LẦN LƯỢT các hồ sơ sai loại thủ tục / thuộc đơn vị khác (Minh Hưng, Chơn Thành, Nha Bích...)
    const handleExecuteDeleteForeignProcedures = async (onlySingleChunk = false) => {
        const allItemsToDelete = foreignProcedureItems.filter(i => selectedForeignDeleteIds.has(i.record.id));
        if (allItemsToDelete.length === 0) {
            notify("Vui lòng chọn ít nhất một hồ sơ ngoài phần mềm / sai thủ tục để xóa!", "info");
            return;
        }

        const safeChunk = Math.max(10, chunkSize || 25);
        const itemsToDelete = onlySingleChunk ? allItemsToDelete.slice(0, safeChunk) : allItemsToDelete;
        const totalChunks = Math.ceil(itemsToDelete.length / safeChunk);

        const distinctTypes = Array.from(new Set(itemsToDelete.map(i => i.rawType)));
        const sampleTypesText = distinctTypes.slice(0, 5).join('\n• ');

        const confirmed = await confirmAction(
            `XÁC NHẬN XÓA PHÂN MẢNH HỒ SƠ NGOÀI PHẦN MỀM (${itemsToDelete.length} HỒ SƠ):\n\n` +
            `• Chia làm ${totalChunks} đợt (${safeChunk} hồ sơ/đợt) xóa lần lượt để chống giật lag.\n` +
            `• Thuộc ${distinctTypes.length} nhóm thủ tục / địa bàn ngoài đơn vị:\n` +
            `• ${sampleTypesText}${distinctTypes.length > 5 ? `\n• ... (+${distinctTypes.length - 5} loại khác)` : ''}`,
            'Xác nhận xóa phân mảnh hồ sơ ngoài phần mềm'
        );
        if (!confirmed) return;

        setIsDeletingForeign(true);
        cancelBatchRef.current = false;
        try {
            const recordsToDelete = itemsToDelete.map(i => i.record);
            const deletedCount = await deleteAuthorizedDuplicateRecords(recordsToDelete);
            const deletedIdSet = new Set(recordsToDelete.slice(0, deletedCount).map(r => r.id));
            setSelectedForeignDeleteIds(prev => {
                const next = new Set(prev);
                deletedIdSet.forEach(id => next.delete(id));
                return next;
            });
            notify(
                `Đã xóa phân mảnh thành công ${deletedCount} hồ sơ ngoài phần mềm (${totalChunks} đợt) mượt mà!`,
                'success'
            );
            if (onRefreshData) {
                await onRefreshData();
            }
        } catch (err: any) {
            console.error("Delete foreign procedure records error:", err);
            notify(`Lỗi khi xóa hồ sơ ngoài phần mềm: ${err?.message || 'Lỗi Supabase'}`, 'error');
        } finally {
            setChunkProgress(null);
            setIsDeletingForeign(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 p-4 gap-4 overflow-hidden">
            {/* Main Tabs Switcher Header */}
            <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setSubMode('DUPLICATE')}
                        className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                            subMode === 'DUPLICATE'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <Copy size={16} />
                        <span>1. Lọc Trùng Mã & Gộp Quy Trình</span>
                        {totalDuplicatesCount > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                                subMode === 'DUPLICATE' ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700'
                            }`}>
                                {duplicateGroups.length} mã ({totalDuplicatesCount})
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setSubMode('FOREIGN_PROCEDURES')}
                        className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                            subMode === 'FOREIGN_PROCEDURES'
                                ? 'bg-amber-600 text-white shadow-md shadow-amber-200'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <FolderX size={16} />
                        <span>2. Loại Bỏ Hồ Sơ Sai Thủ Tục (Đơn Vị Khác)</span>
                        {foreignProcedureItems.length > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                                subMode === 'FOREIGN_PROCEDURES' ? 'bg-white text-amber-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                                {foreignProcedureItems.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setSubMode('EMPTY_RECORDS')}
                        className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                            subMode === 'EMPTY_RECORDS'
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                    >
                        <FileX2 size={16} />
                        <span>3. Loại Bỏ Hồ Sơ Rỗng</span>
                        {emptyScanResults.length > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                                subMode === 'EMPTY_RECORDS' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                                {emptyScanResults.length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Bộ chọn kích thước phân mảnh (Chunk Size) */}
                    <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
                        <span className="font-bold text-slate-600">Cỡ phân mảnh:</span>
                        <select
                            value={chunkSize}
                            onChange={e => setChunkSize(Number(e.target.value))}
                            disabled={isDeleting || isDeletingForeign || isDeletingEmpty}
                            className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 font-bold text-indigo-700 outline-none cursor-pointer"
                            title="Số lượng hồ sơ xử lý trong mỗi đợt phân mảnh để chống giật lag"
                        >
                            <option value={15}>15 HS / đợt (Siêu mượt)</option>
                            <option value={25}>25 HS / đợt (Khuyên dùng)</option>
                            <option value={50}>50 HS / đợt (Nhanh)</option>
                            <option value={100}>100 HS / đợt (Tối đa)</option>
                        </select>
                    </div>

                    {subMode === 'EMPTY_RECORDS' && (
                        <>
                            <button
                                onClick={() => handleScanEmptyRecords(true)}
                                disabled={isScanningEmpty || isDeletingEmpty}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-300 cursor-pointer"
                            >
                                <RefreshCw size={14} className={isScanningEmpty ? 'animate-spin text-blue-600' : ''} />
                                <span>{isScanningEmpty ? 'Đang quét CSDL...' : 'Quét lại CSDL'}</span>
                            </button>

                            {selectedEmptyIds.size > chunkSize && (
                                <button
                                    onClick={() => handleExecuteDeleteEmptyRecords(true)}
                                    disabled={isDeletingEmpty || selectedEmptyIds.size === 0}
                                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                    title={`Chỉ xóa 1 đợt gồm ${chunkSize} hồ sơ đầu tiên`}
                                >
                                    <Trash2 size={14} />
                                    <span>Xóa 1 Đợt ({chunkSize} HS)</span>
                                </button>
                            )}

                            <button
                                onClick={() => handleExecuteDeleteEmptyRecords(false)}
                                disabled={isDeletingEmpty || selectedEmptyIds.size === 0}
                                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                                {isDeletingEmpty ? (
                                    <>
                                        <RefreshCw size={15} className="animate-spin" />
                                        <span>Đang xóa phân mảnh...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={15} />
                                        <span>Xóa Phân Mảnh {selectedEmptyIds.size} Hồ Sơ Rỗng</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {subMode === 'DUPLICATE' && (
                        <>
                            <button
                                onClick={() => handleDeepScanDuplicatesFromDb(true)}
                                disabled={isScanningDbDuplicates || isDeleting}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-300 cursor-pointer"
                            >
                                <RefreshCw size={14} className={isScanningDbDuplicates ? 'animate-spin text-indigo-600' : ''} />
                                <span>{isScanningDbDuplicates ? 'Đang quét 3 bảng CSDL...' : 'Quét sâu 3 bảng CSDL'}</span>
                            </button>

                            {filteredGroups.length > chunkSize && (
                                <button
                                    onClick={() => handleExecuteDeleteDuplicates(true)}
                                    disabled={isDeleting || selectedDeleteIds.size === 0}
                                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                    title={`Chỉ gộp & xóa 1 đợt gồm ${chunkSize} mã trùng đầu tiên`}
                                >
                                    <GitMerge size={14} />
                                    <span>Gộp & Xóa 1 Đợt ({chunkSize} mã)</span>
                                </button>
                            )}

                            <button
                                onClick={() => handleExecuteDeleteDuplicates(false)}
                                disabled={isDeleting || selectedDeleteIds.size === 0}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                                {isDeleting ? (
                                    <>
                                        <RefreshCw size={15} className="animate-spin" />
                                        <span>Đang gộp & xóa phân mảnh...</span>
                                    </>
                                ) : (
                                    <>
                                        <GitMerge size={15} />
                                        <span>
                                            {autoMergeBeforeDelete
                                                ? `Gộp & Xóa Phân Mảnh (${selectedDeleteIds.size} Bản Trùng)`
                                                : `Xóa Phân Mảnh (${selectedDeleteIds.size} Bản Trùng)`}
                                        </span>
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {subMode === 'FOREIGN_PROCEDURES' && (
                        <>
                            <button
                                onClick={() => handleDeepScanDuplicatesFromDb(true)}
                                disabled={isScanningDbDuplicates || isDeletingForeign}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-300 cursor-pointer"
                            >
                                <RefreshCw size={14} className={isScanningDbDuplicates ? 'animate-spin text-amber-600' : ''} />
                                <span>{isScanningDbDuplicates ? 'Đang quét 3 bảng CSDL...' : 'Quét lại 3 bảng CSDL'}</span>
                            </button>

                            {selectedForeignDeleteIds.size > chunkSize && (
                                <button
                                    onClick={() => handleExecuteDeleteForeignProcedures(true)}
                                    disabled={isDeletingForeign || selectedForeignDeleteIds.size === 0}
                                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                    title={`Chỉ xóa 1 đợt gồm ${chunkSize} hồ sơ đầu tiên`}
                                >
                                    <Trash2 size={14} />
                                    <span>Xóa 1 Đợt ({chunkSize} HS)</span>
                                </button>
                            )}

                            <button
                                onClick={() => handleExecuteDeleteForeignProcedures(false)}
                                disabled={isDeletingForeign || selectedForeignDeleteIds.size === 0}
                                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                                {isDeletingForeign ? (
                                    <>
                                        <RefreshCw size={15} className="animate-spin" />
                                        <span>Đang xóa phân mảnh...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={15} />
                                        <span>Xóa Phân Mảnh ({selectedForeignDeleteIds.size} Hồ Sơ Ngoài PM)</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* THANH TIẾN TRÌNH XỬ LÝ PHÂN MẢNH LẦN LƯỢT (HIỂN THỊ KHI ĐANG CHẠY) */}
            {chunkProgress && chunkProgress.active && (
                <div className="bg-indigo-950 text-white rounded-xl p-3.5 shadow-lg border border-indigo-700 flex flex-col gap-2 shrink-0">
                    <div className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 font-bold">
                            <RefreshCw size={15} className="animate-spin text-amber-400 shrink-0" />
                            <span>{chunkProgress.phase}</span>
                            <span className="px-2 py-0.5 rounded bg-indigo-800 text-amber-300 font-mono text-[11px]">
                                Đợt {chunkProgress.currentChunk} / {chunkProgress.totalChunks}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-emerald-300">
                                Đã xử lý: {chunkProgress.processedItems} / {chunkProgress.totalItems} hồ sơ (
                                {chunkProgress.totalItems > 0
                                    ? Math.round((chunkProgress.processedItems / chunkProgress.totalItems) * 100)
                                    : 0}
                                %)
                            </span>
                            <button
                                onClick={() => {
                                    cancelBatchRef.current = true;
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] cursor-pointer transition-all"
                            >
                                Dừng sau đợt này
                            </button>
                        </div>
                    </div>
                    <div className="w-full h-2 bg-indigo-900 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 transition-all duration-200"
                            style={{
                                width: `${
                                    chunkProgress.totalItems > 0
                                        ? Math.min(100, Math.round((chunkProgress.processedItems / chunkProgress.totalItems) * 100))
                                        : 15
                                }%`
                            }}
                        />
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* SUB-VIEW 3: LOẠI BỎ HỒ SƠ SAI LOẠI THỦ TỤC / NHẬP NHẦM CỦA ĐƠN VỊ KHÁC    */}
            {/* ========================================================================= */}
            {subMode === 'FOREIGN_PROCEDURES' && (
                <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                    {/* Banner giải thích & Tùy chọn bộ lọc nâng cao */}
                    <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border border-amber-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2.5 text-xs text-slate-700">
                            <FilterX size={18} className="text-amber-600 shrink-0" />
                            <div>
                                <span className="font-bold text-amber-950">Công cụ phát hiện Hồ sơ ngoài phần mềm (Sai thủ tục / Địa bàn đơn vị khác): </span>
                                <span>
                                    Tự động phát hiện các hồ sơ có <strong>địa chỉ thửa đất thuộc Minh Hưng, Chơn Thành, Nha Bích</strong> hoặc có loại thủ tục không nằm trong <strong>22 loại thủ tục chuẩn của phần mềm</strong> (Nhóm 1.x Lưu trữ, 2.x Đo đạc, 3.x Đăng ký/Cấp giấy).
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => setShowAllDbTypesExplorer(prev => !prev)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                    showAllDbTypesExplorer
                                        ? 'bg-amber-700 text-white border-amber-800'
                                        : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                                }`}
                            >
                                <Tag size={13} />
                                <span>
                                    {showAllDbTypesExplorer
                                        ? 'Ẩn danh sách toàn bộ tên thủ tục trong CSDL'
                                        : `Xem & Chọn từ tất cả ${allDatabaseTypeSummary.length} tên thủ tục đang có trong CSDL`}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Bảng mở rộng: Cho phép người dùng nhìn thấy 100% các chuỗi recordType đang có trong DB và tick chọn bất kỳ loại nào muốn xóa */}
                    {showAllDbTypesExplorer && (
                        <div className="bg-white rounded-xl p-3.5 border border-amber-300 shadow-xs shrink-0 max-h-56 overflow-y-auto">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-800">
                                    Thống kê toàn bộ tên thủ tục (`recordType`) đang có trong CSDL — Bấm vào tên thủ tục bất kỳ để đưa vào danh sách xóa:
                                </span>
                                {customSelectedRawTypes.size > 0 && (
                                    <button
                                        onClick={() => setCustomSelectedRawTypes(new Set())}
                                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                                    >
                                        Bỏ chọn thủ công ({customSelectedRawTypes.size})
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {allDatabaseTypeSummary.map(item => {
                                    const isPicked = customSelectedRawTypes.has(item.rawType) || item.isAutoFlaggedForeign;
                                    return (
                                        <button
                                            key={item.rawType}
                                            onClick={() => handleToggleCustomRawType(item.rawType)}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                                item.isAutoFlaggedForeign
                                                    ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold'
                                                    : isPicked
                                                        ? 'bg-amber-600 text-white border-amber-700 font-bold'
                                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                            title={
                                                item.isAutoFlaggedForeign
                                                    ? 'Thủ tục lạ không khớp với 22 thủ tục của phần mềm (tự động đưa vào danh sách xóa)'
                                                    : `Khớp với thủ tục chuẩn: ${item.shortType}. Bấm nếu bạn vẫn muốn lọc xóa loại này.`
                                            }
                                        >
                                            <span>{item.rawType}</span>
                                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                                item.isAutoFlaggedForeign || isPicked ? 'bg-white/90 text-rose-800' : 'bg-slate-200 text-slate-700'
                                            }`}>
                                                {item.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Toolbar lọc */}
                    <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bảng:</span>
                                <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold border border-slate-200">
                                    <button
                                        onClick={() => setForeignTableFilter('ALL')}
                                        className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${foreignTableFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Tất cả
                                    </button>
                                    <button
                                        onClick={() => setForeignTableFilter('land_records')}
                                        className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${foreignTableFilter === 'land_records' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Đo đạc
                                    </button>
                                    <button
                                        onClick={() => setForeignTableFilter('dangky_records')}
                                        className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${foreignTableFilter === 'dangky_records' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Cấp giấy
                                    </button>
                                    <button
                                        onClick={() => setForeignTableFilter('luutru_records')}
                                        className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${foreignTableFilter === 'luutru_records' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Lưu trữ
                                    </button>
                                </div>
                            </div>

                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={requireStandardCodePrefix}
                                    onChange={e => setRequireStandardCodePrefix(e.target.checked)}
                                    className="rounded text-amber-600"
                                />
                                <span>Bắt cả hồ sơ không đánh số hiệu 1.x / 2.x / 3.x ở đầu</span>
                            </label>

                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={includeEmptyProcedure}
                                    onChange={e => setIncludeEmptyProcedure(e.target.checked)}
                                    className="rounded text-amber-600"
                                />
                                <span>Bao gồm hồ sơ trống loại thủ tục</span>
                            </label>

                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={includeForeignWard}
                                    onChange={e => setIncludeForeignWard(e.target.checked)}
                                    className="rounded text-amber-600"
                                />
                                <span>Bắt cả hồ sơ ngoài 4 Xã/Phường của đơn vị</span>
                            </label>
                        </div>

                        <div className="relative w-64">
                            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm mã HS, tên thủ tục lạ, chủ SD..."
                                value={foreignSearchTerm}
                                onChange={e => setForeignSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    {/* Danh sách các thẻ nhóm thủ tục lạ phát hiện được */}
                    {foreignTypeBreakdown.length > 0 && (
                        <div className="bg-white rounded-xl px-3.5 py-2.5 border border-slate-200 flex items-center gap-2 flex-wrap shrink-0">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">
                                Các loại thủ tục lạ phát hiện ({foreignTypeBreakdown.length} loại):
                            </span>
                            {foreignTypeBreakdown.map(group => {
                                const groupIds = foreignProcedureItems
                                    .filter(i => i.rawType === group.rawType)
                                    .map(i => i.record.id);
                                const isAllGroupSelected =
                                    groupIds.length > 0 && groupIds.every(id => selectedForeignDeleteIds.has(id));

                                return (
                                    <button
                                        key={group.rawType}
                                        onClick={() => handleToggleSelectByRawTypeGroup(group.rawType)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                            isAllGroupSelected
                                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}
                                        title="Bấm để Chọn / Bỏ chọn toàn bộ hồ sơ có loại thủ tục này"
                                    >
                                        {isAllGroupSelected ? (
                                            <CheckSquare size={13} className="text-rose-600" />
                                        ) : (
                                            <Square size={13} className="text-slate-400" />
                                        )}
                                        <span>{group.rawType}</span>
                                        <span className="px-1.5 py-0.2 rounded-full bg-rose-200/80 text-rose-900 text-[10px] font-black">
                                            {group.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Danh sách chi tiết các hồ sơ sai thủ tục */}
                    <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                        {filteredForeignItems.length === 0 ? (
                            <div className="py-16 text-center flex flex-col items-center justify-center text-slate-500">
                                <ShieldCheck className="text-emerald-500 mb-3" size={48} />
                                <h3 className="text-base font-bold text-slate-700">
                                    Không phát hiện hồ sơ nào có loại thủ tục lạ ngoài danh mục phần mềm!
                                </h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-lg">
                                    Nếu hồ sơ nhập nhầm của đơn vị khác có tên gần giống thủ tục trong phần mềm, bạn hãy bấm nút{' '}
                                    <strong className="text-amber-700">"Xem & Chọn từ tất cả tên thủ tục đang có trong CSDL"</strong> ở góc phải phía trên để tick chọn trực tiếp loại thủ tục muốn xóa.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                                    <button
                                        onClick={handleToggleAllForeign}
                                        className="flex items-center gap-1.5 text-amber-800 hover:text-amber-950 cursor-pointer"
                                    >
                                        {filteredForeignItems.length > 0 &&
                                        filteredForeignItems.every(i => selectedForeignDeleteIds.has(i.record.id)) ? (
                                            <CheckSquare size={16} className="text-rose-600" />
                                        ) : (
                                            <Square size={16} className="text-slate-400" />
                                        )}
                                        <span>
                                            Chọn / Bỏ chọn tất cả {filteredForeignItems.length} hồ sơ ngoài phần mềm
                                        </span>
                                    </button>
                                    <div>
                                        Đã chọn xóa <strong className="text-rose-600">{selectedForeignDeleteIds.size}</strong> /{' '}
                                        {foreignProcedureItems.length} hồ sơ (Đang hiển thị {Math.min(foreignRenderLimit, filteredForeignItems.length)} dòng)
                                    </div>
                                </div>

                                {filteredForeignItems.slice(0, foreignRenderLimit).map((item, idx) => {
                                    const rec = item.record;
                                    const isSelected = selectedForeignDeleteIds.has(rec.id);

                                    return (
                                        <div
                                            key={`${rec.sourceTable || 'tbl'}_${rec.id}`}
                                            className={`p-3 border rounded-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                                isSelected
                                                    ? 'border-rose-300 bg-rose-50/30'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                <button
                                                    onClick={() => handleToggleSingleForeign(rec.id)}
                                                    className="text-rose-600 hover:text-rose-800 mt-0.5 shrink-0 cursor-pointer"
                                                >
                                                    {isSelected ? (
                                                        <CheckSquare size={18} className="text-rose-600" />
                                                    ) : (
                                                        <Square size={18} className="text-slate-300 hover:text-slate-500" />
                                                    )}
                                                </button>

                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-black">
                                                            {idx + 1}
                                                        </span>
                                                        <span className="font-bold text-slate-900 text-xs">
                                                            Mã HS: {rec.code || '(Không mã)'}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-300">
                                                            Thủ tục ghi trên HS: {item.rawType}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200">
                                                            {rec.sourceTable || 'land_records'}
                                                        </span>
                                                    </div>

                                                    <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                                                        <span>
                                                            Chủ SD: <strong className="text-slate-900">{rec.customerName || '--'}</strong>
                                                        </span>
                                                        <span>
                                                            Đ/c Thửa đất: <strong className="text-rose-800">{rec.address || '--'}</strong>
                                                        </span>
                                                        <span>
                                                            Xã/Phường: <strong className="text-slate-800">{rec.ward || '--'}</strong>
                                                        </span>
                                                        <span>
                                                            Tờ/Thửa: <strong className="text-slate-800">{rec.mapSheet || '--'}/{rec.landPlot || '--'}</strong>
                                                        </span>
                                                        {item.rawContent && item.rawContent !== item.rawType && (
                                                            <span>
                                                                Nội dung: <strong className="text-slate-800">{item.rawContent}</strong>
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                        {item.reasons.map((reason, rIdx) => (
                                                            <span
                                                                key={rIdx}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200"
                                                            >
                                                                <AlertOctagon size={11} />
                                                                <span>{reason}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0 text-[11px] font-mono">
                                                <div className="text-slate-700 font-semibold">
                                                    {getStatusDisplayLabel(rec.status)}
                                                </div>
                                                <div className="text-slate-400 text-[10px]">
                                                    ID: {rec.id.substring(0, 10)}...
                                                    {rec.receivedDate ? ` | Nhận: ${String(rec.receivedDate).split('T')[0]}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredForeignItems.length > foreignRenderLimit && (
                                    <div className="pt-2 flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => setForeignRenderLimit(prev => prev + 50)}
                                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 cursor-pointer"
                                        >
                                            Hiển thị thêm 50 hồ sơ (Còn {filteredForeignItems.length - foreignRenderLimit} hồ sơ)
                                        </button>
                                        <button
                                            onClick={() => setForeignRenderLimit(filteredForeignItems.length)}
                                            className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 cursor-pointer"
                                        >
                                            Hiện tất cả ({filteredForeignItems.length})
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SUB-VIEW 1: HỒ SƠ KHÔNG CÓ THÔNG TIN (HỒ SƠ RỖNG / RÁC TRONG CSDL) */}
            {subMode === 'EMPTY_RECORDS' && (
                <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                    <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Bộ lọc bảng:</span>
                            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold border border-slate-200">
                                <button
                                    onClick={() => setEmptyTableFilter('ALL')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${emptyTableFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Tất cả ({emptyStats.totalEmpty})
                                </button>
                                <button
                                    onClick={() => setEmptyTableFilter('land_records')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${emptyTableFilter === 'land_records' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Đo đạc ({emptyStats.landCount})
                                </button>
                                <button
                                    onClick={() => setEmptyTableFilter('dangky_records')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${emptyTableFilter === 'dangky_records' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Cấp giấy ({emptyStats.dangkyCount})
                                </button>
                                <button
                                    onClick={() => setEmptyTableFilter('luutru_records')}
                                    className={`px-3 py-1.5 rounded-md transition-all ${emptyTableFilter === 'luutru_records' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Lưu trữ ({emptyStats.luutruCount})
                                </button>
                            </div>
                        </div>

                        <div className="relative w-64">
                            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo ID, mã, lý do..."
                                value={emptySearchTerm}
                                onChange={e => setEmptySearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-rose-500"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                        {isScanningEmpty ? (
                            <div className="py-20 text-center flex flex-col items-center justify-center text-slate-500">
                                <RefreshCw className="text-blue-600 animate-spin mb-3" size={40} />
                                <h3 className="text-sm font-bold text-slate-700">Đang quét toàn bộ CSDL Supabase & Bộ nhớ...</h3>
                                <p className="text-xs text-slate-400 mt-1">Hệ thống đang kiểm tra cả 3 bảng `land_records`, `dangky_records`, `luutru_records` để phát hiện các bản ghi rỗng.</p>
                            </div>
                        ) : filteredEmptyResults.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center justify-center text-slate-500">
                                <ShieldCheck className="text-emerald-500 mb-3" size={48} />
                                <h3 className="text-base font-bold text-slate-700">Tuyệt vời! Không có hồ sơ rỗng / không có thông tin nào.</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-md">
                                    Cơ sở dữ liệu Supabase và bộ nhớ cục bộ của bạn hoàn toàn chuẩn hóa, không có bản ghi rác.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                                    <button 
                                        onClick={handleToggleAllEmpty}
                                        className="flex items-center gap-1.5 text-rose-700 hover:text-rose-900"
                                    >
                                        {filteredEmptyResults.length > 0 && filteredEmptyResults.every(r => selectedEmptyIds.has(`${r.table}:${r.id}`)) ? (
                                            <CheckSquare size={16} className="text-rose-600" />
                                        ) : (
                                            <Square size={16} className="text-slate-400" />
                                        )}
                                        <span>Chọn / Bỏ chọn tất cả {filteredEmptyResults.length} hồ sơ rỗng</span>
                                    </button>
                                    <div className="text-slate-600">
                                        Đã chọn <strong className="text-rose-600">{selectedEmptyIds.size}</strong> / {emptyScanResults.length} hồ sơ để xóa (Hiển thị {Math.min(emptyRenderLimit, filteredEmptyResults.length)} dòng)
                                    </div>
                                </div>

                                {filteredEmptyResults.slice(0, emptyRenderLimit).map((item, idx) => {
                                    const key = `${item.table}:${item.id}`;
                                    const isSelected = selectedEmptyIds.has(key);
                                    const isExpanded = expandedRecordId === key;

                                    return (
                                        <div 
                                            key={key}
                                            className={`border rounded-xl transition-all shadow-2xs overflow-hidden ${
                                                isSelected ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="p-3 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <button 
                                                        onClick={() => handleToggleEmptyRecord(item.table, item.id)}
                                                        className="text-rose-600 hover:text-rose-800 shrink-0"
                                                    >
                                                        {isSelected ? (
                                                            <CheckSquare size={18} className="text-rose-600" />
                                                        ) : (
                                                            <Square size={18} className="text-slate-300 hover:text-slate-500" />
                                                        )}
                                                    </button>

                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-black">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="font-mono font-bold text-xs text-slate-800">
                                                                ID: {item.id}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                                item.table === 'land_records' ? 'bg-blue-100 text-blue-800' :
                                                                item.table === 'dangky_records' ? 'bg-emerald-100 text-emerald-800' :
                                                                item.table === 'luutru_records' ? 'bg-purple-100 text-purple-800' :
                                                                'bg-slate-100 text-slate-800'
                                                            }`}>
                                                                {item.table}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1">
                                                                <AlertOctagon size={11} /> {item.reason}
                                                            </span>
                                                        </div>

                                                        <div className="text-[11px] text-slate-500 flex items-center gap-4 mt-1">
                                                            <span>Mã HS: <strong className="text-slate-700">{item.code}</strong></span>
                                                            <span>Chủ SD: <strong className="text-slate-700">{item.customerName}</strong></span>
                                                            {item.createdAt && (
                                                                <span>Thời gian: {String(item.createdAt).split('T')[0]}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setExpandedRecordId(isExpanded ? null : key)}
                                                        className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-all"
                                                        title="Xem dữ liệu thô chi tiết của bản ghi"
                                                    >
                                                        <Eye size={13} />
                                                        <span>{isExpanded ? 'Đóng' : 'Chi tiết'}</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="border-t border-slate-200 bg-slate-900 text-slate-200 p-3 text-[11px] font-mono overflow-x-auto">
                                                    <div className="text-slate-400 font-bold mb-1 flex items-center justify-between">
                                                        <span>Dữ liệu thô Supabase ({item.table}):</span>
                                                        <span className="text-[10px] text-rose-400">Lý do rác: {item.reason}</span>
                                                    </div>
                                                    <pre className="whitespace-pre-wrap max-h-48 overflow-y-auto">
                                                        {JSON.stringify(item.rawRecord, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {filteredEmptyResults.length > emptyRenderLimit && (
                                    <div className="pt-2 flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => setEmptyRenderLimit(prev => prev + 50)}
                                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 cursor-pointer"
                                        >
                                            Hiển thị thêm 50 hồ sơ rỗng (Còn {filteredEmptyResults.length - emptyRenderLimit} hồ sơ)
                                        </button>
                                        <button
                                            onClick={() => setEmptyRenderLimit(filteredEmptyResults.length)}
                                            className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 cursor-pointer"
                                        >
                                            Hiện tất cả ({filteredEmptyResults.length})
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SUB-VIEW 2: LỌC TRÙNG MÃ HỒ SƠ & HỢP NHẤT QUY TRÌNH THÔNG MINH */}
            {subMode === 'DUPLICATE' && (
                <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-emerald-50 border border-indigo-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2.5 text-xs text-slate-700">
                            <Sparkles size={18} className="text-indigo-600 shrink-0" />
                            <div>
                                <span className="font-bold text-indigo-950">Cơ chế Ưu Tiên Dữ Liệu Đầu Vào & Điền Bù Quy Trình: </span>
                                <span>
                                    Hệ thống tự động chọn giữ lại <strong>Bản đầy đủ thông tin đầu vào</strong> (Họ tên, SĐT, CCCD, Địa chỉ chủ SD, Địa chỉ đất...). Nếu bản bị xóa có <strong>bước quy trình cao hơn</strong> (Giao NV, Trình ký, Đã ký, Đã giao 1 cửa...), hệ thống sẽ <strong>tự động điền quy trình đó vào bản đầy đủ</strong> trước khi xóa bản khuyết!
                                </span>
                            </div>
                        </div>

                        <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 text-xs font-bold text-indigo-800 cursor-pointer shadow-2xs shrink-0">
                            <input
                                type="checkbox"
                                checked={autoMergeBeforeDelete}
                                onChange={e => setAutoMergeBeforeDelete(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Tự động điền bù Quy trình & Thông tin thiếu trước khi xóa</span>
                        </label>
                    </div>

                    <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chế độ dò:</span>
                                <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold border border-slate-200">
                                    <button
                                        onClick={() => setDuplicateMatchMode('BY_CODE')}
                                        className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${
                                            duplicateMatchMode === 'BY_CODE'
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Theo Mã Hồ Sơ (Khuyên dùng)
                                    </button>
                                    <button
                                        onClick={() => setDuplicateMatchMode('STRICT_4_FIELDS')}
                                        className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${
                                            duplicateMatchMode === 'STRICT_4_FIELDS'
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Khớp cả 4 trường
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phân hệ:</span>
                                <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold border border-slate-200">
                                    <button
                                        onClick={() => setFilterTable('ALL')}
                                        className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${filterTable === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Tất cả
                                    </button>
                                    <button
                                        onClick={() => setFilterTable('land_records')}
                                        className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${filterTable === 'land_records' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Đo đạc
                                    </button>
                                    <button
                                        onClick={() => setFilterTable('dangky_records')}
                                        className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${filterTable === 'dangky_records' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Cấp giấy
                                    </button>
                                    <button
                                        onClick={() => setFilterTable('luutru_records')}
                                        className={`px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${filterTable === 'luutru_records' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Lưu trữ
                                    </button>
                                </div>
                            </div>

                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={onlyShowWorkflowDiff}
                                    onChange={e => setOnlyShowWorkflowDiff(e.target.checked)}
                                    className="rounded text-indigo-600"
                                />
                                <span>Chỉ hiện nhóm có lệch quy trình / khuyết thông tin</span>
                            </label>
                        </div>

                        <div className="relative w-64">
                            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm mã HS, họ tên, SĐT, CCCD..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                        {filteredGroups.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center justify-center text-slate-500">
                                <ShieldCheck className="text-emerald-500 mb-3" size={48} />
                                <h3 className="text-base font-bold text-slate-700">Tuyệt vời! Không phát hiện hồ sơ trùng mã nào.</h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-md">
                                    Cơ sở dữ liệu của bạn hoàn toàn sạch sẽ, không có hồ sơ nào bị trùng mã theo bộ lọc hiện tại.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={handleToggleSelectAllDuplicates}
                                            className="flex items-center gap-1.5 text-indigo-700 hover:text-indigo-900 cursor-pointer"
                                        >
                                            {selectedDeleteIds.size > 0 ? (
                                                <CheckSquare size={16} className="text-indigo-600" />
                                            ) : (
                                                <Square size={16} className="text-slate-400" />
                                            )}
                                            <span>Chọn / Bỏ chọn tất cả bản ghi trùng thiếu thông tin</span>
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span>
                                            Phát hiện <strong className="text-indigo-700">{filteredGroups.length}</strong> mã hồ sơ bị trùng (Hiển thị {Math.min(duplicateRenderLimit, filteredGroups.length)} mã)
                                        </span>
                                        <span>
                                            Đã chọn xóa <strong className="text-rose-600">{selectedDeleteIds.size}</strong> bản ghi khuyết
                                        </span>
                                    </div>
                                </div>

                                {filteredGroups.slice(0, duplicateRenderLimit).map((group, groupIdx) => {
                                    const isProcessingThisGroup = processingGroupKey === group.groupKey;
                                    const { mergePreview } = group;

                                    return (
                                        <div key={group.groupKey} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                                            <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">
                                                        {groupIdx + 1}
                                                    </span>
                                                    <span className="font-black text-indigo-900 text-sm">Mã HS: {group.code}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="text-slate-800 font-bold">Chủ SD: {group.customerName}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="text-slate-600 font-mono">Tờ {group.mapSheet} / Thửa {group.landPlot}</span>
                                                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold border border-rose-200 text-[11px]">
                                                        {group.records.length} bản ghi cùng mã
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleProcessSingleGroup(group)}
                                                        disabled={isProcessingThisGroup || isDeleting}
                                                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                                                    >
                                                        {isProcessingThisGroup ? (
                                                            <>
                                                                <RefreshCw size={12} className="animate-spin" />
                                                                <span>Đang xử lý...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <GitMerge size={12} />
                                                                <span>Gộp & Dọn Mã Này</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {autoMergeBeforeDelete && mergePreview.hasChanges && (
                                                <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-2 text-[11px] flex flex-wrap items-center gap-x-4 gap-y-1 text-amber-950">
                                                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                                        <GitMerge size={14} className="text-amber-700 shrink-0" />
                                                        <span>Kế hoạch tự động điền bù vào Bản Giữ Lại trước khi xóa:</span>
                                                    </div>

                                                    {mergePreview.upgradedStatus && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-bold border border-indigo-200">
                                                            <span>Nâng quy trình: {mergePreview.upgradedStatus.from}</span>
                                                            <ArrowRight size={12} />
                                                            <span className="text-emerald-800">{mergePreview.upgradedStatus.to}</span>
                                                        </span>
                                                    )}

                                                    {mergePreview.filledWorkflowFields.length > 0 && (
                                                        <span>
                                                            + Bổ sung quy trình:{' '}
                                                            <strong className="text-indigo-800">
                                                                {mergePreview.filledWorkflowFields.join(', ')}
                                                            </strong>
                                                        </span>
                                                    )}

                                                    {mergePreview.filledInputFields.length > 0 && (
                                                        <span>
                                                            + Bù thông tin đầu vào:{' '}
                                                            <strong className="text-emerald-800">
                                                                {mergePreview.filledInputFields.join(', ')}
                                                            </strong>
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <div className="divide-y divide-slate-100 text-xs">
                                                {group.records.map((rec) => {
                                                    const isKeep = rec.id === group.keepRecordId;
                                                    const isSelectedForDelete = selectedDeleteIds.has(rec.id);
                                                    const qa = group.assessments[rec.id] || evaluateRecordQuality(rec);

                                                    return (
                                                        <div 
                                                            key={`${rec.sourceTable || 'tbl'}_${rec.id}`}
                                                            className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                                                                isKeep 
                                                                    ? 'bg-emerald-50/50 hover:bg-emerald-50/80' 
                                                                    : isSelectedForDelete 
                                                                        ? 'bg-rose-50/35 hover:bg-rose-50/60' 
                                                                        : 'hover:bg-slate-50'
                                                            }`}
                                                        >
                                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                                {!isKeep ? (
                                                                    <button 
                                                                        onClick={() => handleToggleDuplicateRecord(rec.id)}
                                                                        className="text-rose-600 hover:text-rose-800 mt-0.5 shrink-0 cursor-pointer"
                                                                    >
                                                                        {isSelectedForDelete ? (
                                                                            <CheckSquare size={18} className="text-rose-600" />
                                                                        ) : (
                                                                            <Square size={18} className="text-slate-300 hover:text-slate-500" />
                                                                        )}
                                                                    </button>
                                                                ) : (
                                                                    <span className="mt-0.5 shrink-0">
                                                                        <CheckCircle2 size={18} className="text-emerald-600" />
                                                                    </span>
                                                                )}

                                                                <div className="flex-1 min-w-0 space-y-1.5">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="font-bold text-slate-900">{rec.code}</span>
                                                                        {isKeep ? (
                                                                            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-2xs">
                                                                                <Check size={11} /> BẢN GIỮ LẠI (ƯU TIÊN ĐẦU VÀO ĐẦY ĐỦ)
                                                                            </span>
                                                                        ) : (
                                                                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-200">
                                                                                BẢN TRÙNG SẼ XÓA (SAU KHI GỘP QUY TRÌNH)
                                                                            </span>
                                                                        )}

                                                                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] border border-slate-200">
                                                                            Bảng: {rec.sourceTable || 'land_records'}
                                                                        </span>

                                                                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold text-[10px] border border-blue-200">
                                                                            Điểm Đầu Vào: {qa.inputScore}đ
                                                                        </span>

                                                                        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 font-bold text-[10px] border border-purple-200">
                                                                            Điểm Quy Trình: {qa.workflowScore}đ
                                                                        </span>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-[11px] bg-white/80 p-2 rounded-lg border border-slate-200/80">
                                                                        <div>
                                                                            <span className="text-slate-500">Họ tên CSD: </span>
                                                                            <strong className={hasValidValue(rec.customerName) ? 'text-slate-900' : 'text-rose-500 italic'}>
                                                                                {rec.customerName || '(Thiếu họ tên)'}
                                                                            </strong>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-slate-500">SĐT: </span>
                                                                            <strong className={hasValidValue(rec.phoneNumber) ? 'text-emerald-700' : 'text-rose-500 italic'}>
                                                                                {rec.phoneNumber || '(Thiếu SĐT)'}
                                                                            </strong>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-slate-500">CCCD: </span>
                                                                            <strong className={hasValidValue(rec.cccd) ? 'text-emerald-700' : 'text-rose-500 italic'}>
                                                                                {rec.cccd || '(Thiếu CCCD)'}
                                                                            </strong>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-slate-500">Đ/c Chủ SD: </span>
                                                                            <strong className={hasValidValue(rec.customerAddress) ? 'text-slate-800' : 'text-rose-500 italic'}>
                                                                                {rec.customerAddress || '(Thiếu địa chỉ chủ)'}
                                                                            </strong>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-slate-500">Đ/c Thửa đất: </span>
                                                                            <strong className={hasValidValue(rec.address) || hasValidValue(rec.ward) ? 'text-slate-800' : 'text-rose-500 italic'}>
                                                                                {[rec.address, rec.ward].filter(Boolean).join(' - ') || '(Thiếu địa chỉ đất)'}
                                                                            </strong>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-slate-500">Tờ / Thửa / DT: </span>
                                                                            <strong className="text-slate-800">
                                                                                Tờ {rec.mapSheet || '--'} / Thửa {rec.landPlot || '--'} ({rec.area ? `${rec.area}m²` : '--'})
                                                                            </strong>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                                                        {qa.missingInputLabels.length > 0 ? (
                                                                            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-semibold">
                                                                                <AlertCircle size={12} />
                                                                                Khuyết đầu vào: {qa.missingInputLabels.join(', ')}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                                                                                <Check size={12} />
                                                                                Đầy đủ các trường đầu vào cốt lõi
                                                                            </span>
                                                                        )}

                                                                        {qa.presentWorkflowLabels.length > 0 && (
                                                                            <span className="text-slate-600">
                                                                                Dữ liệu quy trình có sẵn:{' '}
                                                                                <strong className="text-slate-800">
                                                                                    {qa.presentWorkflowLabels.slice(0, 6).join(', ')}
                                                                                    {qa.presentWorkflowLabels.length > 6 ? ` (+${qa.presentWorkflowLabels.length - 6})` : ''}
                                                                                </strong>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-200/60">
                                                                <div className="text-right">
                                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-indigo-50 text-indigo-900 border border-indigo-200">
                                                                        <span>Quy trình: {getStatusDisplayLabel(rec.status)}</span>
                                                                        {rec.exportBatch && (
                                                                            <span className="text-emerald-700">(Đợt {rec.exportBatch})</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-slate-400 text-[10px] font-mono mt-1">
                                                                        ID: {rec.id.substring(0, 12)}...
                                                                        {rec.receivedDate ? ` | Nhận: ${String(rec.receivedDate).split('T')[0]}` : ''}
                                                                    </div>
                                                                </div>

                                                                {!isKeep && (
                                                                    <button
                                                                        onClick={() => handleSelectKeepRecord(group.groupKey, rec.id, group.records)}
                                                                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-300 hover:border-emerald-300 transition-all cursor-pointer"
                                                                    >
                                                                        Đổi làm Bản Giữ Lại
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredGroups.length > duplicateRenderLimit && (
                                    <div className="pt-2 flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => setDuplicateRenderLimit(prev => prev + 40)}
                                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 cursor-pointer"
                                        >
                                            Hiển thị thêm 40 mã trùng (Còn {filteredGroups.length - duplicateRenderLimit} mã)
                                        </button>
                                        <button
                                            onClick={() => setDuplicateRenderLimit(filteredGroups.length)}
                                            className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200 cursor-pointer"
                                        >
                                            Hiện tất cả ({filteredGroups.length} mã)
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
