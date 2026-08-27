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
      'receive_sub_create', 'receive_sub_bulk', 'receive_sub_list', 'receive_sub_vphc',
      'personal_profile', 'account_settings', 'utilities', 'work_schedule', 
      'tools_group', 'barcode_generator', 'lookup_records'
    ]
  },
  [UserRole.EMPLOYEE]: {
    role: UserRole.EMPLOYEE,
    allowedViews: [
      'dashboard', 'personal_profile', 'work_schedule', 'utilities', 'tools_group',
      'account_settings', 'lookup_records'
    ]
  },
  [UserRole.TEAM_LEADER]: {
    role: UserRole.TEAM_LEADER,
    allowedViews: [
      'dashboard', 'personal_profile', 'work_schedule', 'utilities', 'tools_group',
      'reports', 'account_settings', 'lookup_records'
    ],
    // Mở rộng quyền Chuyên môn dựa trên Tổ chuyên môn đang quản lý
    departmentSpecificViews: [
      {
        keyword: 'đo đạc',
        views: ['all_records', 'assign_tasks', 'completed_list', 'pending_supplement_list', 'pending_check_list', 'check_list', 'handover_list', 'excerpt_management']
      },
      {
        keyword: 'đăng ký',
        views: ['registration_records', 'vaoso_records']
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
  employees: { id: string; department: string; position?: string }[],
  viewId: string,
  rolePermissions?: Record<string, string[]>,
  departmentPermissions?: Record<string, string[]>
): boolean {
  if (!user) return false;

  // 1. Admin & Subadmin: Toàn quyền truy cập mọi view, không phụ thuộc chức danh/tổ
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUBADMIN) {
    return true;
  }

  // 2. ONEDOOR (Bộ phận Một Cửa): Phân quyền độc lập, không dựa theo chức danh/tổ
  if (user.role === UserRole.ONEDOOR) {
    const onedoorAllowedViews = [
      'dashboard', 'personal_profile', 'account_settings', 'utilities', 'work_schedule', 
      'tools_group', 'barcode_generator', 'lookup_records',
      'receive_group', 'receive_record', 'receive_contract',
      'receive_sub_create', 'receive_sub_bulk', 'receive_sub_list', 'receive_sub_vphc'
    ];
    return onedoorAllowedViews.includes(viewId);
  }

  // Views cơ bản mà mọi user đã đăng nhập đều xem được
  if (['dashboard', 'personal_profile', 'account_settings', 'utilities', 'tools_group', 'work_schedule'].includes(viewId)) {
    return true;
  }

  // 3. TEAM_LEADER và EMPLOYEE: Phân quyền theo TỔ CHUYÊN MÔN và CHỨC DANH
  const emp = user.employeeId && employees ? employees.find(e => e.id === user.employeeId) : null;
  const isTeamLeader = user.role === UserRole.TEAM_LEADER;
  
  // Xác định vị trí/chức vụ quản lý (Tổ trưởng, Tổ phó, Trưởng phòng, Phó phòng, Lãnh đạo)
  const posNormalized = emp?.position ? removeDiacritics(emp.position.toLowerCase()) : '';
  const isLeaderPosition = isTeamLeader || 
    posNormalized.includes('truong') || 
    posNormalized.includes('pho') || 
    posNormalized.includes('lanh dao') || 
    posNormalized.includes('giam doc');

  // Xác định Tổ chuyên môn
  const deptNormalized = emp?.department ? removeDiacritics(emp.department.toLowerCase()) : '';
  const isDodac = deptNormalized.includes('do dac');
  const isLuutru = deptNormalized.includes('luu tru') || deptNormalized.includes('thong tin');
  const isCapGiay = deptNormalized.includes('dang ky') || deptNormalized.includes('cap giay');

  // Đánh giá quyền động (nếu có cấu hình phân quyền động)
  let activePerms: string[] | null = null;
  if (emp && emp.department && departmentPermissions) {
    const compositeKey = `${emp.department}_${user.role}`;
    if (departmentPermissions[compositeKey]) {
      activePerms = departmentPermissions[compositeKey];
    } else if (departmentPermissions[emp.department]) {
      activePerms = departmentPermissions[emp.department];
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

  // Áp dụng bộ lọc phân tách theo Tổ chuyên môn (Department isolation)
  if (emp && emp.department && activePerms) {
    if (isCapGiay && !isDodac && !isLuutru) {
      activePerms = activePerms.filter(p => !p.startsWith('dodac_') && !p.startsWith('luutru_'));
    } else if (isDodac && !isCapGiay && !isLuutru) {
      activePerms = activePerms.filter(p => !p.startsWith('dangky_') && !p.startsWith('luutru_'));
    } else if (isLuutru && !isCapGiay && !isDodac) {
      activePerms = activePerms.filter(p => !p.startsWith('dangky_') && !p.startsWith('dodac_'));
    }
  }

  if (activePerms !== null) {
    if (activePerms.includes('*')) return true;

    // Phân quyền theo chức danh: Chuyên viên / Nhân viên không có quyền Giao việc (assign_tasks)
    if (!isLeaderPosition && ['assign_tasks', 'archive_assign_tasks', 'other_assign_tasks'].includes(viewId)) {
      return false;
    }

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
        return activePerms.some(p => p.startsWith('dangky_')) ||
               activePerms.some(p => p.startsWith('dodac_')) ||
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
        return isDodac || activePerms.some(p => p.startsWith('dodac_'));
      case 'archive_records':
        return isLuutru || activePerms.some(p => p.startsWith('luutru_'));
      case 'registration_records':
      case 'vaoso_records':
        return isCapGiay || activePerms.some(p => p.startsWith('dangky_'));
      case 'other_records':
        return isDodac || activePerms.some(p => p.startsWith('dodac_'));

      // Child Tabs - Receive Group
      case 'receive_sub_create':
      case 'receive_sub_bulk':
      case 'receive_sub_list':
      case 'receive_sub_vphc':
        return activePerms.includes('ADD_RECORDS') || activePerms.includes('EXPORT_RECORDS');

      // Child Tabs - All Records Group (Đo đạc)
      case 'all_sub_all':
      case 'completed_list':
      case 'pending_supplement_list':
      case 'pending_check_list':
      case 'check_list':
      case 'handover_list':
        return isDodac || activePerms.some(p => p.startsWith('dodac_'));
      case 'assign_tasks':
        return isLeaderPosition && (isDodac || activePerms.some(p => p.startsWith('dodac_')));

      // Child Tabs - Archive Group (Lưu trữ)
      case 'archive_sub_all':
      case 'archive_completed_list':
      case 'archive_pending_check_list':
      case 'archive_check_list':
      case 'archive_handover_list':
        return isLuutru || activePerms.some(p => p.startsWith('luutru_'));
      case 'archive_assign_tasks':
        return isLeaderPosition && (isLuutru || activePerms.some(p => p.startsWith('luutru_')));

      // Child Tabs - Other Records Group
      case 'other_sub_all':
      case 'other_check_list':
      case 'other_handover_list':
        return isDodac || activePerms.some(p => p.startsWith('dodac_'));
      case 'other_assign_tasks':
        return isLeaderPosition && (isDodac || activePerms.some(p => p.startsWith('dodac_')));

      // Other Standalone Views
      case 'receive_contract':
        return activePerms.includes('ADD_CONTRACTS') ||
               activePerms.includes('EDIT_CONTRACTS') ||
               activePerms.includes('LIQUIDATE_CONTRACTS') ||
               activePerms.includes('DELETE_CONTRACTS') ||
               activePerms.includes('EXPORT_CONTRACTS');
      case 'excerpt_management':
        return (isDodac || isLuutru) && (activePerms.includes('dodac_MANAGE_EXCERPTS') || activePerms.includes('dodac_VIEW_EXCERPTS') || activePerms.includes('luutru_VIEW_ARCHIVE'));
      case 'reports':
        return isLeaderPosition && activePerms.includes('VIEW_REPORTS');
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

  // Fallback nếu không có dynamic perms
  const config = ROLE_VIEWS_CONFIG[user.role];
  if (!config) return false;

  if (config.allowedViews.includes(viewId)) {
    return true;
  }

  if (config.departmentSpecificViews && emp && emp.department) {
    for (const deptView of config.departmentSpecificViews) {
      const keywordNormalized = removeDiacritics(deptView.keyword.toLowerCase());
      if (deptNormalized.includes(keywordNormalized)) {
        if (deptView.views.includes(viewId)) {
          if (['assign_tasks', 'archive_assign_tasks', 'other_assign_tasks'].includes(viewId) && !isLeaderPosition) {
            return false;
          }
          return true;
        }
      }
    }
  }

  return false;
}
