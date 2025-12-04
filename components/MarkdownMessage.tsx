import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageProps {
  content: string;
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
            return !inline ? (
              <div className="relative group my-4 rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
                 <div className="flex items-center justify-between bg-[#2C2C2E] px-4 py-2 border-b border-gray-700">
                    <div className="flex space-x-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">
                      {match ? match[1].toUpperCase() : 'TEXT'}
                    </span>
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