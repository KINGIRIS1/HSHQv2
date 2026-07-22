
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
// import 'react-image-crop/dist/ReactCrop.css'; // REMOVED: Import CSS causing crash in preview
import { Check, X, Crop as CropIcon, Edit3, Type, Undo, Redo, PenTool, Trash2, Send, Move } from 'lucide-react';

interface ScreenshotCropperProps {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

// Định nghĩa đối tượng Text
interface TextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

// Định nghĩa một bước trong lịch sử (để Undo/Redo)
interface HistoryStep {
  imageData: ImageData; // Trạng thái pixel của Canvas (nét vẽ)
  texts: TextAnnotation[]; // Danh sách text tại thời điểm đó
}

const ScreenshotCropper: React.FC<ScreenshotCropperProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  
  // States cho chế độ chỉnh sửa (Annotate)
  const [mode, setMode] = useState<'crop' | 'edit'>('crop');
  const [editTool, setEditTool] = useState<'pen' | 'text' | 'move'>('pen');
  const [penColor, setPenColor] = useState('#ef4444'); // Mặc định màu đỏ
  const [editImageSrc, setEditImageSrc] = useState<string | null>(null); // Ảnh sau khi crop để vẽ lên
  
  // Text Input State (Khi đang nhập liệu)
  const [textInput, setTextInput] = useState<{ x: number, y: number, value: string } | null>(null);
  
  // Text Object State (Danh sách text đã thêm)
  const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<HistoryStep[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Container bao quanh canvas để tính tọa độ
  
  // Ref cho vẽ
  const isDrawing = useRef(false);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  
  // Ref cho Dragging Text
  const draggingTextId = useRef<string | null>(null);
  const dragOffset = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  // Tự động chọn vùng crop mặc định
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 80 }, width / height, width, height),
      width, height
    );
    setCrop(crop);
  };

  // Hàm hỗ trợ lấy Canvas từ vùng đã Crop (hoặc toàn bộ ảnh)
  const getCroppedCanvas = (): HTMLCanvasElement | null => {
    const image = imgRef.current;
    if (!image) return null;

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Nếu có vùng chọn crop hợp lệ
    if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
        canvas.width = completedCrop.width;
        canvas.height = completedCrop.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(
            image,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0, 0,
            completedCrop.width,
            completedCrop.height
        );
    } else {
        // Nếu không crop (lấy toàn bộ ảnh gốc)
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(image, 0, 0);
    }
    return canvas;
  };

  // 1. Chuyển sang chế độ Edit (Vẽ thêm)
  const handleCropContinue = async () => {
    const canvas = getCroppedCanvas();
    if (canvas) {
      // Chuyển canvas thành URL để hiển thị ở bước Edit
      const croppedDataUrl = canvas.toDataURL('image/png');
      setEditImageSrc(croppedDataUrl);
      setMode('edit');
    }
  };

  // 2. Gửi ngay lập tức sau khi Crop (Bỏ qua Edit)
  const handleCropAndSend = async () => {
      const canvas = getCroppedCanvas();
      if (canvas) {
          canvas.toBlob((blob) => {
              if (blob) onConfirm(blob);
          }, 'image/png');
      }
  };

  // --- QUẢN LÝ LỊCH SỬ (UNDO/REDO) ---
  const saveToHistory = useCallback(() => {
      if (!canvasRef.current || !ctxRef.current) return;
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      
      const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const currentTexts = JSON.parse(JSON.stringify(textAnnotations)); // Deep copy

      // Cắt bỏ các bước "tương lai" nếu đang ở giữa lịch sử và thực hiện hành động mới
      const newHistory = history.slice(0, historyIndex + 1);
      
      newHistory.push({
          imageData: currentImageData,
          texts: currentTexts
      });

      // Giới hạn lịch sử (ví dụ 20 bước) để tiết kiệm bộ nhớ
      if (newHistory.length > 20) newHistory.shift();

      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, textAnnotations]);

  const handleUndo = () => {
      if (historyIndex > 0) {
          const prevStep = history[historyIndex - 1];
          restoreState(prevStep);
          setHistoryIndex(historyIndex - 1);
      }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          const nextStep = history[historyIndex + 1];
          restoreState(nextStep);
          setHistoryIndex(historyIndex + 1);
      }
  };

  const restoreState = (step: HistoryStep) => {
      if (!canvasRef.current || !ctxRef.current) return;
      const ctx = ctxRef.current;
      ctx.putImageData(step.imageData, 0, 0);
      setTextAnnotations(step.texts);
      setSelectedTextId(null);
  };

  // 3. Khởi tạo Canvas Edit khi chuyển mode
  useEffect(() => {
      if (mode === 'edit' && editImageSrc && canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Tối ưu cho getImageData
          if (!ctx) return;
          
          const img = new Image();
          img.onload = () => {
              // Set kích thước canvas bằng kích thước ảnh
              canvas.width = img.width;
              canvas.height = img.height;
              // Vẽ ảnh nền
              ctx.drawImage(img, 0, 0);
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctxRef.current = ctx;
              
              // Lưu trạng thái ban đầu vào lịch sử
              saveToHistory();
          };
          img.src = editImageSrc;
      }
  }, [mode, editImageSrc]); // Bỏ saveToHistory ra khỏi dependency để tránh loop

  // --- LOGIC VẼ (DRAWING) ---
  const startDrawing = (e: React.MouseEvent) => {
      if (editTool !== 'pen' || !ctxRef.current || !canvasRef.current) return;
      
      // Bỏ chọn text nếu đang vẽ
      setSelectedTextId(null);

      isDrawing.current = true;
      const { offsetX, offsetY } = e.nativeEvent;
      
      // Tính tỉ lệ nếu canvas bị scale CSS
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;

      ctxRef.current.beginPath();
      ctxRef.current.moveTo(offsetX * scaleX, offsetY * scaleY);
      ctxRef.current.strokeStyle = penColor;
      ctxRef.current.lineWidth = 3;
  };

  const draw = (e: React.MouseEvent) => {
      if (!isDrawing.current || editTool !== 'pen' || !ctxRef.current || !canvasRef.current) return;
      const { offsetX, offsetY } = e.nativeEvent;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;

      ctxRef.current.lineTo(offsetX * scaleX, offsetY * scaleY);
      ctxRef.current.stroke();
  };

  const stopDrawing = () => {
      if (!isDrawing.current || !ctxRef.current) return;
      ctxRef.current.closePath();
      isDrawing.current = false;
      // Lưu lịch sử sau khi vẽ xong 1 nét
      saveToHistory();
  };

  // --- LOGIC TEXT (TẠO MỚI) ---
  const handleCanvasClick = (e: React.MouseEvent) => {
      // Nếu đang vẽ hoặc đang kéo thả text thì không tạo text mới
      if (editTool !== 'text' || draggingTextId.current) return;
      
      // Nếu đang nhập text dở thì confirm text cũ
      if (textInput) {
          finishText();
          return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      // Tọa độ click tương đối theo viewport để đặt input overlay
      // Tính toán vị trí tương đối với container
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setTextInput({ x, y, value: '' });
      setTimeout(() => textInputRef.current?.focus(), 100);
  };

  const finishText = () => {
      if (textInput) {
          if (textInput.value.trim()) {
              const newText: TextAnnotation = {
                  id: Math.random().toString(36).substr(2, 9),
                  x: textInput.x,
                  y: textInput.y,
                  text: textInput.value,
                  color: penColor
              };
              // Cập nhật danh sách text
              const newAnnotations = [...textAnnotations, newText];
              setTextAnnotations(newAnnotations);
              
              // Hacky way: gọi saveToHistory sau khi state cập nhật
              // Do setState là async, ta sẽ gọi saveToHistory trong useEffect phụ thuộc textAnnotations
              // Hoặc lưu trực tiếp vào history (phức tạp hơn).
              // Ở đây ta dùng useEffect để sync history khi textAnnotations thay đổi
          }
          setTextInput(null); // Ẩn input
      }
  };

  // Effect riêng để lưu history khi thêm/sửa/xóa Text
  // Lưu ý: Chỉ lưu khi sự thay đổi đến từ user interaction, không phải do undo/redo
  // Để đơn giản, ta gọi saveToHistory thủ công ở các handler
  
  const confirmTextAddition = () => {
      if (textInput && textInput.value.trim()) {
          const newText: TextAnnotation = {
              id: Math.random().toString(36).substr(2, 9),
              x: textInput.x,
              y: textInput.y,
              text: textInput.value,
              color: penColor
          };
          setTextAnnotations(prev => {
              const next = [...prev, newText];
              return next;
          });
          // Lưu history sẽ được xử lý ở useEffect dependency textAnnotations nếu muốn, 
          // nhưng tốt nhất là làm thủ công để tránh loop.
          // Tạm thời gọi setTimeout để đảm bảo state đã update (cách đơn giản)
          setTimeout(saveToHistory, 50);
      }
      setTextInput(null);
  };

  // --- LOGIC MOVE & DELETE TEXT ---
  
  const handleTextMouseDown = (e: React.MouseEvent, id: string) => {
      if (editTool === 'pen') return; // Nếu đang vẽ thì không chọn text
      
      e.stopPropagation(); // Ngăn sự kiện click canvas
      setSelectedTextId(id);
      draggingTextId.current = id;
      
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      
      if (containerRect) {
          // Tính offset của chuột so với góc trái trên của element text
          dragOffset.current = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
          };
      }
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
      // Logic vẽ
      draw(e);

      // Logic kéo thả text
      if (draggingTextId.current && containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect();
          const x = e.clientX - containerRect.left - dragOffset.current.x;
          const y = e.clientY - containerRect.top - dragOffset.current.y;
          
          setTextAnnotations(prev => prev.map(t => 
              t.id === draggingTextId.current ? { ...t, x, y } : t
          ));
      }
  };

  const handleContainerMouseUp = () => {
      // Kết thúc vẽ
      stopDrawing();

      // Kết thúc kéo thả
      if (draggingTextId.current) {
          draggingTextId.current = null;
          saveToHistory(); // Lưu vị trí mới vào lịch sử
      }
  };

  const handleDeleteSelectedText = () => {
      if (selectedTextId) {
          setTextAnnotations(prev => prev.filter(t => t.id !== selectedTextId));
          setSelectedTextId(null);
          setTimeout(saveToHistory, 50);
      }
  };

  // Bắt sự kiện Enter khi nhập text
  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') confirmTextAddition();
  };

  // --- FINAL CONFIRM (BURNING TEXT TO CANVAS) ---
  const handleFinalConfirm = () => {
      if (!canvasRef.current || !ctxRef.current) return;
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;

      // 1. Vẽ tất cả text overlays vào canvas gốc
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      ctx.font = "bold 20px Arial";
      ctx.textBaseline = "top"; // Quan trọng để khớp vị trí div

      textAnnotations.forEach(anno => {
          ctx.fillStyle = anno.color;
          // Tính toán tọa độ trên canvas thật dựa trên tỉ lệ scale
          // Tọa độ anno.x/y là tọa độ pixel CSS trên màn hình
          const canvasX = anno.x * scaleX;
          // Cộng thêm 4px padding tương đối giống css
          const canvasY = anno.y * scaleY; 
          
          ctx.fillText(anno.text, canvasX, canvasY + 5); // +5 liều lượng căn chỉnh thủ công cho giống mắt nhìn
      });

      // 2. Xuất Blob
      canvas.toBlob((blob) => {
          if (blob) onConfirm(blob);
      }, 'image/png');
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4">
      
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden" 
           onMouseMove={handleContainerMouseMove}
           onMouseUp={handleContainerMouseUp}
           onMouseLeave={handleContainerMouseUp}
      >
        {mode === 'crop' ? (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              className="max-h-[85vh]"
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Screenshot"
                onLoad={onImageLoad}
                className="max-h-[85vh] object-contain shadow-2xl"
              />
            </ReactCrop>
        ) : (
            <div 
                ref={containerRef}
                className="relative inline-block shadow-2xl"
                style={{ maxHeight: '85vh', maxWidth: '100%' }}
            >
                <canvas 
                    ref={canvasRef}
                    className="max-h-[85vh] max-w-full object-contain cursor-crosshair bg-white block"
                    onMouseDown={startDrawing}
                    onClick={handleCanvasClick}
                />
                
                {/* Text Objects Overlay */}
                {textAnnotations.map(anno => (
                    <div
                        key={anno.id}
                        onMouseDown={(e) => handleTextMouseDown(e, anno.id)}
                        className={`absolute cursor-move px-1 py-0.5 rounded select-none whitespace-nowrap text-[20px] font-bold ${selectedTextId === anno.id ? 'border border-dashed border-white bg-black/20' : ''}`}
                        style={{
                            left: anno.x,
                            top: anno.y,
                            color: anno.color,
                            fontFamily: 'Arial',
                            zIndex: 10
                        }}
                    >
                        {anno.text}
                        {selectedTextId === anno.id && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteSelectedText(); }}
                                className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-sm"
                                title="Xóa chữ"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ))}

                {/* Text Input Overlay */}
                {textInput && (
                    <input
                        ref={textInputRef}
                        type="text"
                        style={{
                            position: 'absolute',
                            left: textInput.x,
                            top: textInput.y,
                            color: penColor,
                            fontSize: '20px',
                            fontWeight: 'bold',
                            background: 'rgba(255,255,255,0.2)',
                            border: '1px dashed #ccc',
                            outline: 'none',
                            zIndex: 20,
                            padding: '0 4px',
                            minWidth: '50px',
                            width: `${Math.max(textInput.value.length * 12, 100)}px`
                        }}
                        value={textInput.value}
                        onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                        onBlur={confirmTextAddition}
                        onKeyDown={handleKeyDown}
                        placeholder="Nhập..."
                        autoFocus
                    />
                )}
            </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="absolute bottom-6 flex flex-col items-center gap-3 w-full pointer-events-none">
        {/* Color Picker & Tool Selector & Actions (Only for Edit Mode) */}
        {mode === 'edit' && (
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20 shadow-xl mb-2 pointer-events-auto">
                <div className="flex bg-black/20 rounded-lg p-1">
                    <button 
                        onClick={() => { setEditTool('pen'); setSelectedTextId(null); }}
                        className={`p-2 rounded-md ${editTool === 'pen' ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}
                        title="Vẽ (Pen)"
                    >
                        <Edit3 size={18} />
                    </button>
                    <button 
                        onClick={() => setEditTool('text')}
                        className={`p-2 rounded-md ${editTool === 'text' ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}
                        title="Chèn chữ (Text)"
                    >
                        <Type size={18} />
                    </button>
                    <button 
                        onClick={() => setEditTool('move')}
                        className={`p-2 rounded-md ${editTool === 'move' ? 'bg-white text-black' : 'text-white hover:bg-white/20'}`}
                        title="Di chuyển (Move)"
                    >
                        <Move size={18} />
                    </button>
                </div>
                
                <div className="h-6 w-px bg-white/20"></div>

                {/* Undo / Redo */}
                <div className="flex gap-1">
                    <button 
                        onClick={handleUndo} 
                        disabled={historyIndex <= 0}
                        className={`p-2 rounded-md text-white ${historyIndex <= 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'}`}
                        title="Hoàn tác (Undo)"
                    >
                        <Undo size={18} />
                    </button>
                    <button 
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        className={`p-2 rounded-md text-white ${historyIndex >= history.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20'}`}
                        title="Làm lại (Redo)"
                    >
                        <Redo size={18} />
                    </button>
                </div>

                <div className="h-6 w-px bg-white/20"></div>

                <div className="flex gap-2 px-2">
                    {['#ef4444', '#3b82f6', '#22c55e', '#ffffff', '#000000'].map(color => (
                        <button 
                            key={color}
                            onClick={() => setPenColor(color)}
                            className={`w-6 h-6 rounded-full border-2 ${penColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>

                {selectedTextId && (
                    <>
                        <div className="h-6 w-px bg-white/20"></div>
                        <button 
                            onClick={handleDeleteSelectedText}
                            className="p-2 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-200 transition-colors"
                            title="Xóa Text đang chọn"
                        >
                            <Trash2 size={18} />
                        </button>
                    </>
                )}
            </div>
        )}

        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-xl pointer-events-auto">
            <div className="text-white text-sm font-medium px-2 flex items-center gap-2">
                {mode === 'crop' ? (
                    <>
                        <CropIcon size={18} />
                        <span className="hidden sm:inline">Chọn vùng cắt</span>
                    </>
                ) : (
                    <>
                        <PenTool size={18} />
                        <span className="hidden sm:inline">Vẽ ghi chú</span>
                    </>
                )}
            </div>
            <div className="h-6 w-px bg-white/20"></div>
            
            <button
                onClick={onCancel}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all font-medium text-sm"
            >
                <X size={18} /> Hủy
            </button>

            {mode === 'crop' ? (
                <>
                    <button
                        onClick={handleCropContinue}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-bold text-sm shadow-lg"
                    >
                        <Edit3 size={18} /> Chỉnh sửa
                    </button>
                    <button
                        onClick={handleCropAndSend}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-all font-bold text-sm shadow-lg"
                    >
                        <Send size={18} /> Gửi ngay
                    </button>
                </>
            ) : (
                <button
                    onClick={handleFinalConfirm}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-all font-bold text-sm shadow-lg"
                >
                    <Check size={18} /> Gửi ảnh
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ScreenshotCropper;
