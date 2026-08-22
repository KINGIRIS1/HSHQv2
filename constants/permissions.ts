import { UserRole, DEFAULT_ROLE_PERMISSIONS } from '../types';
import { matchDepartmentKey } from '../utils/appHelpers';

/**
 * Định nghĩa cấu trúc dữ liệu quyền truy cập theo Role và Bộ phận/Tổ chuyên môn
 */
export interface RoleAccessDefinition {
  role: UserRole;
  label: string;
  description: string;
  defaultPermissions: string[];
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleAccessDefinition> = {
  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    label: 'Quản trị viên hệ thống (Admin)',
    description: 'Quyền cao nhất, quản lý toàn bộ hệ thống, tài khoản và phân quyền.',
    defaultPermissions: ['*']
  },
  [UserRole.SUBADMIN]: {
    role: UserRole.SUBADMIN,
    label: 'Phó quản trị (Subadmin)',
    description: 'Quyền quản lý vận hành, duyệt hồ sơ và cấu hình tương đương Admin (trừ quản lý tài khoản cấp cao).',
    defaultPermissions: ['*']
  },
  [UserRole.TEAM_LEADER]: {
    role: UserRole.TEAM_LEADER,
    label: 'Nhóm trưởng / Tổ trưởng',
    description: 'Quản lý tác vụ, phân công công việc, ký duyệt hoặc kiểm tra hồ sơ theo tổ chuyên môn.',
    defaultPermissions: DEFAULT_ROLE_PERMISSIONS[UserRole.TEAM_LEADER] || []
  },
  [UserRole.ONEDOOR]: {
    role: UserRole.ONEDOOR,
    label: 'Bộ phận Một cửa',
    description: 'Tiếp nhận hồ sơ, bàn giao kết quả và tương tác với công dân.',
    defaultPermissions: DEFAULT_ROLE_PERMISSIONS[UserRole.ONEDOOR] || []
  },
  [UserRole.EMPLOYEE]: {
    role: UserRole.EMPLOYEE,
    label: 'Chuyên viên / Nhân viên chuyên môn',
    description: 'Xử lý hồ sơ chuyên môn theo phân công của tổ.',
    defaultPermissions: DEFAULT_ROLE_PERMISSIONS[UserRole.EMPLOYEE] || []
  }
};

/**
 * Kiểm tra xem user có phải là Quản trị viên (Admin hoặc Subadmin) không
 */
export function isUserAdminOrSubadmin(user: { role?: UserRole | string } | null): boolean {
  if (!user || !user.role) return false;
  const role = String(user.role).toUpperCase();
  return role === UserRole.ADMIN || role === UserRole.SUBADMIN;
}

/**
 * Kiểm tra xem user có phải là Nhóm trưởng / Tổ trưởng không
 */
export function isUserTeamLeader(user: { role?: UserRole | string } | null): boolean {
  if (!user || !user.role) return false;
  return String(user.role).toUpperCase() === UserRole.TEAM_LEADER;
}

/**
 * Kiểm tra xem user có phải là Bộ phận Một cửa không
 */
export function isUserOneDoor(user: { role?: UserRole | string } | null): boolean {
  if (!user || !user.role) return false;
  return String(user.role).toUpperCase() === UserRole.ONEDOOR;
}

/**
 * Kiểm tra xem user có phải là Chuyên viên / Nhân viên không
 */
export function isUserEmployee(user: { role?: UserRole | string } | null): boolean {
  if (!user || !user.role) return false;
  return String(user.role).toUpperCase() === UserRole.EMPLOYEE;
}

/**
 * Kiểm tra quyền thực hiện tác vụ chung (Admin, Subadmin, TeamLeader, OneDoor đều có thể thực hiện phần lớn nghiệp vụ)
 */
export function canUserPerformGeneralAction(user: { role?: UserRole | string } | null): boolean {
  if (!user || !user.role) return false;
  const role = String(user.role).toUpperCase();
  return role === UserRole.ADMIN || role === UserRole.SUBADMIN || role === UserRole.TEAM_LEADER || role === UserRole.ONEDOOR;
}

/**
 * Kiểm tra xem user có quyền cụ thể dựa trên ma trận quyền role/department hay không
 */
export function checkUserHasPermission(
  user: { role?: UserRole | string; employeeId?: string } | null,
  permissionId: string,
  employees: { id: string; department: string }[] = [],
  rolePermissions: Record<string, string[]> = {},
  departmentPermissions: Record<string, string[]> = {}
): boolean {
  if (!user || !user.role) return false;
  if (isUserAdminOrSubadmin(user)) return true;

  let activePerms: string[] | null = null;

  if (user.employeeId && employees && departmentPermissions) {
    const emp = employees.find(e => e.id === user.employeeId);
    if (emp && emp.department) {
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
  }

  if (activePerms === null) {
    const roleKey = String(user.role);
    if (rolePermissions && rolePermissions[roleKey]) {
      activePerms = rolePermissions[roleKey];
    } else if (DEFAULT_ROLE_PERMISSIONS[roleKey as UserRole]) {
      activePerms = DEFAULT_ROLE_PERMISSIONS[roleKey as UserRole];
    }
  }

  if (!activePerms) return false;
  return activePerms.includes('*') || activePerms.includes(permissionId);
}
