import { Contract } from '../types';

export interface ContractDateCheckResult {
  hasError: boolean;
  hasWarning: boolean;
  isFutureDate: boolean;
  isPastDate: boolean;
  isLogicError: boolean;
  messages: string[];
}

/**
 * Lấy chuỗi ngày hiện tại dạng YYYY-MM-DD theo giờ địa phương
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Kiếm tra tính hợp lệ của ngày lập hợp đồng & ngày thanh lý so với ngày hiện tại
 */
export function checkContractDateErrors(
  contract: Partial<Contract>,
  mode: 'contract' | 'liquidation' = 'contract'
): ContractDateCheckResult {
  const messages: string[] = [];
  let isFutureDate = false;
  let isPastDate = false;
  let isLogicError = false;

  const todayStr = getTodayDateString();

  // Helper định dạng ngày Việt Nam DD/MM/YYYY
  const formatVN = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = cleanStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  // 1. Kiểm tra Ngày lập hợp đồng (createdDate)
  if (!contract.createdDate) {
    messages.push('Thiếu thông tin ngày lập hợp đồng.');
    isLogicError = true;
  } else {
    const cDateClean = contract.createdDate.includes('T')
      ? contract.createdDate.split('T')[0]
      : contract.createdDate;

    // Đối chiếu với ngày hiện tại
    if (cDateClean > todayStr) {
      isFutureDate = true;
      messages.push(
        `Ngày lập HĐ (${formatVN(cDateClean)}) vượt quá ngày hiện tại (${formatVN(todayStr)}).`
      );
    } else if (cDateClean < todayStr) {
      isPastDate = true;
      messages.push(
        `Ngày lập HĐ (${formatVN(cDateClean)}) xảy ra trước ngày hiện tại (${formatVN(todayStr)}).`
      );
    }
  }

  // 2. Kiểm tra Ngày thanh lý hợp đồng (liquidationDate)
  const liqDateClean = contract.liquidationDate
    ? contract.liquidationDate.includes('T')
      ? contract.liquidationDate.split('T')[0]
      : contract.liquidationDate
    : null;

  if (mode === 'liquidation' || contract.status === 'COMPLETED' || liqDateClean) {
    if (!liqDateClean && mode === 'liquidation') {
      messages.push('Chưa nhập ngày thanh lý hợp đồng.');
      isLogicError = true;
    } else if (liqDateClean) {
      if (liqDateClean > todayStr) {
        isFutureDate = true;
        messages.push(
          `Ngày thanh lý (${formatVN(liqDateClean)}) vượt quá ngày hiện tại (${formatVN(todayStr)}).`
        );
      } else if (liqDateClean < todayStr) {
        isPastDate = true;
        messages.push(
          `Ngày thanh lý (${formatVN(liqDateClean)}) xảy ra trước ngày hiện tại (${formatVN(todayStr)}).`
        );
      }

      // Kiểm tra logic: Ngày thanh lý phải sau hoặc bằng ngày lập hợp đồng
      if (contract.createdDate) {
        const cDateClean = contract.createdDate.includes('T')
          ? contract.createdDate.split('T')[0]
          : contract.createdDate;
        if (liqDateClean < cDateClean) {
          isLogicError = true;
          messages.push(
            `Ngày thanh lý (${formatVN(liqDateClean)}) xảy ra TRƯỚC ngày lập HĐ (${formatVN(cDateClean)}).`
          );
        }
      }
    }
  }

  const hasError = isFutureDate || isLogicError;
  const hasWarning = isPastDate;

  return {
    hasError,
    hasWarning,
    isFutureDate,
    isPastDate,
    isLogicError,
    messages
  };
}
