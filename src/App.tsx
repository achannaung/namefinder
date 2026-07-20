import React, { useState, useEffect, useMemo, useRef } from 'react';
import Papa from 'papaparse';
import { 
  Sun, 
  Moon, 
  Search, 
  X, 
  Upload, 
  ShieldAlert, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FileSpreadsheet,
  AlertTriangle,
  Info,
  Layers,
  FileSearch,
  BookOpen,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // --- State ---
  const [isDark, setIsDark] = useState<boolean>(false);
  const [allData, setAllData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing application...');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'warn' | 'error'>('info');
  const [sourceName, setSourceName] = useState<string>('Live Data');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // File input ref for clicking manual upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to track copied row index
  const [copiedRowIndex, setCopiedRowIndex] = useState<number | null>(null);

  const DEFAULT_DATA_URL = "https://raw.githubusercontent.com/achannaung/namesearch/main/Party_3.csv";
  const MAX_ROWS = 500;

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" focuses search input
      if (e.key === '/') {
        if (
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA'
        ) {
          return;
        }
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      // "Escape" clears search input
      if (e.key === 'Escape') {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // --- Copy Helper ---
  const copyToClipboard = (text: string, index: number) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedRowIndex(index);
      setTimeout(() => {
        setCopiedRowIndex(null);
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  // --- Initialization ---
  useEffect(() => {
    // Dynamic page title
    document.title = "Party-3 Finder | Live Search Workspace";

    // Theme logic
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }

    // Load initial dataset
    fetchDefaultDataset();
  }, []);

  // --- Theme Toggle ---
  const toggleDarkMode = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // --- Fetch Default Data ---
  const fetchDefaultDataset = async () => {
    setIsLoading(true);
    setStatusMessage('Fetching live dataset...');
    setStatusType('info');
    setSourceName('Live Data');

    try {
      const response = await fetch(DEFAULT_DATA_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const csvText = await response.text();
      parseCSVData(csvText, "Live Data");
    } catch (error) {
      console.error("Fetch error:", error);
      setIsLoading(false);
      setStatusMessage('Failed to load live data. Please drop or choose a local CSV manual override.');
      setStatusType('error');
    }
  };

  // --- Parsing CSV ---
  const parseCSVData = (csvString: string, source: string) => {
    setIsLoading(true);
    setStatusMessage('Parsing data...');
    setStatusType('info');

    Papa.parse<Record<string, string>>(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setIsLoading(false);
          setStatusMessage(`Error parsing CSV: ${results.errors[0].message}`);
          setStatusType('error');
          return;
        }

        const parsedHeaders = results.meta.fields || [];
        const data = results.data;

        // Verify that the required column exists
        const hasParty3 = parsedHeaders.some(h => h.toLowerCase() === 'party_3');
        if (!hasParty3) {
          setIsLoading(false);
          setStatusMessage("Invalid Dataset: Required 'Party_3' column not found.");
          setStatusType('error');
          return;
        }

        // Standardize the headers
        setHeaders(parsedHeaders);
        setAllData(data);
        setSourceName(source);
        setIsLoading(false);
        setStatusMessage(`Dataset successfully loaded (${source})`);
        setStatusType('success');
      },
      error: (error) => {
        setIsLoading(false);
        setStatusMessage(`Parsing Error: ${error.message}`);
        setStatusType('error');
      }
    });
  };

  // --- Local File Handle ---
  const handleLocalFile = (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setStatusMessage('Invalid file format. Please upload a .csv file.');
      setStatusType('error');
      return;
    }

    setIsLoading(true);
    setStatusMessage(`Reading file: ${file.name}...`);
    setStatusType('info');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        parseCSVData(text, file.name);
      } else {
        setIsLoading(false);
        setStatusMessage('Error reading the local file.');
        setStatusType('error');
      }
    };
    reader.onerror = () => {
      setIsLoading(false);
      setStatusMessage('Error reading the local file.');
      setStatusType('error');
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleLocalFile(file);
    }
  };

  // --- Drag and Drop Handlers ---
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleLocalFile(file);
    }
  };

  // --- Filter Search Results ---
  const filteredData = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term || headers.length === 0) return [];

    // Find exactly matching key to accommodate lowercase/uppercase differences
    const targetColumn = headers.find(h => h.toLowerCase() === 'party_3') || 'Party_3';

    return allData.filter(row => {
      const value = row[targetColumn];
      return value && String(value).toLowerCase().includes(term);
    });
  }, [allData, headers, searchQuery]);

  // Max visual limit slice
  const displayData = useMemo(() => {
    return filteredData.slice(0, MAX_ROWS);
  }, [filteredData]);

  const isTruncated = filteredData.length > MAX_ROWS;

  // --- Highlight Helper ---
  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(highlight)})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-amber-100 dark:bg-teal-500/35 text-teal-950 dark:text-teal-200 rounded px-1 font-semibold border-b border-teal-400 dark:border-teal-500">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 selection:bg-teal-500 selection:text-white flex flex-col relative overflow-x-hidden">
      
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-[500px] pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-teal-500/10 dark:bg-teal-500/5 blur-3xl" />
        <div className="absolute top-20 right-10 w-80 h-80 rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-3xl" />
      </div>

      {/* Header Container */}
      <header className="relative z-10 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-600 dark:bg-teal-500 rounded-xl text-white shadow-md shadow-teal-600/10">
              <FileSearch className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">ACA Search Workspace</p>
              <h1 id="app-title" className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Party-3 Finder
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-teal-50 dark:bg-teal-950/40 border border-teal-200/50 dark:border-teal-800/50 rounded-full text-xs font-semibold text-teal-700 dark:text-teal-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
              <span>Dataset Active</span>
            </div>

            {/* Dark mode button */}
            <button 
              id="darkModeToggle"
              onClick={toggleDarkMode}
              className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              aria-label="Toggle Dark Mode"
            >
              {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-grow max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 flex flex-col space-y-6">
        
        {/* Controls Panel */}
        <section 
          className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-300 shadow-sm p-6 ${
            isDragging 
              ? 'border-teal-500 ring-4 ring-teal-500/10 bg-teal-50/10 dark:bg-teal-950/10' 
              : 'border-slate-200 dark:border-slate-800'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Search inputs */}
            <div className="lg:col-span-8 flex flex-col justify-center">
              <label htmlFor="partyInput" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  <span>Search PDF name</span>
                </div>
                <div className="hidden sm:flex items-center space-x-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  <kbd className="px-1.5 py-0.5 bg-slate-150 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded font-bold"> / </kbd>
                  <span>to focus</span>
                  <span className="text-slate-300 dark:text-slate-850">|</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-150 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded font-bold">Esc</kbd>
                  <span>to clear</span>
                </div>
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  type="text"
                  id="partyInput"
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={allData.length === 0}
                  placeholder={allData.length === 0 ? "Waiting for dataset..." : "e.g., shwebo pdf (type to search instantly)"}
                  className="w-full pl-11 pr-12 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-teal-500/15 focus:border-teal-500 outline-none transition-all text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed text-base font-medium shadow-inner"
                />
                
                {searchQuery && (
                  <button
                    id="clearBtn"
                    onClick={clearSearch}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    aria-label="Clear Search"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Manual Override Upload Dropzone */}
            <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 pt-6 lg:pt-0 lg:pl-6 flex flex-col justify-center">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>Manual override</span>
                </span>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500/80 rounded-xl p-4 text-center cursor-pointer bg-slate-50/50 dark:bg-slate-950/40 hover:bg-teal-50/5 dark:hover:bg-teal-950/5 transition-all flex flex-col items-center justify-center group"
                >
                  <input 
                    type="file" 
                    id="csvFileInput" 
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={handleFileInputChange}
                    className="hidden" 
                  />
                  <FileSpreadsheet className="w-8 h-8 text-slate-400 group-hover:text-teal-500 transition-colors mb-2" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    Click to browse or drop CSV
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Accepts Party_3 formatted tables
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Diagnostics Status Line */}
          <div className="mt-6 flex flex-col gap-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between shadow-inner">
            <div id="statusMessage" className="flex items-center text-sm font-medium">
              {isLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-teal-600 dark:text-teal-400 mr-2.5 flex-shrink-0" />
              )}
              {!isLoading && statusType === 'success' && (
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 mr-2.5 flex-shrink-0" />
              )}
              {!isLoading && statusType === 'error' && (
                <AlertCircle className="w-4.5 h-4.5 text-rose-500 mr-2.5 flex-shrink-0" />
              )}
              {!isLoading && statusType === 'warn' && (
                <AlertTriangle className="w-4.5 h-4.5 text-amber-500 mr-2.5 flex-shrink-0" />
              )}
              {!isLoading && statusType === 'info' && (
                <Info className="w-4.5 h-4.5 text-blue-500 mr-2.5 flex-shrink-0" />
              )}
              
              <span className={`
                ${statusType === 'success' ? 'text-emerald-700 dark:text-emerald-400' : ''}
                ${statusType === 'error' ? 'text-rose-700 dark:text-rose-400 font-semibold' : ''}
                ${statusType === 'warn' ? 'text-amber-700 dark:text-amber-400' : ''}
                ${statusType === 'info' ? 'text-slate-600 dark:text-slate-300' : ''}
              `}>
                {statusMessage}
              </span>
            </div>

            {/* Quick stats badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs bg-slate-200/60 dark:bg-slate-850 px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-300 font-bold border border-slate-300/20">
                Source: <span className="text-teal-600 dark:text-teal-400">{sourceName}</span>
              </span>
              {allData.length > 0 && (
                <span id="recordCount" className="text-xs font-bold bg-teal-100 dark:bg-teal-400/10 px-2.5 py-1 rounded-full text-teal-800 dark:text-teal-300 border border-teal-200/20">
                  {allData.length.toLocaleString()} Total Records
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Results Container with Framer Motion transitions */}
        <AnimatePresence mode="wait">
          {searchQuery.trim() ? (
            <motion.div
              key="results-block"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.25 }}
              id="resultsContainer"
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden"
            >
              {displayData.length > 0 ? (
                <div>
                  {/* Results Count Header */}
                  <div className="bg-slate-50 dark:bg-slate-950/60 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-slate-400" />
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        Showing {displayData.length.toLocaleString()} matches 
                        {filteredData.length > MAX_ROWS && ` (out of ${filteredData.length.toLocaleString()} total)`}
                      </h3>
                    </div>
                    {isTruncated && (
                      <span className="text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-400 px-2.5 py-1 rounded-lg">
                        ⚠️ Result capped to prevent slowdown. Please refine query.
                      </span>
                    )}
                  </div>

                  {/* Scrollable Table Area */}
                  <div className="overflow-x-auto w-full max-h-[550px] overflow-y-auto relative scrollbar-thin">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                          {headers.map((headerText, index) => (
                            <th 
                              key={index}
                              className="sticky top-0 bg-slate-100 dark:bg-slate-950 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 shadow-[0_1px_0_rgba(0,0,0,0.05)] z-20"
                            >
                              {headerText}
                            </th>
                          ))}
                          <th className="sticky top-0 bg-slate-100 dark:bg-slate-950 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 shadow-[0_1px_0_rgba(0,0,0,0.05)] z-20 text-right">
                            Copy
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {displayData.map((row, rowIndex) => {
                          const targetColumn = headers.find(h => h.toLowerCase() === 'party_3') || 'Party_3';
                          const party3Value = row[targetColumn] || '';

                          return (
                            <motion.tr 
                              key={rowIndex}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.15, delay: Math.min(rowIndex * 0.005, 0.2) }}
                              className="hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors duration-100 border-slate-100 dark:border-slate-850"
                            >
                              {headers.map((col, colIndex) => {
                                const cellValue = row[col] || '';
                                const isTargetColumn = col.toLowerCase() === 'party_3';
                                return (
                                  <td 
                                    key={colIndex}
                                    className={`px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap ${
                                      isTargetColumn ? 'font-semibold text-slate-900 dark:text-white font-mono' : ''
                                    }`}
                                  >
                                    {isTargetColumn ? highlightText(cellValue, searchQuery) : cellValue}
                                  </td>
                                );
                              })}
                              <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                                <button
                                  onClick={() => copyToClipboard(party3Value, rowIndex)}
                                  title="Copy Party_3 value to clipboard"
                                  className={`p-1.5 rounded-lg border transition-all duration-150 cursor-pointer ${
                                    copiedRowIndex === rowIndex
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400 scale-95'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:border-teal-200 dark:hover:border-teal-800/80 shadow-sm hover:scale-105'
                                  }`}
                                >
                                  {copiedRowIndex === rowIndex ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Empty match state */
                <div id="emptyState" className="p-16 text-center flex flex-col items-center justify-center">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-slate-300 dark:text-slate-700 mb-4 border border-slate-100 dark:border-slate-800 shadow-inner">
                    <BookOpen className="w-12 h-12" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">No matching records</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-sm">
                    No names match "<span className="text-teal-600 dark:text-teal-400 font-semibold">{searchQuery}</span>" within our active PDF index. Please check your spelling or verify other keyword queries.
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            /* Welcome / Guide visual fallback when search is empty */
            <motion.div
              key="welcome-block"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl p-12 text-center flex flex-col items-center justify-center"
            >
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm text-teal-600 dark:text-teal-400 mb-4">
                <FileSearch className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Start Typing to Query</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mt-1.5 leading-relaxed">
                Enter any term or name part inside the search bar. The engine will instantly run high-performance filtering against the loaded active dataset rows.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Footer & Warnings */}
      <footer className="mt-auto py-8 px-4 text-center space-y-4 border-t border-slate-200 dark:border-slate-900/60 bg-white/40 dark:bg-slate-950/40 backdrop-blur-sm relative z-10">
        <div className="max-w-3xl mx-auto p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300 shadow-sm flex items-center justify-center space-x-3 text-sm font-semibold tracking-wide">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-600 dark:text-rose-400" />
          <span>CONFIDENTIAL: Unauthorized use, disclosure, or distribution is strictly prohibited.</span>
        </div>
        
        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium max-w-2xl mx-auto leading-relaxed">
          Note: Dataset last updated February 2026. Further updates required to revise several names.
        </p>
      </footer>
    </div>
  );
}
