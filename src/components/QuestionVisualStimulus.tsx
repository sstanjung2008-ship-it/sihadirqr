import React, { useState } from 'react';
import { Image as ImageIcon, Eye, Download, Maximize2, Sparkles, RefreshCw } from 'lucide-react';
import { generateQuestionSvg } from '../lib/questionDiagramUtils';

interface QuestionVisualStimulusProps {
  questionNumber: number;
  questionType: string;
  subject?: string;
  topic?: string;
  description?: string;
  svgContent?: string;
  imageUrl?: string;
  onRegenerateVisual?: () => void;
}

export const QuestionVisualStimulus: React.FC<QuestionVisualStimulusProps> = ({
  questionNumber,
  questionType,
  subject = '',
  topic = '',
  description = '',
  svgContent,
  imageUrl,
  onRegenerateVisual
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeVisualMode, setActiveVisualMode] = useState<'diagram' | 'desc'>('diagram');

  // Generate SVG if not provided
  const renderedSvg = svgContent || generateQuestionSvg({
    subject,
    topic,
    description,
    questionNumber
  });

  const handleDownloadSvg = () => {
    const blob = new Blob([renderedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Diagram_Soal_No_${questionNumber}_${subject.replace(/\s+/g, '_')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-50 border-2 border-indigo-100/90 rounded-2xl p-4 my-3.5 shadow-2xs space-y-3 transition-all hover:border-indigo-300">
      {/* Header bar of the visual stimulus */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100/70 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <ImageIcon className="w-4 h-4" />
          </span>
          <div>
            <div className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
              <span>Stimulus Visual Soal No. {questionNumber}</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                Grafik & Diagram
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {topic ? `${topic} • ` : ''}{subject || 'Materi Ujian'}
            </p>
          </div>
        </div>

        {/* Visual action buttons */}
        <div className="flex items-center gap-1.5">
          <div className="flex bg-white p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveVisualMode('diagram')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                activeVisualMode === 'diagram'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Diagram Visual
            </button>
            <button
              type="button"
              onClick={() => setActiveVisualMode('desc')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                activeVisualMode === 'desc'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Deskripsi Teks
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            title="Lihat Ukuran Penuh"
            className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleDownloadSvg}
            title="Unduh Diagram SVG"
            className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-indigo-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Visual Display */}
      {activeVisualMode === 'diagram' ? (
        <div className="relative group bg-white rounded-xl p-2 sm:p-3 border border-slate-200/80 shadow-inner flex flex-col items-center justify-center min-h-[160px]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Visual stimulus no ${questionNumber}`}
              className="max-h-64 object-contain rounded-lg shadow-xs"
            />
          ) : (
            <div
              className="w-full flex items-center justify-center overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: renderedSvg }}
            />
          )}

          {/* Caption */}
          {description && (
            <div className="w-full mt-2.5 pt-2 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-600 italic font-medium leading-relaxed max-w-2xl mx-auto">
                {description}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Rincian Deskripsi Stimulus Visual (Pedoman Guru & Soal):</span>
          </div>
          <p className="italic text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
            {description || 'Diagram skema proses dan visualisasi data pengamatan sesuai materi.'}
          </p>
          <div className="text-[11px] text-slate-500">
            Diagram ini secara otomatis diintegrasikan dan dirender ke dalam naskah soal dan berkas Microsoft Word (.doc).
          </div>
        </div>
      )}

      {/* Modal Zoom Preview */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-white/20">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-indigo-600" />
                  <span>Pratinjau Diagram Penuh - Soal No. {questionNumber}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {subject} • {topic}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center">
              {imageUrl ? (
                <img src={imageUrl} alt="Zoom visual" className="max-h-[70vh] object-contain rounded-lg" />
              ) : (
                <div
                  className="w-full flex items-center justify-center max-h-[70vh] overflow-auto"
                  dangerouslySetInnerHTML={{ __html: renderedSvg }}
                />
              )}
            </div>

            {description && (
              <p className="text-xs text-slate-600 italic bg-amber-50/60 p-3 rounded-xl border border-amber-200/60 text-center font-medium">
                {description}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File Diagram (SVG)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
