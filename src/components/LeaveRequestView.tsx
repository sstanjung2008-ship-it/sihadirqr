import React, { useState } from 'react';
import { LeaveRequest, Student, UserRole, ChatMessage } from '../types';
import { 
  MessageSquare, 
  Paperclip, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Image as ImageIcon, 
  FileText, 
  Plus, 
  User, 
  Eye, 
  HeartPulse,
  Upload
} from 'lucide-react';

interface LeaveRequestViewProps {
  leaveRequests: LeaveRequest[];
  students: Student[];
  currentRole: UserRole;
  selectedChildId?: string;
  onAddLeaveRequest: (req: LeaveRequest) => void;
  onUpdateLeaveStatus: (reqId: string, status: LeaveRequest['status'], adminNotes?: string) => void;
  onSendChatMessage: (reqId: string, message: ChatMessage) => void;
}

export const LeaveRequestView: React.FC<LeaveRequestViewProps> = ({
  leaveRequests,
  students,
  currentRole,
  selectedChildId,
  onAddLeaveRequest,
  onUpdateLeaveStatus,
  onSendChatMessage,
}) => {
  const [activeLeaveId, setActiveLeaveId] = useState<string>(leaveRequests[0]?.id || '');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // New Chat Message State
  const [chatText, setChatText] = useState('');

  // Submit Leave Form State
  const [formStudentId, setFormStudentId] = useState(selectedChildId || students[0]?.id || '');
  const [formType, setFormType] = useState<'SAKIT' | 'IZIN' | 'DESAK'>('SAKIT');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [formReason, setFormReason] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');

  // Filter list
  let visibleRequests = leaveRequests;
  if (currentRole === 'PARENT' && selectedChildId) {
    visibleRequests = leaveRequests.filter(r => r.studentId === selectedChildId);
  }

  const activeRequest = visibleRequests.find(r => r.id === activeLeaveId) || visibleRequests[0];

  // Handle Photo File Upload (Convert to Data URL)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const student = students.find(s => s.id === formStudentId) || students[0];

    const defaultPhoto = formPhotoUrl || "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=500&auto=format&fit=crop&q=80";

    const newReq: LeaveRequest = {
      id: `leave-${Date.now()}`,
      studentId: student.id,
      studentName: student.name,
      className: student.className,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      startDate: formStartDate,
      endDate: formEndDate,
      type: formType,
      reason: formReason,
      photoProofUrl: defaultPhoto,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      chatHistory: [
        {
          id: `msg-${Date.now()}`,
          senderRole: 'PARENT',
          senderName: `${student.parentName} (Orang Tua)`,
          message: `Mengajukan permohonan ${formType}: ${formReason}`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          attachmentUrl: defaultPhoto
        }
      ]
    };

    onAddLeaveRequest(newReq);
    setActiveLeaveId(newReq.id);
    setIsSubmitModalOpen(false);
    setFormReason('');
    setFormPhotoUrl('');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim() || !activeRequest) return;

    const senderName = currentRole === 'PARENT' 
      ? `${activeRequest.parentName} (Orang Tua)`
      : 'Pihak Sekolah (Admin / Guru BK)';

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderRole: currentRole === 'PARENT' ? 'PARENT' : 'ADMIN',
      senderName,
      message: chatText,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    onSendChatMessage(activeRequest.id, newMsg);
    setChatText('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-indigo-600" />
            Permohonan Izin / Sakit & Chat Langsung Sekolah
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Fitur pengajuan surat dokter & perizinan orang tua dengan upload foto bukti serta obrolan langsung dengan admin sekolah.
          </p>
        </div>

        {currentRole === 'PARENT' && (
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-2xl shadow-md flex items-center gap-2 text-xs transition-all cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Buat Permohonan Izin Baru
          </button>
        )}
      </div>

      {/* Main Grid: Request List (4 cols), Chat & Details (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Request List (4 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider px-1">
            Daftar Permohonan Izin ({visibleRequests.length})
          </h3>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            {visibleRequests.map((req) => {
              const isActive = req.id === activeRequest?.id;

              return (
                <div
                  key={req.id}
                  onClick={() => setActiveLeaveId(req.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    isActive
                      ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-300 shadow-sm'
                      : 'bg-slate-50 border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      req.type === 'SAKIT' ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-sky-100 text-sky-800 border-sky-200'
                    }`}>
                      {req.type}
                    </span>

                    {req.status === 'PENDING' && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-spin text-amber-600" />
                        MENUNGGU
                      </span>
                    )}
                    {req.status === 'APPROVED' && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        DISETUJUI
                      </span>
                    )}
                    {req.status === 'REJECTED' && (
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        DITOLAK
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">{req.studentName} ({req.className})</h4>
                    <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5 font-medium">{req.reason}</p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200/60 pt-2 font-medium">
                    <span>Wali: {req.parentName}</span>
                    <span>{req.startDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Active Details & Live Chat Thread (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {activeRequest ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
              
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Permohonan {activeRequest.type}: {activeRequest.studentName} ({activeRequest.className})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Dari: <strong className="text-slate-800">{activeRequest.parentName}</strong> ({activeRequest.parentPhone})
                  </p>
                </div>

                {/* Status Action Buttons for Admin/Teacher */}
                {currentRole !== 'PARENT' && activeRequest.status === 'PENDING' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateLeaveStatus(activeRequest.id, 'APPROVED', 'Izin telah disetujui')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Setujui
                    </button>
                    <button
                      onClick={() => onUpdateLeaveStatus(activeRequest.id, 'REJECTED', 'Izin ditolak')}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Tolak
                    </button>
                  </div>
                )}
              </div>

              {/* Leave Reason & Uploaded Photo Proof Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Alasan Permohonan</span>
                    <p className="text-xs text-slate-800 font-medium leading-relaxed mt-1">{activeRequest.reason}</p>
                  </div>

                  {activeRequest.photoProofUrl && (
                    <button
                      onClick={() => setPreviewPhotoUrl(activeRequest.photoProofUrl!)}
                      className="shrink-0 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 p-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      Foto Surat Bukti
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Thread */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Obrolan & Chat Langsung
                </h4>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 h-64 overflow-y-auto space-y-3 flex flex-col">
                  {activeRequest.chatHistory && activeRequest.chatHistory.length > 0 ? (
                    activeRequest.chatHistory.map((msg) => {
                      const isSender = currentRole === 'PARENT'
                        ? msg.senderRole === 'PARENT'
                        : msg.senderRole !== 'PARENT';

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isSender ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div className={`max-w-[80%] rounded-2xl p-3 space-y-1 ${
                            isSender
                              ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10'
                              : 'bg-white text-slate-800 rounded-tl-none border border-slate-200 shadow-sm'
                          }`}>
                            <div className={`flex items-center justify-between gap-3 text-[10px] ${
                              isSender ? 'text-indigo-100' : 'text-slate-500'
                            }`}>
                              <span className="font-bold">
                                {msg.senderName} {isSender ? '(Saya)' : ''}
                              </span>
                              <span className="font-mono">{msg.timestamp}</span>
                            </div>
                            <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap">{msg.message}</p>
                            {msg.attachmentUrl && (
                              <div className="mt-2 pt-2 border-t border-slate-200/40">
                                <img
                                  src={msg.attachmentUrl}
                                  alt="Attachment"
                                  className="w-32 h-24 object-cover rounded-lg border border-slate-200 cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewPhotoUrl(msg.attachmentUrl!)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-8 text-xs">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
                      <p className="font-medium">Belum ada obrolan untuk permohonan ini.</p>
                      <p className="text-[10px] text-slate-400">Tulis pesan pertama Anda di bawah.</p>
                    </div>
                  )}
                </div>

                {/* Send Chat Form */}
                <form onSubmit={handleSendChat} className="flex gap-2">
                  <input
                    type="text"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder="Tulis pesan ke sekolah / wali murid..."
                    className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    Kirim
                  </button>
                </form>

              </div>

            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center text-slate-400 text-xs">
              Belum ada permohonan izin yang dipilih.
            </div>
          )}
        </div>

      </div>

      {/* Submit Leave Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-100 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">
              Formulir Permohonan Izin / Sakit
            </h3>

            <form onSubmit={handleCreateRequest} className="space-y-3 text-xs">
              
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Pilih Siswa</label>
                <select
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-semibold"
                >
                  {[...students]
                    .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }))
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.className})</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Kategori Izin</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-semibold"
                >
                  <option value="SAKIT">SAKIT (Surat Dokter)</option>
                  <option value="IZIN">IZIN (Keperluan Keluarga)</option>
                  <option value="DESAK">DESAK (Keperluan Mendesak)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tanggal Mulai</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tanggal Selesai</label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Alasan Penjelasan</label>
                <textarea
                  required
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Jelaskan alasan izin / sakit secara rinci..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Upload Foto Surat Dokter / Keterangan Orang Tua</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl p-2 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl shadow-md cursor-pointer"
                >
                  Kirim Permohonan
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-white border border-slate-100 rounded-3xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800">Lampiran Foto Bukti Keterangan Dokter / Orang Tua</span>
              <button onClick={() => setPreviewPhotoUrl(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex justify-center">
              <img src={previewPhotoUrl} alt="Doctor Note Proof" className="max-w-full rounded-2xl object-contain shadow-md" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
