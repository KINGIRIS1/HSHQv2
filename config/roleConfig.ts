import { UserRole } from '../types';

export interface RoleConfig {
  role: UserRole;
  allowedViews: string[]; // Các view luôn được phép truy cập đối với role này
  departmentSpecificViews?: {
    keyword: string; // Từ khóa tìm kiếm trong tên Phòng ban / Tổ chuyên môn (viết thường, không dấu)
    views: string[]; // Các view được mở rộng thêm
  }[];
}

export const ROLE_VIEWS_CONFIG: Record<UserRole, RoleConfig> = {
  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    allowedViews: ['*'] // Cho phép toàn bộ
  },
  [UserRole.SUBADMIN]: {
    role: UserRole.SUBADMIN,
    allowedViews: ['*'] // Cho phép toàn bộ
  },
  [UserRole.ONEDOOR]: {
    role: UserRole.ONEDOOR,
    allowedViews: [
      'dashboard', 'internal_chat', 'receive_record', 'receive_contract', 
      'all_records', 'registration_records', 'other_records', 'personal_profile', 
      'account_settings', 'utilities', 'handover_list', 'work_schedule', 
      'archive_records', 'congvan_records', 'receive_group', 'records_group', 
      'reports', 'tools_group', 'barcode_generator'
    ]
  },
  [UserRole.EMPLOYEE]: {
    role: UserRole.EMPLOYEE,
    allowedViews: [
      'dashboard', 'personal_profile', 'work_schedule', 'utilities', 
      'reports', 'account_settings', 'internal_chat'
    ]
  },
  [UserRole.TEAM_LEADER]: {
    role: UserRole.TEAM_LEADER,
    // Thừa hưởng toàn bộ quyền cơ bản của Employee
    allowedViews: [
      'dashboard', 'personal_profile', 'work_schedule', 'utilities', 
      'reports', 'account_settings', 'internal_chat'
    ],
    // Mở rộng quyền Chuyên môn dựa trên Tổ chuyên môn đang quản lý
    departmentSpecificViews: [
      {
        keyword: 'đo đạc',
        views: ['all_records']
      },
      {
        keyword: 'đăng ký',
        views: ['registration_records']
      },
      {
        keyword: 'lưu trữ',
        views: ['archive_records', 'congvan_records', 'excerpt_management']
      },
      {
        keyword: 'thông tin',
        views: ['archive_records', 'congvan_records', 'excerpt_management']
      }
    ]
  }
};

/**
 * Loại bỏ dấu tiếng Việt để so khớp chính xác
 */
function removeDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Kiểm tra xem một viewId có được phép truy cập bởi người dùng hiện tại hay không
 */
export function isViewAllowedForUser(
  user: { role: UserRole; employeeId?: string },
  employees: { id: string; department: string }[],
  viewId: string
): boolean {
  const config = ROLE_VIEWS_CONFIG[user.role];
  if (!config) return false;

  // Admin / Subadmin được phép truy cập tất cả
  if (config.allowedViews.includes('*')) {
    return true;
  }

  // Kiểm tra danh sách được phép mặc định của Role
  if (config.allowedViews.includes(viewId)) {
    return true;
  }

  // Kiểm tra quyền theo Tổ chuyên môn (Cho Team Leader)
  if (config.departmentSpecificViews && user.employeeId && employees) {
    const employee = employees.find(e => e.id === user.employeeId);
    if (employee && employee.department) {
      const deptNormalized = removeDiacritics(employee.department.toLowerCase());
      
      for (const deptView of config.departmentSpecificViews) {
        const keywordNormalized = removeDiacritics(deptView.keyword.toLowerCase());
        if (deptNormalized.includes(keywordNormalized)) {
          if (deptView.views.includes(viewId)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}
