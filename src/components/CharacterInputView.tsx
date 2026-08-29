import React, { useState } from 'react';
import { CharacterTrait, CharacterType, CharacterPredicateSettings } from '../types';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Award, 
  AlertTriangle,
  Sparkles,
  Filter,
  Info,
  Settings,
  X,
  Sliders
} from 'lucide-react';

interface CharacterInputViewProps {
  traits: CharacterTrait[];
  predicateSettings?: CharacterPredicateSettings;
  onAddTrait: (trait: CharacterTrait) => void;
  onUpdateTrait: (trait: CharacterTrait) => void;
  onDeleteTrait: (id: string) => void;
  onSavePredicateSettings?: (settings: CharacterPredicateSettings) => void;
}

export const CharacterInputView: React.FC<CharacterInputViewProps> = ({
  traits,
  predicateSettings = { minA: 30, minB: 10, minC: 0, minD: -20, minE: -50 },
  onAddTrait,
  onUpdateTrait,
  onDeleteTrait,
  onSavePredicateSettings
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | CharacterType>('ALL');
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [traitType, setTraitType] = useState<CharacterType>('POSITIF');
  const [traitName, setTraitName] = useState('');
  const [traitPoints, setTraitPoints] = useState<number>(10);
  const [traitCategory, setTraitCategory] = useState('Kedisiplinan');
  const [showFormModal, setShowFormModal] = useState(false);

  // Predicate Modal State
  const [showPredicateModal, setShowPredicateModal] = useState(false);
  const [inputMinA, setInputMinA] = useState<number>(predicateSettings.minA ?? 30);
  const [inputMinB, setInputMinB] = useState<number>(predicateSettings.minB ?? 10);
  const [inputMinC, setInputMinC] = useState<number>(predicateSettings.minC ?? 0);
  const [inputMinD, setInputMinD] = useState<number>(predicateSettings.minD ?? -20);
  const [inputMinE, setInputMinE] = useState<number>(predicateSettings.minE ?? -50);

  // Delete Trait Confirm State
  const [deleteConfirmTrait, setDeleteConfirmTrait] = useState<CharacterTrait | null>(null);

  const handleOpenPredicateModal = () => {
    setInputMinA(predicateSettings.minA ?? 30);
    setInputMinB(predicateSettings.minB ?? 10);
    setInputMinC(predicateSettings.minC ?? 0);
    setInputMinD(predicateSettings.minD ?? -20);
    setInputMinE(predicateSettings.minE ?? -50);
    setShowPredicateModal(true);
  };

  const handleSavePredicateForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMinA <= inputMinB || inputMinB <= inputMinC || inputMinC <= inputMinD || inputMinD <= inputMinE) {
      alert('Urutan batas poin tidak valid! Pastikan Min A > Min B > Min C > Min D > Min E.');
      return;
    }
    if (onSavePredicateSettings) {
      onSavePredicateSettings({
        minA: Number(inputMinA),
        minB: Number(inputMinB),
        minC: Number(inputMinC),
        minD: Number(inputMinD),
        minE: Number(inputMinE),
      });
    }
    setShowPredicateModal(false);
    alert('Pengaturan rentang nilai predikat berhasil disimpan!');
  };

  const resetForm = () => {
    setEditingId(null);
    setTraitType('POSITIF');
    setTraitName('');
    setTraitPoints(10);
    setTraitCategory('Kedisiplinan');
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const handleEdit = (trait: CharacterTrait) => {
    setEditingId(trait.id);
    setTraitType(trait.type);
    setTraitName(trait.name);
    setTraitPoints(Math.abs(trait.points));
    setTraitCategory(trait.category || 'Kedisiplinan');
    setShowFormModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!traitName.trim()) {
      alert('Nama karakter tidak boleh kosong!');
      return;
    }

    const pointsNum = Math.abs(Number(traitPoints)) || 5;

    if (editingId) {
      const updated: CharacterTrait = {
        id: editingId,
        name: traitName.trim(),
        type: traitType,
        points: pointsNum,
        category: traitCategory.trim() || 'Umum'
      };
      onUpdateTrait(updated);
    } else {
      const newTrait: CharacterTrait = {
        id: 'trait-' + Date.now(),
        name: traitName.trim(),
        type: traitType,
        points: pointsNum,
        category: traitCategory.trim() || 'Umum'
      };
      onAddTrait(newTrait);
    }

    setShowFormModal(false);
    resetForm();
  };

  const handleDelete = (trait: CharacterTrait) => {
    setDeleteConfirmTrait(trait);
  };

  // Filter traits
  const filteredTraits = traits.filter(trait => {
    const matchesSearch = trait.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (trait.category && trait.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'ALL' || trait.type === filterType;
    return matchesSearch && matchesType;
  });

  const positiveCount = traits.filter(t => t.type === 'POSITIF').length;
  const negativeCount = traits.filter(t => t.type === 'NEGATIF').length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-indigo-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-emerald-200 mb-2 border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Master Data Karakter Siswa
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Input Karakter Siswa
          </h1>
          <p className="text-sm text-emerald-100/90 mt-1 max-w-2xl">
            Kelola pilihan karakter positif dan negatif beserta bobot nilai poin karakter untuk digunakan guru dalam penilain perilaku siswa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleOpenPredicateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-2xl border border-white/20 backdrop-blur-md shadow-md transition-all transform active:scale-95 cursor-pointer shrink-0"
          >
            <Sliders className="w-5 h-5 text-amber-300" />
            <span>Setting Predikat</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold rounded-2xl shadow-lg transition-all transform active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-5 h-5" />
            <span>Tambah Karakter Baru</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Master Karakter</p>
            <p className="text-2xl font-black text-slate-800">{traits.length} <span className="text-xs font-semibold text-slate-500">item</span></p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-blue-700 font-semibold">Karakter Positif</p>
            <p className="text-2xl font-black text-blue-800">{positiveCount} <span className="text-xs font-semibold text-blue-600">pilihan</span></p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-red-100 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold text-xl shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-red-700 font-semibold">Karakter Negatif</p>
            <p className="text-2xl font-black text-red-800">{negativeCount} <span className="text-xs font-semibold text-red-600">pilihan</span></p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau kategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Jenis:
          </span>
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              filterType === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({traits.length})
          </button>
          <button
            onClick={() => setFilterType('POSITIF')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              filterType === 'POSITIF'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Positif (+{positiveCount})
          </button>
          <button
            onClick={() => setFilterType('NEGATIF')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              filterType === 'NEGATIF'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            Negatif (-{negativeCount})
          </button>
        </div>
      </div>

      {/* Character Trait Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
            Daftar Master Input Karakter Siswa
          </h2>
          <span className="text-xs text-slate-500">
            Menampilkan {filteredTraits.length} data
          </span>
        </div>

        {filteredTraits.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertTriangle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-medium text-slate-700">Tidak ada data karakter ditemukan.</p>
            <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau tambah karakter baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                  <th className="p-3.5 pl-5">Jenis Karakter</th>
                  <th className="p-3.5">Nama Karakter</th>
                  <th className="p-3.5">Nilai Poin</th>
                  <th className="p-3.5">Kategori</th>
                  <th className="p-3.5 text-right pr-5">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTraits.map((trait) => (
                  <tr key={trait.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Jenis Badge */}
                    <td className="p-3.5 pl-5">
                      {trait.type === 'POSITIF' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          Positif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                          Negatif
                        </span>
                      )}
                    </td>

                    {/* Nama Karakter */}
                    <td className="p-3.5 font-semibold text-slate-800">
                      {trait.name}
                    </td>

                    {/* Nilai Poin */}
                    <td className="p-3.5 font-black text-base">
                      {trait.type === 'POSITIF' ? (
                        <span className="text-blue-600">+{trait.points} Poin</span>
                      ) : (
                        <span className="text-red-600">-{trait.points} Poin</span>
                      )}
                    </td>

                    {/* Kategori */}
                    <td className="p-3.5">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-medium">
                        {trait.category || 'Umum'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right pr-5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEdit(trait)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(trait)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Form Create / Edit */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg">
                  {editingId ? 'Edit Master Karakter' : 'Tambah Master Karakter Siswa'}
                </h3>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Jenis Karakter Selection */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                  1. Pilihan Jenis Karakter <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTraitType('POSITIF')}
                    className={`p-3.5 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-sm transition-all cursor-pointer ${
                      traitType === 'POSITIF'
                        ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className={`w-5 h-5 ${traitType === 'POSITIF' ? 'text-blue-600' : 'text-slate-400'}`} />
                    Karakter Positif
                  </button>

                  <button
                    type="button"
                    onClick={() => setTraitType('NEGATIF')}
                    className={`p-3.5 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold text-sm transition-all cursor-pointer ${
                      traitType === 'NEGATIF'
                        ? 'border-red-500 bg-red-50 text-red-800 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <XCircle className={`w-5 h-5 ${traitType === 'NEGATIF' ? 'text-red-600' : 'text-slate-400'}`} />
                    Karakter Negatif
                  </button>
                </div>
              </div>

              {/* Input Nama Karakter */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  2. Nama Karakter <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    traitType === 'POSITIF' 
                      ? 'Contoh: Datang Tepat Waktu, Membantu Teman' 
                      : 'Contoh: Terlambat Masuk Kelas, Membuang Sampah Sembarangan'
                  }
                  value={traitName}
                  onChange={(e) => setTraitName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Input Nilai Poin Karakter */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  3. Nilai Poin Karakter <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={traitPoints}
                    onChange={(e) => setTraitPoints(Number(e.target.value))}
                    className="w-full pl-4 pr-16 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-md">
                    POIN
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {traitType === 'POSITIF' 
                    ? 'Poin ini akan MENAMBAH nilai positif karakter siswa.' 
                    : 'Poin ini akan MENGURANGI (karakter negatif) nilai siswa.'}
                </p>
              </div>

              {/* Input Kategori */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                  4. Kategori Karakter
                </label>
                <select
                  value={traitCategory}
                  onChange={(e) => setTraitCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Kedisiplinan">Kedisiplinan</option>
                  <option value="Keaktifan">Keaktifan / KBM</option>
                  <option value="Kebersihan">Kebersihan & Lingkungan</option>
                  <option value="Integritas">Integritas & Kejujuran</option>
                  <option value="Sosial">Sosial & Kerjasama</option>
                  <option value="Prestasi">Prestasi</option>
                  <option value="Pelanggaran">Pelanggaran / Ketertiban</option>
                  <option value="Umum">Umum</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  {editingId ? 'Simpan Perubahan' : 'Tambah Karakter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Setting Rentang Nilai Predikat */}
      {showPredicateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Setting Rentang Predikat Karakter</h3>
                  <p className="text-xs text-slate-300">Atur batas minimal poin untuk menentukan predikat siswa</p>
                </div>
              </div>
              <button
                onClick={() => setShowPredicateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePredicateForm} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Sangat Baik (A) */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-600" /> Predikat Sangat Baik (A)
                  </label>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-emerald-200 text-emerald-800 rounded-full">
                    Poin ≥ {inputMinA}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Batas Minimal Poin:</span>
                  <input
                    type="number"
                    required
                    value={inputMinA}
                    onChange={(e) => setInputMinA(Number(e.target.value))}
                    className="w-28 px-3 py-1.5 bg-white border border-emerald-300 rounded-xl text-slate-800 font-bold text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-500 font-semibold">Poin</span>
                </div>
              </div>

              {/* Baik (B) */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-blue-600" /> Predikat Baik (B)
                  </label>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-blue-200 text-blue-800 rounded-full">
                    {inputMinB} ≤ Poin &lt; {inputMinA}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Batas Minimal Poin:</span>
                  <input
                    type="number"
                    required
                    value={inputMinB}
                    onChange={(e) => setInputMinB(Number(e.target.value))}
                    className="w-28 px-3 py-1.5 bg-white border border-blue-300 rounded-xl text-slate-800 font-bold text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500 font-semibold">Poin</span>
                </div>
              </div>

              {/* Cukup (C) */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" /> Predikat Cukup (C)
                  </label>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-200 text-amber-800 rounded-full">
                    {inputMinC} ≤ Poin &lt; {inputMinB}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Batas Minimal Poin:</span>
                  <input
                    type="number"
                    required
                    value={inputMinC}
                    onChange={(e) => setInputMinC(Number(e.target.value))}
                    className="w-28 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-slate-800 font-bold text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs text-slate-500 font-semibold">Poin</span>
                </div>
              </div>

              {/* Perlu Pembinaan (D) */}
              <div className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-orange-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-orange-600" /> Predikat Perlu Pembinaan (D)
                  </label>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-orange-200 text-orange-800 rounded-full">
                    {inputMinD} ≤ Poin &lt; {inputMinC}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Batas Minimal Poin:</span>
                  <input
                    type="number"
                    required
                    value={inputMinD}
                    onChange={(e) => setInputMinD(Number(e.target.value))}
                    className="w-28 px-3 py-1.5 bg-white border border-orange-300 rounded-xl text-slate-800 font-bold text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-xs text-slate-500 font-semibold">Poin</span>
                </div>
              </div>

              {/* Kriteria Tidak Naik Kelas (E) */}
              <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Predikat Tidak Naik Kelas (E)
                  </label>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-rose-200 text-rose-800 rounded-full">
                    {inputMinE} ≤ Poin &lt; {inputMinD}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">Batas Minimal Poin:</span>
                  <input
                    type="number"
                    required
                    value={inputMinE}
                    onChange={(e) => setInputMinE(Number(e.target.value))}
                    className="w-28 px-3 py-1.5 bg-white border border-rose-300 rounded-xl text-slate-800 font-bold text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <span className="text-xs text-slate-500 font-semibold">Poin</span>
                </div>
              </div>

              {/* Kriteria Pindah Sekolah (F) */}
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-purple-600" /> Predikat Pindah Sekolah (F)
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">Otomatis diberikan jika total poin kurang dari batas kriteria nilai E</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-purple-200 text-purple-800 rounded-full shrink-0">
                  Poin &lt; {inputMinE}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPredicateModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Master Karakter */}
      {deleteConfirmTrait && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shrink-0">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">Konfirmasi Hapus Karakter</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Apakah Anda yakin ingin menghapus master data karakter <strong className="text-slate-900">"{deleteConfirmTrait.name}"</strong>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTrait(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTrait(deleteConfirmTrait.id);
                  setDeleteConfirmTrait(null);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-600/30 transition-all cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
