
import { supabase, isConfigured } from './supabaseClient';
import { Employee, User } from '../types';
import { MOCK_EMPLOYEES, MOCK_USERS, DEPARTMENTS, POSITIONS } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, mapEmployeeFromDb, mapEmployeeToDb, mapUserFromDb, mapUserToDb, normalizeDepartment, normalizePosition } from './apiCore';
import { getSystemSetting, saveSystemSetting } from './apiSystem';

// --- EMPLOYEES ---

/**
 * Tải trực tiếp danh sách nhân viên thô từ CSDL (bảng employees & system_settings)
 * Hợp nhất thông minh giữa CSDL Cloud và Cấu hình Nhân sự nâng cao
 */
export const fetchRawEmployeesOnly = async (): Promise<Employee[]> => {
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

export const saveEmployeeApi = async (employee: Employee, isUpdate: boolean): Promise<Employee | null> => {
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
        
        // 1. Thử lưu vào bảng employees SQL (thử payload chuẩn managedWards trước, nếu không được thử managed_wards)
        try {
            const payloadManagedWards = {
                id: cleanEmp.id,
                name: cleanEmp.name,
                department: cleanEmp.department,
                position: cleanEmp.position,
                managedWards: wardsStr
            };
            
            let saveErr: any = null;
            if (isUpdate) {
                const res = await supabase.from('employees').update(payloadManagedWards).eq('id', cleanEmp.id);
                saveErr = res.error;
            } else {
                const res = await supabase.from('employees').insert([payloadManagedWards]);
                saveErr = res.error;
            }

            // Nếu schema CSDL dùng tên cột managed_wards dạng snake_case
            if (saveErr && (saveErr.code === 'PGRST204' || String(saveErr.message).includes('managedWards'))) {
                const payloadSnakeCase = {
                    id: cleanEmp.id,
                    name: cleanEmp.name,
                    department: cleanEmp.department,
                    position: cleanEmp.position,
                    managed_wards: wardsStr
                };
                if (isUpdate) {
                    await supabase.from('employees').update(payloadSnakeCase).eq('id', cleanEmp.id);
                } else {
                    await supabase.from('employees').insert([payloadSnakeCase]);
                }
            }
        } catch (dbErr) {
            console.warn("Lưu trực tiếp bảng SQL employees gặp lỗi (vẫn tiếp tục đồng bộ vào system_settings và bộ nhớ):", dbErr);
        }

        // 2. ĐỒNG BỘ 100% VÀO system_settings ('employees_config') ĐỂ BẢO ĐẢM TẢI ĐƯỢC TRÊN MỌI THIẾT BỊ / TRÌNH DUYỆT MỚI
        try {
            const currentCloudList = await fetchRawEmployeesOnly();
            const existingIdx = currentCloudList.findIndex(e => (e.id || '').trim().toLowerCase() === cleanEmp.id.toLowerCase());
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

    console.group(`[AUTH HYDRATION] Hydrating profile for user: "${user.username}" (${user.name})`);
    console.log(`Step 1: Raw User Record from DB/Session:`, {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        employeeId: user.employeeId,
        department: user.department,
        position: user.position,
        managedWards: user.managedWards
    });

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
                    console.log(`Step 2: Queried Employee directly from Supabase Cloud:`, matchedEmp);
                    break;
                }
            } catch (e) {
                console.warn("Lỗi truy vấn nhân viên trực tiếp từ CSDL Cloud:", e);
            }
        }
    } else if (matchedEmp) {
        console.log(`Step 2: Matched Employee from memory/cache:`, matchedEmp);
    } else {
        console.warn(`Step 2: No linked Employee record found for user "${user.username}". Using fallback profile info if present.`);
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

    console.log(`Step 3: Position resolved: "${finalUser.position || 'N/A'}"`);
    console.log(`Step 4: Department resolved: "${finalUser.department || 'N/A'}"`);
    console.log(`Step 5: Managed Wards / Assigned Areas resolved:`, finalUser.managedWards || []);
    console.log(`Step 6: Final Complete User Object constructed:`, finalUser);
    console.groupEnd();

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

// --- USERS ---

/**
 * Đồng bộ danh sách tài khoản kép vào system_settings ('users_config') để đảm bảo đồng bộ 100% trên mọi thiết bị và trình duyệt
 */
const syncUsersToCloudConfig = async (usersList: User[]) => {
    try {
        await saveSystemSetting('users_config', JSON.stringify(usersList));
    } catch (e) {
        console.warn("Lỗi đồng bộ users_config lên system_settings:", e);
    }
};

/**
 * Đọc và hợp nhất toàn bộ tài khoản từ:
 * 1. Bảng system_settings (key: users_config)
 * 2. Bảng users chuyên dụng trên Supabase
 * 3. LocalStorage cache
 * 4. MOCK_USERS mặc định
 */
export const fetchUsersDirectFromDb = async (): Promise<User[]> => {
    let cloudMap = new Map<string, User>();

    if (!isConfigured || !supabase) {
        const cached = getFromCache<User[]>(CACHE_KEYS.USERS, MOCK_USERS);
        const fallbackUsers = cached && cached.length > 0 ? cached : MOCK_USERS;
        return enrichUsersList(fallbackUsers);
    }

    try {
        // 1. Đọc từ bảng users trên Supabase (Thẩm quyền cao nhất)
        try {
            const { data, error } = await supabase.from('users').select('*');
            if (!error && Array.isArray(data) && data.length > 0) {
                data.forEach(u => {
                    const mapped = mapUserFromDb(u);
                    if (mapped.username) {
                        cloudMap.set(mapped.username.normalize('NFC').trim().toLowerCase(), mapped);
                    }
                });
            }
        } catch (e) {
            console.warn("Direct fetch table users error:", e);
        }

        // 2. Đọc từ system_settings ('users_config') CHỈ để bổ sung tài khoản chưa có trong bảng users
        try {
            const configVal = await getSystemSetting('users_config');
            if (configVal) {
                const parsed = JSON.parse(configVal);
                if (Array.isArray(parsed)) {
                    parsed.forEach(u => {
                        const mapped = mapUserFromDb(u);
                        if (mapped.username) {
                            const key = mapped.username.normalize('NFC').trim().toLowerCase();
                            // BẢNG USERS CÓ THẨM QUYỀN CAO NHẤT, chỉ thêm từ users_config nếu chưa có trong users table
                            if (!cloudMap.has(key)) {
                                cloudMap.set(key, mapped);
                            }
                        }
                    });
                }
            }
        } catch (e) {
            console.warn("Direct fetch system_settings error:", e);
        }

        // 3. Nạp thêm MOCK_USERS mặc định nếu chưa có trong DB (đảm bảo admin luôn có sẵn)
        MOCK_USERS.forEach(m => {
            const key = m.username.normalize('NFC').trim().toLowerCase();
            if (!cloudMap.has(key)) {
                cloudMap.set(key, mapUserFromDb(m));
            }
        });

        const rawResult = Array.from(cloudMap.values());
        const enrichedResult = await enrichUsersList(rawResult);
        saveToCache(CACHE_KEYS.USERS, enrichedResult);
        return enrichedResult;
    } catch (err) {
        console.warn("fetchUsersDirectFromDb exception:", err);
        const cached = getFromCache<User[]>(CACHE_KEYS.USERS, MOCK_USERS);
        const fallbackUsers = cached && cached.length > 0 ? cached : MOCK_USERS;
        return enrichUsersList(fallbackUsers);
    }
};

export const fetchUsers = async (): Promise<User[]> => {
    return fetchUsersDirectFromDb();
};

/**
 * Tìm kiếm tài khoản cụ thể trực tiếp trên Supabase (Ưu tiên bảng users)
 */
export const findUserInDbDirectly = async (usernameInput: string): Promise<User | null> => {
    const cleanU = (usernameInput || '').normalize('NFC').trim().toLowerCase();
    if (!cleanU) return null;

    // 1. Tìm trực tiếp trong bảng users trên Supabase
    if (isConfigured && supabase) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .ilike('username', cleanU);
            if (!error && Array.isArray(data) && data.length > 0) {
                const mappedUser = mapUserFromDb(data[0]);
                return await enrichUserWithEmployees(mappedUser);
            }
        } catch (e) {
            console.warn("findUserInDbDirectly direct query error:", e);
        }
    }

    // 2. Tìm trong danh sách hợp nhất từ Cloud
    const allUsers = await fetchUsersDirectFromDb();
    const matched = allUsers.find(u => u.username.normalize('NFC').trim().toLowerCase() === cleanU);
    if (matched) {
        return await enrichUserWithEmployees(matched);
    }

    return null;
};

export const saveUserApi = async (user: User, isUpdate: boolean): Promise<User | null> => {
    let savedUser = { ...user };

    if (isConfigured && supabase) {
        try {
            const payload = mapUserToDb(user);
            let dbSuccess = false;
            try {
                if (isUpdate) {
                    let query = supabase.from('users').update(payload);
                    if (user.id) {
                        query = query.eq('id', user.id);
                    } else {
                        query = query.ilike('username', user.username);
                    }
                    const { data, error } = await query.select();
                    if (!error && Array.isArray(data) && data.length > 0) {
                        savedUser = mapUserFromDb(data[0]);
                        dbSuccess = true;
                    } else {
                        const insertRes = await supabase.from('users').insert([payload]).select();
                        if (!insertRes.error && Array.isArray(insertRes.data) && insertRes.data.length > 0) {
                            savedUser = mapUserFromDb(insertRes.data[0]);
                            dbSuccess = true;
                        }
                    }
                } else {
                    const { data, error } = await supabase.from('users').insert([payload]).select();
                    if (!error && Array.isArray(data) && data.length > 0) {
                        savedUser = mapUserFromDb(data[0]);
                        dbSuccess = true;
                    }
                }
            } catch (e) {
                console.warn("Lưu bảng users gặp lỗi:", e);
            }
        } catch (error) {
            logError("saveUserApi table users", error, true);
        }
    }

    try {
        const currentList = await fetchUsersDirectFromDb();
        const normalizedTarget = savedUser.username.normalize('NFC').trim().toLowerCase();
        let updatedList: User[] = [];

        const exists = currentList.some(u => u.username.normalize('NFC').trim().toLowerCase() === normalizedTarget);
        if (exists) {
            updatedList = currentList.map(u => 
                u.username.normalize('NFC').trim().toLowerCase() === normalizedTarget ? savedUser : u
            );
        } else {
            updatedList = [...currentList, savedUser];
        }

        saveToCache(CACHE_KEYS.USERS, updatedList);
        if (isConfigured) {
            await syncUsersToCloudConfig(updatedList);
        }
    } catch (syncErr) {
        console.warn("Lỗi lưu dự phòng users_config:", syncErr);
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('users_updated'));
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const bc = new BroadcastChannel('app_users_channel');
                bc.postMessage({ type: 'USERS_UPDATED' });
                bc.close();
            } catch (e) {}
        }
    }

    return savedUser;
};

export interface CloudAuthResult {
    status: 'SUCCESS' | 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' | 'NETWORK_ERROR' | 'DB_ERROR';
    user?: User;
    message?: string;
    errorDetails?: any;
}

export const authenticateUserCloud = async (usernameInput: string, passwordInput: string): Promise<CloudAuthResult> => {
    if (!isConfigured || !supabase) {
        return {
            status: 'NETWORK_ERROR',
            message: 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.'
        };
    }

    const cleanU = usernameInput.normalize('NFC').trim().toLowerCase();
    const cleanP = passwordInput.normalize('NFC').trim();

    if (!cleanU || !cleanP) {
        return {
            status: 'INVALID_CREDENTIALS',
            message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.'
        };
    }

    const cloudUsers = await fetchUsersDirectFromDb();
    const targetUser = cloudUsers.find(u => u.username.normalize('NFC').trim().toLowerCase() === cleanU);

    if (!targetUser) {
        return {
            status: 'INVALID_CREDENTIALS',
            message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
        };
    }

    const dbPassword = (targetUser.password || '').normalize('NFC').trim();
    if (dbPassword !== cleanP) {
        return {
            status: 'INVALID_CREDENTIALS',
            message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
        };
    }

    if (targetUser.active === false) {
        return {
            status: 'ACCOUNT_DISABLED',
            message: 'Tài khoản đã bị vô hiệu hóa hoặc bị khóa. Vui lòng liên hệ quản trị viên.'
        };
    }

    const finalUser = await enrichUserWithEmployees(targetUser);

    return {
        status: 'SUCCESS',
        user: finalUser
    };
};

export const deleteUserApi = async (username: string): Promise<boolean> => {
    let success = true;
    const cleanU = username.normalize('NFC').trim().toLowerCase();

    if (isConfigured) {
        try {
            const { error: err1 } = await supabase.from('users').delete().eq('username', username);
            const { error: err2 } = await supabase.from('users').delete().ilike('username', cleanU);
            if (err1 && err2) console.warn("deleteUserApi table users error:", err1, err2);
        } catch (error) {
            logError("deleteUserApi", error, true);
        }
    }

    try {
        const currentList = await fetchUsers();
        const updatedList = currentList.filter(u => u.username.normalize('NFC').trim().toLowerCase() !== cleanU);
        saveToCache(CACHE_KEYS.USERS, updatedList);
        if (isConfigured) {
            await syncUsersToCloudConfig(updatedList);
        }
    } catch (syncErr) {
        console.warn("Lỗi xóa dự phòng users_config:", syncErr);
    }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('users_updated'));
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const bc = new BroadcastChannel('app_users_channel');
                bc.postMessage({ type: 'USERS_UPDATED' });
                bc.close();
            } catch (e) {}
        }
    }

    return success;
};
