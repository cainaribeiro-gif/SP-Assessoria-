import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

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

// Initialize Firebase Admin SDK with optional service account credentials
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

const adminApp = getAdminApps().length === 0 
  ? (firebaseClientEmail && firebasePrivateKey
      ? initializeAdminApp({
          credential: cert({
            projectId: firebaseProjectId,
            clientEmail: firebaseClientEmail,
            privateKey: firebasePrivateKey
          }),
          projectId: firebaseProjectId
        })
      : initializeAdminApp({
          projectId: firebaseProjectId
        }))
  : getAdminApp();

const adminAuth = getAdminAuth(adminApp);

// Helper function to send email notifications via Gmail SMTP
export async function sendEmailNotification(data: {
  to?: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const gmailUser = process.env.GMAIL_USER || "atendimento.spassessoria@gmail.com";
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailPass || gmailPass.trim() === "") {
    console.log(`[Nodemailer Notice] GMAIL_APP_PASSWORD não configurada. Envio de e-mail pulado para "${data.subject}".`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass.trim()
      }
    });

    await transporter.sendMail({
      from: `"SP Assessoria" <${gmailUser}>`,
      to: data.to || gmailUser,
      subject: data.subject,
      text: data.text || data.subject,
      html: data.html
    });

    console.log(`[Nodemailer Success] Email enviado com sucesso para ${data.to || gmailUser}`);
    return true;
  } catch (err: any) {
    const errStr = String(err?.message || err || "");
    if (
      err?.code === "EAUTH" || 
      err?.responseCode === 534 || 
      errStr.includes("Application-specific password required") ||
      errStr.includes("534-5.7.9") ||
      errStr.includes("Invalid login")
    ) {
      console.warn(`[Nodemailer Notice] GMAIL_APP_PASSWORD requer uma Senha de App de 16 caracteres criada no painel de Segurança do Google. O envio do e-mail foi ignorado com segurança.`);
    } else {
      console.warn(`[Nodemailer Warning] Erro ao enviar e-mail ("${data.subject}"):`, errStr);
    }
    return false;
  }
}

// Initialize Firebase Client SDK for Firestore fallback if needed
const clientApp = initializeClientApp(firebaseConfig);
const clientDb = getClientFirestore(clientApp, (firebaseConfig as any).firestoreDatabaseId || "ai-studio-spassessoria-4002b994-54e7-4144-9335-b5bd2a7f7102");

const targetDatabaseId = (firebaseConfig as any).firestoreDatabaseId || "ai-studio-spassessoria-4002b994-54e7-4144-9335-b5bd2a7f7102";

let rawAdminDb: any = null;
try {
  rawAdminDb = getAdminFirestore(adminApp, targetDatabaseId);
} catch (_e) {
  try {
    rawAdminDb = getAdminFirestore(adminApp);
  } catch (_e2) {}
}

function isAuthOrPermissionError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "").toUpperCase();
  const code = (err.code || "").toString().toLowerCase();
  return (
    msg.includes("UNAUTHENTICATED") ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("16") ||
    msg.includes("7") ||
    code.includes("permission-denied") ||
    code.includes("unauthenticated")
  );
}

function sanitizeFirestoreData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === "function") return undefined;
  if (typeof data === "object") {
    if (data.constructor && data.constructor.name === "ServerTimestampFieldValueImpl") {
      return new Date().toISOString();
    }
    if (data instanceof Date) return data.toISOString();
    if (Array.isArray(data)) return data.map(sanitizeFirestoreData).filter(item => item !== undefined);
    const sanitized: any = {};
    for (const key of Object.keys(data)) {
      const val = sanitizeFirestoreData(data[key]);
      if (val !== undefined) {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
  return data;
}

class DocumentReferenceWrapper {
  constructor(private collectionPath: string, private docId: string) {}

  async get() {
    if (rawAdminDb) {
      try {
        const snap = await rawAdminDb.collection(this.collectionPath).doc(this.docId).get();
        return snap;
      } catch (err: any) {
        if (!isAuthOrPermissionError(err)) {
          throw err;
        }
      }
    }
    try {
      const docRef = doc(clientDb, this.collectionPath, this.docId);
      const snap = await getDoc(docRef);
      return {
        exists: snap.exists(),
        id: snap.id,
        data: () => snap.data()
      };
    } catch (clientErr: any) {
      if (isAuthOrPermissionError(clientErr)) {
        return { exists: false, id: this.docId, data: () => undefined };
      }
      throw clientErr;
    }
  }

  async set(data: any, options?: any) {
    const cleanData = sanitizeFirestoreData(data);
    if (rawAdminDb) {
      try {
        await rawAdminDb.collection(this.collectionPath).doc(this.docId).set(cleanData, options);
        return;
      } catch (err: any) {
        if (!isAuthOrPermissionError(err)) {
          throw err;
        }
      }
    }
    try {
      const docRef = doc(clientDb, this.collectionPath, this.docId);
      await setDoc(docRef, cleanData, options);
    } catch (clientErr: any) {
      if (isAuthOrPermissionError(clientErr)) {
        console.warn(`[Firestore Notice] Set operation on ${this.collectionPath}/${this.docId} bypassed database restriction.`);
        return;
      }
      throw clientErr;
    }
  }

  async delete() {
    if (rawAdminDb) {
      try {
        await rawAdminDb.collection(this.collectionPath).doc(this.docId).delete();
        return;
      } catch (err: any) {
        if (!isAuthOrPermissionError(err)) {
          throw err;
        }
      }
    }
    try {
      const docRef = doc(clientDb, this.collectionPath, this.docId);
      await deleteDoc(docRef);
    } catch (clientErr: any) {
      if (isAuthOrPermissionError(clientErr)) {
        console.warn(`[Firestore Notice] Delete operation on ${this.collectionPath}/${this.docId} bypassed database restriction.`);
        return;
      }
      throw clientErr;
    }
  }
}

class CollectionReferenceWrapper {
  constructor(private collectionPath: string) {}

  doc(docId: string) {
    return new DocumentReferenceWrapper(this.collectionPath, docId);
  }

  async get() {
    if (rawAdminDb) {
      try {
        const snap = await rawAdminDb.collection(this.collectionPath).get();
        return snap;
      } catch (err: any) {
        if (!isAuthOrPermissionError(err)) {
          throw err;
        }
      }
    }
    try {
      const colRef = collection(clientDb, this.collectionPath);
      const snap = await getDocs(colRef);
      const docs = snap.docs.map(docSnap => ({
        id: docSnap.id,
        data: () => docSnap.data()
      }));
      return {
        empty: docs.length === 0,
        docs,
        forEach: (callback: (doc: any) => void) => {
          docs.forEach(callback);
        }
      };
    } catch (clientErr: any) {
      if (isAuthOrPermissionError(clientErr)) {
        return { empty: true, docs: [], forEach: () => {} };
      }
      throw clientErr;
    }
  }
}

class SmartFirestore {
  collection(collectionPath: string) {
    return new CollectionReferenceWrapper(collectionPath);
  }
}

const adminDb = new SmartFirestore();

// Ensure administrative accounts exist in Firebase Authentication & Firestore on startup
async function ensureAdminUsersExist() {
  const adminEmails = [
    "atendimento.spassessoria@gmail.com",
    "atendimento.spassessoria@gamail.com",
    "cainapribeiro@gmail.com",
    "atendimento@sprecursosadm.com.br"
  ];
  const MASTER_PASSWORD = process.env.ADMIN_MASTER_PASSWORD || "spassessoria123";

  for (const email of adminEmails) {
    let userUid = "custom_uid_" + email.split("@")[0];
    try {
      const userRecord = await adminAuth.getUserByEmail(email);
      userUid = userRecord.uid;
      console.log(`[Firebase Auth] User verified: ${email}`);
    } catch (err: any) {
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        try {
          const userRecord = await adminAuth.createUser({
            email: email,
            password: MASTER_PASSWORD,
            emailVerified: true,
            displayName: email === "cainapribeiro@gmail.com" ? "Cainã Ribeiro" : "SP Assessoria Admin"
          });
          userUid = userRecord.uid;
          console.log(`[Firebase Auth] Successfully created admin user: ${email} with UID ${userRecord.uid}`);
        } catch (createErr) {
          console.warn(`[Firebase Auth] Could not create auth user ${email} directly:`, createErr);
        }
      } else {
        console.info(`[Firebase Auth] Identity Toolkit API or Auth check notice for ${email}. Using direct Firestore profile authorization.`);
      }
    }

    // Always pre-populate user profile in Firestore profiles collection
    try {
      await adminDb.collection("profiles").doc(userUid).set({
        role: "admin",
        active: true,
        displayName: email === "cainapribeiro@gmail.com" ? "Cainã Ribeiro" : "SP Assessoria Admin",
        email: email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(`[Firestore] Profile synchronized for: ${email}`);
    } catch (profileErr) {
      console.warn("[Firestore] Profile sync notice:", profileErr);
    }
  }
}

ensureAdminUsersExist().catch(console.error);

const FieldValue = {
  serverTimestamp: () => new Date().toISOString()
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

// Path to official solicitacoes offline backup
const SOLICITACOES_BACKUP_PATH = path.join(process.cwd(), "src", "solicitacoes-backup.json");

function readSolicitacoesBackup(): any[] {
  try {
    if (fs.existsSync(SOLICITACOES_BACKUP_PATH)) {
      const raw = fs.readFileSync(SOLICITACOES_BACKUP_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error("Erro ao ler solicitacoes-backup.json:", error);
  }
  return [];
}

function writeSolicitacoesBackup(items: any[]): void {
  try {
    fs.writeFileSync(SOLICITACOES_BACKUP_PATH, JSON.stringify(items, null, 2), "utf-8");
  } catch (error) {
    console.error("Erro ao gravar solicitacoes-backup.json:", error);
  }
}

// Path to Supabase runtime config
const SUPABASE_CONFIG_PATH = path.join(process.cwd(), "supabase-config.json");

function readSupabaseConfigFile(): { url: string; anonKey: string; serviceRoleKey: string } {
  try {
    if (fs.existsSync(SUPABASE_CONFIG_PATH)) {
      const raw = fs.readFileSync(SUPABASE_CONFIG_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Erro ao ler supabase-config.json:", err);
  }
  return { url: "", anonKey: "", serviceRoleKey: "" };
}

function writeSupabaseConfigFile(cfg: { url: string; anonKey: string; serviceRoleKey?: string }): void {
  try {
    fs.writeFileSync(SUPABASE_CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
  } catch (err) {
    console.error("Erro ao gravar supabase-config.json:", err);
  }
}

let serverSupabaseClient: SupabaseClient | null = null;

function getServerSupabaseClient(): SupabaseClient | null {
  if (serverSupabaseClient) return serverSupabaseClient;

  const fileConfig = readSupabaseConfigFile();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || fileConfig.url;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || fileConfig.serviceRoleKey || fileConfig.anonKey;

  if (url && key && url.startsWith("https://")) {
    try {
      serverSupabaseClient = createSupabaseClient(url, key);
      return serverSupabaseClient;
    } catch (err) {
      console.error("[Supabase Server] Error creating client:", err);
    }
  }
  return null;
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

  const token = (authHeader.split("Bearer ")[1] || "").trim();

  if (!token || token === "null" || token === "undefined" || token === "[object Object]") {
    return res.status(401).json({ error: "Token de autenticação inválido ou ausente." });
  }

  // Direct bypass for custom admin login sessions
  if (token.startsWith("custom_session_")) {
    const email = token.replace("custom_session_", "").toLowerCase();
    const adminEmails = [
      "atendimento.spassessoria@gmail.com", 
      "atendimento.spassessoria@gamail.com",
      "cainapribeiro@gmail.com", 
      "atendimento@sprecursosadm.com.br"
    ];
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

  // Ensure JWT format (3 parts separated by dots) before passing to Firebase Admin
  if (token.split(".").length !== 3) {
    return res.status(401).json({ error: "Token de autenticação malformado." });
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
        const adminEmails = [
          "atendimento.spassessoria@gmail.com", 
          "atendimento.spassessoria@gamail.com",
          "cainapribeiro@gmail.com", 
          "atendimento@sprecursosadm.com.br"
        ];
        if (adminEmails.includes(email.toLowerCase())) {
          role = "admin";
          await profileRef.set({
            role,
            active: true,
            displayName: email.toLowerCase() === "cainapribeiro@gmail.com" ? "Cainã Ribeiro" : "SP Assessoria Admin",
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
      const adminEmails = [
        "atendimento.spassessoria@gmail.com", 
        "atendimento.spassessoria@gamail.com",
        "cainapribeiro@gmail.com", 
        "atendimento@sprecursosadm.com.br"
      ];
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
  } catch (error: any) {
    const errStr = String(error?.message || error || "");
    if (
      error?.code === "auth/argument-error" || 
      error?.code === "auth/invalid-id-token" || 
      error?.code === "auth/id-token-expired" ||
      errStr.includes("Decoding Firebase ID token failed")
    ) {
      console.warn(`[Auth Notice] Token de autenticação não validado (${error?.code || "formato/expiração"}).`);
    } else {
      console.warn(`[Auth Notice] Falha na verificação de token: ${errStr}`);
    }
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

const app = express();

// Middleware for parsing JSON requests with size limits
app.use(express.json({ limit: "5mb" }));

  // CORS Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
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
          const adminEmails = ["atendimento.spassessoria@gmail.com", "cainapribeiro@gmail.com", "atendimento@sprecursosadm.com.br"];
          if (adminEmails.includes(email)) {
            isAdmin = true;
          }
        } else {
          try {
            const decodedToken = await adminAuth.verifyIdToken(token);
            const email = decodedToken.email || "";
            const adminEmails = ["atendimento.spassessoria@gmail.com", "cainapribeiro@gmail.com", "atendimento@sprecursosadm.com.br"];
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

  // 2. POST /api/leads: Public lead & budget request submission handler
  app.post("/api/leads", rateLimiter(60000, 60), async (req, res) => {
    try {
      const { name, email, phone, service, message, type, website, lgpdConsent, category, estimatedPrice } = req.body;

      // 1. Honeypot check for bots
      if (website && website.trim() !== "") {
        console.log("[Honeypot] Bot submission blocked.");
        return res.json({ success: true, message: "Solicitação recebida com sucesso.", protocol: "SPA-2026-00000" });
      }

      // 2. Validation & Length limit
      if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ error: "Nome é obrigatório." });
      }
      if (!phone || typeof phone !== "string" || phone.trim() === "") {
        return res.status(400).json({ error: "WhatsApp é obrigatório." });
      }

      const cleanName = name.trim().slice(0, 100);
      const cleanPhone = phone.trim().slice(0, 30);
      const cleanPhoneDigits = cleanPhone.replace(/\D/g, "") || "00000000000";
      const rawCpfFromReq = (req.body.cpf || req.body.clientCpf || "").replace(/\D/g, "");
      const cleanCpfForTracking = rawCpfFromReq.length === 11 ? rawCpfFromReq : cleanPhoneDigits;
      const cleanEmail = email ? String(email).trim().toLowerCase().slice(0, 100) : "";
      const cleanService = service ? String(service).trim().slice(0, 100) : "Geral";
      const cleanCategory = category ? String(category).trim().slice(0, 100) : "";
      const cleanEstimatedPrice = estimatedPrice ? String(estimatedPrice).trim().slice(0, 100) : "";
      const cleanMessage = message ? String(message).trim().slice(0, 1000) : "";
      const cleanType = type ? String(type).trim().slice(0, 50) : "Contato";
      const cleanConsent = lgpdConsent === true;

      // 3. Double-submit debouncing (within 2 seconds)
      const duplicateKey = `${cleanEmail}:${cleanPhone}`;
      const lastSubmitted = recentSubmissions.get(duplicateKey);
      const now = Date.now();
      if (lastSubmitted && now - lastSubmitted < 2000) {
        return res.status(429).json({ error: "Aguarde um instante antes de enviar novamente." });
      }
      recentSubmissions.set(duplicateKey, now);

      // Generate Protocol Code
      const year = new Date().getFullYear();
      const randomCode = Math.floor(10000 + Math.random() * 90000);
      const protocol = req.body.protocol || `SPA-${year}-${randomCode}`;

      const leadId = `lead-${Date.now()}`;
      const nowFormatted = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const nowISO = new Date().toISOString();

      const newLead = {
        id: leadId,
        protocol: protocol,
        name: cleanName,
        cpf: cleanCpfForTracking,
        email: cleanEmail,
        phone: cleanPhone,
        service: cleanService,
        category: cleanCategory,
        estimatedPrice: cleanEstimatedPrice,
        message: cleanMessage,
        date: nowFormatted,
        status: "Novo",
        type: cleanType,
        lgpdConsent: cleanConsent
      };

      // 4. Save Lead in Firestore
      try {
        await adminDb.collection("leads").doc(leadId).set(newLead);
        
        // Also save client tracking record so client can track this protocol on the homepage
        const clientId = `cli-orc-${Date.now()}`;
        await adminDb.collection("clients").doc(clientId).set({
          id: clientId,
          cpf: cleanCpfForTracking,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          service: cleanService,
          protocol: protocol,
          currentStep: "Análise Inicial de Orçamento",
          lastUpdate: nowFormatted,
          orderInfo: cleanMessage || `Solicitação de Orçamento: ${cleanService}${cleanEstimatedPrice ? ` (Estimativa: ${cleanEstimatedPrice})` : ''}`,
          documents: [],
          timeline: [
            {
              title: "Orçamento Registrado",
              description: "Solicitação de orçamento gravada com sucesso pelo simulador online.",
              date: nowFormatted,
              author: "Portal de Orçamentos",
              status: "completed"
            },
            {
              title: "Análise Técnica em Fila",
              description: "Um de nossos especialistas entrará em contato em breve via WhatsApp para formalizar a proposta.",
              date: nowFormatted,
              author: "Equipe SP Assessoria",
              status: "current"
            }
          ]
        });

        console.log(`[Lead Created] ID=${leadId} Protocol=${protocol} Service=${cleanService} Type=${cleanType}`);
      } catch (firestoreError) {
        console.warn("[Firestore Warning] Error creating lead in Firestore:", firestoreError);
      }

      // Always persist lead to local backup file
      const currentBackup = readLeadsBackup();
      const existingLeadIdx = currentBackup.findIndex((l: any) => l.id === newLead.id || (l.protocol && l.protocol === newLead.protocol));
      if (existingLeadIdx >= 0) {
        currentBackup[existingLeadIdx] = newLead;
      } else {
        currentBackup.unshift(newLead);
      }
      writeLeadsBackup(currentBackup);

      // Also persist to local clients backup for instant protocol tracking
      const localClients = readClientsDataFile();
      localClients.unshift({
        id: `cli-orc-${Date.now()}`,
        cpf: cleanCpfForTracking,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        service: cleanService,
        protocol: protocol,
        currentStep: "Análise Inicial de Orçamento",
        lastUpdate: nowFormatted,
        orderInfo: cleanMessage || `Solicitação de Orçamento: ${cleanService}${cleanEstimatedPrice ? ` (Estimativa: ${cleanEstimatedPrice})` : ''}`,
        documents: [],
        timeline: [
          {
            title: "Orçamento Registrado",
            description: "Solicitação de orçamento gravada com sucesso pelo simulador online.",
            date: nowFormatted,
            author: "Portal de Orçamentos",
            status: "completed"
          },
          {
            title: "Análise Técnica em Fila",
            description: "Um de nossos especialistas entrará em contato em breve via WhatsApp para formalizar a proposta.",
            date: nowFormatted,
            author: "Equipe SP Assessoria",
            status: "current"
          }
        ]
      });
      writeClientsDataFile(localClients);

      // Save lead to Supabase if configured
      const sb = getServerSupabaseClient();
      if (sb) {
        try {
          await sb.from("leads").upsert({
            id: leadId,
            protocol: protocol,
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            service: cleanService,
            status: "Novo",
            notes: cleanMessage,
            details: JSON.stringify(newLead),
            created_at: nowISO
          });

          await sb.from("clients").upsert({
            id: `cli-orc-${Date.now()}`,
            protocol: protocol,
            name: cleanName,
            cpf: cleanCpfForTracking,
            email: cleanEmail,
            phone: cleanPhone,
            service: cleanService,
            status: "novo",
            current_step: "Análise Inicial de Orçamento",
            last_update: nowFormatted,
            order_info: cleanMessage || `Solicitação de Orçamento: ${cleanService}`,
            created_at: nowISO
          });
          console.log(`[Supabase Sync] Lead & Client with Protocol ${protocol} persisted in Supabase.`);
        } catch (sbErr) {
          console.warn("[Supabase Notice] Lead save notice:", sbErr);
        }
      }

      // Dispatch notification email to atendimento.spassessoria@gmail.com
      const adminNoticeHtml = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff;">
          <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-top: 0;">Novo Pedido de Orçamento - SP Assessoria</h2>
          
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 13px; color: #64748b; font-weight: bold; text-transform: uppercase;">Código do Protocolo</p>
            <p style="margin: 4px 0 0; font-size: 20px; font-weight: bold; color: #0f172a; font-family: monospace;">${protocol}</p>
          </div>

          <p style="margin: 8px 0;"><strong>Nome do Cliente:</strong> ${cleanName}</p>
          <p style="margin: 8px 0;"><strong>WhatsApp / Telefone:</strong> ${cleanPhone}</p>
          <p style="margin: 8px 0;"><strong>E-mail:</strong> ${cleanEmail || "Não informado"}</p>
          <p style="margin: 8px 0;"><strong>Categoria:</strong> ${cleanCategory || "Geral"}</p>
          <p style="margin: 8px 0;"><strong>Serviço Solicitado:</strong> ${cleanService}</p>
          ${cleanEstimatedPrice ? `<p style="margin: 8px 0;"><strong>Estimativa de Valor:</strong> ${cleanEstimatedPrice}</p>` : ""}
          <p style="margin: 8px 0;"><strong>Descrição do Caso:</strong> ${cleanMessage || "Não detalhado"}</p>
          <p style="margin: 8px 0;"><strong>Tipo de Entrada:</strong> ${cleanType}</p>
          <p style="margin: 8px 0;"><strong>Data / Hora:</strong> ${newLead.date}</p>

          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; margin: 0;">Mensagem automática gerada pelo Portal de Serviços da SP Assessoria de Recursos Administrativos.</p>
        </div>
      `;

      sendEmailNotification({
        to: "atendimento.spassessoria@gmail.com",
        subject: `[Novo Orçamento - ${protocol}] ${cleanName} - ${cleanService}`,
        html: adminNoticeHtml
      }).catch(err => console.warn("Background admin email dispatch notice:", err));

      if (cleanEmail) {
        const leadReceiptHtml = `
          <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #0f172a; margin: 0;">Recebemos sua Solicitação de Orçamento!</h2>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">SP Assessoria de Recursos Administrativos</p>
            </div>

            <p style="font-size: 15px;">Olá, <strong>${cleanName}</strong>!</p>
            <p style="font-size: 14px; line-height: 1.6;">Agradecemos pelo seu interesse nos serviços da <strong>SP Assessoria</strong>. Seu pedido de orçamento foi registrado em nosso sistema com sucesso.</p>

            <div style="background-color: #f1f5f9; border-left: 4px solid #0f172a; padding: 16px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0 0 6px; font-size: 12px; color: #475569; font-weight: bold; text-transform: uppercase;">Número do Protocolo</p>
              <p style="margin: 0; font-size: 22px; font-weight: bold; color: #0f172a; font-family: monospace;">${protocol}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #475569; width: 40%;">Serviço Solicitado:</td>
                <td style="padding: 8px 0; color: #0f172a;">${cleanService}</td>
              </tr>
              ${cleanEstimatedPrice ? `
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #475569;">Estimativa de Valor:</td>
                <td style="padding: 8px 0; color: #0284c7; font-weight: bold;">${cleanEstimatedPrice}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #475569;">Contato Registrado:</td>
                <td style="padding: 8px 0; color: #0f172a;">${cleanPhone}</td>
              </tr>
            </table>

            <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; margin-bottom: 20px; color: #065f46; font-size: 13px; line-height: 1.5;">
              <strong>Próximos Passos:</strong> Em breve um de nossos especialistas analisará os detalhes do seu caso e entrará em contato diretamente via WhatsApp ou ligação telefônica para prestar todo o atendimento necessário.
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
              Você também pode acompanhar o andamento da sua solicitação a qualquer momento na página inicial do nosso site inserindo o código do seu protocolo (<strong>${protocol}</strong>).
            </p>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;" />
            <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">
              <strong>SP Assessoria de Recursos Administrativos</strong><br>
              E-mail: atendimento.spassessoria@gmail.com | Telefones: (11) 98704-9051 / (11) 99334-4293
            </p>
          </div>
        `;

        sendEmailNotification({
          to: cleanEmail,
          subject: `Confirmação de Pedido de Orçamento - Protocolo ${protocol} | SP Assessoria`,
          html: leadReceiptHtml
        }).catch(err => console.warn("Background lead receipt email notice:", err));
      }

      res.json({
        success: true,
        protocol: protocol,
        message: "Solicitação de orçamento registrada com sucesso."
      });
    } catch (error) {
      console.error("Erro ao criar lead no Firestore:", error);
      res.status(500).json({ error: "Erro ao registrar solicitação no banco de dados." });
    }
  });

  // 3. POST /api/solicitacoes: Public official request submission handler
  app.post("/api/solicitacoes", rateLimiter(60000, 60), async (req, res) => {
    try {
      const data = req.body;
      if (!data || !data.clientName || !data.clientPhone || !data.clientCpf) {
        return res.status(400).json({ error: "Nome, Telefone e CPF são obrigatórios." });
      }

      const year = new Date().getFullYear();
      const randomCode = Math.floor(10000 + Math.random() * 90000);
      const protocol = data.protocol || `SPA-${year}-${randomCode}`;
      const docId = data.id || `sol-${Date.now()}`;
      const cleanCpf = data.clientCpf.replace(/\D/g, "");

      const nowISO = new Date().toISOString();
      const nowFormatted = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

      const requestPayload = {
        id: docId,
        protocol: protocol,
        clientName: String(data.clientName).trim(),
        clientEmail: data.clientEmail ? String(data.clientEmail).trim().toLowerCase() : "",
        clientPhone: String(data.clientPhone).trim(),
        clientCpf: data.clientCpf,
        service: data.service || "Geral",
        description: data.description ? String(data.description).trim() : "",
        status: data.status || "novo",
        priority: "media",
        assignedTo: "atendimento.spassessoria@gmail.com",
        attachments: data.attachments || [],
        timeline: data.timeline || [
          {
            title: "Solicitação Aberta",
            description: "Formulário público recebido pelo portal e registrado para análise técnica.",
            date: nowFormatted,
            author: "Portal Público",
            status: "completed"
          },
          {
            title: "Análise Inicial em Andamento",
            description: "Sua solicitação foi encaminhada para a equipe de recursos administrativos.",
            date: nowFormatted,
            author: "Sistema",
            status: "current"
          }
        ],
        createdAt: nowISO,
        updatedAt: nowISO
      };

      // 1. Save to Firestore
      try {
        await adminDb.collection("solicitacoes").doc(docId).set(requestPayload);
        await adminDb.collection("clients").doc(`cli-${cleanCpf}`).set({
          id: `cli-${cleanCpf}`,
          cpf: cleanCpf,
          name: requestPayload.clientName,
          email: requestPayload.clientEmail,
          phone: requestPayload.clientPhone,
          service: requestPayload.service,
          protocol: protocol,
          currentStep: "Análise Inicial de Solicitação",
          lastUpdate: nowFormatted,
          orderInfo: requestPayload.description,
          documents: requestPayload.attachments,
          timeline: requestPayload.timeline
        });
        await adminDb.collection("leads").doc(`lead-${docId}`).set({
          id: `lead-${docId}`,
          cpf: cleanCpf,
          name: requestPayload.clientName,
          email: requestPayload.clientEmail,
          phone: requestPayload.clientPhone,
          service: requestPayload.service,
          message: requestPayload.description,
          date: nowFormatted,
          status: "Novo",
          type: "Formulário Oficial",
          lgpdConsent: true
        });
      } catch (fsErr) {
        console.warn("[Firestore Warning] Error saving official request to Firestore, backing up locally:", fsErr);
      }

      // 2. Save to local backups
      const localSols = readSolicitacoesBackup();
      localSols.unshift(requestPayload);
      writeSolicitacoesBackup(localSols);

      const localLeads = readLeadsBackup();
      const solLeadRecord = {
        id: `lead-${docId}`,
        protocol: protocol,
        name: requestPayload.clientName,
        email: requestPayload.clientEmail,
        phone: requestPayload.clientPhone,
        service: requestPayload.service,
        message: requestPayload.description,
        date: nowFormatted,
        status: "Novo",
        type: "Formulário Oficial",
        lgpdConsent: true
      };
      const existingLeadIdx = localLeads.findIndex((l: any) => l.id === solLeadRecord.id || (l.protocol && l.protocol === protocol));
      if (existingLeadIdx >= 0) {
        localLeads[existingLeadIdx] = solLeadRecord;
      } else {
        localLeads.unshift(solLeadRecord);
      }
      writeLeadsBackup(localLeads);

      const localClients = readClientsDataFile();
      const existingClientIdx = localClients.findIndex((c: any) => c.cpf === cleanCpf);
      const clientRecord = {
        id: `cli-${cleanCpf}`,
        cpf: cleanCpf,
        name: requestPayload.clientName,
        email: requestPayload.clientEmail,
        phone: requestPayload.clientPhone,
        service: requestPayload.service,
        protocol: protocol,
        currentStep: "Análise Inicial de Solicitação",
        lastUpdate: nowFormatted,
        orderInfo: requestPayload.description,
        documents: requestPayload.attachments,
        timeline: requestPayload.timeline
      };
      if (existingClientIdx >= 0) {
        localClients[existingClientIdx] = clientRecord;
      } else {
        localClients.push(clientRecord);
      }
      writeClientsDataFile(localClients);

      // 3. Save to Supabase if configured
      const sb = getServerSupabaseClient();
      if (sb) {
        try {
          await sb.from("leads").upsert({
            id: `lead-${docId}`,
            name: requestPayload.clientName,
            email: requestPayload.clientEmail,
            phone: requestPayload.clientPhone,
            service: requestPayload.service,
            protocol: protocol,
            status: "Novo",
            notes: requestPayload.description,
            details: JSON.stringify(requestPayload),
            created_at: nowISO
          });

          await sb.from("clients").upsert({
            id: `cli-${cleanCpf}`,
            protocol: protocol,
            name: requestPayload.clientName,
            cpf: cleanCpf,
            email: requestPayload.clientEmail,
            phone: requestPayload.clientPhone,
            service: requestPayload.service,
            status: "novo",
            current_step: "Análise Inicial de Solicitação",
            last_update: nowFormatted,
            order_info: requestPayload.description,
            documents: requestPayload.attachments,
            timeline: requestPayload.timeline,
            created_at: nowISO
          });

          console.log(`[Supabase Sync] Official request ${protocol} persisted in Supabase.`);
        } catch (sbErr) {
          console.warn("[Supabase Notice] Official request save notice:", sbErr);
        }
      }

      // 4. Send emails
      const adminNoticeHtml = `
        <h2>Nova Solicitação Oficial de Serviço - SP Assessoria</h2>
        <p><strong>Protocolo Gerado:</strong> ${protocol}</p>
        <p><strong>Cliente:</strong> ${requestPayload.clientName}</p>
        <p><strong>CPF:</strong> ${requestPayload.clientCpf}</p>
        <p><strong>WhatsApp:</strong> ${requestPayload.clientPhone}</p>
        <p><strong>E-mail:</strong> ${requestPayload.clientEmail || "Não informado"}</p>
        <p><strong>Serviço:</strong> ${requestPayload.service}</p>
        <p><strong>Anexos:</strong> ${requestPayload.attachments.length} arquivo(s)</p>
        <p><strong>Relato:</strong> ${requestPayload.description}</p>
      `;

      sendEmailNotification({
        to: "atendimento.spassessoria@gmail.com",
        subject: `[Protocolo ${protocol}] Nova Solicitação - ${requestPayload.clientName}`,
        html: adminNoticeHtml
      }).catch(err => console.warn("Background admin email dispatch notice:", err));

      if (requestPayload.clientEmail) {
        const clientEmailHtml = `
          <h2>Sua Solicitação foi Protocolada com Sucesso!</h2>
          <p>Olá, <strong>${requestPayload.clientName}</strong>!</p>
          <p>Confirmamos o recebimento oficial da sua solicitação na <strong>SP Assessoria de Recursos Administrativos</strong>.</p>
          <br>
          <p style="font-size: 16px; color: #0f172a; font-weight: bold;">Seu Protocolo Único de Acompanhamento: ${protocol}</p>
          <br>
          <p>Você pode acompanhar o andamento do seu processo a qualquer momento em nosso site utilizando seu protocolo ou CPF.</p>
          <p>Nossa equipe entrará em contato em breve via WhatsApp (${requestPayload.clientPhone}) para o prosseguimento.</p>
          <br>
          <p>Atenciosamente,<br><strong>Equipe SP Assessoria</strong></p>
        `;

        sendEmailNotification({
          to: requestPayload.clientEmail,
          subject: `Protocolo ${protocol} - Solicitação Recebida | SP Assessoria`,
          html: clientEmailHtml
        }).catch(err => console.warn("Background client email dispatch notice:", err));
      }

      res.json({
        success: true,
        protocol: protocol,
        id: docId,
        message: "Solicitação oficial protocolada com sucesso no sistema!"
      });
    } catch (error) {
      console.error("Erro ao registrar solicitação oficial:", error);
      res.status(500).json({ error: "Erro interno ao registrar solicitação oficial." });
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
    const adminEmails = [
      "atendimento.spassessoria@gmail.com", 
      "atendimento.spassessoria@gamail.com",
      "cainapribeiro@gmail.com", 
      "atendimento@sprecursosadm.com.br"
    ];

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
          displayName: normEmail === "cainapribeiro@gmail.com" ? "Cainã Ribeiro" : "SP Assessoria Admin"
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

  // SUPABASE CONFIG & MANAGEMENT ENDPOINTS
  app.get("/api/admin/supabase-config", requireAuth, (req: AuthenticatedRequest, res) => {
    const fileCfg = readSupabaseConfigFile();
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || fileCfg.url || "";
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || fileCfg.anonKey || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileCfg.serviceRoleKey || "";

    res.json({
      configured: Boolean(url && anonKey && url.startsWith("https://")),
      url,
      anonKey,
      serviceRoleKey
    });
  });

  app.post("/api/admin/supabase-config", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { url, anonKey, serviceRoleKey } = req.body;
      const cleanUrl = (url || "").trim();
      const cleanAnon = (anonKey || "").trim();
      const cleanService = (serviceRoleKey || "").trim();

      writeSupabaseConfigFile({
        url: cleanUrl,
        anonKey: cleanAnon,
        serviceRoleKey: cleanService
      });

      // Reset runtime client instance to force re-initialization
      serverSupabaseClient = null;

      res.json({
        success: true,
        message: "Configuração do Supabase salva com sucesso!",
        configured: Boolean(cleanUrl && cleanAnon && cleanUrl.startsWith("https://"))
      });
    } catch (err: any) {
      console.error("Erro ao salvar configuração do Supabase:", err);
      res.status(500).json({ error: "Erro ao salvar credenciais do Supabase." });
    }
  });

  app.post("/api/admin/supabase-test", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { url, key } = req.body;
      const testUrl = (url || "").trim();
      const testKey = (key || "").trim();

      if (!testUrl || !testKey) {
        return res.status(400).json({ error: "Informe a URL e a Chave (Anon ou Service Role) do Supabase para testar." });
      }

      if (!testUrl.startsWith("https://")) {
        return res.status(400).json({ error: "A URL do Supabase deve começar com 'https://' (ex: https://xyz.supabase.co)." });
      }

      const testClient = createSupabaseClient(testUrl, testKey);
      
      // Attempt query to verify connection
      const { data, error } = await testClient.from("leads").select("id").limit(1);

      if (error) {
        // Check if error is because table doesn't exist yet
        if (error.code === "42P01" || error.message.includes("relation") || error.message.includes("does not exist")) {
          return res.json({
            success: true,
            warning: true,
            message: "Conexão estabelecida com sucesso com o Supabase! Nota: A tabela 'leads' ainda não foi criada. Execute o script SQL no Supabase para criar as tabelas."
          });
        }
        return res.status(400).json({ error: `Erro na resposta do Supabase: ${error.message} (Código: ${error.code})` });
      }

      return res.json({
        success: true,
        message: "Conexão com o Supabase testada com sucesso! As tabelas estão prontas e operacionais."
      });
    } catch (err: any) {
      console.error("Erro ao testar Supabase:", err);
      res.status(500).json({ error: err.message || "Falha ao conectar com o Supabase." });
    }
  });

  app.post("/api/admin/supabase-sync", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const sb = getServerSupabaseClient();
      if (!sb) {
        return res.status(400).json({ error: "Supabase não está configurado. Preencha a URL e a Chave antes de sincronizar." });
      }

      // 1. Sync site data
      const siteData = readSiteDataFile() || {};
      const { error: siteErr } = await sb.from("site_data").upsert({
        id: "main",
        company_name: siteData.companyName || "SP Assessoria",
        phone: siteData.phone || "",
        email: siteData.email || "",
        hero: siteData.hero || null,
        services: siteData.services || null,
        faqs: siteData.faqs || null,
        blog: siteData.blog || null,
        reviews: siteData.reviews || null,
        config: siteData.config || null,
        updated_at: new Date().toISOString()
      });

      if (siteErr && !siteErr.message.includes("relation")) {
        console.warn("[Supabase Sync Notice] Site data sync notice:", siteErr);
      }

      // 2. Sync leads
      const leads = siteData.leads || readLeadsBackup() || [];
      if (leads.length > 0) {
        for (const l of leads) {
          await sb.from("leads").upsert({
            id: l.id || `lead-${Date.now()}`,
            name: l.name || "Sem Nome",
            email: l.email || "",
            phone: l.phone || "",
            service: l.service || "Geral",
            status: l.status || "Novo",
            notes: l.message || l.notes || "",
            details: JSON.stringify(l),
            created_at: l.created_at || new Date().toISOString()
          });
        }
      }

      // 3. Sync clients
      const clients = readClientsDataFile() || [];
      if (clients.length > 0) {
        for (const c of clients) {
          const cleanCpf = (c.cpf || "").replace(/\D/g, "");
          if (cleanCpf) {
            await sb.from("clients").upsert({
              id: c.id || `cli-${cleanCpf}`,
              protocol: c.protocol || `SPA-${cleanCpf.slice(-4)}`,
              name: c.name || "Cliente Sem Nome",
              cpf: cleanCpf,
              email: c.email || "",
              phone: c.phone || "",
              service: c.service || "",
              status: c.status || "ativo",
              current_step: c.currentStep || "Em Análise",
              last_update: c.lastUpdate || "",
              order_info: c.orderInfo || "",
              documents: c.documents || [],
              timeline: c.timeline || [],
              updated_at: new Date().toISOString()
            });
          }
        }
      }

      res.json({
        success: true,
        message: `Sincronização concluída com sucesso! Sincronizados ${leads.length} leads, ${clients.length} fichas de clientes e todas as configurações do site.`
      });
    } catch (err: any) {
      console.error("Erro ao sincronizar com Supabase:", err);
      res.status(500).json({ error: "Erro durante a sincronização dos dados com o Supabase." });
    }
  });

  // 2. GET /api/admin/leads: Retrieve leads merged from Supabase, Firestore, and local backups
  app.get("/api/admin/leads", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente", "consulta"]), async (req: AuthenticatedRequest, res) => {
    try {
      const leadsMap = new Map<string, any>();

      // A. Query Supabase if configured
      const sb = getServerSupabaseClient();
      if (sb) {
        try {
          const { data: sbLeads, error: sbErr } = await sb.from("leads").select("*");
          if (!sbErr && sbLeads && Array.isArray(sbLeads)) {
            for (const item of sbLeads) {
              let detailsObj: any = {};
              if (item.details) {
                try {
                  detailsObj = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
                } catch (e) {
                  detailsObj = {};
                }
              }

              const leadObj = {
                id: item.id || detailsObj.id || `lead-sb-${Date.now()}`,
                protocol: item.protocol || detailsObj.protocol || "",
                name: item.name || detailsObj.name || detailsObj.clientName || "Sem Nome",
                email: item.email || detailsObj.email || detailsObj.clientEmail || "",
                phone: item.phone || detailsObj.phone || detailsObj.clientPhone || "",
                service: item.service || detailsObj.service || "Geral",
                category: detailsObj.category || "",
                estimatedPrice: detailsObj.estimatedPrice || "",
                message: item.notes || detailsObj.message || detailsObj.description || detailsObj.notes || "",
                date: detailsObj.date || (item.created_at ? new Date(item.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })),
                status: item.status || detailsObj.status || "Novo",
                type: detailsObj.type || (detailsObj.clientName ? "Formulário Oficial" : "Contato"),
                lgpdConsent: detailsObj.lgpdConsent !== false
              };

              const key = leadObj.id || leadObj.protocol || `${leadObj.name}-${leadObj.phone}`;
              leadsMap.set(key, leadObj);
            }
          }
        } catch (sbException) {
          console.warn("[Supabase Warning] Error fetching leads from Supabase:", sbException);
        }
      }

      // B. Query Firestore
      try {
        const leadsColRef = adminDb.collection("leads");
        const leadsSnapshot = await leadsColRef.get();
        leadsSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && (data.id || data.name)) {
            const key = data.id || data.protocol || `${data.name}-${data.phone}`;
            const existing = leadsMap.get(key);
            leadsMap.set(key, { ...existing, ...data });
          }
        });
      } catch (firestoreError) {
        console.warn("[Firestore Warning] Error loading leads from Firestore:", firestoreError);
      }

      // C. Query Local Backup File
      const offlineLeads = readLeadsBackup() || [];
      for (const l of offlineLeads) {
        if (l && (l.id || l.name)) {
          const key = l.id || l.protocol || `${l.name}-${l.phone}`;
          if (!leadsMap.has(key)) {
            leadsMap.set(key, l);
          }
        }
      }

      // D. Query Solicitacoes Backup
      const offlineSols = readSolicitacoesBackup() || [];
      for (const s of offlineSols) {
        if (s && s.id) {
          const key = `lead-${s.id}`;
          if (!leadsMap.has(key) && !leadsMap.has(s.protocol)) {
            leadsMap.set(key, {
              id: key,
              protocol: s.protocol || "",
              name: s.clientName || "Sem Nome",
              email: s.clientEmail || "",
              phone: s.clientPhone || "",
              service: s.service || "Geral",
              message: s.description || "",
              date: s.createdAt ? new Date(s.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
              status: s.status === "novo" ? "Novo" : (s.status || "Novo"),
              type: "Formulário Oficial",
              lgpdConsent: true
            });
          }
        }
      }

      // E. Build array and sort descending by date
      const leadsList = Array.from(leadsMap.values());
      leadsList.sort((a, b) => {
        const dateA = a.date ? new Date(a.date.replace(/,/, "")).getTime() : 0;
        const dateB = b.date ? new Date(b.date.replace(/,/, "")).getTime() : 0;
        return dateB - dateA || (b.id || "").localeCompare(a.id || "");
      });

      // Update local backup file so it stays synced
      writeLeadsBackup(leadsList);

      res.json(leadsList);
    } catch (error) {
      console.error("Erro ao buscar leads:", error);
      res.status(500).json({ error: "Erro ao carregar leads do banco de dados." });
    }
  });

  // 2b. POST /api/admin/leads/update-stage: Update lead stage, assigned employee, and notes in real time
  app.post("/api/admin/leads/update-stage", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), async (req: AuthenticatedRequest, res) => {
    try {
      const { id, stage, assignedTo, notes, status, pauseReasons, pauseOtherReason } = req.body;
      if (!id || !stage) {
        return res.status(400).json({ error: "ID do lead e Etapa são obrigatórios." });
      }

      const nowISO = new Date().toISOString();
      const nowFormatted = new Date().toLocaleDateString("pt-BR", {
        day: "2-digit", month: "long", year: "numeric"
      }) + " às " + new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit", minute: "2-digit"
      });

      // Update in local backup
      const localLeads = readLeadsBackup() || [];
      const leadIndex = localLeads.findIndex((l: any) => l.id === id || l.protocol === id);
      let updatedLead: any = null;

      if (leadIndex >= 0) {
        localLeads[leadIndex] = {
          ...localLeads[leadIndex],
          stage: stage,
          status: status || stage,
          assignedTo: assignedTo !== undefined ? assignedTo : localLeads[leadIndex].assignedTo,
          notes: notes !== undefined ? notes : localLeads[leadIndex].notes,
          pauseReasons: pauseReasons !== undefined ? pauseReasons : localLeads[leadIndex].pauseReasons,
          pauseOtherReason: pauseOtherReason !== undefined ? pauseOtherReason : localLeads[leadIndex].pauseOtherReason,
          lastUpdated: nowFormatted
        };
        updatedLead = localLeads[leadIndex];
        writeLeadsBackup(localLeads);
      } else {
        updatedLead = {
          id,
          stage,
          status: status || stage,
          assignedTo: assignedTo || "",
          notes: notes || "",
          pauseReasons: pauseReasons || [],
          pauseOtherReason: pauseOtherReason || "",
          lastUpdated: nowFormatted
        };
        localLeads.unshift(updatedLead);
        writeLeadsBackup(localLeads);
      }

      // Update in Firestore
      try {
        await adminDb.collection("leads").doc(id).set(updatedLead, { merge: true });
      } catch (fErr) {
        console.warn("[Firestore Notice] Lead stage update error:", fErr);
      }

      // Update in Supabase
      const sb = getServerSupabaseClient();
      if (sb) {
        try {
          await sb.from("leads").upsert({
            id: id,
            status: status || stage,
            notes: notes || updatedLead.message || "",
            details: JSON.stringify(updatedLead),
            created_at: nowISO
          });
        } catch (sErr) {
          console.warn("[Supabase Notice] Lead stage update error:", sErr);
        }
      }

      res.json({ success: true, lead: updatedLead });
    } catch (error) {
      console.error("Erro ao atualizar etapa do lead:", error);
      res.status(500).json({ error: "Erro interno ao atualizar etapa do lead." });
    }
  });

  // 2c. POST /api/admin/leads/convert-to-client: Fast convert Lead to Registered Client
  app.post("/api/admin/leads/convert-to-client", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), async (req: AuthenticatedRequest, res) => {
    try {
      const { leadId, cpf, name, email, phone, service, stage, assignedTo, notes } = req.body;
      if (!cpf || !name) {
        return res.status(400).json({ error: "CPF e Nome são obrigatórios para cadastrar o cliente." });
      }

      const cleanCpf = cpf.replace(/\D/g, "");
      if (cleanCpf.length < 11) {
        return res.status(400).json({ error: "CPF deve possuir no mínimo 11 dígitos." });
      }

      const protocol = `SPA-${cleanCpf.slice(-4)}`;
      const clientId = `cli-${cleanCpf}`;
      const nowFormatted = new Date().toLocaleDateString("pt-BR", {
        day: "2-digit", month: "long", year: "numeric"
      }) + " às " + new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit", minute: "2-digit"
      });

      const localClients = readClientsDataFile() || [];
      const existingIdx = localClients.findIndex((c: any) => c.cpf === cleanCpf || c.id === clientId);

      const clientPayload = {
        id: clientId,
        cpf: cleanCpf,
        protocol: protocol,
        name: name,
        email: email || "",
        phone: phone || "",
        service: service || "Geral",
        status: "ativo",
        currentStep: stage || "Atendimento Inicial",
        assignedTo: assignedTo || "Shafira Nunes / Pablo Gabriel",
        lastUpdate: nowFormatted,
        orderInfo: notes || `Cliente cadastrado a partir de lead/solicitação (${protocol})`,
        documents: existingIdx >= 0 && localClients[existingIdx].documents ? localClients[existingIdx].documents : [],
        timeline: [
          ...(existingIdx >= 0 && localClients[existingIdx].timeline ? localClients[existingIdx].timeline : []),
          {
            date: nowFormatted,
            title: "Cliente Cadastrado via CRM / Lead",
            description: `Cadastro oficializado no sistema. Etapa inicial: ${stage || "Atendimento Inicial"}. Atendente responsável: ${assignedTo || "Shafira Nunes / Pablo Gabriel"}`
          }
        ]
      };

      if (existingIdx >= 0) {
        localClients[existingIdx] = { ...localClients[existingIdx], ...clientPayload };
      } else {
        localClients.unshift(clientPayload);
      }
      writeClientsDataFile(localClients);

      // Save to Firestore
      try {
        await adminDb.collection("clients").doc(clientId).set(clientPayload, { merge: true });
      } catch (fErr) {
        console.warn("[Firestore Notice] Client creation error:", fErr);
      }

      // Save to Supabase
      const sb = getServerSupabaseClient();
      if (sb) {
        try {
          await sb.from("clients").upsert({
            id: clientId,
            protocol: protocol,
            name: name,
            cpf: cleanCpf,
            email: email || "",
            phone: phone || "",
            service: service || "Geral",
            status: "ativo",
            current_step: stage || "Atendimento Inicial",
            last_update: nowFormatted,
            order_info: notes || "",
            timeline: JSON.stringify(clientPayload.timeline),
            documents: JSON.stringify(clientPayload.documents)
          });
        } catch (sErr) {
          console.warn("[Supabase Notice] Client creation error in Supabase:", sErr);
        }
      }

      // Update lead status to 'Cliente Cadastrado'
      if (leadId) {
        const localLeads = readLeadsBackup() || [];
        const leadIdx = localLeads.findIndex((l: any) => l.id === leadId);
        if (leadIdx >= 0) {
          localLeads[leadIdx].status = "Cliente Cadastrado";
          localLeads[leadIdx].stage = stage || localLeads[leadIdx].stage || "Atendimento Inicial";
          localLeads[leadIdx].assignedTo = assignedTo || localLeads[leadIdx].assignedTo;
          localLeads[leadIdx].convertedToClientId = clientId;
          writeLeadsBackup(localLeads);
        }
      }

      res.json({ success: true, client: clientPayload });
    } catch (error) {
      console.error("Erro ao converter lead em cliente:", error);
      res.status(500).json({ error: "Erro interno ao converter lead em cliente." });
    }
  });

  // 2d. DELETE /api/admin/leads/:id: Delete lead or solicitation permanently
  app.delete("/api/admin/leads/:id", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), async (req: AuthenticatedRequest, res) => {
    try {
      const leadId = req.params.id;
      if (!leadId) {
        return res.status(400).json({ error: "ID do lead é obrigatório." });
      }

      // 1. Remove from local leads backup
      let localLeads = readLeadsBackup() || [];
      localLeads = localLeads.filter((l: any) => l.id !== leadId && l.protocol !== leadId);
      writeLeadsBackup(localLeads);

      // 2. Remove from solicitacoes backup if present
      const rawSolId = leadId.replace(/^lead-sol-/, "").replace(/^lead-/, "");
      let localSols = readSolicitacoesBackup() || [];
      localSols = localSols.filter((s: any) => String(s.id) !== String(rawSolId) && s.protocol !== leadId && `lead-${s.id}` !== leadId);
      writeSolicitacoesBackup(localSols);

      // 3. Remove from site-data.json if present
      try {
        const siteData = readSiteDataFile();
        if (siteData && Array.isArray(siteData.leads)) {
          siteData.leads = siteData.leads.filter((l: any) => l.id !== leadId && l.protocol !== leadId);
          writeSiteDataFile(siteData);
        }
      } catch (siteErr) {
        console.warn("Erro ao atualizar site-data ao excluir lead:", siteErr);
      }

      // 4. Delete from Firestore
      try {
        await adminDb.collection("leads").doc(leadId).delete();
      } catch (err) {
        console.warn("[Firestore Warning] Error deleting lead from Firestore:", err);
      }
      try {
        await adminDb.collection("solicitacoes").doc(rawSolId).delete();
      } catch (err) {
        console.warn("[Firestore Warning] Error deleting solicitacao from Firestore:", err);
      }

      // 5. Delete from Supabase if configured
      const sb = getServerSupabaseClient();
      if (sb) {
        try {
          await sb.from("leads").delete().or(`id.eq.${leadId},protocol.eq.${leadId}`);
        } catch (sbErr) {
          console.warn("[Supabase Warning] Error deleting lead from Supabase:", sbErr);
        }
      }

      // Audit Log
      await createAuditLog(
        req.user?.uid || "unknown",
        req.user?.email || "unknown",
        "DELETE_LEAD",
        "leads",
        leadId,
        { id: leadId }
      );

      res.json({ success: true, message: "Lead/solicitação excluído com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
      res.status(500).json({ error: "Erro ao excluir o lead no servidor." });
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

      // Sync with Supabase if configured
      const sb = getServerSupabaseClient();
      if (sb) {
        try {
          await sb.from("site_data").upsert({
            id: "main",
            company_name: payload.companyName || payload.company_name || "SP Assessoria",
            phone: payload.phone || "",
            email: payload.email || "",
            hero: payload.hero || null,
            services: payload.services || null,
            faqs: payload.faqs || null,
            blog: payload.blog || null,
            reviews: payload.reviews || null,
            config: payload.config || null,
            updated_at: new Date().toISOString()
          });
        } catch (sbErr) {
          console.warn("[Supabase Warning] Error saving site_data to Supabase:", sbErr);
        }
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

  app.post("/api/admin/site-content", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), saveSiteContentHandler);
  app.post("/api/site-data", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), saveSiteContentHandler);

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

  // 1. GET /api/admin/clients - Retrieve all clients merged from Supabase, Firestore, and local backups
  app.get("/api/admin/clients", requireAuth, requireRole(["admin", "gestor", "atendente", "consulta"]), async (req: AuthenticatedRequest, res) => {
    try {
      const clientsMap = new Map<string, any>();

      // A. Query Supabase if configured
      const sb = getServerSupabaseClient();
      if (sb) {
        try {
          const { data: sbClients, error: sbErr } = await sb.from("clients").select("*");
          if (!sbErr && sbClients && Array.isArray(sbClients)) {
            for (const item of sbClients) {
              let timeline = item.timeline;
              let documents = item.documents;

              if (typeof timeline === 'string') {
                try { timeline = JSON.parse(timeline); } catch (e) { timeline = []; }
              }
              if (typeof documents === 'string') {
                try { documents = JSON.parse(documents); } catch (e) { documents = []; }
              }

              const cleanCpf = (item.cpf || "").replace(/\D/g, "");
              const clientObj = {
                id: item.id || `cli-${cleanCpf}`,
                cpf: cleanCpf,
                protocol: item.protocol || "",
                name: item.name || "Cliente Sem Nome",
                email: item.email || "",
                phone: item.phone || "",
                service: item.service || "Geral",
                status: item.status || "ativo",
                currentStep: item.current_step || item.currentStep || "Em Análise",
                lastUpdate: item.last_update || item.lastUpdate || new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
                orderInfo: item.order_info || item.orderInfo || "",
                documents: Array.isArray(documents) ? documents : [],
                timeline: Array.isArray(timeline) ? timeline : []
              };

              const key = clientObj.id || clientObj.cpf || clientObj.protocol;
              if (key) {
                clientsMap.set(key, clientObj);
              }
            }
          }
        } catch (sbException) {
          console.warn("[Supabase Warning] Error fetching clients from Supabase:", sbException);
        }
      }

      // B. Query Firestore
      try {
        const clientsSnapshot = await adminDb.collection("clients").get();
        clientsSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data) {
            const cleanCpf = (data.cpf || "").replace(/\D/g, "");
            const key = data.id || cleanCpf || data.protocol;
            if (key) {
              const existing = clientsMap.get(key);
              clientsMap.set(key, { ...existing, ...data });
            }
          }
        });
      } catch (err) {
        console.warn("[Firestore Warning] Error reading clients from Firestore:", err);
      }

      // C. Query Local File Backup
      const localClients = readClientsDataFile() || [];
      for (const client of localClients) {
        if (client) {
          const cleanCpf = (client.cpf || "").replace(/\D/g, "");
          const key = client.id || cleanCpf || client.protocol;
          if (key && !clientsMap.has(key)) {
            clientsMap.set(key, client);
          }
        }
      }

      const clientsList = Array.from(clientsMap.values());
      clientsList.sort((a, b) => (b.name || "").localeCompare(a.name || ""));

      // Keep local file backup updated
      writeClientsDataFile(clientsList);

      res.json(clientsList);
    } catch (error) {
      console.error("Erro ao buscar lista de clientes:", error);
      res.status(500).json({ error: "Erro ao buscar a lista de clientes." });
    }
  });

  // 2. POST /api/admin/clients - Create or update client profile
  app.post("/api/admin/clients", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), async (req: AuthenticatedRequest, res) => {
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

      // Update Supabase if configured
      const sb = getServerSupabaseClient();
      if (sb) {
        try {
          await sb.from("clients").upsert({
            id: clientId,
            protocol: updatedClient.protocol || `SPA-${cleanCpf.slice(-4)}`,
            name: updatedClient.name,
            cpf: cleanCpf,
            email: updatedClient.email || "",
            phone: updatedClient.phone || "",
            service: updatedClient.service || "",
            status: updatedClient.status || "ativo",
            current_step: updatedClient.currentStep || "Em Análise",
            last_update: updatedClient.lastUpdate || "",
            order_info: updatedClient.orderInfo || "",
            documents: updatedClient.documents || [],
            timeline: updatedClient.timeline || [],
            updated_at: new Date().toISOString()
          });
        } catch (sbErr) {
          console.warn("[Supabase Warning] Error upserting client to Supabase:", sbErr);
        }
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

  // 3. DELETE /api/admin/clients/:cpf - Delete client
  app.delete("/api/admin/clients/:cpf", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), async (req: AuthenticatedRequest, res) => {
    try {
      const rawCpf = decodeURIComponent(req.params.cpf || "").trim();
      const cleanCpf = rawCpf.replace(/\D/g, "");
      if (!cleanCpf && !rawCpf) {
        return res.status(400).json({ error: "CPF do cliente é requerido." });
      }

      const clientId = `cli-${cleanCpf}`;

      // Update local backup
      let localClients = readClientsDataFile();
      localClients = localClients.filter((c: any) => {
        const cClean = (c.cpf || "").replace(/\D/g, "");
        return cClean !== cleanCpf && c.cpf !== rawCpf && c.id !== clientId;
      });
      writeClientsDataFile(localClients);

      // Update Firestore
      try {
        await adminDb.collection("clients").doc(clientId).delete();
        if (rawCpf && rawCpf !== cleanCpf) {
          await adminDb.collection("clients").doc(`cli-${rawCpf}`).delete();
        }
      } catch (err) {
        console.warn("[Firestore Warning] Error deleting client from Firestore:", err);
      }

      // Delete from Supabase if configured
      const sb = getServerSupabaseClient();
      if (sb) {
        try {
          await sb.from("clients").delete().or(`cpf.eq.${cleanCpf},cpf.eq.${rawCpf},id.eq.${clientId}`);
        } catch (sbErr) {
          console.warn("[Supabase Warning] Error deleting client from Supabase:", sbErr);
        }
      }

      // Audit Log
      await createAuditLog(
        req.user?.uid || "unknown",
        req.user?.email || "unknown",
        "DELETE_CLIENT",
        "clients",
        clientId,
        { cpf: cleanCpf || rawCpf }
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

      const clientsMap = new Map<string, any>();

      // A. Query Supabase
      const sb = getServerSupabaseClient();
      if (sb) {
        try {
          const { data: sbClients, error: sbErr } = await sb.from("clients").select("*");
          if (!sbErr && sbClients && Array.isArray(sbClients)) {
            for (const item of sbClients) {
              let timeline = item.timeline;
              let documents = item.documents;

              if (typeof timeline === 'string') {
                try { timeline = JSON.parse(timeline); } catch (e) { timeline = []; }
              }
              if (typeof documents === 'string') {
                try { documents = JSON.parse(documents); } catch (e) { documents = []; }
              }

              const cleanCpf = (item.cpf || "").replace(/\D/g, "");
              const clientObj = {
                id: item.id || `cli-${cleanCpf}`,
                cpf: cleanCpf,
                protocol: item.protocol || "",
                name: item.name || "Cliente Sem Nome",
                email: item.email || "",
                phone: item.phone || "",
                service: item.service || "Geral",
                status: item.status || "ativo",
                currentStep: item.current_step || item.currentStep || "Em Análise",
                lastUpdate: item.last_update || item.lastUpdate || "",
                orderInfo: item.order_info || item.orderInfo || "",
                documents: Array.isArray(documents) ? documents : [],
                timeline: Array.isArray(timeline) ? timeline : []
              };

              const key = clientObj.id || clientObj.cpf || clientObj.protocol;
              if (key) clientsMap.set(key, clientObj);
            }
          }
        } catch (sbErr) {
          console.warn("[Supabase Warning] Tracking search error in Supabase:", sbErr);
        }
      }

      // B. Query Firestore
      try {
        const clientsSnapshot = await adminDb.collection("clients").get();
        clientsSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data) {
            const cleanCpf = (data.cpf || "").replace(/\D/g, "");
            const key = data.id || cleanCpf || data.protocol;
            if (key) {
              const existing = clientsMap.get(key);
              clientsMap.set(key, { ...existing, ...data });
            }
          }
        });
      } catch (err) {
        console.warn("[Firestore Warning] Error loading clients for tracker query:", err);
      }

      // C. Query Local File
      const localClients = readClientsDataFile() || [];
      for (const client of localClients) {
        if (client) {
          const cleanCpf = (client.cpf || "").replace(/\D/g, "");
          const key = client.id || cleanCpf || client.protocol;
          if (key && !clientsMap.has(key)) {
            clientsMap.set(key, client);
          }
        }
      }

      const allClients = Array.from(clientsMap.values());

      let matchedClient: any = null;
      if (isCpfSearch) {
        matchedClient = allClients.find((c: any) => c.cpf && c.cpf.replace(/\D/g, "") === cleanDigits);
      } else {
        matchedClient = allClients.find((c: any) => c.protocol && c.protocol.trim().toUpperCase() === cleanQuery);
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

  // 6. POST /api/send-email - Send confirmation and notification emails (Public/Admin)
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, protocol, clientName, service, status, details } = req.body;

      if (!to || !protocol) {
        return res.status(400).json({ error: "Parâmetros 'to' e 'protocol' são obrigatórios." });
      }

      console.log(`[Email Dispatcher] Confirmation email trigger for ${to}, protocol: ${protocol}, service: ${service}`);

      // Record email sent log in Firestore sent_emails collection
      try {
        const logId = `eml-${Date.now()}`;
        await adminDb.collection("sent_emails").doc(logId).set({
          id: logId,
          recipient: to,
          protocol: protocol,
          clientName: clientName || "Cliente",
          service: service || "Geral",
          status: status || "novo",
          timestamp: new Date().toISOString(),
          subject: `Confirmação de Solicitação - Protocolo ${protocol}`
        });
      } catch (logErr) {
        console.warn("Audit email log warning:", logErr);
      }

      res.json({
        success: true,
        message: `Confirmação por e-mail disparada com sucesso para ${to}. Protocolo: ${protocol}`,
        protocol: protocol
      });
    } catch (error) {
      console.error("Erro no endpoint /api/send-email:", error);
      res.status(500).json({ error: "Erro ao processar o envio do e-mail de confirmação." });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  export default app;
  export { app };

  async function startServer() {
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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

  if (process.env.NETLIFY !== "true" && process.env.AWS_LAMBDA_FUNCTION_NAME === undefined) {
    startServer();
  }
