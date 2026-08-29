import React, { useState } from 'react';
import { Student, SchoolProfile } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { getSchoolProfile } from '../lib/storage';
import { exportSingleStudentCardPdf } from '../lib/exportUtils';
import { X, Printer, GraduationCap, LayoutGrid, Smartphone, Ruler, Download, Loader2 } from 'lucide-react';

interface StudentIdCardModalProps {
  student: Student;
  onClose: () => void;
}

export const StudentIdCardModal: React.FC<StudentIdCardModalProps> = ({
  student,
  onClose,
}) => {
  const schoolProfile: SchoolProfile = getSchoolProfile();
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>(
    schoolProfile.cardOrientation || 'PORTRAIT'
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await exportSingleStudentCardPdf(student, schoolProfile, orientation);
    } catch (err) {
      console.error('Failed to export student card PDF:', err);
      alert('Gagal membuat file PDF. Mencoba cetak standar...');
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-100 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
        
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              Kartu Tanda Pelajar Digital (KTS)
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 mt-0.5">
              <Ruler className="w-3.5 h-3.5 text-amber-500" />
              Ukuran Standar ID Card: 8,56 cm × 5,4 cm (85,6 mm × 54 mm)
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Format Button */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setOrientation('PORTRAIT')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  orientation === 'PORTRAIT'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Portrait
              </button>
              <button
                onClick={() => setOrientation('LANDSCAPE')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  orientation === 'LANDSCAPE'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Landscape
              </button>
            </div>

            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* The Official ID Card Layout */}
        <div className="py-2 flex justify-center print:m-0 print:p-0">
          
          {orientation === 'PORTRAIT' ? (
            /* ================= PORTRAIT CARD DESIGN (5,4 cm x 8,56 cm) ================= */
            /* 54mm x 85.6mm aspect ratio (0.6308). Scaled for screen: 324px x 513.6px */
            <div 
              id="printable-id-card"
              className="w-[324px] h-[513.6px] bg-white rounded-[24px] overflow-hidden shadow-2xl border-2 border-indigo-100 font-sans relative flex flex-col shrink-0 print:w-[54mm] print:h-[85.6mm] print:rounded-2xl"
            >
              
              {/* Header Banner Indigo */}
              <div className="bg-gradient-to-r from-indigo-800 via-indigo-700 to-indigo-800 p-3 text-white flex items-center justify-between shrink-0">
                {/* School Logo Container */}
                <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-md">
                  <img 
                    src={schoolProfile.schoolLogo} 
                    alt="Sekolah" 
                    className="w-full h-full object-contain rounded-lg"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>

                {/* Header Text */}
                <div className="text-center px-1.5 flex-1">
                  <h3 className="text-[11px] font-black uppercase text-white leading-tight tracking-tight">
                    {schoolProfile.name}
                  </h3>
                  <h4 className="text-[9px] font-extrabold text-amber-300 uppercase tracking-wider mt-0.5">
                    {schoolProfile.regency}
                  </h4>
                </div>

                {/* Regency Logo Container */}
                <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-md">
                  <img 
                    src={schoolProfile.regencyLogo} 
                    alt="Kabupaten" 
                    className="w-full h-full object-contain rounded-lg"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              </div>

              {/* Gold/Yellow Accent Line */}
              <div className="h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 w-full shrink-0" />

              {/* Card Body */}
              <div className="p-4 bg-white text-slate-800 flex-1 flex flex-col items-center justify-between relative">
                
                {/* Centered Student Photo */}
                <div className="w-32 h-40 rounded-2xl overflow-hidden ring-4 ring-indigo-50/80 shadow-lg bg-slate-100 border border-slate-200 shrink-0">
                  <img
                    src={student.photoUrl}
                    alt={student.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Table / Label-Value Bio List */}
                <div className="w-full text-[11px] space-y-1.5 px-0.5 font-sans my-1">
                  <div className="flex items-start">
                    <span className="w-16 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase shrink-0">NAMA</span>
                    <span className="font-bold text-slate-400 mr-1.5">:</span>
                    <span className="font-black text-slate-900 text-[11px] uppercase flex-1">{student.name}</span>
                  </div>

                  <div className="flex items-start">
                    <span className="w-16 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase shrink-0">NIS</span>
                    <span className="font-bold text-slate-400 mr-1.5">:</span>
                    <span className="font-black text-indigo-700 text-[11px] font-mono flex-1">{student.nis}</span>
                  </div>

                  <div className="flex items-start">
                    <span className="w-16 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase shrink-0">TTL</span>
                    <span className="font-bold text-slate-400 mr-1.5">:</span>
                    <span className="font-extrabold text-slate-800 text-[10px] uppercase flex-1">{student.birthPlaceDate}</span>
                  </div>

                  <div className="flex items-start">
                    <span className="w-16 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase shrink-0">ALAMAT</span>
                    <span className="font-bold text-slate-400 mr-1.5">:</span>
                    <span className="font-bold text-slate-700 text-[10px] uppercase flex-1 line-clamp-2">{student.address}</span>
                  </div>
                </div>

                {/* Large Center Bottom QR Code */}
                <div className="bg-white p-2.5 rounded-2xl shadow-md border border-slate-200/90 flex items-center justify-center shrink-0">
                  <QRCodeSVG value={student.qrCode} size={110} level="H" />
                </div>

                {/* Watermark Logo Stamp Bottom Right */}
                <img 
                  src={schoolProfile.schoolLogo} 
                  alt="" 
                  className="absolute bottom-2 right-2 w-7 h-7 opacity-20 grayscale pointer-events-none"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />

              </div>
            </div>
          ) : (
            /* ================= LANDSCAPE CARD DESIGN (8,56 cm x 5,4 cm / 85,6 mm x 54 mm) ================= */
            /* 85.6mm x 54mm aspect ratio (1.585). Scaled for screen: 513.6px x 324px */
            <div 
              id="printable-id-card"
              className="w-[513.6px] h-[324px] bg-white rounded-[24px] overflow-hidden shadow-2xl border-2 border-indigo-100 font-sans relative flex flex-col shrink-0 print:w-[85.6mm] print:h-[54mm] print:rounded-2xl"
            >
              {/* Header Banner Indigo */}
              <div className="bg-gradient-to-r from-indigo-800 via-indigo-700 to-indigo-800 px-4 py-3 text-white flex items-center justify-between shrink-0">
                {/* School Logo Container */}
                <div className="w-12 h-12 rounded-2xl bg-white p-1 flex items-center justify-center shrink-0 shadow-md">
                  <img 
                    src={schoolProfile.schoolLogo} 
                    alt="Sekolah" 
                    className="w-full h-full object-contain rounded-xl"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>

                {/* Header Text */}
                <div className="text-center px-3 flex-1">
                  <h3 className="text-sm font-black uppercase text-white leading-tight tracking-tight">
                    {schoolProfile.name}
                  </h3>
                  <h4 className="text-[10px] font-extrabold text-amber-300 uppercase tracking-widest mt-0.5">
                    {schoolProfile.regency}
                  </h4>
                </div>

                {/* Regency Logo Container */}
                <div className="w-11 h-11 rounded-2xl bg-white p-1 flex items-center justify-center shrink-0 shadow-md">
                  <img 
                    src={schoolProfile.regencyLogo} 
                    alt="Kabupaten" 
                    className="w-full h-full object-contain rounded-xl"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              </div>

              {/* Gold/Yellow Accent Line */}
              <div className="h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 w-full shrink-0" />

              {/* Card Body Horizontal 3-Column Layout */}
              <div className="p-4 bg-white text-slate-800 flex-1 flex items-center justify-between gap-3 relative">
                
                {/* Left: Centered Pas Foto */}
                <div className="w-28 h-36 rounded-2xl overflow-hidden ring-4 ring-indigo-50/80 shadow-md bg-slate-100 border border-slate-200 shrink-0">
                  <img
                    src={student.photoUrl}
                    alt={student.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Center: Label-Value Bio List */}
                <div className="flex-1 text-xs space-y-2 px-1 font-sans">
                  <div className="flex items-start">
                    <span className="w-16 text-[11px] font-extrabold text-slate-400 tracking-wider uppercase shrink-0">NAMA</span>
                    <span className="font-bold text-slate-400 mr-2">:</span>
                    <span className="font-black text-slate-900 text-xs uppercase flex-1">{student.name}</span>
                  </div>

                  <div className="flex items-start">
                    <span className="w-16 text-[11px] font-extrabold text-slate-400 tracking-wider uppercase shrink-0">NIS</span>
                    <span className="font-bold text-slate-400 mr-2">:</span>
                    <span className="font-black text-indigo-700 text-xs font-mono flex-1">{student.nis}</span>
                  </div>

                  <div className="flex items-start">
                    <span className="w-16 text-[11px] font-extrabold text-slate-400 tracking-wider uppercase shrink-0">TTL</span>
                    <span className="font-bold text-slate-400 mr-2">:</span>
                    <span className="font-extrabold text-slate-800 text-[11px] uppercase flex-1">{student.birthPlaceDate}</span>
                  </div>

                  <div className="flex items-start">
                    <span className="w-16 text-[11px] font-extrabold text-slate-400 tracking-wider uppercase shrink-0">ALAMAT</span>
                    <span className="font-bold text-slate-400 mr-2">:</span>
                    <span className="font-bold text-slate-700 text-[11px] uppercase flex-1 line-clamp-2">{student.address}</span>
                  </div>
                </div>

                {/* Right: Large Right-aligned QR Code */}
                <div className="bg-white p-2.5 rounded-2xl shadow-md border border-slate-200/90 flex items-center justify-center shrink-0">
                  <QRCodeSVG value={student.qrCode} size={110} level="H" />
                </div>

                {/* Watermark Logo Stamp Bottom Right */}
                <img 
                  src={schoolProfile.schoolLogo} 
                  alt="" 
                  className="absolute bottom-2 right-2 w-8 h-8 opacity-20 grayscale pointer-events-none"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                />

              </div>
            </div>
          )}

        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100 print:hidden">
          <button
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
          >
            Tutup
          </button>
          
          <button
            onClick={handlePrint}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all border border-slate-200 cursor-pointer"
            title="Buka dialog cetak browser (Ctrl+P)"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Cetak Browser
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses File PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Simpan File PDF ({orientation === 'PORTRAIT' ? 'Portrait' : 'Landscape'})
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

