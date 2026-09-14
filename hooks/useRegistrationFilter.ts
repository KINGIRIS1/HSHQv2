import { useState, useMemo } from 'react';
import { RecordFile, RecordStatus } from '../types';

export interface UseRegistrationFilterProps {
  records: RecordFile[];
}

export const useRegistrationFilter = ({ records }: UseRegistrationFilterProps) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedAssignedTo, setSelectedAssignedTo] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);

  // Danh sách các năm có trong dữ liệu
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    records.forEach((r) => {
      const dateStr = r.receivedDate || '';
      if (dateStr && dateStr.length >= 4) {
        const y = dateStr.substring(0, 4);
        if (!isNaN(Number(y))) {
          years.add(y);
        }
      }
    });
    return Array.from(years).sort().reverse();
  }, [records]);

  // Danh sách các xã/phường có trong dữ liệu
  const availableWards = useMemo(() => {
    const wards = new Set<string>();
    records.forEach((r) => {
      if (r.ward) wards.add(r.ward.trim());
    });
    return Array.from(wards).sort();
  }, [records]);

  // Danh sách cán bộ được phân công
  const availableAssignees = useMemo(() => {
    const assignees = new Set<string>();
    records.forEach((r) => {
      if (r.assignedTo) assignees.add(r.assignedTo.trim());
    });
    return Array.from(assignees).sort();
  }, [records]);

  // Bộ lọc dữ liệu theo Sub-Tab nghiệp vụ
  const subTabFilteredRecords = useMemo(() => {
    if (activeSubTab === 'all') return records;

    switch (activeSubTab) {
      case 'unassigned':
        return records.filter((r) => !r.assignedTo || r.status === RecordStatus.RECEIVED);
      case 'processing':
        return records.filter((r) => r.status === RecordStatus.IN_PROGRESS || r.status === RecordStatus.ASSIGNED);
      case 'pending_check':
        return records.filter((r) => r.status === RecordStatus.PENDING_CHECK);
      case 'pending_sign':
        return records.filter((r) => r.status === RecordStatus.PENDING_SIGN);
      case 'signed':
        return records.filter((r) => r.status === RecordStatus.SIGNED);
      case 'handed_over':
        return records.filter((r) => r.isHandedOver || r.status === RecordStatus.HANDOVER);
      case 'returned':
        return records.filter((r) => r.status === RecordStatus.RETURNED);
      case 'overdue': {
        const today = new Date().toISOString().substring(0, 10);
        return records.filter(
          (r) =>
            r.deadline &&
            r.deadline < today &&
            r.status !== RecordStatus.RETURNED &&
            r.status !== RecordStatus.HANDOVER
        );
      }
      default:
        return records;
    }
  }, [records, activeSubTab]);

  // Bộ lọc tổng hợp (Search, Ward, Status, Assignee, Year, Dates)
  const filteredRecords = useMemo(() => {
    return subTabFilteredRecords.filter((record) => {
      // 1. Tìm kiếm chuỗi
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase().trim();
        const matchesCode = record.code?.toLowerCase().includes(searchLower);
        const matchesCustomer = record.customerName?.toLowerCase().includes(searchLower);
        const matchesPhone = record.phoneNumber?.includes(searchLower);
        const matchesCccd = record.cccd?.includes(searchLower);
        const matchesPlot = record.landPlot?.toLowerCase().includes(searchLower);
        const matchesMap = record.mapSheet?.toLowerCase().includes(searchLower);
        const matchesAddress = record.address?.toLowerCase().includes(searchLower);
        const matchesContent = record.content?.toLowerCase().includes(searchLower);
        const matchesNotes = record.notes?.toLowerCase().includes(searchLower);

        if (
          !matchesCode &&
          !matchesCustomer &&
          !matchesPhone &&
          !matchesCccd &&
          !matchesPlot &&
          !matchesMap &&
          !matchesAddress &&
          !matchesContent &&
          !matchesNotes
        ) {
          return false;
        }
      }

      // 2. Xã / Phường
      if (selectedWard !== 'all' && record.ward !== selectedWard) {
        return false;
      }

      // 3. Trạng thái
      if (selectedStatus !== 'all' && record.status !== selectedStatus) {
        return false;
      }

      // 4. Cán bộ thụ lý
      if (selectedAssignedTo !== 'all' && record.assignedTo !== selectedAssignedTo) {
        return false;
      }

      // 5. Năm tiếp nhận
      if (selectedYear !== 'all') {
        const dateStr = record.receivedDate;
        if (!dateStr || !dateStr.startsWith(selectedYear)) {
          return false;
        }
      }

      // 6. Khoảng ngày tiếp nhận
      if (startDate) {
        const recDate = record.receivedDate;
        if (!recDate || recDate < startDate) return false;
      }
      if (endDate) {
        const recDate = record.receivedDate;
        if (!recDate || recDate > endDate) return false;
      }

      return true;
    });
  }, [
    subTabFilteredRecords,
    searchTerm,
    selectedWard,
    selectedStatus,
    selectedAssignedTo,
    selectedYear,
    startDate,
    endDate,
  ]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedWard('all');
    setSelectedStatus('all');
    setSelectedAssignedTo('all');
    setSelectedGroup('all');
    setSelectedYear('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  return {
    searchTerm,
    setSearchTerm,
    selectedWard,
    setSelectedWard,
    selectedStatus,
    setSelectedStatus,
    selectedAssignedTo,
    setSelectedAssignedTo,
    selectedGroup,
    setSelectedGroup,
    selectedYear,
    setSelectedYear,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    activeSubTab,
    setActiveSubTab: (tab: string) => {
      setActiveSubTab(tab);
      setCurrentPage(1);
    },
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    filteredRecords,
    paginatedRecords,
    availableYears,
    availableWards,
    availableAssignees,
    resetFilters,
  };
};
