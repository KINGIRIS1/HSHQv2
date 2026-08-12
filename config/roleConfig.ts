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
      'dashboard', 'receive_record', 'receive_contract', 
      'all_records', 'registration_records', 'other_records', 'personal_profile', 
      'account_settings', 'utilities', 'handover_list', 'archive_handover_list', 'other_handover_list', 'work_schedule', 
      'archive_records', 'receive_group', 'records_group', 'management_group',
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

  // Admin always allowed
  if (user.role === UserRole.ADMIN) return true;

  // Views that are always accessible to any logged in user
  if (['dashboard', 'personal_profile', 'account_settings'].includes(viewId)) {
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

    // Nếu không có phân quyền tùy chỉnh riêng cho phòng ban, áp dụng quy tắc phân tách mặc định:
    // - Tổ đo đạc không tự động có quyền Tab Lưu trữ
    // - Tổ Lưu trữ không tự động có quyền Tab Đo đạc
    if (!isCustomDeptPerm && user.employeeId && employees && activePerms) {
      const emp = employees.find(e => e.id === user.employeeId);
      if (emp && emp.department) {
        if (matchDepartmentKey('đo đạc', emp.department)) {
          const ARCHIVE_PERMS = [
            'archive_records', 'archive_sub_all', 'archive_assign_tasks',
            'archive_completed_list', 'archive_pending_check_list', 'archive_check_list',
            'archive_handover_list', 'archive_director_completed', 'VIEW_ARCHIVE', 'MANAGE_ARCHIVE'
          ];
          activePerms = activePerms.filter(p => !ARCHIVE_PERMS.includes(p));
        } else if (matchDepartmentKey('lưu trữ', emp.department)) {
          const SURVEY_PERMS = [
            'all_records', 'all_sub_all', 'assign_tasks', 'completed_list',
            'pending_check_list', 'check_list', 'handover_list', 'director_completed', 'survey_list'
          ];
          activePerms = activePerms.filter(p => !SURVEY_PERMS.includes(p));
        }
      }
    }
  }

  // Luôn đảm bảo vai trò ONEDOOR kế thừa toàn bộ danh sách quyền mặc định của Một cửa
  if (user.role === UserRole.ONEDOOR) {
    const defaultOneDoor = DEFAULT_ROLE_PERMISSIONS[UserRole.ONEDOOR] || [];
    if (activePerms) {
      activePerms = Array.from(new Set([...activePerms, ...defaultOneDoor]));
    } else {
      activePerms = defaultOneDoor;
    }
  }

  if (activePerms !== null) {
    if (activePerms.includes('*')) return true;

    // Check viewId-specific permission
    switch (viewId) {
      // Main Tab Groups in Top Navigation
      case 'receive_group':
        return activePerms.includes('receive_record') ||
               activePerms.includes('receive_sub_create') ||
               activePerms.includes('receive_sub_bulk') ||
               activePerms.includes('receive_sub_list') ||
               activePerms.includes('receive_sub_vphc') ||
               activePerms.includes('receive_contract') ||
               activePerms.includes('VIEW_CONTRACTS') ||
               activePerms.includes('ADD_CONTRACTS') ||
               activePerms.includes('LIQUIDATE_CONTRACTS');
      case 'records_group':
        return activePerms.includes('all_records') || activePerms.includes('all_sub_all') || activePerms.includes('assign_tasks') || activePerms.includes('check_list') || activePerms.includes('handover_list') || activePerms.includes('completed_list') || activePerms.includes('pending_check_list') || activePerms.includes('director_completed') ||
               activePerms.includes('archive_records') || activePerms.includes('registration_records') || activePerms.includes('other_records');
      case 'tools_group':
        return activePerms.includes('reports') || activePerms.includes('VIEW_REPORTS') || activePerms.includes('excerpt_management') || activePerms.includes('MANAGE_EXCERPTS') || activePerms.includes('utilities') || activePerms.includes('work_schedule');
      case 'management_group':
        return activePerms.includes('work_schedule') || activePerms.includes('VIEW_SCHEDULE') || activePerms.includes('personal_profile');

      // Main Tabs
      case 'receive_record':
        return activePerms.includes('receive_record') ||
               activePerms.includes('receive_sub_create') ||
               activePerms.includes('receive_sub_bulk') ||
               activePerms.includes('receive_sub_list') ||
               activePerms.includes('receive_sub_vphc');
      case 'all_records':
        return activePerms.includes('all_records') ||
               activePerms.includes('all_sub_all') ||
               activePerms.includes('assign_tasks') ||
               activePerms.includes('completed_list') ||
               activePerms.includes('pending_check_list') ||
               activePerms.includes('check_list') ||
               activePerms.includes('handover_list') ||
               activePerms.includes('director_completed');
      case 'archive_records':
        return activePerms.includes('archive_records') ||
               activePerms.includes('archive_sub_all') ||
               activePerms.includes('archive_assign_tasks') ||
               activePerms.includes('archive_completed_list') ||
               activePerms.includes('archive_pending_check_list') ||
               activePerms.includes('archive_check_list') ||
               activePerms.includes('archive_handover_list') ||
               activePerms.includes('archive_director_completed');
      case 'registration_records':
        return activePerms.includes('registration_records');
      case 'other_records':
        return activePerms.includes('other_records') ||
               activePerms.includes('other_sub_all') ||
               activePerms.includes('other_assign_tasks') ||
               activePerms.includes('other_check_list') ||
               activePerms.includes('other_handover_list') ||
               activePerms.includes('other_director_completed');

      // Child Tabs - Receive Group
      case 'receive_sub_create':
      case 'receive_sub_bulk':
      case 'receive_sub_list':
      case 'receive_sub_vphc':
        return activePerms.includes(viewId) || activePerms.includes('receive_record');

      // Child Tabs - All Records Group
      case 'all_sub_all':
      case 'assign_tasks':
      case 'completed_list':
      case 'pending_check_list':
      case 'check_list':
      case 'handover_list':
      case 'director_completed':
        return activePerms.includes(viewId) || activePerms.includes('all_records');

      // Child Tabs - Archive Group
      case 'archive_sub_all':
      case 'archive_assign_tasks':
      case 'archive_completed_list':
      case 'archive_pending_check_list':
      case 'archive_check_list':
      case 'archive_handover_list':
      case 'archive_director_completed':
        return activePerms.includes(viewId) || activePerms.includes('archive_records');

      // Child Tabs - Other Records Group
      case 'other_sub_all':
      case 'other_assign_tasks':
      case 'other_check_list':
      case 'other_handover_list':
      case 'other_director_completed':
        return activePerms.includes(viewId) || activePerms.includes('other_records');

      // Other Standalone Views
      case 'receive_contract':
        return activePerms.includes('receive_contract') || activePerms.includes('VIEW_CONTRACTS') || activePerms.includes('ADD_CONTRACTS') || activePerms.includes('LIQUIDATE_CONTRACTS');
      case 'excerpt_management':
        return activePerms.includes('excerpt_management') || activePerms.includes('MANAGE_EXCERPTS') || activePerms.includes('VIEW_EXCERPTS');
      case 'reports':
        return activePerms.includes('reports') || activePerms.includes('VIEW_REPORTS');
      case 'work_schedule':
        return activePerms.includes('work_schedule') || activePerms.includes('VIEW_SCHEDULE');
      case 'system_dashboard':
        return activePerms.includes('system_dashboard') || activePerms.includes('SYSTEM_SETTINGS');
      case 'utilities':
        return activePerms.includes('utilities') || activePerms.includes('SYSTEM_SETTINGS');

      default:
        return activePerms.includes(viewId);
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
