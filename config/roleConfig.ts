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
      'dashboard', 'receive_record', 'receive_search', 'receive_record_search', 'receive_contract', 
      'registration_records', 'personal_profile', 
      'account_settings', 'utilities', 'work_schedule', 
      'receive_group', 'management_group',
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

  const isUserDodac = (u: any, emps: any[]) => {
    if (!u.employeeId || !emps) return false;
    const emp = emps.find(e => e.id === u.employeeId);
    if (!emp || !emp.department) return false;
    return matchDepartmentKey('đo đạc', emp.department) && !matchDepartmentKey('lưu trữ', emp.department);
  };

  const isUserLuutru = (u: any, emps: any[]) => {
    if (!u.employeeId || !emps) return false;
    const emp = emps.find(e => e.id === u.employeeId);
    if (!emp || !emp.department) return false;
    return matchDepartmentKey('lưu trữ', emp.department) && !matchDepartmentKey('đo đạc', emp.department);
  };

  // Admin luôn có toàn quyền truy cập tất cả các view/tab, không bị giới hạn bởi Tổ chuyên môn
  if (user.role === UserRole.ADMIN) return true;

  // Views that are always accessible to any logged in user
  if (['dashboard', 'personal_profile', 'account_settings'].includes(viewId)) {
    return true;
  }

  // Evaluate Department-Role permissions first, then Role-based permissions
  let activePerms: string[] | null = null;

  if (user.employeeId && employees && departmentPermissions) {
    const emp = employees.find(e => e.id === user.employeeId);
    if (emp && emp.department) {
      const userDept = emp.department.trim();
      const userRole = user.role;
      const compositeKey = `${userDept}_${userRole}`;

      if (departmentPermissions[compositeKey] && Array.isArray(departmentPermissions[compositeKey])) {
        activePerms = departmentPermissions[compositeKey];
      } else {
        // Match with matchDepartmentKey on dept part for the EXACT same role
        const matchingCompositeKey = Object.keys(departmentPermissions).find(k => {
          const lastUnderscore = k.lastIndexOf('_');
          if (lastUnderscore === -1) return false;
          const deptPart = k.substring(0, lastUnderscore);
          const rolePart = k.substring(lastUnderscore + 1);
          return rolePart === userRole && (matchDepartmentKey(deptPart, userDept) || matchDepartmentKey(userDept, deptPart));
        });

        if (matchingCompositeKey && Array.isArray(departmentPermissions[matchingCompositeKey])) {
          activePerms = departmentPermissions[matchingCompositeKey];
        } else {
          // Match pure department key without role suffix
          const pureDeptKey = Object.keys(departmentPermissions).find(k => {
            if (k.includes('_ADMIN') || k.includes('_SUBADMIN') || k.includes('_TEAM_LEADER') || k.includes('_EMPLOYEE') || k.includes('_ONEDOOR')) {
              return false;
            }
            return matchDepartmentKey(k, userDept) || matchDepartmentKey(userDept, k);
          });
          if (pureDeptKey && Array.isArray(departmentPermissions[pureDeptKey])) {
            activePerms = departmentPermissions[pureDeptKey];
          }
        }
      }
    }
  }

  if (activePerms === null) {
    if (rolePermissions && rolePermissions[user.role] && Array.isArray(rolePermissions[user.role])) {
      activePerms = rolePermissions[user.role];
    } else if (DEFAULT_ROLE_PERMISSIONS[user.role]) {
      activePerms = DEFAULT_ROLE_PERMISSIONS[user.role];
    }
  }

  // Đảm bảo vai trò ONEDOOR sử dụng quyền mặc định của Một cửa nếu chưa có cấu hình riêng
  if (user.role === UserRole.ONEDOOR && activePerms === null) {
    activePerms = DEFAULT_ROLE_PERMISSIONS[UserRole.ONEDOOR] || [];
  }

  if (activePerms !== null) {
    if (activePerms.includes('*')) return true;

    // Bộ quyền con thuộc từng phân hệ chính
    const ONEDOOR_CHILD_PERMS = ['receive_record', 'receive_sub_create', 'receive_sub_bulk', 'receive_sub_list', 'receive_sub_vphc', 'ADD_RECORDS', 'EXPORT_RECORDS'];
    const DODAC_CHILD_PERMS = [
      'all_records', 'all_sub_all', 'assign_tasks', 'completed_list', 'measurement_field', 'measurement_office', 'pending_supplement_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed',
      'dodac_ADD_RECORDS', 'dodac_BTN_ASSIGN_STAFF', 'dodac_BTN_SUBMIT_CHECK', 'dodac_BTN_SUBMIT_SIGN', 'dodac_BTN_APPROVE_SIGN', 
      'dodac_BTN_REJECT_RECORD', 'dodac_HANDOVER_RECORDS', 'dodac_BTN_RETURN_RESULT', 'dodac_VIEW_EXCERPTS', 
      'dodac_MANAGE_EXCERPTS', 'dodac_BTN_EXTEND_DEADLINE', 'dodac_EDIT_RECORDS', 'dodac_DELETE_RECORDS', 'dodac_VIEW_DETAILS', 'dodac_BTN_ADVANCE_STATUS'
    ];
    const LUUTRU_CHILD_PERMS = [
      'archive_records', 'archive_sub_all', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'archive_director_completed',
      'luutru_ADD_RECORDS', 'luutru_BTN_ASSIGN_STAFF', 'luutru_BTN_SUBMIT_CHECK', 'luutru_BTN_SUBMIT_SIGN', 'luutru_BTN_APPROVE_SIGN', 
      'luutru_BTN_REJECT_RECORD', 'luutru_HANDOVER_RECORDS', 'luutru_BTN_RETURN_RESULT', 'luutru_VIEW_ARCHIVE', 
      'luutru_MANAGE_ARCHIVE', 'luutru_BTN_EXTEND_DEADLINE', 'luutru_EDIT_RECORDS', 'luutru_DELETE_RECORDS', 'luutru_VIEW_DETAILS', 'luutru_BTN_ADVANCE_STATUS'
    ];
    const CONTRACT_CHILD_PERMS = [
      'receive_contract', 'VIEW_CONTRACTS', 'ADD_CONTRACTS', 'EDIT_CONTRACTS', 'LIQUIDATE_CONTRACTS', 'DELETE_CONTRACTS', 'EXPORT_CONTRACTS'
    ];

    const hasAnyPerm = (list: string[]) => list.some(p => activePerms!.includes(p));

    // Check viewId-specific permission
    switch (viewId) {
      // Main Tab Groups in Top Navigation
      case 'receive_group':
        return activePerms.includes('receive_record') || activePerms.includes('receive_contract') || activePerms.includes('ADD_RECORDS') || activePerms.includes('VIEW_CONTRACTS') || hasAnyPerm(ONEDOOR_CHILD_PERMS) || hasAnyPerm(CONTRACT_CHILD_PERMS);
      case 'records_group':
        return activePerms.includes('all_records') || activePerms.includes('archive_records') || activePerms.includes('registration_records');
      case 'tools_group':
        return activePerms.includes('reports') || activePerms.includes('VIEW_REPORTS') || activePerms.includes('excerpt_management') || activePerms.includes('MANAGE_EXCERPTS') || activePerms.includes('VIEW_EXCERPTS') || activePerms.includes('dodac_VIEW_EXCERPTS') || activePerms.includes('dodac_MANAGE_EXCERPTS') || activePerms.includes('utilities') || activePerms.includes('SYSTEM_SETTINGS') || activePerms.includes('VIEW_CHAT');
      case 'management_group':
        return activePerms.includes('work_schedule') || activePerms.includes('VIEW_SCHEDULE') || activePerms.includes('MANAGE_SCHEDULE') || activePerms.includes('personal_profile') || activePerms.includes('VIEW_PERSONAL_PROFILE');

      // Main Tabs - Hiển thị tab dựa chính xác theo cấu hình phân quyền đã cấp
      case 'receive_record':
      case 'receive_search':
      case 'receive_record_search':
        return activePerms.includes('receive_record') || activePerms.includes('receive_sub_create') || activePerms.includes('receive_sub_list') || activePerms.includes('ADD_RECORDS');
      case 'all_records':
        return activePerms.includes('all_records');
      case 'archive_records':
        return activePerms.includes('archive_records');
      case 'receive_contract':
        return activePerms.includes('receive_contract') || activePerms.includes('VIEW_CONTRACTS') || activePerms.includes('ADD_CONTRACTS');

      case 'registration_records':
        return activePerms.includes('registration_records');

      // Child Tabs - Receive Group
      case 'receive_sub_create':
      case 'receive_sub_bulk':
        return activePerms.includes('receive_record') || activePerms.includes('receive_sub_create') || activePerms.includes('ADD_RECORDS');
      case 'receive_sub_list':
        return activePerms.includes('receive_record') || activePerms.includes('receive_sub_list');
      case 'receive_sub_vphc':
        return activePerms.includes('receive_record') || activePerms.includes('receive_sub_vphc');

      // Child Tabs - All Records Group (Đo đạc)
      case 'all_sub_all':
        return activePerms.includes('all_records') || activePerms.includes('all_sub_all') || activePerms.includes('dodac_VIEW_DETAILS');
      case 'assign_tasks':
        return activePerms.includes('all_records') || activePerms.includes('assign_tasks') || activePerms.includes('dodac_BTN_ASSIGN_STAFF');
      case 'completed_list':
      case 'measurement_field':
      case 'measurement_office':
      case 'pending_supplement_list':
        return activePerms.includes('all_records') || activePerms.includes('completed_list') || activePerms.includes('dodac_VIEW_DETAILS');
      case 'pending_check_list':
        return activePerms.includes('all_records') || activePerms.includes('pending_check_list') || activePerms.includes('dodac_BTN_SUBMIT_CHECK');
      case 'check_list':
        return activePerms.includes('all_records') || activePerms.includes('check_list') || activePerms.includes('dodac_BTN_SUBMIT_SIGN');
      case 'director_completed':
        return activePerms.includes('all_records') || activePerms.includes('director_completed') || activePerms.includes('dodac_BTN_APPROVE_SIGN');
      case 'handover_list':
        return activePerms.includes('all_records') || activePerms.includes('handover_list') || activePerms.includes('dodac_HANDOVER_RECORDS');

      // Child Tabs - Archive Group (Lưu trữ)
      case 'archive_sub_all':
        return activePerms.includes('archive_records') || activePerms.includes('archive_sub_all') || activePerms.includes('luutru_VIEW_DETAILS');
      case 'archive_assign_tasks':
        return activePerms.includes('archive_records') || activePerms.includes('archive_assign_tasks') || activePerms.includes('luutru_BTN_ASSIGN_STAFF');
      case 'archive_completed_list':
        return activePerms.includes('archive_records') || activePerms.includes('archive_completed_list') || activePerms.includes('luutru_VIEW_DETAILS');
      case 'archive_pending_check_list':
        return activePerms.includes('archive_records') || activePerms.includes('archive_pending_check_list') || activePerms.includes('luutru_BTN_SUBMIT_CHECK');
      case 'archive_check_list':
        return activePerms.includes('archive_records') || activePerms.includes('archive_check_list') || activePerms.includes('luutru_BTN_SUBMIT_SIGN');
      case 'archive_handover_list':
        return activePerms.includes('archive_records') || activePerms.includes('archive_handover_list') || activePerms.includes('luutru_HANDOVER_RECORDS');
      case 'archive_director_completed':
        return activePerms.includes('archive_records') || activePerms.includes('archive_director_completed') || activePerms.includes('luutru_BTN_APPROVE_SIGN');

      // Other Standalone Views
      case 'excerpt_management':
        return activePerms.includes('excerpt_management') || activePerms.includes('MANAGE_EXCERPTS') || activePerms.includes('VIEW_EXCERPTS') || activePerms.includes('dodac_VIEW_EXCERPTS') || activePerms.includes('dodac_MANAGE_EXCERPTS');
      case 'reports':
        return activePerms.includes('reports') || activePerms.includes('VIEW_REPORTS');
      case 'work_schedule':
        return activePerms.includes('work_schedule') || activePerms.includes('VIEW_SCHEDULE') || activePerms.includes('MANAGE_SCHEDULE');
      case 'system_dashboard':
        return activePerms.includes('system_dashboard') || activePerms.includes('SYSTEM_SETTINGS') || activePerms.includes('MANAGE_USERS') || activePerms.includes('MANAGE_EMPLOYEES');
      case 'utilities':
        return activePerms.includes('utilities') || activePerms.includes('SYSTEM_SETTINGS') || activePerms.includes('VIEW_CHAT');

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
