
import { useState, useMemo, useEffect } from 'react';
import { RecordFile, User, UserRole, RecordStatus, Employee } from '../types';
import { removeVietnameseTones, isRecordOverdue, isRecordApproaching } from '../utils/appHelpers';
import { getShortRecordType, isArchiveRecordType, isCapGiayRecord } from '../constants';

export const useRecordFilter = (
    records: RecordFile[],
    currentUser: User | null,
    currentView: string,
    employees: Employee[]
) => {
    // Filter States
    const [searchStates, setSearchStates] = useState<Record<string, string>>({});
    
    // Lấy search term của view hiện tại (mặc định rỗng nếu chưa có)
    const searchTerm = searchStates[currentView] || '';

    // Hàm set search term chỉ cập nhật cho view hiện tại
    const setSearchTerm = (term: string) => {
        setSearchStates(prev => ({
            ...prev,
            [currentView]: term
        }));
    };

    // Tự động xóa chuỗi tìm kiếm và các bộ lọc khi chuyển sang một tab hoặc view mới
    useEffect(() => {
        if (Object.keys(searchStates).length > 0) {
            setSearchStates({});
        }
        setFilterRecordType('all');
        setFilterWard('all');
        setFilterStatus('all');
        setFilterEmployee('all');
        setWarningFilter('none');
        setCapGiaySubStepFilter('all');
        setFilterSpecificDate('');
        setFilterAssignedDate('');
        setFilterFromDate('');
        setFilterToDate('');
        setFilterAssignedFromDate('');
        setFilterAssignedToDate('');
    }, [currentView]);

    const [filterDate, setFilterDate] = useState(''); 
    const [filterSpecificDate, setFilterSpecificDate] = useState('');
    const [filterAssignedDate, setFilterAssignedDate] = useState('');
    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');
    const [filterAssignedFromDate, setFilterAssignedFromDate] = useState('');
    const [filterAssignedToDate, setFilterAssignedToDate] = useState('');
    const [showAdvancedDateFilter, setShowAdvancedDateFilter] = useState(false);
    
    const [filterWard, setFilterWard] = useState('all');
    const [filterRecordType, setFilterRecordType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterEmployee, setFilterEmployee] = useState('all');
    const [capGiaySubStepFilter, setCapGiaySubStepFilter] = useState<string>('all');
    const [warningFilter, setWarningFilter] = useState<'none' | 'overdue' | 'approaching'>('none');
    
    // Cập nhật type cho handoverTab để hỗ trợ 'returned'
    const [handoverTab, setHandoverTab] = useState<'today' | 'history' | 'returned'>('today');
 
    // Sorting & Pagination
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'receivedDate',
        direction: 'desc'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Reset pagination when filters change
    useEffect(() => {
        if (currentPage !== 1) {
            setCurrentPage(1);
        }
    }, [currentView, sortConfig, warningFilter, filterWard, filterRecordType, filterStatus, filterEmployee, filterSpecificDate, filterAssignedDate, filterFromDate, filterToDate, filterAssignedFromDate, filterAssignedToDate, handoverTab, searchTerm]);

    // --- WARNING CHECK LOGIC ---
    const checkWarningPermission = (r: RecordFile) => {
        if (!currentUser) return false;
        if (currentUser.role === UserRole.ONEDOOR) return false;
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN) return true;
        if (currentUser.role === UserRole.EMPLOYEE) {
            return r.assignedTo === currentUser.employeeId;
        }
        if (currentUser.role === UserRole.TEAM_LEADER) {
            const leaderEmp = employees.find(e => e.id === currentUser.employeeId);
            if (!leaderEmp) return true; 
            const isMyTask = r.assignedTo === currentUser.employeeId || r.checkedBy === currentUser.employeeId;
            const hasManagedWards = leaderEmp.managedWards && leaderEmp.managedWards.length > 0;
            const isMyWard = hasManagedWards ? leaderEmp.managedWards.some((w: string) => r.ward && r.ward.includes(w)) : true;
            return isMyTask || isMyWard;
        }
        return false; 
    };

    const isDirector = useMemo(() => {
        if (!currentUser?.employeeId) return false;
        const emp = employees.find(e => e.id === currentUser.employeeId);
        return emp ? (emp.department?.trim().toLowerCase() === 'ban giám đốc' || emp.department?.trim().toLowerCase() === 'ban lãnh đạo') : false;
    }, [currentUser?.employeeId, employees]);

    // --- FILTER LOGIC ---
    const filteredRecords = useMemo(() => {
        const uniqueMap = new Map();
        records.forEach(r => { if(r.id) uniqueMap.set(r.id, r); });
        
        let result = Array.from(uniqueMap.values()) as RecordFile[];

        // Filter for TEAM_LEADER by managed wards in professional/measurement tab
        const isMeasurementViewTab = [
            'all_records', 'assign_tasks', 'completed_list', 
            'pending_check_list', 'check_list', 'handover_list', 'director_completed'
        ].includes(currentView);

        if (currentUser && currentUser.role === UserRole.TEAM_LEADER && isMeasurementViewTab) {
            const leaderEmp = employees.find(e => e.id === currentUser.employeeId);
            if (leaderEmp && leaderEmp.managedWards && leaderEmp.managedWards.length > 0) {
                result = result.filter(r => {
                    const isMyTask = r.assignedTo === currentUser.employeeId;
                    const isMyWard = leaderEmp.managedWards.some((w: string) => r.ward && r.ward.includes(w));
                    return isMyTask || isMyWard;
                });
            }
        }

        // View-based filtering
        if (currentView === 'check_list' || currentView === 'other_check_list' || currentView === 'archive_check_list') {
            if (isDirector) {
                // Giám đốc chỉ thấy hồ sơ trình cho mình
                result = result.filter(r => r.status === RecordStatus.PENDING_SIGN && r.submittedTo === currentUser?.employeeId);
            } else {
                result = result.filter(r => r.status === RecordStatus.PENDING_SIGN);
            }
        } else if (currentView === 'pending_check_list' || currentView === 'archive_pending_check_list') {
            // Tab Kiểm tra: Hiển thị hồ sơ Chờ kiểm tra và Đã kiểm tra
            result = result.filter(r => r.status === RecordStatus.PENDING_CHECK || r.status === RecordStatus.CHECKED);
        } else if (currentView === 'completed_list' || currentView === 'archive_completed_list') {
            result = result.filter(r => r.status === RecordStatus.ASSIGNED || r.status === RecordStatus.IN_PROGRESS || r.status === RecordStatus.COMPLETED_WORK);
        } else if (currentView === 'director_completed' || currentView === 'other_director_completed' || currentView === 'archive_director_completed') {
            result = result.filter(r => r.submittedTo === currentUser?.employeeId && r.status !== RecordStatus.PENDING_SIGN && r.status !== RecordStatus.RECEIVED && r.status !== RecordStatus.ASSIGNED && r.status !== RecordStatus.IN_PROGRESS && r.status !== RecordStatus.COMPLETED_WORK);
        } else if (currentView === 'handover_list' || currentView === 'other_handover_list' || currentView === 'archive_handover_list') {
            if (handoverTab === 'today') {
                // Tab chờ giao: Bao gồm Đã ký HOẶC (Đã rút VÀ chưa có đợt xuất) HOẶC Hồ sơ trả (REJECTED)
                result = result.filter(r => 
                    r.status === RecordStatus.SIGNED || 
                    ((r.status === RecordStatus.REJECTED || r.status === RecordStatus.WITHDRAWN) && !r.exportBatch)
                );
            } else if (handoverTab === 'returned') {
                // Tab Đã trả kết quả: Status = RETURNED
                result = result.filter(r => r.status === RecordStatus.RETURNED);
                
                // CẬP NHẬT: Lọc theo khoảng thời gian (Từ ngày - Đến ngày) thay vì 1 ngày
                if (filterFromDate || filterToDate) {
                    result = result.filter(r => {
                        if (!r.resultReturnedDate) return false;
                        const returnDate = r.resultReturnedDate;
                        if (filterFromDate && returnDate < filterFromDate) return false;
                        if (filterToDate && returnDate > filterToDate) return false;
                        return true;
                    });
                }
            } else {
                // Tab Lịch sử giao: Bao gồm Đã giao HOẶC (Đã rút VÀ đã có đợt xuất)
                result = result.filter(r => 
                    r.status === RecordStatus.HANDOVER || 
                    ((r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED) && r.exportBatch)
                );
                // Giữ nguyên logic lọc ngày đơn cho Lịch sử giao (theo đợt)
                if (filterDate) {
                    result = result.filter(r => {
                        const dateToCheck = r.exportDate || r.completedDate;
                        return dateToCheck?.startsWith(filterDate);
                    });
                }
            }
        } else if (currentView === 'assign_tasks' || currentView === 'other_assign_tasks' || currentView === 'archive_assign_tasks') {
            result = result.filter(r => r.status === RecordStatus.RECEIVED);
        }

        // Filter by recordType based on view group
        const isOtherView = ['other_records', 'other_assign_tasks', 'other_completed_list', 'other_pending_check_list', 'other_check_list', 'other_handover_list', 'registration_records'].includes(currentView);
        const isArchiveMeasurementView = ['archive_records', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'archive_director_completed'].includes(currentView);
        const isMeasurementView = ['all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'].includes(currentView);
        
        if (isArchiveMeasurementView) {
            result = result.filter(r => isArchiveRecordType(r.recordType));
            if (filterRecordType !== 'all') {
                result = result.filter(r => getShortRecordType(r.recordType) === filterRecordType);
            }
        } else if (isOtherView) {
            result = result.filter(r => {
                const shortType = getShortRecordType(r.recordType);
                if (isArchiveRecordType(r.recordType)) return false;
                if (shortType.startsWith('2.')) return false;
                return true;
            });
        } else if (isMeasurementView) {
            result = result.filter(r => {
                if (isArchiveRecordType(r.recordType)) return false;
                if (isCapGiayRecord(r)) return false;
                return true;
            });
            if (filterRecordType !== 'all') {
                result = result.filter(r => getShortRecordType(r.recordType) === filterRecordType || r.recordType === filterRecordType);
            }
        }

        // Search Term (Sử dụng searchTerm đã được tách theo view)
        if (searchTerm) {
            const lowerSearch = removeVietnameseTones(searchTerm);
            result = result.filter(r => {
                if (removeVietnameseTones(r.code).includes(lowerSearch)) return true;
                if (removeVietnameseTones(r.customerName).includes(lowerSearch)) return true;
                if (r.phoneNumber && r.phoneNumber.includes(searchTerm)) return true;
                if (removeVietnameseTones(r.ward || '').includes(lowerSearch)) return true;
                return false;
            });
        }

        // Ward, Status, Employee Filters
        if (filterWard !== 'all') {
            const wardSearch = removeVietnameseTones(filterWard);
            result = result.filter(r => {
                const targetWard = (currentView === 'handover_list' || currentView === 'other_handover_list' || currentView === 'archive_handover_list') ? (r.handoverWard || r.ward) : r.ward;
                return removeVietnameseTones(targetWard || '').includes(wardSearch);
            });
        }
        if (filterStatus !== 'all' && currentView !== 'handover_list' && currentView !== 'other_handover_list' && currentView !== 'archive_handover_list') {
            result = result.filter(r => r.status === filterStatus);
        }
        if (filterEmployee !== 'all' && currentView !== 'assign_tasks') {
            if (filterEmployee === 'unassigned') {
                result = result.filter(r => !r.assignedTo && !r.checkedBy);
            } else {
                const emp = employees.find(e => e.id === filterEmployee);
                const isLeader = emp && (
                    emp.position?.toLowerCase().includes('tổ') ||
                    emp.position?.toLowerCase().includes('nhóm') ||
                    emp.position?.toLowerCase().includes('trưởng') ||
                    emp.position?.toLowerCase().includes('phó')
                );
                if (isLeader) {
                    result = result.filter(r => r.assignedTo === filterEmployee || r.checkedBy === filterEmployee);
                } else {
                    result = result.filter(r => r.assignedTo === filterEmployee);
                }
            }
        }

        // Cap Giay Sub-step Filter (Chỉ áp dụng trong tab Đang thực hiện)
        if (currentView === 'other_completed_list') {
            const activeSubStep = (capGiaySubStepFilter === 'all' || !capGiaySubStepFilter) ? 'tham_dinh' : capGiaySubStepFilter;
            result = result.filter(r => {
                const currentSubStep = r.capGiaySubStep || 'tham_dinh';
                return currentSubStep === activeSubStep;
            });
        }

        // Date Filters (General for other views)
        if (currentView !== 'handover_list' && currentView !== 'other_handover_list' && currentView !== 'archive_handover_list') {
            if (filterSpecificDate) {
                result = result.filter(r => r.receivedDate && r.receivedDate.startsWith(filterSpecificDate));
            } else if (filterFromDate || filterToDate) {
                result = result.filter(r => {
                    if (!r.receivedDate) return false;
                    const rDateOnly = r.receivedDate.split('T')[0];
                    if (filterFromDate && rDateOnly < filterFromDate) return false;
                    if (filterToDate && rDateOnly > filterToDate) return false;
                    return true;
                });
            }
            
            if (filterAssignedFromDate || filterAssignedToDate) {
                result = result.filter(r => {
                    if (!r.assignedDate) return false;
                    const aDateOnly = r.assignedDate.split('T')[0];
                    if (filterAssignedFromDate && aDateOnly < filterAssignedFromDate) return false;
                    if (filterAssignedToDate && aDateOnly > filterAssignedToDate) return false;
                    return true;
                });
            } else if (filterAssignedDate) {
                result = result.filter(r => r.assignedDate && r.assignedDate.startsWith(filterAssignedDate));
            }
        }

        // Warning Filters
        if (warningFilter !== 'none' && currentUser) {
            if (warningFilter === 'overdue') {
                result = result.filter(r => isRecordOverdue(r) && checkWarningPermission(r));
            } else if (warningFilter === 'approaching') {
                result = result.filter(r => isRecordApproaching(r) && checkWarningPermission(r));
            }
        }

        // Sorting
        result.sort((a, b) => {
            let aVal: any = a[sortConfig.key as keyof RecordFile];
            let bVal: any = b[sortConfig.key as keyof RecordFile];
            if (!aVal) return 1; if (!bVal) return -1;
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [records, searchTerm, filterWard, filterRecordType, filterStatus, filterEmployee, capGiaySubStepFilter, filterDate, filterSpecificDate, filterAssignedDate, filterFromDate, filterToDate, showAdvancedDateFilter, warningFilter, currentView, sortConfig, handoverTab, currentUser, employees]);

    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredRecords.slice(start, start + itemsPerPage);
    }, [filteredRecords, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

    // Warning Counts
    const warningCount = useMemo(() => {
        let overdue = 0;
        let approaching = 0;
        if (records.length > 0 && currentUser) {
            const isOtherView = ['other_records', 'other_assign_tasks', 'other_check_list', 'other_handover_list', 'other_director_completed'].includes(currentView);
            const isArchiveMeasurementView = ['archive_records', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'archive_director_completed'].includes(currentView);
            const isMeasurementView = ['all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'].includes(currentView);

            records.forEach(r => {
                if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN) return; 
                if (!checkWarningPermission(r)) return; 
                
                // Filter by recordType based on view group
                if (isArchiveMeasurementView && !isArchiveRecordType(r.recordType)) return;
                if (isMeasurementView && isArchiveRecordType(r.recordType)) return;

                if (isRecordOverdue(r)) overdue++;
                else if (isRecordApproaching(r)) approaching++;
            });
        }
        return { overdue, approaching };
    }, [records, currentUser, employees, currentView]);

    return {
        filteredRecords, paginatedRecords, totalPages, warningCount,
        searchTerm, setSearchTerm,
        filterDate, setFilterDate,
        filterSpecificDate, setFilterSpecificDate,
        filterAssignedDate, setFilterAssignedDate,
        filterFromDate, setFilterFromDate,
        filterToDate, setFilterToDate,
        filterAssignedFromDate, setFilterAssignedFromDate,
        filterAssignedToDate, setFilterAssignedToDate,
        showAdvancedDateFilter, setShowAdvancedDateFilter,
        filterWard, setFilterWard,
        filterRecordType, setFilterRecordType,
        filterStatus, setFilterStatus,
        filterEmployee, setFilterEmployee,
        capGiaySubStepFilter, setCapGiaySubStepFilter,
        warningFilter, setWarningFilter,
        handoverTab, setHandoverTab,
        sortConfig, setSortConfig,
        currentPage, setCurrentPage,
        itemsPerPage, setItemsPerPage
    };
};
