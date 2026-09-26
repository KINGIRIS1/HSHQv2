import { Contract, RecordFile } from '../types';
import { removeVietnameseTones } from './appHelpers';

/**
 * Bóc tách tiền tố xã/phường dùng gạch nối (-) hoặc dấu chấm (.) (ví dụ: TK-, TQ-, MD-, TH-, TT-, MH-, CT-, TBA-, TQU- v.v.)
 * và làm sạch chuỗi mã để đưa về Mã Cốt Lõi (Core Code).
 */
export const extractCoreCode = (rawStr: string | null | undefined): string => {
  if (!rawStr) return '';
  let str = String(rawStr).trim().toUpperCase();
  if (!str) return '';

  // Loại bỏ các tiền tố chữ ở đầu mã phân tách bởi dấu gạch nối (-), dấu chấm (.), gạch dưới (_), gạch chéo (/), hoặc khoảng trắng
  // Ví dụ: TK-260905-6159 => 260905-6159, TH-2.2.001 => 2.2.001
  str = str.replace(/^(TK|TQ|MD|TH|TT|MH|CT|TBA|TQU|[A-Z]{1,5})[._\-\s/]+/i, '');

  // Chỉ giữ lại chữ cái và chữ số để so khớp tuyệt đối
  return str.replace(/[^a-z0-9]/gi, '').toLowerCase();
};

/**
 * Kiểm tra xem 2 chuỗi mã có tương đương nhau sau khi bóc tách tiền tố xã hay không
 */
export const isCoreCodeMatching = (code1: string | null | undefined, code2: string | null | undefined): boolean => {
  if (!code1 || !code2) return false;
  const s1 = String(code1).trim().toLowerCase();
  const s2 = String(code2).trim().toLowerCase();

  // 1. So khớp chính xác 100%
  if (s1 === s2) return true;

  const core1 = extractCoreCode(code1);
  const core2 = extractCoreCode(code2);

  if (!core1 || !core2) return false;

  // 2. So khớp mã cốt lõi sau khi lọc tiền tố (ví dụ: TK.260905-6159 vs 260905-6159)
  if (core1 === core2) return true;

  // 3. Nếu một trong hai mã cốt lõi chứa trọn vẹn mã kia (độ dài >= 4 ký tự)
  if (core1.length >= 4 && core2.length >= 4) {
    if (core1.endsWith(core2) || core2.endsWith(core1)) return true;
    if (core1.includes(core2) || core2.includes(core1)) return true;
  }

  return false;
};

/**
 * Tìm Hợp đồng tương ứng với Hồ sơ Đo đạc dựa trên các tầng ưu tiên
 */
export const findMatchingContract = (record: RecordFile | null | undefined, contracts: Contract[]): Contract | null => {
  if (!record || !contracts || !Array.isArray(contracts) || contracts.length === 0) return null;

  const d = (typeof record.data === 'object' && record.data !== null) ? record.data : {};
  const savedContractCode = d.contractCode || (record as any).contractCode;
  const savedContractId = d.contractId || (record as any).contractId;

  // Tầng 1: Khớp qua ID hoặc Mã Hợp đồng lưu trực tiếp
  if (savedContractCode) {
    const match = contracts.find(c => c && isCoreCodeMatching(c.code, savedContractCode));
    if (match) return match;
  }
  if (savedContractId) {
    const match = contracts.find(c => c && String(c.id) === String(savedContractId));
    if (match) return match;
  }

  const rCode = (record.code || '').trim();
  const rName = removeVietnameseTones((record.customerName || '').trim());
  const rPlot = (record.landPlot || '').trim().toLowerCase();
  const rMap = (record.mapSheet || '').trim().toLowerCase();

  // Tầng 2: Khớp theo Mã hồ sơ (Đã bóc tách tiền tố xã TK., TQ., MD., TH... hoặc lưu trong customerAddress)
  if (rCode) {
    const matchByCode = contracts.find(c => {
      if (!c) return false;
      const cAddr = (c.customerAddress || '').trim();
      const cCode = (c.code || '').trim();

      if (cAddr && isCoreCodeMatching(cAddr, rCode)) return true;
      if (cCode && isCoreCodeMatching(cCode, rCode)) return true;
      return false;
    });
    if (matchByCode) return matchByCode;
  }

  // Tầng 3: Khớp theo Tên khách hàng (chuẩn hóa không dấu) + Thửa / Tờ
  if (rName) {
    const matchByNamePlotMap = contracts.find(c => {
      if (!c) return false;
      const cName = removeVietnameseTones((c.customerName || (c as any).customer_name || '').trim());
      const cPlot = (c.landPlot || '').trim().toLowerCase();
      const cMap = (c.mapSheet || '').trim().toLowerCase();

      if (cName && rName === cName) {
        if (rPlot && cPlot && rPlot === cPlot) return true;
        if (rMap && cMap && rMap === cMap) return true;
        if (!rPlot && !rMap && !cPlot && !cMap) return true; // Cùng tên và cả 2 đều không có thửa/tờ
      }
      return false;
    });
    if (matchByNamePlotMap) return matchByNamePlotMap;
  }

  return null;
};
