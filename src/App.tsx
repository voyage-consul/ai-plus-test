import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { 
  Users, UserCheck, UserMinus, BarChart2, PieChart, TrendingUp, TrendingDown,
  CheckCircle, XCircle, AlertCircle, Info, Table, Loader2, LayoutDashboard,
  ClipboardList, CalendarCheck, ChevronDown, LogOut, ChevronLeft, ChevronRight,
  RefreshCw, Edit3, Calendar, Filter 
} from 'lucide-react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Area
} from 'recharts';

// ============================================
// ===== 案件設定（ここだけ変更してください） =====
// ============================================
const CONFIG = {
  TITLE: 'AI+ LINEダッシュボード',
  CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQiwOvB1RCZ38CYVdKK76XDKRQQv4XTpV56TpYVBCo6-AcRFWac7jESNNDkRf-iBLAlNEESY240sKhX/pub?gid=1072960483&single=true&output=csv',
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1I7TYT_ceamL0mt-U_8I12Q9S3FYTW6ejHSkHZAgzhrQ/edit?gid=1072960483#gid=1072960483',
  PROXY_URL: 'https://line-dashboard-proxy.raspy-wood-9b0d.workers.dev',
  GOOGLE_CLIENT_ID: '813216912152-hf6cden86ijta1qjc67uvscdlhmi85sl.apps.googleusercontent.com',
  SHEET_NAME: 'テスト用（触らない）',
  // ※ AI Studio → CSV_URL使用 / GitHub Pages → 自動でプロキシ経由（手動切替不要）
};
// ============================================

const COLORS = { 
  primary: "#0067b8", secondary: "#00A4EF", success: "#107c10", 
  warning: "#ffb900", danger: "#d13438", info: "#0078d4", 
  muted: "#666666", accent: "#9bf00b",
  positive: "#0067b8",
  negative: "#d13438",
};

const PIE_COLORS = [
  "#0067b8", "#107c10", "#00A4EF", "#ffb900", "#d13438", 
  "#0078d4", "#881798", "#00b294", "#e3008c", "#ff8c00", "#00188f"
];

// Helper Functions
const getSheetId = (url: string) => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : url;
};

const parseDate = (dateStr: any) => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s) return null;
  const match = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (match) {
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    return isNaN(d.getTime()) ? null : d;
  }
  const normalized = s.replace(/^(\d{4}-\d{2}-\d{2})\s/, '$1T');
  const date = new Date(normalized);
  return isNaN(date.getTime()) ? null : date;
};

const formatDay = (d: Date | null) => d ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}` : null;
const formatMonth = (d: Date | null) => d ? `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月` : null;

// Weekly logic
const WEEK_START_DAY = 1; // 1 = Monday
const getWeekRange = (d: Date | null) => {
  if (!d) return null;
  const day = d.getDay();
  const diff = (day - WEEK_START_DAY + 7) % 7;
  const start = new Date(d); start.setDate(d.getDate() - diff);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const fmt = (dt: Date) => `${dt.getMonth() + 1}月${dt.getDate()}日`;
  return `${start.getFullYear()}年${fmt(start)}〜${fmt(end)}`;
};

const hasTag = (val: any) => { if (!val) return false; const s = String(val).trim(); return s !== '' && s !== '0'; };
const isTrue = (val: any) => { if (!val) return false; const s = String(val).trim(); return s === '1' || s === '１' || s.toLowerCase() === 'true'; };
const getFuzzyKey = (keys: string[], keywords: string[], exclude: string[] = []) => keys.find(k => keywords.every(kw => k.includes(kw)) && !exclude.some(ex => k.includes(ex)));

// Components
const IconComp = ({ name, size = 18, className = "" }: any) => {
  const m: any = { 
    'users': Users, 'user-check': UserCheck, 'user-minus': UserMinus,
    'bar-chart-2': BarChart2, 'pie-chart': PieChart, 'trending-up': TrendingUp,
    'trending-down': TrendingDown, 'check-circle': CheckCircle, 'x-circle': XCircle,
    'alert-circle': AlertCircle, 'info': Info, 'table': Table, 'loader-2': Loader2,
    'layout-dashboard': LayoutDashboard, 'clipboard-list': ClipboardList,
    'calendar-check': CalendarCheck, 'chevron-down': ChevronDown, 'log-out': LogOut,
    'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
    'refresh-cw': RefreshCw, 'edit-3': Edit3, 'calendar': Calendar, 'filter': Filter 
  };
  const I = m[name]; return I ? <I size={size} className={className} /> : null;
};

const InfoTooltip = ({ text }: { text: string }) => (
  <div className="relative group inline-flex items-center ml-1.5 z-[100]">
    <Info size={14} className="text-[#666] cursor-help hover:text-[#0067b8] transition-colors" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max max-w-[320px] bg-[#1a1a1a] text-white text-[12px] p-3 rounded-lg shadow-xl whitespace-pre-wrap leading-relaxed pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[100]">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-[#1a1a1a]" />
    </div>
  </div>
);

const KPICard = ({ title, value, unit, icon, info, subText, change, changeLabel, editable, onValueChange, isEditing }: any) => {
  return (
    <div className="card p-5 card-hover flex flex-col justify-between min-h-[120px]">
      <div className="flex justify-between items-start mb-3">
        <div className="p-2 rounded-lg bg-[#f2f2f2]">
          <IconComp name={icon} size={20} className="text-[#0067b8]" />
        </div>
      </div>
      <div>
        <h3 className="text-[#666] text-[11px] font-semibold tracking-wide uppercase mb-1 flex items-center">
          {title}{info && <InfoTooltip text={info} />}
        </h3>
        <div className="flex items-baseline gap-1.5">
          {editable && isEditing ? (
            <input 
              type="text" 
              className="text-[32px] font-bold text-[#000] tracking-tight leading-none bg-yellow-50 border border-yellow-200 outline-none w-24 rounded px-1"
              value={value}
              onChange={(e) => onValueChange && onValueChange(e.target.value)}
            />
          ) : (
            <span className="text-[32px] font-bold text-[#000] tracking-tight leading-none">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
          )}
          <span className="text-[#666] text-xs font-semibold">{unit}</span>
        </div>
        {change != null && !isNaN(change) && isFinite(change) && (
          <div className="flex items-center gap-1 mt-1.5">
            <IconComp name={change >= 0 ? 'trending-up' : 'trending-down'} size={12}
              className={change >= 0 ? 'text-[#0067b8]' : 'text-[#d13438]'} />
            <span className={`text-[11px] font-bold ${change >= 0 ? 'text-[#0067b8]' : 'text-[#d13438]'}`}>
              {change > 0 ? '+' : ''}{change.toFixed(1)}%
            </span>
            {changeLabel && <span className="text-[10px] text-[#666] ml-0.5">{changeLabel}</span>}
          </div>
        )}
        {change == null && (
          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-[11px] font-bold text-[#666]">—</span>
            {changeLabel && <span className="text-[10px] text-[#666] ml-0.5">{changeLabel}</span>}
          </div>
        )}
        {subText && <p className="text-[11px] text-[#666] mt-1">{subText}</p>}
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white p-4 rounded-lg shadow-xl border border-[#f2f2f2] text-xs z-[100]">
      <p className="font-semibold text-[#000] mb-2 text-sm">{label}</p>
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="text-[#666]">{e.name}:</span>
          <span className="font-bold text-[#000]">{e.value?.toLocaleString() || 0}{e.name.includes('率') ? '%' : ''}</span>
        </div>
      ))}
    </div>
  );
};

// --- Login Screen ---
const LoginScreen = ({ onLogin }: { onLogin: (token: string) => void }) => {
  const loginRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderButton = () => {
      if (window.google && loginRef.current) {
        window.google.accounts.id.initialize({
          client_id: CONFIG.GOOGLE_CLIENT_ID,
          callback: (response: any) => {
            localStorage.setItem('google_id_token', response.credential);
            onLogin(response.credential);
          },
        });
        window.google.accounts.id.renderButton(loginRef.current, {
          theme: 'outline', size: 'large', width: 300,
        });
      }
    };

    if (window.google) {
      renderButton();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = renderButton;
    document.head.appendChild(script);
  }, [onLogin]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f9f9f9]">
      <h1 className="text-[24px] font-semibold mb-8 text-black">{CONFIG.TITLE}</h1>
      <div ref={loginRef} className="bg-white p-6 rounded-lg shadow-md border border-[#f2f2f2]"></div>
    </div>
  );
};

// --- Main App ---
export default function App() {
  const isDeployed = window.location.hostname.includes('github.io');
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [token, setToken] = useState<string | null>(localStorage.getItem('google_id_token'));
  const [isEditing, setIsEditing] = useState(false);
  const [timeGranularity, setTimeGranularity] = useState<'month' | 'week' | 'day'>('month');
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  
  // Custom edit overrides
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const channelDropdownRef = useRef<HTMLDivElement>(null);
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [isChannelOpen, setIsChannelOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setIsPeriodOpen(false);
      }
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(event.target as Node)) {
        setIsChannelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let rows = [];

      const fetchViaCSV = (url: string): Promise<any[]> => {
        return new Promise((resolve, reject) => {
          Papa.parse(url, {
            download: true, header: true, skipEmptyLines: true,
            transformHeader: (h) => h.trim(),
            complete: (r) => resolve(r.data),
            error: (e) => reject(e)
          });
        });
      };

      const fetchViaProxy = async (): Promise<any[]> => {
        const t = localStorage.getItem('google_id_token');
        const res = await fetch(`${CONFIG.PROXY_URL}/sheets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
          body: JSON.stringify({ sheetId: getSheetId(CONFIG.SHEET_URL), sheetName: CONFIG.SHEET_NAME })
        });
        if (res.status === 401) {
          localStorage.removeItem('google_id_token');
          setToken(null);
          return [];
        }
        if (res.status === 403) throw new Error('アクセス権がありません。スプレッドシートの共有設定を確認してください。');
        const json = await res.json();
        if (!json.rows || !json.headers) throw new Error('プロキシのレスポンス形式が不正です');
        return json.rows.map((row: any[]) => {
          const o: any = {};
          json.headers.forEach((h: string, i: number) => { o[h] = row[i] || '' });
          return o;
        });
      };

      if (isDeployed) {
        if (!token) return; // Wait for login
        rows = await fetchViaProxy();
      } else {
        if (CONFIG.CSV_URL) {
          rows = await fetchViaCSV(CONFIG.CSV_URL);
        } else {
          rows = await fetchViaProxy();
        }
      }
      setData(rows);
    } catch (err: any) {
      setError(err.message || 'データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [isDeployed, token]);

  useEffect(() => {
    if (!isDeployed || token) {
      fetchData();
    }
  }, [fetchData, isDeployed, token]);

  // Window alert for unsaved edits
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditing) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditing]);

  // Logic: Process Data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Find keys to handle column name flexibility
    const dateKey = getFuzzyKey(Object.keys(data[0]), ['友だち追加日時']) || '友だち追加日時';
    
    return data.map(row => {
      const parsedDate = parseDate(row[dateKey]);
      
      return {
        ...row,
        _date: parsedDate,
        _day: formatDay(parsedDate),
        _week: getWeekRange(parsedDate),
        _month: formatMonth(parsedDate),
        _isBlock: isTrue(row['ユーザーブロック']),
      };
    });
  }, [data]);

  // Derived filters (Periods, Channels)
  const availablePeriods = useMemo(() => {
    const key = `_${timeGranularity}`;
    const periods = Array.from(new Set(processedData.map(d => d[key]).filter(Boolean))) as string[];
    // Sort chronologically
    return periods.sort((a, b) => a.localeCompare(b));
  }, [processedData, timeGranularity]);

  const availableChannels = useMemo(() => {
    // 経路は「流入経路名」や「流入経路名@」等
    const channelKey = getFuzzyKey(Object.keys(data[0] || {}), ['流入経路名']);
    if (!channelKey) return [];
    return Array.from(new Set(processedData.map(d => d[channelKey]).filter(Boolean))) as string[];
  }, [data, processedData]);

  // Category mapping based on instruction
  const getChannelCategory = (channel: string) => {
    if (['b01_Googleリスティング', 'b02_Meta', 'b03_副業向け_好きな場所で好きな時間に'].includes(channel)) return '広告流入';
    if (['Instagtam', 'Tiktok', 'X流入', 'n01_プレス記事→LP', 'y01_YouTube_REALVALUE', 'y04_YouTube_REALVALUE'].includes(channel)) return 'オーガニック';
    if (['スクール全体チラシ'].includes(channel)) return 'その他';
    return '未分類';
  };

  // Filter Data
  const filteredData = useMemo(() => {
    let filtered = processedData;
    
    // Time filter
    if (selectedPeriods.length > 0 && !selectedPeriods.includes('all')) {
      const key = `_${timeGranularity}`;
      filtered = filtered.filter(d => selectedPeriods.includes(d[key]));
    }
    
    // Channel filter
    if (selectedChannels.length > 0 && !selectedChannels.includes('all')) {
      const channelKey = getFuzzyKey(Object.keys(data[0] || {}), ['流入経路名']);
      if (channelKey) {
        filtered = filtered.filter(d => selectedChannels.includes(d[channelKey]));
      }
    }
    
    return filtered;
  }, [processedData, timeGranularity, selectedPeriods, selectedChannels, data]);

  // Metrics Calculation
  const metrics = useMemo(() => {
    const total = filteredData.length;
    const blockCount = filteredData.filter(d => d._isBlock).length;
    const active = total - blockCount;

    const cvCount = filteredData.filter(d => isTrue(d['面談予約済'])).length;
    const contractCount = filteredData.filter(d => isTrue(d['契約済'])).length;
    
    const cvRate = active > 0 ? (cvCount / active) * 100 : 0;
    const contractRate = active > 0 ? (contractCount / active) * 100 : 0;
    
    const pushBase = filteredData.filter(d => isTrue(d['シナリオ読了済'])).length;
    const pushCount = filteredData.filter(d => isTrue(d['プッシュ配信_タップ'])).length;
    const pushTapRate = pushBase > 0 ? (pushCount / pushBase) * 100 : 0;
    
    const richMenuTapCount = filteredData.filter(d => isTrue(d['リッチメニューから予約_タップ'])).length;
    const richMenuTapRate = total > 0 ? (richMenuTapCount / total) * 100 : 0;

    // Previous period calculation
    const getPreviousPeriodData = () => {
      // Find the "current" latest period selected
      let currentPeriod = '';
      if (selectedPeriods.length > 0 && !selectedPeriods.includes('all')) {
        // Just take the latest one they selected for comparison simplicity
        currentPeriod = selectedPeriods.sort().reverse()[0];
      } else {
        currentPeriod = availablePeriods[availablePeriods.length - 1]; // latest available
      }
      
      const currentIndex = availablePeriods.indexOf(currentPeriod);
      if (currentIndex <= 0) return null; // No previous period
      
      const prevPeriod = availablePeriods[currentIndex - 1];
      const prevData = processedData.filter(d => d[`_${timeGranularity}`] === prevPeriod);
      
      // Calculate prev metrics
      const prevTotal = prevData.length;
      const prevBlock = prevData.filter(d => d._isBlock).length;
      const prevActive = prevTotal - prevBlock;
      const prevCv = prevData.filter(d => isTrue(d['面談予約済'])).length;
      const prevContract = prevData.filter(d => isTrue(d['契約済'])).length;
      
      const prevCvRate = prevActive > 0 ? (prevCv / prevActive) * 100 : 0;
      const prevContractRate = prevActive > 0 ? (prevContract / prevActive) * 100 : 0;
      
      return {
        total: total > 0 && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null,
        cvRate: prevActive > 0 ? (cvRate - prevCvRate) : null, // Point diff
        contractRate: prevActive > 0 ? (contractRate - prevContractRate) : null,
      };
    };

    const changes = getPreviousPeriodData();

    // Top Channel calculation
    const channelKey = getFuzzyKey(Object.keys(data[0] || {}), ['流入経路名']);
    let topChannel = null;
    let topChannelRate = 0;
    if (channelKey) {
      const channelStats = processedData.reduce((acc: any, row) => {
        const c = row[channelKey];
        if (!c) return acc;
        if (!acc[c]) acc[c] = { total: 0, blocks: 0, cvs: 0 };
        acc[c].total += 1;
        if (row._isBlock) acc[c].blocks += 1;
        if (isTrue(row['面談予約済'])) acc[c].cvs += 1;
        return acc;
      }, {});
      
      Object.keys(channelStats).forEach(c => {
        const stats = channelStats[c];
        const act = stats.total - stats.blocks;
        if (stats.total >= 30 && act > 0) { // Require 30 total to be considered valid
          const cr = (stats.cvs / act) * 100;
          if (cr > topChannelRate) {
            topChannel = c;
            topChannelRate = cr;
          }
        }
      });
    }

    return {
      total,
      active,
      blockCount,
      blockRate: total > 0 ? (blockCount / total) * 100 : 0,
      cvCount,
      cvRate,
      contractCount,
      contractRate,
      pushBase,
      pushTapRate,
      richMenuTapCount,
      richMenuTapRate,
      changes,
      topChannel,
      topChannelRate
    };
  }, [filteredData, processedData, timeGranularity, selectedPeriods, availablePeriods, data]);

  // Scenario Table Data
  const scenarioSteps = [
    { target: '登録直後_対象者', tap: '登録直後_タップ', label: '1通目_登録直後' },
    { target: '2通目_対象者', tap: '2通目_タップ', label: '2通目' },
    { target: '3通目_対象者', tap: '3通目_タップ', label: '3通目' },
    { target: '4通目_対象者', tap: '4通目_タップ', label: '4通目' },
    { target: '5通目_対象者', tap: '5通目_タップ', label: '5通目' },
    { target: '6通目_対象者', tap: '6通目_タップ', label: '6通目' },
    { target: '7通目_対象者', tap: '7通目_タップ', label: '7通目' },
    { target: '8通目_対象者', tap: '8通目_タップ', label: '8通目' },
    { target: '9通目_対象者', tap: '9通目_タップ', label: '9通目' },
    { target: '10通目_対象者', tap: '10通目_タップ', label: '10通目' },
  ];

  const calcStepStats = (rows: any[], step: typeof scenarioSteps[0]) => {
    const target = rows.filter(r => isTrue(r[step.target])).length;
    const tap = rows.filter(r => isTrue(r[step.tap])).length;
    return { target, tap, rate: target > 0 ? (tap / target) * 100 : 0 };
  };

  // Timeline Data for Chart
  const timeChartData = useMemo(() => {
    const key = `_${timeGranularity}`;
    return availablePeriods.map(p => {
      const rows = processedData.filter(d => d[key] === p);
      const acts = rows.filter(d => !d._isBlock).length;
      const cvs = rows.filter(r => isTrue(r['面談予約済'])).length;
      return {
        name: String(p).replace('2025年', '').replace('2026年', ''), // Shorten label
        流入数: rows.length,
        CV数: cvs,
        成約率: acts > 0 ? Number(((cvs / acts) * 100).toFixed(1)) : 0,
      };
    });
  }, [availablePeriods, processedData, timeGranularity]);

  const lastUpdate = availablePeriods.length > 0 ? availablePeriods[availablePeriods.length - 1] : '-';

  if (isDeployed && !token) {
    return <LoginScreen onLogin={setToken} />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-[#0067b8] mb-4" size={32} />
        <p className="text-[#666] font-medium">データを読み込んでいます...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-[#f9f9f9]">
        <AlertCircle size={48} className="text-[#d13438] mb-4" />
        <h2 className="text-xl font-semibold mb-2">データ取得エラー</h2>
        <p className="text-[#666] mb-6">{error}</p>
        <button onClick={fetchData} className="btn-primary flex items-center gap-2">
          <RefreshCw size={16} /> 再試行
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f9f9] pb-24 text-[14px]">
      {/* Header */}
      <header className="bg-white border-b border-[#f2f2f2] sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-[24px] font-semibold tracking-tight text-[#000]">
              {CONFIG.TITLE}
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[#666] font-medium">有効データ: {lastUpdate}</span>
              <button 
                onClick={fetchData} 
                className="p-2 text-[#666] hover:bg-[#f2f2f2] rounded-md transition-colors"
                title="データを更新"
              >
                <RefreshCw size={18} />
              </button>
              <button 
                onClick={() => setIsEditing(!isEditing)} 
                className={`p-2 rounded-md transition-colors flex items-center gap-1 ${isEditing ? 'bg-yellow-100 text-yellow-700' : 'text-[#666] hover:bg-[#f2f2f2]'}`}
                title="編集モード"
              >
                <Edit3 size={18} />
              </button>
              {isDeployed && (
                <button 
                  onClick={() => { localStorage.removeItem('google_id_token'); setToken(null); }}
                  className="p-2 text-[#d13438] hover:bg-[#ffebeb] rounded-md transition-colors"
                  title="ログアウト"
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </div>
          
          {/* Filters Row */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex bg-[#f2f2f2] p-1 rounded-md">
              <button className={`px-4 py-1.5 text-[12px] font-semibold rounded ${timeGranularity==='month'?'bg-white shadow-sm text-black':'text-[#666]'}`} onClick={()=>setTimeGranularity('month')}>月次</button>
              <button className={`px-4 py-1.5 text-[12px] font-semibold rounded ${timeGranularity==='week'?'bg-white shadow-sm text-black':'text-[#666]'}`} onClick={()=>setTimeGranularity('week')}>週次</button>
              <button className={`px-4 py-1.5 text-[12px] font-semibold rounded ${timeGranularity==='day'?'bg-white shadow-sm text-black':'text-[#666]'}`} onClick={()=>setTimeGranularity('day')}>日次</button>
            </div>
            
            {/* Period Multi-select */}
            <div className="relative" ref={periodDropdownRef}>
              <button 
                className={`btn-secondary flex items-center gap-2 ${isPeriodOpen ? 'active' : ''}`}
                onClick={() => setIsPeriodOpen(!isPeriodOpen)}
              >
                <Calendar size={14}/>
                {selectedPeriods.length===0 || selectedPeriods.includes('all') ? '全期間' : `${selectedPeriods.length}期間選択中`}
                <ChevronDown size={14} className={`transition-transform ${isPeriodOpen ? 'rotate-180' : ''}`} />
              </button>
              {isPeriodOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-[#f2f2f2] rounded-md shadow-lg w-[220px] max-h-[300px] overflow-y-auto z-50">
                  <label className="flex items-center px-4 py-2 hover:bg-[#f9f9f9] cursor-pointer border-b border-[#f2f2f2] font-semibold sticky top-0 bg-white">
                    <input type="checkbox" className="mr-2" 
                      checked={selectedPeriods.length===0 || selectedPeriods.includes('all')} 
                      onChange={(e)=>{
                        if(e.target.checked) setSelectedPeriods(['all']);
                        else setSelectedPeriods([]);
                      }} /> 全期間
                  </label>
                  {availablePeriods.map(p => (
                    <label key={p} className="flex items-center px-4 py-2 hover:bg-[#f9f9f9] cursor-pointer">
                      <input type="checkbox" className="mr-2"
                        checked={selectedPeriods.includes(p)}
                        onChange={(e)=>{
                          if(e.target.checked) {
                            setSelectedPeriods(prev => prev.includes('all') ? [p] : [...prev, p]);
                          } else {
                            setSelectedPeriods(prev => prev.filter(x => x !== p));
                          }
                        }}
                      /> {p}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Channel Multi-select */}
            <div className="relative" ref={channelDropdownRef}>
              <button 
                className={`btn-secondary flex items-center gap-2 ${isChannelOpen ? 'active' : ''}`}
                onClick={() => setIsChannelOpen(!isChannelOpen)}
              >
                <Filter size={14}/>
                {selectedChannels.length===0 || selectedChannels.includes('all') ? '全流入経路' : `${selectedChannels.length}経路選択中`}
                <ChevronDown size={14} className={`transition-transform ${isChannelOpen ? 'rotate-180' : ''}`} />
              </button>
              {isChannelOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-[#f2f2f2] rounded-md shadow-lg w-[260px] max-h-[400px] overflow-y-auto z-50">
                  <label className="flex items-center px-4 py-2 hover:bg-[#f9f9f9] cursor-pointer font-semibold border-b border-[#f2f2f2] sticky top-0 bg-white z-10">
                    <input type="checkbox" className="mr-2" 
                      checked={selectedChannels.length===0 || selectedChannels.includes('all')} 
                      onChange={(e)=>{
                        if(e.target.checked) setSelectedChannels(['all']);
                        else setSelectedChannels([]);
                      }} /> すべての流入経路
                  </label>
                  {['オーガニック', '広告流入', 'その他'].map(cat => (
                    <div key={cat}>
                      <div className="px-3 py-1 bg-[#f9f9f9] text-[11px] font-bold text-[#666] uppercase mt-1">{cat}</div>
                      {availableChannels.filter(c => getChannelCategory(c) === cat).map(c => (
                        <label key={c} className="flex items-center px-4 py-1.5 hover:bg-[#f2f2f2] cursor-pointer text-[13px]">
                          <input type="checkbox" className="mr-2"
                            checked={selectedChannels.includes(c)}
                            onChange={(e)=>{
                              if(e.target.checked) {
                                setSelectedChannels(prev => prev.includes('all') ? [c] : [...prev, c]);
                              } else {
                                setSelectedChannels(prev => prev.filter(x => x !== c));
                              }
                            }}
                          /> {c || '(空欄)'}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {isEditing && (
            <div className="mt-3 p-2 bg-yellow-100 border border-yellow-200 text-yellow-800 text-xs rounded-md font-semibold animate-fadeIn flex justify-center items-center gap-2">
              <AlertCircle size={14}/>
              編集モード: 変更は一時的です。リロードすると元に戻ります。
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-8 animate-fadeIn">
        
        {/* Highlight Channel Banner */}
        {metrics.topChannel && !isEditing && (
           <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-4 flex items-center gap-4">
             <div className="p-2 bg-blue-100 rounded-full text-blue-700"><TrendingUp size={20}/></div>
             <div>
               <p className="text-xs text-blue-800 font-semibold mb-0.5">優秀な流入経路</p>
               <p className="text-sm font-bold text-gray-900">
                 🏆 成約率最高: {metrics.topChannel} <span className="text-blue-700 ml-1">({metrics.topChannelRate.toFixed(1)}%)</span>
               </p>
             </div>
           </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <KPICard 
            title="総登録数" 
            value={editValues['total'] || metrics.total} 
            unit="人" 
            icon="users"
            info="全行数（ブロック含む）"
            change={metrics.changes?.total}
            changeLabel={timeGranularity==='month'?'前月比':timeGranularity==='week'?'前週比':'前日比'}
            editable={true} isEditing={isEditing} onValueChange={(v:string)=>setEditValues({...editValues, total: v})}
          />
          <KPICard 
            title="アクティブ登録数" 
            value={editValues['active'] || metrics.active} 
            unit="人" 
            icon="user-check"
            info="[全行数] - [ユーザーブロック=1]"
            subText={`ブロック数: ${metrics.blockCount} (${metrics.blockRate.toFixed(1)}%)`}
            editable={true} isEditing={isEditing} onValueChange={(v:string)=>setEditValues({...editValues, active: v})}
          />
          <KPICard 
            title="面談予約数" 
            value={editValues['cvCount'] || metrics.cvCount} 
            unit="件" 
            icon="calendar-check"
            info="「面談予約済」タグがあるユーザー数"
            change={metrics.changes?.cvRate}
            changeLabel="ポイント (前期間比)"
            subText={`成約率: ${metrics.cvRate.toFixed(1)}%`}
            editable={true} isEditing={isEditing} onValueChange={(v:string)=>setEditValues({...editValues, cvCount: v})}
          />
          <KPICard 
            title="契約完了数" 
            value={editValues['contractCount'] || metrics.contractCount} 
            unit="件" 
            icon="check-circle"
            info="「契約済」タグがあるユーザー数"
            change={metrics.changes?.contractRate}
            changeLabel="ポイント (前期間比)"
            subText={`契約率: ${metrics.contractRate.toFixed(1)}%`}
            editable={true} isEditing={isEditing} onValueChange={(v:string)=>setEditValues({...editValues, contractCount: v})}
          />
          <KPICard 
            title="プッシュ・RM タップ率" 
            value={Number((editValues['pushRate'] || metrics.pushTapRate).toString()) || 0} 
            unit="%" 
            icon="TrendingUp"
            info="プッシュ: [プッシュ配信_タップ] / [シナリオ読了済] \nRM: [リッチメニューから予約_タップ] / [総登録数]"
            subText={`RM予約率: ${metrics.richMenuTapRate.toFixed(1)}%`}
            editable={true} isEditing={isEditing} onValueChange={(v:string)=>setEditValues({...editValues, pushRate: v})}
          />
        </div>

        {/* Matrix Table */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Table size={20} className="text-[#0067b8]" />
            <h2 className="text-[18px] font-semibold text-[#000]">ファネル集計マトリクス</h2>
            <InfoTooltip text="各ステップ（通目）ごとの推移と歩留まりを時系列または経路別に確認できます。"/>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap min-w-[800px]">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white z-20 pb-2 border-b-2 border-[#d2d2d2] min-w-[120px]">
                    <span className="text-[11px] font-bold text-[#666] uppercase">{timeGranularity==='month'?'月':timeGranularity==='week'?'週':'日'}</span>
                  </th>
                  {scenarioSteps.map((step, idx) => (
                    <th key={idx} colSpan={3} className="text-center pb-2 border-b-2 border-[#d2d2d2] border-l-2 bg-[#f9f9f9] px-2 font-semibold text-[#000]">
                      {step.label}
                    </th>
                  ))}
                  <th colSpan={3} className="text-center pb-2 border-b-2 border-[#d2d2d2] border-l-2 bg-[#f2f2f2] px-2 font-semibold text-[#0067b8]">
                    全体 CV
                  </th>
                </tr>
                <tr>
                  <th className="sticky left-0 bg-white z-20 py-2 border-b border-[#f2f2f2]"></th>
                  {scenarioSteps.map((step, idx) => (
                    <React.Fragment key={idx}>
                      <th className="text-[11px] text-[#666] font-medium p-2 border-b border-[#f2f2f2] border-l-2 border-[#d2d2d2] bg-[#f9f9f9]">対象</th>
                      <th className="text-[11px] text-[#666] font-medium p-2 border-b border-[#f2f2f2] bg-[#f9f9f9]">tap</th>
                      <th className="text-[11px] text-[#666] font-medium p-2 border-b border-[#f2f2f2] bg-[#f9f9f9]">tap率</th>
                    </React.Fragment>
                  ))}
                  <th className="text-[11px] text-[#0067b8] font-medium p-2 border-b border-[#f2f2f2] border-l-2 border-[#d2d2d2] bg-[#f2f2f2]">アクティブ</th>
                  <th className="text-[11px] text-[#0067b8] font-medium p-2 border-b border-[#f2f2f2] bg-[#f2f2f2]">予約済</th>
                  <th className="text-[11px] text-[#0067b8] font-medium p-2 border-b border-[#f2f2f2] bg-[#f2f2f2]">成約率</th>
                </tr>
              </thead>
              <tbody>
                {/* Total Row */}
                <tr className="bg-[#f9f9f9] hover:bg-[#f2f2f2]">
                  <td className="sticky left-0 bg-[#f9f9f9] z-10 py-3 pr-4 font-bold text-[#000] border-b border-[#f2f2f2]">期間合計</td>
                  {scenarioSteps.map((step, idx) => {
                    const stats = calcStepStats(filteredData, step);
                    return (
                      <React.Fragment key={idx}>
                        <td className="p-2 border-b border-[#f2f2f2] border-l-2 border-[#d2d2d2] font-semibold">{stats.target}</td>
                        <td className="p-2 border-b border-[#f2f2f2]">{stats.tap}</td>
                        <td className={`p-2 border-b border-[#f2f2f2] font-semibold ${stats.rate > 40 ? 'text-[#0067b8]' : stats.rate < 20 && stats.target > 10 ? 'text-[#d13438]' : ''}`}>
                          {stats.rate > 0 ? `${stats.rate.toFixed(1)}%` : '-'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="p-2 border-b border-[#f2f2f2] border-l-2 border-[#d2d2d2] font-bold text-[#0067b8]">{metrics.active}</td>
                  <td className="p-2 border-b border-[#f2f2f2] font-bold text-[#0067b8]">{metrics.cvCount}</td>
                  <td className="p-2 border-b border-[#f2f2f2] font-bold text-[#0067b8] text-lg bg-[#ebf4fb]">{metrics.cvRate.toFixed(1)}%</td>
                </tr>
                {/* Period Rows */}
                {availablePeriods.map(p => {
                  const key = `_${timeGranularity}`;
                  const rowData = filteredData.filter(d => d[key] === p);
                  if(rowData.length === 0) return null;
                  
                  const rowActive = rowData.length - rowData.filter(d=>d._isBlock).length;
                  const rowCv = rowData.filter(d=>isTrue(d['面談予約済'])).length;
                  const rowCvRate = rowActive>0 ? (rowCv/rowActive)*100 : 0;

                  return (
                    <tr key={p} className="hover:bg-[#f9f9f9] transition-colors border-b border-[#f2f2f2]">
                      <td className="sticky left-0 bg-white hover:bg-[#f9f9f9] z-10 py-2 pr-4 text-[#666] font-medium">{p}</td>
                      {scenarioSteps.map((step, idx) => {
                        const stats = calcStepStats(rowData, step);
                        return (
                          <React.Fragment key={idx}>
                            <td className="p-2 border-l-2 border-[#d2d2d2]">{stats.target}</td>
                            <td className="p-2 text-[#666]">{stats.tap}</td>
                            <td className={`p-2 font-medium ${stats.rate > 40 ? 'text-[#0067b8]' : stats.rate < 20 && stats.target>10 ? 'text-[#d13438]' : 'text-[#666]'}`}>
                              {stats.rate > 0 ? `${stats.rate.toFixed(1)}%` : '-'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="p-2 border-l-2 border-[#a6c8e6]">{rowActive}</td>
                      <td className="p-2 font-semibold">{rowCv}</td>
                      <td className="p-2 font-bold text-[#0067b8] bg-[#f4f9fd]">{rowCvRate>0 ? `${rowCvRate.toFixed(1)}%` : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp size={20} className="text-[#0067b8]" />
              <h2 className="text-[18px] font-semibold text-[#000]">推移 ({timeGranularity==='month'?'月次':timeGranularity==='week'?'週次':'日次'})</h2>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeChartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false}/>
                  <XAxis dataKey="name" tick={{fill: '#666', fontSize: 12}} tickMargin={10} axisLine={false} tickLine={false}/>
                  <YAxis yAxisId="left" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false}/>
                  <YAxis yAxisId="right" orientation="right" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false} label={{ value: '率 (%)', angle: 90, position: 'insideRight', fill:'#666' }}/>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{fontSize: '12px', paddingTop: '20px'}}/>
                  <Bar yAxisId="left" dataKey="流入数" fill="#a4ccee" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar yAxisId="left" dataKey="CV数" fill="#0067b8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Line yAxisId="right" type="monotone" dataKey="成約率" stroke="#d13438" strokeWidth={3} dot={{r: 4, fill: '#d13438'}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-6">
              <PieChart size={20} className="text-[#0067b8]" />
              <h2 className="text-[18px] font-semibold text-[#000]">流入経路 割合</h2>
            </div>
            <div className="h-[400px] w-full flex items-center justify-center">
              {filteredData.length > 0 ? (() => {
                const channelKey = getFuzzyKey(Object.keys(data[0] || {}), ['流入経路名']);
                if(!channelKey) return <p className="text-[#666]">分類データがありません</p>;
                
                const distr = filteredData.reduce((acc: any, row) => {
                  const c = row[channelKey] || '不明';
                  acc[c] = (acc[c] || 0) + 1;
                  return acc;
                }, {});
                const pieData = Object.entries(distr).map(([name, value]) => ({name, value})).sort((a:any,b:any)=>b.value-a.value).slice(0, 10);
                
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={pieData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={2}
                        dataKey="value" labelLine={false}
                        label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </RePieChart>
                  </ResponsiveContainer>
                )
              })() : <p className="text-[#666]">データが見つかりません</p>}
            </div>
          </div>
        </div>

        {/* Raw Data Table */}
        <div className="card p-6 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList size={20} className="text-[#0067b8]" />
            <h2 className="text-[16px] font-semibold text-[#000]">生データ一覧 (先頭100件)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap text-[12px]">
              <thead className="bg-[#f2f2f2] text-[#666]">
                <tr>
                  {Object.keys(data[0] || {}).slice(0, 20).map((h) => (
                    <th key={h} className="p-2 font-semibold border-b border-[#d2d2d2]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.slice(0, 100).map((row, i) => (
                  <tr key={i} className="border-b border-[#f2f2f2] hover:bg-[#f9f9f9]">
                    {Object.keys(data[0] || {}).slice(0, 20).map((h) => (
                      <td key={h} className="p-2 text-black max-w-[150px] truncate" title={row[h]}>{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
      </main>
    </div>
  );
}
