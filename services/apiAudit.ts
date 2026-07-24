import { RecordFile, Holiday } from '../types';
import { updateRecordsBatchById } from './apiRecords';
import { calculateDeadlineHelper } from '../utils/appHelpers';

export interface DateAuditIssue {
    recordId: string;
    recordCode: string;
    customerName: string;
    field: 'receivedDate' | 'deadline' | 'both';
    originalValue: string | null;
    issueType: 'missing' | 'has_time' | 'invalid_format' | 'logical_error' | 'mismatched_deadline';
    description: string;
    suggestedValue?: string;
    record?: RecordFile; // Lưu kèm record để chỉnh sửa nhanh dễ dàng hơn
}

export interface AuditReport {
    totalRecords: number;
    cleanRecordsCount: number;
    issueRecordsCount: number;
    
    // Statistics
    receivedDateMissing: number;
    receivedDateHasTime: number;
    receivedDateInvalid: number;
    
    deadlineMissing: number;
    deadlineHasTime: number;
    deadlineInvalid: number;
    
    logicalErrors: number;
    mismatchedDeadlines: number;
    
    // Details
    issues: DateAuditIssue[];
}

/**
 * Hàm hỗ trợ kiểm tra và chuẩn hóa ngày tháng.
 * Trả về chuỗi ISO YYYY-MM-DD hợp lệ, hoặc null nếu không thể chuẩn hóa thành ngày hợp lệ.
 */
export const tryNormalizeDate = (val: any): string | null => {
    if (val === null || val === undefined) return null;
    
    const strVal = String(val).trim();
    if (strVal === '') return null;
    
    // 1. Nếu đã là định dạng chuẩn YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
        const parts = strVal.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month - 1, day);
        if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
            return strVal;
        }
    }

    // 2. Trích xuất YYYY-MM-DD từ định dạng ISO Timestamp hoặc chuỗi bắt đầu bằng YYYY-MM-DD
    const isoMatch = strVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);
        const d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }
    
    // 3. Xử lý định dạng ngày dạng DD/MM/YYYY hoặc DD-MM-YYYY (với phần giờ bị cắt ra)
    const datePart = strVal.split(/[\sT]/)[0];
    const parts = datePart.split(/[-/]/);
    if (parts.length === 3) {
        let year = 0;
        let month = 0;
        let day = 0;
        
        if (parts[0].length === 4) { // YYYY-MM-DD hoặc YYYY/MM/DD
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10);
            day = parseInt(parts[2], 10);
        } else if (parts[2].length === 4) { // DD/MM/YYYY hoặc DD-MM-YYYY
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10);
            year = parseInt(parts[2], 10);
        }
        
        if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
    }
    
    // 4. Fallback: Parse ngày thông thường qua Date.parse
    const parsedMs = Date.parse(strVal);
    if (!isNaN(parsedMs)) {
        const d = new Date(parsedMs);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dayStr}`;
    }
    
    return null; // Không thể giải quyết
};

/**
 * Thực hiện một bản kiểm tra tính toàn vẹn (data integrity audit) 
 * trên toàn bộ các trường receivedDate và deadline.
 */
export const auditRecordsDates = (records: RecordFile[], holidays?: Holiday[]): AuditReport => {
    let receivedDateMissing = 0;
    let receivedDateHasTime = 0;
    let receivedDateInvalid = 0;
    
    let deadlineMissing = 0;
    let deadlineHasTime = 0;
    let deadlineInvalid = 0;
    
    let logicalErrors = 0;
    let mismatchedDeadlines = 0;
    
    const issues: DateAuditIssue[] = [];
    const issueRecordIdsSet = new Set<string>();

    records.forEach(r => {
        const recId = r.id;
        const recCode = r.code || 'KHÔNG MÃ';
        const name = r.customerName || 'Chưa rõ tên';
        let hasIssueThisRecord = false;

        // 1. Kiểm tra trường receivedDate (Ngày nhận)
        const rd = r.receivedDate;
        let rdIsValid = true;
        let rdNormalized: string | null = null;

        if (rd === null || rd === undefined || String(rd).trim() === '') {
            receivedDateMissing++;
            hasIssueThisRecord = true;
            issues.push({
                recordId: recId,
                recordCode: recCode,
                customerName: name,
                field: 'receivedDate',
                originalValue: null,
                issueType: 'missing',
                description: 'Thiếu thông tin ngày nhận (receivedDate)',
                record: r
            });
            rdIsValid = false;
        } else {
            const trimmedRd = String(rd).trim();
            rdNormalized = tryNormalizeDate(trimmedRd);
            
            if (rdNormalized === null) {
                receivedDateInvalid++;
                hasIssueThisRecord = true;
                issues.push({
                    recordId: recId,
                    recordCode: recCode,
                    customerName: name,
                    field: 'receivedDate',
                    originalValue: trimmedRd,
                    issueType: 'invalid_format',
                    description: `Ngày nhận sai định dạng hoặc không hợp lệ: "${trimmedRd}"`,
                    record: r
                });
                rdIsValid = false;
            } else {
                // Kiểm tra xem có chứa thông tin giờ/phút/giây hoặc định dạng chưa chuẩn ISO YYYY-MM-DD không
                const hasTime = trimmedRd.includes('T') || trimmedRd.includes(':') || trimmedRd.includes(' ') || trimmedRd.length > 10 || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedRd);
                if (hasTime) {
                    receivedDateHasTime++;
                    hasIssueThisRecord = true;
                    issues.push({
                        recordId: recId,
                        recordCode: recCode,
                        customerName: name,
                        field: 'receivedDate',
                        originalValue: trimmedRd,
                        issueType: 'has_time',
                        description: `Ngày nhận có chứa giờ/phút/giây hoặc định dạng chưa chuẩn: "${trimmedRd}"`,
                        record: r
                    });
                }
            }
        }

        // 2. Kiểm tra trường deadline (Hạn giải quyết)
        const dl = r.deadline;
        let dlIsValid = true;
        let dlNormalized: string | null = null;

        if (dl === null || dl === undefined || String(dl).trim() === '') {
            // Ghi nhận là thiếu deadline, tuy nhiên lưu ý một số hồ sơ đặc thù có thể không có hạn
            deadlineMissing++;
            hasIssueThisRecord = true;
            issues.push({
                recordId: recId,
                recordCode: recCode,
                customerName: name,
                field: 'deadline',
                originalValue: null,
                issueType: 'missing',
                description: 'Thiếu thông tin hạn giải quyết (deadline)',
                record: r
            });
            dlIsValid = false;
        } else {
            const trimmedDl = String(dl).trim();
            dlNormalized = tryNormalizeDate(trimmedDl);

            if (dlNormalized === null) {
                deadlineInvalid++;
                hasIssueThisRecord = true;
                issues.push({
                    recordId: recId,
                    recordCode: recCode,
                    customerName: name,
                    field: 'deadline',
                    originalValue: trimmedDl,
                    issueType: 'invalid_format',
                    description: `Hạn giải quyết sai định dạng hoặc không hợp lệ: "${trimmedDl}"`,
                    record: r
                });
                dlIsValid = false;
            } else {
                // Kiểm tra xem có chứa thông tin giờ/phút/giây hoặc định dạng chưa chuẩn không
                const hasTime = trimmedDl.includes('T') || trimmedDl.includes(':') || trimmedDl.includes(' ') || trimmedDl.length > 10 || !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDl);
                if (hasTime) {
                    deadlineHasTime++;
                    hasIssueThisRecord = true;
                    issues.push({
                        recordId: recId,
                        recordCode: recCode,
                        customerName: name,
                        field: 'deadline',
                        originalValue: trimmedDl,
                        issueType: 'has_time',
                        description: `Hạn giải quyết có chứa giờ/phút/giây hoặc định dạng chưa chuẩn: "${trimmedDl}"`,
                        record: r
                    });
                }
            }
        }

        // 3. Kiểm tra tính mâu thuẫn thời gian (Logical constraint): Hạn giải quyết < Ngày nhận
        if (rdIsValid && dlIsValid && rdNormalized && dlNormalized) {
            const rdDate = new Date(rdNormalized);
            const dlDate = new Date(dlNormalized);
            if (dlDate < rdDate) {
                logicalErrors++;
                hasIssueThisRecord = true;
                issues.push({
                    recordId: recId,
                    recordCode: recCode,
                    customerName: name,
                    field: 'both',
                    originalValue: `Nhận: ${rd} | Hạn: ${dl}`,
                    issueType: 'logical_error',
                    description: `Hạn giải quyết (${dlNormalized}) trước ngày nhận (${rdNormalized})`,
                    record: r
                });
            } else if (holidays && r.recordType) {
                // 4. Kiểm tra xem hạn giải quyết có khớp với hạn tính toán chuẩn không
                const suggestedDl = calculateDeadlineHelper(r.recordType, rdNormalized, holidays);
                if (suggestedDl && dlNormalized !== suggestedDl) {
                    mismatchedDeadlines++;
                    hasIssueThisRecord = true;
                    issues.push({
                        recordId: recId,
                        recordCode: recCode,
                        customerName: name,
                        field: 'deadline',
                        originalValue: dlNormalized,
                        issueType: 'mismatched_deadline',
                        description: `Hạn thực tế (${dlNormalized}) khác so với hạn đề xuất (${suggestedDl}) tính theo thủ tục & ngày nhận`,
                        suggestedValue: suggestedDl,
                        record: r
                    });
                }
            }
        }

        if (hasIssueThisRecord) {
            issueRecordIdsSet.add(recId);
        }
    });

    const totalRecords = records.length;
    const issueRecordsCount = issueRecordIdsSet.size;
    const cleanRecordsCount = totalRecords - issueRecordsCount;

    return {
        totalRecords,
        cleanRecordsCount,
        issueRecordsCount,
        receivedDateMissing,
        receivedDateHasTime,
        receivedDateInvalid,
        deadlineMissing,
        deadlineHasTime,
        deadlineInvalid,
        logicalErrors,
        mismatchedDeadlines,
        issues
    };
};

/**
 * Hàm chạy một lần để chuẩn hóa tất cả các giá trị ngày tháng hiện có về định dạng ISO YYYY-MM-DD,
 * loại bỏ bất kỳ dữ liệu giờ/phút/giây nào còn tồn dư.
 */
export const normalizeRecordsDatesApi = async (records: RecordFile[]): Promise<{ success: boolean; count: number }> => {
    const updates: Partial<RecordFile>[] = [];
    
    records.forEach(r => {
        let hasChange = false;
        const updatePayload: Partial<RecordFile> = { id: r.id };

        // Sửa receivedDate
        if (r.receivedDate !== null && r.receivedDate !== undefined) {
            const str = String(r.receivedDate).trim();
            if (str !== '') {
                const norm = tryNormalizeDate(str);
                // Nếu khác định dạng hiện có, cập nhật
                if (norm !== str) {
                    updatePayload.receivedDate = norm;
                    hasChange = true;
                }
            }
        }

        // Sửa deadline
        if (r.deadline !== null && r.deadline !== undefined) {
            const str = String(r.deadline).trim();
            if (str !== '') {
                const norm = tryNormalizeDate(str);
                if (norm !== str) {
                    updatePayload.deadline = norm;
                    hasChange = true;
                }
            }
        }

        if (hasChange) {
            updates.push(updatePayload);
        }
    });

    if (updates.length === 0) {
        return { success: true, count: 0 };
    }

    try {
        const result = await updateRecordsBatchById(updates);
        return {
            success: result.success,
            count: result.count
        };
    } catch (error) {
        console.error("Lỗi trong quá trình chuẩn hóa ngày tháng hồ sơ:", error);
        return { success: false, count: 0 };
    }
};
