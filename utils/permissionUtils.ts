import { User, Employee, UserRole, RolePermissions, DepartmentPermissions, DEFAULT_ROLE_PERMISSIONS } from '../types';
import { isArchiveRecordType } from '../constants';
import { matchDepartmentKey } from './appHelpers';

/**
 * Checks if a user has a specific permission based on their department-specific overrides
 * or their role permissions.
 *
 * Enforces strict permission boundaries:
 * - ADMIN & SUBADMIN have unrestricted access.
 * - If department permissions exist for the user's department (+ role), it is treated as definitive:
 *   if an action is unchecked (not present), it will return FALSE and NOT fall back to default role permissions.
 * - If role permissions are configured, unchecked actions will return FALSE and NOT fall back to default role permissions.
 * - Actions specific to Dodac (dodac_*) will never cross-match with Luutru (luutru_*) and vice-versa.
 */
export function checkUserPermission(
    permissionId: string,
    currentUser: User | null | undefined,
    employees?: Employee[],
    rolePermissions?: RolePermissions | null,
    departmentPermissions?: DepartmentPermissions | null
): boolean {
    if (!currentUser) return false;

    // Admin and Subadmin have unrestricted full access
    const roleStr = String(currentUser.role || '');
    if (
        currentUser.role === UserRole.ADMIN ||
        currentUser.role === UserRole.SUBADMIN ||
        roleStr === 'ADMIN' ||
        roleStr === 'SUBADMIN'
    ) {
        return true;
    }

    // Fallback to localStorage if not passed
    if (!departmentPermissions && typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem('department_permissions');
            if (stored) departmentPermissions = JSON.parse(stored);
        } catch (_) {}
    }
    if (!rolePermissions && typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem('role_permissions');
            if (stored) rolePermissions = JSON.parse(stored);
        } catch (_) {}
    }

    // Check if user belongs to a specific department
    let userDept = '';
    if (currentUser.employeeId && employees && employees.length > 0) {
        const emp = employees.find(e => e.id === currentUser.employeeId);
        if (emp && emp.department) {
            userDept = emp.department.trim().toLowerCase();
        }
    }
    const isSurveyDept = userDept.includes('đo đạc') || userDept.includes('do dac');
    const isArchiveDept = userDept.includes('lưu trữ') || userDept.includes('luu tru');

    // Determine the exact list of IDs that satisfy this permission check
    const checkIds: string[] = [permissionId];

    if (permissionId.startsWith('dodac_')) {
        // Specifically asking for Dodac permission.
        // It must NEVER match luutru_ or fallback to generic!
        // Keep ONLY [permissionId]
    } else if (permissionId.startsWith('luutru_')) {
        // Specifically asking for Luutru permission.
        // It must NEVER match dodac_ or fallback to generic!
        // Keep ONLY [permissionId]
    } else {
        // Generic permission requested (e.g., 'BTN_ADVANCE_STATUS', 'BTN_ASSIGN_STAFF', 'EDIT_RECORDS')
        // Resolve accurately based on the user's department context
        if (isSurveyDept) {
            if (permissionId === 'BTN_ADVANCE_STATUS') checkIds.push('dodac_BTN_ADVANCE_STATUS');
            else if (permissionId === 'BTN_ASSIGN_STAFF' || permissionId === 'ASSIGN_RECORDS') checkIds.push('dodac_BTN_ASSIGN_STAFF');
            else if (permissionId === 'BTN_SUBMIT_CHECK' || permissionId === 'CHECK_RECORDS') checkIds.push('dodac_BTN_SUBMIT_CHECK');
            else if (permissionId === 'BTN_SUBMIT_SIGN' || permissionId === 'SIGN_RECORDS') checkIds.push('dodac_BTN_SUBMIT_SIGN');
            else if (permissionId === 'BTN_APPROVE_SIGN') checkIds.push('dodac_BTN_APPROVE_SIGN');
            else if (permissionId === 'BTN_REJECT_RECORD' || permissionId === 'REJECT_RECORDS') checkIds.push('dodac_BTN_REJECT_RECORD');
            else if (permissionId === 'HANDOVER_RECORDS') checkIds.push('dodac_HANDOVER_RECORDS');
            else if (permissionId === 'BTN_RETURN_RESULT' || permissionId === 'RETURN_RECORDS') checkIds.push('dodac_BTN_RETURN_RESULT');
            else if (permissionId === 'BTN_EXTEND_DEADLINE') checkIds.push('dodac_BTN_EXTEND_DEADLINE');
            else if (permissionId === 'EDIT_RECORDS') checkIds.push('dodac_EDIT_RECORDS');
            else if (permissionId === 'DELETE_RECORDS') checkIds.push('dodac_DELETE_RECORDS');
            else if (permissionId === 'VIEW_DETAILS') checkIds.push('dodac_VIEW_DETAILS');
            else if (permissionId === 'ADD_RECORDS') checkIds.push('dodac_ADD_RECORDS');
        } else if (isArchiveDept) {
            if (permissionId === 'BTN_ADVANCE_STATUS') checkIds.push('luutru_BTN_ADVANCE_STATUS');
            else if (permissionId === 'BTN_ASSIGN_STAFF' || permissionId === 'ASSIGN_RECORDS') checkIds.push('luutru_BTN_ASSIGN_STAFF');
            else if (permissionId === 'BTN_SUBMIT_CHECK' || permissionId === 'CHECK_RECORDS') checkIds.push('luutru_BTN_SUBMIT_CHECK');
            else if (permissionId === 'BTN_SUBMIT_SIGN' || permissionId === 'SIGN_RECORDS') checkIds.push('luutru_BTN_SUBMIT_SIGN');
            else if (permissionId === 'BTN_APPROVE_SIGN') checkIds.push('luutru_BTN_APPROVE_SIGN');
            else if (permissionId === 'BTN_REJECT_RECORD' || permissionId === 'REJECT_RECORDS') checkIds.push('luutru_BTN_REJECT_RECORD');
            else if (permissionId === 'HANDOVER_RECORDS') checkIds.push('luutru_HANDOVER_RECORDS');
            else if (permissionId === 'BTN_RETURN_RESULT' || permissionId === 'RETURN_RECORDS') checkIds.push('luutru_BTN_RETURN_RESULT');
            else if (permissionId === 'BTN_EXTEND_DEADLINE') checkIds.push('luutru_BTN_EXTEND_DEADLINE');
            else if (permissionId === 'EDIT_RECORDS') checkIds.push('luutru_EDIT_RECORDS');
            else if (permissionId === 'DELETE_RECORDS') checkIds.push('luutru_DELETE_RECORDS');
            else if (permissionId === 'VIEW_DETAILS') checkIds.push('luutru_VIEW_DETAILS');
            else if (permissionId === 'ADD_RECORDS') checkIds.push('luutru_ADD_RECORDS');
        } else {
            // General roles (e.g. ONEDOOR, ADMIN, etc.)
            if (permissionId === 'BTN_ASSIGN_STAFF' || permissionId === 'ASSIGN_RECORDS') {
                checkIds.push('dodac_BTN_ASSIGN_STAFF', 'luutru_BTN_ASSIGN_STAFF');
            } else if (permissionId === 'BTN_SUBMIT_CHECK' || permissionId === 'CHECK_RECORDS') {
                checkIds.push('dodac_BTN_SUBMIT_CHECK', 'luutru_BTN_SUBMIT_CHECK');
            } else if (permissionId === 'BTN_SUBMIT_SIGN' || permissionId === 'SIGN_RECORDS') {
                checkIds.push('dodac_BTN_SUBMIT_SIGN', 'luutru_BTN_SUBMIT_SIGN');
            } else if (permissionId === 'BTN_APPROVE_SIGN') {
                checkIds.push('dodac_BTN_APPROVE_SIGN', 'luutru_BTN_APPROVE_SIGN');
            } else if (permissionId === 'BTN_REJECT_RECORD' || permissionId === 'REJECT_RECORDS') {
                checkIds.push('dodac_BTN_REJECT_RECORD', 'luutru_BTN_REJECT_RECORD');
            } else if (permissionId === 'HANDOVER_RECORDS') {
                checkIds.push('dodac_HANDOVER_RECORDS', 'luutru_HANDOVER_RECORDS');
            } else if (permissionId === 'BTN_RETURN_RESULT' || permissionId === 'RETURN_RECORDS') {
                checkIds.push('dodac_BTN_RETURN_RESULT', 'luutru_BTN_RETURN_RESULT');
            } else if (permissionId === 'BTN_EXTEND_DEADLINE') {
                checkIds.push('dodac_BTN_EXTEND_DEADLINE', 'luutru_BTN_EXTEND_DEADLINE');
            } else if (permissionId === 'EDIT_RECORDS') {
                checkIds.push('dodac_EDIT_RECORDS', 'luutru_EDIT_RECORDS');
            } else if (permissionId === 'DELETE_RECORDS') {
                checkIds.push('dodac_DELETE_RECORDS', 'luutru_DELETE_RECORDS');
            } else if (permissionId === 'VIEW_DETAILS') {
                checkIds.push('dodac_VIEW_DETAILS', 'luutru_VIEW_DETAILS');
            } else if (permissionId === 'ADD_RECORDS') {
                checkIds.push('dodac_ADD_RECORDS', 'luutru_ADD_RECORDS');
            } else if (permissionId === 'BTN_ADVANCE_STATUS') {
                checkIds.push('dodac_BTN_ADVANCE_STATUS', 'luutru_BTN_ADVANCE_STATUS');
            }
        }
    }

    // Step 1: Check Department + Role composite key in departmentPermissions
    let userPermsList: string[] | null = null;

    if (currentUser.employeeId && employees && employees.length > 0) {
        const emp = employees.find(e => e.id === currentUser.employeeId);
        if (emp && emp.department && departmentPermissions) {
            const userDept = emp.department.trim();
            const userRole = currentUser.role;

            // Direct key check e.g. "Tổ Đo đạc_EMPLOYEE"
            const directKey = `${userDept}_${userRole}`;
            if (directKey in departmentPermissions && Array.isArray(departmentPermissions[directKey])) {
                userPermsList = departmentPermissions[directKey];
            } else {
                // Match with matchDepartmentKey on dept part
                const matchingCompositeKey = Object.keys(departmentPermissions).find(k => {
                    const lastUnderscore = k.lastIndexOf('_');
                    if (lastUnderscore === -1) return false;
                    const deptPart = k.substring(0, lastUnderscore);
                    const rolePart = k.substring(lastUnderscore + 1);
                    return rolePart === userRole && (matchDepartmentKey(deptPart, userDept) || matchDepartmentKey(userDept, deptPart));
                });

                if (matchingCompositeKey && Array.isArray(departmentPermissions[matchingCompositeKey])) {
                    userPermsList = departmentPermissions[matchingCompositeKey];
                } else {
                    // Match pure department key (without role)
                    const pureDeptKey = Object.keys(departmentPermissions).find(k => {
                        if (k.includes('_ADMIN') || k.includes('_SUBADMIN') || k.includes('_TEAM_LEADER') || k.includes('_EMPLOYEE') || k.includes('_ONEDOOR')) {
                            return false;
                        }
                        return matchDepartmentKey(k, userDept) || matchDepartmentKey(userDept, k);
                    });
                    if (pureDeptKey && Array.isArray(departmentPermissions[pureDeptKey])) {
                        userPermsList = departmentPermissions[pureDeptKey];
                    }
                }
            }
        }
    }

    // Step 2: If no department-specific permissions list was found, use rolePermissions
    if (!userPermsList) {
        if (rolePermissions && currentUser.role in rolePermissions && Array.isArray(rolePermissions[currentUser.role])) {
            userPermsList = rolePermissions[currentUser.role];
        } else if (DEFAULT_ROLE_PERMISSIONS[currentUser.role]) {
            userPermsList = DEFAULT_ROLE_PERMISSIONS[currentUser.role];
        }
    }

    if (!userPermsList || userPermsList.length === 0) {
        return false;
    }

    // Check wildcard '*'
    if (userPermsList.includes('*')) {
        return true;
    }

    // Check if any required ID is in the user's explicit permissions list
    return checkIds.some(id => userPermsList!.includes(id));
}

/**
 * Helper to check permission for a specific record action, automatically resolving
 * whether the record belongs to Đo đạc or Lưu trữ.
 */
export function hasRecordActionPermission(
    action: 'view' | 'advance' | 'return' | 'edit' | 'delete' | 'extend' | 'reject',
    record: { recordType?: string | null; sourceTable?: string | null },
    currentUser: User | null | undefined,
    employees?: Employee[],
    rolePermissions?: RolePermissions | null,
    departmentPermissions?: DepartmentPermissions | null
): boolean {
    if (!currentUser) return false;
    const roleStr = String(currentUser.role || '');
    if (
        currentUser.role === UserRole.ADMIN ||
        currentUser.role === UserRole.SUBADMIN ||
        roleStr === 'ADMIN' ||
        roleStr === 'SUBADMIN'
    ) {
        return true;
    }

    const isArchive = isArchiveRecordType(record.recordType || '') || record.sourceTable === 'luutru_records';

    switch (action) {
        case 'view':
            return checkUserPermission(
                isArchive ? 'luutru_VIEW_DETAILS' : 'dodac_VIEW_DETAILS',
                currentUser,
                employees,
                rolePermissions,
                departmentPermissions
            );
        case 'advance':
            return checkUserPermission(
                isArchive ? 'luutru_BTN_ADVANCE_STATUS' : 'dodac_BTN_ADVANCE_STATUS',
                currentUser,
                employees,
                rolePermissions,
                departmentPermissions
            );
        case 'return':
            return checkUserPermission(
                isArchive ? 'luutru_BTN_RETURN_RESULT' : 'dodac_BTN_RETURN_RESULT',
                currentUser,
                employees,
                rolePermissions,
                departmentPermissions
            );
        case 'edit':
            return checkUserPermission(
                isArchive ? 'luutru_EDIT_RECORDS' : 'dodac_EDIT_RECORDS',
                currentUser,
                employees,
                rolePermissions,
                departmentPermissions
            );
        case 'delete':
            // Xóa requires Team Leader or above AND specific delete permission
            if (currentUser.role !== UserRole.TEAM_LEADER && roleStr !== 'TEAM_LEADER') {
                return false;
            }
            return checkUserPermission(
                isArchive ? 'luutru_DELETE_RECORDS' : 'dodac_DELETE_RECORDS',
                currentUser,
                employees,
                rolePermissions,
                departmentPermissions
            );
        case 'extend':
            return checkUserPermission(
                isArchive ? 'luutru_BTN_EXTEND_DEADLINE' : 'dodac_BTN_EXTEND_DEADLINE',
                currentUser,
                employees,
                rolePermissions,
                departmentPermissions
            );
        case 'reject':
            return checkUserPermission(
                isArchive ? 'luutru_BTN_REJECT_RECORD' : 'dodac_BTN_REJECT_RECORD',
                currentUser,
                employees,
                rolePermissions,
                departmentPermissions
            );
        default:
            return false;
    }
}
