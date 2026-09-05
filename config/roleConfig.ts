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
      'all_records', 'registration_records', 'personal_profile', 
      'account_settings', 'utilities', 'handover_list', 'archive_handover_list', 'work_schedule', 
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

  // Admin và Subadmin luôn có toàn quyền truy cập tất cả các view/tab, không bị giới hạn bởi Tổ chuyên môn
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUBADMIN) return true;

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
  }

  // Luôn áp dụng quy tắc phân tách thuộc tính tổ chuyên môn (Department isolation) cho nhân viên/tổ trưởng:
  // - Tài khoản thuộc Tổ Đo đạc (không thuộc Lưu trữ) sẽ không thể thấy Tab Lưu trữ
  // - Tài khoản thuộc Tổ Lưu trữ (không thuộc Đo đạc) sẽ không thể thấy Tab Đo đạc
  if (user.employeeId && employees && activePerms) {
    const emp = employees.find(e => e.id === user.employeeId);
    if (emp && emp.department) {
      const isDodac = matchDepartmentKey('đo đạc', emp.department);
      const isLuutru = matchDepartmentKey('lưu trữ', emp.department);

      if (isDodac && !isLuutru) {
        const ARCHIVE_PERMS = [
          'archive_records', 'archive_sub_all', 'archive_assign_tasks',
          'archive_completed_list', 'archive_pending_check_list', 'archive_check_list',
          'archive_handover_list', 'archive_director_completed', 'VIEW_ARCHIVE', 'MANAGE_ARCHIVE'
        ];
        activePerms = activePerms.filter(p => !ARCHIVE_PERMS.includes(p) && !p.startsWith('luutru_'));
      } else if (isLuutru && !isDodac) {
        const SURVEY_PERMS = [
          'all_records', 'all_sub_all', 'assign_tasks', 'completed_list',
          'pending_supplement_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed', 'survey_list'
        ];
        activePerms = activePerms.filter(p => !SURVEY_PERMS.includes(p) && !p.startsWith('dodac_'));
      }
    }
  }

  // Luôn đảm bảo vai trò ONEDOOR kế thừa toàn bộ danh sách quyền mặc định của Một cửa, và tuyệt đối không có module Đo đạc hoặc Lưu trữ
  if (user.role === UserRole.ONEDOOR) {
    const defaultOneDoor = DEFAULT_ROLE_PERMISSIONS[UserRole.ONEDOOR] || [];
    if (activePerms) {
      activePerms = Array.from(new Set([...activePerms, ...defaultOneDoor]));
    } else {
      activePerms = defaultOneDoor;
    }
    const SURVEY_PERMS = [
      'all_records', 'all_sub_all', 'assign_tasks', 'completed_list',
      'pending_supplement_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed', 'survey_list'
    ];
    const ARCHIVE_PERMS = [
      'archive_records', 'archive_sub_all', 'archive_assign_tasks',
      'archive_completed_list', 'archive_pending_check_list', 'archive_check_list',
      'archive_handover_list', 'archive_director_completed', 'VIEW_ARCHIVE', 'MANAGE_ARCHIVE'
    ];
    activePerms = activePerms.filter(p => !SURVEY_PERMS.includes(p) && !ARCHIVE_PERMS.includes(p) && !p.startsWith('dodac_') && !p.startsWith('luutru_'));
  }

  if (activePerms !== null) {
    if (activePerms.includes('*')) return true;

    // Bộ quyền con thuộc từng phân hệ chính
    const ONEDOOR_CHILD_PERMS = ['receive_record', 'receive_sub_create', 'receive_sub_bulk', 'receive_sub_list', 'receive_sub_vphc', 'ADD_RECORDS', 'EXPORT_RECORDS'];
    const DODAC_CHILD_PERMS = [
      'all_records', 'all_sub_all', 'assign_tasks', 'completed_list', 'pending_supplement_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed',
      'dodac_BTN_ASSIGN_STAFF', 'dodac_BTN_SUBMIT_CHECK', 'dodac_BTN_SUBMIT_SIGN', 'dodac_BTN_APPROVE_SIGN', 
      'dodac_BTN_REJECT_RECORD', 'dodac_HANDOVER_RECORDS', 'dodac_BTN_RETURN_RESULT', 'dodac_VIEW_EXCERPTS', 
      'dodac_MANAGE_EXCERPTS', 'dodac_BTN_EXTEND_DEADLINE', 'dodac_EDIT_RECORDS', 'dodac_DELETE_RECORDS', 'dodac_VIEW_DETAILS',
      'BTN_ASSIGN_STAFF', 'BTN_SUBMIT_CHECK', 'BTN_SUBMIT_SIGN', 'BTN_APPROVE_SIGN', 'BTN_REJECT_RECORD', 'HANDOVER_RECORDS', 'BTN_RETURN_RESULT', 'EDIT_RECORDS', 'DELETE_RECORDS', 'VIEW_DETAILS'
    ];
    const LUUTRU_CHILD_PERMS = [
      'archive_records', 'archive_sub_all', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'archive_director_completed',
      'luutru_BTN_ASSIGN_STAFF', 'luutru_BTN_SUBMIT_CHECK', 'luutru_BTN_SUBMIT_SIGN', 'luutru_BTN_APPROVE_SIGN', 
      'luutru_BTN_REJECT_RECORD', 'luutru_HANDOVER_RECORDS', 'luutru_BTN_RETURN_RESULT', 'luutru_VIEW_ARCHIVE', 
      'luutru_MANAGE_ARCHIVE', 'luutru_BTN_EXTEND_DEADLINE', 'luutru_EDIT_RECORDS', 'luutru_DELETE_RECORDS', 'luutru_VIEW_DETAILS',
      'VIEW_ARCHIVE', 'MANAGE_ARCHIVE'
    ];
    const CONTRACT_CHILD_PERMS = [
      'receive_contract', 'VIEW_CONTRACTS', 'ADD_CONTRACTS', 'EDIT_CONTRACTS', 'LIQUIDATE_CONTRACTS', 'DELETE_CONTRACTS', 'EXPORT_CONTRACTS'
    ];

    const hasAnyPerm = (list: string[]) => list.some(p => activePerms!.includes(p));

    // Check viewId-specific permission
    switch (viewId) {
      // Main Tab Groups in Top Navigation
      case 'receive_group':
        return hasAnyPerm(ONEDOOR_CHILD_PERMS) || hasAnyPerm(CONTRACT_CHILD_PERMS);
      case 'records_group':
        if (user.role === UserRole.ONEDOOR) {
          return activePerms.includes('registration_records');
        }
        const allowDodac = !isUserLuutru(user, employees || []) && (activePerms.includes('all_records') || activePerms.includes('all_sub_all') || activePerms.includes('assign_tasks') || activePerms.includes('completed_list'));
        const allowLuutru = !isUserDodac(user, employees || []) && (activePerms.includes('archive_records') || activePerms.includes('archive_sub_all') || activePerms.includes('archive_assign_tasks') || activePerms.includes('archive_completed_list'));
        const allowReg = activePerms.includes('registration_records');
        return allowDodac || allowLuutru || allowReg;
      case 'tools_group':
        return activePerms.includes('reports') || activePerms.includes('VIEW_REPORTS') || activePerms.includes('excerpt_management') || activePerms.includes('MANAGE_EXCERPTS') || activePerms.includes('VIEW_EXCERPTS') || activePerms.includes('dodac_VIEW_EXCERPTS') || activePerms.includes('dodac_MANAGE_EXCERPTS') || activePerms.includes('utilities') || activePerms.includes('work_schedule');
      case 'management_group':
        return activePerms.includes('work_schedule') || activePerms.includes('VIEW_SCHEDULE') || activePerms.includes('personal_profile') || activePerms.includes('VIEW_PERSONAL_PROFILE');

      // Main Tabs - Tự động bật quyền xem tab nếu người dùng có bất kỳ quyền con nào trong phân hệ
      case 'receive_record':
      case 'receive_search':
      case 'receive_record_search':
        return hasAnyPerm(ONEDOOR_CHILD_PERMS);
      case 'all_records':
        if (user.role === UserRole.ONEDOOR) return false;
        if (isUserLuutru(user, employees || [])) return false;
        return activePerms.includes('all_records') || activePerms.includes('all_sub_all') || activePerms.includes('assign_tasks') || activePerms.includes('completed_list');
      case 'archive_records':
        if (user.role === UserRole.ONEDOOR) return false;
        if (isUserDodac(user, employees || [])) return false;
        return activePerms.includes('archive_records') || activePerms.includes('archive_sub_all') || activePerms.includes('archive_assign_tasks') || activePerms.includes('archive_completed_list');
      case 'receive_contract':
        return hasAnyPerm(CONTRACT_CHILD_PERMS);

      case 'registration_records':
        return activePerms.includes('registration_records');

      // Child Tabs - Receive Group
      case 'receive_sub_create':
      case 'receive_sub_bulk':
      case 'receive_sub_list':
      case 'receive_sub_vphc':
        return hasAnyPerm(ONEDOOR_CHILD_PERMS);

      // Child Tabs - All Records Group
      case 'all_sub_all':
      case 'assign_tasks':
      case 'completed_list':
      case 'pending_supplement_list':
      case 'pending_check_list':
      case 'check_list':
      case 'handover_list':
      case 'director_completed':
        return hasAnyPerm(DODAC_CHILD_PERMS);

      // Child Tabs - Archive Group
      case 'archive_sub_all':
      case 'archive_assign_tasks':
      case 'archive_completed_list':
      case 'archive_pending_check_list':
      case 'archive_check_list':
      case 'archive_handover_list':
      case 'archive_director_completed':
        return hasAnyPerm(LUUTRU_CHILD_PERMS);

      // Other Standalone Views
      case 'excerpt_management':
        return activePerms.includes('excerpt_management') || activePerms.includes('MANAGE_EXCERPTS') || activePerms.includes('VIEW_EXCERPTS') || activePerms.includes('dodac_VIEW_EXCERPTS') || activePerms.includes('dodac_MANAGE_EXCERPTS');
      case 'reports':
        return activePerms.includes('reports') || activePerms.includes('VIEW_REPORTS');
      case 'work_schedule':
        return activePerms.includes('work_schedule') || activePerms.includes('VIEW_SCHEDULE');
      case 'system_dashboard':
        return activePerms.includes('system_dashboard') || activePerms.includes('SYSTEM_SETTINGS');
      case 'utilities':
        return activePerms.includes('utilities') || activePerms.includes('SYSTEM_SETTINGS');

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
