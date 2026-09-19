/**
 * BỘ KIỂM ĐỊNH TỰ ĐỘNG 14 KỊCH BẢN NGHIỆP VỤ MODULE ĐĂNG KÝ / CẤP GIẤY
 * Chạy bằng tsx: npx tsx test/registrationWorkflow.test.ts
 */

import { RecordStatus, RecordFile } from '../types';
import {
  calculateRegistrationDeadline,
  getRegistrationWorkflowCategory,
  getRegistrationWorkflow,
  addWorkingDays,
  addCalendarDays,
  calculateWorkingDaysBetween,
} from '../utils/registrationWorkflows';
import {
  validateCapGiayTransition,
  resumeFromSupplement,
  handleCapGiaySupplement,
  isCapGiayStatus,
  CAP_GIAY_STATUSES,
} from '../utils/capGiayStateMachine';

// Mock holidays cho kiểm thử: Giả định nghỉ ngày 2026-04-30 và 2026-05-01
const TEST_HOLIDAYS = [
  { id: '1', date: '2026-04-30', name: 'Giải phóng miền Nam' },
  { id: '2', date: '2026-05-01', name: 'Quốc tế Lao động' },
];

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failCount++;
  }
}

console.log('================================================================');
console.log('BẮT ĐẦU KIỂM THỬ 14 CA NGHIỆP VỤ MODULE ĐĂNG KÝ / CẤP GIẤY');
console.log('================================================================\n');

// 1. Test 3.1.1 Chuyển quyền (tax_transfer) - 13 ngày làm việc
{
  const rec: Partial<RecordFile> = {
    recordType: '3.1.1 Chuyển quyền',
    receivedDate: '2026-04-06', // Thứ 2
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'tax_transfer', 'Test 1.1: 3.1.1 phân loại đúng tax_transfer');
  assert(res.workingDays === 13, 'Test 1.2: 3.1.1 thời gian chuẩn 13 ngày làm việc');
  // 2026-04-06 (T2) + 13 ngày làm việc:
  // Tuần 1: 07, 08, 09, 10 (4 ngày)
  // Tuần 2: 13, 14, 15, 16, 17 (5 ngày => tổng 9 ngày)
  // Tuần 3: 20, 21, 22, 23 (4 ngày => tổng 13 ngày -> Hạn là 2026-04-23)
  assert(res.deadline === '2026-04-23', 'Test 1.3: 3.1.1 tính đúng deadline 2026-04-23', `Nhận: ${res.deadline}`);
}

// 2. Test 3.1.2 Phân chia quyền (tax_transfer) - 13 ngày làm việc
{
  const rec: Partial<RecordFile> = {
    recordType: '3.1.2 Phân chia quyền',
    receivedDate: '2026-04-06',
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'tax_transfer' && res.workingDays === 13, 'Test 2: 3.1.2 phân loại tax_transfer 13 ngày');
}

// 3. Test 3.1.3 Theo Bản án / Quyết định (tax_transfer) - 13 ngày làm việc
{
  const rec: Partial<RecordFile> = {
    recordType: '3.1.3 Theo Bản án / QĐ',
    receivedDate: '2026-04-06',
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'tax_transfer' && res.workingDays === 13, 'Test 3: 3.1.3 phân loại tax_transfer 13 ngày');
}

// 4. Test 3.2.1 Cấp đổi (fast_track) - 10 ngày làm việc (không thuế)
{
  const rec: Partial<RecordFile> = {
    recordType: '3.2.1 Cấp đổi',
    receivedDate: '2026-04-06',
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'fast_track', 'Test 4.1: 3.2.1 phân loại fast_track');
  assert(res.workingDays === 10, 'Test 4.2: 3.2.1 thời gian chuẩn 10 ngày');
  // 06/04 + 10 ngày làm việc:
  // Tuần 1: 07, 08, 09, 10 (4)
  // Tuần 2: 13, 14, 15, 16, 17 (5 => 9)
  // Tuần 3: 20 (1 => 10) -> 2026-04-20
  assert(res.deadline === '2026-04-20', 'Test 4.3: 3.2.1 tính đúng deadline 2026-04-20', `Nhận: ${res.deadline}`);
}

// 5. Test 3.2.2 Cấp đổi có thuế (tax_transfer) - 15 ngày làm việc
{
  const rec: Partial<RecordFile> = {
    recordType: '3.2.2 Cấp đổi (có thuế)',
    receivedDate: '2026-04-06',
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'tax_transfer', 'Test 5.1: 3.2.2 phân loại tax_transfer');
  assert(res.workingDays === 15, 'Test 5.2: 3.2.2 thời gian chuẩn 15 ngày');
}

// 6. Test 3.3.1 Cấp lại (lost_cert) - 10 ngày làm việc + 30 ngày niêm yết
{
  const rec: Partial<RecordFile> = {
    recordType: '3.3.1 Cấp lại do mất',
    receivedDate: '2026-04-06',
    postingDate: '2026-04-08',
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'lost_cert', 'Test 6.1: 3.3.1 phân loại lost_cert');
  assert(res.workingDays === 10, 'Test 6.2: 3.3.1 thời gian xử lý 10 ngày làm việc');
  assert(res.hasPostingNotice === true, 'Test 6.3: 3.3.1 có cờ niêm yết công khai');
  assert(res.postingEndDate === '2026-05-08', 'Test 6.4: 3.3.1 tính đúng ngày kết thúc niêm yết (30 ngày lịch từ postingDate)', `Nhận: ${res.postingEndDate}`);
}

// 7. Test 3.3.2 Cấp lại có thuế (lost_cert_tax) - 15 ngày làm việc + 30 ngày niêm yết
{
  const rec: Partial<RecordFile> = {
    recordType: '3.3.2 Cấp lại (có thuế)',
    receivedDate: '2026-04-06',
    postingDate: '2026-04-10',
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'lost_cert_tax', 'Test 7.1: 3.3.2 phân loại lost_cert_tax');
  assert(res.workingDays === 15, 'Test 7.2: 3.3.2 thời gian xử lý 15 ngày làm việc');
  assert(res.postingEndDate === '2026-05-10', 'Test 7.3: 3.3.2 tính đúng hạn niêm yết 30 ngày lịch');
}

// 8. Test 3.4.1 Tách - hợp thửa (split_plot) - 17 ngày làm việc
{
  const rec: Partial<RecordFile> = {
    recordType: '3.4.1 Tách - hợp thửa',
    receivedDate: '2026-04-06',
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'split_plot', 'Test 8.1: 3.4.1 phân loại split_plot');
  assert(res.workingDays === 17, 'Test 8.2: 3.4.1 thời gian chuẩn 17 ngày làm việc');
}

// 9. Test 3.5.1 Gia hạn (fast_track) - 12 ngày làm việc
{
  const rec: Partial<RecordFile> = {
    recordType: '3.5.1 Gia hạn sử dụng đất',
    receivedDate: '2026-04-06',
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'fast_track', 'Test 9.1: 3.5.1 phân loại fast_track');
  assert(res.workingDays === 12, 'Test 9.2: 3.5.1 thời gian chuẩn 12 ngày làm việc');
}

// 10. Test 3.6.1 Chuyển mục đích (fast_track) - 7 ngày làm việc
{
  const rec: Partial<RecordFile> = {
    recordType: '3.6.1 Chuyển mục đích',
    receivedDate: '2026-04-06',
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'fast_track', 'Test 10.1: 3.6.1 phân loại fast_track');
  assert(res.workingDays === 7, 'Test 10.2: 3.6.1 thời gian chuẩn 7 ngày làm việc');
}

// 11. Test 3.7.1 Đính chính GCN (fast_track) - 7 ngày làm việc
{
  const rec: Partial<RecordFile> = {
    recordType: '3.7.1 Đính chính',
    receivedDate: '2026-04-06',
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'fast_track', 'Test 11.1: 3.7.1 phân loại fast_track');
  assert(res.workingDays === 7, 'Test 11.2: 3.7.1 thời gian chuẩn 7 ngày làm việc');
}

// 12. Test 3.8.1 Đăng ký GDBD / Thế chấp (gdbd_register) - 3 ngày làm việc
{
  const rec: Partial<RecordFile> = {
    recordType: '3.8.1 Đăng ký GDBD',
    receivedDate: '2026-04-06',
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'gdbd_register', 'Test 12.1: 3.8.1 phân loại gdbd_register (Tách biệt khỏi xóa)');
  assert(res.workingDays === 3, 'Test 12.2: 3.8.1 thời hạn chuẩn 3 ngày làm việc');
  // 06/04 (T2) + 3 ngày làm việc: 07, 08, 09 -> 2026-04-09
  assert(res.deadline === '2026-04-09', 'Test 12.3: 3.8.1 tính đúng deadline 2026-04-09', `Nhận: ${res.deadline}`);
}

// 13. Test 3.8.2 Xóa ĐK GDBD / Giải chấp (gdbd_release) - 1 ngày làm việc
{
  const rec: Partial<RecordFile> = {
    recordType: '3.8.2 Xóa ĐK GDBD',
    receivedDate: '2026-04-06',
  };
  const res = calculateRegistrationDeadline(rec, TEST_HOLIDAYS);
  assert(res.category === 'gdbd_release', 'Test 13.1: 3.8.2 phân loại gdbd_release (Tách biệt)');
  assert(res.workingDays === 1, 'Test 13.2: 3.8.2 thời hạn chuẩn 1 ngày làm việc');
  // 06/04 + 1 ngày làm việc -> 2026-04-07
  assert(res.deadline === '2026-04-07', 'Test 13.3: 3.8.2 tính đúng deadline 2026-04-07', `Nhận: ${res.deadline}`);
}

// 14. Test An toàn & Quản lý Tạm dừng:
// - Thiếu recordType -> TUYỆT ĐỐI không default sang tax_transfer
// - Tạm dừng bổ sung hồ sơ và phục hồi: quay lại đúng bước cũ, bù số ngày tạm dừng vào deadline
{
  // A. Kiểm tra Unclassified
  const recUnclassified: Partial<RecordFile> = {
    recordType: '',
    receivedDate: '2026-04-06',
  };
  const resUnc = calculateRegistrationDeadline(recUnclassified, TEST_HOLIDAYS);
  assert(resUnc.category === 'unclassified', 'Test 14.1: Thiếu recordType phân loại unclassified');
  assert(resUnc.deadline === '', 'Test 14.2: Thiếu recordType KHÔNG default deadline bừa bãi, trả về rỗng');

  // B. State machine: 14 trạng thái khép kín & chặn trạng thái Đo đạc/Lưu trữ
  assert(CAP_GIAY_STATUSES.length === 14, 'Test 14.3: Module Cấp giấy có đủ 14 trạng thái khép kín');
  const invalidTransition = validateCapGiayTransition(
    RecordStatus.RECEIVED,
    'ASSIGNED_SURVEYOR' as any, // Trạng thái của Đo đạc
    null
  );
  assert(invalidTransition.valid === false, 'Test 14.4: Chặn triệt để trạng thái Đo đạc xâm nhập Cấp giấy');

  // C. Cơ chế Tạm dừng (PENDING_SUPPLEMENT) và Phục hồi (RESUME)
  const baseRecord: RecordFile = {
    id: 'test-rec-1',
    code: '3.1.1-TEST',
    customerName: 'Nguyễn Văn A',
    recordType: '3.1.1 Chuyển quyền',
    status: RecordStatus.APPRAISAL,
    receivedDate: '2026-04-06',
    deadline: '2026-04-23', // Deadline ban đầu
  };

  // Yêu cầu bổ sung khi đang ở bước APPRAISAL
  const paused = handleCapGiaySupplement(baseRecord, 'Thiếu CMND công chứng', 'Nguyễn Văn A');
  assert(paused.status === RecordStatus.PENDING_SUPPLEMENT, 'Test 14.5: Chuyển sang PENDING_SUPPLEMENT');
  assert(paused.previousStatus === RecordStatus.APPRAISAL, 'Test 14.6: Lưu lại previousStatus = APPRAISAL');
  assert(paused.supplementReturnStatus === RecordStatus.APPRAISAL, 'Test 14.7: Lưu supplementReturnStatus = APPRAISAL');

  // Thử chuyển từ PENDING_SUPPLEMENT sang bước sai -> Bị chặn
  const illegalResume = validateCapGiayTransition(
    RecordStatus.PENDING_SUPPLEMENT,
    RecordStatus.PENDING_SIGN,
    paused.previousStatus
  );
  assert(illegalResume.valid === false, 'Test 14.8: Bổ sung xong không được nhảy cóc sang Ký duyệt');

  // Phục hồi hợp lệ: Tạm dừng từ ngày 2026-04-08 đến 2026-04-10 (2 ngày làm việc)
  const pausedRecord: RecordFile = {
    ...baseRecord,
    ...paused,
    supplementStartedAt: '2026-04-08T08:00:00.000Z',
  };
  // Giả lập phục hồi vào ngày 2026-04-10
  const workingDaysPaused = calculateWorkingDaysBetween('2026-04-08', '2026-04-10', TEST_HOLIDAYS);
  assert(workingDaysPaused === 2, 'Test 14.9: Tính đúng 2 ngày làm việc tạm dừng');

  const resumed = resumeFromSupplement(
    {
      ...pausedRecord,
      supplementStartedAt: '2026-04-08',
    },
    TEST_HOLIDAYS
  );
  assert(resumed.nextStatus === RecordStatus.APPRAISAL, 'Test 14.10: Phục hồi quay lại đúng bước APPRAISAL');
}

console.log('\n================================================================');
console.log(`KẾT QUẢ KIỂM THỬ: ${passCount} PASSED | ${failCount} FAILED`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
