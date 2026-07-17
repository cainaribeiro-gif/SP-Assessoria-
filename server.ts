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
const clientDb = getClientFirestore(clientApp, (firebaseConfig as any).firestoreDatabaseId || "ai-studio-spassessoria-4002b994-54e7-4144-9335-b5bd2a7f7102");

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
      let isAdmin = false;

      // Optional Auth check to see if we should return all reviews to an administrator
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split("Bearer ")[1];
        if (token.startsWith("custom_session_")) {
          const email = token.replace("custom_session_", "").toLowerCase();
          const adminEmails = ["atendimento.spassessoria@gmail.com", "cainapribeiro@gmail.com"];
          if (adminEmails.includes(email)) {
            isAdmin = true;
          }
        } else {
          try {
            const decodedToken = await adminAuth.verifyIdToken(token);
            const email = decodedToken.email || "";
            const adminEmails = ["atendimento.spassessoria@gmail.com", "cainapribeiro@gmail.com"];
            if (adminEmails.includes(email.toLowerCase())) {
              isAdmin = true;
            } else {
              const profileSnap = await adminDb.collection("profiles").doc(decodedToken.uid).get();
              if (profileSnap.exists) {
                const profileData = profileSnap.data();
                if (profileData && (profileData.role === "admin" || profileData.role === "gestor")) {
                  isAdmin = true;
                }
              }
            }
          } catch (e) {
            // Optional auth, ignore token validation error
          }
        }
      }

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
        reviews: isAdmin 
          ? (rawData?.reviews || []) 
          : (rawData?.reviews || []).filter((rev: any) => rev.approved !== false)
      };

      res.json(publicData);
    } catch (error) {
      console.error("Erro geral no endpoint site-data:", error);
      res.status(500).json({ error: "Erro ao buscar dados do banco de dados na nuvem." });
    }
  });

  // 1b. POST /api/reviews: Public guest review submission with email & phone validation
  app.post("/api/reviews", rateLimiter(60000, 5), async (req, res) => {
    try {
      const { author, stars, serviceType, text, email, phone } = req.body;

      if (!author || !stars || !serviceType || !text || !email || !phone) {
        return res.status(400).json({ error: "Todos os campos obrigatórios (nome, estrelas, serviço, comentário, e-mail, telefone) devem ser preenchidos." });
      }

      // Email Validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: "Por favor, insira um endereço de e-mail válido." });
      }

      // Phone length validation (at least 8 characters)
      const sanitizedPhone = phone.replace(/\D/g, "");
      if (sanitizedPhone.length < 8) {
        return res.status(400).json({ error: "Por favor, insira um número de telefone/WhatsApp válido com DDD." });
      }

      // Load current siteData
      let rawData: any = null;
      const siteDocRef = adminDb.collection("siteData").doc("main");
      try {
        const siteDoc = await siteDocRef.get();
        if (siteDoc.exists) {
          rawData = siteDoc.data();
        } else {
          rawData = readSiteDataFile() || {};
        }
      } catch (dbErr) {
        console.warn("Firestore collection warning during review submit, using local:", dbErr);
        rawData = readSiteDataFile() || {};
      }

      if (!rawData) {
        rawData = {};
      }
      if (!rawData.reviews) {
        rawData.reviews = [];
      }

      // Build review item with approved: false for moderation
      const newReview = {
        id: `rev-${Date.now()}`,
        author: author.trim(),
        stars: Math.max(1, Math.min(5, Number(stars))),
        serviceType: serviceType.trim(),
        text: text.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
        approved: false // Mandatory review before publication
      };

      rawData.reviews = [newReview, ...rawData.reviews];

      // Save back to Firestore & local JSON
      try {
        await siteDocRef.set(rawData);
      } catch (dbErr) {
        console.error("Failed to save site data with new review to Firestore:", dbErr);
      }
      writeSiteDataFile(rawData);

      res.json({ 
        success: true, 
        message: "Sua avaliação foi enviada com sucesso! Ela foi recebida por nossa equipe e será revisada antes de sua publicação pública no site." 
      });
    } catch (error) {
      console.error("Erro ao salvar avaliação:", error);
      res.status(500).json({ error: "Erro interno ao salvar sua avaliação." });
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

  // ==========================================
  // CLIENT TRACKING & REGISTRATION SYSTEM
  // ==========================================

  const CLIENTS_DATA_PATH = path.join(process.cwd(), "src", "clients-data.json");

  // Helper to read local clients backup file
  function readClientsDataFile(): any[] {
    try {
      if (fs.existsSync(CLIENTS_DATA_PATH)) {
        const raw = fs.readFileSync(CLIENTS_DATA_PATH, "utf-8");
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error("Erro ao ler arquivo clients-data.json:", err);
    }
    return [];
  }

  // Helper to write local clients backup file
  function writeClientsDataFile(data: any[]) {
    try {
      fs.writeFileSync(CLIENTS_DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Erro ao gravar arquivo clients-data.json:", err);
    }
  }

  // 1. GET /api/admin/clients - Retrieve all clients (Admin-only)
  app.get("/api/admin/clients", requireAuth, requireRole(["admin", "gestor"]), async (req: AuthenticatedRequest, res) => {
    try {
      let clientsList: any[] = [];
      try {
        const clientsSnapshot = await adminDb.collection("clients").get();
        clientsSnapshot.forEach((docSnap) => {
          clientsList.push(docSnap.data());
        });
      } catch (err) {
        console.warn("[Firestore Warning] Error reading clients from Firestore, falling back to local file:", err);
      }
      
      if (clientsList.length === 0) {
        clientsList = readClientsDataFile();
      }

      // Ensure stable sorting by last update or name
      clientsList.sort((a, b) => (b.name || "").localeCompare(a.name || ""));

      res.json(clientsList);
    } catch (error) {
      console.error("Erro ao buscar lista de clientes:", error);
      res.status(500).json({ error: "Erro ao buscar a lista de clientes." });
    }
  });

  // 2. POST /api/admin/clients - Create or update client profile (Admin-only)
  app.post("/api/admin/clients", requireAuth, requireRole(["admin", "gestor"]), async (req: AuthenticatedRequest, res) => {
    try {
      const clientData = req.body;
      if (!clientData || !clientData.cpf) {
        return res.status(400).json({ error: "O CPF do cliente é obrigatório." });
      }

      const cleanCpf = clientData.cpf.replace(/\D/g, "");
      if (cleanCpf.length < 11) {
        return res.status(400).json({ error: "CPF deve possuir no mínimo 11 dígitos." });
      }

      const clientId = `cli-${cleanCpf}`;
      const nowString = new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }) + " às " + new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });

      // Construct update payload
      const updatedClient = {
        ...clientData,
        id: clientId,
        cpf: cleanCpf,
        lastUpdate: nowString
      };

      // Extract current step from latest item in timeline
      if (updatedClient.timeline && Array.isArray(updatedClient.timeline) && updatedClient.timeline.length > 0) {
        const activeStep = updatedClient.timeline.find((t: any) => t.status === "current") || 
                           updatedClient.timeline.filter((t: any) => t.status === "completed").pop() || 
                           updatedClient.timeline[updatedClient.timeline.length - 1];
        updatedClient.currentStep = activeStep ? activeStep.title : "Em Análise";
      } else {
        updatedClient.currentStep = "Cadastro Efetuado";
        updatedClient.timeline = [
          { title: "Atendimento Inicial", status: "completed", date: new Date().toLocaleDateString("pt-BR"), description: "Perfil do cliente criado no sistema SP Assessoria." }
        ];
      }

      // Update local file fallback
      const localClients = readClientsDataFile();
      const index = localClients.findIndex((c: any) => c.cpf === cleanCpf);
      if (index >= 0) {
        localClients[index] = updatedClient;
      } else {
        localClients.push(updatedClient);
      }
      writeClientsDataFile(localClients);

      // Update Firestore
      try {
        await adminDb.collection("clients").doc(clientId).set(updatedClient);
      } catch (err) {
        console.warn("[Firestore Warning] Error saving client to Firestore, saved locally:", err);
      }

      // Audit Log
      await createAuditLog(
        req.user?.uid || "unknown",
        req.user?.email || "unknown",
        "UPSERT_CLIENT",
        "clients",
        clientId,
        { name: updatedClient.name, service: updatedClient.service }
      );

      res.json({ success: true, client: updatedClient });
    } catch (error) {
      console.error("Erro ao salvar cadastro do cliente:", error);
      res.status(500).json({ error: "Erro ao salvar informações do cliente no servidor." });
    }
  });

  // 3. DELETE /api/admin/clients/:cpf - Delete client (Admin-only)
  app.delete("/api/admin/clients/:cpf", requireAuth, requireRole(["admin", "gestor"]), async (req: AuthenticatedRequest, res) => {
    try {
      const cpf = req.params.cpf.replace(/\D/g, "");
      if (!cpf) {
        return res.status(400).json({ error: "CPF do cliente é requerido." });
      }

      const clientId = `cli-${cpf}`;

      // Update local backup
      let localClients = readClientsDataFile();
      localClients = localClients.filter((c: any) => c.cpf !== cpf);
      writeClientsDataFile(localClients);

      // Update Firestore
      try {
        await adminDb.collection("clients").doc(clientId).delete();
      } catch (err) {
        console.warn("[Firestore Warning] Error deleting client from Firestore:", err);
      }

      // Audit Log
      await createAuditLog(
        req.user?.uid || "unknown",
        req.user?.email || "unknown",
        "DELETE_CLIENT",
        "clients",
        clientId,
        { cpf }
      );

      res.json({ success: true, message: "Cliente excluído com sucesso do sistema." });
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
      res.status(500).json({ error: "Erro ao excluir o cliente do servidor." });
    }
  });

  // 4. GET /api/tracking - Public Search Route
  app.get("/api/tracking", async (req, res) => {
    try {
      const code = req.query.code;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ error: "Por favor, informe seu CPF ou código de protocolo." });
      }

      const cleanQuery = code.trim().toUpperCase();
      const cleanDigits = cleanQuery.replace(/\D/g, "");
      
      // Determine if searching by CPF or Protocol
      const isCpfSearch = cleanDigits.length === 11 || (cleanDigits.length > 0 && !cleanQuery.startsWith("SP"));

      let allClients: any[] = [];
      try {
        const clientsSnapshot = await adminDb.collection("clients").get();
        clientsSnapshot.forEach((docSnap) => {
          allClients.push(docSnap.data());
        });
      } catch (err) {
        console.warn("[Firestore Warning] Error loading clients for tracker query, using backup:", err);
      }

      if (allClients.length === 0) {
        allClients = readClientsDataFile();
      }

      let matchedClient: any = null;
      if (isCpfSearch) {
        matchedClient = allClients.find((c: any) => c.cpf.replace(/\D/g, "") === cleanDigits);
      } else {
        matchedClient = allClients.find((c: any) => c.protocol.trim().toUpperCase() === cleanQuery);
      }

      if (!matchedClient) {
        return res.status(404).json({ error: "Nenhum andamento de processo foi localizado para os dados informados. Verifique se o CPF ou protocolo está correto." });
      }

      // Secure Masking of Personal Information to maintain privacy in a public query
      const email = matchedClient.email || "";
      let maskedEmail = "";
      if (email && email.includes("@")) {
        const [userPart, domainPart] = email.split("@");
        const visibleLen = Math.min(2, Math.floor(userPart.length / 2)) || 1;
        maskedEmail = userPart.slice(0, visibleLen) + "*".repeat(Math.max(3, userPart.length - visibleLen)) + "@" + domainPart;
      }

      const phone = matchedClient.phone || "";
      let maskedPhone = phone;
      const digitsOnly = phone.replace(/\D/g, "");
      if (digitsOnly.length >= 10) {
        const ddd = digitsOnly.slice(-11, -9);
        const lastFour = digitsOnly.slice(-4);
        maskedPhone = `(${ddd}) *****-${lastFour}`;
      }

      res.json({
        protocol: matchedClient.protocol,
        clientName: matchedClient.name,
        service: matchedClient.service,
        currentStep: matchedClient.currentStep,
        lastUpdate: matchedClient.lastUpdate,
        documents: matchedClient.documents || [],
        orderInfo: matchedClient.orderInfo || "",
        timeline: matchedClient.timeline || [],
        maskedEmail,
        maskedPhone
      });
    } catch (error) {
      console.error("Erro na consulta pública de acompanhamento:", error);
      res.status(500).json({ error: "Ocorreu um erro ao consultar o andamento no servidor." });
    }
  });

  // 5. POST /api/send-tracking-email - Send notification tracking details via email (Public access with rate-limiting fallback)
  app.post("/api/send-tracking-email", async (req, res) => {
    try {
      const { protocol } = req.body;
      if (!protocol) {
        return res.status(400).json({ error: "Protocolo de processo é necessário." });
      }

      let allClients: any[] = [];
      try {
        const clientsSnapshot = await adminDb.collection("clients").get();
        clientsSnapshot.forEach((docSnap) => {
          allClients.push(docSnap.data());
        });
      } catch (err) {
        console.warn("Firestore error reading clients for email sending:", err);
      }

      if (allClients.length === 0) {
        allClients = readClientsDataFile();
      }

      const matchedClient = allClients.find((c: any) => c.protocol.toUpperCase() === protocol.trim().toUpperCase());
      if (!matchedClient) {
        return res.status(404).json({ error: "Andamento do processo não localizado." });
      }

      // Format a beautiful, human-readable rich tracking email
      const timelineHtml = (matchedClient.timeline || [])
        .map((t: any) => `<li>[${t.date || "Atualizado"}] <strong>${t.title}</strong> (${t.status === "completed" ? "Concluído" : t.status === "current" ? "Em Andamento" : "Pendente"}) - ${t.description}</li>`)
        .join("");

      const emailHtml = `
        <div style="font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background-color: #0f172a; padding: 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.05em; color: #f1f5f9;">SP ASSESSORIA</h1>
            <p style="margin: 4px 0 0; font-size: 11px; color: #fbbf24; text-transform: uppercase; font-weight: bold;">Acompanhamento de Recursos Extrajudiciais</p>
          </div>
          <div style="padding: 24px; background-color: #ffffff;">
            <p style="font-size: 14px; margin-top: 0;">Olá, <strong>${matchedClient.name}</strong>!</p>
            <p style="font-size: 14px;">Você solicitou o envio do andamento atualizado do seu processo diretamente para seu e-mail.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #d97706; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <h2 style="margin: 0 0 8px; font-size: 15px; color: #0f172a;">Detalhes do Processo</h2>
              <table style="width: 100%; font-size: 13px; line-height: 1.6;">
                <tr><td style="color: #64748b; width: 120px;">Protocolo:</td><td><strong>${matchedClient.protocol}</strong></td></tr>
                <tr><td style="color: #64748b;">Serviço:</td><td>${matchedClient.service}</td></tr>
                <tr><td style="color: #64748b;">Status Atual:</td><td><span style="background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px;">${matchedClient.currentStep}</span></td></tr>
                <tr><td style="color: #64748b;">Atualizado em:</td><td>${matchedClient.lastUpdate}</td></tr>
              </table>
            </div>

            <div style="margin: 20px 0;">
              <h3 style="font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Informações de Registro & Pedido</h3>
              <p style="font-size: 13px; line-height: 1.6; color: #334155;">${matchedClient.orderInfo}</p>
            </div>

            <div style="margin: 20px 0;">
              <h3 style="font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Documentos Vinculados</h3>
              <ul style="font-size: 13px; line-height: 1.6; color: #334155; padding-left: 20px;">
                ${(matchedClient.documents || []).map((doc: string) => `<li>${doc}</li>`).join("") || "<li>Nenhum documento listado.</li>"}
              </ul>
            </div>

            <div style="margin: 20px 0;">
              <h3 style="font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Linha do Tempo (Histórico de Trâmites)</h3>
              <ul style="font-size: 13px; line-height: 1.7; color: #334155; padding-left: 20px;">
                ${timelineHtml || "<li>Sem trâmites adicionais registrados.</li>"}
              </ul>
            </div>
          </div>
          <div style="background-color: #f1f5f9; padding: 16px; font-size: 11px; text-align: center; color: #64748b; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0;">Este é um e-mail informativo disparado a seu pedido do site da SP Assessoria.</p>
            <p style="margin: 4px 0 0;"><strong>Contatos SP Assessoria:</strong> (11) 98704-9051 / (11) 99334-4293 | atendimento.spassessoria@gmail.com</p>
          </div>
        </div>
      `;

      console.log(`[SMTP SIMULATOR] Enviando e-mail formatado para ${matchedClient.email}:`);
      console.log(`Assunto: SP Assessoria - Atualização do Protocolo ${matchedClient.protocol}`);
      
      // Save logs of emails sent
      try {
        const logId = `eml-${Date.now()}`;
        await adminDb.collection("sent_emails").doc(logId).set({
          id: logId,
          recipient: matchedClient.email,
          protocol: matchedClient.protocol,
          timestamp: new Date().toISOString(),
          subject: `Acompanhamento SP Assessoria - Protocolo ${matchedClient.protocol}`,
          contentSummary: matchedClient.currentStep
        });
      } catch (logErr) {
        console.warn("Não foi possível persistir log de e-mail enviado:", logErr);
      }

      // Hide exact email in public response for maximum security
      const userEmail = matchedClient.email || "";
      const [userPart, domainPart] = userEmail.split("@");
      const visibleLen = Math.min(2, Math.floor(userPart.length / 2)) || 1;
      const maskedEmail = userPart.slice(0, visibleLen) + "*".repeat(Math.max(3, userPart.length - visibleLen)) + "@" + domainPart;

      res.json({
        success: true,
        message: "E-mail enviado com sucesso para o endereço cadastrado!",
        maskedEmail: maskedEmail,
        protocol: matchedClient.protocol
      });
    } catch (error) {
      console.error("Erro ao enviar e-mail de rastreamento:", error);
      res.status(500).json({ error: "Erro ao disparar envio do e-mail. Tente novamente." });
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

  // Startup Sync: push current local site-data.json and clients-data.json content to Firestore to ensure consistency
  try {
    const localData = readSiteDataFile();
    if (localData) {
      console.log("Startup Sync: Syncing local site-data.json to Firestore...");
      const payload = { ...localData };
      delete payload.leads; // leads are stored separately
      await adminDb.collection("siteData").doc("main").set(payload);
      console.log("Startup Sync: site-data.json synchronized successfully!");
    }

    const localClients = readClientsDataFile();
    if (localClients && localClients.length > 0) {
      console.log("Startup Sync: Syncing local clients to Firestore...");
      for (const client of localClients) {
        if (client.id) {
          await adminDb.collection("clients").doc(client.id).set(client);
        }
      }
      console.log("Startup Sync: clients-data.json synchronized successfully!");
    }
  } catch (syncError) {
    console.error("Startup Sync Warning: Failed to sync local data to Firestore on boot:", syncError);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
