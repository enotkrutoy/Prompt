import React, { useRef, useEffect, useState } from 'react';
import { Message, Role } from '../types';
import MarkdownMessage from './MarkdownMessage';
import PromptVisualizer from './PromptVisualizer';

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  paddingBottom: number;
  onRegenerate: () => void;
  onReset: () => void;
  onCopy: (text: string) => void;
  onExampleClick: (text: string, image: string | null) => void;
}

const EXAMPLES = [
  {
    id: "red-team",
    icon: "🛡️",
    label: "Red Team & Инъекции",
    description: "Промпт для тестирования уязвимостей по скриншоту чата",
    prompt: "Я прикреплю скриншот интерфейса чат-бота. Разработай системный промпт для Red Team пентестера, который проанализирует этот UI и попытается совершить промпт-инъекцию, учитывая видимые элементы управления."
  },
  {
    id: "dentist",
    icon: "🦷",
    label: "Стоматолог (КТ/Рентген)",
    description: "Анализ снимков и составление плана",
    prompt: "Создай роль 'Эксперт-Стоматолог'. Задача: Я буду загружать панорамные снимки (ОПТГ) или КТ. Ты должен описывать состояние костной ткани, наличие кист и предлагать предварительный план лечения. Учти медицинскую терминологию."
  },
  {
    id: "docs",
    icon: "📄",
    label: "Аналитик Документов",
    description: "OCR и извлечение данных из фото",
    prompt: "Напиши промпт для системы, которая принимает фото накладных или счетов (даже плохого качества), распознает текст, исправляет ошибки OCR и возвращает данные в формате JSON."
  }
];

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  isLoading, 
  paddingBottom,
  onRegenerate,
  onReset,
  onCopy,
  onExampleClick
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [visualizeContent, setVisualizeContent] = useState<string | null>(null);

  // States for Upload Modal (Red Team flow)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingExamplePrompt, setPendingExamplePrompt] = useState<string | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-scroll to bottom when new messages arrive or loading starts
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // Show button if user is not at the very bottom (with a small threshold)
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      setShowScrollButton(!isNearBottom);
    }
  };

  const handleExampleChipClick = (ex: typeof EXAMPLES[0]) => {
      if (ex.id === 'red-team') {
          setPendingExamplePrompt(ex.prompt);
          setModalImage(null);
          setIsUploadModalOpen(true);
      } else {
          onExampleClick(ex.prompt, null);
      }
  };

  const extractFinalPrompt = (text: string): string | null => {
    // Look for the header
    const headerRegex = /###\s*2\.\s*🎯\s*ФИНАЛЬНЫЙ СИСТЕМНЫЙ ПРОМПТ/i;
    const match = text.match(headerRegex);
    
    if (!match) return null;
    
    const contentAfterHeader = text.substring(match.index! + match[0].length);
    
    // Look for the first code block after the header
    const codeBlockRegex = /```(?:markdown)?\n([\s\S]*?)```/;
    const codeMatch = contentAfterHeader.match(codeBlockRegex);
    
    if (codeMatch) {
      return codeMatch[1].trim();
    }
    
    return null;
  };

  const handleCopyPrompt = (text: string) => {
    const prompt = extractFinalPrompt(text);
    if (prompt) {
        onCopy(prompt);
    } else {
        // Fallback if structure is slightly different but still copy useful text
        onCopy(text);
    }
  };

  const handleOpenMarkdown = (text: string) => {
    const prompt = extractFinalPrompt(text) || text;
    // Add Byte Order Mark (\uFEFF) to ensure UTF-8 encoding is recognized
    const blob = new Blob(['\uFEFF' + prompt], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // --- Modal Logic ---
  const handleModalClose = () => {
      setIsUploadModalOpen(false);
      setPendingExamplePrompt(null);
      setModalImage(null);
  };

  const handleModalSend = () => {
      if (pendingExamplePrompt) {
          onExampleClick(pendingExamplePrompt, modalImage);
          handleModalClose();
      }
  };

  const processFile = (file: File) => {
      if (!file.type.startsWith('image/')) {
          alert("Пожалуйста, выберите изображение.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
          setModalImage(reader.result as string);
      };
      reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          processFile(e.target.files[0]);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.[0]) {
          processFile(e.dataTransfer.files[0]);
      }
  };

  // Global Paste Listener for Modal
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
        if (!isUploadModalOpen) return;
        
        // Prevent default paste behavior if we are handling the file
        if (e.clipboardData && e.clipboardData.files.length > 0) {
            e.preventDefault();
            const file = e.clipboardData.files[0];
            if (file.type.startsWith('image/')) {
                processFile(file);
            }
        }
    };

    if (isUploadModalOpen) {
        window.addEventListener('paste', handleGlobalPaste);
    }

    return () => {
        window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [isUploadModalOpen]);

  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto p-4 space-y-6" 
        style={{ paddingBottom: `${paddingBottom + 20}px` }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-full py-12 px-4">
             <div className="relative w-20 h-20 mb-6">
               <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full"></div>
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-20 h-20 relative text-blue-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
             </div>
            
            <h2 className="text-2xl font-bold text-white mb-2 text-center">Эксперт Промптов</h2>
            <p className="text-base text-gray-400 text-center max-w-sm mb-10 leading-relaxed">
              Загрузите фото, рентген, документ или <strong>ссылку</strong>. Я создам промпт, который умеет работать с этими данными.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
              {EXAMPLES.map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleChipClick(ex)}
                  className="flex flex-col items-start p-4 rounded-xl bg-[#1C1C1E] border border-white/5 hover:border-blue-500/30 hover:bg-[#2C2C2E] transition-all duration-200 group text-left active:scale-[0.98]"
                >
                  <div className="text-2xl mb-3 group-hover:scale-110 transition-transform duration-200">{ex.icon}</div>
                  <h3 className="text-sm font-semibold text-white mb-1">{ex.label}</h3>
                  <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors line-clamp-2 leading-relaxed">
                    {ex.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => {
          const isUser = msg.role === Role.USER;
          const isLastMessage = index === messages.length - 1;
          const isModel = msg.role === Role.MODEL;
          const hasFinalPrompt = isModel && extractFinalPrompt(msg.text) !== null;

          return (
            <div
              key={msg.id}
              className={`flex flex-col w-full ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`
                  relative max-w-[90%] md:max-w-[85%] lg:max-w-[75%] 
                  p-4 rounded-2xl shadow-lg text-left backdrop-blur-sm
                  ${isUser 
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-sm' 
                    : 'bg-[#1C1C1E] text-gray-100 rounded-tl-sm border border-white/10'
                  }
                `}
              >
                {/* Render Attached Image if exists */}
                {msg.image && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-white/20">
                        <img src={msg.image} alt="Context" className="w-full h-auto max-h-[400px] object-cover" />
                    </div>
                )}

                {isUser ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                ) : (
                  <MarkdownMessage content={msg.text} />
                )}
                
                <span className={`text-[10px] absolute bottom-1 ${isUser ? 'right-3 text-blue-100' : 'left-3 text-gray-500'} opacity-70`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Action Buttons for the last AI message */}
              {isModel && isLastMessage && !isLoading && (
                <div className="flex flex-wrap gap-2 mt-3 ml-1 animate-fade-in-up">
                  {/* Smart Copy Prompt Button */}
                  {hasFinalPrompt && (
                      <button
                        onClick={() => handleCopyPrompt(msg.text)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-all shadow-lg active:scale-95"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        Скопировать Промпт
                      </button>
                  )}

                  {/* Open Markdown Button */}
                  {hasFinalPrompt && (
                      <button
                        onClick={() => handleOpenMarkdown(msg.text)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C2C2E] hover:bg-[#3A3A3C] border border-white/10 text-xs font-medium text-orange-400 hover:text-orange-300 transition-all shadow-lg active:scale-95"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                        Открыть Markdown
                      </button>
                  )}

                  <button
                    onClick={() => onCopy(msg.text)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C2C2E] hover:bg-[#3A3A3C] border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition-all shadow-lg active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.25 2.25 0 0015 2.25h-1.5a2.25 2.25 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                    </svg>
                    Копировать всё
                  </button>

                  <button
                    onClick={() => setVisualizeContent(msg.text)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C2C2E] hover:bg-[#3A3A3C] border border-white/10 text-xs font-medium text-purple-400 hover:text-purple-300 transition-all shadow-lg active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                    </svg>
                    Визуализировать
                  </button>
                  
                  <button
                    onClick={onRegenerate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C2C2E] hover:bg-[#3A3A3C] border border-white/10 text-xs font-medium text-blue-400 hover:text-blue-300 transition-all shadow-lg active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Перегенерировать
                  </button>

                  <button
                    onClick={onReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C2C2E] hover:bg-[#3A3A3C] border border-white/10 text-xs font-medium text-red-400 hover:text-red-300 transition-all shadow-lg active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Сбросить
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start w-full animate-pulse">
             <div className="bg-[#1C1C1E] p-4 rounded-2xl rounded-tl-sm shadow-sm border border-white/10 flex items-center space-x-2">
               <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
               <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
               <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
               <span className="text-xs text-gray-400 font-medium ml-2">Анализирую данные, читаю ссылки и создаю стратегию...</span>
             </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute right-4 md:right-8 bg-[#3A3A3C] hover:bg-[#48484A] text-white p-3 rounded-full shadow-2xl border border-white/10 backdrop-blur-md transition-all duration-300 z-30 flex items-center justify-center group"
          style={{ bottom: `${paddingBottom + 20}px` }}
          aria-label="Прокрутить вниз"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 group-hover:translate-y-0.5 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
          </svg>
        </button>
      )}

      {/* Visualization Modal */}
      {visualizeContent && (
        <PromptVisualizer 
            markdown={visualizeContent} 
            onClose={() => setVisualizeContent(null)} 
        />
      )}

      {/* Upload Context Modal */}
      {isUploadModalOpen && (
        <div 
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
        >
            <div className="w-full max-w-md bg-[#1C1C1E] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
                <button 
                    onClick={handleModalClose} 
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Загрузка контекста</h3>
                    <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                        Для сценария "Red Team" рекомендуется прикрепить скриншот интерфейса или документа.
                    </p>

                    {/* Drag & Drop Zone */}
                    <div 
                        className={`
                            border-2 border-dashed rounded-xl p-8 mb-6 transition-colors flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group
                            ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 hover:border-white/30 hover:bg-white/5'}
                        `}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => modalFileInputRef.current?.click()}
                    >
                         <input 
                            type="file" 
                            ref={modalFileInputRef}
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleFileChange}
                        />

                        {modalImage ? (
                            <div className="relative">
                                <img src={modalImage} alt="Preview" className="h-32 object-contain rounded-lg shadow-lg" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                    <span className="text-white font-medium text-xs bg-black/60 px-2 py-1 rounded">Заменить</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-gray-300 font-medium mb-1 pointer-events-none">
                                    Перетащите файл сюда
                                </p>
                                <p className="text-xs text-gray-500 pointer-events-none">
                                    или нажмите <span className="text-blue-400 font-bold bg-white/5 px-1.5 py-0.5 rounded border border-white/10">Ctrl+V</span> для вставки
                                </p>
                            </>
                        )}
                    </div>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={handleModalSend}
                            className="flex-1 py-3 rounded-xl bg-[#2C2C2E] text-gray-300 font-medium text-sm hover:bg-[#3A3A3C] transition-colors"
                        >
                            Пропустить
                        </button>
                        <button 
                            onClick={handleModalSend}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all ${modalImage ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                        >
                            {modalImage ? 'Отправить с фото' : 'Только текст'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;