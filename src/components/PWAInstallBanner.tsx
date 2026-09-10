import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, PlusSquare, X, Smartphone, Sparkles, CheckCircle2, ChevronRight, ShieldCheck } from 'lucide-react';

interface PWAInstallBannerProps {
  onDismiss?: () => void;
  floating?: boolean;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ floating = false }) => {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check session dismissal state
  useEffect(() => {
    const dismissed = sessionStorage.getItem('pwa_install_dismissed') === 'true';
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('pwa_install_dismissed', 'true');
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      const installed = await promptInstall();
      if (installed) {
        setIsDismissed(true);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // Fallback for browsers without beforeinstallprompt or desktop
      setShowIOSModal(true);
    }
  };

  // If already installed (standalone mode) or dismissed in session, do not render banner
  if (isInstalled || isDismissed) {
    return null;
  }

  return (
    <>
      {/* Top / Floating Install Banner */}
      <div className={`w-full bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white border-b border-blue-700/60 px-4 py-2.5 shadow-md transition-all relative z-40 ${floating ? 'rounded-2xl border mb-4' : ''}`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          
          {/* App Info & Icon */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative shrink-0">
              <img 
                src="/pwa-192x192.png" 
                alt="Logo SiHadirQR" 
                className="w-10 h-10 rounded-xl bg-slate-950 p-1 object-contain border border-blue-400/40 shadow-sm"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-blue-950 text-[8px] font-bold">
                ✓
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-sm text-white tracking-tight">SiHadirQR Mobile & Desktop</span>
                <span className="bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                  Aplikasi Resmi
                </span>
              </div>
              <p className="text-blue-200 text-[11px] leading-tight truncate sm:whitespace-normal">
                Pasang di Layar Utama HP / PC untuk akses instan & scan cepat tanpa buka browser!
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer border border-blue-300/30 group"
            >
              <Download className="w-4 h-4 text-amber-300 group-hover:translate-y-0.5 transition-transform" />
              <span>Install Aplikasi</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Tutup banner instalasi"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* iOS / General Browser Installation Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-5 text-slate-800 relative">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3.5 pr-8">
              <img 
                src="/pwa-192x192.png" 
                alt="SiHadirQR" 
                className="w-12 h-12 rounded-2xl bg-[#0a1128] p-1.5 object-contain border border-blue-600 shadow-md shrink-0" 
              />
              <div>
                <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                  Pasang Aplikasi SiHadirQR
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aplikasi Web Progresif (PWA) SMP Negeri 2 Tanjung
                </p>
              </div>
            </div>

            {/* Instruction Steps */}
            <div className="space-y-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <span className="font-bold text-slate-800">Buka Menu Browser</span>
                  <p className="text-slate-600 text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                    Tekan tombol <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-300 font-semibold text-blue-600"><Share2 className="w-3 h-3" /> Bagikan (Share)</span> di iOS Safari, atau <span className="font-semibold text-slate-800">titik tiga (⋮)</span> di Chrome.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <span className="font-bold text-slate-800">Pilih "Tambahkan ke Layar Utama"</span>
                  <p className="text-slate-600 text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                    Gulir ke bawah dan ketuk <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-300 font-semibold text-slate-900"><PlusSquare className="w-3 h-3 text-emerald-600" /> Tambahkan ke Layar Utama</span> (*Add to Home Screen*).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <span className="font-bold text-slate-800">Konfirmasi & Selesai!</span>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Ketuk tombol **Tambah** (*Add*). Ikon SiHadirQR akan muncul di beranda HP Anda layaknya aplikasi Play Store / App Store.
                  </p>
                </div>
              </div>
            </div>

            {/* Benefits Badge */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 p-2 rounded-xl border border-emerald-200/60 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Tanpa boros memori</span>
              </div>
              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-800 p-2 rounded-xl border border-blue-200/60 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Aman & tersinkron</span>
              </div>
            </div>

            {/* Action Close */}
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Saya Mengerti
            </button>

          </div>
        </div>
      )}
    </>
  );
};
