
import { supabase, isConfigured, hasAuthenticatedSession } from './supabaseClient';
import { Employee, User } from '../types';
import { MOCK_EMPLOYEES, DEPARTMENTS, POSITIONS } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, mapEmployeeFromDb, mapEmployeeToDb, mapUserFromDb, normalizeDepartment, normalizePosition } from './apiCore';
import { getSystemSetting, saveSystemSetting } from './apiSystem';

// --- EMPLOYEES ---

/**
 * Tải trực tiếp danh sách nhân viên thô từ CSDL (bảng employees & system_settings)
 * Hợp nhất thông minh giữa CSDL Cloud và Cấu hình Nhân sự nâng cao
 */
export const fetchRawEmployeesOnly = async (): Promise<Employee[]> => {
    if (!(await hasAuthenticatedSession())) return [];
    const empMap = new Map<string, Employee>();

    if (isConfigured && supabase) {
        // 1. Tải từ system_settings (key: employees_config) TRƯỚC để thiết lập danh sách cấu hình gốc
        try {
            const configVal = await getSystemSetting('employees_config');
            if (configVal) {
                const parsed = JSON.parse(configVal);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    parsed.forEach(e => {
                        const mapped = mapEmployeeFromDb(e);
                        if (mapped.id) {
                            empMap.set(mapped.id.trim().toLowerCase(), mapped);
                        }
                    });
                }
            }
        } catch (e) {
            console.warn("Lỗi fetch system_settings employees_config:", e);
        }

        // 2. Tải từ bảng employees trên Supabase Cloud để bổ sung nhân viên chưa có trong config
        try {
            const { data, error } = await supabase.from('employees').select('*');
            if (!error && Array.isArray(data) && data.length > 0) {
                data.forEach(item => {
                    const emp = mapEmployeeFromDb(item);
                    if (emp.id) {
                        const key = emp.id.trim().toLowerCase();
                        const existing = empMap.get(key);
                        if (!existing) {
                            empMap.set(key, emp);
                        } else {
                            // Bảo lưu thông tin cấu hình chi tiết đã có (Tổ, Chức vụ, Xã phụ trách) từ config
                            const hasDeptConfig = existing.department && DEPARTMENTS.includes(existing.department as any);
                            const hasPosConfig = existing.position && POSITIONS.includes(existing.position as any);
                            const hasWardsConfig = Array.isArray(existing.managedWards) && existing.managedWards.length > 0;

                            empMap.set(key, {
                                id: existing.id,
                                name: (existing.name && existing.name !== existing.id) ? existing.name : (emp.name || existing.name),
                                department: hasDeptConfig ? existing.department : emp.department,
                                position: hasPosConfig ? existing.position : emp.position,
                                managedWards: hasWardsConfig ? existing.managedWards : emp.managedWards
                            });
                        }
                    }
                });
            }
        } catch (e) {
            console.warn("Lỗi fetch bảng employees:", e);
        }
    }

    return Array.from(empMap.values());
};

export const fetchEmployees = async (): Promise<Employee[]> => {
    if (!(await hasAuthenticatedSession())) return [];
    let cloudEmps = await fetchRawEmployeesOnly();

    if (isConfigured && supabase) {
        // Tự động bổ sung từ bảng users trên DB trực tiếp (TRUY VẤN TRỰC TIẾP bảng users, KHÔNG gọi fetchUsersDirectFromDb để tránh đệ quy)
        try {
            const { data, error } = await supabase.from('users').select('*');
            if (!error && Array.isArray(data) && data.length > 0) {
                data.forEach(u => {
                    const mappedUser = mapUserFromDb(u);
                    const empId = (mappedUser.employeeId || mappedUser.username || '').trim();
                    const empName = (mappedUser.name || mappedUser.username || '').trim();
                    if (empId && empName && empName.toLowerCase() !== empId.toLowerCase()) {
                        const exists = cloudEmps.some(e => 
                            (e.id || '').trim().toLowerCase() === empId.toLowerCase() || 
                            (e.name || '').trim().toLowerCase() === empName.toLowerCase()
                        );
                        if (!exists) {
                            // Đối soát với MOCK_EMPLOYEES danh sách chuẩn để lấy phòng ban & địa bàn chính xác
                            const mockMatch = MOCK_EMPLOYEES.find(m => 
                                m.id.toLowerCase() === empId.toLowerCase() || 
                                m.name.toLowerCase() === empName.toLowerCase()
                            );

                            if (mockMatch) {
                                cloudEmps.push({
                                    id: empId,
                                    name: empName,
                                    department: mockMatch.department,
                                    position: mockMatch.position,
                                    managedWards: mockMatch.managedWards || []
                                });
                            } else {
                                const userRoleStr = String(mappedUser.role).toUpperCase();
                                let defaultDept = 'Tổ Đo đạc';
                                if (userRoleStr === 'ARCHIVE_STAFF') defaultDept = 'Tổ Lưu trữ';
                                else if (userRoleStr === 'SUBADMIN' || userRoleStr === 'ADMIN') defaultDept = 'Ban Giám đốc';
                                else if (userRoleStr === 'ONEDOOR') defaultDept = 'Tổ Hành chính';

                                cloudEmps.push({
                                    id: empId,
                                    name: empName,
                                    department: normalizeDepartment(defaultDept),
                                    position: normalizePosition(userRoleStr === 'SUBADMIN' || userRoleStr === 'ADMIN' ? 'Tổ Trưởng' : 'Nhân viên'),
                                    managedWards: []
                                });
                            }
                        }
                    }
                });
            }
        } catch (e) {
            console.warn("Lỗi tự động tổng hợp danh sách nhân viên từ danh sách Users:", e);
        }
    }

    // Luôn bảo đảm các nhân viên chuẩn trong MOCK_EMPLOYEES có mặt đầy đủ
    MOCK_EMPLOYEES.forEach(mockEmp => {
        const found = cloudEmps.find(e => 
            (e.id || '').trim().toLowerCase() === mockEmp.id.toLowerCase() || 
            (e.name || '').trim().toLowerCase() === mockEmp.name.toLowerCase()
        );
        if (!found) {
            cloudEmps.push(mockEmp);
        } else {
            // Nếu nhân viên có trong cloudEmps nhưng phòng ban bị rỗng hoặc mặc định Hành chính, cập nhật sang tổ chuyên môn chuẩn
            if (!found.department || found.department === 'Tổ Hành chính') {
                if (mockEmp.department !== 'Tổ Hành chính') {
                    found.department = mockEmp.department;
                }
            }
            if ((!found.position || found.position === 'Nhân viên') && mockEmp.position !== 'Nhân viên') {
                found.position = mockEmp.position;
            }
            if ((!found.managedWards || found.managedWards.length === 0) && (mockEmp.managedWards && mockEmp.managedWards.length > 0)) {
                found.managedWards = mockEmp.managedWards;
            }
        }
    });

    if (cloudEmps.length > 0) {
        saveToCache(CACHE_KEYS.EMPLOYEES, cloudEmps);
        return cloudEmps;
    }

    const cached = getFromCache<Employee[]>(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
    return cached && cached.length > 0 ? cached : MOCK_EMPLOYEES;
};

export const syncEmployeesToCloudConfig = async (employeesList: Employee[]) => {
    try {
        await saveSystemSetting('employees_config', JSON.stringify(employeesList));
    } catch (e) {
        console.warn("Lỗi đồng bộ employees_config lên system_settings:", e);
    }
};

export const saveEmployeeApi = async (employee: Employee, isUpdate: boolean, originalId?: string): Promise<Employee | null> => {
    const cleanEmp: Employee = {
        ...employee,
        id: (employee.id || '').trim(),
        name: (employee.name || '').trim(),
        department: normalizeDepartment(employee.department),
        position: normalizePosition(employee.position),
        managedWards: Array.isArray(employee.managedWards) ? employee.managedWards : []
    };

    if (!cleanEmp.id || !cleanEmp.name) return cleanEmp;

    if (!isConfigured || !supabase) {
        saveToCache(CACHE_KEYS.EMPLOYEES, [cleanEmp]);
        return cleanEmp;
    }

    try {
        const wardsArr = Array.isArray(cleanEmp.managedWards) ? cleanEmp.managedWards : [];
        const wardsStr = JSON.stringify(wardsArr);
        const oldId = (originalId && originalId.trim() !== '') ? originalId.trim() : cleanEmp.id;
        const isIdChanged = oldId.toLowerCase() !== cleanEmp.id.toLowerCase();
        
        // 1. Thử lưu vào bảng employees SQL
        try {
            const payload = {
                id: cleanEmp.id,
                name: cleanEmp.name,
                department: cleanEmp.department,
                position: cleanEmp.position,
                managedWards: wardsStr,
                managed_wards: wardsStr
            };
            
            if (isUpdate) {
                if (isIdChanged) {
                    // Cố gắng cập nhật dòng cũ với ID mới
                    const { error: updErr } = await supabase.from('employees').update(payload).eq('id', oldId);
                    if (updErr) {
                        // Nếu không cập nhật được ID trực tiếp (do khóa chính hoặc xung đột), thực hiện upsert ID mới và xóa ID cũ
                        await supabase.from('employees').upsert([payload]);
                        await supabase.from('employees').delete().eq('id', oldId);
                    }
                    // Đồng bộ đổi mã nhân viên sang bảng users
                    try {
                        await supabase.from('users').update({ employeeId: cleanEmp.id }).eq('employeeId', oldId);
                    } catch (uErr) {
                        console.warn("Lỗi cập nhật users.employeeId:", uErr);
                    }
                } else {
                    const res = await supabase.from('employees').update(payload).eq('id', cleanEmp.id);
                    if (res.error) {
                        await supabase.from('employees').upsert([payload]);
                    }
                }
            } else {
                await supabase.from('employees').upsert([payload]);
            }
        } catch (dbErr) {
            console.warn("Lưu trực tiếp bảng SQL employees gặp lỗi (vẫn tiếp tục đồng bộ vào system_settings và bộ nhớ):", dbErr);
        }

        // 2. ĐỒNG BỘ 100% VÀO system_settings ('employees_config') ĐỂ BẢO ĐẢM TẢI ĐƯỢC TRÊN MỌI THIẾT BỊ / TRÌNH DUYỆT MỚI
        try {
            const currentCloudList = await fetchRawEmployeesOnly();
            const existingIdx = currentCloudList.findIndex(e => 
                (e.id || '').trim().toLowerCase() === oldId.toLowerCase() ||
                (e.id || '').trim().toLowerCase() === cleanEmp.id.toLowerCase()
            );
            if (existingIdx >= 0) {
                currentCloudList[existingIdx] = cleanEmp;
            } else {
                currentCloudList.push(cleanEmp);
            }
            await syncEmployeesToCloudConfig(currentCloudList);
            saveToCache(CACHE_KEYS.EMPLOYEES, currentCloudList);
        } catch (syncErr) {
            console.warn("Lỗi đồng bộ kép employees_config:", syncErr);
        }

        return cleanEmp;
    } catch (error) {
        logError("saveEmployeeApi", error, true);
        return cleanEmp;
    }
};

export const migrateEmployeeIdInAllTables = async (oldId: string, newId: string): Promise<boolean> => {
    if (!isConfigured || !supabase) return true;
    
    const cleanOld = oldId.trim();
    const cleanNew = newId.trim();
    if (!cleanOld || !cleanNew || cleanOld.toLowerCase() === cleanNew.toLowerCase()) return true;

    try {
        const tables = ['records', 'land_records', 'dangky_records', 'luutru_records'];
        const fields = ['assignedTo', 'receivedBy', 'surveyorId', 'drafterId', 'checkedBy', 'submittedTo', 'returnedBy'];

        for (const t of tables) {
            for (const f of fields) {
                try {
                    await supabase
                        .from(t)
                        .update({ [f]: cleanNew })
                        .eq(f, cleanOld);
                } catch (e) {
                    // Bỏ qua lỗi nếu bảng hoặc cột không tồn tại
                }
            }
        }
        return true;
    } catch (err) {
        console.warn("Lỗi đồng bộ mã nhân viên hàng loạt:", err);
        return false;
    }
};

export const deleteEmployeeApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        await supabase.from('employees').delete().eq('id', id);
        const currentCloudList = await fetchRawEmployeesOnly();
        const filtered = currentCloudList.filter(e => (e.id || '').toLowerCase() !== id.toLowerCase());
        await syncEmployeesToCloudConfig(filtered);
        saveToCache(CACHE_KEYS.EMPLOYEES, filtered);
        return true;
    } catch (error) {
        logError("deleteEmployeeApi", error, true);
        return true;
    }
};

// --- USERS ENRICHMENT HELPERS ---

const isEnrichmentDebugEnabled = (): boolean => {
    return typeof window !== 'undefined' && Boolean((window as any).__DEBUG_USER_ENRICHMENT__);
};

// Bộ nhớ đệm tạm thời cho kết quả enrichUserWithEmployees để tránh gọi lại lặp đi lặp lại khi không có thay đổi
const userEnrichCache = new Map<string, { key: string; result: User }>();

// Helper redact thông tin nhạy cảm (như mật khẩu) khi cần log
export const redactSensitiveUserInfo = (u: any) => {
    if (!u) return u;
    const { password, ...safe } = u;
    return safe;
};

/**
 * Tự động đồng bộ và bổ sung Họ tên nhân viên chính xác cho User từ bảng employees
 * Quy tắc:
 * 1. Nếu User có employeeId -> Tìm employee theo employeeId.
 * 2. Nếu User không có employeeId nhưng username trùng với employee.id -> Gán employeeId = employee.id.
 * 3. Nếu tìm thấy employee:
 *    - Nếu user.name bị trống, null, trùng với username, hoặc trùng với employeeId:
 *      Gán user.name = employee.name.
 *    - Nếu employee.name có giá trị hợp lệ và khác user.name (khi user.name chỉ là mã nhân viên):
 *      Ưu tiên gán user.name = employee.name để đảm bảo hiển thị đúng Họ tên.
 */
export const enrichUserWithEmployees = async (user: User, existingEmployees?: Employee[]): Promise<User> => {
    if (!user) return user;

    const debug = isEnrichmentDebugEnabled();
    const cacheKey = `${user.username || ''}|${user.employeeId || ''}|${user.name || ''}|${user.role || ''}|${user.department || ''}|${user.position || ''}|${JSON.stringify(user.managedWards || [])}|${existingEmployees?.length || 0}`;
    const cached = userEnrichCache.get(user.username || '');
    if (cached && cached.key === cacheKey) {
        return cached.result;
    }

    if (debug) {
        console.group(`[AUTH HYDRATION] Hydrating profile for user: "${user.username}" (${user.name})`);
        console.log(`Debug User Record:`, redactSensitiveUserInfo(user));
    }

    let employeesList = existingEmployees;
    if (!employeesList || employeesList.length === 0) {
        try {
            employeesList = await fetchRawEmployeesOnly();
            if (!employeesList || employeesList.length === 0) {
                employeesList = getFromCache<Employee[]>(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
            }
        } catch (e) {
            console.warn("Lỗi fetchRawEmployeesOnly khi enrich user:", e);
            employeesList = [];
        }
    }

    const cleanEmpId = (user.employeeId || '').trim().toLowerCase();
    const cleanUsername = (user.username || '').trim().toLowerCase();

    // 1. Tìm theo employeeId
    let matchedEmp = employeesList.find(e => (e.id || '').trim().toLowerCase() === cleanEmpId && cleanEmpId !== '');

    // 2. Nếu chưa thấy, thử tìm theo username = employee.id
    if (!matchedEmp && cleanUsername) {
        matchedEmp = employeesList.find(e => (e.id || '').trim().toLowerCase() === cleanUsername);
    }

    // 3. Tìm theo tên
    if (!matchedEmp && user.name) {
        const cleanName = user.name.trim().toLowerCase();
        matchedEmp = employeesList.find(e => (e.name || '').trim().toLowerCase() === cleanName);
    }

    // 4. Nếu vẫn chưa thấy trong danh sách bộ nhớ (máy mới / trình duyệt mới), truy vấn TRỰC TIẾP từ Supabase Cloud
    if (!matchedEmp && isConfigured && supabase) {
        const targetKeys = [user.employeeId, user.username, user.name].filter(Boolean).map(k => String(k).trim());
        for (const key of targetKeys) {
            if (!key) continue;
            try {
                const { data, error } = await supabase
                    .from('employees')
                    .select('*')
                    .or(`id.ilike.${key},name.ilike.${key}`);
                if (!error && Array.isArray(data) && data.length > 0) {
                    matchedEmp = mapEmployeeFromDb(data[0]);
                    if (debug) console.log(`Step 2: Queried Employee directly from Supabase Cloud:`, matchedEmp);
                    break;
                }
            } catch (e) {
                console.warn("Lỗi truy vấn nhân viên trực tiếp từ CSDL Cloud:", e);
            }
        }
    } else if (matchedEmp && debug) {
        console.log(`Step 2: Matched Employee from memory/cache:`, matchedEmp);
    }

    // Step 3: Resolve Position, Department, Managed Wards
    let resolvedPosition = user.position || '';
    let resolvedDepartment = user.department || '';
    let resolvedWards: string[] = Array.isArray(user.managedWards) ? user.managedWards : [];

    if (matchedEmp) {
        if (matchedEmp.position) resolvedPosition = normalizePosition(matchedEmp.position);
        if (matchedEmp.department) resolvedDepartment = normalizeDepartment(matchedEmp.department);
        if (Array.isArray(matchedEmp.managedWards) && matchedEmp.managedWards.length > 0) {
            resolvedWards = matchedEmp.managedWards;
        }
    }

    // Resolve official name
    const officialEmpName = matchedEmp?.name ? matchedEmp.name.trim() : '';
    const currentUserName = (user.name || '').trim();

    const isNameEmptyOrCode = !currentUserName || 
        currentUserName.toLowerCase() === cleanEmpId || 
        currentUserName.toLowerCase() === cleanUsername;

    const resolvedName = (isNameEmptyOrCode || currentUserName !== officialEmpName) && officialEmpName
        ? officialEmpName
        : (currentUserName || officialEmpName || user.username);

    const finalUser: User = {
        ...user,
        employeeId: matchedEmp?.id || user.employeeId || '',
        name: resolvedName,
        department: resolvedDepartment ? normalizeDepartment(resolvedDepartment) : undefined,
        position: resolvedPosition ? normalizePosition(resolvedPosition) : undefined,
        managedWards: resolvedWards
    };

    if (debug) {
        console.log(`Enriched User Object:`, redactSensitiveUserInfo(finalUser));
        console.groupEnd();
    }

    if (user.username) {
        userEnrichCache.set(user.username, { key: cacheKey, result: finalUser });
    }

    return finalUser;
};

export const enrichUsersList = async (usersList: User[], existingEmployees?: Employee[]): Promise<User[]> => {
    if (!Array.isArray(usersList) || usersList.length === 0) return usersList;

    let employeesList = existingEmployees;
    if (!employeesList || employeesList.length === 0) {
        try {
            employeesList = await fetchRawEmployeesOnly();
            if (!employeesList || employeesList.length === 0) {
                employeesList = getFromCache<Employee[]>(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
            }
        } catch (e) {
            employeesList = [];
        }
    }

    const empMap = new Map<string, Employee>();
    employeesList.forEach(e => {
        if (e.id) empMap.set(e.id.trim().toLowerCase(), e);
        if (e.name) empMap.set(e.name.trim().toLowerCase(), e);
    });

    return usersList.map(u => {
        const cleanEmpId = (u.employeeId || '').trim().toLowerCase();
        const cleanUsername = (u.username || '').trim().toLowerCase();
        const cleanName = (u.name || '').trim().toLowerCase();

        let matchedEmp = empMap.get(cleanEmpId);
        if (!matchedEmp && cleanUsername) {
            matchedEmp = empMap.get(cleanUsername);
        }
        if (!matchedEmp && cleanName) {
            matchedEmp = empMap.get(cleanName);
        }

        const resolvedDept = matchedEmp?.department || u.department || '';
        const resolvedPos = matchedEmp?.position || u.position || '';
        const resolvedWards = (Array.isArray(matchedEmp?.managedWards) && matchedEmp!.managedWards.length > 0)
            ? matchedEmp!.managedWards
            : (u.managedWards || []);

        const officialName = matchedEmp?.name ? matchedEmp.name.trim() : '';
        const currentUserName = (u.name || '').trim();

        const isNameEmptyOrCode = !currentUserName || 
            currentUserName.toLowerCase() === cleanEmpId || 
            currentUserName.toLowerCase() === cleanUsername;

        const finalName = (isNameEmptyOrCode || currentUserName !== officialName) && officialName
            ? officialName
            : (currentUserName || u.username);

        return {
            ...u,
            employeeId: matchedEmp?.id || u.employeeId,
            name: finalName,
            department: resolvedDept ? normalizeDepartment(resolvedDept) : undefined,
            position: resolvedPos ? normalizePosition(resolvedPos) : undefined,
            managedWards: resolvedWards
        };
    });
};

// All account entry points use Supabase Auth, including existing imports from apiPeople.
export {
    authenticateUserCloud, fetchUsers, fetchUsersDirectFromDb,
    findUserInDbDirectly, saveUserApi, deleteUserApi,
} from './authAccounts';
export type { CloudAuthResult } from './authAccounts';
