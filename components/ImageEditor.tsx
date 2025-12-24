import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Pen, RotateCcw, Check, X, Wand2 } from 'lucide-react';

interface ImageEditorProps {
  imageUrl: string;
  onSave: (maskBase64: string, prompt: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl, onSave, onCancel, isProcessing }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [brushSize, setBrushSize] = useState(30);
  
  // Setup canvas with image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const containerWidth = containerRef.current!.clientWidth;
      const ratio = img.height / img.width;
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
    };
  }, [imageUrl]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if(canvas) {
      const ctx = canvas.getContext('2d');
      if(ctx) ctx.beginPath(); // Reset path
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.lineWidth = brushSize * scaleX; 
    // IMPORTANT: Semi-transparent white to see what's underneath
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; 
    
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if(ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSave = () => {
    if (!prompt.trim()) {
      alert("Please enter a prompt to describe the change.");
      return;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tCtx = tempCanvas.getContext('2d');
      if(tCtx) {
        tCtx.fillStyle = 'black';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw the semi-transparent strokes as FULL white on the mask for the AI
        // To do this, we need to treat the current canvas alpha as opacity.
        // Simplified approach: Draw the current canvas on top.
        // Since we drew with alpha 0.5, multiple strokes overlap. 
        // For a binary mask, any pixel > 0 alpha should be white.
        
        const imageData = canvas.getContext('2d')?.getImageData(0,0, canvas.width, canvas.height);
        if(imageData) {
           const pixels = imageData.data;
           const maskData = tCtx.createImageData(canvas.width, canvas.height);
           for (let i = 0; i < pixels.length; i += 4) {
             const alpha = pixels[i + 3];
             if (alpha > 0) {
               maskData.data[i] = 255; // R
               maskData.data[i + 1] = 255; // G
               maskData.data[i + 2] = 255; // B
               maskData.data[i + 3] = 255; // A
             } else {
               maskData.data[i + 3] = 255; // Alpha full, but color black (from fillRect)
             }
           }
           tCtx.putImageData(maskData, 0, 0);
        }
        
        const maskBase64 = tempCanvas.toDataURL('image/png');
        onSave(maskBase64, prompt);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Magic Editor</h3>
            <p className="text-sm text-slate-500">Brush over the area you want to change.</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition">
            <X size={24} />
          </button>
        </div>

        {/* Canvas Area - Cleaner neutral background */}
        <div className="flex-1 overflow-auto bg-slate-100 flex justify-center items-center p-8 relative" ref={containerRef}>
            <div className="relative shadow-xl ring-1 ring-black/5 rounded-lg overflow-hidden bg-white/50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
               <img src={imageUrl} alt="Original" className="max-w-full block object-contain" style={{ maxHeight: '65vh' }} />
               <canvas 
                 ref={canvasRef}
                 className="absolute inset-0 cursor-crosshair touch-none"
                 style={{ width: '100%', height: '100%' }}
                 onMouseDown={startDrawing}
                 onMouseUp={stopDrawing}
                 onMouseLeave={stopDrawing}
                 onMouseMove={draw}
               />
            </div>
        </div>

        {/* Controls Footer */}
        <div className="p-6 border-t border-slate-100 bg-white space-y-6">
           
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-6">
               <div className="flex flex-col gap-1">
                 <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Brush Size</span>
                 <div className="flex items-center gap-3">
                    <Pen size={16} className="text-slate-400" />
                    <input 
                      type="range" 
                      min="10" 
                      max="150" 
                      value={brushSize} 
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="w-40 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                    />
                 </div>
               </div>
               
               <button onClick={handleClear} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition border border-transparent hover:border-red-100">
                 <RotateCcw size={16} /> Reset Mask
               </button>
             </div>
             
             <div className="text-sm text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                Tip: The white mask is semi-transparent so you can see details.
             </div>
           </div>

           <div className="flex gap-3">
             <div className="relative flex-1">
               <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-blue-500">
                 <Wand2 size={18} />
               </div>
               <input
                 type="text"
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 placeholder="Describe your edit (e.g., 'Make the button green', 'Remove the shadow', 'Add sunglasses')..."
                 className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-800 placeholder:text-slate-400 bg-white"
                 autoFocus
               />
             </div>
             <button 
               onClick={handleSave}
               disabled={isProcessing}
               className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 flex items-center gap-2"
             >
               {isProcessing ? 'Processing...' : <><Check size={20}/> Generate</>}
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};
