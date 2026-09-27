import { RecordFile, Contract } from '../types';

/**
 * Chuẩn hóa chuỗi bằng cách xóa dấu tiếng Việt, loại bỏ khoảng trắng thừa và ký tự đặc biệt.
 */
export const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Xóa dấu
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9]/g, '') // Chỉ giữ lại chữ và số
    .trim();
};

/**
 * Khớp nối một Hồ sơ tiếp nhận với Hợp đồng đo đạc:
 * 1. Khớp chính xác theo mã hồ sơ / mã hợp đồng
 * 2. Khớp theo Số tờ, Số thửa, Xã/Phường và Tên khách hàng (Độ tin cậy cao)
 * 3. Khớp theo Tên khách hàng và Xã/Phường (Độ tin cậy vừa)
 */
export const findMatchingContract = (record: RecordFile | null, contracts: Contract[]): Contract | null => {
  if (!record || !contracts || contracts.length === 0) return null;

  const recordCode = (record.code || '').trim().toUpperCase();
  const recordNameNorm = normalizeString(record.customerName);
  const recordWardNorm = normalizeString(record.ward);
  const recordPlot = (record.landPlot || '').trim();
  const recordSheet = (record.mapSheet || '').trim();

  // 1. Khớp theo mã hồ sơ / mã hợp đồng
  if (recordCode) {
    const matchByCode = contracts.find(c => {
      const contractCode = (c.code || '').trim().toUpperCase();
      return contractCode && contractCode === recordCode;
    });
    if (matchByCode) return matchByCode;
  }

  // 2. Khớp theo Số thửa + Số tờ + Xã/Phường + Tên khách hàng (Độ tin cậy cao)
  if (recordNameNorm && recordPlot && recordSheet) {
    const matchByPlotSheetName = contracts.find(c => {
      const cPlot = (c.landPlot || '').trim();
      const cSheet = (c.mapSheet || '').trim();
      const cWardNorm = normalizeString(c.ward);
      const cNameNorm = normalizeString(c.customerName);

      return (
        cPlot === recordPlot &&
        cSheet === recordSheet &&
        (cWardNorm === recordWardNorm || !cWardNorm || !recordWardNorm) &&
        (cNameNorm.includes(recordNameNorm) || recordNameNorm.includes(cNameNorm))
      );
    });
    if (matchByPlotSheetName) return matchByPlotSheetName;
  }

  // 3. Khớp theo Tên khách hàng + Xã/Phường
  if (recordNameNorm) {
    const matchesByName = contracts.filter(c => {
      const cNameNorm = normalizeString(c.customerName);
      const cWardNorm = normalizeString(c.ward);
      
      const nameMatches = cNameNorm && (cNameNorm.includes(recordNameNorm) || recordNameNorm.includes(cNameNorm));
      const wardMatches = !cWardNorm || !recordWardNorm || cWardNorm === recordWardNorm;
      
      return nameMatches && wardMatches;
    });

    if (matchesByName.length === 1) {
      return matchesByName[0];
    } else if (matchesByName.length > 1) {
      // Ưu tiên trùng số điện thoại
      const preferByPhone = matchesByName.find(c => {
        const cPhone = (c.phoneNumber || '').trim().replace(/[^0-9]/g, '');
        const rPhone = (record.phoneNumber || '').trim().replace(/[^0-9]/g, '');
        return cPhone && rPhone && cPhone === rPhone;
      });
      if (preferByPhone) return preferByPhone;

      // Hoặc trùng số thửa
      const preferByPlot = matchesByName.find(c => {
        const cPlot = (c.landPlot || '').trim();
        return cPlot && recordPlot && cPlot === recordPlot;
      });
      if (preferByPlot) return preferByPlot;

      return matchesByName[0];
    }
  }

  return null;
};
