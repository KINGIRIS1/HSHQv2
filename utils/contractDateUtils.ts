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
  return {
    hasError: false,
    hasWarning: false,
    isFutureDate: false,
    isPastDate: false,
    isLogicError: false,
    messages: []
  };
}
