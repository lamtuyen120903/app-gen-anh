import React, { useState } from 'react';
import { BannerInput, AspectRatio } from '../types';
import { Upload, Type, Palette, Layout, Image as ImageIcon, X, Paintbrush, MapPin, Check, Ruler, ArrowLeft, AlertTriangle } from 'lucide-react';

interface InputFormProps {
  input: BannerInput;
  setInput: React.Dispatch<React.SetStateAction<BannerInput>>;
  onNext: () => void;
  onBack: () => void;
  isProcessing: boolean;
}

const FONTS = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Open Sans', value: 'Open Sans, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
  { label: 'Playfair', value: 'Playfair Display, serif' },
  { label: 'Merriweather', value: 'Merriweather, serif' },
  { label: 'Oswald', value: 'Oswald, sans-serif' },
  { label: 'Poppins', value: 'Poppins, sans-serif' },
  { label: 'Lobster', value: 'Lobster, cursive' },
  { label: 'Pacifico', value: 'Pacifico, cursive' },
  { label: 'Lato', value: 'Lato, sans-serif' },
  { label: 'Raleway', value: 'Raleway, sans-serif' },
];

export const InputForm: React.FC<InputFormProps> = ({ input, setInput, onNext, onBack, isProcessing }) => {
  const [openFontSelector, setOpenFontSelector] = useState<'main' | 'secondary' | null>(null);
  // NEW: State for custom validation modal
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof BannerInput) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInput(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = (field: keyof BannerInput) => {
    setInput(prev => ({ ...prev, [field]: null }));
  };

  const handleChange = (field: keyof BannerInput, value: any) => {
    setInput(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateClick = (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation();

    const missing: string[] = [];
    if (!input.productImage) missing.push("Product Image");
    if (!input.productDescription?.trim()) missing.push("Product Description");
    if (!input.headline?.trim()) missing.push("Headline");
    if (!input.cta?.trim()) missing.push("Call to Action (CTA)");
    if (!input.designContext?.trim()) missing.push("Design Context");

    if (missing.length > 0) {
      // Instead of alert(), set state to show custom modal
      setValidationErrors(missing);
      return;
    }

    onNext();
  };

  // Helper to render labels consistently with Red "Required" highlighting
  const renderLabel = (text: string, isRequired: boolean = false) => (
    <label className={`block text-sm font-semibold mb-1.5 ${isRequired ? 'text-red-600' : 'text-slate-700'}`}>
      {text} {isRequired && <span className="font-normal">(required)</span>}
    </label>
  );

  const renderFontSelector = (type: 'main' | 'secondary') => {
    const currentVal = type === 'main' ? input.fontMain : input.fontSecondary;
    const labelText = type === 'main' ? 'Primary Font' : 'Secondary Font';

    return (
      <div className="relative">
        {renderLabel(labelText, false)}
        <div 
          onClick={() => setOpenFontSelector(openFontSelector === type ? null : type)}
          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer flex justify-between items-center hover:border-red-400 transition"
        >
          <span style={{ fontFamily: currentVal || 'inherit' }} className="text-slate-800">
             {FONTS.find(f => f.value === currentVal)?.label || 'Select a font'}
          </span>
          <span className="text-slate-400 text-xs">▼</span>
        </div>

        {openFontSelector === type && (
          <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto font-list-scroll p-2 grid grid-cols-1 gap-1">
             <div 
                onClick={() => { handleChange(type === 'main' ? 'fontMain' : 'fontSecondary', ''); setOpenFontSelector(null); }}
                className="px-3 py-2 hover:bg-slate-50 rounded cursor-pointer text-slate-500 text-sm"
             >
                Default (None)
             </div>
             {FONTS.map(f => (
               <div 
                 key={f.value}
                 onClick={() => { handleChange(type === 'main' ? 'fontMain' : 'fontSecondary', f.value); setOpenFontSelector(null); }}
                 className={`px-3 py-2 rounded cursor-pointer flex justify-between items-center group transition-colors ${currentVal === f.value ? 'bg-red-50 text-red-700' : 'hover:bg-slate-50 text-slate-800'}`}
               >
                 <span style={{ fontFamily: f.value, fontSize: '16px' }}>{f.label}</span>
                 {currentVal === f.value && <Check size={14} />}
               </div>
             ))}
          </div>
        )}
        {/* Overlay to close when clicking outside */}
        {openFontSelector === type && (
          <div className="fixed inset-0 z-40" onClick={() => setOpenFontSelector(null)}></div>
        )}
      </div>
    );
  };

  const renderImageUpload = (
    field: 'productImage' | 'logo' | 'referenceImage' | 'headlineFontReference',
    label: string,
    subLabel: string,
    required = false
  ) => (
    <div className="space-y-2">
      <label className={`block text-sm font-semibold ${required ? 'text-red-600' : 'text-slate-800'}`}>
        {label} {required && <span className="font-normal">(required)</span>}
      </label>
      <div className={`relative group border-2 border-dashed rounded-xl transition-all duration-200 
        ${input[field] ? 'border-red-500 bg-red-50/30' : 'border-slate-300 hover:border-red-400 hover:bg-slate-50'}`}>
        
        <input 
          type="file" 
          accept="image/*" 
          onChange={(e) => handleFileChange(e, field)} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
        />
        
        {input[field] ? (
          <div className="relative p-4 flex flex-col items-center justify-center">
             <img 
               src={input[field] as string} 
               alt={label} 
               className="max-h-40 w-auto object-contain rounded shadow-sm" 
             />
             <div className="absolute top-2 right-2 z-20">
               <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeFile(field);
                  }}
                  type="button"
                  className="bg-white/90 text-slate-600 hover:text-red-600 p-1.5 rounded-full shadow-md transition-colors"
               >
                 <X size={16} />
               </button>
             </div>
             <p className="text-xs text-red-600 font-medium mt-2">Click or Drop to Replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="bg-slate-100 p-3 rounded-full mb-3 text-slate-500 group-hover:bg-red-100 group-hover:text-red-600 transition-colors">
              {field === 'productImage' ? <ImageIcon size={24} /> : field === 'headlineFontReference' ? <Type size={24}/> : <Upload size={24} />}
            </div>
            <span className="text-sm font-medium text-slate-700">Click to upload or drag & drop</span>
            <span className="text-xs text-slate-400 mt-1">{subLabel}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-visible relative">
      
      {/* --- CUSTOM VALIDATION MODAL --- */}
      {validationErrors.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-bounce-in">
             <div className="flex items-center gap-3 mb-4 text-red-600">
               <div className="bg-red-100 p-2 rounded-full"><AlertTriangle size={24} /></div>
               <h3 className="text-xl font-bold">Missing Information</h3>
             </div>
             <p className="text-slate-600 mb-4">Please fill in the following required fields to generate your design:</p>
             <ul className="space-y-2 mb-6 bg-red-50 p-4 rounded-lg border border-red-100">
               {validationErrors.map((err, idx) => (
                 <li key={idx} className="flex items-center gap-2 text-sm font-medium text-red-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> {err}
                 </li>
               ))}
             </ul>
             <button 
               onClick={() => setValidationErrors([])}
               className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition"
             >
               OK, I'll fix it
             </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12">
        
        {/* Left Column: Content & Branding */}
        <div className="lg:col-span-7 p-6 md:p-8 space-y-8 border-b lg:border-b-0 lg:border-r border-slate-100">
          
          {/* Content Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="bg-red-100 text-red-600 p-1.5 rounded-lg"><Type size={18}/></span>
              Content & Context
            </h3>
            
            <div className="space-y-4">
              <div>
                {renderLabel("Product Description", true)}
                <textarea
                  value={input.productDescription}
                  onChange={(e) => handleChange('productDescription', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition placeholder:text-slate-400 resize-none"
                  placeholder="E.g. A premium anti-aging face cream with natural ingredients..."
                />
              </div>

              <div>
                {renderLabel("Headline", true)}
                <input
                  type="text"
                  value={input.headline}
                  onChange={(e) => handleChange('headline', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition placeholder:text-slate-400"
                  placeholder="e.g. Summer Collection 2024"
                />
              </div>

              <div>
                {renderLabel("Sub-Headline", false)}
                <input
                  type="text"
                  value={input.subHeadline}
                  onChange={(e) => handleChange('subHeadline', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition placeholder:text-slate-400"
                  placeholder="e.g. Up to 50% Off Selected Items"
                />
              </div>

              <div>
                {renderLabel("Body Text", false)}
                <textarea
                  value={input.bodyText}
                  onChange={(e) => handleChange('bodyText', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition placeholder:text-slate-400 resize-none"
                  placeholder="Describe your offer details (up to 4 lines)..."
                />
              </div>

              <div>
                {renderLabel("Call to Action (CTA)", true)}
                <input
                  type="text"
                  value={input.cta}
                  onChange={(e) => handleChange('cta', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition placeholder:text-slate-400"
                  placeholder="e.g. Shop Now, Learn More, Sign Up"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 w-full my-6"></div>

          {/* Branding Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="bg-orange-100 text-orange-600 p-1.5 rounded-lg"><Palette size={18}/></span>
              Design & Branding
            </h3>

            {/* Design Direction */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                {renderLabel("Design Style", false)}
                <div className="relative">
                   <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400"><Paintbrush size={16}/></div>
                   <input
                    type="text"
                    value={input.designStyle}
                    onChange={(e) => handleChange('designStyle', e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition placeholder:text-slate-400"
                    placeholder="e.g. Minimalist, Vibrant..."
                  />
                </div>
              </div>
              <div>
                {renderLabel("Design Context", true)}
                <div className="relative">
                   <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400"><MapPin size={16}/></div>
                   <input
                    type="text"
                    value={input.designContext}
                    onChange={(e) => handleChange('designContext', e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition placeholder:text-slate-400"
                    placeholder="e.g. Beach, Office, Studio..."
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Colors */}
              <div>
                {renderLabel("Primary Color", false)}
                <div className="flex gap-2">
                   <div className="relative w-12 h-10 overflow-hidden rounded-lg shadow-sm ring-1 ring-slate-200">
                     <input 
                        type="color" 
                        value={input.primaryColor || '#000000'}
                        onChange={(e) => handleChange('primaryColor', e.target.value)}
                        className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                     />
                   </div>
                   <input 
                      type="text" 
                      value={input.primaryColor}
                      onChange={(e) => handleChange('primaryColor', e.target.value)}
                      placeholder="#HEX"
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg uppercase text-sm font-mono focus:ring-2 focus:ring-red-500 outline-none"
                   />
                </div>
              </div>

              <div>
                {renderLabel("Secondary Color", false)}
                <div className="flex gap-2">
                   <div className="relative w-12 h-10 overflow-hidden rounded-lg shadow-sm ring-1 ring-slate-200">
                     <input 
                        type="color" 
                        value={input.secondaryColor || '#ffffff'}
                        onChange={(e) => handleChange('secondaryColor', e.target.value)}
                        className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                     />
                   </div>
                   <input 
                      type="text" 
                      value={input.secondaryColor}
                      onChange={(e) => handleChange('secondaryColor', e.target.value)}
                      placeholder="#HEX"
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg uppercase text-sm font-mono focus:ring-2 focus:ring-red-500 outline-none"
                   />
                </div>
              </div>

              {/* Fonts */}
              {renderFontSelector('main')}
              {renderFontSelector('secondary')}
            </div>
          </div>
        </div>

        {/* Right Column: Assets & Config */}
        <div className="lg:col-span-5 bg-slate-50 p-6 md:p-8 space-y-8">
          
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="bg-amber-100 text-amber-600 p-1.5 rounded-lg"><Layout size={18}/></span>
            Assets & Config
          </h3>

          {renderImageUpload('productImage', 'Product Image', 'Main subject of your ad', true)}
          
          <div className="grid grid-cols-2 gap-4">
             {renderImageUpload('logo', 'Logo', 'Transparent PNG preferred')}
             {renderImageUpload('referenceImage', 'Style Reference', 'Optional mood reference')}
             {/* New Headline Font Reference Upload */}
             {renderImageUpload('headlineFontReference', 'Headline Font Style', 'Shape reference (Color ignored)', false)}
          </div>

          <div>
             {renderLabel("Target Aspect Ratio", true)}
             <div className="grid grid-cols-3 gap-2">
                {Object.values(AspectRatio).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => handleChange('aspectRatio', ratio)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 border
                      ${input.aspectRatio === ratio 
                        ? 'bg-red-600 text-white border-red-600 shadow-md' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600'}`}
                  >
                    {ratio}
                  </button>
                ))}
             </div>
             {/* Custom Dimensions Inputs */}
             {input.aspectRatio === AspectRatio.CUSTOM && (
               <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-100 animate-fadeIn">
                 <div className="flex items-center gap-2 mb-3 text-red-800 font-semibold text-sm">
                    <Ruler size={16} /> Custom Dimensions (px)
                 </div>
                 <div className="flex gap-4">
                   <div className="flex-1">
                     <label className="block text-xs font-semibold text-red-700 mb-1">Width</label>
                     <input
                       type="number"
                       value={input.customWidth || ''}
                       onChange={(e) => handleChange('customWidth', parseInt(e.target.value) || 0)}
                       className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm text-slate-700"
                       placeholder="e.g. 1200"
                     />
                   </div>
                   <div className="flex-1">
                     <label className="block text-xs font-semibold text-red-700 mb-1">Height</label>
                     <input
                       type="number"
                       value={input.customHeight || ''}
                       onChange={(e) => handleChange('customHeight', parseInt(e.target.value) || 0)}
                       className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm text-slate-700"
                       placeholder="e.g. 628"
                     />
                   </div>
                 </div>
                 <p className="text-[10px] text-red-600/80 mt-2">
                   AI will optimize layout for this size.
                 </p>
               </div>
             )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
               {renderLabel("Variations", false)}
            </div>
            <div className="flex gap-3">
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleChange('variations', num)}
                  className={`flex-1 py-3 rounded-lg font-bold text-lg border transition-all ${
                    input.variations === num 
                    ? 'bg-red-600 text-white border-red-600 shadow-md' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Footer Actions */}
      <div className="bg-white px-8 py-5 border-t border-slate-100 flex justify-between items-center sticky bottom-0 z-20">
        <button 
          type="button"
          onClick={onBack}
          className="group flex items-center gap-2 px-6 py-2.5 text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900 rounded-lg transition"
        >
          <ArrowLeft size={20} className="text-red-600 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>
        <button 
          type="button"
          onClick={handleGenerateClick}
          disabled={isProcessing}
          className={`px-8 py-3 rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all transform flex items-center gap-2
            ${isProcessing 
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
              : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:shadow-red-500/40 hover:-translate-y-0.5'}
          `}
        >
          {isProcessing ? 'Designing...' : 'Generate Designs'}
          {!isProcessing && <Layout size={20} />}
        </button>
      </div>
    </div>
  );
};
