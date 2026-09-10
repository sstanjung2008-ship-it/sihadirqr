import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Sparkles, Smartphone, Share2, PlusSquare, X, CheckCircle2, ShieldCheck } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'sidebar' | 'button' | 'pill';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = '', 
  variant = 'sidebar' 
}) => {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // If already installed, hide button
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await promptInstall();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'sidebar' && (
        <button
          type="button"
          onClick={handleClick}
          className={`w-full flex items-center justify-between text-[11px] bg-gradient-to-r from-blue-950/60 to-indigo-950/60 hover:from-blue-900/80 hover:to-indigo-900/80 border border-blue-600/50 p-2.5 rounded-xl text-blue-200 hover:text-white transition-all cursor-pointer text-left shadow-xs group ${className}`}
          title="Pasang aplikasi di layar utama HP / Komputer"
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white group-hover:scale-110 transition-transform">
              <Download className="w-3.5 h-3.5 animate-bounce" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-[11px] text-white flex items-center gap-1">
                <span>Install Aplikasi</span>
                <span className="flex h-1.5 w-1.5 rounded-full bg-amber-400"></span>
              </div>
              <p className="text-[10px] text-blue-300 truncate">Pasang di Layar Utama</p>
            </div>
          </div>
          <span className="text-[10px] font-black text-amber-300 bg-blue-900/80 border border-blue-500/40 px-2 py-0.5 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
            PWA ↗
          </span>
        </button>
      )}

      {variant === 'pill' && (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      )}

      {/* Guide Modal for iOS / Unsupported Desktop */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-5 text-slate-800 relative">
            
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3.5 pr-8">
              <img 
                src="/pwa-192x192.png" 
                alt="SiHadirQR" 
                className="w-12 h-12 rounded-2xl bg-[#0a1128] p-1.5 object-contain border border-blue-600 shadow-md shrink-0" 
              />
              <div>
                <h3 className="font-extrabold text-base text-slate-900 leading-tight">
                  Panduan Pasang SiHadirQR
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aplikasi SiHadirQR SMP Negeri 2 Tanjung
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <span className="font-bold text-slate-800">Buka Menu Browser Anda</span>
                  <p className="text-slate-600 text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                    Tekan tombol <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-300 font-semibold text-blue-600"><Share2 className="w-3 h-3" /> Bagikan (Share)</span> di iOS Safari, atau <span className="font-semibold text-slate-800">titik tiga (⋮) / ikon komputer install</span> di Chrome/Edge.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <span className="font-bold text-slate-800">Pilih "Tambahkan ke Layar Utama" / "Install"</span>
                  <p className="text-slate-600 text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                    Pilih <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-300 font-semibold text-slate-900"><PlusSquare className="w-3 h-3 text-emerald-600" /> Tambahkan ke Layar Utama</span> (*Add to Home Screen*).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <span className="font-bold text-slate-800">Siap Digunakan!</span>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Aplikasi akan terpasang di HP / Laptop Anda dan dapat dibuka langsung layaknya aplikasi native.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Tutup Panduan
            </button>

          </div>
        </div>
      )}
    </>
  );
};
