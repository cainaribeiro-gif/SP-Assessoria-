import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import helmet from "helmet";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { getServerSupabaseClient } from "./src/lib/supabase-admin.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

interface AuthenticatedRequest extends express.Request {
  user?: {
    uid: string;
    email: string;
    role: string;
    active: boolean;
  };
}

// 1. Security Headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// 2. Body Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 3. CORS Configuration
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : [
      "https://sprecursosadm.com.br",
      "https://www.sprecursosadm.com.br",
      "http://localhost:3000",
      "http://localhost:5173"
    ];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV !== "production")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// 4. Rate Limiting Middleware
function rateLimiter(windowMs: number = 60000, maxRequests: number = 60) {
  const memoryStore = new Map<string, { count: number; resetAt: number }>();
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const key = String(ip);
    const now = Date.now();

    const record = memoryStore.get(key);
    if (!record || now > record.resetAt) {
      memoryStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: "Muitas solicitações a partir deste IP, tente novamente mais tarde.",
        code: "RATE_LIMIT_EXCEEDED"
      });
    }

    record.count += 1;
    next();
  };
}

// 5. Authentication Verification Middleware (Supabase Auth)
async function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Token de autenticação não fornecido.",
      code: "AUTH_TOKEN_MISSING"
    });
  }

  const token = (authHeader.split("Bearer ")[1] || "").trim();
  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({
      success: false,
      error: "Token de autenticação inválido ou ausente.",
      code: "AUTH_TOKEN_INVALID"
    });
  }

  try {
    const sb = getServerSupabaseClient();
    if (!sb) {
      return res.status(401).json({
        success: false,
        error: "Serviço de autenticação não configurado no servidor.",
        code: "AUTH_NOT_CONFIGURED"
      });
    }

    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        error: "Sessão inválida ou expirada.",
        code: "AUTH_SESSION_EXPIRED"
      });
    }

    const user = data.user;
    const uid = user.id;
    const email = (user.email || "").toLowerCase();

    // Query profile from database
    const { data: profile } = await sb
      .from("profiles")
      .select("role, active")
      .eq("id", uid)
      .single();

    if (profile && profile.active === false) {
      return res.status(403).json({
        success: false,
        error: "Acesso negado: Conta inativa.",
        code: "ACCOUNT_INACTIVE"
      });
    }

    const role = profile?.role || (user.user_metadata?.role as string) || "cliente";
    const active = profile ? profile.active !== false : true;

    req.user = {
      uid,
      email,
      role,
      active
    };

    next();
  } catch (err) {
    console.error("[Auth Error]", err);
    return res.status(401).json({
      success: false,
      error: "Erro na verificação do token de autenticação.",
      code: "AUTH_ERROR"
    });
  }
}

// 6. Role Authorization Middleware
function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !req.user.active) {
      return res.status(403).json({
        success: false,
        error: "Acesso negado: Usuário não autenticado ou inativo.",
        code: "FORBIDDEN"
      });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Acesso negado: Perfil sem privilégios suficientes.",
        code: "ROLE_UNAUTHORIZED"
      });
    }
    next();
  };
}

// Helper: Audit Log recorder
async function logAuditAction(userId: string | undefined, action: string, resource: string, resourceId?: string, details?: any) {
  try {
    const sb = getServerSupabaseClient();
    if (sb) {
      await sb.from("audit_logs").insert({
        user_id: userId || null,
        action,
        resource,
        resource_id: resourceId || null,
        details: details || {}
      });
    }
  } catch (err) {
    console.warn("[Audit Log Warning] Failed to save audit log:", err);
  }
}

// Helper: Send email notification via Gmail SMTP & log to email_logs
export async function sendEmailNotification(data: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  relatedResource?: string;
  relatedResourceId?: string;
}) {
  const gmailUser = process.env.GMAIL_USER || "atendimento.spassessoria@gmail.com";
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailPass) {
    console.warn("[Email Service Notice] GMAIL_APP_PASSWORD não configurada. Notificação por e-mail ignorada.");
    return { success: false, reason: "GMAIL_APP_PASSWORD not set" };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPass
    }
  });

  try {
    const info = await transporter.sendMail({
      from: `"SP Assessoria" <${gmailUser}>`,
      to: data.to,
      subject: data.subject,
      text: data.text || data.html.replace(/<[^>]*>?/gm, ""),
      html: data.html
    });

    const sb = getServerSupabaseClient();
    if (sb) {
      await sb.from("email_logs").insert({
        recipient: data.to,
        subject: data.subject,
        status: "enviado",
        provider: "nodemailer_gmail",
        related_resource: data.relatedResource || null,
        related_resource_id: data.relatedResourceId || null
      });
    }

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[Email Service Error] Falha ao enviar e-mail:", error);

    const sb = getServerSupabaseClient();
    if (sb) {
      await sb.from("email_logs").insert({
        recipient: data.to,
        subject: data.subject,
        status: "falha",
        provider: "nodemailer_gmail",
        error_code: error?.code || error?.message || "UNKNOWN_EMAIL_ERROR",
        related_resource: data.relatedResource || null,
        related_resource_id: data.relatedResourceId || null
      });
    }

    return { success: false, error: error?.message || "Falha ao enviar e-mail" };
  }
}

// Helper functions for reading local files as seed fallback
const SITE_DATA_PATH = path.join(process.cwd(), "src", "site-data.json");
const LEADS_BACKUP_PATH = path.join(process.cwd(), "src", "leads-backup.json");
const SOLICITACOES_BACKUP_PATH = path.join(process.cwd(), "src", "solicitacoes-backup.json");
const CLIENTS_DATA_PATH = path.join(process.cwd(), "src", "clients-data.json");

function readSiteDataFile(): any {
  try {
    if (fs.existsSync(SITE_DATA_PATH)) {
      const raw = fs.readFileSync(SITE_DATA_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return {};
}

function writeSiteDataFile(data: any): void {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    try {
      fs.writeFileSync(SITE_DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {}
  }
}

function readLeadsBackup(): any[] {
  try {
    if (fs.existsSync(LEADS_BACKUP_PATH)) {
      const raw = fs.readFileSync(LEADS_BACKUP_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return [];
}

function readSolicitacoesBackup(): any[] {
  try {
    if (fs.existsSync(SOLICITACOES_BACKUP_PATH)) {
      const raw = fs.readFileSync(SOLICITACOES_BACKUP_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return [];
}

function readClientsDataFile(): any[] {
  try {
    if (fs.existsSync(CLIENTS_DATA_PATH)) {
      const raw = fs.readFileSync(CLIENTS_DATA_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return [];
}

// Function to generate unique protocols
function generateProtocolString(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `SPA-${year}-${rand}`;
}

// Masking helpers for process lookup
function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "*****";
  const [user, domain] = email.split("@");
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

function maskPhone(phone: string): string {
  if (!phone) return "(**) *****-****";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "(**) *****-****";
  const last4 = digits.slice(-4);
  const ddd = digits.length >= 10 ? digits.slice(0, 2) : "**";
  return `(${ddd}) *****-${last4}`;
}

// --------------------------------------------------------------------------
// API ROUTES
// --------------------------------------------------------------------------

// Health Check Endpoint (Requirement 37)
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    environment: process.env.NODE_ENV || "development",
    platform: "vercel",
    database: "supabase",
    timestamp: new Date().toISOString()
  });
});

// GET /api/site-data
app.get("/api/site-data", async (req, res) => {
  try {
    const sb = getServerSupabaseClient();
    if (sb) {
      const { data, error } = await sb
        .from("site_content")
        .select("content")
        .eq("section", "main")
        .single();

      if (!error && data?.content) {
        return res.json(data.content);
      }
    }
  } catch (err) {
    console.warn("[Site Data Notice] Error loading from Supabase, falling back to local file:", err);
  }

  const localData = readSiteDataFile();
  res.json(localData);
});

// POST /api/site-data & POST /api/admin/site-content
const saveSiteContentHandler = async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ success: false, error: "Dados inválidos." });
    }

    const sb = getServerSupabaseClient();
    if (sb) {
      await sb.from("site_content").upsert({
        section: "main",
        content: payload,
        is_public: true,
        updated_by: req.user?.uid || null,
        updated_at: new Date().toISOString()
      }, { onConflict: "section" });
    }

    writeSiteDataFile(payload);
    await logAuditAction(req.user?.uid, "update_site_content", "site_content", "main");

    res.json({ success: true, message: "Conteúdo atualizado com sucesso." });
  } catch (err) {
    console.error("[Site Data Error] Falha ao salvar conteúdo:", err);
    res.status(500).json({ success: false, error: "Erro interno ao salvar conteúdo do site." });
  }
};

app.post("/api/admin/site-content", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), saveSiteContentHandler);
app.post("/api/site-data", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), saveSiteContentHandler);

// POST /api/leads - Public Lead Registration (Requirement 20)
app.post("/api/leads", rateLimiter(60000, 30), async (req, res) => {
  try {
    const { name, email, phone, service, message, source, lgpdConsent } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: "Nome e e-mail são obrigatórios.",
        code: "MISSING_REQUIRED_FIELDS"
      });
    }

    const protocol = generateProtocolString();
    const newLead = {
      protocol,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: phone ? String(phone).trim() : null,
      service: service ? String(service).trim() : "Geral",
      message: message ? String(message).trim() : "",
      status: "novo",
      stage: "triagem",
      source: source || "site_organico",
      lgpd_consent: lgpdConsent !== false,
      created_at: new Date().toISOString()
    };

    const sb = getServerSupabaseClient();
    if (sb) {
      const { data, error } = await sb.from("leads").insert(newLead).select("id").single();
      if (error) {
        console.error("[Leads Error] Error inserting lead into Supabase:", error);
      } else if (data) {
        (newLead as any).id = data.id;
      }
    }

    // Send confirmation email
    sendEmailNotification({
      to: newLead.email,
      subject: `Recebemos sua mensagem! - Protocolo ${protocol}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #1e3a8a;">Olá, ${newLead.name}!</h2>
          <p>Obrigado por entrar em contato com a <strong>SP Assessoria de Recursos Administrativos</strong>.</p>
          <p>Sua mensagem foi recebida e um de nossos especialistas analisará seu caso em breve.</p>
          <p><strong>Número de Protocolo:</strong> <span style="background: #e0e7ff; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #1e3a8a;">${protocol}</span></p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">SP Assessoria de Recursos Administrativos — Atendimento Especializado em Recursos Administrativos.</p>
        </div>
      `,
      relatedResource: "lead",
      relatedResourceId: protocol
    }).catch(console.error);

    await logAuditAction(undefined, "create_lead", "leads", protocol, { name: newLead.name, service: newLead.service });

    res.json({
      success: true,
      protocol,
      message: "Lead cadastrado com sucesso.",
      lead: newLead
    });
  } catch (err) {
    console.error("[Leads Error]", err);
    res.status(500).json({
      success: false,
      error: "Erro ao processar cadastro do lead.",
      code: "LEAD_CREATION_FAILED"
    });
  }
});

// POST /api/solicitacoes - Public Formal Request Registration (Requirement 20)
app.post("/api/solicitacoes", rateLimiter(60000, 30), async (req, res) => {
  try {
    const { name, email, phone, service, description } = req.body;

    if (!name || !email || !service) {
      return res.status(400).json({
        success: false,
        error: "Nome, e-mail e serviço são obrigatórios.",
        code: "MISSING_REQUIRED_FIELDS"
      });
    }

    const protocol = generateProtocolString();
    const requestPayload = {
      protocol,
      client_name: String(name).trim(),
      client_email: String(email).trim().toLowerCase(),
      client_phone: phone ? String(phone).trim() : "",
      service: String(service).trim(),
      description: description ? String(description).trim() : "",
      status: "Análise Inicial de Solicitação",
      priority: "normal",
      created_at: new Date().toISOString()
    };

    const sb = getServerSupabaseClient();
    if (sb) {
      await sb.from("requests").insert(requestPayload);

      // Also ensure client record exists in clients
      await sb.from("clients").upsert({
        name: requestPayload.client_name,
        email: requestPayload.client_email,
        phone: requestPayload.client_phone,
        service: requestPayload.service,
        protocol: requestPayload.protocol,
        current_step: "Análise Inicial de Solicitação",
        active: true,
        created_at: new Date().toISOString()
      }, { onConflict: "protocol" });
    }

    sendEmailNotification({
      to: requestPayload.client_email,
      subject: `Solicitação Recebida com Sucesso - Protocolo ${protocol}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #1e3a8a;">Sua Solicitação foi Registrada!</h2>
          <p>Prezado(a) <strong>${requestPayload.client_name}</strong>,</p>
          <p>Sua solicitação de recurso para <strong>${requestPayload.service}</strong> foi cadastrada com sucesso em nosso sistema.</p>
          <p><strong>Número de Protocolo:</strong> <span style="background: #e0e7ff; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: #1e3a8a;">${protocol}</span></p>
          <p>Você pode acompanhar o andamento da sua solicitação utilizando este protocolo no nosso site.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">SP Assessoria de Recursos Administrativos</p>
        </div>
      `,
      relatedResource: "request",
      relatedResourceId: protocol
    }).catch(console.error);

    await logAuditAction(undefined, "create_request", "requests", protocol, { service: requestPayload.service });

    res.json({
      success: true,
      protocol,
      message: "Solicitação registrada com sucesso.",
      solicitacao: requestPayload
    });
  } catch (err) {
    console.error("[Solicitações Error]", err);
    res.status(500).json({
      success: false,
      error: "Erro ao processar solicitação.",
      code: "REQUEST_CREATION_FAILED"
    });
  }
});

// POST /api/admin/login - Supabase Auth Login (Requirement 10 & 11)
app.post("/api/admin/login", rateLimiter(60000, 10), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "E-mail e senha são obrigatórios.",
        code: "INVALID_CREDENTIALS"
      });
    }

    const normEmail = String(email).trim().toLowerCase();
    const normPassword = String(password);

    const sb = getServerSupabaseClient();
    if (!sb) {
      return res.status(500).json({
        success: false,
        error: "Serviço de autenticação Supabase não configurado.",
        code: "SUPABASE_NOT_CONFIGURED"
      });
    }

    const { data, error } = await sb.auth.signInWithPassword({
      email: normEmail,
      password: normPassword
    });

    if (error || !data.session || !data.user) {
      return res.status(401).json({
        success: false,
        error: error?.message || "E-mail ou senha incorretos.",
        code: "AUTH_FAILED"
      });
    }

    const uid = data.user.id;
    const { data: profile } = await sb
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    if (profile && profile.active === false) {
      return res.status(403).json({
        success: false,
        error: "Acesso negado: Conta inativa.",
        code: "ACCOUNT_INACTIVE"
      });
    }

    const userRole = profile?.role || "cliente";
    const displayName = profile?.display_name || normEmail.split("@")[0];

    await logAuditAction(uid, "login_success", "auth", uid, { email: normEmail, role: userRole });

    res.json({
      success: true,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: uid,
        email: normEmail,
        role: userRole,
        displayName
      },
      profile: {
        email: normEmail,
        role: userRole,
        active: profile ? profile.active !== false : true,
        displayName
      }
    });
  } catch (err) {
    console.error("[Login Error]", err);
    res.status(500).json({
      success: false,
      error: "Erro no processo de autenticação.",
      code: "LOGIN_FAILED"
    });
  }
});

// GET /api/admin/profile
app.get("/api/admin/profile", requireAuth, async (req: AuthenticatedRequest, res) => {
  res.json({
    uid: req.user?.uid,
    email: req.user?.email,
    role: req.user?.role,
    active: req.user?.active
  });
});

// GET /api/admin/leads
app.get("/api/admin/leads", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente", "consulta"]), async (req: AuthenticatedRequest, res) => {
  try {
    const sb = getServerSupabaseClient();
    if (sb) {
      const { data: sbLeads, error } = await sb.from("leads").select("*").order("created_at", { ascending: false });
      if (!error && sbLeads) {
        return res.json(sbLeads);
      }
    }
  } catch (err) {
    console.warn("[Leads Notice] Error loading leads from Supabase, using backup file:", err);
  }

  const backupLeads = readLeadsBackup();
  res.json(backupLeads);
});

// POST /api/admin/leads/update-stage
app.post("/api/admin/leads/update-stage", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id, stage, status } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: "ID do lead é obrigatório." });
    }

    const sb = getServerSupabaseClient();
    if (sb) {
      await sb.from("leads").update({
        stage: stage || undefined,
        status: status || undefined,
        updated_at: new Date().toISOString()
      }).eq("id", id);
    }

    await logAuditAction(req.user?.uid, "update_lead_stage", "leads", String(id), { stage, status });
    res.json({ success: true, message: "Estágio do lead atualizado." });
  } catch (err) {
    console.error("[Lead Update Error]", err);
    res.status(500).json({ success: false, error: "Erro ao atualizar lead." });
  }
});

// POST /api/admin/leads/convert-to-client
app.post("/api/admin/leads/convert-to-client", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id, name, email, phone, service, cpf } = req.body;

    const sb = getServerSupabaseClient();
    if (sb) {
      const clientProtocol = generateProtocolString();
      await sb.from("clients").insert({
        name: name || "Novo Cliente",
        email: email || "",
        phone: phone || "",
        service: service || "Geral",
        protocol: clientProtocol,
        cpf_encrypted: cpf || null,
        active: true,
        created_at: new Date().toISOString()
      });

      if (id) {
        await sb.from("leads").update({ status: "convertido", stage: "ganho" }).eq("id", id);
      }
    }

    await logAuditAction(req.user?.uid, "convert_lead_to_client", "clients", String(id), { name, email });
    res.json({ success: true, message: "Lead convertido em cliente com sucesso." });
  } catch (err) {
    console.error("[Lead Convert Error]", err);
    res.status(500).json({ success: false, error: "Erro ao converter lead em cliente." });
  }
});

// DELETE /api/admin/leads/:id
app.delete("/api/admin/leads/:id", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const sb = getServerSupabaseClient();
    if (sb) {
      await sb.from("leads").delete().eq("id", id);
    }

    await logAuditAction(req.user?.uid, "delete_lead", "leads", String(id));
    res.json({ success: true, message: "Lead excluído." });
  } catch (err) {
    console.error("[Lead Delete Error]", err);
    res.status(500).json({ success: false, error: "Erro ao excluir lead." });
  }
});

// GET /api/admin/clients
app.get("/api/admin/clients", requireAuth, requireRole(["admin", "gestor", "atendente", "consulta"]), async (req: AuthenticatedRequest, res) => {
  try {
    const sb = getServerSupabaseClient();
    if (sb) {
      const { data: sbClients, error } = await sb.from("clients").select("*").order("created_at", { ascending: false });
      if (!error && sbClients) {
        return res.json(sbClients);
      }
    }
  } catch (err) {
    console.warn("[Clients Notice] Error fetching clients from Supabase, using backup file:", err);
  }

  const localClients = readClientsDataFile();
  res.json(localClients);
});

// POST /api/admin/clients
app.post("/api/admin/clients", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), async (req: AuthenticatedRequest, res) => {
  try {
    const clientData = req.body;
    if (!clientData || !clientData.name) {
      return res.status(400).json({ success: false, error: "Nome do cliente é obrigatório." });
    }

    const sb = getServerSupabaseClient();
    if (sb) {
      await sb.from("clients").upsert({
        id: clientData.id || undefined,
        name: clientData.name,
        email: clientData.email || "",
        phone: clientData.phone || "",
        service: clientData.service || "Geral",
        protocol: clientData.protocol || generateProtocolString(),
        current_step: clientData.currentStep || "Em Análise",
        order_info: clientData.orderInfo || "",
        active: clientData.active !== false,
        updated_at: new Date().toISOString()
      });
    }

    await logAuditAction(req.user?.uid, "upsert_client", "clients", clientData.id, { name: clientData.name });
    res.json({ success: true, message: "Cliente salvo com sucesso." });
  } catch (err) {
    console.error("[Clients Error]", err);
    res.status(500).json({ success: false, error: "Erro ao salvar cliente." });
  }
});

// DELETE /api/admin/clients/:id
app.delete("/api/admin/clients/:id", requireAuth, requireRole(["admin", "gestor", "supervisor", "analista", "atendente"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const sb = getServerSupabaseClient();
    if (sb) {
      await sb.from("clients").delete().eq("id", id);
    }

    await logAuditAction(req.user?.uid, "delete_client", "clients", String(id));
    res.json({ success: true, message: "Cliente removido com sucesso." });
  } catch (err) {
    console.error("[Client Delete Error]", err);
    res.status(500).json({ success: false, error: "Erro ao excluir cliente." });
  }
});

// POST /api/processes/lookup - Secure Public Process Lookup (Requirement 22)
app.post("/api/processes/lookup", rateLimiter(60000, 15), async (req, res) => {
  try {
    const { protocol } = req.body;
    if (!protocol || typeof protocol !== "string") {
      return res.status(400).json({
        success: false,
        error: "Informe o número de protocolo.",
        code: "PROTOCOL_REQUIRED"
      });
    }

    const cleanProtocol = String(protocol).trim().toUpperCase();
    const sb = getServerSupabaseClient();

    let foundItem: any = null;

    if (sb) {
      // 1. Search in requests
      const { data: reqData } = await sb
        .from("requests")
        .select("protocol, service, status, priority, client_name, client_email, client_phone, created_at, updated_at")
        .eq("protocol", cleanProtocol)
        .single();

      if (reqData) {
        foundItem = {
          protocol: reqData.protocol,
          service: reqData.service,
          status: reqData.status,
          currentStep: reqData.status,
          lastUpdate: reqData.updated_at ? new Date(reqData.updated_at).toLocaleDateString("pt-BR") : "",
          maskedEmail: maskEmail(reqData.client_email),
          maskedPhone: maskPhone(reqData.client_phone),
          timeline: [
            {
              title: "Solicitação Recebida",
              date: reqData.created_at ? new Date(reqData.created_at).toLocaleDateString("pt-BR") : "",
              status: "completed"
            },
            {
              title: reqData.status,
              date: reqData.updated_at ? new Date(reqData.updated_at).toLocaleDateString("pt-BR") : "",
              status: "current"
            }
          ]
        };
      } else {
        // 2. Search in clients
        const { data: clientData } = await sb
          .from("clients")
          .select("protocol, service, current_step, last_update, order_info, email, phone, created_at, updated_at")
          .eq("protocol", cleanProtocol)
          .single();

        if (clientData) {
          foundItem = {
            protocol: clientData.protocol,
            service: clientData.service,
            status: clientData.current_step || "Em Andamento",
            currentStep: clientData.current_step || "Em Análise",
            lastUpdate: clientData.last_update || (clientData.updated_at ? new Date(clientData.updated_at).toLocaleDateString("pt-BR") : ""),
            maskedEmail: maskEmail(clientData.email),
            maskedPhone: maskPhone(clientData.phone),
            timeline: [
              {
                title: "Início do Processo",
                date: clientData.created_at ? new Date(clientData.created_at).toLocaleDateString("pt-BR") : "",
                status: "completed"
              },
              {
                title: clientData.current_step || "Em Análise",
                date: clientData.updated_at ? new Date(clientData.updated_at).toLocaleDateString("pt-BR") : "",
                status: "current"
              }
            ]
          };
        }
      }
    }

    if (!foundItem) {
      return res.json({
        success: true,
        found: false,
        message: "Nenhum processo encontrado com o protocolo informado."
      });
    }

    res.json({
      success: true,
      found: true,
      process: foundItem
    });
  } catch (err) {
    console.error("[Process Lookup Error]", err);
    res.status(500).json({
      success: false,
      error: "Erro ao consultar processo.",
      code: "LOOKUP_FAILED"
    });
  }
});

// GET /api/tracking (Legacy query support)
app.get("/api/tracking", rateLimiter(60000, 15), async (req, res) => {
  try {
    const code = req.query.code;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Informe o número de protocolo." });
    }

    const cleanQuery = code.trim().toUpperCase();
    const sb = getServerSupabaseClient();

    if (sb) {
      const { data: clientData } = await sb
        .from("clients")
        .select("protocol, service, current_step, last_update, order_info, email, phone, created_at, updated_at")
        .eq("protocol", cleanQuery)
        .single();

      if (clientData) {
        return res.json([{
          protocol: clientData.protocol,
          service: clientData.service,
          currentStep: clientData.current_step || "Em Análise",
          lastUpdate: clientData.last_update || "",
          orderInfo: clientData.order_info || "",
          maskedEmail: maskEmail(clientData.email),
          maskedPhone: maskPhone(clientData.phone)
        }]);
      }
    }

    res.json([]);
  } catch (err) {
    console.error("[Tracking Error]", err);
    res.json([]);
  }
});

// POST /api/send-email (Transaction Email Proxy)
app.post("/api/send-email", rateLimiter(60000, 10), async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;
    if (!to || !subject || !html) {
      return res.status(400).json({ success: false, error: "Parâmetros para envio de e-mail incompletos." });
    }

    const result = await sendEmailNotification({ to, subject, html, text });
    if (result.success) {
      return res.json({ success: true, message: "E-mail enviado com sucesso." });
    } else {
      return res.status(500).json({ success: false, error: result.error || "Falha no envio do e-mail." });
    }
  } catch (err) {
    console.error("[Send Email Error]", err);
    res.status(500).json({ success: false, error: "Erro no serviço de e-mail." });
  }
});

// POST /api/chat - Gemini API Proxy Route (Requirement 32)
app.post("/api/chat", rateLimiter(60000, 10), async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, error: "Mensagem é obrigatória." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: "Assistente virtual temporariamente indisponível.",
        code: "GEMINI_NOT_CONFIGURED"
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `Você é o assistente virtual oficial da SP Assessoria de Recursos Administrativos (sprecursosadm.com.br). Atenda com tom profissional, cortês, claro e conciso sobre nossos serviços de recursos administrativos de trânsito e previdenciários.`;

    const contents = [];
    if (Array.isArray(conversationHistory)) {
      for (const turn of conversationHistory.slice(-6)) {
        contents.push({
          role: turn.role === "assistant" ? "model" : "user",
          parts: [{ text: String(turn.content || "") }]
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: String(message) }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 800
      }
    });

    const replyText = response.text || "Desculpe, não consegui processar sua resposta no momento.";
    res.json({ success: true, reply: replyText });
  } catch (err) {
    console.error("[Gemini Chat Error]", err);
    res.status(500).json({ success: false, error: "Erro ao comunicar com o assistente virtual." });
  }
});

// --------------------------------------------------------------------------
// VITE SPA DEVELOPMENT MIDDLEWARE AND PRODUCTION STATIC SERVING
// --------------------------------------------------------------------------
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }
}

setupViteOrStatic().catch(console.error);

// --------------------------------------------------------------------------
// GLOBAL ERROR HANDLER (Requirement 30)
// --------------------------------------------------------------------------
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Uncaught Express Error]", err);
  res.status(500).json({
    success: false,
    error: "Erro interno ao processar a solicitação.",
    code: "INTERNAL_SERVER_ERROR"
  });
});

// --------------------------------------------------------------------------
// SERVER LISTEN (Development local mode only)
// --------------------------------------------------------------------------
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SP Assessoria Server] Executando na porta ${PORT}`);
  });
}

export default app;
export { app };
