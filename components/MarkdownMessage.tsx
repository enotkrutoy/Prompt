import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageProps {
  content: string;
}

const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button 
            onClick={handleCopy}
            className={`
                flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-all
                ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'}
            `}
        >
            {copied ? (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Скопировано
                </>
            ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                    </svg>
                    Копировать
                </>
            )}
        </button>
    );
}

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
  // Memoize plugins to ensure stable references
  const remarkPlugins = useMemo(() => [remarkGfm], []);

  return (
    <div className="markdown-body text-sm md:text-base leading-relaxed break-words text-gray-200">
      <ReactMarkdown 
        remarkPlugins={remarkPlugins}
        components={{
          table: ({node, ...props}) => (
            <div className="overflow-x-auto my-4 border rounded-lg border-gray-700 bg-[#252527]">
              <table className="min-w-full divide-y divide-gray-700" {...props} />
            </div>
          ),
          thead: ({node, ...props}) => <thead className="bg-[#2C2C2E]" {...props} />,
          th: ({node, ...props}) => (
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider border-r last:border-r-0 border-gray-700" {...props} />
          ),
          td: ({node, ...props}) => (
            <td className="px-3 py-2 whitespace-pre-wrap text-sm text-gray-300 border-t border-r last:border-r-0 border-gray-700" {...props} />
          ),
          code({node, inline, className, children, ...props}: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            return !inline ? (
              <div className="relative group my-4 rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
                 <div className="flex items-center justify-between bg-[#2C2C2E] px-4 py-2 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="flex space-x-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                        </div>
                        <span className="text-xs text-gray-400 font-mono font-bold tracking-wider">
                          {match ? match[1].toUpperCase() : 'TEXT'}
                        </span>
                    </div>
                    {/* Add Copy Button Here */}
                    <CopyButton text={codeString} />
                 </div>
                <pre className="block bg-[#121212] text-gray-100 p-4 overflow-x-auto text-sm font-mono scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            ) : (
              <code className="bg-[#2C2C2E] text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono border border-white/10" {...props}>
                {children}
              </code>
            );
          },
          h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-6 mb-3 text-white border-b border-gray-700 pb-2" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-5 mb-2 text-white" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-base font-semibold mt-4 mb-2 text-blue-300" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 my-2 text-gray-300 marker:text-gray-500" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-1 my-2 text-gray-300 marker:text-gray-500" {...props} />,
          p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
          strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-500 pl-4 py-1 my-4 bg-blue-500/10 rounded-r text-gray-400 italic" {...props} />,
          a: ({node, ...props}) => <a className="text-blue-400 hover:text-blue-300 underline underline-offset-2" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// Best Practice: Memoize heavy components to avoid unnecessary re-renders in chat lists
export default React.memo(MarkdownMessage);