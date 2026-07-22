import React, { useState, useRef } from 'react';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, QrCode, ScanBarcode } from 'lucide-react';

const BarcodeGeneratorView: React.FC = () => {
    const [receiptNumber, setReceiptNumber] = useState('');
    const [barcodeType, setBarcodeType] = useState<'barcode' | 'qrcode'>('barcode');
    const barcodeRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        if (!barcodeRef.current) return;
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>In Mã Vạch - ${receiptNumber}</title>
                        <style>
                            body {
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                            }
                            .print-container {
                                text-align: center;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="print-container">
                            ${barcodeRef.current.innerHTML}
                        </div>
                        <script>
                            window.onload = () => {
                                window.print();
                                setTimeout(() => window.close(), 500);
                            };
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up p-6">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <ScanBarcode size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Tạo Mã Vạch Biên Nhận</h2>
                    <p className="text-sm text-gray-500">Nhập số biên nhận để tạo mã vạch hoặc mã QR</p>
                </div>
            </div>

            <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Số Biên Nhận</label>
                    <input
                        type="text"
                        value={receiptNumber}
                        onChange={(e) => setReceiptNumber(e.target.value)}
                        placeholder="VD: TK-250714-3746"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono text-lg"
                    />
                    
                    <div className="flex gap-4 mt-4">
                        <button
                            onClick={() => setBarcodeType('barcode')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors ${barcodeType === 'barcode' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                        >
                            <ScanBarcode size={18} /> Mã Vạch (1D)
                        </button>
                        <button
                            onClick={() => setBarcodeType('qrcode')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-colors ${barcodeType === 'qrcode' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                        >
                            <QrCode size={18} /> Mã QR (2D)
                        </button>
                    </div>
                </div>

                {receiptNumber.trim() && (
                    <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center gap-6">
                        <div ref={barcodeRef} className="bg-white p-4 rounded-lg flex justify-center items-center min-h-[150px]">
                            {barcodeType === 'barcode' ? (
                                <Barcode 
                                    value={receiptNumber} 
                                    format="CODE128"
                                    width={2}
                                    height={100}
                                    displayValue={true}
                                    font="monospace"
                                    textAlign="center"
                                    textPosition="bottom"
                                    textMargin={5}
                                    fontSize={16}
                                    background="#ffffff"
                                    lineColor="#000000"
                                    margin={10}
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <QRCodeSVG 
                                        value={receiptNumber} 
                                        size={200}
                                        level="H"
                                        includeMargin={true}
                                    />
                                    <span className="font-mono font-bold text-gray-800 text-lg">{receiptNumber}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 w-full max-w-xs">
                            <button
                                onClick={handlePrint}
                                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 px-4 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                                <Printer size={18} /> In Mã
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BarcodeGeneratorView;
