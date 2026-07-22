
import React, { useState, useEffect, useRef } from 'react';
import { Contract, PriceItem, SplitItem, RecordFile } from '../../types';
import { Save, Calculator, Search, Plus, Trash2, Printer, FileCheck, CheckCircle, AlertCircle, X, RotateCcw, MapPin, Ruler, Grid, Banknote, User, FileText, Calendar, Wand2, ChevronDown, ChevronUp, Copy, ExternalLink } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';

interface ContractFormProps {
  initialData?: Contract;
  onSave: (contract: Contract, isUpdate: boolean) => Promise<string | null>;
  onPrint: (data: Partial<Contract>, type: 'contract' | 'liquidation') => void;
  priceList: PriceItem[];
  wards: string[];
  records: RecordFile[];
  generateCode: (contractType?: string) => Promise<string>;
  mode: 'contract' | 'liquidation'; // New prop
  contracts?: Contract[];
}

function _nd(s: string | undefined | null): string {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

const ContractForm: React.FC<ContractFormProps> = ({ initialData, onSave, onPrint, priceList, wards, records, generateCode, mode, contracts }) => {
  const [activeTab, setActiveTab] = useState<'dd' | 'tt' | 'cm' | 'tl'>('dd');
  const [tachThuaItems, setTachThuaItems] = useState<SplitItem[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

  // States for Quick Import (Đo đạc nhiều thửa)
  const [doDacItems, setDoDacItems] = useState<SplitItem[]>([]);
  const lastAutoUpdatedAreaRef = useRef<number | null>(null);
  const lastAutoUpdatedAreaTypeRef = useRef<string | null>(null);

  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [formData, setFormData] = useState<Partial<Contract>>({
    code: '', customerName: '', phoneNumber: '', address: '', ward: '', landPlot: '', mapSheet: '', area: 0,
    contractType: 'Đo đạc', serviceType: '', areaType: '', plotCount: 1, markerCount: 1, quantity: 1, 
    unitPrice: 0, vatRate: 8, vatAmount: 0, totalAmount: 0, deposit: 0, content: '',
    createdDate: todayStr, status: 'PENDING',
    liquidationArea: 0, liquidationAmount: 0 // Init
  });

  useEffect(() => {
      if (initialData) {
          // Update Form Data
          setFormData(prev => ({
              ...initialData,
              // Logic fallback: Nếu vào chế độ Thanh lý và chưa có dữ liệu thanh lý, lấy dữ liệu hợp đồng
              liquidationArea: (mode === 'liquidation' && !initialData.liquidationArea) ? initialData.area : initialData.liquidationArea,
              liquidationAmount: (mode === 'liquidation' && !initialData.liquidationAmount) ? initialData.totalAmount : initialData.liquidationAmount
          }));
          
          // Update Split Items (Chi tiết tính phí/Tách thửa/Đo đạc nhiều thửa)
          if (initialData.splitItems && initialData.splitItems.length > 0) {
              if (initialData.contractType === 'Đo đạc') {
                  setDoDacItems(initialData.splitItems);
                  setTachThuaItems([]);
              } else {
                  setTachThuaItems(initialData.splitItems);
                  setDoDacItems([]);
              }
          } else {
              setTachThuaItems([]);
              setDoDacItems([]);
          }

          // Update Active Tab based on Contract Type
          if (initialData.contractType === 'Tách thửa') setActiveTab('tt');
          else if (initialData.contractType === 'Cắm mốc') setActiveTab('cm');
          else if (initialData.contractType === 'Trích lục') setActiveTab('tl');
          else setActiveTab('dd');
          
          // Kiểm tra xem hồ sơ này đã có hợp đồng hay chưa
          if (mode === 'contract' && initialData.customerAddress && contracts) {
              const duplicateContract = contracts.find(c => 
                  c.customerAddress && 
                  c.customerAddress.trim().toLowerCase() === initialData.customerAddress?.trim().toLowerCase() && 
                  c.id !== initialData.id
              );
              if (duplicateContract) {
                  setNotification({
                      type: 'error',
                      message: `CẢNH BÁO: Hồ sơ ${initialData.customerAddress} đã có hợp đồng trước đó với Số Hợp Đồng: ${duplicateContract.code}! Tránh lập trùng 1 bộ hồ sơ 2 số hợp đồng.`
                  });
              } else {
                  setNotification(null);
              }
          } else {
              setNotification(null);
          }
      } else {
          const fetchCode = async () => {
              const code = await generateCode('Đo đạc');
              setFormData(prev => ({ ...prev, code }));
          };
          fetchCode();
          setTachThuaItems([]);
          setDoDacItems([]);
      }
  }, [initialData, mode, contracts]); 

  // Scroll to notification
  useEffect(() => {
      if (notification && topRef.current) {
          topRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (notification.type === 'success') {
              const timer = setTimeout(() => setNotification(null), 5000);
              return () => clearTimeout(timer);
          }
      }
  }, [notification]);

  // Tab change logic
  useEffect(() => {
      const typeMap: Record<string, any> = { 'dd': 'Đo đạc', 'tt': 'Tách thửa', 'cm': 'Cắm mốc', 'tl': 'Trích lục' };
      const currentType = typeMap[activeTab];
      setFormData(prev => {
          if (prev.contractType === currentType) return prev;
          return { ...prev, contractType: currentType };
      });
      if (activeTab === 'tt' && tachThuaItems.length === 0) setTachThuaItems([{ serviceName: '', quantity: 1, price: 0, area: undefined }]); // Initialize area as undefined

      if (!initialData) {
          const fetchCode = async () => {
              const code = await generateCode(currentType);
              setFormData(prev => {
                  if (prev.code === code) return prev;
                  return { ...prev, code };
              });
          };
          fetchCode();
      }
  }, [activeTab, initialData]);

  // Init Liquidation Data if missing (Fallback logic)
  useEffect(() => {
      if (mode === 'liquidation') {
          // Khi vào mode liquidation, nếu chưa có diện tích thanh lý thì lấy diện tích hợp đồng
          setFormData(prev => {
              const targetVal = prev.liquidationArea || prev.area;
              if (prev.liquidationArea === targetVal) return prev;
              return { 
                  ...prev, 
                  liquidationArea: targetVal
              };
          });
      }
  }, [mode]);

  // Helper tìm giá động theo AreaType hiện tại
  const getDynamicPrice = (serviceName: string) => {
      const currentAreaType = formData.areaType;
      const matchedRow = priceList.find(row => 
          _nd(row.serviceName) === _nd(serviceName) && 
          (!row.areaType || !currentAreaType || _nd(row.areaType) === _nd(currentAreaType))
      );
      
      if (matchedRow && matchedRow.price > 0) return matchedRow.price;
      if (_nd(serviceName).includes('trich luc')) return 49225;

      return 0;
  };



  // Tự động cập nhật Khu vực theo Xã/Phường
  useEffect(() => {
      if (formData.ward) {
          const wardNorm = _nd(formData.ward);
          const isUrban = wardNorm.includes('tan khai') || 
                          wardNorm.includes('minh hung') || 
                          wardNorm.includes('minh thanh') || 
                          wardNorm.includes('hung long') || 
                          wardNorm.includes('thanh tam') || 
                          wardNorm.includes('phuong') || 
                          wardNorm.includes('thi tran') || 
                          wardNorm.includes('tt.') ||
                          wardNorm.includes('chon thanh');
          const newAreaType = isUrban ? 'Đất đô thị' : 'Đất nông thôn';
          setFormData(prev => {
              if (prev.areaType !== newAreaType) {
                  return { ...prev, areaType: newAreaType };
              }
              return prev;
          });
      }
  }, [formData.ward]);

  // Tự động cập nhật Loại dịch vụ (serviceType) theo diện tích thửa đất (formData.area)
  useEffect(() => {
      if (activeTab === 'dd' && formData.area && formData.area > 0) {
          const area = formData.area;
          const currentAreaType = formData.areaType || '';
          
          if (lastAutoUpdatedAreaRef.current !== area || lastAutoUpdatedAreaTypeRef.current !== currentAreaType) {
              lastAutoUpdatedAreaRef.current = area;
              lastAutoUpdatedAreaTypeRef.current = currentAreaType;

              // Lọc danh sách dịch vụ đo đạc phù hợp với diện tích và khu vực
              const matchedPriceItems = priceList.filter(row => {
                  const nameLower = _nd(row.serviceName);
                  const isMatchTab = !nameLower.includes('tach thua') && 
                                     !nameLower.includes('cam moc') && 
                                     !nameLower.includes('trich luc');
                  const isMatchArea = area >= row.minArea && area < row.maxArea;
                  const isMatchAreaType = !row.areaType || !currentAreaType || _nd(row.areaType) === _nd(currentAreaType);
                  return isMatchTab && isMatchArea && isMatchAreaType;
              });

              if (matchedPriceItems.length > 0) {
                  // Ưu tiên chọn dịch vụ có chứa chữ "chỉnh lý"
                  const preferredService = matchedPriceItems.find(row => {
                      const nameNorm = _nd(row.serviceName);
                      return nameNorm.includes('chinh ly') || nameNorm.includes('chinh ly ban do');
                  }) || matchedPriceItems[0];
                  
                  setFormData(prev => {
                      if (prev.serviceType === preferredService.serviceName) return prev;
                      return { ...prev, serviceType: preferredService.serviceName };
                  });
              }
          }
      }
  }, [formData.area, formData.areaType, activeTab, priceList]);



  // Price Calculation Logic
  useEffect(() => {
      // 1. Tự động xác định Khu vực
      let currentAreaType = formData.areaType;
      if (!currentAreaType && formData.ward) {
          const wardName = (formData.ward || '').toLowerCase();
          if (wardName.includes('phường') || wardName.includes('tt.') || wardName.includes('thị trấn') || wardName.includes('minh hưng') || wardName.includes('chơn thành')) {
              currentAreaType = 'Đất đô thị';
          } else {
              currentAreaType = 'Đất nông thôn';
          }
      }

      let calculatedTotal = 0;
      let calculatedUnitPrice = 0;
      let calculatedVatAmount = 0;
      const vatRate = 8; // Mặc định

      // 2. Logic Trích Lục
      if (activeTab === 'tl') {
          calculatedUnitPrice = 49225;
          const qty = formData.quantity || 1;
          const baseAmount = calculatedUnitPrice * qty;
          calculatedVatAmount = Math.round(baseAmount * (vatRate / 100));
          calculatedTotal = baseAmount + calculatedVatAmount;
          
          // Logic quan trọng:
          // Nếu mode = contract -> Cập nhật totalAmount
          // Nếu mode = liquidation -> Cập nhật liquidationAmount
          const updates: any = {
              serviceType: 'Trích lục bản đồ địa chính',
              unitPrice: calculatedUnitPrice,
              vatRate: vatRate,
              vatAmount: calculatedVatAmount,
              areaType: currentAreaType,
          };

          if (mode === 'liquidation') {
              updates.liquidationAmount = calculatedTotal;
          } else {
              updates.totalAmount = calculatedTotal;
          }
          
          setFormData(prev => {
              const hasChanged = Object.keys(updates).some(key => prev[key as keyof typeof prev] !== updates[key]);
              if (hasChanged) {
                  return { ...prev, ...updates };
              }
              return prev;
          });
          return;
      }

      // 3. Logic Tách thửa
      if (activeTab === 'tt') {
          let totalBase = 0;
          tachThuaItems.forEach(item => {
              const price = getDynamicPrice(item.serviceName);
              totalBase += (price * item.quantity);
          });
          
          calculatedVatAmount = Math.round(totalBase * (vatRate / 100));
          calculatedTotal = totalBase + calculatedVatAmount;

          const updates: any = {
              unitPrice: 0, 
              vatRate, 
              vatAmount: calculatedVatAmount, 
              areaType: currentAreaType,
          };

          if (mode === 'liquidation') {
              updates.liquidationAmount = calculatedTotal;
          } else {
              updates.totalAmount = calculatedTotal;
          }

          setFormData(prev => {
              const hasChanged = Object.keys(updates).some(key => prev[key as keyof typeof prev] !== updates[key]);
              if (hasChanged) {
                  return { ...prev, ...updates };
              }
              return prev;
          });
          return;
      }

      // 4. Logic Đo đạc & Cắm mốc
      if (activeTab === 'dd' && doDacItems.length > 0) {
          let totalBase = 0;
          doDacItems.forEach(item => {
              const price = getDynamicPrice(item.serviceName);
              totalBase += (price * (item.quantity || 1));
          });
          
          calculatedVatAmount = Math.round(totalBase * (vatRate / 100));
          calculatedTotal = totalBase + calculatedVatAmount;

          const updates: any = {
              unitPrice: 0, 
              vatRate: vatRate, 
              vatAmount: calculatedVatAmount, 
              areaType: currentAreaType,
          };

          if (mode === 'liquidation') {
              updates.liquidationAmount = calculatedTotal;
          } else {
              updates.totalAmount = calculatedTotal;
          }

          setFormData(prev => {
              const hasChanged = Object.keys(updates).some(key => prev[key as keyof typeof prev] !== updates[key]);
              if (hasChanged) {
                  return { ...prev, ...updates };
              }
              return prev;
          });
          return;
      }

      if (!formData.serviceType) return;
      calculatedUnitPrice = getDynamicPrice(formData.serviceType);
      
      const matchedItem = priceList.find(p => _nd(p.serviceName) === _nd(formData.serviceType));
      const vatIsPercent = matchedItem ? matchedItem.vatIsPercent : true;

      const qty = activeTab === 'cm' ? (formData.markerCount || 1) : (formData.plotCount || 1);
      const baseAmount = calculatedUnitPrice * qty;
      
      if (vatIsPercent) {
          calculatedVatAmount = Math.round(baseAmount * (vatRate / 100));
      } else {
          calculatedVatAmount = vatRate * qty;
      }
      
      calculatedTotal = baseAmount + calculatedVatAmount;

      const updates: any = {
          unitPrice: calculatedUnitPrice, 
          vatRate: vatRate, 
          vatAmount: calculatedVatAmount, 
          areaType: currentAreaType,
      };

      if (mode === 'liquidation') {
          updates.liquidationAmount = calculatedTotal;
      } else {
          updates.totalAmount = calculatedTotal;
      }

      setFormData(prev => {
          const hasChanged = Object.keys(updates).some(key => prev[key as keyof typeof prev] !== updates[key]);
          if (hasChanged) {
              return { ...prev, ...updates };
              }
          return prev;
      });
      
  }, [formData.area, formData.serviceType, formData.ward, formData.areaType, formData.plotCount, formData.markerCount, formData.quantity, tachThuaItems, doDacItems, activeTab, priceList, mode]);

  const handleSearchRecord = () => {
      const cleanSearch = searchCode.trim().toLowerCase();
      if (!cleanSearch) {
          setNotification({ type: 'error', message: 'Vui lòng nhập mã để tìm kiếm.' });
          return;
      }

      // 1. Chỉ tìm kiếm trong danh sách hợp đồng hệ thống khi ở chế độ THANH LÝ HỢP ĐỒNG (mode === 'liquidation')
      if (mode === 'liquidation') {
          const foundContract = contracts?.find(c => 
              (c.code && c.code.trim().toLowerCase() === cleanSearch) ||
              (c.customerAddress && c.customerAddress.trim().toLowerCase() === cleanSearch)
          );

          if (foundContract) {
              // Nạp dữ liệu hợp đồng đã lưu
              setFormData(prev => ({
                  ...prev,
                  ...foundContract,
                  // Đồng bộ diện tích & số tiền thanh lý dựa vào mode
                  liquidationArea: (mode === 'liquidation' && !foundContract.liquidationArea) ? foundContract.area : foundContract.liquidationArea,
                  liquidationAmount: (mode === 'liquidation' && !foundContract.liquidationAmount) ? foundContract.totalAmount : foundContract.liquidationAmount
              }));

              if (foundContract.splitItems && foundContract.splitItems.length > 0) {
                  setTachThuaItems(foundContract.splitItems);
              } else {
                  setTachThuaItems([]);
              }

              // Chọn tab dịch vụ phù hợp
              if (foundContract.contractType === 'Tách thửa') setActiveTab('tt');
              else if (foundContract.contractType === 'Cắm mốc') setActiveTab('cm');
              else if (foundContract.contractType === 'Trích lục') setActiveTab('tl');
              else setActiveTab('dd');

              setNotification({ 
                  type: 'success', 
                  message: `Đã tìm thấy & tải dữ liệu từ hợp đồng: ${foundContract.code}${foundContract.customerAddress ? ` (Hồ sơ gốc: ${foundContract.customerAddress})` : ''}` 
              });
              return;
          }
      }

      // 2. Không tìm thấy hợp đồng, tìm hồ sơ biên nhận gốc trong bảng records
      const found = records.find(r => r.code.toLowerCase() === cleanSearch);
      if (found) {
          let suggestedService = '';
          const recType = (found.recordType || '').toLowerCase();
          
          // Kiểm tra xem hồ sơ này đã có hợp đồng hay chưa
          const duplicateContract = contracts?.find(c => 
              c.customerAddress && 
              c.customerAddress.trim().toLowerCase() === found.code.trim().toLowerCase()
          );

          if (recType.includes('trích lục')) {
              setActiveTab('tl');
              const match = priceList.find(p => p.serviceName.toLowerCase().includes('trích lục'));
              suggestedService = match ? match.serviceName : 'Trích lục bản đồ địa chính';
          } else if (recType.includes('cắm mốc')) {
              setActiveTab('cm');
              const match = priceList.find(p => p.serviceName.toLowerCase().includes('cắm mốc'));
              suggestedService = match ? match.serviceName : 'Cắm mốc ranh giới';
          } else if (recType.includes('tách thửa')) {
              setActiveTab('tt');
              suggestedService = 'Đo đạc tách thửa';
          } else {
              setActiveTab('dd');
              const area = found.area || 0;
              const w = (found.ward || '').toLowerCase();
              const isUrban = w.includes('phường') || 
                              w.includes('tt.') || 
                              w.includes('thị trấn') || 
                              w.includes('chơn thành') ||
                              w.includes('tân khai') || 
                              w.includes('minh hưng') || 
                              w.includes('minh thành') || 
                              w.includes('hưng long') || 
                              w.includes('thành tâm');
              const currentAreaType = isUrban ? 'Đất đô thị' : 'Đất nông thôn';
              
              // Mặc định chọn dịch vụ có chứa chữ "chỉnh lý" (ví dụ Trích đo chỉnh lý bản đồ địa chính) khớp với diện tích
              let match = priceList.find(p => 
                  (p.serviceName.toLowerCase().includes('chỉnh lý') || p.serviceName.toLowerCase().includes('chinh ly')) &&
                  (!p.areaType || p.areaType === currentAreaType) &&
                  area >= p.minArea && area < p.maxArea
              );
              
              if (!match) {
                  match = priceList.find(p => 
                      p.serviceName.toLowerCase().includes('chỉnh lý') || p.serviceName.toLowerCase().includes('chinh ly')
                  );
              }
              
              suggestedService = match ? match.serviceName : 'Trích đo chỉnh lý bản đồ địa chính';
          }

          if (duplicateContract) {
              setNotification({
                  type: 'error',
                  message: `CẢNH BÁO: Hồ sơ ${found.code} đã có hợp đồng trước đó với Số Hợp Đồng: ${duplicateContract.code}! Tránh lập trùng 1 bộ hồ sơ 2 số hợp đồng.`
              });
          } else {
              setNotification(null);
          }

          setFormData(prev => ({ 
              ...prev, 
              customerAddress: found.code,
              customerName: found.customerName, 
              phoneNumber: found.phoneNumber, 
              ward: found.ward, 
              address: found.address || '', 
              landPlot: found.landPlot, 
              mapSheet: found.mapSheet, 
              area: found.area || 0,
              serviceType: suggestedService || prev.serviceType
              // TUYỆT ĐỐI không ghi đè code (Mã hợp đồng tự nhảy), giữ nguyên prev.code đang nạp sẵn trên form
          }));
          setNotification({ type: 'success', message: `Đã tải thông tin từ hồ sơ biên nhận: ${found.code}` });
      } else {
          setNotification({ 
              type: 'error', 
              message: mode === 'liquidation' 
                  ? 'Không tìm thấy thông tin hợp đồng hoặc hồ sơ biên nhận có mã này.' 
                  : 'Không tìm thấy hồ sơ biên nhận gốc có mã này.' 
          });
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setNotification(null);

      if (!formData.code || !formData.customerName) { 
          setNotification({ type: 'error', message: "Vui lòng điền đầy đủ Mã hợp đồng và Tên khách hàng." }); 
          return; 
      }

      // Kiểm tra trùng lắp hợp đồng trước khi lưu
      if (mode === 'contract' && formData.customerAddress && contracts) {
          const duplicateContract = contracts.find(c => 
              c.customerAddress && 
              c.customerAddress.trim().toLowerCase() === formData.customerAddress?.trim().toLowerCase() && 
              c.id !== formData.id
          );
          if (duplicateContract) {
              const confirmSave = await confirmAction(
                  `CẢNH BÁO: Hồ sơ ${formData.customerAddress} đã có hợp đồng trước đó với Số Hợp Đồng: ${duplicateContract.code}! Bạn có chắc chắn muốn lập thêm hợp đồng mới cho hồ sơ này không?`,
                  `Cảnh báo trùng Hợp đồng`
              );
              if (!confirmSave) {
                  return;
              }
          }
      }

      setLoading(true);
      
      const finalSplitItems = activeTab === 'tt' 
          ? tachThuaItems.map(item => ({ ...item, price: getDynamicPrice(item.serviceName) }))
          : activeTab === 'dd' && doDacItems.length > 0
              ? doDacItems.map(item => ({ ...item, price: getDynamicPrice(item.serviceName) }))
              : [];

      // Logic quan trọng:
      // Nếu mode = liquidation, ta lưu liquidationAmount (giá trị đã tính toán trên form)
      // Nếu mode = contract, ta lưu totalAmount (giá trị đã tính toán trên form)
      // Các trường khác giữ nguyên
      
      const contractData = { 
          ...formData, 
          splitItems: finalSplitItems, 
          serviceType: activeTab === 'tt' 
              ? 'Đo đạc tách thửa' 
              : activeTab === 'dd' && doDacItems.length > 0
                  ? 'Đo đạc nhiều thửa'
                  : formData.serviceType,
      } as Contract;
      
      // Đảm bảo không bị null
      if (!contractData.id) contractData.id = Math.random().toString(36).substr(2, 9);
      
      const savedCode = await onSave(contractData, !!initialData);
      setLoading(false);

      if (savedCode) {
          const msg = initialData ? 'Cập nhật thành công!' : 'Đã tạo mới thành công!';
          setNotification({ type: 'success', message: `${msg} Mã hợp đồng: ${savedCode}` });
          
          // Cập nhật lại code mới chốt chính thức vào form
          setFormData(prev => ({ ...prev, code: savedCode }));

          // Tự động in sau khi lưu thành công với mã hợp đồng chính thức vừa chốt
          const finalDataToPrint = { 
              ...formData, 
              code: savedCode,
              splitItems: finalSplitItems, 
              serviceType: activeTab === 'tt' 
                  ? 'Đo đạc tách thửa' 
                  : activeTab === 'dd' && doDacItems.length > 0
                      ? 'Đo đạc nhiều thửa'
                      : formData.serviceType 
          };
          onPrint(finalDataToPrint, mode);

          if (!initialData) {
              setTimeout(() => handleReset(true), 100);
          } 
      } else {
          setNotification({ type: 'error', message: 'Lỗi khi lưu. Vui lòng thử lại.' });
      }
  };

  const handleReset = async (keepNotification = false) => {
      const d = new Date();
      const todayStrLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      const newCode = await generateCode();
      setFormData({
        code: newCode, customerName: '', phoneNumber: '', address: '', ward: '', landPlot: '', mapSheet: '', area: 0,
        contractType: activeTab === 'tt' ? 'Tách thửa' : activeTab === 'cm' ? 'Cắm mốc' : activeTab === 'tl' ? 'Trích lục' : 'Đo đạc', 
        serviceType: '', areaType: '', plotCount: 1, markerCount: 1, quantity: 1, 
        unitPrice: 0, vatRate: 8, vatAmount: 0, totalAmount: 0, deposit: 0, content: '',
        createdDate: todayStrLocal, status: 'PENDING',
        liquidationArea: 0, liquidationAmount: 0
      });
      setTachThuaItems([]);
      setDoDacItems([]);
      setSearchCode('');
      if (!keepNotification) setNotification(null);
  };

  const handlePrintClick = (type: 'contract' | 'liquidation') => {
      const finalSplitItems = activeTab === 'tt' 
          ? tachThuaItems.map(item => ({ ...item, price: getDynamicPrice(item.serviceName) }))
          : activeTab === 'dd' && doDacItems.length > 0
              ? doDacItems.map(item => ({ ...item, price: getDynamicPrice(item.serviceName) }))
              : [];

      const currentData = { 
          ...formData, 
          splitItems: finalSplitItems, 
          serviceType: activeTab === 'tt' 
              ? 'Đo đạc tách thửa' 
              : activeTab === 'dd' && doDacItems.length > 0
                  ? 'Đo đạc nhiều thửa'
                  : formData.serviceType 
      };
      // Khi in thanh lý, truyền đúng giá trị thanh lý để in ra form
      if (type === 'liquidation') {
          // Lưu ý: liquidationAmount đã được tính toán trong useEffect
      }
      onPrint(currentData, type);
  };

  const handleChange = (k: keyof Contract, v: any) => setFormData(p => ({ ...p, [k]: v }));
  
  const availableServices = (() => {
      const services = priceList.map(p => p.serviceName).filter((v, i, a) => a.indexOf(v) === i);
      let filtered = services.filter(n => {
          if (activeTab === 'tt') return _nd(n).includes('tach thua');
          if (activeTab === 'cm') return _nd(n).includes('cam moc');
          if (activeTab === 'tl') return _nd(n).includes('trich luc');
          return !_nd(n).includes('tach thua') && !_nd(n).includes('cam moc') && !_nd(n).includes('trich luc');
      });
      return filtered;
  })();

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all font-medium bg-white hover:border-purple-300";
  const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1";

  // Check if we are in liquidation mode to show extra fields
  const isLiquidationMode = mode === 'liquidation';

  // Biến hiển thị tổng tiền (Tùy theo mode mà hiển thị totalAmount hay liquidationAmount)
  const displayTotalAmount = isLiquidationMode ? (formData.liquidationAmount || 0) : (formData.totalAmount || 0);

  return (
    <form onSubmit={handleSubmit} className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in relative pb-10">
        <div ref={topRef} className="absolute -top-20" />
        
        {/* NOTIFICATION */}
        <div className="lg:col-span-12">
            {notification && (
                <div className={`p-4 rounded-xl border shadow-lg flex items-start gap-3 transition-all duration-300 animate-fade-in-up mb-4 ${notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {notification.type === 'success' ? <CheckCircle className="shrink-0 mt-0.5" size={20} /> : <AlertCircle className="shrink-0 mt-0.5" size={20} />}
                    <div className="flex-1">
                        <h4 className="font-bold text-sm uppercase">{notification.type === 'success' ? 'Thành công' : 'Thông báo'}</h4>
                        <p className="text-sm">{notification.message}</p>
                    </div>
                    <button type="button" onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                </div>
            )}
        </div>

        {/* CỘT TRÁI: THÔNG TIN HỒ SƠ VÀ THỬA ĐẤT */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 border-b pb-3 flex items-center gap-2">
                    <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                        {mode === 'contract' ? <FileText size={16} /> : <Search size={16} />}
                    </span> 
                    {mode === 'contract' ? 'Thông Tin Khách Hàng & Thửa Đất' : 'Tải từ Hồ Sơ (Auto Fill)'}
                </h3>
                
                {mode !== 'contract' && (
                    <div className="flex gap-2 mb-6">
                        <div className="relative flex-1">
                            <input type="text" placeholder="Nhập mã hồ sơ..." className={`${inputClass} pl-9`} value={searchCode} onChange={(e) => setSearchCode(e.target.value)} />
                            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                        </div>
                        <button type="button" onClick={handleSearchRecord} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition-all active:scale-95">Tải</button>
                    </div>
                )}

                <div className="space-y-4">
                    <div><label className={labelClass}>Khách hàng</label><input className={inputClass} value={formData.customerName ?? ''} onChange={e => handleChange('customerName', e.target.value)} /></div>
                    <div>
                        <label className={labelClass}>Xã phường</label>
                        <select className={inputClass} value={formData.ward ?? ''} onChange={e => handleChange('ward', e.target.value)}>
                            <option value="">-- Chọn Xã/Phường --</option>
                            {wards.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className={labelClass}>Tờ bản đồ</label><input className={`${inputClass} text-center`} value={formData.mapSheet ?? ''} onChange={e => handleChange('mapSheet', e.target.value)} /></div>
                        <div><label className={labelClass}>Thửa đất</label><input className={`${inputClass} text-center`} value={formData.landPlot ?? ''} onChange={e => handleChange('landPlot', e.target.value)} /></div>
                    </div>
                    <div>
                        <label className={labelClass}>Diện tích Hợp Đồng (m2)</label>
                        <input 
                            type="number" 
                            className={`${inputClass} font-bold text-blue-600`} 
                            value={formData.area === undefined || formData.area === null || isNaN(formData.area) ? '' : formData.area} 
                            onChange={e => {
                                const val = parseFloat(e.target.value);
                                handleChange('area', isNaN(val) ? undefined : val);
                            }} 
                        />
                    </div>
                    
                    {/* LIQUIDATION AREA FIELD - ONLY IN LIQUIDATION MODE */}
                    {isLiquidationMode && (
                        <div className="bg-green-50 p-3 rounded-lg border border-green-200 mt-2 animate-fade-in">
                            <label className={`${labelClass} text-green-700`}>Diện tích Thanh Lý (Thực tế)</label>
                            <div className="flex gap-2 items-center">
                                <input 
                                    type="number" 
                                    className={`${inputClass} font-bold text-green-700 border-green-300 focus:border-green-500`} 
                                    value={formData.liquidationArea === undefined || formData.liquidationArea === null || isNaN(formData.liquidationArea) ? '' : formData.liquidationArea}
                                    onChange={e => {
                                        const val = parseFloat(e.target.value);
                                        handleChange('liquidationArea', isNaN(val) ? undefined : val);
                                    }} 
                                />
                                <span className="text-xs font-bold text-green-600">m²</span>
                            </div>
                            <p className="text-[10px] text-green-600 mt-1 italic">* Hệ thống sẽ tự động tính lại giá trị thanh lý dựa trên diện tích này.</p>
                        </div>
                    )}

                    {/* DYNAMIC TRANSITION BUTTON TO MULTI-PLOT MODE */}
                    {activeTab === 'dd' && doDacItems.length === 0 && (
                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={() => {
                                    // Tạo thửa thứ nhất từ dữ liệu hiện tại
                                    const firstItem: SplitItem = {
                                        serviceName: formData.serviceType || '',
                                        quantity: 1,
                                        price: formData.unitPrice || 0,
                                        area: formData.area || undefined,
                                        landPlot: formData.landPlot || '',
                                        mapSheet: formData.mapSheet || ''
                                    };
                                    // Tạo thửa thứ hai trống
                                    const secondItem: SplitItem = {
                                        serviceName: '',
                                        quantity: 1,
                                        price: 0,
                                        area: undefined,
                                        landPlot: '',
                                        mapSheet: ''
                                    };
                                    setDoDacItems([firstItem, secondItem]);
                                }}
                                className="w-full py-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-dashed border-purple-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 hover:border-purple-400 font-sans"
                            >
                                <Plus size={14} /> + Thêm thửa đất khác
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* CỘT PHẢI: CHI TIẾT HỢP ĐỒNG */}
        <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* TABS HEADER */}
                <div className="flex border-b border-slate-200 bg-slate-50/50 p-1.5 gap-1.5 overflow-x-auto">
                    {['dd', 'cm'].map(t => (
                        <button key={t} type="button" onClick={() => setActiveTab(t as any)} className={`flex-1 py-3 px-4 text-sm font-bold text-center rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === t ? 'bg-white text-purple-700 shadow-md ring-1 ring-purple-100' : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}>
                            {t === 'dd' ? <><Ruler size={16} /> Đo đạc</> : 
                             <><MapPin size={16} /> Cắm mốc</>}
                        </button>
                    ))}
                </div>

                <div className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                            <label className={labelClass}>Mã Hợp Đồng</label>
                            <div className="relative">
                                <FileText size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input type="text" readOnly className={`${inputClass} bg-white pl-9 font-mono font-bold text-purple-700`} value={formData.code ?? ''} />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Ngày lập</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-3 top-3 text-slate-400" />
                                <input type="date" className={`${inputClass} pl-9`} value={dateVal(formData.createdDate)} onChange={e => handleChange('createdDate', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Pricing Box */}
                    <div className={`bg-gradient-to-br p-6 rounded-2xl border shadow-inner ${isLiquidationMode ? 'from-orange-50 to-amber-50 border-orange-100' : 'from-purple-50 to-indigo-50 border-purple-100'}`}>
                        <h4 className={`font-bold flex items-center gap-2 mb-4 text-lg ${isLiquidationMode ? 'text-orange-800' : 'text-purple-800'}`}>
                            <div className={`p-1.5 rounded-lg shadow-sm ${isLiquidationMode ? 'bg-orange-100 text-orange-600' : 'bg-white text-purple-600'}`}><Banknote size={20} /></div> 
                            {isLiquidationMode ? 'Quyết toán Thanh Lý' : 'Tính chi phí Hợp Đồng'}
                        </h4>
                        
                        {/* SINGLE PLOT CONFIGURATION (Matches image perfectly) */}
                        {(activeTab === 'cm' || activeTab === 'tl' || (activeTab === 'dd' && doDacItems.length === 0)) && (
                            <div className="space-y-4 mb-4">
                                {activeTab !== 'tl' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Khu vực</label>
                                            <select 
                                                className={`${inputClass} border-purple-200 bg-white/80`} 
                                                value={formData.areaType ?? ''} 
                                                onChange={(e) => handleChange('areaType', e.target.value)}
                                            >
                                                <option value="">-- Tự động theo xã --</option>
                                                <option value="Đất nông thôn">Đất nông thôn (Xã)</option>
                                                <option value="Đất đô thị">Đất đô thị (Phường/TT)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Loại dịch vụ</label>
                                            <select 
                                                className={`${inputClass} border-purple-200 bg-white/80`} 
                                                value={formData.serviceType ?? ''} 
                                                onChange={(e) => handleChange('serviceType', e.target.value)}
                                            >
                                                <option value="">-- Chọn dịch vụ --</option>
                                                {availableServices.map(name => <option key={name} value={name}>{name}</option>)}
                                            </select>
                                        </div>
                                    </>
                                )}
                                
                                {activeTab === 'tl' && (
                                    <div>
                                        <div className="bg-white/80 p-3 rounded-lg border border-purple-200 text-sm text-purple-800 flex items-center gap-2">
                                            <AlertCircle size={16} />
                                            <span>Loại hình: <strong>Trích lục bản đồ địa chính</strong> (Đơn giá cố định: 49.225đ)</span>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">
                                            {activeTab === 'dd' ? 'Số thửa' : activeTab === 'cm' ? 'Số mốc' : 'Số lượng'}
                                        </label>
                                        <input 
                                            type="number" 
                                            className={`${inputClass} border-purple-200 bg-white/80`} 
                                            value={
                                                activeTab === 'cm' 
                                                    ? (formData.markerCount === undefined || formData.markerCount === null || isNaN(formData.markerCount) ? '' : formData.markerCount) 
                                                    : activeTab === 'tl' 
                                                        ? (formData.quantity === undefined || formData.quantity === null || isNaN(formData.quantity) ? '' : formData.quantity) 
                                                        : (formData.plotCount === undefined || formData.plotCount === null || isNaN(formData.plotCount) ? '' : formData.plotCount)
                                            } 
                                            onChange={e => {
                                                const val = parseInt(e.target.value);
                                                handleChange(activeTab === 'cm' ? 'markerCount' : activeTab === 'tl' ? 'quantity' : 'plotCount', isNaN(val) ? undefined : val);
                                            }} 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Đơn giá</label>
                                        <input 
                                            type="number" 
                                            readOnly 
                                            className={`${inputClass} border-purple-200 bg-purple-50/50 text-right font-mono text-purple-700 font-bold`} 
                                            value={formData.unitPrice === undefined || formData.unitPrice === null || isNaN(formData.unitPrice) ? '' : formData.unitPrice} 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MULTIPLE PLOTS VIEW (Displays details list parsed from Quick Import) */}
                        {activeTab === 'dd' && doDacItems.length > 0 && (
                            <div className="space-y-4 mb-4">
                                <div className="flex justify-between items-center bg-purple-50 p-3 rounded-xl border border-purple-100">
                                    <div className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
                                        <AlertCircle size={14} />
                                        <span>Đo đạc nhiều thửa đất (Tổng số thửa: {doDacItems.length})</span>
                                    </div>
                                </div>



                                <div className="bg-white rounded-xl border border-purple-200 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[600px]">
                                            <thead className="bg-purple-100 text-purple-800 text-xs uppercase font-bold">
                                                <tr>
                                                    <th className="p-3 w-20 text-center">Tờ bản đồ</th>
                                                    <th className="p-3 w-20 text-center">Thửa</th>
                                                    <th className="p-3 w-24 text-center">Diện tích (m2)</th>
                                                    <th className="p-3 text-left">Loại sản phẩm (Dịch vụ)</th>
                                                    <th className="p-3 w-24 text-right">Đơn giá</th>
                                                    <th className="p-3 w-28 text-right">Thành tiền</th>
                                                    <th className="p-3 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {doDacItems.map((item, idx) => {
                                                    const currentPrice = getDynamicPrice(item.serviceName) || 0;
                                                    const lineTotal = currentPrice * (item.quantity || 1);
                                                    return (
                                                        <tr key={idx} className="border-t border-purple-50 hover:bg-purple-50/30">
                                                            <td className="p-2">
                                                                <input 
                                                                    type="text" 
                                                                    className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-center text-sm outline-none bg-white font-mono text-slate-700 focus:border-purple-300" 
                                                                    value={(item as any).mapSheet || ''} 
                                                                    onChange={(e) => { 
                                                                        const newItems = [...doDacItems]; 
                                                                        (newItems[idx] as any).mapSheet = e.target.value; 
                                                                        setDoDacItems(newItems); 
                                                                    }} 
                                                                    placeholder="Tờ"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input 
                                                                    type="text" 
                                                                    className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-center text-sm outline-none bg-white font-mono text-slate-700 focus:border-purple-300" 
                                                                    value={(item as any).landPlot || ''} 
                                                                    onChange={(e) => { 
                                                                        const newItems = [...doDacItems]; 
                                                                        (newItems[idx] as any).landPlot = e.target.value; 
                                                                        setDoDacItems(newItems); 
                                                                    }} 
                                                                    placeholder="Thửa"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input 
                                                                    type="number" 
                                                                    className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-center text-sm outline-none bg-white font-bold text-blue-600 focus:border-purple-300" 
                                                                    value={item.area === undefined || item.area === null || isNaN(item.area) ? '' : item.area} 
                                                                    onChange={(e) => { 
                                                                        const newItems = [...doDacItems]; 
                                                                        const area = e.target.value ? parseFloat(e.target.value) : undefined;
                                                                        newItems[idx].area = area; 
                                                                        
                                                                        if (area && area > 0) {
                                                                            const matchedRows = priceList.filter(row => {
                                                                                const nameLower = _nd(row.serviceName);
                                                                                const isMatchTab = !nameLower.includes('tach thua') && 
                                                                                                   !nameLower.includes('cam moc') && 
                                                                                                   !nameLower.includes('trich luc');
                                                                                const isMatchArea = area >= row.minArea && area < row.maxArea;
                                                                                const isMatchAreaType = !row.areaType || !formData.areaType || _nd(row.areaType) === _nd(formData.areaType);
                                                                                return isMatchTab && isMatchArea && isMatchAreaType;
                                                                            });
                                                                            const bestService = matchedRows.find(p => _nd(p.serviceName).includes('chinh ly')) || matchedRows[0];
                                                                            if (bestService) {
                                                                                newItems[idx].serviceName = bestService.serviceName;
                                                                                newItems[idx].price = bestService.price;
                                                                            }
                                                                        }
                                                                        setDoDacItems(newItems); 
                                                                    }} 
                                                                    placeholder="DT"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <select 
                                                                    className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-sm outline-none bg-purple-50/30 focus:border-purple-300 text-xs" 
                                                                    value={item.serviceName} 
                                                                    onChange={(e) => { 
                                                                        const newItems = [...doDacItems]; 
                                                                        newItems[idx].serviceName = e.target.value; 
                                                                        newItems[idx].price = getDynamicPrice(e.target.value);
                                                                        setDoDacItems(newItems); 
                                                                    }}
                                                                >
                                                                    <option value="">-- Chọn --</option>
                                                                    {availableServices.map(n => <option key={n} value={n}>{n}</option>)}
                                                                </select>
                                                            </td>
                                                            <td className="p-2 text-right text-gray-600 font-mono text-xs">
                                                                {currentPrice.toLocaleString('vi-VN')}
                                                            </td>
                                                            <td className="p-2 text-right text-purple-700 font-mono font-bold text-xs">
                                                                {lineTotal.toLocaleString('vi-VN')}
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => {
                                                                        const updated = doDacItems.filter((_, i) => i !== idx);
                                                                        if (updated.length <= 1) {
                                                                            const remainingItem = updated[0];
                                                                            if (remainingItem) {
                                                                                setFormData(prev => ({
                                                                                    ...prev,
                                                                                    mapSheet: (remainingItem as any).mapSheet || '',
                                                                                    landPlot: (remainingItem as any).landPlot || '',
                                                                                    area: remainingItem.area || 0,
                                                                                    serviceType: remainingItem.serviceName || prev.serviceType || ''
                                                                                }));
                                                                            }
                                                                            setDoDacItems([]);
                                                                        } else {
                                                                            setDoDacItems(updated);
                                                                        }
                                                                    }} 
                                                                    className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-md hover:bg-red-100 transition-colors"
                                                                >
                                                                    <Trash2 size={14}/>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => setDoDacItems(prev => [...prev, { serviceName: '', quantity: 1, price: 0, area: undefined, landPlot: '', mapSheet: '' } as any])} 
                                        className="w-full py-2 bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 border-t border-purple-100 flex items-center justify-center gap-1.5 transition-colors"
                                    >
                                        <Plus size={14}/> Thêm thửa đất khác
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tt' && (
                            <div className="space-y-4 mb-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-purple-800/70 mb-1 uppercase">Khu vực</label>
                                        <select className={`${inputClass} border-purple-200 bg-white/80`} value={formData.areaType ?? ''} onChange={(e) => handleChange('areaType', e.target.value)}>
                                            <option value="">-- Tự động theo xã --</option>
                                            <option value="Đất nông thôn">Đất nông thôn (Xã)</option>
                                            <option value="Đất đô thị">Đất đô thị (Phường/TT)</option>
                                        </select>
                                    </div>
                                </div>
                                


                                <div className="bg-white rounded-xl border border-purple-200 overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-purple-100 text-purple-800 text-xs uppercase font-bold">
                                            <tr>
                                                <th className="p-3 text-left">Loại sản phẩm</th>
                                                <th className="p-3 w-16 text-center">SL</th>
                                                <th className="p-3 w-20 text-center">Diện tích (m2)</th>
                                                <th className="p-3 w-28 text-right">Đơn giá</th>
                                                <th className="p-3 w-32 text-right">Thành tiền</th>
                                                <th className="p-3 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tachThuaItems.map((item, idx) => {
                                                const currentPrice = getDynamicPrice(item.serviceName) || 0;
                                                const lineTotal = currentPrice * (item.quantity || 0);
                                                return (
                                                    <tr key={idx} className="border-t border-purple-50 hover:bg-purple-50/30">
                                                        <td className="p-2">
                                                            <select 
                                                                className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-sm outline-none bg-purple-50/30 focus:border-purple-300" 
                                                                value={item.serviceName} 
                                                                onChange={(e) => { 
                                                                    const newItems = [...tachThuaItems]; 
                                                                    newItems[idx].serviceName = e.target.value; 
                                                                    // Update price immediately to state
                                                                    newItems[idx].price = getDynamicPrice(e.target.value);
                                                                    setTachThuaItems(newItems); 
                                                                }}
                                                            >
                                                                <option value="">-- Chọn --</option>
                                                                {availableServices.map(n => <option key={n} value={n}>{n}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="number" 
                                                                className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-center text-sm outline-none bg-purple-50/30 focus:border-purple-300" 
                                                                value={item.quantity === undefined || item.quantity === null || isNaN(item.quantity) ? '' : item.quantity} 
                                                                onChange={(e) => { 
                                                                    const newItems = [...tachThuaItems]; 
                                                                    newItems[idx].quantity = parseInt(e.target.value) || 0; 
                                                                    setTachThuaItems(newItems); 
                                                                }} 
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <input 
                                                                type="number" 
                                                                className="w-full border border-purple-100 rounded-lg px-2 py-1.5 text-center text-sm outline-none bg-white font-bold text-blue-600 focus:border-purple-300" 
                                                                value={item.area === undefined || item.area === null || isNaN(item.area) ? '' : item.area} // Sửa: Chấp nhận giá trị undefined để hiện placeholder
                                                                onChange={(e) => { 
                                                                    const newItems = [...tachThuaItems]; 
                                                                    // Sửa: Xử lý chuỗi rỗng để không bị ép về 0
                                                                    newItems[idx].area = e.target.value ? parseFloat(e.target.value) : undefined; 
                                                                    setTachThuaItems(newItems); 
                                                                }} 
                                                                placeholder="DT"
                                                            />
                                                        </td>
                                                        <td className="p-2 text-right text-gray-600 font-mono">
                                                            {currentPrice.toLocaleString('vi-VN')}
                                                        </td>
                                                        <td className="p-2 text-right text-purple-700 font-mono font-bold">
                                                            {lineTotal.toLocaleString('vi-VN')}
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <button type="button" onClick={() => setTachThuaItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-md hover:bg-red-100 transition-colors">
                                                                <Trash2 size={14}/>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <button type="button" onClick={() => setTachThuaItems(prev => [...prev, { serviceName: '', quantity: 1, price: 0, area: undefined }])} className="w-full py-2 bg-purple-50 text-purple-600 text-xs font-bold hover:bg-purple-100 border-t border-purple-100 flex items-center justify-center gap-1 transition-colors"><Plus size={14}/> Thêm dòng</button>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-6 items-center pt-4 border-t border-purple-100 mt-4">
                            <div className="text-center md:text-right min-w-[80px]">
                                <span className="block text-[11px] font-bold text-purple-800/70 mb-1 uppercase font-sans">Thuế VAT ({formData.vatRate}%)</span>
                                <span className="font-mono font-bold text-slate-700 text-sm">{(formData.vatAmount ?? 0).toLocaleString('vi-VN')}</span>
                            </div>
                            <div className="text-center md:text-right">
                                <span className="block text-[11px] font-bold text-purple-800/70 mb-1 uppercase font-sans">
                                    {isLiquidationMode ? 'GIÁ TRỊ THANH LÝ' : 'TỔNG GIÁ TRỊ HĐ'}
                                </span>
                                <div className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-purple-200 shadow-sm">
                                    <span className="px-3 py-0.5 bg-purple-700 text-white font-black text-sm rounded-full font-mono">
                                        {displayTotalAmount.toLocaleString('vi-VN')}
                                    </span>
                                    <span className="text-xs font-bold text-purple-700 font-sans">VNĐ</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label className={labelClass}>Ghi chú hợp đồng</label>
                        <textarea rows={3} className={`${inputClass} resize-none`} value={formData.content ?? ''} onChange={e => handleChange('content', e.target.value)} placeholder="Nội dung chi tiết..." />
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="grid grid-cols-1 gap-3 pt-2">
                        <div className="flex gap-2">
                            <button type="submit" disabled={loading} className={`flex-1 text-white py-3 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 ${isLiquidationMode ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/30' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30'}`}>
                                <Save size={20} /> {loading ? 'Đang xử lý...' : (initialData ? (isLiquidationMode ? 'CẬP NHẬT VÀ IN THANH LÝ' : 'CẬP NHẬT VÀ IN HỢP ĐỒNG') : (isLiquidationMode ? 'LƯU VÀ IN THANH LÝ' : 'LƯU VÀ IN HỢP ĐỒNG'))}
                            </button>
                            <button type="button" onClick={() => handleReset(false)} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors shadow-sm font-bold border border-slate-200" title="Làm mới form">
                                {initialData ? <X size={20} className="text-red-500" /> : <RotateCcw size={20} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </form>
  );
};

export default ContractForm;
