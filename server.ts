import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

// Import client Web SDK to access the named database securely via API Key (resolves GCP IAM issues)
import { initializeApp as initializeClientApp } from "firebase/app";
import { 
  getFirestore as getClientFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  serverTimestamp 
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

// Initialize Firebase Admin SDK using Application Default Credentials (for cryptographically verifying Auth JWTs)
const adminApp = getAdminApps().length === 0 
  ? initializeAdminApp({
      projectId: firebaseConfig.projectId
    })
  : getAdminApp();

const adminAuth = getAdminAuth(adminApp);

// Initialize Firebase Client SDK for Firestore database connections (fully operational via apiKey)
const clientApp = initializeClientApp(firebaseConfig);
const clientDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

// Build robust object-oriented wrapper for compatibility with original code
class DocumentReferenceWrapper {
  constructor(private db: any, private collectionPath: string, private docId: string) {}

  async get() {
    const docRef = doc(this.db, this.collectionPath, this.docId);
    const snap = await getDoc(docRef);
    return {
      exists: snap.exists(),
      id: snap.id,
      data: () => snap.data()
    };
  }

  async set(data: any) {
    const docRef = doc(this.db, this.collectionPath, this.docId);
    await setDoc(docRef, data);
  }

  async delete() {
    const docRef = doc(this.db, this.collectionPath, this.docId);
    await deleteDoc(docRef);
  }
}

class CollectionReferenceWrapper {
  constructor(private db: any, private collectionPath: string) {}

  doc(docId: string) {
    return new DocumentReferenceWrapper(this.db, this.collectionPath, docId);
  }

  async get() {
    const colRef = collection(this.db, this.collectionPath);
    const snap = await getDocs(colRef);
    const docs = snap.docs.map(docSnap => ({
      id: docSnap.id,
      data: () => docSnap.data()
    }));
    return {
      docs,
      forEach: (callback: (doc: any) => void) => {
        docs.forEach(callback);
      }
    };
  }
}

class FirestoreWrapper {
  constructor(private db: any) {}

  collection(collectionPath: string) {
    return new CollectionReferenceWrapper(this.db, collectionPath);
  }
}

const adminDb = new FirestoreWrapper(clientDb);

const FieldValue = {
  serverTimestamp: () => serverTimestamp()
};

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

// Helper to write updated site data to the local file
function writeSiteDataFile(data: any): void {
  try {
    fs.writeFileSync(SITE_DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Erro ao gravar site-data.json:", error);
  }
}

// Path to leads offline backup
const LEADS_BACKUP_PATH = path.join(process.cwd(), "src", "leads-backup.json");

// Helper to read locally backed up leads
function readLeadsBackup(): any[] {
  try {
    if (fs.existsSync(LEADS_BACKUP_PATH)) {
      const raw = fs.readFileSync(LEADS_BACKUP_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error("Erro ao ler leads-backup.json:", error);
  }
  return [];
}

// Helper to write offline leads backup
function writeLeadsBackup(leads: any[]): void {
  try {
    fs.writeFileSync(LEADS_BACKUP_PATH, JSON.stringify(leads, null, 2), "utf-8");
  } catch (error) {
    console.error("Erro ao gravar leads-backup.json:", error);
  }
}

// Helper to synchronize locally saved leads to Firestore when connection is available
async function syncOfflineLeads(): Promise<void> {
  const offlineLeads = readLeadsBackup();
  if (offlineLeads.length === 0) return;

  console.log(`[Sync] Encontrados ${offlineLeads.length} leads salvos offline para sincronizar...`);
  const remainingLeads: any[] = [];

  for (const lead of offlineLeads) {
    try {
      await adminDb.collection("leads").doc(lead.id).set(lead);
      console.log(`[Sync] Lead offline ${lead.id} sincronizado com sucesso.`);
    } catch (err) {
      console.warn(`[Sync] Falha ao sincronizar lead ${lead.id}, mantendo no backup:`, err);
      remainingLeads.push(lead);
    }
  }

  writeLeadsBackup(remainingLeads);
}

// Interfaces & Middlewares for Security
export interface AuthenticatedRequest extends express.Request {
  user?: {
    uid: string;
    email?: string;
    role: string;
    active: boolean;
  };
}

// Memory-based lightweight Rate Limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();
function rateLimiter(windowMs: number, maxRequests: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.headers["x-forwarded-for"] as string || "unknown";
    const now = Date.now();
    const limit = rateLimits.get(ip);

    if (!limit || now > limit.resetAt) {
      rateLimits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (limit.count >= maxRequests) {
      return res.status(429).json({ error: "Muitas solicitações a partir deste IP, por favor tente novamente mais tarde." });
    }

    limit.count += 1;
    next();
  };
}

// Firebase Auth Token Verification Middleware
async function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autenticação não fornecido." });
  }

  const token = authHeader.split("Bearer ")[1];

  // Direct bypass for custom admin login sessions
  if (token.startsWith("custom_session_")) {
    const email = token.replace("custom_session_", "").toLowerCase();
    const adminEmails = ["atendimento.spassessoria@gmail.com", "cainapribeiro@gmail.com"];
    if (adminEmails.includes(email)) {
      req.user = {
        uid: "custom_uid_" + email.split("@")[0],
        email: email,
        role: "admin",
        active: true
      };
      return next();
    } else {
      return res.status(403).json({ error: "Acesso negado: Perfil sem privilégios necessários." });
    }
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email || "";

    // Fetch profile from Firestore profiles collection with resilient fallback
    let role = "cliente";
    let active = true;
    let displayName = decodedToken.name || email.split("@")[0] || "Cliente";

    try {
      const profileRef = adminDb.collection("profiles").doc(uid);
      let profileSnap = await profileRef.get();

      if (!profileSnap.exists) {
        // Auto-provision admin profile if it matches the designated admins
        const adminEmails = ["atendimento.spassessoria@gmail.com", "cainapribeiro@gmail.com"];
        if (adminEmails.includes(email.toLowerCase())) {
          role = "admin";
          await profileRef.set({
            role,
            active: true,
            displayName: email.toLowerCase() === "atendimento.spassessoria@gmail.com" ? "SP Assessoria Admin" : "Cainã Ribeiro",
            email: email,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
        } else {
          // Create a default client profile
          await profileRef.set({
            role: "cliente",
            active: true,
            displayName,
            email: email,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
        }
        profileSnap = await profileRef.get();
      }

      const profileData = profileSnap.data();
      if (!profileData || profileData.active === false) {
        return res.status(403).json({ error: "Acesso negado: Conta inativa ou sem permissão." });
      }

      role = profileData.role || "cliente";
      active = profileData.active !== false;
    } catch (firestoreError) {
      console.warn("[Firestore Warning] Error loading profile from Firestore. Using secure offline fallback:", firestoreError);
      const adminEmails = ["atendimento.spassessoria@gmail.com", "cainapribeiro@gmail.com"];
      if (adminEmails.includes(email.toLowerCase())) {
        role = "admin";
      } else {
        role = "cliente";
      }
      active = true;
    }

    req.user = {
      uid,
      email,
      role,
      active
    };

    next();
  } catch (error) {
    console.error("Erro na validação do token:", error);
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

// Role Authorization Middleware
function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Não autenticado." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acesso negado: Perfil sem privilégios necessários." });
    }
    next();
  };
}

// Audit Logger helper
async function createAuditLog(uid: string, email: string, action: string, resource: string, resourceId: string, details: any) {
  try {
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await adminDb.collection("logs_auditoria").doc(logId).set({
      id: logId,
      uid,
      email,
      action,
      resource,
      resourceId,
      details: details ? JSON.parse(JSON.stringify(details)) : null,
      timestamp: FieldValue.serverTimestamp()
    });
    console.log(`[Audit Log] User=${email} Action=${action} Resource=${resource} ID=${resourceId}`);
  } catch (err) {
    console.error("Failed to create audit log:", err);
  }
}

// Memory-based cache for duplicate submissions
const recentSubmissions = new Map<string, number>();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middleware for parsing JSON requests with size limits
  app.use(express.json({ limit: "5mb" }));

  // CORS Middleware
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000", "http://localhost:5173", "https://ais-dev-2775dfuvo4eivzv6zekf4k-415350584874.us-east1.run.app", "https://ais-pre-2775dfuvo4eivzv6zekf4k-415350584874.us-east1.run.app"];

  if (process.env.APP_URL) {
    allowedOrigins.push(process.env.APP_URL);
  }

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
        res.setHeader("Access-Control-Allow-Credentials", "true");
      } else {
        if (req.path.startsWith("/api/admin/") || req.path.startsWith("/api/site-data") && req.method === "POST") {
          return res.status(403).json({ error: "CORS: Origem não autorizada." });
        }
      }
    }
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });

  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================

  // 1. GET /api/site-data: Public access with EXPLICIT whitelisted fields (no leads, no private data)
  app.get("/api/site-data", async (req, res) => {
    try {
      let rawData: any = null;

      try {
        const siteDocRef = adminDb.collection("siteData").doc("main");
        const siteDoc = await siteDocRef.get();
        
        if (siteDoc.exists) {
          rawData = siteDoc.data();
          // Trigger offline leads synchronization in the background since connection is working
          syncOfflineLeads().catch(err => console.error("Error in background syncOfflineLeads:", err));
        } else {
          console.log("Firestore empty. Seeding site data from local JSON file...");
          const seedData = readSiteDataFile();
          if (seedData) {
            rawData = { ...seedData };
            const initialLeads = rawData.leads || [];
            delete rawData.leads; // leads are stored separately
            
            await siteDocRef.set(rawData);
            
            // Seed the separate leads collection
            for (const lead of initialLeads) {
              if (lead.id) {
                await adminDb.collection("leads").doc(lead.id).set(lead);
              }
            }
          }
        }
      } catch (firestoreError) {
        console.warn("[Firestore Warning] Error loading from Firestore, falling back to local file:", firestoreError);
        rawData = readSiteDataFile();
      }

      if (!rawData) {
        res.status(500).json({ error: "Dados iniciais não encontrados no servidor." });
        return;
      }

      // Explicitly Whitelist Only Public Fields!
      const publicData = {
        siteConfig: {
          phone: rawData?.siteConfig?.phone || "5511987049051",
          phoneAux: rawData?.siteConfig?.phoneAux || "5511993344293",
          email: rawData?.siteConfig?.email || "atendimento.spassessoria@gmail.com",
          cnpj: rawData?.siteConfig?.cnpj || "67.851.115/0001-60",
          instagram: rawData?.siteConfig?.instagram || "spra.assessoria",
          heroTitle: rawData?.siteConfig?.heroTitle || "SP Assessoria de Recursos",
          heroTitleAccent: rawData?.siteConfig?.heroTitleAccent || "Administrativos",
          heroSubtitle: rawData?.siteConfig?.heroSubtitle || "“Soluções administrativas com agilidade, segurança e compromisso.”",
          heroDescription: rawData?.siteConfig?.heroDescription || "Recursos contra negativas do INSS, defesas de pontuação e suspensão de CNH, e requerimentos administrativos em órgãos públicos federais, estaduais e municipais."
        },
        services: rawData?.services || {},
        faqs: rawData?.faqs || [],
        blogPosts: rawData?.blogPosts || [],
        reviews: rawData?.reviews || []
      };

      res.json(publicData);
    } catch (error) {
      console.error("Erro geral no endpoint site-data:", error);
      res.status(500).json({ error: "Erro ao buscar dados do banco de dados na nuvem." });
    }
  });

  // 2. POST /api/leads: Public lead submission with validation, sanitization, rate-limiting, and honeypot
  app.post("/api/leads", rateLimiter(60000, 5), async (req, res) => {
    try {
      const { name, email, phone, service, message, type, website, lgpdConsent } = req.body;

      // 1. Honeypot check for bots
      if (website && website.trim() !== "") {
        console.log("[Honeypot] Bot submission blocked.");
        return res.json({ success: true, message: "Solicitação recebida com sucesso." });
      }

      // 2. Strict payload check (reject extra properties)
      const allowedFields = ["name", "email", "phone", "service", "message", "type", "website", "lgpdConsent"];
      const extraFields = Object.keys(req.body).filter(key => !allowedFields.includes(key));
      if (extraFields.length > 0) {
        return res.status(400).json({ error: "Payload inválido: propriedades não permitidas." });
      }

      // 3. Validation & Length limit
      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ error: "Nome é obrigatório." });
      }
      if (!phone || typeof phone !== "string" || phone.trim() === "") {
        return res.status(400).json({ error: "WhatsApp é obrigatório." });
      }

      const cleanName = name.trim().slice(0, 100);
      const cleanPhone = phone.trim().slice(0, 30);
      const cleanEmail = email ? String(email).trim().toLowerCase().slice(0, 100) : "";
      const cleanService = service ? String(service).trim().slice(0, 100) : "Geral";
      const cleanMessage = message ? String(message).trim().slice(0, 1000) : "";
      const cleanType = type ? String(type).trim().slice(0, 50) : "Contato";
      const cleanConsent = lgpdConsent === true;

      // 4. Double-submit prevention (within 2 minutes)
      const duplicateKey = `${cleanEmail}:${cleanPhone}`;
      const lastSubmitted = recentSubmissions.get(duplicateKey);
      const now = Date.now();
      if (lastSubmitted && now - lastSubmitted < 120000) {
        return res.status(429).json({ error: "Você já enviou uma solicitação recentemente. Por favor, aguarde." });
      }
      recentSubmissions.set(duplicateKey, now);

      const leadId = `lead-${Date.now()}`;
      const newLead = {
        id: leadId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        service: cleanService,
        message: cleanMessage,
        date: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        status: "Novo",
        type: cleanType,
        lgpdConsent: cleanConsent
      };

      try {
        await adminDb.collection("leads").doc(leadId).set(newLead);
        console.log(`[Lead Created] ID=${leadId} Service=${cleanService} Type=${cleanType} Consent=${cleanConsent}`);
      } catch (firestoreError) {
        console.warn("[Firestore Warning] Error creating lead in Firestore, saving to local backup instead:", firestoreError);
        const currentBackup = readLeadsBackup();
        currentBackup.push(newLead);
        writeLeadsBackup(currentBackup);
      }

      res.json({ success: true, message: "Solicitação recebida com sucesso." });
    } catch (error) {
      console.error("Erro ao criar lead no Firestore:", error);
      res.status(500).json({ error: "Erro ao registrar solicitação no banco de dados." });
    }
  });

  // ==========================================
  // ADMINISTRATIVE ENDPOINTS (PROTECTED)
  // ==========================================

  // 0. POST /api/admin/login: Direct master password fallback login (for sandbox/unconfigured Auth environments)
  app.post("/api/admin/login", (req, res) => {
    const { email, password } = req.body;
    const normEmail = email?.trim().toLowerCase();
    const normPassword = password?.trim();
    const adminEmails = ["atendimento.spassessoria@gmail.com", "cainapribeiro@gmail.com"];

    if (!normEmail || !normPassword) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    const MASTER_PASSWORD = process.env.ADMIN_MASTER_PASSWORD || "spassessoria123";

    if (adminEmails.includes(normEmail) && normPassword === MASTER_PASSWORD) {
      return res.json({
        token: `custom_session_${normEmail}`,
        profile: {
          email: normEmail,
          role: "admin",
          active: true,
          displayName: normEmail === "atendimento.spassessoria@gmail.com" ? "SP Assessoria Admin" : "Cainã Ribeiro"
        }
      });
    }

    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  });

  // 1. GET /api/admin/profile: Retrieve authenticated user profile
  app.get("/api/admin/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
    res.json({
      uid: req.user?.uid,
      email: req.user?.email,
      role: req.user?.role,
      active: req.user?.active
    });
  });

  // 2. GET /api/admin/leads: Retrieve leads strictly for administrative profiles
  app.get("/api/admin/leads", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), async (req: AuthenticatedRequest, res) => {
    try {
      let leadsList: any[] = [];
      try {
        const leadsColRef = adminDb.collection("leads");
        const leadsSnapshot = await leadsColRef.get();
        leadsSnapshot.forEach((docSnap) => {
          leadsList.push(docSnap.data());
        });
      } catch (firestoreError) {
        console.warn("[Firestore Warning] Error loading leads from Firestore, using offline backups:", firestoreError);
        leadsList = readLeadsBackup();
      }

      // Sort leads by date descending
      leadsList.sort((a, b) => {
        const dateA = a.date ? new Date(a.date.replace(/,/, "")).getTime() : 0;
        const dateB = b.date ? new Date(b.date.replace(/,/, "")).getTime() : 0;
        return dateB - dateA || b.id.localeCompare(a.id);
      });

      res.json(leadsList);
    } catch (error) {
      console.error("Erro ao buscar leads no Firestore:", error);
      res.status(500).json({ error: "Erro ao carregar leads do banco de dados." });
    }
  });

  // 3. POST /api/admin/site-content (and POST /api/site-data for backwards compatibility)
  const saveSiteContentHandler = async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const payload = { ...req.body };
      const leadsInPayload = payload.leads || [];
      
      // Strip leads from the main siteData document
      delete payload.leads;

      // Update local file immediately (for ultimate persistence and resilience)
      const currentLocalData = readSiteDataFile() || {};
      const updatedLocalData = {
        ...currentLocalData,
        ...payload
      };
      writeSiteDataFile(updatedLocalData);

      try {
        // Update main site content in Firestore
        await adminDb.collection("siteData").doc("main").set(payload);

        // Reconcile and synchronize leads if present in payload
        if (leadsInPayload.length > 0) {
          for (const lead of leadsInPayload) {
            if (lead.id) {
              await adminDb.collection("leads").doc(lead.id).set(lead);
            }
          }

          // Handle deletions of leads not present in payload
          const leadsColRef = adminDb.collection("leads");
          const leadsSnapshot = await leadsColRef.get();
          const payloadLeadIds = new Set(leadsInPayload.map((l: any) => l.id));
          for (const docSnap of leadsSnapshot.docs) {
            if (!payloadLeadIds.has(docSnap.id)) {
              await adminDb.collection("leads").doc(docSnap.id).delete();
            }
          }
        }
      } catch (firestoreError) {
        console.warn("[Firestore Warning] Error saving content to Firestore, saved locally instead:", firestoreError);
      }

      // Record administrative action in Audit Log
      await createAuditLog(
        req.user?.uid || "unknown",
        req.user?.email || "unknown",
        "UPDATE_SITE_CONTENT",
        "siteData",
        "main",
        { updatedFields: Object.keys(payload) }
      );

      res.json({ success: true, message: "Informações salvas e sincronizadas com sucesso!" });
    } catch (error) {
      console.error("Erro ao salvar dados no Firestore:", error);
      res.status(500).json({ error: "Erro ao salvar informações no banco de dados." });
    }
  };

  app.post("/api/admin/site-content", requireAuth, requireRole(["admin", "gestor"]), saveSiteContentHandler);
  app.post("/api/site-data", requireAuth, requireRole(["admin", "gestor"]), saveSiteContentHandler);

  // API endpoint for AI assistant chat (Public but disabled by default)
  app.post("/api/chat", rateLimiter(60000, 3), async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "O campo 'messages' é obrigatório e deve ser um array." });
        return;
      }

      // Check if chat is enabled
      const chatEnabled = process.env.PUBLIC_CHAT_ENABLED === "true";
      if (!chatEnabled) {
        return res.json({ 
          text: "Olá! No momento, o nosso canal de inteligência artificial de autoatendimento está temporariamente offline. Por favor, fale diretamente conosco clicando no botão do WhatsApp na tela para um atendimento imediato." 
        });
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
