import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Firebase Admin Imports
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

// Initialize Firebase SDK with Admin privileges to bypass security rules on the server
const firebaseApp = initializeApp({
  projectId: firebaseConfig.projectId,
});
const db = getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId);

// Path to site data file (for initial seeding)
const SITE_DATA_PATH = path.join(process.cwd(), "src", "site-data.json");

// Helper to read initial file data for seeding
function readSiteDataFile(): any {
  try {
    if (fs.existsSync(SITE_DATA_PATH)) {
      const raw = fs.readFileSync(SITE_DATA_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error("Erro ao ler site-data.json:", error);
  }
  return null;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middleware for parsing JSON requests
  app.use(express.json());

  // API endpoint for retrieving site data
  app.get("/api/site-data", async (req, res) => {
    try {
      const siteDocRef = db.collection("siteData").doc("main");
      const siteDoc = await siteDocRef.get();
      
      let data: any = null;
      if (siteDoc.exists) {
        data = siteDoc.data();
      } else {
        // Seeding database if the main siteData document is missing
        console.log("Firestore empty. Seeding site data from local JSON file...");
        const seedData = readSiteDataFile();
        if (seedData) {
          data = { ...seedData };
          const initialLeads = data.leads || [];
          delete data.leads; // leads are stored separately
          
          // Save main site configuration document
          await siteDocRef.set(data);
          
          // Seed the separate leads collection
          for (const lead of initialLeads) {
            await db.collection("leads").doc(lead.id).set(lead);
          }
        } else {
          res.status(500).json({ error: "Dados iniciais não encontrados no servidor." });
          return;
        }
      }

      // Fetch all leads from Firestore separate collection to include in site-data payload
      const leadsColRef = db.collection("leads");
      const leadsSnapshot = await leadsColRef.get();
      const leadsList: any[] = [];
      leadsSnapshot.forEach((docSnap) => {
        leadsList.push(docSnap.data());
      });

      // Sort leads by date descending or by ID
      leadsList.sort((a, b) => {
        const dateA = a.date ? new Date(a.date.replace(/,/, "")).getTime() : 0;
        const dateB = b.date ? new Date(b.date.replace(/,/, "")).getTime() : 0;
        return dateB - dateA || b.id.localeCompare(a.id);
      });

      // Merge separate leads collection back into response body for complete backwards compatibility
      data.leads = leadsList;
      res.json(data);
    } catch (error) {
      console.error("Erro ao carregar dados do Firestore:", error);
      res.status(500).json({ error: "Erro ao buscar dados do banco de dados na nuvem." });
    }
  });

  // API endpoint for saving modified site data (Admin)
  app.post("/api/site-data", async (req, res) => {
    try {
      const payload = { ...req.body };
      const leadsInPayload = payload.leads || [];
      
      // Leads are stored in their own collection, strip them from siteData/main document
      delete payload.leads;

      // 1. Update siteData/main document
      await db.collection("siteData").doc("main").set(payload);

      // 2. Synchronize and reconcile separate leads collection
      // Create/Update all leads present in payload
      for (const lead of leadsInPayload) {
        if (lead.id) {
          await db.collection("leads").doc(lead.id).set(lead);
        }
      }

      // Handle deletions: Delete leads in Firestore that are absent in incoming payload
      const leadsColRef = db.collection("leads");
      const leadsSnapshot = await leadsColRef.get();
      const payloadLeadIds = new Set(leadsInPayload.map((l: any) => l.id));
      for (const docSnap of leadsSnapshot.docs) {
        if (!payloadLeadIds.has(docSnap.id)) {
          await db.collection("leads").doc(docSnap.id).delete();
        }
      }

      res.json({ success: true, message: "Informações salvas e sincronizadas com sucesso!" });
    } catch (error) {
      console.error("Erro ao salvar dados no Firestore:", error);
      res.status(500).json({ error: "Erro ao salvar informações no banco de dados na nuvem." });
    }
  });

  // API endpoint for submitting a lead (Contact Form or Budget Modal)
  app.post("/api/leads", async (req, res) => {
    try {
      const { name, email, phone, service, message, type } = req.body;
      if (!name || !phone) {
        res.status(400).json({ error: "Nome e WhatsApp são obrigatórios." });
        return;
      }

      const newLead = {
        id: `lead-${Date.now()}`,
        name,
        email: email || "",
        phone,
        service: service || "Geral",
        message: message || "",
        date: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        status: "Novo",
        type: type || "Contato"
      };

      // Direct write into separate leads collection
      await db.collection("leads").doc(newLead.id).set(newLead);

      res.json({ success: true, lead: newLead });
    } catch (error) {
      console.error("Erro ao criar lead no Firestore:", error);
      res.status(500).json({ error: "Erro ao registrar solicitação no banco de dados." });
    }
  });

  // API endpoint for admin login authentication
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    // Predefined secure administrator credentials for live production access
    if (
      (username === "atendimento@sprecursosadm.com.br" && password === "@Shafiraepablo") ||
      (username === "admin" && password === "@Shafiraepablo")
    ) {
      res.json({ success: true, token: "sp_admin_token_2026_secured" });
    } else {
      res.status(401).json({ error: "E-mail ou senha incorretos." });
    }
  });

  // API endpoint for AI assistant chat
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "O campo 'messages' é obrigatório e deve ser um array." });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        const lastUserMessage = messages[messages.length - 1]?.content || "";
        const fallbackText = `Olá! Sou o Assistente Virtual da SP Assessoria. No momento, nossa API de inteligência artificial está em modo de demonstração. 

Estou aqui para esclarecer suas dúvidas sobre **INSS**, **Multas de Trânsito** e **Processos Administrativos**.

Para obter um atendimento personalizado imediato ou sanar dúvidas específicas, sinta-se à vontade para nos contactar diretamente via **WhatsApp**:
- **(11) 98704-9051** ou **(11) 99334-4293**

Como posso ajudar você hoje com seus recursos administrativos?`;
        res.json({ text: fallbackText });
        return;
      }

      // Lazy load Gemini Client to prevent crashing on missing key
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = `Você é o Assistente Virtual Inteligente da "SP Assessoria de Recursos Administrativos".
Seu objetivo é ajudar potenciais clientes com dúvidas gerais sobre recursos administrativos do INSS (como defesas de indeferimentos, revisões administrativas, cumprimento de exigências, BPC/LOAS), trânsito (como recursos de multas, suspensão e cassação de CNH), e outros serviços administrativos em órgãos públicos.

Instruções importantes:
1. Explique as coisas de forma clara, didática, amigável e profissional.
2. NÃO ofereça serviços privativos da advocacia. Deixe claro que a SP Assessoria atua EXCLUSIVAMENTE na esfera ADMINISTRATIVA (extrajudicial), oferecendo assessoria e recursos diretamente aos órgãos públicos responsáveis. Caso necessitem de defesa em tribunal judicial, sugira que procurem um advogado ou defensor público.
3. Seja acolhedor e transmita confiança, agilidade e segurança (nossos valores fundamentais).
4. Se o usuário quiser contratar um serviço ou solicitar um orçamento formal, convide-o a clicar no botão "Solicitar Orçamento" ou a entrar em contato pelo WhatsApp (11) 98704-9051 ou (11) 99334-4293.
5. Responda em português (do Brasil). Use uma formatação bonita em Markdown (com negritos, listas, etc.) para facilitar a leitura. Mantenha as respostas concisas, de no máximo 3 parágrafos curtos.`;

      const contents = messages.map((m: any) => {
        return {
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        };
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        },
      });

      const text = response.text || "Desculpe, não consegui processar sua mensagem neste momento.";
      res.json({ text });
    } catch (error: any) {
      console.error("Erro no chat do Gemini:", error);
      res.status(500).json({ error: "Ocorreu um erro ao processar sua solicitação no servidor de IA." });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
