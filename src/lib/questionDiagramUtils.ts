/**
 * Utilities to generate and render high quality educational SVG diagrams
 * and visual stimuli for school examination questions across various subjects.
 */

export interface DiagramConfig {
  subject?: string;
  topic?: string;
  description?: string;
  questionNumber?: number;
  type?: 'flowchart' | 'graph' | 'cycle' | 'geometry' | 'table' | 'science' | 'generic';
}

/**
 * Generates an SVG string representation tailored to a question's subject and description.
 */
export function generateQuestionSvg(config: DiagramConfig): string {
  const { subject = '', topic = '', description = '', questionNumber = 1 } = config;
  const lowerSub = subject.toLowerCase();
  const lowerTopic = topic.toLowerCase();
  const lowerDesc = description.toLowerCase();

  // 1. Math / Geometry / Coordinates / Graphs
  if (
    lowerSub.includes('matematika') ||
    lowerTopic.includes('geometri') ||
    lowerTopic.includes('fungsi') ||
    lowerTopic.includes('statistik') ||
    lowerTopic.includes('peluang') ||
    lowerDesc.includes('grafik') ||
    lowerDesc.includes('koordinat') ||
    lowerDesc.includes('segitiga') ||
    lowerDesc.includes('lingkaran')
  ) {
    if (lowerDesc.includes('lingkaran') || lowerTopic.includes('lingkaran')) {
      return `<svg viewBox="0 0 450 240" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-60 rounded-xl">
        <defs>
          <linearGradient id="gradMathCircle" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#eff6ff" />
            <stop offset="100%" stop-color="#dbeafe" />
          </linearGradient>
        </defs>
        <rect width="450" height="240" rx="12" fill="url(#gradMathCircle)" stroke="#93c5fd" stroke-width="1.5" />
        <!-- Circle with Radius & Angle -->
        <circle cx="225" cy="120" r="75" fill="#ffffff" stroke="#2563eb" stroke-width="2.5" stroke-dasharray="none" />
        <circle cx="225" cy="120" r="4" fill="#1e40af" />
        <line x1="225" y1="120" x2="300" y2="120" stroke="#dc2626" stroke-width="2" marker-end="url(#arrow)" />
        <line x1="225" y1="120" x2="175" y2="65" stroke="#16a34a" stroke-width="2" />
        <path d="M 255 120 A 30 30 0 0 0 200 92" fill="none" stroke="#ea580c" stroke-width="2" />
        <text x="230" y="105" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ea580c">θ = 60°</text>
        <text x="260" y="138" font-family="sans-serif" font-size="12" font-weight="bold" fill="#dc2626">r = 14 cm</text>
        <text x="225" y="218" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="600" fill="#1e3a8a">
          Gambar: Lingkaran dengan Titik Pusat O, Jari-jari r, dan Sudut Juring θ
        </text>
      </svg>`;
    }

    // Coordinate / Curve Graph
    return `<svg viewBox="0 0 450 240" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-60 rounded-xl">
      <defs>
        <linearGradient id="mathGridGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f8fafc" />
          <stop offset="100%" stop-color="#f1f5f9" />
        </linearGradient>
      </defs>
      <rect width="450" height="240" rx="12" fill="url(#mathGridGrad)" stroke="#cbd5e1" stroke-width="1.5" />
      <!-- Grid lines -->
      <g stroke="#e2e8f0" stroke-width="1">
        <line x1="50" y1="40" x2="410" y2="40" />
        <line x1="50" y1="80" x2="410" y2="80" />
        <line x1="50" y1="120" x2="410" y2="120" />
        <line x1="50" y1="160" x2="410" y2="160" />
        <line x1="110" y1="30" x2="110" y2="190" />
        <line x1="170" y1="30" x2="170" y2="190" />
        <line x1="230" y1="30" x2="230" y2="190" />
        <line x1="290" y1="30" x2="290" y2="190" />
        <line x1="350" y1="30" x2="350" y2="190" />
      </g>
      <!-- Axes -->
      <line x1="50" y1="180" x2="415" y2="180" stroke="#334155" stroke-width="2.5" />
      <line x1="70" y1="195" x2="70" y2="25" stroke="#334155" stroke-width="2.5" />
      <polygon points="415,180 405,175 405,185" fill="#334155" />
      <polygon points="70,25 65,35 75,35" fill="#334155" />
      <text x="415" y="195" font-family="sans-serif" font-size="11" font-weight="bold" fill="#334155">X</text>
      <text x="50" y="30" font-family="sans-serif" font-size="11" font-weight="bold" fill="#334155">Y</text>
      <!-- Function Curve -->
      <path d="M 70 160 Q 180 30 380 170" fill="none" stroke="#2563eb" stroke-width="3" />
      <circle cx="230" cy="70" r="5" fill="#dc2626" />
      <text x="240" y="65" font-family="sans-serif" font-size="11" font-weight="bold" fill="#dc2626">Titik Puncak (X₀, Y₀)</text>
      <text x="225" y="222" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="600" fill="#1e293b">
        Grafik Kurva Hubungan Variabel Kuadratik f(x)
      </text>
    </svg>`;
  }

  // 2. Science / IPA / Biology / Ecology (Rantai Makanan, Sel, Ekosistem, Siklus)
  if (
    lowerSub.includes('ipa') ||
    lowerSub.includes('biologi') ||
    lowerTopic.includes('ekosistem') ||
    lowerTopic.includes('rantai makanan') ||
    lowerTopic.includes('makhluk hidup') ||
    lowerTopic.includes('sel') ||
    lowerDesc.includes('rantai makanan') ||
    lowerDesc.includes('ekosistem') ||
    lowerDesc.includes('tumbuhan')
  ) {
    return `<svg viewBox="0 0 460 240" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-60 rounded-xl">
      <defs>
        <linearGradient id="bioGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f0fdf4" />
          <stop offset="100%" stop-color="#dcfce7" />
        </linearGradient>
      </defs>
      <rect width="460" height="240" rx="12" fill="url(#bioGrad)" stroke="#86efac" stroke-width="1.5" />
      <!-- Food Chain / Ecological Nodes -->
      <!-- Box 1: Produsen -->
      <rect x="25" y="65" width="80" height="70" rx="8" fill="#ffffff" stroke="#16a34a" stroke-width="2" />
      <text x="65" y="95" text-anchor="middle" font-family="sans-serif" font-size="20">🌱</text>
      <text x="65" y="115" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="bold" fill="#15803d">Produsen</text>
      <text x="65" y="127" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#4b5563">(Tumbuhan)</text>

      <!-- Arrow 1 -->
      <path d="M 110 100 L 130 100" stroke="#16a34a" stroke-width="2.5" marker-end="url(#arrowGreen)" />
      <polygon points="135,100 126,95 126,105" fill="#16a34a" />

      <!-- Box 2: Konsumen I (Herbivora) -->
      <rect x="140" y="65" width="80" height="70" rx="8" fill="#ffffff" stroke="#0284c7" stroke-width="2" />
      <text x="180" y="95" text-anchor="middle" font-family="sans-serif" font-size="20">🦗</text>
      <text x="180" y="115" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="bold" fill="#0369a1">Konsumen I</text>
      <text x="180" y="127" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#4b5563">(Belalang)</text>

      <!-- Arrow 2 -->
      <path d="M 225 100 L 245 100" stroke="#0284c7" stroke-width="2.5" />
      <polygon points="250,100 241,95 241,105" fill="#0284c7" />

      <!-- Box 3: Komponen X (Konsumen II) -->
      <rect x="255" y="60" width="85" height="80" rx="10" fill="#fef3c7" stroke="#d97706" stroke-width="2.5" stroke-dasharray="3,3" />
      <text x="297" y="95" text-anchor="middle" font-family="sans-serif" font-size="20">🐸</text>
      <text x="297" y="115" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#b45309">[Komponen X]</text>
      <text x="297" y="128" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="600" fill="#92400e">Konsumen II</text>

      <!-- Arrow 3 -->
      <path d="M 345 100 L 365 100" stroke="#d97706" stroke-width="2.5" />
      <polygon points="370,100 361,95 361,105" fill="#d97706" />

      <!-- Box 4: Puncak / Dekomposer -->
      <rect x="375" y="65" width="70" height="70" rx="8" fill="#ffffff" stroke="#9333ea" stroke-width="2" />
      <text x="410" y="95" text-anchor="middle" font-family="sans-serif" font-size="20">🦅</text>
      <text x="410" y="115" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="bold" fill="#7e22ce">Puncak</text>
      <text x="410" y="127" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#4b5563">(Elang)</text>

      <!-- Energy Flow label -->
      <text x="230" y="42" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#166534">
        ⚡ Aliran Energi & Tingkatan Trofik Ekosistem
      </text>
      <!-- Footer Caption -->
      <text x="230" y="215" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="600" fill="#14532d">
        Skema Jaring-jaring Makanan & Interaksi Populasi Ekosistem
      </text>
    </svg>`;
  }

  // 3. Physics / Fisika / Electrical Circuit / Force / Motion
  if (
    lowerSub.includes('fisika') ||
    lowerTopic.includes('listrik') ||
    lowerTopic.includes('gaya') ||
    lowerTopic.includes('gerak') ||
    lowerTopic.includes('optik') ||
    lowerTopic.includes('energi') ||
    lowerDesc.includes('rangkaian') ||
    lowerDesc.includes('resistor')
  ) {
    return `<svg viewBox="0 0 450 240" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-60 rounded-xl">
      <defs>
        <linearGradient id="physGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#faf5ff" />
          <stop offset="100%" stop-color="#f3e8ff" />
        </linearGradient>
      </defs>
      <rect width="450" height="240" rx="12" fill="url(#physGrad)" stroke="#d8b4fe" stroke-width="1.5" />
      <!-- Circuit Frame -->
      <rect x="60" y="55" width="330" height="120" fill="none" stroke="#475569" stroke-width="3" />
      <!-- Battery / Voltage Source -->
      <g transform="translate(60, 105)">
        <rect x="-8" y="-5" width="16" height="30" fill="#faf5ff" />
        <line x1="-15" y1="0" x2="15" y2="0" stroke="#dc2626" stroke-width="3.5" />
        <line x1="-8" y1="12" x2="8" y2="12" stroke="#1e293b" stroke-width="3.5" />
        <text x="-35" y="10" font-family="sans-serif" font-size="11" font-weight="bold" fill="#dc2626">V = 12V</text>
      </g>
      <!-- Resistor R1 -->
      <g transform="translate(180, 55)">
        <rect x="-30" y="-12" width="60" height="24" fill="#ffffff" stroke="#2563eb" stroke-width="2" rx="4" />
        <text x="0" y="5" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#1d4ed8">R₁ = 4 Ω</text>
      </g>
      <!-- Resistor R2 (Component X) -->
      <g transform="translate(300, 55)">
        <rect x="-30" y="-12" width="60" height="24" fill="#fef08a" stroke="#ca8a04" stroke-width="2" rx="4" />
        <text x="0" y="5" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#854d0e">R₂ = [X] Ω</text>
      </g>
      <!-- Ammeter -->
      <g transform="translate(225, 175)">
        <circle cx="0" cy="0" r="16" fill="#ffffff" stroke="#16a34a" stroke-width="2.5" />
        <text x="0" y="5" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="bold" fill="#15803d">A</text>
        <text x="0" y="32" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#15803d">I = 2 Ampere</text>
      </g>
      <text x="225" y="32" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#6b21a8">
        Diagram Skema Rangkaian Listrik Tertutup
      </text>
      <text x="225" y="222" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="600" fill="#4c1d95">
        Gambar: Rangkaian Seri Resistor dengan Sumber Tegangan & Amperemeter
      </text>
    </svg>`;
  }

  // 4. Social / IPS / Economics / History / Geography (Bagan, Piramida, Kurva Permintaan)
  if (
    lowerSub.includes('ips') ||
    lowerSub.includes('ekonomi') ||
    lowerSub.includes('geografi') ||
    lowerSub.includes('sejarah') ||
    lowerTopic.includes('pasar') ||
    lowerTopic.includes('penduduk') ||
    lowerTopic.includes('peta') ||
    lowerDesc.includes('permintaan') ||
    lowerDesc.includes('penawaran') ||
    lowerDesc.includes('piramida')
  ) {
    return `<svg viewBox="0 0 450 240" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-60 rounded-xl">
      <defs>
        <linearGradient id="ipsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fffbeb" />
          <stop offset="100%" stop-color="#fef3c7" />
        </linearGradient>
      </defs>
      <rect width="450" height="240" rx="12" fill="url(#ipsGrad)" stroke="#fde68a" stroke-width="1.5" />
      <!-- Economics Curve or Socio-Demographic Bar Chart -->
      <!-- Axes -->
      <line x1="70" y1="180" x2="390" y2="180" stroke="#475569" stroke-width="2.5" />
      <line x1="70" y1="180" x2="70" y2="35" stroke="#475569" stroke-width="2.5" />
      <polygon points="390,180 380,175 380,185" fill="#475569" />
      <polygon points="70,35 65,45 75,45" fill="#475569" />
      <text x="390" y="196" font-family="sans-serif" font-size="11" font-weight="bold" fill="#334155">Jumlah (Q)</text>
      <text x="45" y="40" font-family="sans-serif" font-size="11" font-weight="bold" fill="#334155">Harga (P)</text>

      <!-- Demand Curve D -->
      <line x1="90" y1="60" x2="350" y2="165" stroke="#dc2626" stroke-width="3" />
      <text x="355" y="165" font-family="sans-serif" font-size="12" font-weight="bold" fill="#dc2626">Kurva D</text>

      <!-- Supply Curve S -->
      <line x1="90" y1="165" x2="350" y2="60" stroke="#2563eb" stroke-width="3" />
      <text x="355" y="65" font-family="sans-serif" font-size="12" font-weight="bold" fill="#2563eb">Kurva S</text>

      <!-- Equilibrium Point E -->
      <circle cx="220" cy="112" r="6" fill="#16a34a" />
      <line x1="220" y1="112" x2="220" y2="180" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="4,4" />
      <line x1="220" y1="112" x2="70" y2="112" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="4,4" />
      <text x="230" y="108" font-family="sans-serif" font-size="11" font-weight="bold" fill="#15803d">Titik Keseimbangan (E)</text>
      <text x="40" y="115" font-family="sans-serif" font-size="10" font-weight="bold" fill="#15803d">P₀</text>
      <text x="215" y="196" font-family="sans-serif" font-size="10" font-weight="bold" fill="#15803d">Q₀</text>

      <text x="225" y="222" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="600" fill="#78350f">
        Grafik Kurva Permintaan (Demand) & Penawaran (Supply) Pasar
      </text>
    </svg>`;
  }

  // 5. General Process Flow / Concept Matrix Diagram
  return `<svg viewBox="0 0 450 240" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-60 rounded-xl">
    <defs>
      <linearGradient id="genGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f8fafc" />
        <stop offset="100%" stop-color="#e0e7ff" />
      </linearGradient>
    </defs>
    <rect width="450" height="240" rx="12" fill="url(#genGrad)" stroke="#c7d2fe" stroke-width="1.5" />
    <!-- Node 1: Input / Tahap Awal -->
    <rect x="25" y="70" width="105" height="65" rx="8" fill="#ffffff" stroke="#4f46e5" stroke-width="2" />
    <text x="77" y="98" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#3730a3">Tahap 1: Input</text>
    <text x="77" y="116" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#6b7280">Identifikasi & Data</text>

    <!-- Arrow 1 -->
    <line x1="135" y1="102" x2="165" y2="102" stroke="#4f46e5" stroke-width="2.5" />
    <polygon points="170,102 160,97 160,107" fill="#4f46e5" />

    <!-- Node 2: Core Processing / Simpul X -->
    <rect x="175" y="60" width="115" height="85" rx="10" fill="#eef2ff" stroke="#6366f1" stroke-width="2.5" stroke-dasharray="3,3" />
    <text x="232" y="93" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="bold" fill="#4338ca">[Komponen X]</text>
    <text x="232" y="110" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="600" fill="#4f46e5">Proses Konversi</text>
    <text x="232" y="125" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#6b7280">& Regulasi Sistem</text>

    <!-- Arrow 2 -->
    <line x1="295" y1="102" x2="325" y2="102" stroke="#4f46e5" stroke-width="2.5" />
    <polygon points="330,102 320,97 320,107" fill="#4f46e5" />

    <!-- Node 3: Output / Hasil -->
    <rect x="335" y="70" width="95" height="65" rx="8" fill="#ffffff" stroke="#16a34a" stroke-width="2" />
    <text x="382" y="98" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#15803d">Tahap 3: Output</text>
    <text x="382" y="116" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#6b7280">Hasil Terukur</text>

    <!-- Header & Footer -->
    <text x="225" y="36" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#312e81">
      📊 Diagram Alur Sistem Terintegrasi: ${topic || 'Materi Pembelajaran'}
    </text>
    <text x="225" y="218" text-anchor="middle" font-family="sans-serif" font-size="11.5" font-weight="600" fill="#1e1b4b">
      Gambar No. ${questionNumber}: Skema Hubungan Antar Elemen dan Siklus Transformasi
    </text>
  </svg>`;
}
