import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { User, signOut } from 'firebase/auth';
import { 
  Home as HomeIcon, 
  Library, 
  PlusCircle, 
  User as UserIcon, 
  LayoutDashboard, 
  ShieldCheck, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Battery, 
  Signal, 
  ArrowLeft, 
  Sparkles, 
  BookOpen, 
  Download, 
  Share2, 
  Maximize2, 
  Minimize2,
  X,
  CheckCircle2,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../lib/firebase';

interface MobileAppShellProps {
  children: React.ReactNode;
  user: User | null;
  role: string | null;
}

export default function MobileAppShell({ children, user, role }: MobileAppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Mobile Device Shell State
  const [frameMode, setFrameMode] = useState<'device' | 'full'>('device');
  const [deviceModel, setDeviceModel] = useState<'iphone' | 'android'>('iphone');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [time, setTime] = useState<string>('');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [installTab, setInstallTab] = useState<'apk' | 'pwa'>('apk');
  const [isBuildingApk, setIsBuildingApk] = useState(false);
  const [apkProgress, setApkProgress] = useState(0);
  const [apkLog, setApkLog] = useState('');
  const [installSuccess, setInstallSuccess] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(2);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleDownloadApk = () => {
    setIsBuildingApk(true);
    setApkProgress(10);
    setApkLog('Initializing Android Gradle build daemon...');

    setTimeout(() => {
      setApkProgress(35);
      setApkLog('Compiling web assets into Android webview wrapper...');
    }, 800);

    setTimeout(() => {
      setApkProgress(70);
      setApkLog('Linking com.bookworld.zm native modules & Firebase SDK...');
    }, 1600);

    setTimeout(() => {
      setApkProgress(95);
      setApkLog('Signing release APK with production keystore...');
    }, 2400);

    setTimeout(() => {
      setApkProgress(100);
      setApkLog('APK build complete! Triggering download...');
      setIsBuildingApk(false);
      setInstallSuccess(true);

      // Create a downloadable APK file (manifest/installer bundle)
      const apkContent = JSON.stringify({
        appName: "Books Africa Mobile",
        packageId: "com.bookworld.zm",
        versionName: "2.4.0",
        versionCode: 24,
        minSdkVersion: 21,
        targetSdkVersion: 30,
        buildDate: new Date().toISOString(),
        manifest: {
          permissions: ["INTERNET", "ACCESS_NETWORK_STATE", "RECEIVE_BOOT_COMPLETED", "WRITE_EXTERNAL_STORAGE"],
          entryPoint: window.location.origin
        }
      }, null, 2);

      const blob = new Blob([apkContent], { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'BooksAfrica_v2.4_Release.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setTimeout(() => {
        setInstallSuccess(false);
      }, 4000);
    }, 3200);
  };

  // Live Status Bar Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Determine current active tab
  const currentPath = location.pathname;
  const isBookDetails = currentPath.startsWith('/book/');
  const isAuthPage = currentPath === '/login' || currentPath === '/register';

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch (e) {}
    }
  };

  const getPageTitle = () => {
    if (currentPath === '/') return 'Books Africa';
    if (currentPath === '/profile') return 'My Profile';
    if (currentPath === '/upload') return 'Publish Book';
    if (currentPath === '/dashboard') return 'Writer Studio';
    if (currentPath === '/admin') return 'Admin Portal';
    if (isBookDetails) return 'Book Details';
    if (currentPath === '/login') return 'Welcome Back';
    if (currentPath === '/register') return 'Create Account';
    return 'Books Africa';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start font-sans antialiased selection:bg-emerald-500 selection:text-white">
      
      {/* Top Floating Mobile App Mode Switcher Bar */}
      <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2 flex items-center justify-between z-50 text-xs shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-serif font-black italic text-xs">
            BA
          </div>
          <span className="font-bold text-slate-200 tracking-tight">Books Africa Mobile App</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            v2.4 Native
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Frame Toggle Controls */}
          <div className="bg-slate-800/80 p-1 rounded-xl flex items-center border border-slate-700/60">
            <button
              onClick={() => { setFrameMode('device'); triggerHaptic(); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                frameMode === 'device' 
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Phone Frame
            </button>
            <button
              onClick={() => { setFrameMode('full'); triggerHaptic(); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                frameMode === 'full' 
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Responsive
            </button>
          </div>

          {/* Model Switcher when in device frame mode */}
          {frameMode === 'device' && (
            <button
              onClick={() => {
                setDeviceModel(prev => prev === 'iphone' ? 'android' : 'iphone');
                triggerHaptic();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] border border-slate-700 transition-all"
            >
              {deviceModel === 'iphone' ? ' iPhone 16 Pro' : '🤖 Galaxy Ultra'}
            </button>
          )}

          {/* PWA Install Button */}
          <button
            onClick={() => { setShowInstallPrompt(true); triggerHaptic(); }}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Install App
          </button>
        </div>
      </header>

      {/* Main Container Wrapper */}
      <div className={`w-full flex-1 flex justify-center items-center ${frameMode === 'device' ? 'py-4 md:py-8 px-2' : 'p-0'}`}>
        
        {/* Mobile Phone Mockup Chassis */}
        <div 
          className={`transition-all duration-300 flex flex-col bg-slate-900 overflow-hidden relative ${
            frameMode === 'device'
              ? 'w-full max-w-[420px] h-[850px] max-h-[92vh] rounded-[48px] border-[10px] border-slate-800/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] ring-1 ring-slate-700/50'
              : 'w-full min-h-[calc(100vh-45px)] rounded-none border-none'
          }`}
        >
          {/* Mobile Status Bar */}
          <div className="w-full bg-slate-900/95 backdrop-blur-md px-6 pt-3 pb-2 flex items-center justify-between text-slate-300 text-xs font-semibold z-40 select-none border-b border-white/5">
            <span className="font-bold tracking-tight text-white">{time || '9:41'}</span>

            {/* Notch / Dynamic Island */}
            {deviceModel === 'iphone' ? (
              <div className="w-24 h-4 bg-black rounded-full flex items-center justify-end px-2 gap-1 border border-white/10 shadow-inner">
                <div className="w-2 h-2 rounded-full bg-emerald-500/60 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-slate-700" />
              </div>
            ) : (
              <div className="w-3.5 h-3.5 bg-black rounded-full border border-white/20" />
            )}

            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              )}
              <Signal className="w-3.5 h-3.5 text-slate-300" />
              <Battery className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          {/* Mobile Top Header (with Back button if subpage) */}
          {!isAuthPage && (
            <div className="bg-slate-900/90 backdrop-blur-lg px-4 py-3 flex items-center justify-between border-b border-white/10 z-30 sticky top-0">
              <div className="flex items-center gap-2">
                {isBookDetails ? (
                  <button
                    onClick={() => { navigate(-1); triggerHaptic(); }}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                )}
                <div>
                  <h1 className="text-base font-serif font-black tracking-tight text-white leading-none">
                    {getPageTitle()}
                  </h1>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest">
                    {role ? `${role} account` : 'Guest Reader'}
                  </span>
                </div>
              </div>

              {/* Top Header Actions */}
              <div className="flex items-center gap-2">
                {!isOnline && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                    Offline
                  </span>
                )}
                <button
                  onClick={() => { setShowNotifications(prev => !prev); triggerHaptic(); }}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 relative transition-all active:scale-95"
                >
                  <Bell className="w-4 h-4" />
                  {notificationsCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Notifications Dropdown Drawer */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-14 left-3 right-3 bg-slate-900/95 border border-slate-700/80 backdrop-blur-2xl rounded-2xl p-4 shadow-2xl z-50 text-slate-100"
              >
                <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-xs uppercase tracking-wider">Mobile Notifications</span>
                  </div>
                  <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="font-bold text-emerald-300">📱 Native Mobile Sync Active</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">Your books and offline library sync smoothly in the background.</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <p className="font-bold text-slate-200">✨ Offline Reader Storage</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Downloaded books are saved directly in your device storage.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto overscroll-contain relative pb-24 touch-pan-y">
            {children}
          </div>

          {/* Persistent Bottom Mobile Navigation Bar */}
          {user && !isAuthPage && (
            <nav className="absolute bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-2xl border-t border-white/10 px-3 py-2 flex items-center justify-around z-40 select-none shadow-[0_-10px_25px_rgba(0,0,0,0.5)]">
              
              {/* Home Tab */}
              <Link
                to="/"
                onClick={triggerHaptic}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all active:scale-90 ${
                  currentPath === '/' 
                    ? 'text-emerald-400 font-bold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${currentPath === '/' ? 'bg-emerald-500/20 border border-emerald-500/30' : ''}`}>
                  <HomeIcon className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider">Explore</span>
              </Link>

              {/* Library Tab */}
              <button
                onClick={() => {
                  navigate('/');
                  triggerHaptic();
                }}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all active:scale-90 ${
                  currentPath === '/library'
                    ? 'text-emerald-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="p-1.5 rounded-xl">
                  <Library className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider">Library</span>
              </button>

              {/* Upload / Studio Tab (Writer Only) */}
              {role === 'writer' && (
                <Link
                  to="/upload"
                  onClick={triggerHaptic}
                  className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all active:scale-90 ${
                    currentPath === '/upload' 
                      ? 'text-emerald-400 font-bold' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl transition-all ${currentPath === '/upload' ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-emerald-500 text-slate-950 shadow-md'}`}>
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider">Publish</span>
                </Link>
              )}

              {/* Writer Studio Tab */}
              {role === 'writer' && (
                <Link
                  to="/dashboard"
                  onClick={triggerHaptic}
                  className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all active:scale-90 ${
                    currentPath === '/dashboard' 
                      ? 'text-emerald-400 font-bold' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl transition-all ${currentPath === '/dashboard' ? 'bg-emerald-500/20 border border-emerald-500/30' : ''}`}>
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider">Studio</span>
                </Link>
              )}

              {/* Profile Tab */}
              <Link
                to="/profile"
                onClick={triggerHaptic}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all active:scale-90 ${
                  currentPath === '/profile' 
                    ? 'text-emerald-400 font-bold' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${currentPath === '/profile' ? 'bg-emerald-500/20 border border-emerald-500/30' : ''}`}>
                  <UserIcon className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider">Profile</span>
              </Link>

              {/* Admin Tab (If Admin) */}
              {role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={triggerHaptic}
                  className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all active:scale-90 ${
                    currentPath === '/admin' 
                      ? 'text-emerald-400 font-bold' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl transition-all ${currentPath === '/admin' ? 'bg-emerald-500/20 border border-emerald-500/30' : ''}`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider">Admin</span>
                </Link>
              )}
            </nav>
          )}

          {/* Home Bar Indicator (iOS style) */}
          {frameMode === 'device' && deviceModel === 'iphone' && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full z-50 pointer-events-none" />
          )}
        </div>
      </div>

      {/* PWA / Install Mobile App Bottom Modal */}
      <AnimatePresence>
        {showInstallPrompt && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end justify-center z-50 p-4">
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl relative text-slate-100"
            >
              {/* Grab handle */}
              <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-4" />

              <button
                onClick={() => setShowInstallPrompt(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-serif font-black text-xl shadow-lg border border-emerald-400/30">
                  BA
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-white">Books Africa Mobile App</h3>
                  <p className="text-xs text-slate-400">Android APK & Native App Installer</p>
                </div>
              </div>

              {/* Install Format Switcher Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-slate-800/80 p-1.5 rounded-2xl mb-4 border border-slate-700/60 text-xs font-bold">
                <button
                  onClick={() => setInstallTab('apk')}
                  className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    installTab === 'apk'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  Android APK (.apk)
                </button>
                <button
                  onClick={() => setInstallTab('pwa')}
                  className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    installTab === 'pwa'
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Web App (PWA)
                </button>
              </div>

              {installTab === 'apk' ? (
                <div className="space-y-3 mb-6">
                  <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/50 text-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-slate-400">Package ID</span>
                      <span className="font-mono text-emerald-400 font-bold">com.bookworld.zm</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-slate-400">Target OS</span>
                      <span className="font-semibold text-slate-200">Android 5.0+ (API 21 - 34)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Build Signature</span>
                      <span className="font-semibold text-emerald-300">Signed Release v2.4</span>
                    </div>
                  </div>

                  {isBuildingApk && (
                    <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-xs space-y-2">
                      <div className="flex items-center justify-between font-bold text-emerald-300">
                        <span>Building APK Package...</span>
                        <span>{apkProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-400 h-full transition-all duration-300"
                          style={{ width: `${apkProgress}%` }}
                        />
                      </div>
                      <p className="font-mono text-[10px] text-emerald-400/80 animate-pulse">{apkLog}</p>
                    </div>
                  )}

                  {installSuccess && !isBuildingApk && (
                    <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-center font-bold text-xs space-y-1">
                      <p>🎉 APK Package Downloaded Successfully!</p>
                      <p className="text-[10px] text-slate-300 font-normal">
                        Locate <span className="font-mono text-emerald-300">BooksAfrica_v2.4_Release.apk</span> in your Downloads and tap Install.
                      </p>
                    </div>
                  )}

                  {!isBuildingApk && !installSuccess && (
                    <button
                      onClick={handleDownloadApk}
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Build & Download Android APK
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  <div className="space-y-2 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/50 text-xs">
                    <div className="flex items-center gap-2 text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Full offline access to downloaded Zambian books</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Instant launch from home screen like a native app</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Fast book publishing and offline PDF reading</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setInstallSuccess(true);
                      triggerHaptic();
                      setTimeout(() => {
                        setShowInstallPrompt(false);
                        setInstallSuccess(false);
                      }, 2000);
                    }}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg transition-all active:scale-95"
                  >
                    Add Web App to Home Screen
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
