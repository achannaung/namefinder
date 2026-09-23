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
  Check,
  RefreshCw,
  Download,
  Settings,
  Link as LinkIcon,
  RotateCcw,
  Clock,
  Sparkles
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
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Dataset Modal State
  const [isDatasetModalOpen, setIsDatasetModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'url' | 'upload' | 'paste'>('url');
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [rawCsvInput, setRawCsvInput] = useState<string>('');
  const [saveToStorage, setSaveToStorage] = useState<boolean>(true);

  // File input ref for clicking manual upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State to track copied row index
  const [copiedRowIndex, setCopiedRowIndex] = useState<number | null>(null);

  const DEFAULT_DATA_URL = "/default_dataset.csv";
  const REMOTE_BACKUP_URL = "https://raw.githubusercontent.com/achannaung/namesearch/main/Party_3.csv";
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

      // "Escape" clears search input or closes modal
      if (e.key === 'Escape') {
        if (isDatasetModalOpen) {
          setIsDatasetModalOpen(false);
        } else {
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDatasetModalOpen]);

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

    // Check for saved local dataset or custom URL
    const savedCsv = localStorage.getItem('saved_dataset_csv');
    const savedSource = localStorage.getItem('saved_dataset_source');
    const savedTime = localStorage.getItem('saved_dataset_time');
    const savedUrl = localStorage.getItem('saved_dataset_url');

    if (savedUrl) {
      setCustomUrlInput(savedUrl);
    } else {
      setCustomUrlInput(DEFAULT_DATA_URL);
    }

    if (savedCsv) {
      if (savedTime) setLastUpdated(savedTime);
      parseCSVData(savedCsv, savedSource || 'Saved Local Dataset', false);
    } else {
      const urlToFetch = savedUrl || DEFAULT_DATA_URL;
      fetchDatasetFromUrl(urlToFetch, savedUrl ? 'Custom Live URL' : 'New Replaced Dataset');
    }
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

  // --- Fetch Data from URL ---
  const fetchDatasetFromUrl = async (url: string, source: string = 'Live Data') => {
    setIsLoading(true);
    setStatusMessage(`Fetching dataset from ${source}...`);
    setStatusType('info');

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const csvText = await response.text();
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastUpdated(nowStr);
      parseCSVData(csvText, source, false);
    } catch (error) {
      console.error("Fetch error:", error);
      setIsLoading(false);
      setStatusMessage('Failed to load dataset from URL. Check link or use manual upload.');
      setStatusType('error');
    }
  };

  // --- Parsing CSV ---
  const parseCSVData = (csvString: string, source: string, shouldPersist: boolean = false) => {
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
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastUpdated(timestamp);

        if (shouldPersist) {
          try {
            localStorage.setItem('saved_dataset_csv', csvString);
            localStorage.setItem('saved_dataset_source', source);
            localStorage.setItem('saved_dataset_time', timestamp);
          } catch (e) {
            console.warn('Storage limit reached or failed to persist CSV:', e);
          }
        }

        setStatusMessage(`Dataset loaded: ${data.length.toLocaleString()} rows (${source})`);
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
  const handleLocalFile = (file: File, persist: boolean = false) => {
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
        parseCSVData(text, file.name, persist);
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
      handleLocalFile(file, false);
    }
  };

  const handleModalFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleLocalFile(file, saveToStorage);
      setIsDatasetModalOpen(false);
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
      handleLocalFile(file, false);
    }
  };

  // --- Download Current Dataset ---
  const exportCurrentDataset = () => {
    if (allData.length === 0) return;
    const csvContent = Papa.unparse(allData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Party_3_Dataset_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Reset to Default Dataset ---
  const handleResetToDefault = () => {
    localStorage.removeItem('saved_dataset_csv');
    localStorage.removeItem('saved_dataset_source');
    localStorage.removeItem('saved_dataset_time');
    localStorage.removeItem('saved_dataset_url');
    setCustomUrlInput(DEFAULT_DATA_URL);
    fetchDatasetFromUrl(DEFAULT_DATA_URL, 'New Replaced Dataset');
    setIsDatasetModalOpen(false);
  };

  // --- Quick Refresh ---
  const handleQuickRefresh = () => {
    const savedUrl = localStorage.getItem('saved_dataset_url');
    const savedCsv = localStorage.getItem('saved_dataset_csv');
    if (savedCsv) {
      const savedSource = localStorage.getItem('saved_dataset_source') || 'Saved Local Dataset';
      parseCSVData(savedCsv, savedSource, false);
    } else {
      const urlToFetch = savedUrl || DEFAULT_DATA_URL;
      fetchDatasetFromUrl(urlToFetch, savedUrl ? 'Custom Live URL' : 'New Replaced Dataset');
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

          <div className="flex items-center space-x-3">
            {/* Quick Refresh Button */}
            <button
              onClick={handleQuickRefresh}
              disabled={isLoading}
              title="Refresh / Re-fetch dataset"
              className="p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40 text-slate-700 dark:text-slate-300 disabled:opacity-50"
              aria-label="Refresh Dataset"
            >
              <RefreshCw className={`w-4.5 h-4.5 ${isLoading ? 'animate-spin text-teal-500' : ''}`} />
            </button>

            {/* Live indicator badge */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200/50 dark:border-teal-800/50 rounded-full text-xs font-semibold text-teal-700 dark:text-teal-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
              <span>Active</span>
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

            {/* Quick Upload / Dataset Override Action Dropzone */}
            <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 pt-6 lg:pt-0 lg:pl-6 flex flex-col justify-center">
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span>Upload or Override</span>
                  </span>
                </div>
                
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
                  <FileSpreadsheet className="w-7 h-7 text-slate-400 group-hover:text-teal-500 transition-colors mb-1.5" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    Click to browse or drop CSV
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Instant local parse (Party_3 format)
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

            {/* Quick stats badges & actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {lastUpdated && (
                <span className="text-xs bg-slate-200/60 dark:bg-slate-850 px-2.5 py-1 rounded-full text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 border border-slate-300/20">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{lastUpdated}</span>
                </span>
              )}
              <span className="text-xs bg-slate-200/60 dark:bg-slate-850 px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-300 font-bold border border-slate-300/20">
                Source: <span className="text-teal-600 dark:text-teal-400 max-w-[120px] truncate inline-block align-bottom">{sourceName}</span>
              </span>
              {allData.length > 0 && (
                <span id="recordCount" className="text-xs font-bold bg-teal-100 dark:bg-teal-400/10 px-2.5 py-1 rounded-full text-teal-800 dark:text-teal-300 border border-teal-200/20">
                  {allData.length.toLocaleString()} Records
                </span>
              )}
              {allData.length > 0 && (
                <button
                  onClick={exportCurrentDataset}
                  title="Download current CSV"
                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
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
                Enter any term or name part inside the search bar. The engine will instantly run high-performance filtering against the loaded active dataset rows ({allData.length.toLocaleString()} records).
              </p>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Dataset Management Modal */}
      <AnimatePresence>
        {isDatasetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 rounded-xl">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Dataset Management</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Update, switch, or customize your active records</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDatasetModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-3 gap-4 bg-slate-50/30 dark:bg-slate-950/30">
                <button
                  onClick={() => setModalTab('url')}
                  className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    modalTab === 'url'
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Live URL</span>
                </button>
                <button
                  onClick={() => setModalTab('upload')}
                  className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    modalTab === 'upload'
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload CSV</span>
                </button>
                <button
                  onClick={() => setModalTab('paste')}
                  className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                    modalTab === 'paste'
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Paste CSV</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4">
                {modalTab === 'url' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                        Dataset Web / Raw URL
                      </label>
                      <input
                        type="url"
                        value={customUrlInput}
                        onChange={(e) => setCustomUrlInput(e.target.value)}
                        placeholder="https://raw.githubusercontent.com/.../Party_3.csv"
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        Provide any direct link to a raw CSV file (e.g. GitHub raw, GitLab, Google Sheets published as CSV, etc.). Must include a <span className="font-mono text-teal-600 dark:text-teal-400 font-semibold">Party_3</span> column.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <button
                        onClick={() => {
                          if (!customUrlInput.trim()) return;
                          localStorage.setItem('saved_dataset_url', customUrlInput.trim());
                          localStorage.removeItem('saved_dataset_csv');
                          fetchDatasetFromUrl(customUrlInput.trim(), 'Custom Live URL');
                          setIsDatasetModalOpen(false);
                        }}
                        className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Fetch & Set Active URL</span>
                      </button>

                      <button
                        onClick={handleResetToDefault}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Reset to Default Dataset</span>
                      </button>
                    </div>
                  </div>
                )}

                {modalTab === 'upload' && (
                  <div className="space-y-4">
                    <div 
                      onClick={() => modalFileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-teal-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/60 dark:bg-slate-950/60 hover:bg-teal-50/10 transition-all flex flex-col items-center justify-center"
                    >
                      <input 
                        type="file" 
                        ref={modalFileInputRef}
                        accept=".csv"
                        onChange={handleModalFileInputChange}
                        className="hidden" 
                      />
                      <Upload className="w-10 h-10 text-teal-600 dark:text-teal-400 mb-3" />
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Choose or Drop a .CSV File
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                        File will immediately load and replace the active search memory table.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="checkbox"
                        id="persistCheckbox"
                        checked={saveToStorage}
                        onChange={(e) => setSaveToStorage(e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <label htmlFor="persistCheckbox" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                        Remember this dataset in browser storage across page reloads
                      </label>
                    </div>
                  </div>
                )}

                {modalTab === 'paste' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                        Paste Raw CSV Content
                      </label>
                      <textarea
                        rows={7}
                        value={rawCsvInput}
                        onChange={(e) => setRawCsvInput(e.target.value)}
                        placeholder={`Party_3,Description,Region\nShwebo PDF,Regional defense,Sagaing\n...`}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none resize-none"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="persistPasteCheckbox"
                          checked={saveToStorage}
                          onChange={(e) => setSaveToStorage(e.target.checked)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <label htmlFor="persistPasteCheckbox" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                          Remember in browser storage
                        </label>
                      </div>

                      <button
                        onClick={() => {
                          if (!rawCsvInput.trim()) return;
                          parseCSVData(rawCsvInput.trim(), 'Pasted CSV Data', saveToStorage);
                          setIsDatasetModalOpen(false);
                          setRawCsvInput('');
                        }}
                        disabled={!rawCsvInput.trim()}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Parse & Apply</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Current Dataset Overview Footer */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
                  <div>
                    Currently: <strong className="text-slate-800 dark:text-slate-200">{allData.length.toLocaleString()} rows</strong> ({sourceName})
                  </div>
                  {allData.length > 0 && (
                    <button
                      onClick={exportCurrentDataset}
                      className="text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 w-fit font-medium"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download backup CSV</span>
                    </button>
                  )}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer & Warnings */}
      <footer className="mt-auto py-8 px-4 text-center space-y-4 border-t border-slate-200 dark:border-slate-900/60 bg-white/40 dark:bg-slate-950/40 backdrop-blur-sm relative z-10">
        <div className="max-w-3xl mx-auto p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300 shadow-sm flex items-center justify-center space-x-3 text-sm font-semibold tracking-wide">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-600 dark:text-rose-400" />
          <span>CONFIDENTIAL: Unauthorized use, disclosure, or distribution is strictly prohibited.</span>
        </div>
        
        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium max-w-2xl mx-auto leading-relaxed">
          {lastUpdated ? `Dataset status: Updated at ${lastUpdated} (${sourceName}). ` : 'Note: Dataset loaded from active repository. '}
          Further updates required to revise several names.
        </p>
      </footer>
    </div>
  );
}
