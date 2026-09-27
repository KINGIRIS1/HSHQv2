import { RecordFile, Contract } from '../types';
import { removeVietnameseTones } from './appHelpers';

const normalizeStr = (str: string | null | undefined): string => {
  if (!str) return '';
  return removeVietnameseTones(str).trim().toLowerCase();
};

const normalizeDigits = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.replace(/\D/g, '');
};

/**
 * Tìm kiếm hợp đồng tương ứng với hồ sơ dựa trên:
 * 1. Mã hồ sơ / Mã hợp đồng (chính xác hoặc lưu trong customerAddress)
 * 2. Số tờ, số thửa, xã/phường
 * 3. Tên người nộp / khách hàng + Số điện thoại / Địa bàn
 */
export function findMatchingContract(
  record: Partial<RecordFile> | null | undefined,
  contracts: Contract[] | null | undefined
): Contract | null {
  if (!record || !contracts || contracts.length === 0) {
    return null;
  }

  const recCode = normalizeStr(record.code);
  const recCustomer = normalizeStr(record.customerName);
  const recPhone = normalizeDigits(record.phoneNumber);
  const recWard = normalizeStr(record.ward);
  const recPlot = normalizeStr(record.landPlot);
  const recSheet = normalizeStr(record.mapSheet);

  // 1. Khớp tuyệt đối theo mã hồ sơ / mã hợp đồng
  if (recCode) {
    const codeMatch = contracts.find(c => {
      const cCode = normalizeStr(c.code);
      const cCustAddr = normalizeStr(c.customerAddress);
      return (
        cCode === recCode ||
        cCustAddr === recCode ||
        (cCode.length > 3 && recCode.length > 3 && (cCode.includes(recCode) || recCode.includes(cCode)))
      );
    });
    if (codeMatch) return codeMatch;
  }

  // 2. Khớp theo Số thửa + Tờ bản đồ (+ Phường/Xã nếu có)
  if (recPlot && recSheet) {
    const plotSheetMatch = contracts.find(c => {
      const cPlot = normalizeStr(c.landPlot);
      const cSheet = normalizeStr(c.mapSheet);
      const cWard = normalizeStr(c.ward);

      const isSamePlotSheet = cPlot === recPlot && cSheet === recSheet;
      const isSameWard = !recWard || !cWard || cWard === recWard || cWard.includes(recWard) || recWard.includes(cWard);

      if (isSamePlotSheet && isSameWard) {
        return true;
      }

      // Kiểm tra trong danh sách tách thửa (splitItems) nếu có
      if (Array.isArray(c.splitItems) && c.splitItems.length > 0) {
        const hasSplitMatch = c.splitItems.some(item => {
          const itemPlot = normalizeStr(item.landPlot);
          const itemSheet = normalizeStr(item.mapSheet);
          return itemPlot === recPlot && itemSheet === recSheet;
        });
        if (hasSplitMatch && isSameWard) return true;
      }

      return false;
    });
    if (plotSheetMatch) return plotSheetMatch;
  }

  // 3. Khớp theo Tên khách hàng + SĐT hoặc Địa bàn
  if (recCustomer) {
    const nameMatches = contracts.filter(c => {
      const cCust = normalizeStr(c.customerName);
      return cCust === recCustomer || (cCust.length > 5 && recCustomer.length > 5 && (cCust.includes(recCustomer) || recCustomer.includes(cCust)));
    });

    if (nameMatches.length === 1) {
      return nameMatches[0];
    }

    if (nameMatches.length > 1) {
      // Ưu tiên trùng SĐT
      if (recPhone) {
        const phoneMatch = nameMatches.find(c => {
          const cPhone = normalizeDigits(c.phoneNumber);
          return cPhone && (cPhone === recPhone || cPhone.endsWith(recPhone) || recPhone.endsWith(cPhone));
        });
        if (phoneMatch) return phoneMatch;
      }

      // Ưu tiên trùng xã/phường
      if (recWard) {
        const wardMatch = nameMatches.find(c => {
          const cWard = normalizeStr(c.ward);
          return cWard && (cWard === recWard || cWard.includes(recWard) || recWard.includes(cWard));
        });
        if (wardMatch) return wardMatch;
      }

      return nameMatches[0];
    }
  }

  return null;
}
