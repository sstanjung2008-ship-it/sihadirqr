import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// Lazy init Gemini AI
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      aiClient = new GoogleGenAI({ apiKey });
    }
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Gemini AI analysis endpoint for attendance performance
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { attendanceSummary, studentRiskList, schoolName } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        analysis: "Fitur Analisis AI Gemini membutuhkan GEMINI_API_KEY yang valid. Berdasarkan data rekap, disarankan evaluasi terhadap siswa yang memiliki tingkat keterlambatan > 20% dan koordinasi rutin dengan wali kelas.",
        recommendations: [
          "Lakukan pemanggilan wali murid bagi siswa dengan alpa > 3 kali",
          "Berikan penghargaan (reward) presensi tepat waktu setiap bulan",
          "Aktifkan notifikasi otomatis WhatsApp agar orang tua langsung mengetahui saat anak belum masuk sekolah"
        ]
      });
    }

    const prompt = `Anda adalah Asisten Pakar Manajemen Pendidikan Sekolah untuk ${schoolName || "Sekolah Indonesia"}.
Analisis data rekapitulasi kehadiran siswa minggu/bulan ini:
- Ringkasan Kehadiran: ${JSON.stringify(attendanceSummary)}
- Daftar Siswa Berisiko (Sering Terlambat / Alpa): ${JSON.stringify(studentRiskList)}

Tolong berikan:
1. Ringkasan analisis kinerja presensi siswa dalam Bahasa Indonesia yang profesional dan solutif.
2. 3 - 5 rekomendasi konkret langkah penanganan untuk Kepala Sekolah & Wali Kelas.

Kembalikan jawaban dalam format JSON:
{
  "analysis": "Penjelasan ringkas...",
  "recommendations": ["Rekomendasi 1", "Rekomendasi 2", ...]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    const data = JSON.parse(text);
    return res.json(data);
  } catch (err: any) {
    console.error("Error calling Gemini API:", err);
    return res.status(500).json({
      error: "Gagal memproses analisis AI",
      details: err.message
    });
  }
});

// Simulated WhatsApp Webhook / Notification Trigger API
app.post("/api/whatsapp/send", (req, res) => {
  const { phone, message, studentName, status } = req.body;
  console.log(`[WhatsApp API Simulated] To: ${phone} | Student: ${studentName} | Status: ${status} | Msg: ${message}`);
  
  return res.json({
    success: true,
    messageId: "WA_" + Date.now(),
    phone,
    timestamp: new Date().toISOString(),
    status: "TERKIRIM"
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SiHadir QR Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
