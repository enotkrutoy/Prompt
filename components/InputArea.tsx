import React, { useState, useRef, useEffect } from 'react';

interface InputAreaProps {
  onSend: (text: string, image: string | null) => void;
  isLoading: boolean;
  onHeightChange: (height: number) => void;
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, isLoading, onHeightChange }) => {
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 150);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    if (containerRef.current) {
        onHeightChange(containerRef.current.offsetHeight);
    }
  }, [text, selectedImage, onHeightChange]);

  const handleSend = () => {
    if ((text.trim() || selectedImage) && !isLoading) {
      onSend(text, selectedImage);
      setText('');
      setSelectedImage(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again if needed
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const insertUrlPlaceholder = () => {
    const url = prompt("Введите URL (ссылку на сайт, документацию, GitHub):");
    if (url) {
        const newText = text ? `${text}\nИсточник: ${url}` : `Источник: ${url}`;
        setText(newText);
        setTimeout(adjustHeight, 0);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
  };

  const hasUrl = text.includes('http://') || text.includes('https://');

  return (
    <div 
        ref={containerRef}
        className="fixed bottom-0 left-0 right-0 ios-blur border-t border-white/10 p-4 z-50 transition-all duration-300 ease-in-out"
    >
      <div className="max-w-4xl mx-auto flex items-end gap-3">
        {/* Attachment Button */}
        <button
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 mb-1 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] text-blue-400 flex items-center justify-center shrink-0 border border-white/5 transition-colors active:scale-95"
            title="Добавить контекст (Фото, Скриншот, Рентген)"
            disabled={isLoading}
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
        </button>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            accept="image/*"
        />

        {/* Link Button */}
        <button
            onClick={insertUrlPlaceholder}
            className={`h-10 w-10 mb-1 rounded-full hover:bg-[#3A3A3C] flex items-center justify-center shrink-0 border border-white/5 transition-colors active:scale-95 ${hasUrl ? 'bg-blue-500/20 text-blue-400' : 'bg-[#2C2C2E] text-blue-400'}`}
            title="Добавить ссылку"
            disabled={isLoading}
        >
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
           </svg>
        </button>

        <div className="flex-1 bg-[#2C2C2E] rounded-3xl border border-transparent focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-lg overflow-hidden flex flex-col py-2 px-4">
            {/* Image Preview Area */}
            {selectedImage && (
                <div className="relative mb-2 w-fit group">
                    <img 
                        src={selectedImage} 
                        alt="Preview" 
                        className="h-20 w-auto rounded-lg object-cover border border-white/10"
                    />
                    <button 
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1 shadow-md border border-white/20 hover:bg-gray-700 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                    </button>
                </div>
            )}
            
            <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    adjustHeight();
                }}
                onKeyDown={handleKeyDown}
                placeholder={selectedImage ? "Добавьте описание..." : "Запрос, ссылка или файл..."}
                className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-[150px] min-h-[24px] py-1 text-base leading-relaxed text-white placeholder-gray-500 outline-none no-scrollbar"
                rows={1}
                disabled={isLoading}
            />
        </div>
        
        <button
            onClick={handleSend}
            disabled={(!text.trim() && !selectedImage) || isLoading}
            className={`
                h-12 w-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 shadow-lg mb-0
                ${(text.trim() || selectedImage) && !isLoading 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white transform hover:scale-105 active:scale-95 hover:shadow-blue-500/30' 
                    : 'bg-[#2C2C2E] text-gray-500 cursor-not-allowed border border-white/5'
                }
            `}
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
        </button>
      </div>
    </div>
  );
};

export default InputArea;