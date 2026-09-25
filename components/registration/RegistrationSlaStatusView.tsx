import React, { useState, useEffect } from 'react';
import { Clock, Calendar, ShieldCheck, CheckCircle2, Save, RotateCcw, Plus, Trash2, Edit3, ArrowUp, ArrowDown, Settings2, FileText, Check, ListChecks, Layers, ToggleLeft, ToggleRight, Search, Filter } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';

// Storage Key
export const REGISTRATION_SLA_CONFIG_KEY = 'registration_sla_status_config_v1';

export interface WorkShift {
  start: string; // e.g. "07:30"
  end: string;   // e.g. "11:30"
}

export interface WorkScheduleConfig {
  morning: WorkShift;
  afternoon: WorkShift;
  excludeSaturday: boolean;
  excludeSunday: boolean;
  excludeHolidays: boolean;
}

export interface ProcedureStep {
  id: string;
  stepNumber: number;
  name: string;
  durationHours: number; // e.g. 8 hours
  durationDays: number;  // e.g. 1 day
  isNoSla?: boolean;     // Cờ không tính SLA cho riêng bước này
  description?: string;
}

export interface ProcedureItemConfig {
  id: string;
  module: 'dangky' | 'dodac' | 'luutru';
  code: string;         // e.g. "3.1.1", "2.1", "1.1"
  name: string;         // Tên thủ tục chi tiết
  hasTax?: boolean;
  hasPosting?: boolean;
  hasFieldWork?: boolean;
  isNoSla?: boolean;    // Cờ không tính SLA cho thủ tục này
  description: string;
  steps: ProcedureStep[];
}

export interface ProcedureGroupConfig {
  id: string;
  code: string;
  name: string;
  procedureCodes: string[];
  hasTax: boolean;
  hasPosting: boolean;
  description: string;
  steps: ProcedureStep[];
}

export interface StatusTabMap {
  id: string;
  statusName: string;
  targetTabKey: string;
  targetTabName: string;
  description?: string;
  isSystemDefault?: boolean;
}

export interface RegistrationSlaFullConfig {
  schedule: WorkScheduleConfig;
  procedureItems: ProcedureItemConfig[];
  procedureGroups?: ProcedureGroupConfig[]; // legacy backward compatibility
  statusTabMappings: StatusTabMap[];
}

// Mặc định Cấu hình Ca làm việc
export const DEFAULT_WORK_SCHEDULE: WorkScheduleConfig = {
  morning: { start: '07:30', end: '11:30' },
  afternoon: { start: '13:30', end: '17:30' },
  excludeSaturday: true,
  excludeSunday: true,
  excludeHolidays: true,
};

// Bước mẫu theo phân loại
const STEPS_TAX_10: ProcedureStep[] = [
  { id: 's1', stepNumber: 1, name: 'Tiếp nhận hồ sơ', durationHours: 4, durationDays: 0.5, description: 'Kiểm tra tính pháp lý và tiếp nhận' },
  { id: 's2', stepNumber: 2, name: 'Thẩm định', durationHours: 16, durationDays: 2, description: 'Thẩm định hồ sơ đất đai' },
  { id: 's3', stepNumber: 3, name: 'Phiếu chuyển thuế', durationHours: 8, durationDays: 1, description: 'Lập phiếu chuyển thông tin thuế' },
  { id: 's4', stepNumber: 4, name: 'Thuế Khu vực 7', durationHours: 24, durationDays: 3, description: 'Xác định nghĩa vụ tài chính' },
  { id: 's5', stepNumber: 5, name: 'Thông báo thuế', durationHours: 8, durationDays: 1, description: 'Gửi thông báo thuế cho chủ sử dụng' },
  { id: 's6', stepNumber: 6, name: 'In GCN', durationHours: 8, durationDays: 1, description: 'In Giấy chứng nhận' },
  { id: 's7', stepNumber: 7, name: 'Kiểm tra', durationHours: 8, durationDays: 1, description: 'Kiểm tra thông tin trước trình ký' },
  { id: 's8', stepNumber: 8, name: 'Trình ký', durationHours: 8, durationDays: 1, description: 'Trình Lãnh đạo duyệt ký GCN' },
  { id: 's9', stepNumber: 9, name: 'Hoàn Thành', durationHours: 4, durationDays: 0.5, description: 'Đã ký duyệt, hoàn thiện hồ sơ' },
  { id: 's10', stepNumber: 10, name: 'Trả kết quả', durationHours: 4, durationDays: 0.5, description: 'Trả kết quả cho 1 cửa / chủ nhà' },
];

const STEPS_NO_TAX_6: ProcedureStep[] = [
  { id: 's1', stepNumber: 1, name: 'Tiếp nhận hồ sơ', durationHours: 4, durationDays: 0.5, description: 'Kiểm tra và tiếp nhận hồ sơ' },
  { id: 's2', stepNumber: 2, name: 'In GCN', durationHours: 8, durationDays: 1, description: 'In Giấy chứng nhận / Trang 4' },
  { id: 's3', stepNumber: 3, name: 'Kiểm tra', durationHours: 8, durationDays: 1, description: 'Kiểm tra kỹ thuật nội bộ' },
  { id: 's4', stepNumber: 4, name: 'Trình ký', durationHours: 8, durationDays: 1, description: 'Trình Lãnh đạo ký duyệt' },
  { id: 's5', stepNumber: 5, name: 'Hoàn Thành', durationHours: 4, durationDays: 0.5, description: 'Sẵn sàng giao trả' },
  { id: 's6', stepNumber: 6, name: 'Trả kết quả', durationHours: 4, durationDays: 0.5, description: 'Bàn giao kết quả cho 1 cửa' },
];

const STEPS_POSTING_NO_TAX_8: ProcedureStep[] = [
  { id: 's1', stepNumber: 1, name: 'Tiếp nhận hồ sơ', durationHours: 4, durationDays: 0.5 },
  { id: 's2', stepNumber: 2, name: 'Thẩm định', durationHours: 16, durationDays: 2 },
  { id: 's3', stepNumber: 3, name: 'Niêm Yết', durationHours: 120, durationDays: 15, description: 'Niêm yết công khai 15 ngày làm việc' },
  { id: 's4', stepNumber: 4, name: 'In GCN', durationHours: 8, durationDays: 1 },
  { id: 's5', stepNumber: 5, name: 'Kiểm tra', durationHours: 8, durationDays: 1 },
  { id: 's6', stepNumber: 6, name: 'Trình ký', durationHours: 8, durationDays: 1 },
  { id: 's7', stepNumber: 7, name: 'Hoàn Thành', durationHours: 4, durationDays: 0.5 },
  { id: 's8', stepNumber: 8, name: 'Trả kết quả', durationHours: 4, durationDays: 0.5 },
];

const STEPS_POSTING_TAX_11: ProcedureStep[] = [
  { id: 's1', stepNumber: 1, name: 'Tiếp nhận hồ sơ', durationHours: 4, durationDays: 0.5 },
  { id: 's2', stepNumber: 2, name: 'Thẩm định', durationHours: 16, durationDays: 2 },
  { id: 's3', stepNumber: 3, name: 'Niêm Yết', durationHours: 120, durationDays: 15, description: 'Niêm yết công khai 15 ngày làm việc' },
  { id: 's4', stepNumber: 4, name: 'Phiếu chuyển thuế', durationHours: 8, durationDays: 1 },
  { id: 's5', stepNumber: 5, name: 'Thuế Khu vực 7', durationHours: 24, durationDays: 3 },
  { id: 's6', stepNumber: 6, name: 'Thông báo thuế', durationHours: 8, durationDays: 1 },
  { id: 's7', stepNumber: 7, name: 'In GCN', durationHours: 8, durationDays: 1 },
  { id: 's8', stepNumber: 8, name: 'Kiểm tra', durationHours: 8, durationDays: 1 },
  { id: 's9', stepNumber: 9, name: 'Trình ký', durationHours: 8, durationDays: 1 },
  { id: 's10', stepNumber: 10, name: 'Hoàn Thành', durationHours: 4, durationDays: 0.5 },
  { id: 's11', stepNumber: 11, name: 'Trả kết quả', durationHours: 4, durationDays: 0.5 },
];

const STEPS_DODAC_NO_FIELD_10: ProcedureStep[] = [
  { id: 'd1', stepNumber: 1, name: 'Tiếp nhận mới', durationHours: 12, durationDays: 1.5 },
  { id: 'd2', stepNumber: 2, name: 'Biên tập bản đồ', durationHours: 32, durationDays: 4 },
  { id: 'd3', stepNumber: 3, name: 'Kiểm tra', durationHours: 16, durationDays: 2 },
  { id: 'd4', stepNumber: 4, name: 'Trình ký', durationHours: 12, durationDays: 1.5 },
  { id: 'd5', stepNumber: 5, name: 'Hoàn Thành', durationHours: 4, durationDays: 0.5 },
  { id: 'd6', stepNumber: 6, name: 'Trả kết quả', durationHours: 4, durationDays: 0.5 },
];

const STEPS_DODAC_FIELD_30: ProcedureStep[] = [
  { id: 'df1', stepNumber: 1, name: 'Tiếp nhận mới', durationHours: 16, durationDays: 2 },
  { id: 'df2', stepNumber: 2, name: 'Đo đạc thực địa', durationHours: 96, durationDays: 12 },
  { id: 'df3', stepNumber: 3, name: 'Biên tập bản đồ', durationHours: 80, durationDays: 10 },
  { id: 'df4', stepNumber: 4, name: 'Kiểm tra', durationHours: 24, durationDays: 3 },
  { id: 'df5', stepNumber: 5, name: 'Trình ký', durationHours: 16, durationDays: 2 },
  { id: 'df6', stepNumber: 6, name: 'Hoàn Thành', durationHours: 4, durationDays: 0.5 },
  { id: 'df7', stepNumber: 7, name: 'Trả kết quả', durationHours: 4, durationDays: 0.5 },
];

const STEPS_DODAC_DUYETDON_12: ProcedureStep[] = [
  { id: 'dd1', stepNumber: 1, name: 'Tiếp nhận mới', durationHours: 16, durationDays: 2 },
  { id: 'dd2', stepNumber: 2, name: 'Biên tập bản đồ', durationHours: 40, durationDays: 5 },
  { id: 'dd3', stepNumber: 3, name: 'Kiểm tra', durationHours: 16, durationDays: 2 },
  { id: 'dd4', stepNumber: 4, name: 'Trình ký', durationHours: 16, durationDays: 2 },
  { id: 'dd5', stepNumber: 5, name: 'Hoàn Thành', durationHours: 4, durationDays: 0.5 },
  { id: 'dd6', stepNumber: 6, name: 'Trả kết quả', durationHours: 4, durationDays: 0.5 },
];

const STEPS_LUUTRU_10: ProcedureStep[] = [
  { id: 'l1', stepNumber: 1, name: 'Tiếp nhận mới', durationHours: 8, durationDays: 1 },
  { id: 'l2', stepNumber: 2, name: 'Đang thực hiện', durationHours: 40, durationDays: 5 },
  { id: 'l3', stepNumber: 3, name: 'Trình ký', durationHours: 16, durationDays: 2 },
  { id: 'l4', stepNumber: 4, name: 'Hoàn Thành', durationHours: 8, durationDays: 1 },
  { id: 'l5', stepNumber: 5, name: 'Trả kết quả', durationHours: 8, durationDays: 1 },
];

// Helper sắp xếp danh sách thủ tục tăng dần theo mã thủ tục (1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1.1...)
export function sortProcedureItems(items: ProcedureItemConfig[]): ProcedureItemConfig[] {
  return [...items].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
}

// MẶC ĐỊNH CHI TIẾT TỪNG THỦ TỤC CỦA CẢ 3 MODULE (SẮP XẾP TỪ NHỎ ĐẾN LỚN)
export const DEFAULT_PROCEDURE_ITEMS: ProcedureItemConfig[] = [
  // --- MODULE LƯU TRỮ (Mã 1.x) ---
  {
    id: 'proc_1_1',
    module: 'luutru',
    code: '1.1',
    name: '1.1 Sao lục',
    description: 'SLA chuẩn 10 ngày, quy trình 5 bước bao gồm Trả kết quả',
    steps: STEPS_LUUTRU_10,
  },
  {
    id: 'proc_1_2',
    module: 'luutru',
    code: '1.2',
    name: '1.2 Công văn',
    description: 'SLA chuẩn 10 ngày, quy trình 5 bước bao gồm Trả kết quả',
    steps: STEPS_LUUTRU_10,
  },

  // --- MODULE ĐO ĐẠC (Mã 2.x) ---
  {
    id: 'proc_2_1',
    module: 'dodac',
    code: '2.1',
    name: '2.1 Trích lục',
    hasFieldWork: false,
    description: 'SLA chuẩn 10 ngày, quy trình 6 bước biên tập và trình ký',
    steps: STEPS_DODAC_NO_FIELD_10,
  },
  {
    id: 'proc_2_2',
    module: 'dodac',
    code: '2.2',
    name: '2.2 Trích đo',
    hasFieldWork: true,
    description: 'SLA chuẩn 30 ngày, quy trình 7 bước bao gồm Đo đạc thực địa',
    steps: STEPS_DODAC_FIELD_30,
  },
  {
    id: 'proc_2_3',
    module: 'dodac',
    code: '2.3',
    name: '2.3 Duyệt đơn',
    hasFieldWork: false,
    description: 'SLA chuẩn 12 ngày, quy trình 6 bước không qua ngoại nghiệp',
    steps: STEPS_DODAC_DUYETDON_12,
  },
  {
    id: 'proc_2_4',
    module: 'dodac',
    code: '2.4',
    name: '2.4 Cắm mốc',
    hasFieldWork: true,
    description: 'SLA chuẩn 30 ngày, quy trình 7 bước có đo đạc thực địa',
    steps: STEPS_DODAC_FIELD_30,
  },
  {
    id: 'proc_2_5',
    module: 'dodac',
    code: '2.5',
    name: '2.5 Tách-Hợp thửa',
    hasFieldWork: true,
    description: 'SLA chuẩn 30 ngày, quy trình 7 bước cắm mốc ranh giới',
    steps: STEPS_DODAC_FIELD_30,
  },

  // --- MODULE CẤP GIẤY (Mã 3.x) ---
  {
    id: 'proc_3_1_1',
    module: 'dangky',
    code: '3.1.1',
    name: '3.1.1 Chuyển quyền',
    hasTax: true,
    hasPosting: false,
    description: 'Quy trình có thuế 10 bước chuyển cơ quan Thuế và thông báo tài chính',
    steps: STEPS_TAX_10,
  },
  {
    id: 'proc_3_1_2',
    module: 'dangky',
    code: '3.1.2',
    name: '3.1.2 Phân chia quyền',
    hasTax: true,
    hasPosting: false,
    description: 'Quy trình có thuế 10 bước chuyển cơ quan Thuế',
    steps: STEPS_TAX_10,
  },
  {
    id: 'proc_3_1_3',
    module: 'dangky',
    code: '3.1.3',
    name: '3.1.3 Theo Bản án / QĐ',
    hasTax: true,
    hasPosting: false,
    description: 'Quy trình có thuế 10 bước chuyển cơ quan Thuế',
    steps: STEPS_TAX_10,
  },
  {
    id: 'proc_3_2_1',
    module: 'dangky',
    code: '3.2.1',
    name: '3.2.1 Cấp đổi',
    hasTax: false,
    hasPosting: false,
    description: 'Quy trình không thuế 6 bước xử lý nội bộ',
    steps: STEPS_NO_TAX_6,
  },
  {
    id: 'proc_3_2_2',
    module: 'dangky',
    code: '3.2.2',
    name: '3.2.2 Cấp đổi (có thuế)',
    hasTax: true,
    hasPosting: false,
    description: 'Quy trình có thuế 10 bước',
    steps: STEPS_TAX_10,
  },
  {
    id: 'proc_3_3_1',
    module: 'dangky',
    code: '3.3.1',
    name: '3.3.1 Cấp lại',
    hasTax: false,
    hasPosting: true,
    description: 'Quy trình 8 bước có thời gian Niêm Yết công khai 15 ngày làm việc',
    steps: STEPS_POSTING_NO_TAX_8,
  },
  {
    id: 'proc_3_3_2',
    module: 'dangky',
    code: '3.3.2',
    name: '3.3.2 Cấp lại (có thuế)',
    hasTax: true,
    hasPosting: true,
    description: 'Quy trình đầy đủ 11 bước bao gồm Niêm yết và Luồng Chuyển Thuế',
    steps: STEPS_POSTING_TAX_11,
  },
  {
    id: 'proc_3_4_1',
    module: 'dangky',
    code: '3.4.1',
    name: '3.4.1 Tách - hợp thửa',
    hasTax: false,
    hasPosting: false,
    description: 'Quy trình không thuế 6 bước',
    steps: STEPS_NO_TAX_6,
  },
  {
    id: 'proc_3_4_2',
    module: 'dangky',
    code: '3.4.2',
    name: '3.4.2 Tách thửa CQ',
    hasTax: true,
    hasPosting: false,
    description: 'Quy trình có thuế 10 bước',
    steps: STEPS_TAX_10,
  },
  {
    id: 'proc_3_5_1',
    module: 'dangky',
    code: '3.5.1',
    name: '3.5.1 Gia hạn',
    hasTax: false,
    hasPosting: false,
    description: 'Quy trình không thuế 6 bước',
    steps: STEPS_NO_TAX_6,
  },
  {
    id: 'proc_3_6_1',
    module: 'dangky',
    code: '3.6.1',
    name: '3.6.1 Chuyển mục đích',
    hasTax: false,
    hasPosting: false,
    description: 'Quy trình không thuế 6 bước',
    steps: STEPS_NO_TAX_6,
  },
  {
    id: 'proc_3_7_1',
    module: 'dangky',
    code: '3.7.1',
    name: '3.7.1 Đính chính',
    hasTax: false,
    hasPosting: false,
    description: 'Quy trình không thuế 6 bước',
    steps: STEPS_NO_TAX_6,
  },
  {
    id: 'proc_3_7_2',
    module: 'dangky',
    code: '3.7.2',
    name: '3.7.2 Đổi thông tin',
    hasTax: false,
    hasPosting: false,
    description: 'Quy trình không thuế 6 bước',
    steps: STEPS_NO_TAX_6,
  },
  {
    id: 'proc_3_8_1',
    module: 'dangky',
    code: '3.8.1',
    name: '3.8.1 Đăng ký GDBD',
    hasTax: false,
    hasPosting: false,
    description: 'Quy trình không thuế 6 bước',
    steps: STEPS_NO_TAX_6,
  },
  {
    id: 'proc_3_8_2',
    module: 'dangky',
    code: '3.8.2',
    name: '3.8.2 Xóa ĐK GDBD',
    hasTax: false,
    hasPosting: false,
    description: 'Quy trình không thuế 6 bước',
    steps: STEPS_NO_TAX_6,
  },
];

// Danh sách các Tab trên UI Module Cấp giấy
export const REGISTRATION_UI_TABS = [
  { key: 'chua_giao', label: 'Chưa giao' },
  { key: 'tham_dinh', label: 'Thẩm định' },
  { key: 'phieu_chuyen_thue', label: 'Phiếu chuyển thuế' },
  { key: 'thue_khu_vuc_7', label: 'Thuế Khu vực 7' },
  { key: 'thong_bao_thue', label: 'Thông báo thuế' },
  { key: 'in_gcn', label: 'In GCN' },
  { key: 'kiem_tra', label: 'Kiểm tra' },
  { key: 'trinh_ky', label: 'Trình ký' },
  { key: 'cho_ban_giao', label: 'Chờ bàn giao' },
  { key: 'cho_tra_ket_qua', label: 'Chờ trả kết quả' },
  { key: 'da_tra_ket_qua', label: 'Đã trả kết quả' },
  { key: 'all', label: 'Tất cả hồ sơ' },
];

// Mặc định Bảng Ánh xạ Trạng thái -> Tab UI
export const DEFAULT_STATUS_TAB_MAPPINGS: StatusTabMap[] = [
  { id: 'm1', statusName: 'Tiếp nhận hồ sơ', targetTabKey: 'chua_giao', targetTabName: 'Chưa giao', isSystemDefault: true },
  { id: 'm2', statusName: 'Chờ thẩm định', targetTabKey: 'tham_dinh', targetTabName: 'Thẩm định', isSystemDefault: true },
  { id: 'm3', statusName: 'Chờ chuyển thuế', targetTabKey: 'phieu_chuyen_thue', targetTabName: 'Phiếu chuyển thuế', isSystemDefault: true },
  { id: 'm4', statusName: 'Chờ thuế khu vực 7', targetTabKey: 'thue_khu_vuc_7', targetTabName: 'Thuế Khu vực 7', isSystemDefault: true },
  { id: 'm5', statusName: 'Chờ giấy nộp tiền', targetTabKey: 'thong_bao_thue', targetTabName: 'Thông báo thuế', isSystemDefault: true },
  { id: 'm6', statusName: 'Chờ In giấy chứng nhận', targetTabKey: 'in_gcn', targetTabName: 'In GCN', isSystemDefault: true },
  { id: 'm7', statusName: 'Chờ kiểm tra', targetTabKey: 'kiem_tra', targetTabName: 'Kiểm tra', isSystemDefault: true },
  { id: 'm8', statusName: 'Chờ ký duyệt', targetTabKey: 'trinh_ky', targetTabName: 'Trình ký', isSystemDefault: true },
  { id: 'm9', statusName: 'Chờ bàn giao', targetTabKey: 'cho_ban_giao', targetTabName: 'Chờ bàn giao', isSystemDefault: true },
  { id: 'm10', statusName: 'Đã giao 1 cửa', targetTabKey: 'cho_tra_ket_qua', targetTabName: 'Chờ trả kết quả', isSystemDefault: true },
  { id: 'm11', statusName: 'Đã trả kết quả', targetTabKey: 'da_tra_ket_qua', targetTabName: 'Đã trả kết quả', isSystemDefault: true },
  { id: 'm12', statusName: 'Chờ Niêm yết', targetTabKey: 'all', targetTabName: 'Tất cả hồ sơ', isSystemDefault: true },
  { id: 'm13', statusName: 'Chờ bổ sung', targetTabKey: 'all', targetTabName: 'Tất cả hồ sơ', isSystemDefault: true },
  { id: 'm14', statusName: 'CSD rút hồ sơ', targetTabKey: 'all', targetTabName: 'Tất cả hồ sơ', isSystemDefault: true },
  { id: 'm15', statusName: 'Trả hồ sơ', targetTabKey: 'all', targetTabName: 'Tất cả hồ sơ', isSystemDefault: true },
];

// Helper load full SLA config
export function loadRegistrationSlaFullConfig(): RegistrationSlaFullConfig {
  try {
    const raw = localStorage.getItem(REGISTRATION_SLA_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let procedureItems: ProcedureItemConfig[] = parsed.procedureItems || [];

      // Auto Upgrade if procedureItems is empty or missing
      if (!procedureItems || procedureItems.length === 0) {
        procedureItems = DEFAULT_PROCEDURE_ITEMS;
      } else {
        // Ensure missing default procedure codes are populated & names/SLA steps synchronized with standard
        DEFAULT_PROCEDURE_ITEMS.forEach(defaultItem => {
          const existing = procedureItems.find(pi => pi.code === defaultItem.code);
          if (!existing) {
            procedureItems.push(defaultItem);
          } else {
            // Đồng bộ tên chuẩn theo loại hồ sơ nếu chưa trùng
            if (!existing.name) {
              existing.name = defaultItem.name;
            }
          }
        });
      }

      return {
        schedule: parsed.schedule || DEFAULT_WORK_SCHEDULE,
        procedureItems: sortProcedureItems(procedureItems),
        statusTabMappings: parsed.statusTabMappings || DEFAULT_STATUS_TAB_MAPPINGS,
      };
    }
  } catch (e) {
    console.error('Lỗi khi đọc cấu hình SLA:', e);
  }
  return {
    schedule: DEFAULT_WORK_SCHEDULE,
    procedureItems: sortProcedureItems(DEFAULT_PROCEDURE_ITEMS),
    statusTabMappings: DEFAULT_STATUS_TAB_MAPPINGS,
  };
}

export function saveRegistrationSlaFullConfig(config: RegistrationSlaFullConfig): void {
  try {
    localStorage.setItem(REGISTRATION_SLA_CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('registration_sla_config_updated', { detail: config }));
  } catch (e) {
    console.error('Lỗi khi lưu cấu hình SLA:', e);
  }
}

export const RegistrationSlaStatusView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'schedule' | 'procedures' | 'status_mapping'>('procedures');
  const [fullConfig, setFullConfig] = useState<RegistrationSlaFullConfig>(loadRegistrationSlaFullConfig());
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<'all' | 'dangky' | 'dodac' | 'luutru'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProcedureIndex, setSelectedProcedureIndex] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Modal thêm/sửa bước
  const [editingStep, setEditingStep] = useState<{ procCode: string; stepIdx: number | null; step: ProcedureStep } | null>(null);

  // Modal thêm trạng thái
  const [newStatusName, setNewStatusName] = useState<string>('');
  const [newStatusTabKey, setNewStatusTabKey] = useState<string>('all');

  useEffect(() => {
    setFullConfig(loadRegistrationSlaFullConfig());
  }, []);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleSaveAll = () => {
    saveRegistrationSlaFullConfig(fullConfig);
    showToast('success', 'Đã lưu toàn bộ Cấu hình SLA & Trạng thái thành công!');
  };

  const handleResetDefault = async () => {
    const confirmed = await confirmAction('Khôi phục cấu hình mặc định', 'Bạn có chắc chắn muốn khôi phục toàn bộ Cấu hình SLA & Trạng thái về mặc định ban đầu không?');
    if (!confirmed) return;
    
    const defaultConfig: RegistrationSlaFullConfig = {
      schedule: DEFAULT_WORK_SCHEDULE,
      procedureItems: DEFAULT_PROCEDURE_ITEMS,
      statusTabMappings: DEFAULT_STATUS_TAB_MAPPINGS,
    };
    setFullConfig(defaultConfig);
    saveRegistrationSlaFullConfig(defaultConfig);
    setSelectedProcedureIndex(0);
    showToast('success', 'Đã khôi phục Cấu hình SLA & Trạng thái về mặc định ban đầu!');
  };

  // Filter procedure items based on module and search query (sắp xếp tăng dần theo mã thủ tục)
  const filteredProcedures = sortProcedureItems(fullConfig.procedureItems.filter(p => {
    const matchesModule = selectedModuleFilter === 'all' || p.module === selectedModuleFilter;
    const matchesQuery = !searchQuery.trim() || 
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesModule && matchesQuery;
  }));

  const currentProcedure = filteredProcedures[selectedProcedureIndex] || filteredProcedures[0] || fullConfig.procedureItems[0];

  const handleUpdateProcedureField = (procCode: string, field: keyof ProcedureItemConfig, value: any) => {
    setFullConfig(prev => {
      const nextProcs = prev.procedureItems.map(p => {
        if (p.code === procCode) {
          return { ...p, [field]: value };
        }
        return p;
      });
      return { ...prev, procedureItems: nextProcs };
    });
  };

  const handleSaveStep = () => {
    if (!editingStep || !currentProcedure) return;
    const { procCode, stepIdx, step } = editingStep;

    if (!step.name.trim()) {
      showToast('error', 'Vui lòng nhập Tên bước tiến độ');
      return;
    }

    setFullConfig(prev => {
      const nextProcs = prev.procedureItems.map(p => {
        if (p.code === procCode) {
          let updatedSteps = [...p.steps];
          if (stepIdx === null) {
            // Thêm mới
            const newStep: ProcedureStep = {
              ...step,
              id: `step_${Date.now()}`,
              stepNumber: updatedSteps.length + 1,
            };
            updatedSteps.push(newStep);
          } else {
            // Sửa
            updatedSteps[stepIdx] = { ...step };
          }

          // Re-index stepNumbers
          updatedSteps = updatedSteps.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));

          return { ...p, steps: updatedSteps };
        }
        return p;
      });
      return { ...prev, procedureItems: nextProcs };
    });

    setEditingStep(null);
    showToast('success', 'Cập nhật bước tiến độ thành công!');
  };

  const handleDeleteStep = async (procCode: string, stepIdx: number) => {
    const confirmed = await confirmAction('Xóa bước tiến độ', 'Bạn có chắc muốn xóa bước tiến độ này không?');
    if (!confirmed) return;

    setFullConfig(prev => {
      const nextProcs = prev.procedureItems.map(p => {
        if (p.code === procCode) {
          let updatedSteps = p.steps.filter((_, idx) => idx !== stepIdx);
          updatedSteps = updatedSteps.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
          return { ...p, steps: updatedSteps };
        }
        return p;
      });
      return { ...prev, procedureItems: nextProcs };
    });

    showToast('success', 'Đã xóa bước tiến độ!');
  };

  const handleMoveStep = (procCode: string, stepIdx: number, direction: 'up' | 'down') => {
    if (!currentProcedure) return;
    const steps = [...currentProcedure.steps];
    const targetIdx = direction === 'up' ? stepIdx - 1 : stepIdx + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;

    const temp = steps[stepIdx];
    steps[stepIdx] = steps[targetIdx];
    steps[targetIdx] = temp;

    const updatedSteps = steps.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));

    setFullConfig(prev => {
      const nextProcs = prev.procedureItems.map(p => {
        if (p.code === procCode) {
          return { ...p, steps: updatedSteps };
        }
        return p;
      });
      return { ...prev, procedureItems: nextProcs };
    });
  };

  const handleAddStatusMapping = () => {
    if (!newStatusName.trim()) {
      showToast('error', 'Vui lòng nhập tên trạng thái mới');
      return;
    }
    const targetTab = REGISTRATION_UI_TABS.find(t => t.key === newStatusTabKey);
    const newMap: StatusTabMap = {
      id: `map_${Date.now()}`,
      statusName: newStatusName.trim(),
      targetTabKey: newStatusTabKey,
      targetTabName: targetTab ? targetTab.label : 'Tất cả hồ sơ',
      isSystemDefault: false,
    };

    setFullConfig(prev => ({
      ...prev,
      statusTabMappings: [...prev.statusTabMappings, newMap]
    }));

    setNewStatusName('');
    showToast('success', 'Đã thêm trạng thái mới thành công!');
  };

  const handleDeleteStatusMapping = async (id: string) => {
    const confirmed = await confirmAction('Xóa ánh xạ trạng thái', 'Bạn có chắc chắn muốn xóa ánh xạ trạng thái này không?');
    if (!confirmed) return;

    setFullConfig(prev => ({
      ...prev,
      statusTabMappings: prev.statusTabMappings.filter(m => m.id !== id)
    }));
    showToast('success', 'Đã xóa ánh xạ trạng thái!');
  };

  const handleToggleStepNoSla = (procCode: string, stepIdx: number, isNoSla: boolean) => {
    setFullConfig(prev => {
      const nextProcs = prev.procedureItems.map(p => {
        if (p.code === procCode) {
          const updatedSteps = p.steps.map((s, idx) => idx === stepIdx ? { ...s, isNoSla } : s);
          return { ...p, steps: updatedSteps };
        }
        return p;
      });
      return { ...prev, procedureItems: nextProcs };
    });
  };

  // Tính tổng số ngày SLA của thủ tục hiện tại (bỏ qua các bước bị tích Không tính SLA)
  const totalProcedureDays = currentProcedure
    ? currentProcedure.steps.reduce((sum, s) => sum + (s.isNoSla ? 0 : (s.durationDays || 0)), 0)
    : 0;
  const totalProcedureHours = currentProcedure
    ? currentProcedure.steps.reduce((sum, s) => sum + (s.isNoSla ? 0 : (s.durationHours || 0)), 0)
    : 0;

  return (
    <div className="flex flex-col min-h-full bg-slate-50 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
      {/* HEADER BAR */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
            <Clock className="w-5 h-5 text-blue-600" />
            <span>Cấu hình SLA & Trạng thái</span>
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Toàn hệ thống</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Thiết lập ca làm việc, quy trình SLA cho từng thủ tục riêng biệt (Cấp giấy, Đo đạc, Lưu trữ) và danh mục trạng thái.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDefault}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục mặc định</span>
          </button>

          <button
            onClick={handleSaveAll}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>Lưu tất cả thay đổi</span>
          </button>
        </div>
      </div>

      {/* TOAST FEEDBACK */}
      {feedback && (
        <div className={`mx-6 mt-4 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* SUB-TABS */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-6 text-sm font-semibold text-slate-600">
        <button
          onClick={() => setActiveSubTab('procedures')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'procedures' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Quy trình & SLA theo từng Thủ tục</span>
          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-mono">
            {fullConfig.procedureItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('schedule')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Thời gian & Ca làm việc (Khung 8h/ngày)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('status_mapping')}
          className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'status_mapping' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>Danh mục Trạng thái & Tab Mapping</span>
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 p-6">
        {/* --- TAB 1: SCHEDULE CONFIG --- */}
        {activeSubTab === 'schedule' && (
          <div className="max-w-4xl space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800">Cấu hình Khung giờ Làm việc (Chuẩn 8 tiếng/ngày)</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Ca Sáng */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    Ca Sáng (4 tiếng)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Giờ bắt đầu</label>
                      <input
                        type="time"
                        value={fullConfig.schedule.morning.start}
                        onChange={(e) => setFullConfig({
                          ...fullConfig,
                          schedule: { ...fullConfig.schedule, morning: { ...fullConfig.schedule.morning, start: e.target.value } }
                        })}
                        className="w-full text-xs p-2 border border-slate-300 rounded bg-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Giờ kết thúc</label>
                      <input
                        type="time"
                        value={fullConfig.schedule.morning.end}
                        onChange={(e) => setFullConfig({
                          ...fullConfig,
                          schedule: { ...fullConfig.schedule, morning: { ...fullConfig.schedule.morning, end: e.target.value } }
                        })}
                        className="w-full text-xs p-2 border border-slate-300 rounded bg-white font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Ca Chiều */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    Ca Chiều (4 tiếng)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Giờ bắt đầu</label>
                      <input
                        type="time"
                        value={fullConfig.schedule.afternoon.start}
                        onChange={(e) => setFullConfig({
                          ...fullConfig,
                          schedule: { ...fullConfig.schedule, afternoon: { ...fullConfig.schedule.afternoon, start: e.target.value } }
                        })}
                        className="w-full text-xs p-2 border border-slate-300 rounded bg-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Giờ kết thúc</label>
                      <input
                        type="time"
                        value={fullConfig.schedule.afternoon.end}
                        onChange={(e) => setFullConfig({
                          ...fullConfig,
                          schedule: { ...fullConfig.schedule, afternoon: { ...fullConfig.schedule.afternoon, end: e.target.value } }
                        })}
                        className="w-full text-xs p-2 border border-slate-300 rounded bg-white font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Loại trừ Ngày nghỉ */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Thiết lập Trừ Ngày nghỉ / Ngày Lễ khi tính SLA:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={fullConfig.schedule.excludeSaturday}
                      onChange={(e) => setFullConfig({
                        ...fullConfig,
                        schedule: { ...fullConfig.schedule, excludeSaturday: e.target.checked }
                      })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Trừ Thứ 7</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={fullConfig.schedule.excludeSunday}
                      onChange={(e) => setFullConfig({
                        ...fullConfig,
                        schedule: { ...fullConfig.schedule, excludeSunday: e.target.checked }
                      })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Trừ Chủ Nhật</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={fullConfig.schedule.excludeHolidays}
                      onChange={(e) => setFullConfig({
                        ...fullConfig,
                        schedule: { ...fullConfig.schedule, excludeHolidays: e.target.checked }
                      })}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Trừ Ngày Lễ Tết (Hệ thống)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: PROCEDURES CONFIG (DROPDOWN SELECTOR WITH FULL-WIDTH EDITOR) --- */}
        {activeSubTab === 'procedures' && (
          <div className="space-y-5 animate-fade-in">
            {/* COMPACT TOP BAR: PROCEDURE SELECTOR & CODE & DAYS BADGES & SEARCH INPUT ON SAME ROW */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* LEFT: DROPDOWN SELECTOR & INLINE CODE + SLA DAYS BADGES */}
                <div className="flex-1 flex flex-wrap items-center gap-2.5">
                  <label className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1.5 shrink-0">
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Loại thủ tục:</span>
                  </label>

                  <select
                    value={currentProcedure?.code || ''}
                    onChange={(e) => {
                      const selectedCode = e.target.value;
                      const foundIdx = filteredProcedures.findIndex(p => p.code === selectedCode);
                      if (foundIdx >= 0) setSelectedProcedureIndex(foundIdx);
                    }}
                    className="w-full sm:w-[320px] text-xs font-bold p-2 border border-slate-300 rounded-lg bg-slate-50 hover:bg-white focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer transition-colors truncate"
                  >
                    {filteredProcedures.map((item) => (
                      <option key={item.id} value={item.code}>
                        {item.name} {item.isNoSla ? '(Không tính SLA)' : ''}
                      </option>
                    ))}
                  </select>

                  {/* INLINE BADGES FOR CURRENT PROCEDURE CODE & DAYS */}
                  {currentProcedure && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="text-xs font-black bg-blue-600 text-white px-2.5 py-1 rounded shadow-2xs font-mono">
                        Mã {currentProcedure.code}
                      </span>
                      {currentProcedure.isNoSla ? (
                        <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-300">
                          Không tính SLA ({currentProcedure.steps.length} bước)
                        </span>
                      ) : (
                        <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded border border-blue-200">
                          {totalProcedureDays} Ngày ({totalProcedureHours}h) - {currentProcedure.steps.length} bước
                        </span>
                      )}
                      {currentProcedure.hasTax && <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Có thuế</span>}
                      {currentProcedure.hasPosting && <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">Niêm yết</span>}
                      {currentProcedure.hasFieldWork && <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded">Thực địa</span>}
                      {currentProcedure.isNoSla && <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded">Không tính SLA</span>}
                    </div>
                  )}
                </div>

                {/* RIGHT: SEARCH INPUT ON SAME ROW */}
                <div className="relative w-full lg:w-56 shrink-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm theo mã hoặc tên..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSelectedProcedureIndex(0); }}
                    className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* FULL-WIDTH WORKFLOW EDITOR FOR SELECTED PROCEDURE */}
            <div className="w-full">
              {currentProcedure ? (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                  {/* PROCEDURE HEADER INFO */}
                  <div className="border-b border-slate-100 pb-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xl font-black bg-blue-600 text-white px-3.5 py-1.5 rounded-lg shadow-sm">
                          {currentProcedure.code}
                        </span>
                        <div>
                          <h3 className="font-bold text-slate-800 text-base">{currentProcedure.name}</h3>
                          <span className="text-xs text-slate-400">Thiết lập quy trình & SLA theo từng bước tiến độ</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 shrink-0">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">Tổng thời gian SLA</span>
                          <span className="text-sm font-extrabold text-blue-700">
                            {totalProcedureDays} Ngày ({totalProcedureHours} giờ)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Tên thủ tục chuẩn</label>
                        <input
                          type="text"
                          value={currentProcedure.name}
                          onChange={(e) => handleUpdateProcedureField(currentProcedure.code, 'name', e.target.value)}
                          className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white font-bold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 block mb-1">Ghi chú / Mô tả đặc thù</label>
                        <input
                          type="text"
                          value={currentProcedure.description || ''}
                          onChange={(e) => handleUpdateProcedureField(currentProcedure.code, 'description', e.target.value)}
                          className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white font-medium text-slate-700"
                          placeholder="Mô tả đặc thù thủ tục..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* STEP LIST FOR THIS PROCEDURE CODE */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ListChecks className="w-5 h-5 text-blue-600" />
                        <h4 className="font-bold text-slate-800 text-sm">
                          Danh sách Các Bước Tiến Độ Quy Trình ({currentProcedure.steps.length} bước)
                        </h4>
                      </div>

                      <button
                        onClick={() => setEditingStep({
                          procCode: currentProcedure.code,
                          stepIdx: null,
                          step: { id: '', stepNumber: currentProcedure.steps.length + 1, name: '', durationHours: 8, durationDays: 1, description: '', isNoSla: false }
                        })}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Thêm bước tiến độ mới</span>
                      </button>
                    </div>

                    {/* STEP TABLE / LIST */}
                    <div className="space-y-2.5">
                      {currentProcedure.steps.map((step, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === currentProcedure.steps.length - 1;

                        return (
                          <div
                            key={step.id || idx}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all shadow-2xs ${
                              step.isNoSla ? 'bg-amber-50/40 border-amber-200 hover:bg-amber-50' : 'bg-slate-50/80 border-slate-200 hover:border-blue-400 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                                {step.stepNumber}
                              </span>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-800 block">
                                    {step.name}
                                  </span>
                                  {step.isNoSla && (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded border border-amber-200">
                                      Không tính SLA
                                    </span>
                                  )}
                                </div>
                                {step.description && (
                                  <span className="text-[11px] text-slate-500 block mt-0.5">
                                    {step.description}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                              {/* CỘT KHÔNG TÍNH SLA */}
                              <label className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer text-xs font-bold transition-colors shrink-0 shadow-2xs">
                                <input
                                  type="checkbox"
                                  checked={step.isNoSla || false}
                                  onChange={(e) => handleToggleStepNoSla(currentProcedure.code, idx, e.target.checked)}
                                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span className={step.isNoSla ? "text-amber-800 font-black" : "text-slate-600 font-semibold"}>
                                  Không tính SLA
                                </span>
                              </label>

                              <div className="text-right">
                                {step.isNoSla ? (
                                  <span className="text-xs font-extrabold text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded font-mono block border border-amber-200">
                                    0 ngày (Không tính)
                                  </span>
                                ) : (
                                  <span className="text-xs font-extrabold text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded font-mono block border border-blue-200/60">
                                    {step.durationDays} ngày ({step.durationHours}h)
                                  </span>
                                )}
                              </div>

                              {/* ACTIONS */}
                              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
                                <button
                                  disabled={isFirst}
                                  onClick={() => handleMoveStep(currentProcedure.code, idx, 'up')}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                                  title="Di chuyển lên"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  disabled={isLast}
                                  onClick={() => handleMoveStep(currentProcedure.code, idx, 'down')}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                                  title="Di chuyển xuống"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => setEditingStep({ procCode: currentProcedure.code, stepIdx: idx, step: { ...step } })}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50"
                                  title="Sửa bước này"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleDeleteStep(currentProcedure.code, idx)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50"
                                  title="Xóa bước này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                  Không tìm thấy thủ tục phù hợp điều kiện lọc. Vui lòng chọn lại bộ lọc hoặc nhập từ khóa khác.
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 3: STATUS & TAB MAPPING CONFIG --- */}
        {activeSubTab === 'status_mapping' && (
          <div className="max-w-5xl space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Quản lý Danh mục Trạng thái & Ánh xạ Tab UI</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Định nghĩa các Trạng thái xử lý hồ sơ và chọn Tab hiển thị tương ứng trên các giao diện Module.
                </p>
              </div>

              {/* FORM THÊM TRẠNG THÁI MỚI */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Thêm Trạng Thái Mới Vẫn Đúng Quy Chuẩn:</span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      placeholder="Tên trạng thái mới (VD: Chờ Niêm yết công khai)..."
                      value={newStatusName}
                      onChange={(e) => setNewStatusName(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <select
                      value={newStatusTabKey}
                      onChange={(e) => setNewStatusTabKey(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white font-medium"
                    >
                      {REGISTRATION_UI_TABS.map(tab => (
                        <option key={tab.key} value={tab.key}>
                          Tab: {tab.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      onClick={handleAddStatusMapping}
                      className="w-full h-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1 shadow-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* BẢNG DANH SÁCH MAPPING */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Tên Trạng Thái Hồ Sơ</th>
                      <th className="p-3">Tab Hiển Thị Tương Ứng</th>
                      <th className="p-3 text-center">Phân Loại</th>
                      <th className="p-3 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {fullConfig.statusTabMappings.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800">{item.statusName}</td>
                        <td className="p-3">
                          <span className="bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-md border border-blue-200 inline-block">
                            Tab: {item.targetTabName}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {item.isSystemDefault ? (
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Mặc định Hệ thống
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Người dùng thêm
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {!item.isSystemDefault && (
                            <button
                              onClick={() => handleDeleteStatusMapping(item.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50"
                              title="Xóa trạng thái này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL EDIT STEP */}
      {editingStep && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up space-y-4">
            <h3 className="font-bold text-slate-800 text-base">
              {editingStep.stepIdx === null ? 'Thêm bước tiến độ mới' : 'Chỉnh sửa bước tiến độ'} (Thủ tục {editingStep.procCode})
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Tên bước tiến độ</label>
                <input
                  type="text"
                  value={editingStep.step.name}
                  onChange={(e) => setEditingStep({
                    ...editingStep,
                    step: { ...editingStep.step, name: e.target.value }
                  })}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-semibold"
                  placeholder="VD: Kiểm tra kỹ thuật..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Thời gian (Số Ngày)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editingStep.step.durationDays}
                    onChange={(e) => {
                      const days = parseFloat(e.target.value) || 0;
                      setEditingStep({
                        ...editingStep,
                        step: {
                          ...editingStep.step,
                          durationDays: days,
                          durationHours: days * 8
                        }
                      });
                    }}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Thời gian (Số Giờ)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editingStep.step.durationHours}
                    onChange={(e) => {
                      const hours = parseFloat(e.target.value) || 0;
                      setEditingStep({
                        ...editingStep,
                        step: {
                          ...editingStep.step,
                          durationHours: hours,
                          durationDays: Number((hours / 8).toFixed(2))
                        }
                      });
                    }}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Mô tả / Ghi chú bước</label>
                <textarea
                  rows={2}
                  value={editingStep.step.description || ''}
                  onChange={(e) => setEditingStep({
                    ...editingStep,
                    step: { ...editingStep.step, description: e.target.value }
                  })}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  placeholder="Ghi chú chi tiết cho nhân viên..."
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={editingStep.step.isNoSla || false}
                    onChange={(e) => setEditingStep({
                      ...editingStep,
                      step: { ...editingStep.step, isNoSla: e.target.checked }
                    })}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800">Không tính SLA cho bước này</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingStep(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveStep}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistrationSlaStatusView;
