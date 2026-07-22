
import React from 'react';
import { 
  Bold, Italic, Underline, AlignLeft, AlignCenter, 
  AlignRight, AlignJustify, List, ListOrdered, 
  Undo, Redo, Type, Palette, Eraser, Indent, Outdent,
  Baseline, Highlighter, BetweenVerticalStart
} from 'lucide-react';

interface RichTextToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
}

const RichTextToolbar: React.FC<RichTextToolbarProps> = ({ editorRef }) => {
  const execCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const applyLineSpacing = (value: string) => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer as any;
    
    while (container && container !== editorRef.current && 
           !['P', 'DIV', 'LI', 'H1', 'H2', 'H3'].includes(container.nodeName)) {
        container = container.parentNode;
    }

    if (container && container !== editorRef.current) {
        container.style.lineHeight = value;
    } else {
        document.execCommand('formatBlock', false, 'div');
        const newSelection = window.getSelection();
        if (newSelection && newSelection.rangeCount > 0) {
            let newContainer = newSelection.getRangeAt(0).commonAncestorContainer as any;
            while (newContainer && newContainer !== editorRef.current && newContainer.nodeName !== 'DIV') {
                newContainer = newContainer.parentNode;
            }
            if (newContainer && newContainer.nodeName === 'DIV') {
                newContainer.style.lineHeight = value;
            }
        }
    }
    editorRef.current.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 bg-slate-100 border-b border-slate-300 sticky top-0 z-[30] shadow-sm overflow-x-auto no-scrollbar select-none">
      
      <div className="flex items-center bg-white rounded border border-slate-300 p-0.5 mr-1">
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('undo'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Hoàn tác (Ctrl+Z)"><Undo size={16} /></button>
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('redo'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Làm lại (Ctrl+Y)"><Redo size={16} /></button>
      </div>

      <div className="flex items-center bg-white rounded border border-slate-300 p-0.5 mr-1 gap-1">
        <select 
          onChange={(e) => execCommand('fontName', e.target.value)}
          className="text-[11px] border-none bg-transparent outline-none font-medium h-7 px-1 w-32"
          defaultValue="Times New Roman"
        >
          <option value="Times New Roman">Times New Roman</option>
          <option value="Arial">Arial</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
        </select>
        <div className="w-px h-4 bg-slate-200" />
        <select 
          onChange={(e) => execCommand('fontSize', e.target.value)}
          className="text-[11px] border-none bg-transparent outline-none font-medium h-7 px-1 w-12"
          defaultValue="3"
        >
          <option value="1">8pt</option>
          <option value="2">10pt</option>
          <option value="3">12pt</option>
          <option value="4">14pt</option>
          <option value="5">18pt</option>
          <option value="6">24pt</option>
          <option value="7">36pt</option>
        </select>
      </div>

      <div className="flex items-center bg-white rounded border border-slate-300 p-0.5 mr-1">
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-800 font-bold" title="Chữ đậm"><Bold size={16} /></button>
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-800 italic" title="Chữ nghiêng"><Italic size={16} /></button>
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-800 underline" title="Gạch chân"><Underline size={16} /></button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        
        <div className="relative group/color">
          <button className="p-1.5 hover:bg-slate-100 rounded flex flex-col items-center">
            <Baseline size={16} />
            <div className="w-3 h-0.5 bg-red-600 -mt-[2px]" />
          </button>
          <div className="absolute top-full left-0 mt-1 hidden group-hover/color:grid grid-cols-5 gap-1 p-2 bg-white shadow-xl border rounded z-50">
            {['#000000', '#FF0000', '#0000FF', '#008000', '#FF8C00', '#8B0000', '#00008B', '#006400', '#4B0082', '#808080'].map(c => (
              <button key={c} onMouseDown={(e) => { e.preventDefault(); execCommand('foreColor', c); }} className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div className="relative group/bg">
          <button className="p-1.5 hover:bg-slate-100 rounded">
            <Highlighter size={16} />
          </button>
          <div className="absolute top-full left-0 mt-1 hidden group-hover/bg:grid grid-cols-5 gap-1 p-2 bg-white shadow-xl border rounded z-50">
            {['#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#C0C0C0', '#FFFFFF', '#FFC0CB', '#ADD8E6', '#90EE90', '#F0E68C'].map(c => (
              <button key={c} onMouseDown={(e) => { e.preventDefault(); execCommand('hiliteColor', c); }} className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center bg-white rounded border border-slate-300 p-0.5 mr-1">
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyLeft'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Căn trái"><AlignLeft size={16} /></button>
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyCenter'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Căn giữa"><AlignCenter size={16} /></button>
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyRight'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Căn phải"><AlignRight size={16} /></button>
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyFull'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Căn đều"><AlignJustify size={16} /></button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        
        <div className="relative group/spacing">
            <button className="p-1.5 hover:bg-slate-100 rounded text-slate-600 flex items-center gap-1" title="Giãn dòng">
                <BetweenVerticalStart size={16} />
            </button>
            <div className="absolute top-full left-0 mt-1 hidden group-hover/spacing:flex flex-col bg-white shadow-xl border rounded z-50 min-w-[80px] p-1">
                {['1.0', '1.15', '1.5', '2.0'].map(val => (
                    <button 
                        key={val} 
                        onMouseDown={(e) => { e.preventDefault(); applyLineSpacing(val); }} 
                        className="px-3 py-1.5 text-[11px] hover:bg-blue-50 text-left rounded text-slate-700 font-medium"
                    >
                        {val}
                    </button>
                ))}
            </div>
        </div>
      </div>

      <div className="flex items-center bg-white rounded border border-slate-300 p-0.5 mr-1">
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('outdent'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Giảm thụt lề"><Outdent size={16} /></button>
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('indent'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Tăng thụt lề"><Indent size={16} /></button>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('insertUnorderedList'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Danh sách dấu chấm"><List size={16} /></button>
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('insertOrderedList'); }} className="p-1.5 hover:bg-slate-100 rounded text-slate-600" title="Danh sách số"><ListOrdered size={16} /></button>
      </div>

      <div className="flex items-center bg-white rounded border border-slate-300 p-0.5">
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('removeFormat'); }} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Xóa định dạng"><Eraser size={16} /></button>
      </div>

    </div>
  );
};

export default RichTextToolbar;
