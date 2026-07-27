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
      'dashboard', 'receive_record', 'receive_contract', 
      'all_records', 'registration_records', 'other_records', 'personal_profile', 
      'account_settings', 'utilities', 'handover_list', 'archive_handover_list', 'other_handover_list', 'work_schedule', 
      'archive_records', 'congvan_records', 'receive_group', 'records_group', 
      'reports', 'tools_group', 'barcode_generator'
    ]
  },
  [UserRole.EMPLOYEE]: {
    role: UserRole.EMPLOYEE,
    allowedViews: [
      'dashboard', 'personal_profile', 'work_schedule', 'utilities', 
      'reports', 'account_settings'
    ]
  },
  [UserRole.TEAM_LEADER]: {
    role: UserRole.TEAM_LEADER,
    // Thừa hưởng toàn bộ quyền cơ bản của Employee
    allowedViews: [
      'dashboard', 'personal_profile', 'work_schedule', 'utilities', 
      'reports', 'account_settings'
    ],
    // Mở rộng quyền Chuyên môn dựa trên Tổ chuyên môn đang quản lý
    departmentSpecificViews: [
      {
        keyword: 'đo đạc',
        views: ['all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed']
      },
      {
        keyword: 'đăng ký',
        views: ['registration_records']
      },
      {
        keyword: 'lưu trữ',
        views: ['archive_records', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'congvan_records', 'excerpt_management']
      },
      {
        keyword: 'thông tin',
        views: ['archive_records', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'congvan_records', 'excerpt_management']
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
  viewId: string,
  rolePermissions?: Record<string, string[]>,
  departmentPermissions?: Record<string, string[]>
): boolean {
  if (!user) return false;

  // Admin always allowed
  if (user.role === UserRole.ADMIN) return true;

  // Views that are always accessible to any logged in user
  if (['dashboard', 'personal_profile', 'account_settings'].includes(viewId)) {
    return true;
  }

  // If dynamic permissions are passed in, evaluate them!
  if (rolePermissions || departmentPermissions) {
    const rolePerms = (rolePermissions && rolePermissions[user.role]) || [];
    if (rolePerms.includes('*')) return true;

    // Mapping viewId to required permission IDs
    const permMap: Record<string, string[]> = {
      'receive_record': ['ADD_RECORDS'],
      'receive_contract': ['ADD_CONTRACTS', 'VIEW_CONTRACTS'],
      'all_records': ['VIEW_RECORDS', 'all_records'],
      'assign_tasks': ['ASSIGN_RECORDS', 'assign_tasks'],
      'completed_list': ['VIEW_RECORDS', 'completed_list'],
      'pending_check_list': ['CHECK_RECORDS', 'check_list'],
      'check_list': ['CHECK_RECORDS', 'check_list'],
      'handover_list': ['HANDOVER_RECORDS', 'RETURN_RECORDS', 'handover_list'],
      'director_completed': ['SIGN_RECORDS', 'director_completed'],
      'archive_records': ['VIEW_ARCHIVE', 'archive_records'],
      'congvan_records': ['VIEW_ARCHIVE', 'congvan_records'],
      'excerpt_management': ['VIEW_EXCERPTS', 'MANAGE_EXCERPTS'],
      'reports': ['VIEW_REPORTS'],
      'work_schedule': ['VIEW_SCHEDULE'],
      'system_dashboard': ['SYSTEM_SETTINGS'],
      'utilities': ['VIEW_RECORDS', 'MANAGE_ARCHIVE', 'SYSTEM_SETTINGS', 'utilities'],
      'receive_group': ['ADD_RECORDS', 'ADD_CONTRACTS', 'VIEW_CONTRACTS'],
      'records_group': ['VIEW_RECORDS', 'VIEW_ARCHIVE', 'all_records', 'archive_records'],
      'tools_group': ['VIEW_REPORTS', 'VIEW_EXCERPTS', 'utilities']
    };

    const neededPerms = permMap[viewId];

    // Check department permissions first if user has employeeId & department
    if (user.employeeId && employees && departmentPermissions) {
      const emp = employees.find(e => e.id === user.employeeId);
      if (emp && emp.department) {
        // 1. Check composite key `${emp.department}_${user.role}`
        const compositeKey = `${emp.department}_${user.role}`;
        if (departmentPermissions[compositeKey]) {
          const deptRolePerms = departmentPermissions[compositeKey];
          if (deptRolePerms.includes('*')) return true;
          if (neededPerms && neededPerms.some(p => deptRolePerms.includes(p))) return true;
          // If composite key explicitly exists for user's department & role and permission is missing:
          if (neededPerms && !neededPerms.some(p => deptRolePerms.includes(p))) return false;
        }

        // 2. Check department key
        const deptKey = Object.keys(departmentPermissions).find(k => k.trim().toLowerCase() === emp.department.trim().toLowerCase());
        if (deptKey && departmentPermissions[deptKey]) {
          const deptPerms = departmentPermissions[deptKey];
          if (deptPerms.includes('*')) return true;
          if (neededPerms && neededPerms.some(p => deptPerms.includes(p))) return true;
          if (neededPerms && !neededPerms.some(p => deptPerms.includes(p))) return false;
        }
      }
    }

    // Check role permissions
    if (neededPerms) {
      const hasRolePerm = neededPerms.some(p => rolePerms.includes(p));
      if (hasRolePerm) return true;
      if (rolePermissions && rolePermissions[user.role]) return false;
    }
  }

  // Fallback to static config if dynamic perms not present
  const config = ROLE_VIEWS_CONFIG[user.role];
  if (!config) return false;

  // Admin / Subadmin allowed all
  if (config.allowedViews.includes('*')) {
    return true;
  }

  const targetViewId = viewId === 'pending_check_list' ? 'check_list' : (viewId === 'archive_pending_check_list' ? 'archive_check_list' : viewId);

  if (config.allowedViews.includes(viewId) || config.allowedViews.includes(targetViewId)) {
    return true;
  }

  if (config.departmentSpecificViews && user.employeeId && employees) {
    const employee = employees.find(e => e.id === user.employeeId);
    if (employee && employee.department) {
      const deptNormalized = removeDiacritics(employee.department.toLowerCase());
      
      for (const deptView of config.departmentSpecificViews) {
        const keywordNormalized = removeDiacritics(deptView.keyword.toLowerCase());
        if (deptNormalized.includes(keywordNormalized)) {
          if (deptView.views.includes(viewId) || deptView.views.includes(targetViewId)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}
