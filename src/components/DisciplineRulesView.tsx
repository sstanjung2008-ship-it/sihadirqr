import React, { useState } from 'react';
import { CharacterTrait, CharacterPredicateSettings, SchoolProfile, UserRole, UserSession } from '../types';
import { 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  Award, 
  AlertTriangle, 
  Printer, 
  Sliders, 
  FileText,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Scale,
  Building2,
  BookOpen,
  X
} from 'lucide-react';

interface DisciplineRulesViewProps {
  traits: CharacterTrait[];
  predicateSettings?: CharacterPredicateSettings;
  schoolProfile: SchoolProfile;
  userRole: UserRole;
  userSession?: UserSession | null;
  onNavigateToMasterInput?: () => void;
}

export const DisciplineRulesView: React.FC<DisciplineRulesViewProps> = ({
  traits,
  predicateSettings = { minA: 30, minB: 10, minC: 0, minD: -20, minE: -50 },
  schoolProfile,
  userRole,
  userSession,
  onNavigateToMasterInput
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupFilter, setActiveGroupFilter] = useState<'ALL' | 'POSITIF' | 'NEGATIF'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Group traits
  const positiveTraits = traits.filter(t => t.type === 'POSITIF');
  const negativeTraits = traits.filter(t => t.type === 'NEGATIF');

  // Categories list
  const allCategories = Array.from(new Set(traits.map(t => t.category || 'Umum'))).filter(Boolean);

  // Filter logic
  const filterTraitList = (list: CharacterTrait[]) => {
    return list.filter(trait => {
      const matchesSearch = trait.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (trait.category && trait.category.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'ALL' || (trait.category || 'Umum') === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  };

  const filteredPositive = filterTraitList(positiveTraits);
  const filteredNegative = filterTraitList(negativeTraits);

  const handlePrintDocument = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Background glow accents */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold text-amber-300 border border-white/10 shadow-xs">
            <Scale className="w-3.5 h-3.5 text-amber-400" /> Pedoman Tata Tertib & Buku Saku Karakter
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
            Tata Tertib & Sistem Poin Karakter Siswa
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Daftar lengkap norma aturan sekolah, bobot apresiasi perilaku positif (+), serta konsekuensi poin pelanggaran negatif (-) sesuai master karakter resmi <strong className="text-white">{schoolProfile.name}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10 shrink-0">
          <button
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-2xl border border-white/20 backdrop-blur-md shadow-md transition-all transform active:scale-95 cursor-pointer text-xs sm:text-sm"
          >
            <Printer className="w-4 h-4 text-amber-300" />
            <span>Cetak / Cetak PDF</span>
          </button>

          {userRole === 'ADMIN' && onNavigateToMasterInput && (
            <button
              onClick={onNavigateToMasterInput}
              className="inline-flex items-center gap-2 px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-2xl shadow-lg transition-all transform active:scale-95 cursor-pointer text-xs sm:text-sm"
            >
              <Sliders className="w-4 h-4" />
              <span>Kelola Master Input</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Aturan */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xl shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Butir Aturan</p>
            <p className="text-2xl font-black text-slate-900">{traits.length} <span className="text-xs font-semibold text-slate-500">Kriteria</span></p>
          </div>
        </div>

        {/* Total Positif */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-blue-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-blue-700 font-bold uppercase tracking-wider">Karakter Positif</p>
            <p className="text-2xl font-black text-blue-800">
              +{positiveTraits.length} <span className="text-xs font-semibold text-blue-600">Apresiasi (+Poin)</span>
            </p>
          </div>
        </div>

        {/* Total Negatif */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-red-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center font-bold text-xl shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-red-700 font-bold uppercase tracking-wider">Karakter Negatif</p>
            <p className="text-2xl font-black text-red-800">
              -{negativeTraits.length} <span className="text-xs font-semibold text-red-600">Pelanggaran (-Poin)</span>
            </p>
          </div>
        </div>

        {/* Standar Predikat Baik */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xl shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-amber-800 font-bold uppercase tracking-wider">Target Predikat Baik (B)</p>
            <p className="text-2xl font-black text-amber-900">
              ≥ {predicateSettings.minB} <span className="text-xs font-semibold text-amber-700">Poin Akumulasi</span>
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari butir tata tertib, kategori, atau nama karakter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Group Filter (Semua / Positif / Negatif) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setActiveGroupFilter('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                activeGroupFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Kelompok ({traits.length})
            </button>
            <button
              onClick={() => setActiveGroupFilter('POSITIF')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeGroupFilter === 'POSITIF'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Kelompok Positif (+{positiveTraits.length})
            </button>
            <button
              onClick={() => setActiveGroupFilter('NEGATIF')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                activeGroupFilter === 'NEGATIF'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Kelompok Negatif (-{negativeTraits.length})
            </button>
          </div>
        </div>

        {/* Category Pills Filter */}
        {allCategories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" /> Kategori:
            </span>
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                selectedCategory === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Kategori
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content: Grouped Positive and Negative Traits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* KELOMPOK 1: KARAKTER POSITIF (+) */}
        {(activeGroupFilter === 'ALL' || activeGroupFilter === 'POSITIF') && (
          <div className={`space-y-4 ${activeGroupFilter === 'POSITIF' ? 'lg:col-span-2' : ''}`}>
            
            {/* Positive Header Card */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl p-4 text-white shadow-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-blue-200">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                    Kelompok Tata Tertib & Karakter Positif
                  </h2>
                  <p className="text-xs text-blue-100/90">
                    Apresiasi dan penghargaan berupa penambahan poin karakter (+)
                  </p>
                </div>
              </div>
              <span className="bg-blue-500/30 text-blue-100 border border-blue-400/40 text-xs font-black px-3 py-1 rounded-full shrink-0">
                +{filteredPositive.length} Pilihan
              </span>
            </div>

            {/* Positive Trait Cards / List */}
            {filteredPositive.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400">
                <Info className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">Tidak ada butir karakter positif yang cocok dengan filter.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-blue-100 shadow-xs overflow-hidden divide-y divide-slate-100">
                {filteredPositive.map((trait, idx) => (
                  <div 
                    key={trait.id || idx}
                    className="p-4 hover:bg-blue-50/40 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm leading-snug">
                            {trait.name}
                          </span>
                          <span className="bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            {trait.category || 'Umum'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Perilaku terpuji yang mendapatkan poin penghargaan langsung.
                        </p>
                      </div>
                    </div>

                    {/* Points Badge */}
                    <div className="shrink-0 text-right">
                      <span className="inline-flex items-center gap-1 bg-blue-600 text-white font-mono font-black text-sm px-3 py-1.5 rounded-xl shadow-xs">
                        <ArrowUpRight className="w-4 h-4" />
                        +{Math.abs(trait.points)}
                      </span>
                      <span className="block text-[10px] text-blue-700 font-bold mt-0.5">Poin Reward</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* KELOMPOK 2: KARAKTER NEGATIF (-) */}
        {(activeGroupFilter === 'ALL' || activeGroupFilter === 'NEGATIF') && (
          <div className={`space-y-4 ${activeGroupFilter === 'NEGATIF' ? 'lg:col-span-2' : ''}`}>
            
            {/* Negative Header Card */}
            <div className="bg-gradient-to-r from-red-700 via-rose-800 to-red-900 rounded-2xl p-4 text-white shadow-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-red-200">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                    Kelompok Tata Tertib & Karakter Negatif
                  </h2>
                  <p className="text-xs text-red-100/90">
                    Pelanggaran norma/tata tertib berupa pengurangan poin karakter (-)
                  </p>
                </div>
              </div>
              <span className="bg-red-500/30 text-red-100 border border-red-400/40 text-xs font-black px-3 py-1 rounded-full shrink-0">
                -{filteredNegative.length} Pilihan
              </span>
            </div>

            {/* Negative Trait Cards / List */}
            {filteredNegative.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400">
                <Info className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-600">Tidak ada butir karakter negatif yang cocok dengan filter.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-red-100 shadow-xs overflow-hidden divide-y divide-slate-100">
                {filteredNegative.map((trait, idx) => (
                  <div 
                    key={trait.id || idx}
                    className="p-4 hover:bg-red-50/40 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-7 h-7 rounded-lg bg-red-100 text-red-800 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm leading-snug">
                            {trait.name}
                          </span>
                          <span className="bg-red-50 border border-red-200 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            {trait.category || 'Pelanggaran'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Bentuk pelanggaran yang memicu pembinaan wali kelas & guru BK.
                        </p>
                      </div>
                    </div>

                    {/* Points Badge */}
                    <div className="shrink-0 text-right">
                      <span className="inline-flex items-center gap-1 bg-red-600 text-white font-mono font-black text-sm px-3 py-1.5 rounded-xl shadow-xs">
                        <ArrowDownRight className="w-4 h-4" />
                        -{Math.abs(trait.points)}
                      </span>
                      <span className="block text-[10px] text-red-700 font-bold mt-0.5">Poin Sanksi</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* SECTION: TABEL KRITERIA PREDIKAT NILAI KARAKTER RAPOR */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Standar Kriteria Predikat Nilai Karakter Siswa
              </h2>
              <p className="text-xs text-slate-500">
                Pedoman rentang nilai akhir predikat rapor karakter berdasarkan akumulasi poin (+ / -).
              </p>
            </div>
          </div>
          <span className="text-[11px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full w-fit">
            Terhubung Rapor Karakter
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-1">
          
          {/* Predikat A */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-center space-y-1">
            <span className="inline-block w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-sm leading-8 mx-auto shadow-xs">
              A
            </span>
            <h3 className="font-extrabold text-emerald-950 text-xs">Sangat Baik</h3>
            <p className="text-base font-black font-mono text-emerald-700">≥ {predicateSettings.minA} Poin</p>
            <p className="text-[10px] text-emerald-800 font-medium">Siswa teladan berprestasi tinggi dan disiplin penuh.</p>
          </div>

          {/* Predikat B */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 text-center space-y-1">
            <span className="inline-block w-8 h-8 rounded-full bg-blue-600 text-white font-black text-sm leading-8 mx-auto shadow-xs">
              B
            </span>
            <h3 className="font-extrabold text-blue-950 text-xs">Baik (Standar)</h3>
            <p className="text-base font-black font-mono text-blue-700">{predicateSettings.minB} s/d {predicateSettings.minA - 1} Poin</p>
            <p className="text-[10px] text-blue-800 font-medium">Memenuhi seluruh kewajiban tata tertib sekolah.</p>
          </div>

          {/* Predikat C */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-center space-y-1">
            <span className="inline-block w-8 h-8 rounded-full bg-amber-600 text-white font-black text-sm leading-8 mx-auto shadow-xs">
              C
            </span>
            <h3 className="font-extrabold text-amber-950 text-xs">Cukup</h3>
            <p className="text-base font-black font-mono text-amber-700">{predicateSettings.minC} s/d {predicateSettings.minB - 1} Poin</p>
            <p className="text-[10px] text-amber-800 font-medium">Perlu bimbingan ringan dari wali kelas.</p>
          </div>

          {/* Predikat D */}
          <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-4 text-center space-y-1">
            <span className="inline-block w-8 h-8 rounded-full bg-orange-600 text-white font-black text-sm leading-8 mx-auto shadow-xs">
              D
            </span>
            <h3 className="font-extrabold text-orange-950 text-xs">Perlu Pembinaan</h3>
            <p className="text-base font-black font-mono text-orange-700">{predicateSettings.minD} s/d {predicateSettings.minC - 1} Poin</p>
            <p className="text-[10px] text-orange-800 font-medium">Peringatan lisan/tertulis & pemanggilan orang tua.</p>
          </div>

          {/* Predikat E */}
          <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-center space-y-1">
            <span className="inline-block w-8 h-8 rounded-full bg-rose-600 text-white font-black text-sm leading-8 mx-auto shadow-xs">
              E
            </span>
            <h3 className="font-extrabold text-rose-950 text-xs">Tidak Naik Kelas</h3>
            <p className="text-base font-black font-mono text-rose-700">&lt; {predicateSettings.minD} Poin</p>
            <p className="text-[10px] text-rose-800 font-medium">Pelanggaran berat & sidang dewan guru.</p>
          </div>

        </div>
      </div>

      {/* CETAK / PRINT MODAL */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
            
            {/* Modal Actions Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Pratinjau Dokumen Tata Tertib Sekolah
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintDocument}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Sekarang</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-800" id="printable-discipline-sheet">
              
              {/* Kop Surat Sekolah Resmi */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-center gap-4 text-center">
                {schoolProfile.schoolLogo && (
                  <img
                    src={schoolProfile.schoolLogo}
                    alt="Logo"
                    className="w-16 h-16 object-contain shrink-0"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">PEMERINTAH {schoolProfile.regency?.toUpperCase()}</h2>
                  <h1 className="text-base sm:text-lg font-black uppercase text-slate-900">{schoolProfile.name}</h1>
                  <p className="text-[10px] text-slate-500 mt-0.5">{schoolProfile.address} • Telp: {schoolProfile.phone} • Email: {schoolProfile.email}</p>
                </div>
                {schoolProfile.regencyLogo && (
                  <img
                    src={schoolProfile.regencyLogo}
                    alt="Logo Pemda"
                    className="w-16 h-16 object-contain shrink-0 hidden sm:block"
                  />
                )}
              </div>

              {/* Judul Dokumen */}
              <div className="text-center space-y-1">
                <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-slate-900 underline">
                  BUKU PEDOMAN TATA TERTIB & SISTEM POIN KARAKTER SISWA
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Tahun Ajaran {schoolProfile.academicYear || '2025/2026'} • Semester {schoolProfile.semester || 'GANJIL'}
                </p>
              </div>

              {/* Table Positif */}
              <div className="space-y-2">
                <h3 className="font-extrabold text-xs sm:text-sm text-blue-800 flex items-center gap-1.5 uppercase">
                  A. DAFTAR KARAKTER POSITIF & APRESIASI REWARD (+)
                </h3>
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-blue-100/60 text-slate-800 font-extrabold">
                      <th className="border border-slate-300 p-2 w-10 text-center">No</th>
                      <th className="border border-slate-300 p-2">Kriteria Perilaku / Karakter Positif</th>
                      <th className="border border-slate-300 p-2 w-32">Kategori</th>
                      <th className="border border-slate-300 p-2 w-24 text-center">Bobot Poin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positiveTraits.map((t, idx) => (
                      <tr key={t.id || idx} className="hover:bg-slate-50">
                        <td className="border border-slate-300 p-2 text-center font-bold">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 font-semibold text-slate-800">{t.name}</td>
                        <td className="border border-slate-300 p-2 text-slate-600">{t.category || 'Umum'}</td>
                        <td className="border border-slate-300 p-2 text-center font-black font-mono text-blue-700">+{Math.abs(t.points)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Negatif */}
              <div className="space-y-2 pt-2">
                <h3 className="font-extrabold text-xs sm:text-sm text-red-800 flex items-center gap-1.5 uppercase">
                  B. DAFTAR PELANGGARAN TATA TERTIB & POIN PENGURANGAN (-)
                </h3>
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-red-100/60 text-slate-800 font-extrabold">
                      <th className="border border-slate-300 p-2 w-10 text-center">No</th>
                      <th className="border border-slate-300 p-2">Bentuk Pelanggaran Tata Tertib</th>
                      <th className="border border-slate-300 p-2 w-32">Kategori</th>
                      <th className="border border-slate-300 p-2 w-24 text-center">Poin Sanksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {negativeTraits.map((t, idx) => (
                      <tr key={t.id || idx} className="hover:bg-slate-50">
                        <td className="border border-slate-300 p-2 text-center font-bold">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 font-semibold text-slate-800">{t.name}</td>
                        <td className="border border-slate-300 p-2 text-slate-600">{t.category || 'Pelanggaran'}</td>
                        <td className="border border-slate-300 p-2 text-center font-black font-mono text-red-700">-{Math.abs(t.points)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tanda Tangan Pengesahan */}
              <div className="pt-8 flex justify-between text-xs text-slate-800">
                <div className="text-center space-y-12">
                  <p>Mengetahui,<br /><span className="font-bold">Guru BK / Tim Disiplin</span></p>
                  <p className="font-bold underline">Ahmad Fauzi, S.Psi.</p>
                </div>
                <div className="text-center space-y-12">
                  <p>{schoolProfile.district || 'Kota'}, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br /><span className="font-bold">Kepala Sekolah</span></p>
                  <div>
                    <p className="font-bold underline uppercase">{schoolProfile.principalName}</p>
                    <p className="text-[10px] text-slate-500">NIP. {schoolProfile.principalNip}</p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
