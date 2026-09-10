import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Student, Teacher, SchoolClass, SchoolProfile, UserRole, UserSession } from '../types';
import { 
  MessageSquare, 
  Send, 
  Paperclip, 
  Phone, 
  UserCheck, 
  Megaphone, 
  HeartHandshake, 
  CheckCheck, 
  ExternalLink, 
  ShieldCheck, 
  Image as ImageIcon, 
  X, 
  Clock, 
  GraduationCap,
  Sparkles,
  ChevronRight,
  Info,
  Filter,
  User
} from 'lucide-react';

export interface DirectChatMessage {
  id: string;
  senderRole: 'PARENT' | 'STAFF';
  senderName: string;
  message: string;
  timestamp: string;
  attachmentUrl?: string;
}

interface ParentChatViewProps {
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  selectedChildId: string;
  schoolProfile: SchoolProfile;
  userRole: UserRole;
  userSession?: UserSession | null;
}

type ContactType = 'WALI_KELAS' | 'HUMAS' | 'BK';

export const ParentChatView: React.FC<ParentChatViewProps> = ({
  students,
  teachers,
  classes,
  selectedChildId,
  schoolProfile,
  userRole,
  userSession,
}) => {
  const isStaffView = userRole === 'TEACHER' || userRole === 'ADMIN';
  const isTeacherAccount = userRole === 'TEACHER' || userSession?.role === 'TEACHER';
  const loggedInTeacherName = userSession?.displayName || '';

  const loggedTeacher = teachers.find(
    t => (loggedInTeacherName && t.name.toLowerCase() === loggedInTeacherName.toLowerCase()) ||
         (userSession?.teacherId && t.id === userSession.teacherId) ||
         (t.nip && userSession?.username && t.nip.trim() === userSession.username.trim()) ||
         (t.nip && userSession?.nipOrNisn && t.nip.trim() === userSession.nipOrNisn.trim())
  ) || {
    id: userSession?.teacherId || 'tch-logged-in',
    nip: userSession?.username || '-',
    name: loggedInTeacherName || 'Guru Terdaftar',
    birthPlace: '-',
    birthDate: '1985-01-01',
    subject1: 'Guru Pengajar',
    additionalDuty: 'GURU_PENGAJAR',
    phone: '081234567890',
    email: 'guru@smpn1cerdas.sch.id',
    gender: 'L',
    status: 'AKTIF'
  };

  // Internal active child selection
  const [activeChildId, setActiveChildId] = useState<string>(selectedChildId || students[0]?.id || '');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');

  // Extract available unique class names
  const availableClassNames = useMemo(() => {
    const fromClasses = classes.map(c => c.name);
    const fromStudents = students.map(s => s.className);
    const merged = Array.from(new Set([...fromClasses, ...fromStudents])).filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return merged;
  }, [classes, students]);

  // Filtered students based on class selection
  const filteredStudents = useMemo(() => {
    if (selectedClassFilter === 'ALL') return students;
    return students.filter(s => s.className === selectedClassFilter);
  }, [students, selectedClassFilter]);

  // Sync if selectedChildId changes externally
  useEffect(() => {
    if (selectedChildId) {
      setActiveChildId(selectedChildId);
    }
  }, [selectedChildId]);

  // Sync activeChildId if current activeChildId is not in filteredStudents
  useEffect(() => {
    if (filteredStudents.length > 0 && !filteredStudents.some(s => s.id === activeChildId)) {
      setActiveChildId(filteredStudents[0].id);
    }
  }, [selectedClassFilter, filteredStudents, activeChildId]);

  const activeStudent = students.find(s => s.id === activeChildId) || students[0];
  const [activeContactType, setActiveContactType] = useState<ContactType>('WALI_KELAS');

  // Input states
  const [messageText, setMessageText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [isSimulatingResponse, setIsSimulatingResponse] = useState(false);

  // Chat storage state
  const [chatThreads, setChatThreads] = useState<Record<string, DirectChatMessage[]>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chats from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sihadir_parent_direct_chats_v2');
    if (saved) {
      try {
        setChatThreads(JSON.parse(saved));
      } catch {
        setChatThreads({});
      }
    }
  }, []);

  // Save chats to localStorage
  const saveThreads = (updated: Record<string, DirectChatMessage[]>) => {
    setChatThreads(updated);
    try {
      localStorage.setItem('sihadir_parent_direct_chats_v2', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving chats:', e);
    }
  };

  // 1. Resolve Wali Kelas contact for the selected child
  const childClass = classes.find(c => c.name === activeStudent?.className || c.id === activeStudent?.classId);
  
  const waliKelasTeacher = teachers.find(t => 
    (t.additionalDuty === 'WALI_KELAS' && (t.homeroomClassName === activeStudent?.className || t.homeroomClassId === activeStudent?.classId)) ||
    t.homeroomClassName === activeStudent?.className ||
    (childClass && childClass.homeroomTeacher && t.name.toLowerCase().includes(childClass.homeroomTeacher.toLowerCase()))
  ) || {
    id: 'tch-walikelas-default',
    nip: '19850312 201001 2 015',
    name: childClass?.homeroomTeacher || 'Siti Rahmawati, S.Pd.',
    birthPlace: '-',
    birthDate: '1985-03-12',
    subject1: 'Wali Kelas & Guru Mata Pelajaran',
    additionalDuty: 'WALI_KELAS',
    homeroomClassName: activeStudent?.className || '7-A',
    phone: '081234567891',
    email: 'walikelas@smpn1cerdas.sch.id',
    gender: 'P',
    status: 'AKTIF'
  };

  // 2. Resolve Humas contact
  const humasTeacher = teachers.find(t => t.additionalDuty === 'HUMAS') || {
    id: 'tch-humas-default',
    nip: '19820514 200801 2 006',
    name: 'Dra. Hj. Rina Wijaya',
    birthPlace: 'Jakarta',
    birthDate: '1982-05-14',
    subject1: 'Humas & Layanan Informasi Sekolah',
    additionalDuty: 'HUMAS',
    phone: '081299887766',
    email: 'humas@smpn1cerdas.sch.id',
    gender: 'P',
    status: 'AKTIF'
  };

  // 3. Resolve BK contact
  const bkTeacher = teachers.find(t => t.additionalDuty === 'BK') || {
    id: 'tch-bk-default',
    nip: '19900210 201801 1 003',
    name: 'Ahmad Fauzi, S.Psi.',
    birthPlace: 'Surabaya',
    birthDate: '1990-02-10',
    subject1: 'Bimbingan Konseling (BK)',
    additionalDuty: 'BK',
    phone: '081377665544',
    email: 'bk@smpn1cerdas.sch.id',
    gender: 'L',
    status: 'AKTIF'
  };

  // Get active contact object
  const getActiveContact = () => {
    if (isTeacherAccount) {
      const roleTitleDisplay = loggedTeacher.additionalDuty === 'WALI_KELAS' 
        ? `Wali Kelas ${loggedTeacher.homeroomClassName || activeStudent?.className || ''}` 
        : loggedTeacher.additionalDuty === 'HUMAS'
        ? 'Tim Humas Sekolah'
        : loggedTeacher.additionalDuty === 'BK'
        ? 'Bimbingan Konseling (BK)'
        : loggedTeacher.additionalDuty === 'ADMIN'
        ? 'Administrator Sekolah'
        : loggedTeacher.additionalDuty === 'TU'
        ? 'Tata Usaha (TU)'
        : loggedTeacher.additionalDuty === 'PERPUSTAKAAN'
        ? 'Pengelola Perpustakaan'
        : (loggedTeacher.subject1 ? `Guru ${loggedTeacher.subject1}` : 'Guru Pengajar');

      return {
        type: 'WALI_KELAS' as ContactType,
        roleTitle: roleTitleDisplay,
        badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        icon: UserCheck,
        iconBg: 'bg-indigo-600',
        teacher: loggedTeacher,
        subtitle: `Terhubung dengan Wali Murid ${activeStudent?.name || 'Siswa'}`,
        defaultWelcome: `Halo Bpk/Ibu Wali Murid dari ${activeStudent?.name || 'Siswa'} (Kelas ${activeStudent?.className || ''}). Saya ${loggedTeacher.name}. Silakan sampaikan pesan atau konsultasi Anda.`
      };
    }

    switch (activeContactType) {
      case 'WALI_KELAS':
        return {
          type: 'WALI_KELAS' as ContactType,
          roleTitle: `Wali Kelas ${activeStudent?.className || ''}`,
          badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: UserCheck,
          iconBg: 'bg-emerald-600',
          teacher: waliKelasTeacher,
          subtitle: `Terhubung otomatis dengan Wali Kelas Ananda ${activeStudent?.name || ''}`,
          defaultWelcome: `Halo Bpk/Ibu Wali dari ${activeStudent?.name || 'Siswa'} (Kelas ${activeStudent?.className || ''}). Saya ${waliKelasTeacher.name}, Wali Kelas Ananda. Silakan sampaikan jika ada pertanyaan mengenai absensi, jurnal KBM, atau aktivitas Ananda di sekolah.`
        };
      case 'HUMAS':
        return {
          type: 'HUMAS' as ContactType,
          roleTitle: 'Tim Humas & Layanan Informasi',
          badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
          icon: Megaphone,
          iconBg: 'bg-cyan-600',
          teacher: humasTeacher,
          subtitle: 'Layanan Hubungan Masyarakat & Informasi Umum Sekolah',
          defaultWelcome: `Selamat datang di Layanan Humas ${schoolProfile.name}. Saya ${humasTeacher.name} dari Tim Humas. Ada yang bisa kami bantu terkait informasi kegiatan sekolah, perizinan, atau pengumuman resmi?`
        };
      case 'BK':
        return {
          type: 'BK' as ContactType,
          roleTitle: 'Bimbingan Konseling (BK)',
          badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
          icon: HeartHandshake,
          iconBg: 'bg-purple-600',
          teacher: bkTeacher,
          subtitle: 'Layanan Konseling Siswa, Minat Bakat & Kedisiplinan',
          defaultWelcome: `Salam hangat Bpk/Ibu. Saya ${bkTeacher.name} dari Tim Bimbingan Konseling (BK). Kami siap membantu konsultasi pengembangan karakter, kedisiplinan, maupun bimbingan belajar Ananda ${activeStudent?.name || ''}.`
        };
    }
  };

  const activeContact = getActiveContact();
  const threadKey = `${activeStudent?.id || 'child'}_${activeContactType}`;

  // Get current messages or populate default welcome
  const currentMessages: DirectChatMessage[] = chatThreads[threadKey] || [
    {
      id: `init-${threadKey}`,
      senderRole: 'STAFF',
      senderName: activeContact.teacher.name,
      message: activeContact.defaultWelcome,
      timestamp: 'Hari ini, 07.30'
    }
  ];

  // Scroll to bottom on message change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, isSimulatingResponse]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle sending a message
  const handleSendMessage = (textToSend?: string) => {
    const content = textToSend || messageText;
    if (!content.trim() && !attachmentUrl) return;

    if (isStaffView) {
      // Sending as Teacher / Staff
      const newStaffMsg: DirectChatMessage = {
        id: `msg-${Date.now()}`,
        senderRole: 'STAFF',
        senderName: `${activeContact.teacher.name} (${activeContact.roleTitle})`,
        message: content.trim(),
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        attachmentUrl: attachmentUrl || undefined
      };

      const updatedList = [...currentMessages, newStaffMsg];
      const newThreads = { ...chatThreads, [threadKey]: updatedList };
      saveThreads(newThreads);

      setMessageText('');
      setAttachmentUrl(null);
    } else {
      // Sending as Parent
      const newParentMsg: DirectChatMessage = {
        id: `msg-${Date.now()}`,
        senderRole: 'PARENT',
        senderName: `${activeStudent?.parentName || 'Orang Tua'} (Wali ${activeStudent?.name})`,
        message: content.trim(),
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        attachmentUrl: attachmentUrl || undefined
      };

      const updatedList = [...currentMessages, newParentMsg];
      const newThreads = { ...chatThreads, [threadKey]: updatedList };
      saveThreads(newThreads);

      setMessageText('');
      setAttachmentUrl(null);
    }
  };

  // Open WhatsApp link directly
  const handleOpenWhatsApp = () => {
    const rawPhone = activeContact.teacher.phone || '081234567890';
    let formattedPhone = rawPhone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }
    const text = encodeURIComponent(
      isStaffView
        ? `Halo Bpk/Ibu Wali Murid ${activeStudent?.name} (Kelas ${activeStudent?.className}), ini pesan dari ${activeContact.teacher.name} (${activeContact.roleTitle}).`
        : `Halo ${activeContact.teacher.name} (${activeContact.roleTitle}), saya Wali Murid dari ${activeStudent?.name} (Kelas ${activeStudent?.className}).`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-3 py-1 rounded-full text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              {isStaffView ? 'Portal Staf & Guru Sekolah' : 'Pusat Komunikasi Orang Tua & Sekolah'}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <MessageSquare className="w-7 h-7 text-amber-300" />
              {isStaffView ? 'Fitur Chat & Komunikasi Wali Murid' : 'Fitur Chat & Kontak Sekolah'}
            </h1>
            <p className="text-xs text-indigo-200 mt-1 max-w-2xl font-medium leading-relaxed">
              {isStaffView 
                ? 'Layanan obrolan langsung untuk akun tugas tambahan Wali Kelas, Humas, dan Bimbingan Konseling (BK) dengan para Wali Murid.'
                : 'Hubungi secara langsung Wali Kelas, Humas, dan Bimbingan Konseling (BK). Wali Kelas terhubung otomatis dengan wali kelas dari ananda.'
              }
            </p>
          </div>

          {/* Active Student Card Badge / Dropdown */}
          {activeStudent && (
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3.5 flex items-center gap-3 shrink-0">
              <img 
                src={activeStudent.photoUrl} 
                alt={activeStudent.name} 
                className="w-11 h-11 rounded-xl object-cover border-2 border-white/40 shadow-sm"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="text-xs">
                <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-wider block">
                  {isStaffView ? 'Siswa / Wali Murid Terpilih' : 'Ananda Terpilih'}
                </span>
                <span className="font-black text-white text-sm block">{activeStudent.name}</span>
                <span className="text-[11px] text-amber-300 font-bold">Kelas {activeStudent.className} • Wali: {activeStudent.parentName || 'Orang Tua'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Left Contacts Selection Bar & Right Chat Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Contact Accounts Selection (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          
          {/* If Staff / Teacher View: Student Selection Box */}
          {isStaffView && (
            <div className="bg-white border border-indigo-200/80 rounded-3xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  Pilih Siswa / Wali Murid
                </label>
                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  {filteredStudents.length} Siswa
                </span>
              </div>

              <div className="space-y-2.5">
                {/* Filter Kelas */}
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-600 mb-1 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-indigo-600" />
                    Filter Kelas
                  </label>
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">Semua Kelas ({availableClassNames.length} Kelas)</option>
                    {availableClassNames.map((clsName) => (
                      <option key={clsName} value={clsName}>
                        Kelas {clsName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pilih Siswa / Wali */}
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-600 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    Nama Siswa / Wali Murid
                  </label>
                  <select
                    value={activeChildId}
                    onChange={(e) => setActiveChildId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {filteredStudents.length === 0 ? (
                      <option value="">Tidak ada siswa di kelas ini</option>
                    ) : (
                      filteredStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.className}) - Wali: {s.parentName || 'Orang Tua'}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Channel / Duty Kontak
              </h2>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full">
                {isTeacherAccount ? '1 Akun Login Guru' : '3 Tugas Resmi'}
              </span>
            </div>

            {isTeacherAccount ? (
              /* Single Account Option for Logged-In Teacher */
              <button
                onClick={() => setActiveContactType('WALI_KELAS')}
                className="w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500/30"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-white/20 text-white shrink-0">
                    <UserCheck className="w-5 h-5 text-amber-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white/20 text-white">
                        AKUN GURU LOGIN
                      </span>
                      <ChevronRight className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-extrabold text-sm mt-1 truncate">
                      {loggedTeacher.name}
                    </h3>
                    <p className="text-[11px] mt-0.5 truncate text-indigo-200">
                      {loggedTeacher.subject1 || 'Guru Pengajar Sekolah'}
                    </p>
                    <div className="mt-2 pt-2 border-t border-white/20 text-[10px] font-bold flex items-center gap-1.5 text-amber-200">
                      <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Terhubung dgn {activeStudent?.name || 'Wali Murid'}</span>
                    </div>
                  </div>
                </div>
              </button>
            ) : (
              <>
                {/* Account Option 1: Wali Kelas */}
                <button
                  onClick={() => setActiveContactType('WALI_KELAS')}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                    activeContactType === 'WALI_KELAS'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-500 shadow-md shadow-emerald-600/20 ring-2 ring-emerald-500/30'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl text-white shrink-0 ${
                      activeContactType === 'WALI_KELAS' ? 'bg-white/20' : 'bg-emerald-600'
                    }`}>
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          activeContactType === 'WALI_KELAS' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          Wali Kelas {activeStudent?.className || ''}
                        </span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${activeContactType === 'WALI_KELAS' ? 'translate-x-1 text-white' : 'text-slate-400'}`} />
                      </div>
                      <h3 className="font-extrabold text-sm mt-1 truncate">
                        {waliKelasTeacher.name}
                      </h3>
                      <p className={`text-[11px] mt-0.5 truncate ${
                        activeContactType === 'WALI_KELAS' ? 'text-emerald-100' : 'text-slate-500'
                      }`}>
                        {waliKelasTeacher.subject1 || 'Wali Kelas Siswa'}
                      </p>
                      <div className={`mt-2 pt-2 border-t text-[10px] font-bold flex items-center gap-1.5 ${
                        activeContactType === 'WALI_KELAS' ? 'border-white/20 text-amber-200' : 'border-slate-200 text-emerald-700'
                      }`}>
                        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">Terhubung dgn {activeStudent?.name}</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Account Option 2: Humas */}
                <button
                  onClick={() => setActiveContactType('HUMAS')}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                    activeContactType === 'HUMAS'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white border-cyan-500 shadow-md shadow-cyan-600/20 ring-2 ring-cyan-500/30'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl text-white shrink-0 ${
                      activeContactType === 'HUMAS' ? 'bg-white/20' : 'bg-cyan-600'
                    }`}>
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          activeContactType === 'HUMAS' ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-800'
                        }`}>
                          Humas Sekolah
                        </span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${activeContactType === 'HUMAS' ? 'translate-x-1 text-white' : 'text-slate-400'}`} />
                      </div>
                      <h3 className="font-extrabold text-sm mt-1 truncate">
                        {humasTeacher.name}
                      </h3>
                      <p className={`text-[11px] mt-0.5 truncate ${
                        activeContactType === 'HUMAS' ? 'text-cyan-100' : 'text-slate-500'
                      }`}>
                        Layanan Informasi & Hubungan Masyarakat
                      </p>
                      <div className={`mt-2 pt-2 border-t text-[10px] font-bold flex items-center gap-1.5 ${
                        activeContactType === 'HUMAS' ? 'border-white/20 text-cyan-200' : 'border-slate-200 text-cyan-700'
                      }`}>
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>Informasi umum, perizinan & event</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Account Option 3: BK */}
                <button
                  onClick={() => setActiveContactType('BK')}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                    activeContactType === 'BK'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white border-purple-500 shadow-md shadow-purple-600/20 ring-2 ring-purple-500/30'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl text-white shrink-0 ${
                      activeContactType === 'BK' ? 'bg-white/20' : 'bg-purple-600'
                    }`}>
                      <HeartHandshake className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          activeContactType === 'BK' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
                        }`}>
                          Bimbingan Konseling (BK)
                        </span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${activeContactType === 'BK' ? 'translate-x-1 text-white' : 'text-slate-400'}`} />
                      </div>
                      <h3 className="font-extrabold text-sm mt-1 truncate">
                        {bkTeacher.name}
                      </h3>
                      <p className={`text-[11px] mt-0.5 truncate ${
                        activeContactType === 'BK' ? 'text-purple-100' : 'text-slate-500'
                      }`}>
                        Konselor Kedisiplinan & Karakter
                      </p>
                      <div className={`mt-2 pt-2 border-t text-[10px] font-bold flex items-center gap-1.5 ${
                        activeContactType === 'BK' ? 'border-white/20 text-purple-200' : 'border-slate-200 text-purple-700'
                      }`}>
                        <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                        <span>Konsultasi minat & karakter</span>
                      </div>
                    </div>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Chat Panel (8 Cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl shadow-sm flex flex-col h-[640px] overflow-hidden">
          
          {/* Chat Header Bar */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-2xl p-2 text-white flex items-center justify-center shrink-0 ${activeContact.iconBg}`}>
                <activeContact.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-sm text-white truncate">{activeContact.teacher.name}</h2>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${activeContact.badgeColor}`}>
                    {activeContact.roleTitle}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">{activeContact.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Active Child Context Reminder Strip */}
          <div className="bg-indigo-50/80 border-b border-indigo-100 px-4 py-2 text-[11px] font-semibold text-indigo-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Pesan terhubung dengan data ananda: <strong className="font-extrabold">{activeStudent?.name}</strong> ({activeStudent?.className})
            </span>
            <span className="text-[10px] text-indigo-600 font-bold hidden sm:inline">SiHadir Direct Messenger</span>
          </div>

          {/* Messages Display Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 custom-scrollbar">
            {currentMessages.map((msg) => {
              // Determine if current view sender is on right or left
              const isRightSide = isStaffView ? msg.senderRole === 'STAFF' : msg.senderRole === 'PARENT';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isRightSide ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-black text-slate-500">{msg.senderName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">• {msg.timestamp}</span>
                  </div>

                  <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-2xs text-xs leading-relaxed ${
                    isRightSide
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.message}</p>

                    {msg.attachmentUrl && (
                      <div className="mt-2 pt-2 border-t border-white/20">
                        <img 
                          src={msg.attachmentUrl} 
                          alt="Lampiran" 
                          className="max-h-48 rounded-xl object-cover border border-white/20 shadow-xs cursor-pointer hover:opacity-90"
                          onClick={() => window.open(msg.attachmentUrl, '_blank')}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-0.5 px-1">
                    {isRightSide && (
                      <span className="text-[10px] text-indigo-500 font-medium flex items-center gap-0.5">
                        <CheckCheck className="w-3 h-3 text-indigo-600" />
                        Terkirim
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {isSimulatingResponse && (
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-black text-slate-500">
                    {isStaffView ? (activeStudent?.parentName || 'Orang Tua') : activeContact.teacher.name}
                  </span>
                </div>
                <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-tl-none p-3 text-xs flex items-center gap-2 shadow-2xs">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-200"></span>
                  </span>
                  <span className="text-[11px] italic font-medium">sedang mengetik balasan...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Template Suggestion Chips */}
          <div className="px-3 py-2 bg-slate-100/80 border-t border-slate-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Template Cepat:
            </span>
            {isStaffView ? (
              <>
                <button
                  onClick={() => handleSendMessage(`Mengingatkan Bpk/Ibu Wali Murid terkait kehadiran Ananda ${activeStudent?.name} di kelas.`)}
                  className="text-[11px] font-bold bg-white text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-full hover:bg-indigo-50 shrink-0 cursor-pointer transition-colors shadow-2xs"
                >
                  Pengingat Kehadiran
                </button>
                <button
                  onClick={() => handleSendMessage(`Menginformasikan catatan KBM dan perkembangan Ananda ${activeStudent?.name} di kelas ${activeStudent?.className}.`)}
                  className="text-[11px] font-bold bg-white text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-full hover:bg-indigo-50 shrink-0 cursor-pointer transition-colors shadow-2xs"
                >
                  Info Catatan KBM
                </button>
                <button
                  onClick={() => handleSendMessage(`Mengundang Bpk/Ibu Wali untuk sesi konsultasi Bimbingan Konseling (BK) Ananda ${activeStudent?.name}.`)}
                  className="text-[11px] font-bold bg-white text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-full hover:bg-indigo-50 shrink-0 cursor-pointer transition-colors shadow-2xs"
                >
                  Undangan Konsultasi BK
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleSendMessage(`Menanyakan kabar keaktifan dan absensi ${activeStudent?.name} hari ini.`)}
                  className="text-[11px] font-bold bg-white text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-full hover:bg-indigo-50 shrink-0 cursor-pointer transition-colors shadow-2xs"
                >
                  Tanya Absensi & Keaktifan
                </button>
                <button
                  onClick={() => handleSendMessage(`Izin menginformasikan terkait ${activeStudent?.name} untuk kegiatan besok.`)}
                  className="text-[11px] font-bold bg-white text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-full hover:bg-indigo-50 shrink-0 cursor-pointer transition-colors shadow-2xs"
                >
                  Info Kegiatan Besok
                </button>
                <button
                  onClick={() => handleSendMessage(`Mohon waktu konsultasi terkait perkembangan minat/karakter ${activeStudent?.name}.`)}
                  className="text-[11px] font-bold bg-white text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-full hover:bg-indigo-50 shrink-0 cursor-pointer transition-colors shadow-2xs"
                >
                  Konsultasi Perkembangan
                </button>
              </>
            )}
          </div>

          {/* Attachment Preview Box */}
          {attachmentUrl && (
            <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-900">Lampiran foto disiapkan</span>
              </div>
              <button
                onClick={() => setAttachmentUrl(null)}
                className="text-slate-400 hover:text-red-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Chat Message Input Bar */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <label className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors shrink-0" title="Unggah Foto / Dokumen">
              <Paperclip className="w-5 h-5" />
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </label>

            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={
                isStaffView
                  ? `Tulis pesan sebagai ${activeContact.teacher.name} (${activeContact.roleTitle}) ke Wali Murid ${activeStudent?.name}...`
                  : `Tulis pesan ke ${activeContact.teacher.name} (${activeContact.roleTitle})...`
              }
              className="flex-1 bg-slate-100/80 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />

            <button
              type="submit"
              disabled={!messageText.trim() && !attachmentUrl}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold p-2.5 rounded-2xl transition-all cursor-pointer shadow-sm shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>

      </div>

    </div>
  );
};
