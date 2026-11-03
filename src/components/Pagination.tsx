import React, { useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  pageSizeOptions = [25, 50, 100],
  itemLabel = 'siswa',
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(safeCurrentPage * itemsPerPage, totalItems);

  // Generate numbered pagination items with ellipsis (...)
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];

    if (safeCurrentPage <= 4) {
      // Near the beginning: 1, 2, 3, 4, 5, '...', totalPages
      for (let i = 1; i <= 5; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    } else if (safeCurrentPage >= totalPages - 3) {
      // Near the end: 1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Somewhere in the middle: 1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages
      pages.push(1);
      pages.push('...');
      pages.push(safeCurrentPage - 1);
      pages.push(safeCurrentPage);
      pages.push(safeCurrentPage + 1);
      pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  }, [safeCurrentPage, totalPages]);

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== safeCurrentPage) {
      onPageChange(page);
    }
  };

  return (
    <div 
      className={`bg-white border border-slate-200/90 rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 text-xs select-none transition-all ${className}`}
    >
      {/* SISI KIRI: Informasi status data & Dropdown baris per halaman */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-slate-600 font-medium">
        {/* Teks Informasi Data: "Menampilkan 1 - 25 dari 436 siswa" */}
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span>Menampilkan</span>
          <span className="font-extrabold text-slate-900 bg-slate-100/90 px-2 py-0.5 rounded-lg border border-slate-200/70 font-mono">
            {startItem} - {endItem}
          </span>
          <span>dari</span>
          <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 font-mono">
            {totalItems}
          </span>
          <span className="capitalize">{itemLabel}</span>
        </div>

        {/* Pemisah Vertikal */}
        {onItemsPerPageChange && (
          <span className="hidden sm:inline-block w-px h-4 bg-slate-200" aria-hidden="true" />
        )}

        {/* Dropdown Pengatur Baris Per Halaman: [25, 50, 100] */}
        {onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <label htmlFor="rows-per-page-select" className="text-slate-500 font-medium text-[11px] sm:text-xs">
              Tampilkan:
            </label>
            <div className="relative inline-block">
              <select
                id="rows-per-page-select"
                value={itemsPerPage}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  onItemsPerPageChange(newSize);
                  onPageChange(1);
                }}
                className="appearance-none bg-slate-50 hover:bg-slate-100/80 active:bg-slate-100 text-slate-800 font-bold border border-slate-300/80 rounded-xl pl-3 pr-7 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer shadow-2xs transition-all"
                title="Pilih jumlah baris yang ditampilkan per halaman"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} baris
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
            <span className="text-slate-400 text-[11px] hidden sm:inline">/ hal</span>
          </div>
        )}
      </div>

      {/* SISI KANAN: Tombol Navigasi Halaman Horizontal */}
      <nav 
        aria-label="Navigasi Halaman"
        className="flex items-center gap-1 sm:gap-1.5 flex-wrap self-end md:self-center shrink-0"
      >
        {/* Tombol Loncat ke Halaman Pertama («) */}
        <button
          type="button"
          onClick={() => handlePageClick(1)}
          disabled={safeCurrentPage === 1}
          className="w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center transition-all cursor-pointer shadow-2xs font-extrabold text-xs"
          title="Loncat ke Halaman Pertama («)"
          aria-label="Halaman Pertama"
        >
          <ChevronsLeft className="w-4 h-4 text-slate-700" />
        </button>

        {/* Tombol "Sebelumnya" (< Sebelumnya) */}
        <button
          type="button"
          onClick={() => handlePageClick(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className="h-8 px-2.5 sm:px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-1 transition-all cursor-pointer shadow-2xs font-bold text-xs"
          title="Halaman Sebelumnya"
          aria-label="Halaman Sebelumnya"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-slate-700" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        {/* Tombol Nomor Halaman dengan Indikator Halaman Aktif (Ungu/Biru) */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((pageItem, index) => {
            if (pageItem === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="w-6 h-8 flex items-center justify-center text-slate-400 font-extrabold text-xs select-none tracking-widest"
                >
                  ...
                </span>
              );
            }

            const pageNum = Number(pageItem);
            const isActive = pageNum === safeCurrentPage;

            return (
              <button
                key={`page-${pageNum}`}
                type="button"
                onClick={() => handlePageClick(pageNum)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-w-[32px] h-8 px-2 rounded-xl font-black text-xs flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                  isActive
                    ? 'bg-indigo-600 text-white border-2 border-indigo-600 ring-2 ring-indigo-500/25 shadow-md shadow-indigo-600/30 font-black'
                    : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300'
                }`}
                title={`Buka Halaman ${pageNum}`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Tombol "Berikutnya" (Berikutnya >) */}
        <button
          type="button"
          onClick={() => handlePageClick(safeCurrentPage + 1)}
          disabled={safeCurrentPage === totalPages || totalPages === 0}
          className="h-8 px-2.5 sm:px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-1 transition-all cursor-pointer shadow-2xs font-bold text-xs"
          title="Halaman Berikutnya"
          aria-label="Halaman Berikutnya"
        >
          <span className="hidden sm:inline">Berikutnya</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
        </button>

        {/* Tombol Loncat ke Halaman Terakhir (») */}
        <button
          type="button"
          onClick={() => handlePageClick(totalPages)}
          disabled={safeCurrentPage === totalPages || totalPages === 0}
          className="w-8 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center transition-all cursor-pointer shadow-2xs font-extrabold text-xs"
          title={`Loncat ke Halaman Terakhir (${totalPages}) (»)`}
          aria-label="Halaman Terakhir"
        >
          <ChevronsRight className="w-4 h-4 text-slate-700" />
        </button>
      </nav>
    </div>
  );
};
