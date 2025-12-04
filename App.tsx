import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, Role } from './types';
import ChatInterface from './components/ChatInterface';
import InputArea from './components/InputArea';
import { sendMessageToGemini } from './services/geminiService';
import { APP_NAME } from './constants';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputHeight, setInputHeight] = useState(80);
  
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const processGeminiRequest = async (userText: string, image: string | null, currentHistory: Message[]) => {
    setIsLoading(true);
    try {
      // Pass history excluding the message we just added (which is now in `image` and `userText` args for the API call)
      // Actually, standard practice: History contains everything UP TO the current turn.
      // The current turn is passed as `message` (and `inlineData`).
      // So `currentHistory` IS the history.

      // Map internal messages to API history format
      const historyForApi = currentHistory.map(msg => ({
        role: msg.role === Role.USER ? 'user' : 'model',
        text: msg.text,
        image: msg.image // Pass image so service can format it for history if needed
      }));

      const responseText = await sendMessageToGemini(userText, image, historyForApi);

      const aiMsg: Message = {
        id: uuidv4(),
        role: Role.MODEL,
        text: responseText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error("Error processing message:", error);
      showToast("Не удалось получить ответ. Проверьте соединение.", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = useCallback(async (text: string, image: string | null = null) => {
    setToast(null); 
    
    const userMsg: Message = {
      id: uuidv4(),
      role: Role.USER,
      text: text,
      image: image || undefined,
      timestamp: Date.now(),
    };

    // Optimistically add user message
    setMessages((prev) => [...prev, userMsg]);
    
    // We pass 'messages' as history. Since setMessages is async, 'messages' here 
    // refers to the state BEFORE the new userMsg is added. This is EXACTLY what the API expects
    // (history = previous context, current message = new input).
    processGeminiRequest(text, image, messages);

  }, [messages]);

  const handleRegenerate = useCallback(() => {
    if (messages.length < 2 || isLoading) return;

    // Check if the last message is from AI
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== Role.MODEL) return;

    // Check if the one before is User
    const lastUserMsg = messages[messages.length - 2];
    if (lastUserMsg.role !== Role.USER) return;

    // 1. Remove the last AI message
    const newMessages = messages.slice(0, -1);
    setMessages(newMessages);

    // 2. Re-send the request
    // History is everything before the last user message
    const historyForApi = newMessages.slice(0, -1); 
    // The current input is the lastUserMsg
    processGeminiRequest(lastUserMsg.text, lastUserMsg.image || null, historyForApi);
  }, [messages, isLoading]);

  const handleClearChat = () => {
    if (messages.length > 0 && window.confirm("Начать новый чат? Текущая переписка будет удалена.")) {
        setMessages([]);
        setToast(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#000000] overflow-hidden text-white font-sans selection:bg-blue-500 selection:text-white">
      {/* iOS Dark Style Header */}
      <header className="flex-none h-[60px] ios-blur border-b border-white/10 flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/20">
                AI
             </div>
             <h1 className="text-base font-semibold text-white tracking-tight">{APP_NAME}</h1>
        </div>
        
        {messages.length > 0 && (
            <button 
                onClick={handleClearChat}
                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Новый чат"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
            </button>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative max-w-4xl mx-auto w-full overflow-hidden">
        
        {/* Toast Notification */}
        {toast && (
            <div className="absolute top-4 left-4 right-4 z-50 flex justify-center animate-fade-in-down pointer-events-none">
                <div className={`
                    px-4 py-2 rounded-lg shadow-2xl backdrop-blur-md text-sm font-medium flex items-center gap-2 border
                    ${toast.type === 'error' 
                        ? 'bg-red-500/90 text-white border-red-400/50' 
                        : 'bg-emerald-500/90 text-white border-emerald-400/50'
                    }
                `}>
                    {toast.type === 'error' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    )}
                    {toast.message}
                </div>
            </div>
        )}

        <ChatInterface 
          messages={messages} 
          isLoading={isLoading} 
          paddingBottom={inputHeight}
          onRegenerate={handleRegenerate}
          onReset={handleClearChat}
          onExampleClick={(text, img) => handleSendMessage(text, img)}
          onCopy={(text) => {
             navigator.clipboard.writeText(text);
             showToast("Скопировано в буфер обмена", 'success');
          }}
        />
      </main>

      {/* Input Area */}
      <InputArea 
        onSend={handleSendMessage} 
        isLoading={isLoading} 
        onHeightChange={setInputHeight}
      />
    </div>
  );
};

export default App;