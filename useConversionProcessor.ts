import { useState, useRef } from 'react';
import { EngineVersion, CustomFont, ApiConfig, BorderConfig, OutputMode, ProcessingMode, PreFlightConfig } from './types';
import { getEngine } from './EngineRegistry';
import { saveGlyphMapping, clearMissingCharacters } from './persistentRegistry';
import { StorageIO } from './StorageIO';
import { SessionJournal } from './SessionJournal';
import { GoogleGenerativeAI } from "@google/generative-ai";
import JSZip from 'jszip';

interface QueueItem {
  file: File;
  path: string;
  basePath: string;
}

const parseDump = (text: string): Array<{ path: string, content: string }> | null => {
  if (!text.includes('### **')) return null;
  
  const regex = /### \*\*(.+?)\*\* ###/g;
  const parts: Array<{ path: string, content: string }> = [];
  let match;
  let prevIndex = -1;
  let prevPath = '';

  while ((match = regex.exec(text)) !== null) {
    if (prevIndex !== -1) {
      parts.push({
        path: prevPath,
        content: text.substring(prevIndex, match.index).trim()
      });
    }
    prevPath = match[1].trim();
    prevIndex = regex.lastIndex;
  }

  if (prevIndex !== -1 && prevPath) {
    parts.push({
      path: prevPath,
      content: text.substring(prevIndex).trim()
    });
  }

  return parts.length > 0 ? parts : null;
};

export const useConversionProcessor = () => {
  // --- UI STATE ---
  const [processedBytes, setProcessedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalFilesCount, setTotalFilesCount] = useState(0);
  const [currentPageProgress, setCurrentPageProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [viewState, setViewState] = useState<'paths' | 'processing' | 'done'>('paths');
  
  // --- SESSION STATE ---
  const [isFinished, setIsFinished] = useState(false);
  const [zipUrl, setZipUrl] = useState<string | undefined>(undefined);
  const [outputCacheName, setOutputCacheName] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<string[]>([]);
  
  // --- RECOVERY STATE ---
  const [partNumber, setPartNumber] = useState(1);
  const [remainingQueue, setRemainingQueue] = useState<QueueItem[]>([]);
  const [isPartial, setIsPartial] = useState(false);
  const [savedParams, setSavedParams] = useState<any>(null);
  const [sessionBaseName, setSessionBaseName] = useState<string>("output");
  const [ocrQueue, setOcrQueue] = useState<{char: string}[] | null>(null);

  const stopRequested = useRef(false);

  // --- MAIN PROCESS LOOP ---
  const startProcess = async (
    queue: QueueItem[],
    selectedEngine: EngineVersion,
    widthStr: string,
    heightStr: string,
    fonts: CustomFont[],
    borderConfig: BorderConfig,
    outputMode: OutputMode,
    processingMode: ProcessingMode = ProcessingMode.SAFE,
    preFlightConfig: PreFlightConfig | null = null,
    isContinuation = false
  ) => {
    if (!queue.length) return;

    let io: StorageIO;
    let baseName = "output";
    let currentFileIndex = 0;
    
    const usedPaths = new Set<string>();
    
    const w = parseFloat(widthStr);
    const h = parseFloat(heightStr);
    const renderer = getEngine(selectedEngine);

    // Cleanup previous zip URL to prevent memory leaks
    if (zipUrl) URL.revokeObjectURL(zipUrl);

    if (!isContinuation) {
      const firstFile = queue[0].file.name.replace(/\.[^/.]+$/, "");
      baseName = firstFile;
      setSessionBaseName(baseName);
      setSavedParams({ selectedEngine, widthStr, heightStr, fonts, borderConfig, outputMode, processingMode, preFlightConfig });
      setGeneratedFiles([]);
      clearMissingCharacters();
      
      const sessionId = Date.now().toString();
      
      io = new StorageIO(sessionId);
      await io.init();
      setOutputCacheName(io.getCacheName());
      
      SessionJournal.startNew(sessionId, baseName, queue);
      
      try {
        const keys = await caches.keys();
        for (const k of keys) if (k.startsWith('txt2pdf-session-') && k !== io.getCacheName()) await caches.delete(k);
      } catch {}

    } else {
      const session = SessionJournal.get();
      if (!session || !session.id) {
        alert("Session Lost. Please restart.");
        return;
      }
      baseName = session.baseName;
      currentFileIndex = session.currentFileIndex;
      
      const sessionId = session.id;
      io = new StorageIO(sessionId);
      await io.init();
      setOutputCacheName(io.getCacheName());
      
      setLog(prev => [...prev, `[RESUME] Session restored. Continuing from index ${currentFileIndex}...`]);
    }

    setViewState('processing');
    setIsFinished(false);
    setIsPartial(false);
    setRemainingQueue([]);
    setZipUrl(undefined);
    stopRequested.current = false;
    
    setProcessedCount(currentFileIndex); 
    
    const totalSize = queue.reduce((acc, q) => acc + q.file.size, 0);
    setTotalBytes(totalSize);
    let processedAccumulator = queue.slice(0, currentFileIndex).reduce((acc, q) => acc + q.file.size, 0);

    if (!isContinuation) {
      setLog(prev => [...prev, `[SYSTEM] Analyzing volume structure...`]);
      let scanTotal = 0;
      for (const q of queue) {
         try {
             const txt = await q.file.text();
             const matches = txt.match(/### \*\*(.+?)\*\* ###/g);
             if (matches && matches.length > 0) {
                 scanTotal += matches.length;
             } else {
                 scanTotal += 1;
             }
         } catch (e) {
             scanTotal += 1;
         }
      }
      setTotalFilesCount(scanTotal);
      setLog(prev => [...prev, `[SYSTEM] Analysis complete. Target: ${scanTotal} files.`, '']);
    } else {
      setTotalFilesCount(queue.length);
    }

    const getUniquePath = (desiredPath: string): string => {
        let finalPath = desiredPath;
        let counter = 1;
        while (usedPaths.has(finalPath)) {
            const extIndex = desiredPath.lastIndexOf('.');
            if (extIndex !== -1) {
                finalPath = `${desiredPath.substring(0, extIndex)} (${counter})${desiredPath.substring(extIndex)}`;
            } else {
                finalPath = `${desiredPath} (${counter})`;
            }
            counter++;
        }
        usedPaths.add(finalPath);
        return finalPath;
    };

    try {
        if (processingMode === ProcessingMode.SAFE) {
            // *** SAFE MODE ***
            setLog(prev => [...prev, `[MODE] Safe Mode Active (Disk Journaled)`]);
            
            for (let i = currentFileIndex; i < queue.length; i++) {
                if (stopRequested.current) break;
                
                const task = queue[i];
                setLog(prev => [...prev, `> ${task.file.name}`]);
                
                SessionJournal.update({ currentFileIndex: i });

                await new Promise(resolve => setTimeout(resolve, 0));

                try {
                    const text = await task.file.text();
                    const dumpParts = parseDump(text);
                    
                    if (dumpParts) {
                        setLog(prev => [...prev, `  [DUMP] Expanding...`]);
                        const bytesPerPart = task.file.size / dumpParts.length;

                        for (const part of dumpParts) {
                            if (stopRequested.current) break;
                            await new Promise(resolve => setTimeout(resolve, 0));

                            setLog(prev => [...prev, `  >> ${part.path}`]);
                            
                            try {
                                const pdfDoc = await renderer(part.content, w, h, (p) => setCurrentPageProgress(p), fonts, { fileName: part.path, borderConfig, preFlightConfig });
                                const blob = pdfDoc.output('blob');
                                
                                let outputPath = part.path + ".pdf";
                                if (outputPath.startsWith('/')) outputPath = outputPath.substring(1);
                                outputPath = getUniquePath(outputPath);
                                
                                await io.saveFile(outputPath, blob);
                                setGeneratedFiles(prev => [...prev, outputPath]);
                                setProcessedCount(prev => prev + 1);
                                
                                processedAccumulator += bytesPerPart;
                                setProcessedBytes(Math.min(processedAccumulator, totalSize));
                                
                            } catch (e: any) {
                                setLog(prev => [...prev, `  [ERR] Failed part ${part.path}: ${e.message}`]);
                            }
                        }
                    } else {
                        const pdfDoc = await renderer(text, w, h, (p) => setCurrentPageProgress(p), fonts, { fileName: task.file.name, borderConfig, preFlightConfig });
                        const blob = pdfDoc.output('blob');

                        let outputPath = task.file.name + ".pdf";
                        if (outputMode === OutputMode.MIRROR) {
                            const dir = task.path.replace(/\/$/, '');
                            outputPath = `${dir}/${task.file.name}.pdf`;
                            if (outputPath.startsWith('/')) outputPath = outputPath.substring(1);
                        }
                        
                        outputPath = getUniquePath(outputPath);

                        await io.saveFile(outputPath, blob);
                        setGeneratedFiles(prev => [...prev, outputPath]);
                        setProcessedCount(prev => prev + 1);

                        processedAccumulator += task.file.size;
                        setProcessedBytes(Math.min(processedAccumulator, totalSize));
                    }

                } catch (e: any) {
                    setLog(prev => [...prev, `[ERR] Failed to process ${task.file.name}: ${e.message}`]);
                }
            }
            
            // --- MANUAL ZIP GENERATION WITH PROGRESS ---
            if (!stopRequested.current) {
                setLog(prev => [...prev, `[FIN] Indexing for Archive...`]);
                await new Promise(resolve => setTimeout(resolve, 50));

                try {
                    const keys = await caches.open(io.getCacheName()).then(c => c.keys());
                    const paths = keys.map(k => {
                        const u = new URL(k.url);
                        return decodeURIComponent(u.pathname.replace(/^\/_output\//, ''));
                    }).filter(p => !p.endsWith('.zip'));

                    if (paths.length > 0) {
                        const zip = new JSZip();
                        
                        // Add files to zip iteratively to yield UI
                        let addedCount = 0;
                        for (const path of paths) {
                            const blob = await io.getFile(path);
                            if (blob) {
                                zip.file(path, blob);
                                addedCount++;
                                
                                // Update log every 5 files to prevent spam
                                if (addedCount % 5 === 0) {
                                    setLog(prev => {
                                        const last = prev[prev.length - 1];
                                        if (last.startsWith('[ZIP]')) {
                                            const newLog = [...prev];
                                            newLog[newLog.length - 1] = `[ZIP] Buffering: ${addedCount}/${paths.length}`;
                                            return newLog;
                                        }
                                        return [...prev, `[ZIP] Buffering: ${addedCount}/${paths.length}`];
                                    });
                                    // Yield main thread
                                    await new Promise(resolve => setTimeout(resolve, 0));
                                }
                            }
                        }

                        setLog(prev => [...prev, `[ZIP] Compressing (Store Mode)...`]);
                        
                        // Use STORE to avoid CPU freeze on compression
                        const zipBlob = await zip.generateAsync({ 
                            type: 'blob', 
                            compression: 'STORE',
                            streamFiles: true 
                        }, (metadata) => {
                            // Update progress during generation
                            if (metadata.percent && Math.floor(metadata.percent) % 10 === 0) {
                                 setLog(prev => {
                                     const last = prev[prev.length - 1];
                                     if (last.startsWith('[ZIP] Writing')) {
                                         const newLog = [...prev];
                                         newLog[newLog.length - 1] = `[ZIP] Writing: ${metadata.percent.toFixed(0)}%`;
                                         return newLog;
                                     }
                                     return [...prev, `[ZIP] Writing: ${metadata.percent.toFixed(0)}%`];
                                 });
                            }
                        });

                        const zipName = `${baseName}_complete.zip`;
                        await io.saveZipToCache(zipName, zipBlob);
                        setZipUrl(URL.createObjectURL(zipBlob));
                        setLog(prev => [...prev, `[SUCCESS] Job Complete. Archive Ready.`]);
                    } else {
                        setLog(prev => [...prev, `[WARN] No output files found to zip.`]);
                    }
                } catch (e: any) {
                    setLog(prev => [...prev, `[WARN] Auto-Zip Failed (Memory Limit). Download files individually.`]);
                    console.error("Zip generation failed", e);
                }
            }

        } else {
            // *** FAST MODE ***
            setLog(prev => [...prev, `[MODE] Fast Mode Active (RAM Optimized)`]);
            const zip = new JSZip();
            
            for (let i = 0; i < queue.length; i++) {
                if (stopRequested.current) break;
                const task = queue[i];
                setLog(prev => [...prev, `> ${task.file.name}`]);
                
                await new Promise(resolve => setTimeout(resolve, 0));

                try {
                    const text = await task.file.text();
                    const dumpParts = parseDump(text);

                    if (dumpParts) {
                        const bytesPerPart = task.file.size / dumpParts.length;
                        for (const part of dumpParts) {
                            if (stopRequested.current) break;
                            await new Promise(resolve => setTimeout(resolve, 0));

                            const pdfDoc = await renderer(part.content, w, h, (p) => setCurrentPageProgress(p), fonts, { fileName: part.path, borderConfig, preFlightConfig });
                            const blob = pdfDoc.output('blob');
                            let outputPath = part.path + ".pdf";
                            if (outputPath.startsWith('/')) outputPath = outputPath.substring(1);
                            outputPath = getUniquePath(outputPath);
                            
                            zip.file(outputPath, blob);
                            setGeneratedFiles(prev => [...prev, outputPath]); 
                            setProcessedCount(prev => prev + 1);

                            processedAccumulator += bytesPerPart;
                            setProcessedBytes(Math.min(processedAccumulator, totalSize));
                        }
                    } else {
                        const pdfDoc = await renderer(text, w, h, (p) => setCurrentPageProgress(p), fonts, { fileName: task.file.name, borderConfig, preFlightConfig });
                        const blob = pdfDoc.output('blob');

                        let outputPath = task.file.name + ".pdf";
                        if (outputMode === OutputMode.MIRROR) {
                            const dir = task.path.replace(/\/$/, '');
                            outputPath = `${dir}/${task.file.name}.pdf`;
                            if (outputPath.startsWith('/')) outputPath = outputPath.substring(1);
                        }
                        
                        outputPath = getUniquePath(outputPath);

                        zip.file(outputPath, blob);
                        setGeneratedFiles(prev => [...prev, outputPath]); 
                        setProcessedCount(prev => prev + 1);
                        
                        processedAccumulator += task.file.size;
                        setProcessedBytes(Math.min(processedAccumulator, totalSize));
                    }
                    
                } catch(e: any) { 
                    setLog(prev => [...prev, `[ERR] ${e.message}`]);
                }
            }
            
            if (!stopRequested.current && Object.keys(zip.files).length > 0) {
                setLog(prev => [...prev, `[FIN] Compressing RAM archive...`]);
                await new Promise(resolve => setTimeout(resolve, 100)); 
                try {
                    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
                    await io.saveZipToCache(`${baseName}_complete.zip`, zipBlob);
                    setZipUrl(URL.createObjectURL(zipBlob));
                    setLog(prev => [...prev, `[SUCCESS] Job Complete.`]);
                } catch (e: any) {
                    setLog(prev => [...prev, `[WARN] RAM Compression Failed. Data retained in session.`]);
                }
            }
        }
    } catch (e: any) {
        console.error(e);
        setLog(prev => [...prev, `[CRITICAL] ${e.message}`]);
        setIsPartial(true);
        return; 
    } finally {
        if (!stopRequested.current) {
            setIsFinished(true);
            SessionJournal.clear();
        }
    }
  };

  const continueProcess = () => {
    if (remainingQueue.length > 0 && savedParams) {
        startProcess(
            remainingQueue, 
            savedParams.selectedEngine, 
            savedParams.widthStr, 
            savedParams.heightStr, 
            savedParams.fonts, 
            savedParams.borderConfig, 
            savedParams.outputMode,
            savedParams.processingMode,
            savedParams.preFlightConfig,
            true
        );
    }
  };
  
  const processOcr = async (apiConfig: ApiConfig, resumeCallback: () => void) => {
    if (!ocrQueue) return;
    setViewState('processing');
    setIsFinished(false);
    setLog(["[AI] Neural scanning active..."]);
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    if (!apiKey) {
         setLog(prev => [...prev, `[ERR] API Key missing. Skipping AI.`]);
         setOcrQueue(null);
         resumeCallback();
         return;
    }

    // FIXED: Use correct class name from import
    const ai = new GoogleGenerativeAI(apiKey);
    // FIXED: Get model instance first
    const model = ai.getGenerativeModel({ model: apiConfig.activeModel });
    
    for (const item of ocrQueue) {
      try {
        setLog(prev => [...prev, `(scanning) character: ${item.char}`]);
        await new Promise(r => setTimeout(r, 0));

        // FIXED: Use model.generateContent and result.response.text()
        const result = await model.generateContent(`Create a professional, clear black character on white background 64x64 PNG representing unicode "${item.char}". Return JSON: {"data": "BASE64"}`);
        const text = result.response.text();

        if (text) {
          try {
            const json = JSON.parse(text.replace(/```json|```/g, '').trim());
            if (json.data) {
                saveGlyphMapping('0x' + item.char.charCodeAt(0).toString(16).toUpperCase(), json.data);
            }
          } catch(e) {
             setLog(prev => [...prev, `[ERR] Parse error for ${item.char}`]);
          }
        }
      } catch (e) {
        setLog(prev => [...prev, `[ERR] AI training failed for ${item.char}`]);
      }
    }
    setOcrQueue(null);
    resumeCallback();
  };

  return {
    processedBytes, totalBytes, fileProgressCount: processedCount, totalFilesCount, currentPageProgress,
    log, isFinished, ocrQueue, setOcrQueue, viewState, setViewState,
    startProcess, continueProcess, zipUrl,
    outputCacheName, generatedFiles,
    isPartial, remainingQueue, partNumber, sessionBaseName,
    processOcr
  };
};