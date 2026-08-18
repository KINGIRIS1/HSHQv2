import { UserRole, DEFAULT_ROLE_PERMISSIONS } from '../types';
import { matchDepartmentKey } from '../utils/appHelpers';

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
      'dashboard', 'receive_record', 'receive_contract', 'receive_group',
      'personal_profile', 'account_settings', 'utilities', 'work_schedule', 
      'tools_group', 'barcode_generator'
    ]
  },
  [UserRole.EMPLOYEE]: {
    role: UserRole.EMPLOYEE,
    allowedViews: [
      'dashboard', 'personal_profile', 'work_schedule', 'utilities', 'tools_group',
      'reports', 'account_settings', 'lookup_records'
    ]
  },
  [UserRole.TEAM_LEADER]: {
    role: UserRole.TEAM_LEADER,
    // Thừa hưởng toàn bộ quyền cơ bản của Employee
    allowedViews: [
      'dashboard', 'personal_profile', 'work_schedule', 'utilities', 'tools_group',
      'reports', 'account_settings', 'lookup_records'
    ],
    // Mở rộng quyền Chuyên môn dựa trên Tổ chuyên môn đang quản lý
    departmentSpecificViews: [
      {
        keyword: 'đo đạc',
        views: ['all_records', 'assign_tasks', 'completed_list', 'pending_supplement_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed']
      },
      {
        keyword: 'đăng ký',
        views: ['registration_records']
      },
      {
        keyword: 'lưu trữ',
        views: ['archive_records', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'excerpt_management']
      },
      {
        keyword: 'thông tin',
        views: ['archive_records', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'excerpt_management']
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

  // Admin and Subadmin always allowed full access without department restrictions
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUBADMIN) return true;

  // Views that are always accessible to any logged in user
  if (['dashboard', 'personal_profile', 'account_settings', 'utilities', 'tools_group'].includes(viewId)) {
    return true;
  }

  // Evaluate Department-Role permissions first, then Role-based permissions
  let activePerms: string[] | null = null;

  let isCustomDeptPerm = false;

  if (user.employeeId && employees && departmentPermissions) {
    const emp = employees.find(e => e.id === user.employeeId);
    if (emp && emp.department) {
      const compositeKey = `${emp.department}_${user.role}`;
      if (departmentPermissions[compositeKey]) {
        activePerms = departmentPermissions[compositeKey];
        isCustomDeptPerm = true;
      } else if (departmentPermissions[emp.department]) {
        activePerms = departmentPermissions[emp.department];
        isCustomDeptPerm = true;
      } else {
        const matchingKey = Object.keys(departmentPermissions).find(k => {
          if (k.endsWith(`_${user.role}`)) {
            const deptPart = k.replace(`_${user.role}`, '');
            return matchDepartmentKey(deptPart, emp.department);
          }
          return matchDepartmentKey(k, emp.department);
        });
        if (matchingKey && departmentPermissions[matchingKey]) {
          activePerms = departmentPermissions[matchingKey];
          isCustomDeptPerm = true;
        }
      }
    }
  }

  if (activePerms === null) {
    if (rolePermissions && rolePermissions[user.role]) {
      activePerms = rolePermissions[user.role];
    } else if (DEFAULT_ROLE_PERMISSIONS[user.role]) {
      activePerms = DEFAULT_ROLE_PERMISSIONS[user.role];
    }
  }

  // Luôn áp dụng quy tắc phân tách thuộc tính tổ chuyên môn (Department isolation):
  // - Tài khoản thuộc Tổ Đo đạc (không thuộc Lưu trữ) sẽ không thể thấy Tab Lưu trữ
  // - Tài khoản thuộc Tổ Lưu trữ (không thuộc Đo đạc) sẽ không thể thấy Tab Đo đạc
  if (user.employeeId && employees && activePerms) {
    const emp = employees.find(e => e.id === user.employeeId);
    if (emp && emp.department) {
      const isDodac = matchDepartmentKey('đo đạc', emp.department);
      const isLuutru = matchDepartmentKey('lưu trữ', emp.department);

      if (isDodac && !isLuutru) {
        activePerms = activePerms.filter(p => !p.startsWith('luutru_'));
      } else if (isLuutru && !isDodac) {
        activePerms = activePerms.filter(p => !p.startsWith('dodac_'));
      }
    }
  }

  if (activePerms !== null) {
    if (activePerms.includes('*')) return true;

    // Check viewId-specific permission
    switch (viewId) {
      // Main Tab Groups in Top Navigation
      case 'receive_group':
        return activePerms.includes('ADD_RECORDS') ||
               activePerms.includes('EXPORT_RECORDS') ||
               activePerms.includes('ADD_CONTRACTS') ||
               activePerms.includes('EDIT_CONTRACTS') ||
               activePerms.includes('LIQUIDATE_CONTRACTS') ||
               activePerms.includes('DELETE_CONTRACTS') ||
               activePerms.includes('EXPORT_CONTRACTS');
      case 'records_group':
        return activePerms.some(p => p.startsWith('dodac_')) ||
               activePerms.some(p => p.startsWith('luutru_'));
      case 'tools_group':
        return activePerms.includes('VIEW_REPORTS') || activePerms.includes('dodac_MANAGE_EXCERPTS') || activePerms.includes('dodac_VIEW_EXCERPTS') || activePerms.includes('VIEW_SCHEDULE');
      case 'management_group':
        return activePerms.includes('VIEW_SCHEDULE') || activePerms.includes('MANAGE_SCHEDULE') || activePerms.includes('VIEW_PERSONAL_PROFILE');

      // Main Tabs
      case 'receive_record':
        return activePerms.includes('ADD_RECORDS') ||
               activePerms.includes('EXPORT_RECORDS');
      case 'all_records':
        return activePerms.some(p => p.startsWith('dodac_'));
      case 'archive_records':
        return activePerms.some(p => p.startsWith('luutru_'));
      case 'registration_records':
        return activePerms.some(p => p.startsWith('dodac_'));
      case 'other_records':
        return activePerms.some(p => p.startsWith('dodac_'));

      // Child Tabs - Receive Group
      case 'receive_sub_create':
      case 'receive_sub_bulk':
      case 'receive_sub_list':
      case 'receive_sub_vphc':
        return activePerms.includes('ADD_RECORDS') || activePerms.includes('EXPORT_RECORDS');

      // Child Tabs - All Records Group
      case 'all_sub_all':
      case 'assign_tasks':
      case 'pending_check_list':
      case 'check_list':
      case 'handover_list':
      case 'director_completed':
        return activePerms.some(p => p.startsWith('dodac_'));

      // Child Tabs - Archive Group
      case 'archive_sub_all':
      case 'archive_assign_tasks':
      case 'archive_completed_list':
      case 'archive_pending_check_list':
      case 'archive_check_list':
      case 'archive_handover_list':
      case 'archive_director_completed':
        return activePerms.some(p => p.startsWith('luutru_'));

      // Child Tabs - Other Records Group
      case 'other_sub_all':
      case 'other_assign_tasks':
      case 'other_check_list':
      case 'other_handover_list':
      case 'other_director_completed':
        return activePerms.some(p => p.startsWith('dodac_'));

      // Other Standalone Views
      case 'receive_contract':
        return activePerms.includes('ADD_CONTRACTS') ||
               activePerms.includes('EDIT_CONTRACTS') ||
               activePerms.includes('LIQUIDATE_CONTRACTS') ||
               activePerms.includes('DELETE_CONTRACTS') ||
               activePerms.includes('EXPORT_CONTRACTS');
      case 'excerpt_management':
        return activePerms.includes('dodac_MANAGE_EXCERPTS') || activePerms.includes('dodac_VIEW_EXCERPTS');
      case 'reports':
        return activePerms.includes('VIEW_REPORTS');
      case 'work_schedule':
        return activePerms.includes('VIEW_SCHEDULE') || activePerms.includes('MANAGE_SCHEDULE');
      case 'system_dashboard':
        return activePerms.includes('SYSTEM_SETTINGS') || activePerms.includes('MANAGE_USERS') || activePerms.includes('MANAGE_EMPLOYEES');
      case 'utilities':
        return true;

      default:
        return activePerms.includes(viewId) || activePerms.includes(`dodac_${viewId}`) || activePerms.includes(`luutru_${viewId}`);
    }
  }

  // If dynamic permissions object was provided but no activePerms found -> deny
  if (rolePermissions || departmentPermissions) {
    return false;
  }

  // Fallback to static config if dynamic perms not present at all
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
