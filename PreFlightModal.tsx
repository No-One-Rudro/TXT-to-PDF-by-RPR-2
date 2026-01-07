import React, { useState, useEffect } from 'react';
import { X, FileCode, FileType, Settings2, Eye, FileText, CheckCircle2, Terminal } from 'lucide-react';
import { PreFlightConfig } from './types';

interface Props {
  detectedExtensions: string[];
  hasMarkdown: boolean;
  onConfirm: (config: PreFlightConfig) => void;
  onCancel: () => void;
  t: any;
}

// Visual Mapping for "Amoled Boxes"
// Maps extensions to specific Tailwind color classes for the "Customize" grid
const EXT_STYLES: Record<string, string> = {
  'py': 'border-blue-500 text-blue-400 bg-blue-500/10',
  'js': 'border-yellow-400 text-yellow-300 bg-yellow-400/10',
  'ts': 'border-blue-400 text-blue-300 bg-blue-400/10',
  'tsx': 'border-blue-400 text-blue-300 bg-blue-400/10',
  'jsx': 'border-yellow-400 text-yellow-300 bg-yellow-400/10',
  'java': 'border-orange-500 text-orange-400 bg-orange-500/10',
  'kt': 'border-purple-500 text-purple-400 bg-purple-500/10',
  'c': 'border-indigo-500 text-indigo-400 bg-indigo-500/10',
  'cpp': 'border-indigo-500 text-indigo-400 bg-indigo-500/10',
  'cs': 'border-purple-400 text-purple-300 bg-purple-400/10',
  'html': 'border-orange-600 text-orange-500 bg-orange-600/10',
  'css': 'border-sky-400 text-sky-300 bg-sky-400/10',
  'json': 'border-zinc-400 text-zinc-300 bg-zinc-400/10',
  'sql': 'border-teal-400 text-teal-300 bg-teal-400/10',
  'sh': 'border-green-500 text-green-400 bg-green-500/10',
  'bash': 'border-green-500 text-green-400 bg-green-500/10',
  'dockerfile': 'border-blue-600 text-blue-500 bg-blue-600/10',
  'gitignore': 'border-gray-500 text-gray-400 bg-gray-500/10',
  'go': 'border-cyan-400 text-cyan-300 bg-cyan-400/10',
  'rs': 'border-red-400 text-red-300 bg-red-400/10',
  'php': 'border-violet-400 text-violet-300 bg-violet-400/10',
  'rb': 'border-red-500 text-red-400 bg-red-500/10'
};

const DEFAULT_STYLE = 'border-green-accent/50 text-green-accent bg-green-accent/10';

export const PreFlightModal: React.FC<Props> = ({ detectedExtensions, hasMarkdown, onConfirm, onCancel, t }) => {
  // State: Markdown
  const [renderMarkdown, setRenderMarkdown] = useState(true);
  
  // State: Code Highlighting
  const [syntaxMode, setSyntaxMode] = useState<'YES' | 'NO' | 'CUSTOM'>('YES');
  
  // State: Which extensions are active (initially all detected ones)
  const [enabledExts, setEnabledExts] = useState<Set<string>>(new Set(detectedExtensions));

  const hasCode = detectedExtensions.length > 0;

  // Handler: Commit choices
  const handleConfirm = () => {
    let finalExtensions: string[] = [];

    if (syntaxMode === 'YES') {
      finalExtensions = detectedExtensions; // All valid
    } else if (syntaxMode === 'CUSTOM') {
      finalExtensions = Array.from(enabledExts); // Only selected
    } else {
      finalExtensions = []; // None
    }
    
    onConfirm({
      renderMarkdown,
      highlightEnabled: syntaxMode !== 'NO',
      enabledExtensions: finalExtensions
    });
  };

  // Handler: Toggle single extension in Custom Mode
  const toggleExt = (ext: string) => {
    const next = new Set(enabledExts);
    if (next.has(ext)) next.delete(ext);
    else next.add(ext);
    setEnabledExts(next);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300" onClick={onCancel} />

      {/* Main Card */}
      <div className={`relative w-full max-w-lg ${t.card} rounded-[3.5rem] p-8 shadow-[0_0_60px_rgba(0,0,0,0.6)] border border-white/10 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300 overflow-hidden`}>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 shrink-0 px-2">
          <div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Pre-Flight</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="w-2 h-2 rounded-full bg-green-accent animate-pulse"/>
               <p className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em]">Output Logic Config</p>
            </div>
          </div>
          <button 
            onClick={onCancel} 
            className="p-4 bg-white/5 rounded-full hover:bg-white/10 active:scale-90 transition-transform border border-white/5"
          >
            <X size={24} className="text-white" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 pb-4">
          
          {/* 1. MARKDOWN SECTION (Conditional) */}
          {hasMarkdown && (
            <div className="bg-zinc-950/60 p-6 rounded-[2.5rem] border border-white/10 animate-in slide-in-from-right-8 duration-500">
              <div className="flex items-center justify-between mb-5 px-2">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-pink-500/20 rounded-2xl text-pink-500 border border-pink-500/20 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                    <FileType size={20} />
                  </div>
                  <div>
                    <span className="font-black uppercase tracking-wider text-sm block text-white">Markdown</span>
                    <span className="text-[9px] font-mono text-zinc-500">.md / .markdown</span>
                  </div>
                </div>
              </div>

              <div className="flex bg-black/40 p-2 rounded-[2rem] border border-white/5 relative">
                {/* Visual slider background could go here for extra polish */}
                <button 
                  onClick={() => setRenderMarkdown(true)}
                  className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase transition-all flex flex-col items-center justify-center gap-1.5 ${renderMarkdown ? 'bg-pink-500 text-black shadow-lg scale-[1.02]' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                  <Eye size={18} strokeWidth={2.5} /> 
                  <span className="tracking-widest">Rendered</span>
                </button>
                <button 
                  onClick={() => setRenderMarkdown(false)}
                  className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase transition-all flex flex-col items-center justify-center gap-1.5 ${!renderMarkdown ? 'bg-zinc-800 text-white shadow-lg border border-white/10 scale-[1.02]' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                  <FileText size={18} strokeWidth={2.5} /> 
                  <span className="tracking-widest">Raw Text</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. CODE SYNTAX SECTION (Conditional) */}
          {hasCode && (
            <div className="bg-zinc-950/60 p-6 rounded-[2.5rem] border border-white/10 animate-in slide-in-from-right-8 duration-500 delay-100">
              <div className="flex items-center justify-between mb-5 px-2">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-blue-500/20 rounded-2xl text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                    <FileCode size={20} />
                  </div>
                  <div>
                     <span className="font-black uppercase tracking-wider text-sm block text-white">Syntax Highlighting</span>
                     <span className="text-[9px] font-mono text-zinc-500">{detectedExtensions.length} Types Detected</span>
                  </div>
                </div>
              </div>
              
              <div className="flex bg-black/40 p-2 rounded-[2rem] border border-white/5 mb-6">
                <button 
                  onClick={() => setSyntaxMode('YES')} 
                  className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase transition-all ${syntaxMode === 'YES' ? 'bg-blue-500 text-white shadow-lg scale-[1.02]' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                  Yes (All)
                </button>
                <button 
                  onClick={() => setSyntaxMode('NO')} 
                  className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase transition-all ${syntaxMode === 'NO' ? 'bg-zinc-800 text-white shadow-lg border border-white/10 scale-[1.02]' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                  No
                </button>
                <button 
                  onClick={() => setSyntaxMode('CUSTOM')} 
                  className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${syntaxMode === 'CUSTOM' ? 'bg-green-accent text-black shadow-lg scale-[1.02]' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                >
                   <Settings2 size={14}/> <span>Customize</span>
                </button>
              </div>

              {/* 3. CUSTOMIZE EXTENSIONS GRID (Specific logic) */}
              {syntaxMode === 'CUSTOM' && (
                <div className="animate-in slide-in-from-top-4 fade-in duration-300">
                   <div className="flex items-center gap-2 mb-4 opacity-50 justify-center">
                      <Terminal size={12} className="text-green-accent" />
                      <span className="text-[9px] font-mono uppercase text-green-accent">Toggle Active parsers</span>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-3">
                      {detectedExtensions.map(ext => {
                         const isActive = enabledExts.has(ext);
                         // Determine specific style based on extension or default to green
                         const styleClass = EXT_STYLES[ext] || DEFAULT_STYLE;
                         
                         return (
                           <button 
                             key={ext}
                             onClick={() => toggleExt(ext)}
                             className={`
                               px-4 py-4 rounded-2xl border-2 flex items-center justify-between transition-all group duration-200
                               ${isActive 
                                  ? `${styleClass} shadow-[0_0_20px_-5px_rgba(0,0,0,0.5)] scale-[1.02]` 
                                  : 'bg-black/20 border-white/5 text-zinc-600 hover:bg-white/5 hover:border-white/10'
                               }
                             `}
                           >
                             <span className="text-[12px] font-black uppercase tracking-tighter">
                               {ext === 'gitignore' ? '.GITIGNORE' : ext === 'dockerfile' ? 'DOCKER' : ext}
                             </span>
                             
                             <div className={`
                               w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300
                               ${isActive 
                                  ? 'bg-current border-current' 
                                  : 'border-zinc-700 bg-transparent'
                               }
                             `}>
                                {isActive && <CheckCircle2 size={14} className="text-black" strokeWidth={3} />}
                             </div>
                           </button>
                         )
                      })}
                   </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Action */}
        <button 
          onClick={handleConfirm} 
          className="w-full mt-6 py-6 bg-white text-black rounded-[2.5rem] font-black italic uppercase text-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)] border-b-8 border-zinc-300 hover:border-zinc-400"
        >
          START JOB
        </button>
      </div>
    </div>
  );
};