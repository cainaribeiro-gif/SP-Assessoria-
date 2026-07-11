import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Path to site data
const SITE_DATA_PATH = path.join(process.cwd(), "src", "site-data.json");

// Helper to read site data
function readSiteData(): any {
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

// Helper to write site data
function writeSiteData(data: any): boolean {
  try {
    fs.writeFileSync(SITE_DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Erro ao salvar site-data.json:", error);
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middleware for parsing JSON requests
  app.use(express.json());

  // API endpoint for retrieving site data
  app.get("/api/site-data", (req, res) => {
    const data = readSiteData();
    if (data) {
      res.json(data);
    } else {
      res.status(500).json({ error: "Não foi possível carregar as informações do site." });
    }
  });

  // API endpoint for saving modified site data (Admin)
  app.post("/api/site-data", (req, res) => {
    const success = writeSiteData(req.body);
    if (success) {
      res.json({ success: true, message: "Informações salvas com sucesso!" });
    } else {
      res.status(500).json({ error: "Erro ao salvar as informações no servidor." });
    }
  });

  // API endpoint for submitting a lead (Contact Form or Budget Modal)
  app.post("/api/leads", (req, res) => {
    const data = readSiteData();
    if (!data) {
      res.status(500).json({ error: "Erro ao carregar banco de dados de leads." });
      return;
    }

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

    if (!data.leads) {
      data.leads = [];
    }

    data.leads.unshift(newLead);
    const success = writeSiteData(data);

    if (success) {
      res.json({ success: true, lead: newLead });
    } else {
      res.status(500).json({ error: "Erro ao salvar o lead no servidor." });
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
        // Fallback simulated response if no API key is provided
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

      // Prepare conversation history for Gemini API
      // Since GoogleGenAI SDK chats.create or generateContent can take contents,
      // let's construct the contents array from user messages
      const systemInstruction = `Você é o Assistente Virtual Inteligente da "SP Assessoria de Recursos Administrativos".
Seu objetivo é ajudar potenciais clientes com dúvidas gerais sobre recursos administrativos do INSS (como defesas de indeferimentos, revisões administrativas, cumprimento de exigências, BPC/LOAS), trânsito (como recursos de multas, suspensão e cassação de CNH), e outros serviços administrativos em órgãos públicos.

Instruções importantes:
1. Explique as coisas de forma clara, didática, amigável e profissional.
2. NÃO ofereça serviços privativos da advocacia. Deixe claro que a SP Assessoria atua EXCLUSIVAMENTE na esfera ADMINISTRATIVA (extrajudicial), oferecendo assessoria e recursos diretamente aos órgãos públicos responsáveis. Caso necessitem de defesa em tribunal judicial, sugira que procurem um advogado ou defensor público.
3. Seja acolhedor e transmita confiança, agilidade e segurança (nossos valores fundamentais).
4. Se o usuário quiser contratar um serviço ou solicitar um orçamento formal, convide-o a clicar no botão "Solicitar Orçamento" ou a entrar em contato pelo WhatsApp (11) 98704-9051 ou (11) 99334-4293.
5. Responda em português (do Brasil). Use uma formatação bonita em Markdown (com negritos, listas, etc.) para facilitar a leitura. Mantenha as respostas concisas, de no máximo 3 parágrafos curtos.`;

      // Map roles to "user" or "model"
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
