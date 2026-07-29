import React, { useState, useEffect } from "react";
import { getSupabaseClient } from "../lib/supabase";
import { 
  setWorkspaceToken, 
  getWorkspaceToken, 
  clearWorkspaceToken, 
  isWorkspaceConnected,
  createLeadsSpreadsheet,
  syncLeadsToSpreadsheet,
  createLeadDriveFolder,
  listFolderFiles,
  uploadFileToFolder,
  sendGmailReply,
  createGoogleTask,
  DriveFile
} from "../lib/workspace";
import { 
  Lock, 
  User, 
  X, 
  Settings, 
  FileText, 
  HelpCircle, 
  Users, 
  Check, 
  Trash2, 
  Edit, 
  Plus, 
  Save, 
  Search,
  LogOut, 
  Briefcase, 
  Award, 
  Phone, 
  Shield, 
  MessageSquare,
  Star,
  Eye,
  EyeOff,
  RefreshCw,
  TrendingUp,
  Mail,
  MapPin,
  Calendar,
  Upload,
  Image as ImageIcon,
  FolderOpen,
  FileSpreadsheet,
  CheckSquare,
  Send,
  FolderPlus,
  Folder,
  ExternalLink,
  FileUp,
  Database,
  Copy,
  Server,
  Info,
  Download,
  Paperclip,
  Maximize2,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Kanban,
  List,
  UserPlus,
  UserCheck,
  ChevronRight,
  ArrowRight,
  Filter,
  Clock,
  FileCheck,
  PauseCircle,
  Archive,
  CreditCard
} from "lucide-react";

const SUPABASE_SQL_SCRIPT = `-- =========================================================================
-- SCRIPT SQL PARA O SUPABASE - SP ASSESSORIA RECURSOS ADMINISTRATIVOS
-- Copie e cole este código diretamente no SQL Editor do seu Supabase
-- (https://supabase.com/dashboard/project/_/sql)
-- =========================================================================

-- 1. TABELA DE LEADS / CONSULTAS
CREATE TABLE IF NOT EXISTS public.leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    service TEXT,
    protocol TEXT UNIQUE,
    status TEXT DEFAULT 'Novo',
    notes TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE CLIENTES E PROCESSOS
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    protocol TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    cpf TEXT,
    email TEXT,
    phone TEXT,
    service TEXT,
    status TEXT DEFAULT 'novo',
    current_step TEXT,
    step_percentage INT DEFAULT 0,
    last_update TEXT,
    order_info TEXT,
    documents JSONB DEFAULT '[]'::jsonb,
    timeline JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE CONFIGURAÇÕES E DADOS DO SITE
CREATE TABLE IF NOT EXISTS public.site_data (
    id TEXT PRIMARY KEY DEFAULT 'main',
    company_name TEXT,
    phone TEXT,
    email TEXT,
    hero JSONB,
    services JSONB,
    faqs JSONB,
    blog JSONB,
    reviews JSONB,
    config JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA DE REGISTRO DE E-MAILS (AUDITORIA)
CREATE TABLE IF NOT EXISTS public.sent_emails (
    id TEXT PRIMARY KEY,
    recipient TEXT NOT NULL,
    protocol TEXT,
    client_name TEXT,
    service TEXT,
    status TEXT,
    subject TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- ATIVAÇÃO E CONFIGURAÇÃO DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- =========================================================================

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leads public insert" ON public.leads;
DROP POLICY IF EXISTS "Leads public select" ON public.leads;
DROP POLICY IF EXISTS "Leads public update" ON public.leads;
DROP POLICY IF EXISTS "Leads public delete" ON public.leads;

DROP POLICY IF EXISTS "Clients public select" ON public.clients;
DROP POLICY IF EXISTS "Clients public insert" ON public.clients;
DROP POLICY IF EXISTS "Clients public update" ON public.clients;
DROP POLICY IF EXISTS "Clients public delete" ON public.clients;

DROP POLICY IF EXISTS "Site Data public select" ON public.site_data;
DROP POLICY IF EXISTS "Site Data public write" ON public.site_data;

DROP POLICY IF EXISTS "Sent Emails public write" ON public.sent_emails;

CREATE POLICY "Leads public insert" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Leads public select" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Leads public update" ON public.leads FOR UPDATE USING (true);
CREATE POLICY "Leads public delete" ON public.leads FOR DELETE USING (true);

CREATE POLICY "Clients public select" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Clients public insert" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Clients public update" ON public.clients FOR UPDATE USING (true);
CREATE POLICY "Clients public delete" ON public.clients FOR DELETE USING (true);

CREATE POLICY "Site Data public select" ON public.site_data FOR SELECT USING (true);
CREATE POLICY "Site Data public write" ON public.site_data FOR ALL USING (true);

CREATE POLICY "Sent Emails public write" ON public.sent_emails FOR ALL USING (true);

-- BUCKET DE ARMAZENAMENTO PARA DOCUMENTOS DO CLIENTE
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public uploads to documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public view documents" ON storage.objects;

CREATE POLICY "Allow public uploads to documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Allow public view documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
`;

export interface DocumentAttachment {
  name: string;
  url: string;
  type?: string;
  size?: number;
  uploadedAt?: string;
}

export function normalizeDocItem(docItem: any): DocumentAttachment {
  if (!docItem) return { name: "Documento Sem Nome", url: "" };
  if (typeof docItem === "string") {
    if (docItem.startsWith("http://") || docItem.startsWith("https://") || docItem.startsWith("data:")) {
      const fileName = docItem.split("/").pop()?.split("?")[0] || "Arquivo_Anexo";
      return { name: decodeURIComponent(fileName), url: docItem };
    }
    return { name: docItem, url: "" };
  }
  return {
    name: docItem.name || "Documento",
    url: docItem.url || "",
    type: docItem.type || "",
    size: docItem.size,
    uploadedAt: docItem.uploadedAt || docItem.date
  };
}

export function getDocType(name: string, type?: string) {
  const ext = (name || "").split(".").pop()?.toLowerCase() || "";
  const mime = (type || "").toLowerCase();

  if (ext === "pdf" || mime.includes("pdf")) return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext) || mime.startsWith("image/")) return "image";
  if (["doc", "docx"].includes(ext) || mime.includes("word") || mime.includes("officedocument")) return "word";
  if (["xls", "xlsx", "csv"].includes(ext) || mime.includes("excel") || mime.includes("spreadsheet")) return "excel";
  if (ext === "txt" || mime.includes("text")) return "txt";
  return "file";
}

const CRM_STAGES = [
  { 
    id: "Atendimento Inicial", 
    label: "Atendimento Inicial", 
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300", 
    headerBg: "bg-amber-500", 
    borderTop: "border-t-amber-500" 
  },
  { 
    id: "Atendimento Iniciado", 
    label: "Atendimento Iniciado", 
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300", 
    headerBg: "bg-blue-600", 
    borderTop: "border-t-blue-600" 
  },
  { 
    id: "Documentação", 
    label: "Documentação", 
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300", 
    headerBg: "bg-purple-600", 
    borderTop: "border-t-purple-600" 
  },
  { 
    id: "Validação Documentos", 
    label: "Validação Documentos", 
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-300", 
    headerBg: "bg-indigo-600", 
    borderTop: "border-t-indigo-600" 
  },
  { 
    id: "Contrato", 
    label: "Contrato", 
    badgeColor: "bg-cyan-100 text-cyan-800 border-cyan-300", 
    headerBg: "bg-cyan-600", 
    borderTop: "border-t-cyan-600" 
  },
  { 
    id: "Assinaturas", 
    label: "Assinaturas", 
    badgeColor: "bg-teal-100 text-teal-800 border-teal-300", 
    headerBg: "bg-teal-600", 
    borderTop: "border-t-teal-600" 
  },
  { 
    id: "Documentação Gerada", 
    label: "Documentação Gerada", 
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300", 
    headerBg: "bg-emerald-600", 
    borderTop: "border-t-emerald-600" 
  },
  { 
    id: "Pagamento", 
    label: "Pagamento", 
    badgeColor: "bg-green-100 text-green-800 border-green-300", 
    headerBg: "bg-green-600", 
    borderTop: "border-t-green-600" 
  },
  { 
    id: "Guardar Pedido", 
    label: "Guardar Pedido (Pausado)", 
    badgeColor: "bg-orange-100 text-orange-800 border-orange-300", 
    headerBg: "bg-orange-500", 
    borderTop: "border-t-orange-500" 
  },
  { 
    id: "Concluído", 
    label: "Concluído (Arquivado)", 
    badgeColor: "bg-slate-200 text-slate-800 border-slate-300", 
    headerBg: "bg-slate-600", 
    borderTop: "border-t-slate-600" 
  }
];

const CRM_EMPLOYEES = [
  "Shafira Nunes",
  "Pablo Gabriel"
];

const getLeadStage = (lead: any): string => {
  if (lead.stage) return lead.stage;
  if (lead.status === "Concluído" || lead.status === "concluido" || lead.status === "Concluido") return "Concluído";
  if (lead.status === "Novo" || lead.status === "novo") return "Atendimento Inicial";
  if (lead.status === "Em Atendimento") return "Atendimento Iniciado";
  if (lead.status === "Cliente Cadastrado") return "Documentação Gerada";
  return "Atendimento Inicial";
};

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  siteData: any;
  onDataUpdate: (newData: any) => void;
}

export function AdminDashboard({ isOpen, onClose, siteData, onDataUpdate }: AdminDashboardProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string>("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<"leads" | "clients" | "blog" | "services" | "faqs" | "config" | "google" | "reviews" | "supabase">("leads");

  // CRM Kanban States
  const [crmViewMode, setCrmViewMode] = useState<"kanban" | "table">("kanban");
  const [crmSearch, setCrmSearch] = useState("");
  const [crmFilterEmployee, setCrmFilterEmployee] = useState("Todos");
  const [crmFilterService, setCrmFilterService] = useState("Todos");
  const [crmShowArchived, setCrmShowArchived] = useState<boolean>(false);

  // Guardar Pedido (Pause Reason) Modal States
  const [pauseModalLead, setPauseModalLead] = useState<any | null>(null);
  const [pauseModalReasons, setPauseModalReasons] = useState<string[]>([]);
  const [pauseModalOtherText, setPauseModalOtherText] = useState<string>("");

  // Lead Conversion & Update States
  const [convertModalLead, setConvertModalLead] = useState<any | null>(null);
  const [convertCpf, setConvertCpf] = useState("");
  const [convertName, setConvertName] = useState("");
  const [convertPhone, setConvertPhone] = useState("");
  const [convertEmail, setConvertEmail] = useState("");
  const [convertService, setConvertService] = useState("");
  const [convertStage, setConvertStage] = useState("Atendimento Inicial");
  const [convertAssignedTo, setConvertAssignedTo] = useState("Shafira Nunes");
  const [convertNotes, setConvertNotes] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [leadDetailModal, setLeadDetailModal] = useState<any | null>(null);

  // Document Management States
  const [uploadingDocStatus, setUploadingDocStatus] = useState<string | null>(null);
  const [previewingDoc, setPreviewingDoc] = useState<DocumentAttachment | null>(null);
  const [viewingClientDocsModal, setViewingClientDocsModal] = useState<any | null>(null);
  
  // Supabase State Variables
  const [supabaseUrl, setSupabaseUrl] = useState<string>(localStorage.getItem("supabase_url") || "");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>(localStorage.getItem("supabase_anon_key") || "");
  const [supabaseServiceRoleKey, setSupabaseServiceRoleKey] = useState<string>(localStorage.getItem("supabase_service_role_key") || "");
  const [supabaseStatus, setSupabaseStatus] = useState<"idle" | "connected" | "warning" | "error">("idle");
  const [supabaseMessage, setSupabaseMessage] = useState<string>("");
  const [savingSupabase, setSavingSupabase] = useState<boolean>(false);
  const [testingSupabase, setTestingSupabase] = useState<boolean>(false);
  const [syncingSupabase, setSyncingSupabase] = useState<boolean>(false);
  const [sqlCopied, setSqlCopied] = useState<boolean>(false);
  
  // Google Workspace state variables
  const [isGoogleConnected, setIsGoogleConnected] = useState(isWorkspaceConnected());
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(localStorage.getItem("sp_session_email") || null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(localStorage.getItem("sp_leads_spreadsheet_id") ? `https://docs.google.com/spreadsheets/d/${localStorage.getItem("sp_leads_spreadsheet_id")}/edit` : "");
  const [syncingSheets, setSyncingSheets] = useState(false);
  
  // Drive States
  const [creatingFolderLeadId, setCreatingFolderLeadId] = useState<string | null>(null);
  const [activeDriveLead, setActiveDriveLead] = useState<any | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);
  const [uploadingToDrive, setUploadingToDrive] = useState(false);
  const driveFileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Gmail States
  const [emailModalLead, setEmailModalLead] = useState<any | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState("recebimento");
  
  // Google Tasks States
  const [taskModalLead, setTaskModalLead] = useState<any | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  // Local editable copies of data
  const [localLeads, setLocalLeads] = useState<any[]>([]);
  const [localBlog, setLocalBlog] = useState<any[]>([]);
  const [localFaqs, setLocalFaqs] = useState<any[]>([]);
  const [localServices, setLocalServices] = useState<any>({});
  const [localConfig, setLocalConfig] = useState<any>({});
  const [localReviews, setLocalReviews] = useState<any[]>([]);
  const [localClients, setLocalClients] = useState<any[]>([]);

  // Clients state variables
  const [searchCpf, setSearchCpf] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("Todos");
  const [filterService, setFilterService] = useState<string>("Todos");
  const [filterPeriod, setFilterPeriod] = useState<string>("Todos");
  const [filterResponsible, setFilterResponsible] = useState<string>("Todos");
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);

  const getAuthToken = async (): Promise<string> => {
    try {
      const sb = getSupabaseClient();
      if (sb) {
        const { data } = await sb.auth.getSession();
        if (data?.session?.access_token) {
          return data.session.access_token;
        }
      }
    } catch (_e) {}
    return localStorage.getItem("sp_session_token") || "";
  };
  
  // Edit forms states
  const [newDocInput, setNewDocInput] = useState("");
  const [newTimelineItem, setNewTimelineItem] = useState({ title: "", date: "", description: "", status: "pending" as "completed" | "current" | "pending" });
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [editingFaq, setEditingFaq] = useState<any | null>(null);
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [showNewFaqForm, setShowNewFaqForm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        processImageFile(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        
        // Compress to max width 1000px for sharp but lightweight display
        const MAX_WIDTH = 1000;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress slightly to keep payload small for local/db storage
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
          setEditingPost((prev: any) => ({ ...prev, imageUrl: compressedDataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Populate local states when siteData loads
  useEffect(() => {
    if (siteData) {
      setLocalLeads(siteData.leads || []);
      setLocalBlog(siteData.blogPosts || []);
      setLocalFaqs(siteData.faqs || []);
      setLocalServices(siteData.services || {});
      setLocalConfig(siteData.siteConfig || {});
      setLocalReviews(siteData.reviews || []);
    }
  }, [siteData]);

  const fetchClients = async (token: string) => {
    try {
      setLoadingClients(true);
      const response = await fetch("/api/admin/clients", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setLocalClients(data);
      } else {
        console.warn("Erro ao carregar lista de clientes do servidor (status " + response.status + ")");
      }
    } catch (err) {
      console.warn("Erro de conexão ao buscar clientes:", err);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchLeads = async (token: string) => {
    try {
      const response = await fetch("/api/admin/leads", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setLocalLeads(data);
      } else {
        console.warn("Erro ao carregar leads do servidor (status " + response.status + ")");
      }
      
      // Concurrently fetch registered tracking clients
      await fetchClients(token);
    } catch (err) {
      console.warn("Erro de conexão ao buscar dados administrativos:", err);
    }
  };

  const handleOpenPauseModal = (lead: any, pendingAssignedTo?: string) => {
    setPauseModalLead({
      ...lead,
      pendingAssignedTo: pendingAssignedTo || lead.assignedTo || "Shafira Nunes"
    });
    setPauseModalReasons(lead.pauseReasons || []);
    setPauseModalOtherText(lead.pauseOtherReason || "");
  };

  const handleConfirmPauseReasons = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pauseModalLead) return;

    handleUpdateLeadStage(
      pauseModalLead.id,
      "Guardar Pedido",
      pauseModalLead.pendingAssignedTo || pauseModalLead.assignedTo || "Shafira Nunes",
      pauseModalLead.notes,
      pauseModalReasons,
      pauseModalOtherText.trim()
    );

    setPauseModalLead(null);
  };

  const handleUpdateLeadStage = async (
    leadId: string, 
    newStage: string, 
    assignedTo?: string, 
    notes?: string,
    pauseReasons?: string[],
    pauseOtherReason?: string
  ) => {
    try {
      // If moving to Guardar Pedido and no reasons were passed yet, prompt the pause modal
      if (newStage === "Guardar Pedido" && pauseReasons === undefined) {
        const targetLead = localLeads.find(l => l.id === leadId || (l.protocol && l.protocol === leadId));
        if (targetLead) {
          handleOpenPauseModal(targetLead, assignedTo);
          return;
        }
      }

      setIsUpdatingStage(true);
      const token = await getAuthToken();

      // Optimistically update localLeads
      setLocalLeads(prev => prev.map(l => {
        if (l.id === leadId || (l.protocol && l.protocol === leadId)) {
          return {
            ...l,
            stage: newStage,
            status: newStage,
            assignedTo: assignedTo !== undefined ? assignedTo : (l.assignedTo || "Shafira Nunes"),
            notes: notes !== undefined ? notes : l.notes,
            pauseReasons: pauseReasons !== undefined ? pauseReasons : l.pauseReasons,
            pauseOtherReason: pauseOtherReason !== undefined ? pauseOtherReason : l.pauseOtherReason
          };
        }
        return l;
      }));

      if (!token) return;

      await fetch("/api/admin/leads/update-stage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          id: leadId,
          stage: newStage,
          assignedTo: assignedTo !== undefined ? assignedTo : "Shafira Nunes",
          notes,
          pauseReasons,
          pauseOtherReason
        })
      });
    } catch (err) {
      console.error("Erro ao atualizar etapa do lead:", err);
    } finally {
      setIsUpdatingStage(false);
    }
  };

  const handleOpenConvertModal = (lead: any) => {
    setConvertModalLead(lead);
    setConvertName(lead.name || "");
    setConvertPhone(lead.phone || "");
    setConvertEmail(lead.email || "");
    setConvertService(lead.service || "Geral");
    setConvertStage(getLeadStage(lead));
    setConvertAssignedTo(lead.assignedTo || "Shafira Nunes");
    setConvertNotes(lead.message || lead.notes || "");
    
    // Set CPF if present and valid (11 digits, not equal to phone)
    const rawCpf = (lead.cpf || lead.clientCpf || "").replace(/\D/g, "");
    const phoneDigits = (lead.phone || "").replace(/\D/g, "");
    if (rawCpf && rawCpf.length === 11 && rawCpf !== phoneDigits) {
      setConvertCpf(rawCpf);
    } else {
      setConvertCpf("");
    }
  };

  const handleConfirmConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCpfDigits = convertCpf.replace(/\D/g, "");
    if (!cleanCpfDigits || cleanCpfDigits.length < 11) {
      alert("Por favor, informe um CPF válido de 11 dígitos para autorizar o cadastro do cliente.");
      return;
    }
    if (!convertName.trim()) {
      alert("Por favor, preencha o Nome do cliente.");
      return;
    }

    try {
      setIsConverting(true);
      const token = await getAuthToken();

      const response = await fetch("/api/admin/leads/convert-to-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          leadId: convertModalLead?.id,
          cpf: cleanCpfDigits,
          name: convertName,
          email: convertEmail,
          phone: convertPhone,
          service: convertService,
          stage: convertStage,
          assignedTo: convertAssignedTo,
          notes: convertNotes
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.client) {
          setLocalClients(prev => [data.client, ...prev.filter(c => c.id !== data.client.id)]);
          setLocalLeads(prev => prev.map(l => {
            if (l.id === convertModalLead?.id) {
              return {
                ...l,
                status: "Cliente Cadastrado",
                stage: convertStage,
                assignedTo: convertAssignedTo,
                convertedToClientId: data.client.id
              };
            }
            return l;
          }));
          setConvertModalLead(null);
          alert(`Cliente ${convertName} cadastrado com sucesso! Protocolo de acompanhamento: ${data.client.protocol}`);
        }
      } else {
        const errJson = await response.json();
        alert(errJson.error || "Erro ao converter lead em cliente.");
      }
    } catch (err) {
      console.error("Erro ao converter lead:", err);
      alert("Erro de comunicação com o servidor.");
    } finally {
      setIsConverting(false);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      const token = await getAuthToken();
      if (token) {
        await fetchLeads(token);
      }
    } catch (err) {
      console.error("Erro ao recarregar dados:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleLoadSupabaseConfig = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch("/api/admin/supabase-config", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) setSupabaseUrl(data.url);
        if (data.anonKey) setSupabaseAnonKey(data.anonKey);
        if (data.serviceRoleKey) setSupabaseServiceRoleKey(data.serviceRoleKey);
        if (data.configured) {
          setSupabaseStatus("connected");
          setSupabaseMessage("Configuração carregada. Servidor conectado ao Supabase!");
        }
      }
    } catch (err) {
      console.warn("Erro ao carregar configuração do Supabase:", err);
    }
  };

  const handleSaveSupabaseConfig = async () => {
    setSavingSupabase(true);
    setSupabaseMessage("");
    try {
      const token = await getAuthToken();
      if (supabaseUrl) localStorage.setItem("supabase_url", supabaseUrl.trim());
      if (supabaseAnonKey) localStorage.setItem("supabase_anon_key", supabaseAnonKey.trim());
      if (supabaseServiceRoleKey) localStorage.setItem("supabase_service_role_key", supabaseServiceRoleKey.trim());

      const res = await fetch("/api/admin/supabase-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          url: supabaseUrl.trim(),
          anonKey: supabaseAnonKey.trim(),
          serviceRoleKey: supabaseServiceRoleKey.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSupabaseStatus("connected");
        setSupabaseMessage(data.message || "Credenciais salvas e ativadas com sucesso!");
      } else {
        setSupabaseStatus("error");
        setSupabaseMessage(data.error || "Erro ao salvar credenciais.");
      }
    } catch (err: any) {
      setSupabaseStatus("error");
      setSupabaseMessage("Erro de rede ao salvar credenciais do Supabase.");
    } finally {
      setSavingSupabase(false);
    }
  };

  const handleTestSupabaseConnection = async () => {
    setTestingSupabase(true);
    setSupabaseMessage("");
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/supabase-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          url: supabaseUrl.trim(),
          key: supabaseServiceRoleKey.trim() || supabaseAnonKey.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.warning) {
          setSupabaseStatus("warning");
        } else {
          setSupabaseStatus("connected");
        }
        setSupabaseMessage(data.message || "Conexão com o Supabase testada com sucesso!");
      } else {
        setSupabaseStatus("error");
        setSupabaseMessage(data.error || "Falha ao testar conexão com o Supabase.");
      }
    } catch (err: any) {
      setSupabaseStatus("error");
      setSupabaseMessage("Erro de comunicação com o servidor durante o teste.");
    } finally {
      setTestingSupabase(false);
    }
  };

  const handleSyncSupabaseData = async () => {
    setSyncingSupabase(true);
    setSupabaseMessage("");
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/admin/supabase-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok) {
        setSupabaseStatus("connected");
        setSupabaseMessage(data.message || "Dados sincronizados com sucesso no Supabase!");
      } else {
        setSupabaseStatus("error");
        setSupabaseMessage(data.error || "Erro durante a sincronização dos dados.");
      }
    } catch (err: any) {
      setSupabaseStatus("error");
      setSupabaseMessage("Erro ao disparar sincronização com o Supabase.");
    } finally {
      setSyncingSupabase(false);
    }
  };

  const handleCopySqlScript = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  const handlePasswordReset = async () => {
    if (!username.trim()) {
      setLoginError("Por favor, digite seu e-mail no campo acima para receber o link de recuperação.");
      return;
    }
    setLoginError("");
    try {
      const sb = getSupabaseClient();
      if (sb) {
        const { error } = await sb.auth.resetPasswordForEmail(username.trim());
        if (error) throw error;
        setLoginError("Instruções de recuperação enviadas via Supabase! Verifique seu e-mail.");
      } else {
        setLoginError("Redefinição de senha ativada. Entre em contato com a administração do sistema para redefinir sua senha mestra.");
      }
    } catch (err: any) {
      console.error(err);
      setLoginError(err.message || "Erro ao solicitar redefinição de senha.");
    }
  };

  // Check login session
  useEffect(() => {
    setIsGoogleConnected(isWorkspaceConnected());

    const checkSession = async () => {
      const spToken = localStorage.getItem("sp_session_token");
      const spEmail = localStorage.getItem("sp_session_email") || "";

      if (spToken) {
        try {
          const response = await fetch("/api/admin/profile", {
            headers: {
              "Authorization": `Bearer ${spToken}`
            }
          });
          if (response.ok) {
            const profile = await response.json();
            setIsLoggedIn(true);
            setUserRole(profile.role || "admin");
            setGoogleUserEmail(profile.email || spEmail);
            fetchLeads(spToken);
            return;
          }
        } catch (err) {
          console.error("Erro ao verificar sessão de login:", err);
        }
      }
      setIsLoggedIn(false);
    };

    checkSession();
  }, []);

  // Automatic real-time data sync (every 5 seconds and on window focus)
  useEffect(() => {
    if (!isOpen || !isLoggedIn) return;

    const refreshDataSilently = async () => {
      try {
        const token = await getAuthToken();
        if (token) {
          await fetchLeads(token);
        }
      } catch (err) {
        // Silent catch for background auto-refresh
      }
    };

    refreshDataSilently();

    const intervalId = setInterval(refreshDataSilently, 5000);

    const handleFocus = () => {
      refreshDataSilently();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isOpen, isLoggedIn]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setLoginError("");
    try {
      const sb = getSupabaseClient();
      if (sb) {
        const { error } = await sb.auth.signInWithOAuth({ provider: 'google' });
        if (error) throw error;
      } else {
        setLoginError("Login do Google via Supabase não está configurado. Utilize o login por E-mail e Senha Mestra abaixo.");
      }
    } catch (err: any) {
      console.error("Erro na autenticação do Google:", err);
      setLoginError(err.message || "Erro ao conectar com o Google.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const normEmail = username.trim().toLowerCase();
    const normPassword = password.trim();

    if (!normEmail || !normPassword) {
      setLoginError("E-mail e senha são obrigatórios.");
      return;
    }

    try {
      const loginResponse = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normEmail, password: normPassword })
      });

      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        const idToken = loginData.token;
        const profile = loginData.profile;

        localStorage.setItem("sp_session_token", idToken);
        localStorage.setItem("sp_session_email", normEmail);

        setUserRole(profile.role || "admin");
        setIsLoggedIn(true);
        setGoogleUserEmail(profile.email || normEmail);
        setUsername("");
        setPassword("");

        fetchLeads(idToken);
      } else {
        const errData = await loginResponse.json().catch(() => ({}));
        setLoginError(errData.error || "E-mail ou senha incorretos.");
      }
    } catch (err: any) {
      console.error(err);
      setLoginError("Erro na autenticação com o servidor.");
    }
  };

  const handleLogout = async () => {
    clearWorkspaceToken();
    setIsGoogleConnected(false);
    setGoogleUserEmail(null);
    setIsLoggedIn(false);
    localStorage.removeItem("sp_session_token");
    localStorage.removeItem("sp_session_email");
    localStorage.removeItem("sp_session_token");
    try {
      const sb = getSupabaseClient();
      if (sb) await sb.auth.signOut();
    } catch (err) {
      console.warn("Erro ao deslogar do Supabase:", err);
    }
  };

  const persistDataOnServer = async (updatedData: any) => {
    try {
      setSaveError("");
      // Guard local storage first for resilience
      localStorage.setItem("sp_site_data", JSON.stringify(updatedData));
      
      const idToken = await getAuthToken();
      const response = await fetch("/api/site-data", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(updatedData)
      });
      
      if (response.ok) {
        onDataUpdate(updatedData);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        // Fallback succeeded (local)
        onDataUpdate(updatedData);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      // Fallback succeeded (local)
      onDataUpdate(updatedData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // LEAD ACTIONS
  const handleUpdateLeadStatus = (leadId: string, newStatus: string) => {
    const updatedLeads = localLeads.map(l => l.id === leadId ? { ...l, status: newStatus } : l);
    setLocalLeads(updatedLeads);
    const updatedData = { ...siteData, leads: updatedLeads };
    persistDataOnServer(updatedData);
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este lead/solicitação permanentemente?")) return;
    try {
      setSaveError("");
      const updatedLeads = localLeads.filter(l => l.id !== leadId && l.protocol !== leadId);
      setLocalLeads(updatedLeads);

      const token = await getAuthToken();
      const response = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao excluir lead no servidor.");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await fetchLeads(token);
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || "Erro de conexão ao excluir lead.");
    }
  };

  // GOOGLE WORKSPACE ACTION HANDLERS
  const handleCreateDriveFolder = async (leadId: string, leadName: string) => {
    try {
      setCreatingFolderLeadId(leadId);
      const folder = await createLeadDriveFolder(leadName, leadId);
      const updatedLeads = localLeads.map(l => l.id === leadId ? { ...l, driveFolderId: folder.id, driveFolderUrl: folder.url } : l);
      setLocalLeads(updatedLeads);
      const updatedData = { ...siteData, leads: updatedLeads };
      await persistDataOnServer(updatedData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setSaveError("Erro ao criar pasta no Drive: " + (err.message || String(err)));
      setTimeout(() => setSaveError(""), 5000);
    } finally {
      setCreatingFolderLeadId(null);
    }
  };

  const handleSyncSheets = async () => {
    try {
      setSyncingSheets(true);
      let sheetId = localStorage.getItem("sp_leads_spreadsheet_id");
      let url = spreadsheetUrl;
      if (!sheetId) {
        const result = await createLeadsSpreadsheet();
        sheetId = result.id;
        url = result.url;
        setSpreadsheetUrl(url);
      }
      
      const leadsForSheet = localLeads.map(l => ({
        id: l.id || "",
        name: l.name || "",
        phone: l.phone || "",
        email: l.email || "",
        service: l.service || "",
        message: l.message || "",
        date: l.date || "",
        status: l.status || "",
        type: l.type || ""
      }));

      await syncLeadsToSpreadsheet(sheetId, leadsForSheet);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setSaveError("Erro ao sincronizar com Google Planilhas: " + (err.message || String(err)));
      setTimeout(() => setSaveError(""), 5000);
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleLoadDriveFiles = async (lead: any) => {
    try {
      setActiveDriveLead(lead);
      setLoadingDriveFiles(true);
      setDriveFiles([]);
      const files = await listFolderFiles(lead.driveFolderId);
      setDriveFiles(files);
    } catch (err: any) {
      console.error(err);
      setSaveError("Erro ao carregar arquivos do Drive: " + (err.message || String(err)));
      setTimeout(() => setSaveError(""), 5000);
    } finally {
      setLoadingDriveFiles(false);
    }
  };

  const handleUploadToDrive = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeDriveLead || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setUploadingToDrive(true);
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (!event.target?.result) return;
        const base64Data = event.target.result as string;
        try {
          await uploadFileToFolder(activeDriveLead.driveFolderId, file.name, file.type, base64Data);
          // Reload file list
          const files = await listFolderFiles(activeDriveLead.driveFolderId);
          setDriveFiles(files);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
          console.error(err);
          setSaveError("Erro ao fazer upload do arquivo: " + (err.message || String(err)));
          setTimeout(() => setSaveError(""), 5000);
        } finally {
          setUploadingToDrive(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setSaveError("Erro ao ler arquivo para upload: " + (err.message || String(err)));
      setUploadingToDrive(false);
      setTimeout(() => setSaveError(""), 5000);
    }
  };

  const handleOpenGmailModal = (lead: any) => {
    setEmailModalLead(lead);
    setEmailTemplate("recebimento");
    // Default subject & body
    const subject = `Recebemos seu caso sobre ${lead.service} - SP Assessoria`;
    const body = `Olá <strong>${lead.name}</strong>,<br/><br/>Agradecemos o seu contato com a <strong>SP Assessoria de Recursos Administrativos</strong>.<br/><br/>Confirmamos o recebimento da sua solicitação referente a <strong>${lead.service}</strong>. Nossa equipe técnica de analistas já está avaliando as informações fornecidas.<br/><br/>Entraremos em contato via WhatsApp (<strong>${lead.phone}</strong>) nas próximas horas para dar continuidade ao seu atendimento.<br/><br/>Atenciosamente,<br/><strong>Equipe SP Assessoria de Recursos Administrativos</strong>`;
    setEmailSubject(subject);
    setEmailBody(body);
  };

  const handleEmailTemplateChange = (templateType: string, lead: any) => {
    setEmailTemplate(templateType);
    let subject = "";
    let body = "";
    
    if (templateType === "recebimento") {
      subject = `Recebemos seu caso sobre ${lead.service} - SP Assessoria`;
      body = `Olá <strong>${lead.name}</strong>,<br/><br/>Agradecemos o seu contato com a <strong>SP Assessoria de Recursos Administrativos</strong>.<br/><br/>Confirmamos o recebimento da sua solicitação referente a <strong>${lead.service}</strong>. Nossa equipe técnica de analistas já está avaliando as informações fornecidas.<br/><br/>Entraremos em contato via WhatsApp (<strong>${lead.phone}</strong>) nas próximas horas para dar continuidade ao seu atendimento.<br/><br/>Atenciosamente,<br/><strong>Equipe SP Assessoria de Recursos Administrativos</strong>`;
    } else if (templateType === "documentos") {
      subject = `Documentos necessários para análise de recurso - SP Assessoria`;
      body = `Olá <strong>${lead.name}</strong>,<br/><br/>Para darmos andamento ao recurso do seu caso sobre <strong>${lead.service}</strong>, precisamos que nos envie alguns documentos de suporte:<br/><br/>- Cópia da CNH (ou documento oficial com foto)<br/>- Cópia da Notificação de Autuação ou da Multa de Trânsito<br/>- Demais comprovantes relevantes para a defesa<br/><br/>Você pode nos enviar estes documentos respondendo a este e-mail, por WhatsApp ou, se preferir, carregando diretamente na sua pasta segura do Google Drive.<br/><br/>Atenciosamente,<br/><strong>Equipe SP Assessoria de Recursos Administrativos</strong>`;
    } else {
      subject = `Atualização de status do seu processo - SP Assessoria`;
      body = `Olá <strong>${lead.name}</strong>,<br/><br/>Gostaríamos de informar que o seu recurso referente a <strong>${lead.service}</strong> foi elaborado e protocolado com sucesso junto ao órgão responsável.<br/><br/>Seguiremos acompanhando o andamento do processo de julgamento e qualquer novidade informaremos imediatamente.<br/><br/>Atenciosamente,<br/><strong>Equipe SP Assessoria de Recursos Administrativos</strong>`;
    }
    
    setEmailSubject(subject);
    setEmailBody(body);
  };

  const handleSendEmail = async () => {
    if (!emailModalLead) return;
    try {
      setSendingEmail(true);
      await sendGmailReply(emailModalLead.email, emailSubject, emailBody);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setEmailModalLead(null);
    } catch (err: any) {
      console.error(err);
      setSaveError("Erro ao enviar e-mail: " + (err.message || String(err)));
      setTimeout(() => setSaveError(""), 5000);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleOpenTaskModal = (lead: any) => {
    setTaskModalLead(lead);
    setTaskTitle(`Retornar Lead: ${lead.name}`);
    setTaskNotes(`Retornar contato sobre assessoria em ${lead.service}.\nTelefone: ${lead.phone}\nE-mail: ${lead.email || "-"}`);
    setTaskDueDate(new Date(Date.now() + 86400000).toISOString().split("T")[0]); // tomorrow
  };

  const handleCreateTask = async () => {
    if (!taskModalLead) return;
    try {
      setCreatingTask(true);
      const isoDate = taskDueDate ? `${taskDueDate}T23:59:59Z` : undefined;
      await createGoogleTask(taskTitle, taskNotes, isoDate);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setTaskModalLead(null);
    } catch (err: any) {
      console.error(err);
      setSaveError("Erro ao agendar tarefa: " + (err.message || String(err)));
      setTimeout(() => setSaveError(""), 5000);
    } finally {
      setCreatingTask(false);
    }
  };

  // BLOG ACTIONS
  const handleSavePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost.title || !editingPost.content) return;

    let updatedBlog;
    if (showNewPostForm) {
      const newPost = {
        ...editingPost,
        id: `post-${Date.now()}`,
        date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }),
        readTime: editingPost.readTime || "5 min de leitura"
      };
      updatedBlog = [newPost, ...localBlog];
    } else {
      updatedBlog = localBlog.map(p => p.id === editingPost.id ? editingPost : p);
    }

    setLocalBlog(updatedBlog);
    setEditingPost(null);
    setShowNewPostForm(false);
    const updatedData = { ...siteData, blogPosts: updatedBlog };
    persistDataOnServer(updatedData);
  };

  const handleDeletePost = (postId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este artigo permanentemente?")) return;
    const updatedBlog = localBlog.filter(p => p.id !== postId);
    setLocalBlog(updatedBlog);
    const updatedData = { ...siteData, blogPosts: updatedBlog };
    persistDataOnServer(updatedData);
  };

  // FAQ ACTIONS
  const handleSaveFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq.question || !editingFaq.answer) return;

    let updatedFaqs;
    if (showNewFaqForm) {
      const newFaq = {
        ...editingFaq,
        id: `faq-${Date.now()}`
      };
      updatedFaqs = [...localFaqs, newFaq];
    } else {
      updatedFaqs = localFaqs.map(f => f.id === editingFaq.id ? editingFaq : f);
    }

    setLocalFaqs(updatedFaqs);
    setEditingFaq(null);
    setShowNewFaqForm(false);
    const updatedData = { ...siteData, faqs: updatedFaqs };
    persistDataOnServer(updatedData);
  };

  const handleDeleteFaq = (faqId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta dúvida permanentemente?")) return;
    const updatedFaqs = localFaqs.filter(f => f.id !== faqId);
    setLocalFaqs(updatedFaqs);
    const updatedData = { ...siteData, faqs: updatedFaqs };
    persistDataOnServer(updatedData);
  };

  // CONFIG ACTIONS
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedData = { ...siteData, siteConfig: localConfig };
    persistDataOnServer(updatedData);
  };

  // SERVICES ACTIONS
  const handleServiceChange = (key: string, field: string, value: any) => {
    const updatedServices = {
      ...localServices,
      [key]: {
        ...localServices[key],
        [field]: value
      }
    };
    setLocalServices(updatedServices);
  };

  const handleServiceItemChange = (key: string, itemIdx: number, val: string) => {
    const items = [...localServices[key].items];
    items[itemIdx] = val;
    handleServiceChange(key, "items", items);
  };

  const handleAddServiceItem = (key: string) => {
    const items = [...(localServices[key].items || []), "Novo serviço..."];
    handleServiceChange(key, "items", items);
  };

  const handleRemoveServiceItem = (key: string, itemIdx: number) => {
    const items = localServices[key].items.filter((_: any, idx: number) => idx !== itemIdx);
    handleServiceChange(key, "items", items);
  };

  const handleSaveServices = () => {
    const updatedData = { ...siteData, services: localServices };
    persistDataOnServer(updatedData);
  };

  // REVIEW HANDLERS
  const handleApproveReview = (reviewId: string) => {
    const updatedReviews = localReviews.map(r => r.id === reviewId ? { ...r, approved: true } : r);
    setLocalReviews(updatedReviews);
    const updatedData = { ...siteData, reviews: updatedReviews };
    persistDataOnServer(updatedData);
  };

  const handleDisapproveReview = (reviewId: string) => {
    const updatedReviews = localReviews.map(r => r.id === reviewId ? { ...r, approved: false } : r);
    setLocalReviews(updatedReviews);
    const updatedData = { ...siteData, reviews: updatedReviews };
    persistDataOnServer(updatedData);
  };

  const handleDeleteReview = (reviewId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta avaliação permanentemente?")) return;
    const updatedReviews = localReviews.filter(r => r.id !== reviewId);
    setLocalReviews(updatedReviews);
    const updatedData = { ...siteData, reviews: updatedReviews };
    persistDataOnServer(updatedData);
  };

  // ==========================================
  // CLIENT TRACKING MANAGEMENT HANDLERS
  // ==========================================

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    const cleanCpf = (editingClient.cpf || "").replace(/\D/g, "");
    if (!editingClient.name || !cleanCpf || !editingClient.phone || !editingClient.email) {
      setSaveError("Nome, CPF, WhatsApp e E-mail são obrigatórios.");
      return;
    }

    if (cleanCpf.length < 11) {
      setSaveError("O CPF do cliente deve conter exatamente 11 dígitos numéricos.");
      return;
    }

    const clientToSave = {
      ...editingClient,
      cpf: cleanCpf,
      id: `cli-${cleanCpf}`
    };

    try {
      setSaveError("");
      const idToken = await getAuthToken();
      const response = await fetch("/api/admin/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(clientToSave)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar cliente.");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Refresh clients list from server
      await fetchClients(idToken);
      setEditingClient(null);
      setShowNewClientForm(false);
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || "Erro de conexão ao salvar informações do cliente.");
    }
  };

  const handleUploadClientDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingClient) return;

    try {
      setUploadingDocStatus("Iniciando envio dos arquivos...");
      const uploadedDocs: DocumentAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadingDocStatus(`Enviando ${file.name} (${i + 1}/${files.length})...`);

        let downloadUrl = "";
        try {
          if (file.size <= 10 * 1024 * 1024) {
            downloadUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          }
        } catch (err) {
          console.warn("Processamento do arquivo falhou:", err);
        }

        uploadedDocs.push({
          name: file.name,
          url: downloadUrl,
          type: file.type || getDocType(file.name),
          size: file.size,
          uploadedAt: new Date().toLocaleDateString("pt-BR")
        });
      }

      const currentDocs = editingClient.documents || [];
      setEditingClient({
        ...editingClient,
        documents: [...currentDocs, ...uploadedDocs]
      });

      setUploadingDocStatus(null);
      e.target.value = "";
    } catch (err: any) {
      console.error("Erro no envio de documentos:", err);
      setUploadingDocStatus(null);
      alert("Não foi possível concluir o envio do documento. Tente novamente.");
    }
  };

  const handleAddManualDoc = () => {
    if (!newDocInput.trim() || !editingClient) return;
    const inputVal = newDocInput.trim();
    const currentDocs = editingClient.documents || [];
    
    let newDocObj: DocumentAttachment;
    if (inputVal.startsWith("http://") || inputVal.startsWith("https://")) {
      const fileName = inputVal.split("/").pop()?.split("?")[0] || "Link Externo";
      newDocObj = {
        name: decodeURIComponent(fileName),
        url: inputVal,
        uploadedAt: new Date().toLocaleDateString("pt-BR")
      };
    } else {
      newDocObj = {
        name: inputVal,
        url: "",
        uploadedAt: new Date().toLocaleDateString("pt-BR")
      };
    }

    setEditingClient({
      ...editingClient,
      documents: [...currentDocs, newDocObj]
    });
    setNewDocInput("");
  };

  const handleDeleteClient = async (cpf: string) => {
    if (!window.confirm("Tem certeza que deseja excluir o cadastro e todo o histórico deste cliente permanentemente?")) return;
    try {
      setSaveError("");
      const rawCpf = cpf;
      const cleanCpf = cpf.replace(/\D/g, "");
      setLocalClients(prev => prev.filter(c => {
        const cClean = (c.cpf || "").replace(/\D/g, "");
        return cClean !== cleanCpf && c.cpf !== rawCpf;
      }));

      const idToken = await getAuthToken();
      const response = await fetch(`/api/admin/clients/${encodeURIComponent(cpf)}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao excluir cliente.");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Refresh list
      await fetchClients(idToken);
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || "Erro de conexão ao excluir cliente.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div 
        id="admin-dashboard-container"
        className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] border border-gray-150"
      >
        
        {/* TOP BAR / HEADER */}
        <div className="bg-brand-navy-900 px-6 py-4 flex items-center justify-between text-white border-b border-brand-navy-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-gold-500/10 border border-brand-gold-500/30 flex items-center justify-center text-brand-gold-500">
              <Settings className="w-5 h-5" />
            </div>
            <div className="text-left">
              <span className="block text-xs uppercase tracking-widest text-brand-gold-500 font-mono font-bold">SP ASSESSORIA</span>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold font-display">Painel Administrativo Restrito</span>
                {isLoggedIn && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase border ${
                    userRole === "admin" || userRole === "administrador"
                      ? "bg-brand-gold-500/20 text-brand-gold-400 border-brand-gold-500/40"
                      : userRole === "atendente"
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                        : "bg-gray-500/20 text-gray-300 border-gray-500/40"
                  }`}>
                    {userRole === "admin" || userRole === "administrador" ? "Administrador" : userRole === "atendente" ? "Atendente" : "Consulta"}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isLoggedIn && (
              <>
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="px-3 py-1.5 bg-brand-gold-500 hover:bg-brand-gold-400 text-brand-navy-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  title="Atualizar dados de leads, orçamentos e clientes"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{isRefreshing ? "Atualizando..." : "Atualizar Dados"}</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-brand-navy-800 hover:bg-brand-navy-750 text-xs text-brand-gold-500 hover:text-brand-gold-400 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sair do Painel</span>
                </button>
              </>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-brand-navy-800 rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* NOT LOGGED IN - SHOW FORM */}
        {!isLoggedIn ? (
          <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-8 sm:p-16 min-h-[450px]">
            <div className="w-full max-w-md bg-white border border-gray-150 rounded-2xl p-8 shadow-lg text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-brand-gold-500/10 border border-brand-gold-500/20 flex items-center justify-center text-brand-gold-600">
                <Lock className="w-8 h-8" />
              </div>
              
              <div>
                <h3 className="text-xl font-display font-bold text-brand-navy-900">Acesso Restrito ao Gestor</h3>
                <p className="text-xs text-gray-500 mt-1">Insira suas credenciais administrativas para gerenciar o site.</p>
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-lg text-red-600 text-xs text-left">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider text-left mb-1">E-mail de Acesso</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-gray-450" />
                    <input
                      type="email"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ex: atendimento.spassessoria@gmail.com"
                      className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider text-left mb-1">Senha de Acesso</label>
                  <div className="relative font-sans">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-450" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                    />
                  </div>
                  <div className="text-right mt-1.5">
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      className="text-[10px] text-brand-gold-600 hover:text-brand-gold-700 font-bold hover:underline cursor-pointer"
                    >
                      Esqueceu sua senha? Recupere aqui
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-brand-navy-900 hover:bg-brand-navy-800 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  Entrar no Sistema
                </button>
              </form>

              <div className="relative my-4 flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-[10px] uppercase font-bold tracking-wider">ou</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3 bg-white hover:bg-gray-50 text-gray-750 font-bold text-xs rounded-lg border border-gray-250 transition-all cursor-pointer shadow-xs hover:shadow-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Entrar com o Google
              </button>
            </div>
          </div>
        ) : (
          /* LOGGED IN - ADMIN LAYOUT */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* SIDEBAR TABS */}
            <div className="w-full md:w-60 bg-[#fafafb] border-r border-gray-200 flex flex-col md:justify-between py-4">
              <div className="space-y-1 px-2">
                <button
                  onClick={() => { setActiveTab("leads"); setEditingPost(null); setEditingFaq(null); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "leads" 
                      ? "bg-brand-navy-900 text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Leads & Consultas</span>
                  {localLeads.filter(l => l.status === "Novo").length > 0 && (
                    <span className="ml-auto bg-red-500 text-white rounded-full text-[9px] w-4.5 h-4.5 flex items-center justify-center font-bold">
                      {localLeads.filter(l => l.status === "Novo").length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { setActiveTab("clients"); setEditingPost(null); setEditingFaq(null); setEditingClient(null); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "clients" 
                      ? "bg-brand-navy-900 text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900"
                  }`}
                >
                  <Folder className="w-4 h-4 text-brand-gold-500" />
                  <span>Clientes & Processos</span>
                </button>

                <button
                  onClick={() => { setActiveTab("blog"); setEditingPost(null); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "blog" 
                      ? "bg-brand-navy-900 text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Gerenciar Blog</span>
                </button>

                <button
                  onClick={() => { setActiveTab("services"); setEditingPost(null); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "services" 
                      ? "bg-brand-navy-900 text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900"
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Configurar Serviços</span>
                </button>

                <button
                  onClick={() => { setActiveTab("faqs"); setEditingFaq(null); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "faqs" 
                      ? "bg-brand-navy-900 text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900"
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Gerenciar FAQs</span>
                </button>

                <button
                  onClick={() => { setActiveTab("reviews"); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "reviews" 
                      ? "bg-brand-navy-900 text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900"
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>Gerenciar Avaliações</span>
                  {localReviews.filter((r: any) => r.approved === false).length > 0 && (
                    <span className="ml-auto bg-brand-gold-500 text-brand-navy-950 rounded-full text-[9px] w-4.5 h-4.5 flex items-center justify-center font-bold font-sans">
                      {localReviews.filter((r: any) => r.approved === false).length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { setActiveTab("config"); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "config" 
                      ? "bg-brand-navy-900 text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-brand-navy-900"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Configurações do Site</span>
                </button>


              </div>

              {/* STATS STRIP ON SIDEBAR */}
              <div className="hidden md:block p-4 mx-3 bg-[#e4e7eb]/40 border border-gray-200/50 rounded-xl space-y-2">
                <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-gray-400">Status do Banco</span>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Leads Ativos</span>
                  <strong className="text-brand-navy-900">{localLeads.length}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Artigos Blog</span>
                  <strong className="text-brand-navy-900">{localBlog.length}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">FAQs Cadastradas</span>
                  <strong className="text-brand-navy-900">{localFaqs.length}</strong>
                </div>
              </div>
            </div>

            {/* MAIN DASHBOARD CONTENT AREA */}
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50 flex flex-col justify-between">
              
              {/* SAVE MESSAGES */}
              {saveSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Alterações salvas com sucesso e publicadas em tempo real!</span>
                </div>
              )}
              {saveError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-150 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
                  <X className="w-4 h-4 text-red-600" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* TAB 1: CRM KANBAN & LEADS */}
              {activeTab === "leads" && (() => {
                const archivedCount = localLeads.filter(l => getLeadStage(l) === "Concluído").length;

                // Filter leads by search & employee & service & archived status
                const filteredLeads = localLeads.filter(lead => {
                  const query = crmSearch.toLowerCase().trim();
                  const matchesSearch = !query || (
                    (lead.name || "").toLowerCase().includes(query) ||
                    (lead.phone || "").includes(query) ||
                    (lead.email || "").toLowerCase().includes(query) ||
                    (lead.service || "").toLowerCase().includes(query) ||
                    (lead.protocol || "").toLowerCase().includes(query)
                  );

                  const assigned = lead.assignedTo || "Sem Atribuição";
                  const matchesEmployee = crmFilterEmployee === "Todos" || assigned === crmFilterEmployee;

                  const matchesService = crmFilterService === "Todos" || lead.service === crmFilterService;

                  const leadStage = getLeadStage(lead);
                  // Hide concluded/archived leads unless crmShowArchived is true or a search query is typed
                  const matchesArchive = crmShowArchived || Boolean(query) || leadStage !== "Concluído";

                  return matchesSearch && matchesEmployee && matchesService && matchesArchive;
                });

                // Get unique services for filter dropdown
                const serviceOptions = Array.from(new Set(localLeads.map(l => l.service).filter(Boolean)));

                // Visible stages on Kanban board (hide Concluído column by default unless crmShowArchived is enabled)
                const visibleStages = crmShowArchived
                  ? CRM_STAGES
                  : CRM_STAGES.filter(s => s.id !== "Concluído");

                return (
                  <div className="space-y-6 text-left animate-fade-in">
                    {/* TOP CRM BAR */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-xl font-display font-extrabold text-brand-navy-900 flex items-center gap-2">
                            <Kanban className="w-5 h-5 text-brand-gold-500" />
                            <span>CRM Kanban de Atendimento</span>
                          </h2>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Auto-Sync Ao Vivo
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Acompanhe o funil de atendimento dos clientes, atribua funcionários (Shafira Nunes e Pablo Gabriel) e converta leads em cadastros oficiais.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* VIEW MODE TOGGLE */}
                        <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200">
                          <button
                            onClick={() => setCrmViewMode("kanban")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              crmViewMode === "kanban"
                                ? "bg-brand-navy-900 text-white shadow-xs"
                                : "text-gray-600 hover:text-brand-navy-900"
                            }`}
                          >
                            <Kanban className="w-3.5 h-3.5" />
                            <span>Quadro Kanban</span>
                          </button>
                          <button
                            onClick={() => setCrmViewMode("table")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              crmViewMode === "table"
                                ? "bg-brand-navy-900 text-white shadow-xs"
                                : "text-gray-600 hover:text-brand-navy-900"
                            }`}
                          >
                            <List className="w-3.5 h-3.5" />
                            <span>Lista / Tabela</span>
                          </button>
                        </div>

                        {/* ARCHIVED / CONCLUDED TOGGLE BUTTON */}
                        <button
                          onClick={() => setCrmShowArchived(!crmShowArchived)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                            crmShowArchived
                              ? "bg-slate-800 text-white border-slate-900 shadow-xs"
                              : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                          }`}
                          title="Exibir ou ocultar pedidos concluídos/arquivados"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>{crmShowArchived ? "Ocultar Concluídos" : `Ver Arquivados (${archivedCount})`}</span>
                        </button>

                        <button
                          onClick={handleManualRefresh}
                          disabled={isRefreshing}
                          className="px-3.5 py-2 bg-white border border-gray-250 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-brand-gold-600 ${isRefreshing ? "animate-spin" : ""}`} />
                          <span>{isRefreshing ? "Atualizando..." : "Sincronizar Agora"}</span>
                        </button>
                      </div>
                    </div>

                    {/* CRM SEARCH & FILTER BAR */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                      {/* Search */}
                      <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          value={crmSearch}
                          onChange={(e) => setCrmSearch(e.target.value)}
                          placeholder="Buscar por nome, WhatsApp, e-mail, protocolo..."
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-1 focus:ring-brand-gold-500 outline-none"
                        />
                        {crmSearch && (
                          <button 
                            onClick={() => setCrmSearch("")}
                            className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Employee Filter */}
                      <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <select
                          value={crmFilterEmployee}
                          onChange={(e) => setCrmFilterEmployee(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:bg-white cursor-pointer"
                        >
                          <option value="Todos">Todos os Atendentes</option>
                          <option value="Shafira Nunes">Shafira Nunes</option>
                          <option value="Pablo Gabriel">Pablo Gabriel</option>
                          <option value="Sem Atribuição">Sem Atribuição</option>
                        </select>
                      </div>

                      {/* Service Filter */}
                      <div>
                        <select
                          value={crmFilterService}
                          onChange={(e) => setCrmFilterService(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:bg-white cursor-pointer"
                        >
                          <option value="Todos">Todos os Serviços</option>
                          {serviceOptions.map((srv, idx) => (
                            <option key={idx} value={srv}>{srv}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* KANBAN BOARD VIEW */}
                    {crmViewMode === "kanban" && (
                      <div className="flex gap-4 overflow-x-auto pb-6 pt-1 snap-x select-none min-h-[600px]">
                        {visibleStages.map((stage) => {
                          const stageLeads = filteredLeads.filter(l => getLeadStage(l) === stage.id);

                          return (
                            <div 
                              key={stage.id}
                              className={`w-80 shrink-0 flex flex-col bg-slate-100/70 border border-slate-200 rounded-2xl p-3 shadow-xs border-t-4 ${stage.borderTop}`}
                            >
                              {/* Stage Column Header */}
                              <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200/80">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-xs font-extrabold text-brand-navy-950 uppercase tracking-wider">
                                    {stage.label}
                                  </h3>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${stage.badgeColor}`}>
                                  {stageLeads.length}
                                </span>
                              </div>

                              {/* Column Cards Container */}
                              <div className="flex-1 space-y-3 overflow-y-auto max-h-[75vh] pr-1">
                                {stageLeads.length === 0 ? (
                                  <div className="p-8 text-center bg-white/50 border border-dashed border-slate-250 rounded-xl text-slate-400 text-xs">
                                    Nenhum lead nesta etapa
                                  </div>
                                ) : (
                                  stageLeads.map((lead, idx) => {
                                    const currentStage = getLeadStage(lead);
                                    const assignedTo = lead.assignedTo || "Shafira Nunes";

                                    return (
                                      <div
                                        key={lead.id || `lead-${idx}`}
                                        className={`p-4 bg-white border rounded-xl shadow-xs hover:shadow-md transition-all space-y-3 text-left group ${
                                          currentStage === "Concluído" ? "opacity-75 border-slate-300 bg-slate-50/50" : "border-gray-200"
                                        }`}
                                      >
                                        {/* Card Top Meta */}
                                        <div className="flex items-center justify-between gap-1 text-[10px]">
                                          <span className="px-2 py-0.5 rounded-md font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wide font-mono">
                                            {lead.type || "Orçamento"}
                                          </span>
                                          <span className="text-gray-400 font-mono">
                                            {lead.date || "Recente"}
                                          </span>
                                        </div>

                                        {/* Lead Name & Protocol */}
                                        <div>
                                          <h4 className="text-sm font-bold text-brand-navy-900 group-hover:text-brand-gold-600 transition-colors">
                                            {lead.name}
                                          </h4>
                                          {lead.protocol && (
                                            <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                                              Prot: {lead.protocol}
                                            </p>
                                          )}
                                        </div>

                                        {/* Contact Details & Direct WhatsApp */}
                                        <div className="space-y-1 text-xs text-gray-600">
                                          <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 font-semibold text-gray-700">
                                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                              {lead.phone}
                                            </span>
                                            {lead.phone && (
                                              <a
                                                href={`https://api.whatsapp.com/send?phone=${lead.phone.replace(/\D/g, "")}&text=${encodeURIComponent(`Olá ${lead.name}, aqui é a equipe da SP Assessoria. Gostariamos de dar andamento na sua solicitação de ${lead.service}.`)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                                title="Iniciar conversa no WhatsApp"
                                              >
                                                <Phone className="w-3 h-3 fill-white" />
                                                <span>Whats</span>
                                              </a>
                                            )}
                                          </div>
                                          {lead.email && (
                                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 truncate">
                                              <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                                              <span className="truncate">{lead.email}</span>
                                            </div>
                                          )}
                                        </div>

                                        {/* Requested Service */}
                                        <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-[11px]">
                                          <span className="text-slate-400 font-medium">Interesse: </span>
                                          <strong className="text-slate-800">{lead.service}</strong>
                                        </div>

                                        {/* Message snippet if present */}
                                        {lead.message && (
                                          <p className="text-[11px] text-gray-500 italic line-clamp-2 bg-gray-50 p-2 rounded-md border border-gray-100">
                                            "{lead.message}"
                                          </p>
                                        )}

                                        {/* MOTIVO(S) DO PAUSA / GUARDAR PEDIDO DISPLAY ON CARD */}
                                        {(currentStage === "Guardar Pedido" || (lead.pauseReasons && lead.pauseReasons.length > 0)) && (
                                          <div className="p-2.5 bg-orange-50/80 border border-orange-200 rounded-lg space-y-1.5 text-left">
                                            <div className="flex items-center justify-between text-[11px] font-extrabold text-orange-950">
                                              <span className="flex items-center gap-1 text-orange-900">
                                                <PauseCircle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                                                Motivo(s) de Guarda:
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => handleOpenPauseModal(lead, assignedTo)}
                                                className="text-[10px] text-orange-700 hover:text-orange-950 underline font-bold cursor-pointer"
                                              >
                                                Alterar
                                              </button>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                              {(!lead.pauseReasons || lead.pauseReasons.length === 0) ? (
                                                <span className="text-[10px] italic text-orange-600 font-medium">Nenhum motivo selecionado</span>
                                              ) : (
                                                lead.pauseReasons.map((reason: string, rIdx: number) => {
                                                  let icon = "📌";
                                                  if (reason === "Prazo") icon = "⏱️";
                                                  if (reason === "Valor") icon = "💰";
                                                  if (reason === "Documentação") icon = "📄";
                                                  if (reason === "Outros" || reason.startsWith("Outros")) icon = "✏️";

                                                  const labelText = reason === "Outros" && lead.pauseOtherReason 
                                                    ? `Outros: ${lead.pauseOtherReason}` 
                                                    : reason;

                                                  return (
                                                    <span 
                                                      key={rIdx} 
                                                      className="px-2 py-0.5 bg-white border border-orange-300 text-orange-900 rounded text-[10px] font-bold shadow-2xs flex items-center gap-1"
                                                    >
                                                      <span>{icon}</span>
                                                      <span>{labelText}</span>
                                                    </span>
                                                  );
                                                })
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* Employee Selector (Shafira / Pablo) */}
                                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80 space-y-1">
                                          <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-semibold text-slate-600 flex items-center gap-1">
                                              <User className="w-3 h-3 text-brand-gold-600" />
                                              Atendente:
                                            </span>
                                            <select
                                              value={assignedTo}
                                              onChange={(e) => handleUpdateLeadStage(lead.id, currentStage, e.target.value)}
                                              className="bg-white border border-slate-300 text-slate-900 text-[11px] font-bold rounded-md px-2 py-1 focus:ring-1 focus:ring-brand-gold-500 outline-none cursor-pointer"
                                            >
                                              {CRM_EMPLOYEES.map(emp => (
                                                <option key={emp} value={emp}>{emp}</option>
                                              ))}
                                              <option value="Sem Atribuição">Sem Atribuição</option>
                                            </select>
                                          </div>
                                        </div>

                                        {/* Stage Navigation */}
                                        <div className="pt-2 border-t border-gray-100 space-y-2">
                                          <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-gray-500 font-medium">Mover Etapa:</span>
                                            <select
                                              value={currentStage}
                                              onChange={(e) => handleUpdateLeadStage(lead.id, e.target.value, assignedTo)}
                                              className="bg-brand-navy-50 border border-brand-navy-200 text-brand-navy-950 text-[11px] font-bold rounded-md px-2 py-1 outline-none cursor-pointer hover:bg-brand-navy-100"
                                            >
                                              {CRM_STAGES.map(s => (
                                                <option key={s.id} value={s.id}>{s.label}</option>
                                              ))}
                                            </select>
                                          </div>

                                          {/* Convert to Client Button */}
                                          {lead.status === "Cliente Cadastrado" ? (
                                            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-bold flex items-center justify-center gap-1">
                                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                              <span>Cliente Cadastrado</span>
                                            </div>
                                          ) : (
                                            <button
                                              onClick={() => handleOpenConvertModal(lead)}
                                              className="w-full py-2 px-3 bg-gradient-to-r from-brand-gold-500 to-brand-gold-600 hover:from-brand-gold-400 hover:to-brand-gold-500 text-brand-navy-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                                            >
                                              <UserPlus className="w-3.5 h-3.5" />
                                              <span>Cadastrar como Cliente</span>
                                            </button>
                                          )}
                                        </div>

                                        {/* Workspace integrations if enabled */}
                                        {isGoogleConnected && (
                                          <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-1">
                                            {lead.driveFolderUrl ? (
                                              <a
                                                href={lead.driveFolderUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-bold flex items-center gap-1"
                                              >
                                                <Folder className="w-3 h-3 text-blue-600" /> Drive
                                              </a>
                                            ) : (
                                              <button
                                                onClick={() => handleCreateDriveFolder(lead.id, lead.name)}
                                                className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                              >
                                                <FolderPlus className="w-3 h-3" /> Drive
                                              </button>
                                            )}
                                            {lead.email && (
                                              <button
                                                onClick={() => handleOpenGmailModal(lead)}
                                                className="px-2 py-1 bg-red-50 text-red-700 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                              >
                                                <Mail className="w-3 h-3" /> E-mail
                                              </button>
                                            )}
                                            <button
                                              onClick={() => handleDeleteLead(lead.id)}
                                              className="p-1 bg-red-50 text-red-600 hover:bg-red-100 rounded ml-auto cursor-pointer"
                                              title="Excluir Lead"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* TABLE LIST VIEW */}
                    {crmViewMode === "table" && (
                      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-mono uppercase text-[10px] tracking-wider">
                              <tr>
                                <th className="p-3.5">Cliente / Lead</th>
                                <th className="p-3.5">WhatsApp / E-mail</th>
                                <th className="p-3.5">Serviço Solicitado</th>
                                <th className="p-3.5">Etapa do CRM</th>
                                <th className="p-3.5">Atendente</th>
                                <th className="p-3.5 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-150 font-medium text-gray-800">
                              {filteredLeads.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="p-8 text-center text-gray-400">
                                    Nenhum lead encontrado com os filtros aplicados.
                                  </td>
                                </tr>
                              ) : (
                                filteredLeads.map((lead, idx) => {
                                  const currentStage = getLeadStage(lead);
                                  const assignedTo = lead.assignedTo || "Shafira Nunes";

                                  return (
                                    <tr key={lead.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="p-3.5">
                                        <div className="font-bold text-brand-navy-900">{lead.name}</div>
                                        <div className="text-[10px] text-gray-400 font-mono">{lead.date}</div>
                                      </td>
                                      <td className="p-3.5">
                                        <div className="flex items-center gap-1.5">
                                          <Phone className="w-3 h-3 text-emerald-600" />
                                          <span>{lead.phone}</span>
                                        </div>
                                        {lead.email && <div className="text-[11px] text-gray-500">{lead.email}</div>}
                                      </td>
                                      <td className="p-3.5">
                                        <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-md font-bold text-[11px]">
                                          {lead.service}
                                        </span>
                                      </td>
                                      <td className="p-3.5 space-y-1">
                                        <select
                                          value={currentStage}
                                          onChange={(e) => handleUpdateLeadStage(lead.id, e.target.value, assignedTo)}
                                          className="bg-brand-navy-50 border border-brand-navy-200 text-brand-navy-950 font-bold rounded-md px-2 py-1 text-xs outline-none cursor-pointer"
                                        >
                                          {CRM_STAGES.map(s => (
                                            <option key={s.id} value={s.id}>{s.label}</option>
                                          ))}
                                        </select>

                                        {(currentStage === "Guardar Pedido" || (lead.pauseReasons && lead.pauseReasons.length > 0)) && (
                                          <div className="flex items-center gap-1 mt-1">
                                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-900 border border-orange-200 rounded text-[10px] font-bold flex items-center gap-1">
                                              <PauseCircle className="w-3 h-3 text-orange-600" />
                                              {lead.pauseReasons && lead.pauseReasons.length > 0
                                                ? lead.pauseReasons.map((r: string) => r === "Outros" && lead.pauseOtherReason ? `Outros: ${lead.pauseOtherReason}` : r).join(", ")
                                                : "Guardado"}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenPauseModal(lead, assignedTo)}
                                              className="text-[10px] text-orange-700 hover:text-orange-900 underline font-bold cursor-pointer"
                                            >
                                              Editar
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-3.5">
                                        <select
                                          value={assignedTo}
                                          onChange={(e) => handleUpdateLeadStage(lead.id, currentStage, e.target.value)}
                                          className="bg-white border border-gray-300 text-gray-900 font-bold rounded-md px-2 py-1 text-xs outline-none cursor-pointer"
                                        >
                                          {CRM_EMPLOYEES.map(emp => (
                                            <option key={emp} value={emp}>{emp}</option>
                                          ))}
                                          <option value="Sem Atribuição">Sem Atribuição</option>
                                        </select>
                                      </td>
                                      <td className="p-3.5 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          {lead.status === "Cliente Cadastrado" ? (
                                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold">
                                              Cadastrado
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => handleOpenConvertModal(lead)}
                                              className="px-2.5 py-1 bg-brand-gold-500 hover:bg-brand-gold-400 text-brand-navy-950 font-bold text-[11px] rounded-lg shadow-xs cursor-pointer"
                                            >
                                              Cadastrar Cliente
                                            </button>
                                          )}
                                          <button
                                            onClick={() => handleDeleteLead(lead.id)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* TAB: CLIENTES & ACOMPANHAMENTO (GESTÃO DE HISTÓRICO, DOCUMENTOS E TRÂMITES) */}
              {activeTab === "clients" && (
                <div className="space-y-6 text-left animate-fade-in">
                  
                  {!editingClient && !showNewClientForm ? (
                    // 1. LIST & SEARCH VIEW
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                          <h2 className="text-lg font-display font-extrabold text-brand-navy-900">Cadastro de Clientes & Acompanhamento</h2>
                          <p className="text-xs text-gray-500">Crie e edite fichas cadastrais de clientes com histórico de trâmites, documentos anexados e informações de registro.</p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingClient({
                              name: "",
                              cpf: "",
                              email: "",
                              phone: "",
                              service: "Recurso de Trânsito / CNH",
                              protocol: `SP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
                              currentStep: "Análise Inicial",
                              orderInfo: "",
                              documents: [],
                              timeline: [
                                { title: "Cadastro de Requerimento", date: new Date().toLocaleDateString("pt-BR"), description: "Perfil do cliente registrado no sistema administrativo e início dos estudos técnicos.", status: "completed" },
                                { title: "Análise Inicial do Processo", date: new Date().toLocaleDateString("pt-BR"), description: "Examinando dados iniciais para proposição de recursos contra infrações.", status: "current" }
                              ]
                            });
                            setShowNewClientForm(true);
                          }}
                          className="px-4 py-2.5 bg-brand-navy-900 text-white font-bold text-xs rounded-lg hover:bg-brand-navy-800 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Cadastrar Novo Cliente</span>
                        </button>
                      </div>

                      {/* CPF / Keyword search */}
                      <div className="bg-white border border-gray-150 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center">
                        <div className="flex-1 relative w-full">
                          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Buscar cliente por CPF ou Nome..."
                            value={searchCpf}
                            onChange={(e) => setSearchCpf(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-250 rounded-lg pl-10 pr-4 py-2.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                          />
                        </div>
                        <button
                          onClick={() => setSearchCpf("")}
                          className="px-4 py-2.5 bg-gray-100 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-200 cursor-pointer"
                        >
                          Limpar Filtros
                        </button>
                      </div>

                      {/* Client Cards List */}
                      {loadingClients ? (
                        <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-2">
                          <RefreshCw className="w-8 h-8 text-brand-gold-500 animate-spin" />
                          <span className="text-xs">Carregando lista de clientes...</span>
                        </div>
                      ) : localClients.length === 0 ? (
                        <div className="p-12 text-center bg-white border border-gray-150 rounded-xl text-gray-400 space-y-2 text-xs">
                          <Users className="w-10 h-10 text-gray-300 mx-auto" />
                          <p>Nenhum cliente cadastrado no sistema administrativo.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          {localClients
                            .filter((c: any) => {
                              const searchLower = searchCpf.trim().toLowerCase();
                              if (!searchLower) return true;
                              return (
                                c.cpf?.replace(/[^\d]/g, "").includes(searchLower.replace(/[^\d]/g, "")) ||
                                c.name?.toLowerCase().includes(searchLower)
                              );
                            })
                            .map((client: any, idx: number) => (
                              <div key={client.id || (client.cpf ? `${client.cpf}-${idx}` : `client-${idx}`)} className="p-5 bg-white border border-gray-200 rounded-xl shadow-xs space-y-4 hover:shadow-sm transition-all text-xs">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                  <div>
                                    <h4 className="text-sm font-bold text-brand-navy-900">{client.name}</h4>
                                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 font-mono">
                                      <span>CPF: <strong>{client.cpf}</strong></span>
                                      <span>E-mail: <strong>{client.email}</strong></span>
                                      <span>WhatsApp: <strong>{client.phone}</strong></span>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingClient(JSON.parse(JSON.stringify(client)));
                                        setShowNewClientForm(false);
                                      }}
                                      className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md text-gray-700 font-bold transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <Edit className="w-3.5 h-3.5 text-brand-navy-800" />
                                      <span>Editar Ficha</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteClient(client.cpf)}
                                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-100 rounded-md text-red-700 font-bold transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Excluir</span>
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-gray-100 bg-[#fafafa]/50 p-3 rounded-lg">
                                  <div>
                                    <span className="text-[10px] text-gray-400 block font-mono">SERVIÇO & PROTOCOLO</span>
                                    <span className="font-semibold text-gray-700">{client.service}</span>
                                    <span className="block text-brand-gold-600 font-mono font-bold text-[10px]">{client.protocol}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-gray-400 block font-mono">ÚLTIMO STATUS PORTAL</span>
                                    <span className="px-2 py-0.5 bg-brand-gold-100 border border-brand-gold-200 text-brand-gold-800 text-[10px] font-bold rounded-full uppercase inline-block mt-0.5">
                                      {client.currentStep}
                                    </span>
                                    <span className="block text-[10px] text-gray-500 mt-1">Atualizado em: {client.lastUpdate || "Recente"}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-gray-400 block font-mono">DOCS & REGISTROS</span>
                                    <button
                                      type="button"
                                      onClick={() => setViewingClientDocsModal(client)}
                                      className="text-[11px] font-bold text-brand-navy-900 hover:text-brand-gold-600 transition-colors block mt-0.5 truncate cursor-pointer underline decoration-dotted"
                                    >
                                      📄 {client.documents?.length || 0} doc(s) anexado(s) (Ver todos)
                                    </button>
                                    <span className="text-[10px] text-gray-400 block truncate mt-0.5">{client.orderInfo || "Nenhuma informação de pedido cadastrada."}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    // 2. FORM VIEW (CREATE / EDIT CLIENT)
                    <form onSubmit={handleSaveClient} className="space-y-6 bg-white border border-gray-200 p-6 rounded-2xl shadow-xs">
                      <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                        <div>
                          <h3 className="text-lg font-display font-extrabold text-brand-navy-900">
                            {showNewClientForm ? "Cadastrar Novo Cliente" : "Editar Informações do Cliente"}
                          </h3>
                          <p className="text-xs text-gray-500">Insira todos os dados cadastrais, documentos e atualize o status do processo.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClient(null);
                            setShowNewClientForm(false);
                          }}
                          className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-250 text-gray-700 font-bold text-xs rounded-lg cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>

                      {/* Form inputs grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                        
                        {/* Seção 1: Dados Pessoais */}
                        <div className="space-y-4">
                          <h4 className="text-xs uppercase font-mono font-bold text-brand-gold-600 tracking-wider">1. Dados Cadastrais</h4>
                          
                          <div>
                            <label className="block text-gray-500 font-semibold mb-1">Nome Completo</label>
                            <input
                              type="text"
                              required
                              value={editingClient.name}
                              onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                              placeholder="Ex: João da Silva Santos"
                              className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-gray-500 font-semibold mb-1">CPF (Apenas 11 números)</label>
                              <input
                                type="text"
                                required
                                disabled={!showNewClientForm && Boolean(editingClient.id)}
                                value={editingClient.cpf}
                                onChange={(e) => setEditingClient({ ...editingClient, cpf: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                                maxLength={11}
                                placeholder="Ex: 12345678901"
                                className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white disabled:bg-gray-100 disabled:text-gray-500 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-500 font-semibold mb-1">WhatsApp / Telefone</label>
                              <input
                                type="text"
                                required
                                value={editingClient.phone}
                                onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                                placeholder="Ex: (11) 99999-9999"
                                className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-gray-500 font-semibold mb-1">E-mail do Cliente</label>
                            <input
                              type="email"
                              required
                              value={editingClient.email}
                              onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                              placeholder="Ex: joao.santos@gmail.com"
                              className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-gray-500 font-semibold mb-1">Informações de Registro, Pedido & Dados Internos</label>
                            <textarea
                              rows={4}
                              value={editingClient.orderInfo || ""}
                              onChange={(e) => setEditingClient({ ...editingClient, orderInfo: e.target.value })}
                              placeholder="Dados sobre as infrações, documentos coletados, número do processo administrativo no DETRAN/DER, observações gerais, prazos..."
                              className="w-full bg-gray-50 border border-gray-250 rounded-lg p-3 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                            />
                          </div>
                        </div>

                        {/* Seção 2: Processo & Trâmites */}
                        <div className="space-y-4">
                          <h4 className="text-xs uppercase font-mono font-bold text-brand-gold-600 tracking-wider">2. Processo & Status Revisional</h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-gray-500 font-semibold mb-1">Serviço Contratado</label>
                              <input
                                type="text"
                                required
                                value={editingClient.service}
                                onChange={(e) => setEditingClient({ ...editingClient, service: e.target.value })}
                                placeholder="Ex: Defesa Pontuação CNH"
                                className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-500 font-semibold mb-1">Código do Protocolo</label>
                              <input
                                type="text"
                                required
                                value={editingClient.protocol}
                                onChange={(e) => setEditingClient({ ...editingClient, protocol: e.target.value })}
                                placeholder="Ex: SP-2026-402"
                                className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-gray-500 font-semibold mb-1">Último Status (Exibido no Portal)</label>
                              <input
                                type="text"
                                required
                                value={editingClient.currentStep}
                                onChange={(e) => setEditingClient({ ...editingClient, currentStep: e.target.value })}
                                placeholder="Ex: Recurso Protocolado"
                                className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-500 font-semibold mb-1">Data da Última Atualização</label>
                              <input
                                type="text"
                                value={editingClient.lastUpdate || ""}
                                onChange={(e) => setEditingClient({ ...editingClient, lastUpdate: e.target.value })}
                                placeholder="Ex: 24/05/2026"
                                className="w-full bg-gray-50 border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                              />
                            </div>
                          </div>

                          {/* Gestão de Documentos Anexados & Arquivos */}
                          <div className="p-4 bg-gray-50/80 border border-gray-200 rounded-xl space-y-3">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-200 pb-2">
                              <div>
                                <label className="block text-brand-navy-900 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                  <Paperclip className="w-3.5 h-3.5 text-brand-gold-500" />
                                  <span>Documentos Anexados & Arquivos do Cliente</span>
                                </label>
                                <p className="text-[10px] text-gray-500 mt-0.5">Suporta envio de PDF, DOC/DOCX, Imagens (PNG, JPG, WebP) e arquivos com pré-visualização</p>
                              </div>
                              <span className="text-[10px] font-mono font-bold bg-white px-2 py-1 rounded-md border border-gray-200 text-brand-navy-900 self-start sm:self-auto">
                                Total: {(editingClient.documents || []).length} arquivo(s)
                              </span>
                            </div>

                            {/* File Upload Zone & Manual Add */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Option 1: File Drop / Upload */}
                              <div className="relative border-2 border-dashed border-gray-300 hover:border-brand-navy-800 bg-white p-3 rounded-xl transition-all text-center flex flex-col items-center justify-center cursor-pointer group">
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                                  onChange={handleUploadClientDocument}
                                  disabled={!!uploadingDocStatus}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 disabled:cursor-not-allowed"
                                />
                                <FileUp className="w-6 h-6 text-brand-navy-800 mb-1 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-bold text-brand-navy-900">Anexar Arquivos (PDF, DOC, Fotos)</span>
                                <span className="text-[10px] text-gray-400 mt-0.5">Clique ou arraste seus arquivos aqui</span>
                              </div>

                              {/* Option 2: Manual Text / Link Input */}
                              <div className="bg-white p-3 rounded-xl border border-gray-200 flex flex-col justify-between space-y-2">
                                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider">Adicionar Nome ou Link do Documento</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Ex: CNH_Digital.pdf ou https://..."
                                    value={newDocInput}
                                    onChange={(e) => setNewDocInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddManualDoc();
                                      }
                                    }}
                                    className="flex-1 bg-gray-50 border border-gray-250 rounded-lg px-3 py-1.5 text-xs focus:outline-hidden focus:bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleAddManualDoc}
                                    className="px-3 bg-brand-navy-900 text-white font-bold rounded-lg hover:bg-brand-navy-800 transition-colors text-xs cursor-pointer flex items-center gap-1 shrink-0"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Anexar</span>
                                  </button>
                                </div>
                                <p className="text-[10px] text-gray-400 italic">Para documentos físicos recebidos ou links externos do Google Drive/Dropbox.</p>
                              </div>
                            </div>

                            {/* Upload Progress Alert */}
                            {uploadingDocStatus && (
                              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs flex items-center gap-2 animate-pulse">
                                <RefreshCw className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
                                <span className="font-semibold">{uploadingDocStatus}</span>
                              </div>
                            )}

                            {/* Attached Documents Cards Grid */}
                            {(!editingClient.documents || editingClient.documents.length === 0) ? (
                              <div className="text-center py-6 bg-white border border-dashed border-gray-200 rounded-xl text-gray-400">
                                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                                <p className="text-xs">Nenhum documento anexado a esta ficha ainda.</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                                {editingClient.documents.map((docItem: any, idx: number) => {
                                  const doc = normalizeDocItem(docItem);
                                  const docCategory = getDocType(doc.name, doc.type);

                                  const badgeStyle = docCategory === "pdf"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : docCategory === "word"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : docCategory === "image"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : docCategory === "excel"
                                    ? "bg-teal-50 text-teal-700 border-teal-200"
                                    : "bg-gray-100 text-gray-700 border-gray-200";

                                  return (
                                    <div key={`edit-doc-${idx}-${doc.name || ''}`} className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${badgeStyle} shrink-0 font-mono`}>
                                            {docCategory.toUpperCase()}
                                          </span>
                                          <span className="text-xs font-bold text-gray-800 truncate" title={doc.name}>
                                            {doc.name}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const filtered = editingClient.documents.filter((_: any, i: number) => i !== idx);
                                            setEditingClient({ ...editingClient, documents: filtered });
                                          }}
                                          className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50 shrink-0 cursor-pointer"
                                          title="Remover documento"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      <div className="text-[10px] text-gray-400 font-mono flex items-center justify-between">
                                        <span>{doc.size ? `${(doc.size / (1024 * 1024)).toFixed(2)} MB` : "Anexo"}</span>
                                        <span>{doc.uploadedAt || "Cadastrado"}</span>
                                      </div>

                                      <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
                                        <button
                                          type="button"
                                          onClick={() => setPreviewingDoc(doc)}
                                          className="flex-1 px-2 py-1 bg-brand-navy-900 text-white font-bold rounded-md hover:bg-brand-navy-800 transition-colors text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          <Eye className="w-3 h-3 text-brand-gold-400" />
                                          <span>Pré-visualizar</span>
                                        </button>

                                        {doc.url && (
                                          <a
                                            href={doc.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md transition-colors text-[10px] flex items-center gap-1 cursor-pointer"
                                            title="Baixar ou Abrir"
                                          >
                                            <Download className="w-3 h-3" />
                                            <span>Baixar</span>
                                          </a>
                                        )}

                                        {doc.url && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText(doc.url);
                                              alert("Link do documento copiado para a área de transferência!");
                                            }}
                                            className="p-1 text-gray-500 hover:text-brand-navy-900 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                                            title="Copiar Link Direto"
                                          >
                                            <Copy className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Seção 3: Linha do Tempo / Trâmites do Processo */}
                      <div className="pt-4 border-t border-gray-100 text-xs text-left">
                        <h4 className="text-xs uppercase font-mono font-bold text-brand-gold-600 tracking-wider mb-3">3. Histórico de Trâmites (Exibido Cronologicamente no Portal)</h4>

                        {/* Adicionar novo trâmite */}
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 mb-4">
                          <span className="text-[10px] uppercase font-bold text-brand-navy-900 block">Adicionar Novo Status ao Histórico</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-1 font-semibold">Título do Status</label>
                              <input
                                type="text"
                                placeholder="Ex: Defesa Prévia Elaborada"
                                value={newTimelineItem.title}
                                onChange={(e) => setNewTimelineItem({ ...newTimelineItem, title: e.target.value })}
                                className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-1 font-semibold">Data</label>
                              <input
                                type="text"
                                placeholder="Ex: 24/05/2026"
                                value={newTimelineItem.date}
                                onChange={(e) => setNewTimelineItem({ ...newTimelineItem, date: e.target.value })}
                                className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 mb-1 font-semibold">Indicador Visual</label>
                              <select
                                value={newTimelineItem.status}
                                onChange={(e) => setNewTimelineItem({ ...newTimelineItem, status: e.target.value as any })}
                                className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden"
                              >
                                <option value="completed">Concluído (Bolinha Dourada)</option>
                                <option value="current">Ativo / Atual (Dourado Pulsante)</option>
                                <option value="pending">Pendente (Bolinha Cinza)</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1 font-semibold">Descrição / Detalhe do Trâmite</label>
                            <input
                              type="text"
                              placeholder="Ex: Elaboramos e protocolamos o recurso de defesa prévia junto ao JARI municipal."
                              value={newTimelineItem.description}
                              onChange={(e) => setNewTimelineItem({ ...newTimelineItem, description: e.target.value })}
                              className="w-full bg-white border border-gray-250 rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden"
                            />
                          </div>
                          <div className="text-right">
                            <button
                              type="button"
                              onClick={() => {
                                if (!newTimelineItem.title || !newTimelineItem.description) {
                                  alert("Preencha o título e descrição do trâmite.");
                                  return;
                                }
                                const cleanDate = newTimelineItem.date || new Date().toLocaleDateString("pt-BR");
                                const currentTimeline = editingClient.timeline || [];
                                
                                // Se o novo item for "current" (atual), podemos transformar os trâmites atuais anteriores em "completed"
                                let adjustedTimeline = [...currentTimeline];
                                if (newTimelineItem.status === "current") {
                                  adjustedTimeline = adjustedTimeline.map(item => 
                                    item.status === "current" ? { ...item, status: "completed" } : item
                                  );
                                }

                                setEditingClient({
                                  ...editingClient,
                                  timeline: [...adjustedTimeline, { ...newTimelineItem, date: cleanDate }],
                                  // Update the top status dynamically!
                                  currentStep: newTimelineItem.title,
                                  lastUpdate: cleanDate
                                });

                                // Reset form
                                setNewTimelineItem({ title: "", date: "", description: "", status: "pending" });
                              }}
                              className="px-4 py-2 bg-brand-gold-500 text-brand-navy-900 font-bold rounded-lg hover:bg-brand-gold-600 transition-colors text-xs cursor-pointer"
                            >
                              Inserir no Histórico
                            </button>
                          </div>
                        </div>

                        {/* Lista dos trâmites existentes */}
                        <div className="space-y-2 mt-4">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block">Etapas Registradas (Do mais antigo para o mais novo)</span>
                          {(!editingClient.timeline || editingClient.timeline.length === 0) ? (
                            <p className="text-gray-400 italic">Nenhum trâmite cadastrado ainda.</p>
                          ) : (
                            <div className="border border-gray-150 rounded-xl overflow-hidden divide-y divide-gray-100">
                              {editingClient.timeline.map((item: any, idx: number) => (
                                <div key={`timeline-${idx}-${item.title || ''}`} className="p-3 bg-[#fdfdfd] flex justify-between items-center gap-4 text-xs">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-2.5 h-2.5 rounded-full ${
                                        item.status === "completed" ? "bg-brand-gold-500" : item.status === "current" ? "bg-brand-gold-500 animate-pulse" : "bg-gray-300"
                                      }`} />
                                      <strong className="text-gray-800">{item.title}</strong>
                                      {item.date && <span className="text-[10px] text-gray-500 font-mono">({item.date})</span>}
                                    </div>
                                    <p className="text-[11px] text-gray-500 pl-4">{item.description}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const filtered = editingClient.timeline.filter((_: any, i: number) => i !== idx);
                                      setEditingClient({ ...editingClient, timeline: filtered });
                                    }}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-colors font-bold text-xs"
                                  >
                                    Excluir Etapa
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Form Actions */}
                      <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClient(null);
                            setShowNewClientForm(false);
                          }}
                          className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-brand-navy-900 text-white font-bold rounded-lg hover:bg-brand-navy-800 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                          <Save className="w-4 h-4" />
                          <span>Salvar Dados do Cliente</span>
                        </button>
                      </div>
                    </form>
                  )}

                </div>
              )}

              {/* TAB 2: GERENCIAR BLOG */}
              {activeTab === "blog" && (
                <div className="space-y-6 text-left">
                  
                  {!editingPost && !showNewPostForm ? (
                    <>
                      <div className="flex justify-between items-center">
                        <div>
                          <h2 className="text-lg font-display font-extrabold text-brand-navy-900">Artigos do Blog</h2>
                          <p className="text-xs text-gray-500">Adicione, edite ou exclua posts informativos do site.</p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingPost({ title: "", category: "INSS", summary: "", content: "", imageUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80", readTime: "5 min de leitura" });
                            setShowNewPostForm(true);
                          }}
                          className="px-3.5 py-2 bg-brand-navy-900 hover:bg-brand-navy-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Novo Artigo</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {localBlog.map((post, idx) => (
                          <div 
                            key={post.id || `blog-${idx}`} 
                            className="bg-white border border-gray-150 rounded-xl overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-sm"
                          >
                            <div className="flex gap-4 p-4">
                              <img 
                                src={post.imageUrl} 
                                alt={post.title} 
                                className="w-20 h-20 object-cover rounded-lg shrink-0 border border-gray-100"
                              />
                              <div className="space-y-1">
                                <span className="bg-brand-gold-100 text-brand-gold-800 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                                  {post.category}
                                </span>
                                <h4 className="font-bold text-brand-navy-900 text-sm line-clamp-1">{post.title}</h4>
                                <p className="text-xs text-gray-500 line-clamp-2">{post.summary}</p>
                              </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex justify-between items-center text-xs">
                              <span className="text-gray-400 font-mono text-[10px]">{post.date}</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingPost(post);
                                    setShowNewPostForm(false);
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 border border-blue-100 rounded-lg bg-white cursor-pointer"
                                  title="Editar Artigo"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeletePost(post.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 border border-red-100 rounded-lg bg-white cursor-pointer"
                                  title="Excluir Artigo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* EDIT / NEW POST FORM */
                    <form onSubmit={handleSavePost} className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <h3 className="text-base font-display font-bold text-brand-navy-900">
                          {showNewPostForm ? "Criar Novo Artigo de Blog" : `Editar Artigo: ${editingPost.title}`}
                        </h3>
                        <button
                          type="button"
                          onClick={() => { setEditingPost(null); setShowNewPostForm(false); }}
                          className="text-xs text-gray-400 hover:text-gray-600 font-bold"
                        >
                          Cancelar
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                        <div className="sm:col-span-8">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Título do Artigo</label>
                          <input
                            type="text"
                            required
                            value={editingPost.title}
                            onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Categoria</label>
                          <select
                            value={editingPost.category}
                            onChange={(e) => setEditingPost({ ...editingPost, category: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                          >
                            <option value="INSS">INSS</option>
                            <option value="Trânsito">Trânsito</option>
                            <option value="Administrativo">Administrativo</option>
                            <option value="Direitos">Direitos</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tempo de Leitura</label>
                        <input
                          type="text"
                          required
                          value={editingPost.readTime}
                          onChange={(e) => setEditingPost({ ...editingPost, readTime: e.target.value })}
                          placeholder="Ex: 5 min de leitura"
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                        />
                      </div>

                      {/* SEÇÃO DA IMAGEM DO ARTIGO COM SUPORTE A UPLOAD E DRAG & DROP */}
                      <div className="bg-gray-50 border border-gray-250 rounded-xl p-4 space-y-3">
                        <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Imagem do Artigo</span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          {/* Preview da Imagem */}
                          <div className="md:col-span-4 flex flex-col justify-center items-center bg-white border border-gray-150 rounded-lg p-2 min-h-[140px] relative group overflow-hidden">
                            {editingPost.imageUrl ? (
                              <>
                                <img 
                                  src={editingPost.imageUrl} 
                                  alt="Preview" 
                                  className="w-full h-32 object-cover rounded-md"
                                />
                                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={() => setEditingPost({ ...editingPost, imageUrl: "" })}
                                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                                  >
                                    Remover Imagem
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="text-center p-4">
                                <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                                <span className="text-[10px] text-gray-400 font-medium">Sem imagem definida</span>
                              </div>
                            )}
                          </div>

                          {/* Dropzone de Upload */}
                          <div className="md:col-span-8 flex flex-col gap-3">
                            <div 
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                              onClick={() => fileInputRef.current?.click()}
                              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[100px] ${
                                isDragging 
                                  ? "border-brand-gold-500 bg-brand-gold-50/50" 
                                  : "border-gray-250 bg-white hover:border-brand-navy-500 hover:bg-gray-50/50"
                              }`}
                            >
                              <input 
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                              />
                              <Upload className="w-6 h-6 text-gray-400 mb-1" />
                              <span className="text-[11px] font-bold text-gray-700">Arraste uma imagem aqui ou clique para buscar</span>
                              <span className="text-[9px] text-gray-400 mt-0.5">Formatos suportados: PNG, JPG, WEBP. Redimensionamento automático inteligente.</span>
                            </div>

                            <div className="relative">
                              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                <span className="text-[9px] font-bold text-gray-400 uppercase">URL</span>
                              </div>
                              <input
                                type="text"
                                required
                                value={editingPost.imageUrl}
                                onChange={(e) => setEditingPost({ ...editingPost, imageUrl: e.target.value })}
                                placeholder="Ou cole a URL direta de uma imagem da internet..."
                                className="w-full bg-white border border-gray-250 text-gray-800 rounded-lg pl-12 pr-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Resumo Curto (Listagem)</label>
                        <input
                          type="text"
                          required
                          value={editingPost.summary}
                          onChange={(e) => setEditingPost({ ...editingPost, summary: e.target.value })}
                          placeholder="Aparece no card do blog"
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Conteúdo Completo do Artigo (Markdown ou Texto)</label>
                        <textarea
                          required
                          value={editingPost.content}
                          onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                          rows={8}
                          placeholder="Texto completo do informativo..."
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white resize-y font-sans"
                        />
                      </div>

                      <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => { setEditingPost(null); setShowNewPostForm(false); }}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Voltar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-brand-navy-900 hover:bg-brand-navy-800 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          <span>Salvar Artigo</span>
                        </button>
                      </div>
                    </form>
                  )}

                </div>
              )}

              {/* TAB 3: CONFIGURAR SERVIÇOS */}
              {activeTab === "services" && localServices.inss && (
                <div className="space-y-6 text-left">
                  <div>
                    <h2 className="text-lg font-display font-extrabold text-brand-navy-900">Configurar Serviços & Atuação</h2>
                    <p className="text-xs text-gray-500">Edite as descrições e itens que aparecem nas abas de atuação da página.</p>
                  </div>

                  <div className="space-y-6">
                    {Object.keys(localServices).map((key) => {
                      const service = localServices[key];
                      return (
                        <div key={key} className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm space-y-4">
                          <h3 className="text-sm sm:text-base font-bold text-brand-navy-900 border-b border-gray-100 pb-2 flex items-center gap-2 uppercase font-mono">
                            <Briefcase className="w-4 h-4 text-brand-gold-600" />
                            <span>Serviço: {service.title}</span>
                          </h3>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Título de Exibição</label>
                              <input
                                type="text"
                                value={service.title}
                                onChange={(e) => handleServiceChange(key, "title", e.target.value)}
                                className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Descrição Comercial</label>
                              <textarea
                                value={service.description}
                                onChange={(e) => handleServiceChange(key, "description", e.target.value)}
                                rows={2}
                                className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden resize-none"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Itens Abrangidos (Balões)</label>
                              <div className="space-y-2 mt-1">
                                {service.items.map((item: string, idx: number) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={item}
                                      onChange={(e) => handleServiceItemChange(key, idx, e.target.value)}
                                      className="flex-1 bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveServiceItem(key, idx)}
                                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 cursor-pointer bg-white"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => handleAddServiceItem(key)}
                                  className="px-3 py-1.5 text-[10px] font-bold bg-gray-100 text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-200 flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Adicionar Item</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="bg-white border border-gray-150 rounded-xl p-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveServices}
                        className="px-5 py-2.5 bg-brand-navy-900 hover:bg-brand-navy-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>Publicar Todos os Serviços</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: FAQ MANAGEMENT */}
              {activeTab === "faqs" && (
                <div className="space-y-6 text-left">
                  
                  {!editingFaq && !showNewFaqForm ? (
                    <>
                      <div className="flex justify-between items-center">
                        <div>
                          <h2 className="text-lg font-display font-extrabold text-brand-navy-900">Perguntas Frequentes (FAQs)</h2>
                          <p className="text-xs text-gray-500">Gerencie as perguntas e respostas mais comuns que aparecem na home do site.</p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingFaq({ question: "", answer: "" });
                            setShowNewFaqForm(true);
                          }}
                          className="px-3.5 py-2 bg-brand-navy-900 hover:bg-brand-navy-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Nova Pergunta</span>
                        </button>
                      </div>

                      <div className="space-y-3">
                        {localFaqs.map((faq, idx) => (
                          <div 
                            key={faq.id || `faq-${idx}`} 
                            className="bg-white border border-gray-150 rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-xs"
                          >
                            <div className="space-y-1 text-left flex-1">
                              <h4 className="font-bold text-brand-navy-900 text-sm">{faq.question}</h4>
                              <p className="text-xs text-gray-500 line-clamp-1">{faq.answer}</p>
                            </div>
                            <div className="flex gap-2 justify-end sm:justify-start shrink-0">
                              <button
                                onClick={() => {
                                  setEditingFaq(faq);
                                  setShowNewFaqForm(false);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 border border-blue-100 rounded-lg bg-white cursor-pointer"
                                title="Editar Pergunta"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteFaq(faq.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 border border-red-100 rounded-lg bg-white cursor-pointer"
                                title="Excluir Pergunta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* FAQ FORM */
                    <form onSubmit={handleSaveFaq} className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <h3 className="text-base font-display font-bold text-brand-navy-900">
                          {showNewFaqForm ? "Criar Nova Dúvida Frequente" : "Editar Dúvida"}
                        </h3>
                        <button
                          type="button"
                          onClick={() => { setEditingFaq(null); setShowNewFaqForm(false); }}
                          className="text-xs text-gray-400 hover:text-gray-600 font-bold"
                        >
                          Cancelar
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Pergunta do Cidadão</label>
                        <input
                          type="text"
                          required
                          value={editingFaq.question}
                          onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Resposta Explicativa</label>
                        <textarea
                          required
                          value={editingFaq.answer}
                          onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                          rows={4}
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-brand-gold-500 focus:bg-white resize-y font-sans"
                        />
                      </div>

                      <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => { setEditingFaq(null); setShowNewFaqForm(false); }}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Voltar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-brand-navy-900 hover:bg-brand-navy-800 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Save className="w-4 h-4" />
                          <span>Salvar Dúvida</span>
                        </button>
                      </div>
                    </form>
                  )}

                </div>
              )}

              {/* TAB 5: GENERAL CONFIGURATION */}
              {activeTab === "config" && (
                <div className="space-y-6 text-left">
                  <div>
                    <h2 className="text-lg font-display font-extrabold text-brand-navy-900">Configurações Globais do Site</h2>
                    <p className="text-xs text-gray-500">Edite os telefones de contato, dados da empresa, redes sociais e textos da hero principal.</p>
                  </div>

                  <form onSubmit={handleSaveConfig} className="space-y-6">
                    {/* Visual Identity & Logo */}
                    <div className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-brand-navy-900 border-b border-gray-100 pb-2">Identidade Visual e Logotipo</h3>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                        <div className="md:col-span-3 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/50">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">Visualização do Logo</span>
                          <div className="relative w-20 h-20 rounded-full border border-brand-gold-500/40 bg-white flex items-center justify-center overflow-hidden shadow-xs">
                            {localConfig.logoUrl ? (
                              <img 
                                src={localConfig.logoUrl} 
                                alt="SP Assessoria Logo Preview" 
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <div className="text-center text-gray-400 p-2">
                                <span className="text-[9px] block leading-tight font-semibold">Usando Vetor</span>
                                <span className="text-[8px] block text-brand-gold-600 font-bold mt-1">Padrão SP</span>
                              </div>
                            )}
                          </div>
                          {localConfig.logoUrl && (
                            <button
                              type="button"
                              onClick={() => setLocalConfig({ ...localConfig, logoUrl: "" })}
                              className="mt-3 text-[10px] text-red-600 hover:text-red-800 font-bold underline cursor-pointer"
                            >
                              Remover e usar padrão
                            </button>
                          )}
                        </div>

                        <div className="md:col-span-9 space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Upload do Logo PNG / JPG (Máx 800KB)</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (file.size > 800000) {
                                    alert("Por favor, selecione uma imagem menor que 800KB para garantir o carregamento ágil.");
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setLocalConfig({ ...localConfig, logoUrl: reader.result as string });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-1.5 text-xs focus:outline-hidden file:mr-4 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-brand-navy-900 file:text-white hover:file:bg-brand-navy-800 file:cursor-pointer"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Carregue um arquivo PNG transparente para substituir o logotipo do cabeçalho e do rodapé.</p>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Ou Link Direto da Imagem (URL)</label>
                            <input
                              type="text"
                              placeholder="https://exemplo.com/seu-logo.png"
                              value={localConfig.logoUrl || ""}
                              onChange={(e) => setLocalConfig({ ...localConfig, logoUrl: e.target.value })}
                              className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contact details */}
                    <div className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-brand-navy-900 border-b border-gray-100 pb-2">Canais de Contato & Institucional</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">WhatsApp Principal (Somente números, ex: 5511987049051)</label>
                          <input
                            type="text"
                            required
                            value={localConfig.phone}
                            onChange={(e) => setLocalConfig({ ...localConfig, phone: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">WhatsApp Auxiliar (Somente números, ex: 5511993344293)</label>
                          <input
                            type="text"
                            required
                            value={localConfig.phoneAux}
                            onChange={(e) => setLocalConfig({ ...localConfig, phoneAux: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">E-mail Corporativo</label>
                          <input
                            type="email"
                            required
                            value={localConfig.email}
                            onChange={(e) => setLocalConfig({ ...localConfig, email: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">CNPJ Ativo</label>
                          <input
                            type="text"
                            required
                            value={localConfig.cnpj}
                            onChange={(e) => setLocalConfig({ ...localConfig, cnpj: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Instagram (@spra.assessoria)</label>
                          <input
                            type="text"
                            required
                            value={localConfig.instagram}
                            onChange={(e) => setLocalConfig({ ...localConfig, instagram: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Slogans and banner */}
                    <div className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-brand-navy-900 border-b border-gray-100 pb-2">Hero Banner Principal</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Título da Hero (Linha 1)</label>
                          <input
                            type="text"
                            required
                            value={localConfig.heroTitle}
                            onChange={(e) => setLocalConfig({ ...localConfig, heroTitle: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Título Destacado (Dourado)</label>
                          <input
                            type="text"
                            required
                            value={localConfig.heroTitleAccent}
                            onChange={(e) => setLocalConfig({ ...localConfig, heroTitleAccent: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Slogan Principal (Aspas)</label>
                        <input
                          type="text"
                          required
                          value={localConfig.heroSubtitle}
                          onChange={(e) => setLocalConfig({ ...localConfig, heroSubtitle: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Parágrafo Descritivo Secundário</label>
                        <textarea
                          required
                          value={localConfig.heroDescription}
                          onChange={(e) => setLocalConfig({ ...localConfig, heroDescription: e.target.value })}
                          rows={3}
                          className="w-full bg-gray-50 border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden resize-none leading-relaxed"
                        />
                      </div>
                    </div>

                    <div className="bg-white border border-gray-150 rounded-xl p-4 flex justify-end">
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-brand-navy-900 hover:bg-brand-navy-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>Salvar Configurações Gerais</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 6: GOOGLE WORKSPACE MANAGEMENT */}
              {activeTab === "google" && (
                <div className="space-y-6 text-left">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-display font-extrabold text-[#4285F4] flex items-center gap-2">
                        <FolderOpen className="w-5 h-5" />
                        <span>Gerenciador Google Workspace</span>
                      </h2>
                      <p className="text-xs text-gray-500">Acompanhe conexões do Google Planilhas, Drive, Gmail e Tasks da SP Assessoria.</p>
                    </div>
                  </div>

                  {/* Account Status Card */}
                  <div className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-50 text-[#4285F4] rounded-xl shrink-0">
                        <Shield className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-brand-navy-900">
                          {isGoogleConnected ? "Integração Google Workspace Ativa" : "Conectar ao Google Workspace"}
                        </h3>
                        <p className="text-xs text-gray-500 max-w-lg leading-relaxed">
                          {isGoogleConnected 
                            ? `Autenticado como ${googleUserEmail || "administrador"}. Todas as ferramentas do Google Drive, Planilhas, Gmail e Google Tasks estão sincronizadas.`
                            : "Para automatizar seu escritório, crie planilhas de leads em tempo real, crie pastas de clientes seguras no Drive, responda por Gmail e agende tarefas no Google Tasks."}
                        </p>
                      </div>
                    </div>
                    <div>
                      {isGoogleConnected ? (
                        <button
                          onClick={handleLogout}
                          className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 font-bold text-xs rounded-lg border border-red-200 transition-all cursor-pointer"
                        >
                          Desconectar Conta Google
                        </button>
                      ) : (
                        <button
                          onClick={handleGoogleLogin}
                          className="px-5 py-2.5 bg-[#4285F4] hover:bg-[#3574de] text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-all shadow-sm hover:shadow-md cursor-pointer"
                        >
                          <Lock className="w-4 h-4" />
                          <span>Autenticar com o Google</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isGoogleConnected && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Left Block: Google Sheets Control */}
                      <div className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm flex flex-col justify-between gap-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                              <FileSpreadsheet className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-brand-navy-900">Sincronização com Google Planilhas</h3>
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            Mantenha um controle centralizado de todos os seus leads e consultas em tempo real diretamente em uma planilha Google Sheets. Ideal para backups ou compartilhamento com consultores comerciais externos.
                          </p>
                          
                          {spreadsheetUrl && (
                            <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs flex items-center justify-between gap-4">
                              <span className="truncate text-gray-500 font-medium">Planilha de Controle</span>
                              <a 
                                href={spreadsheetUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-emerald-600 font-bold hover:underline shrink-0 flex items-center gap-1 font-mono"
                              >
                                <span>Abrir Planilha</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>

                        <div>
                          <button
                            onClick={handleSyncSheets}
                            disabled={syncingSheets}
                            className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-4 h-4 ${syncingSheets ? "animate-spin" : ""}`} />
                            <span>{syncingSheets ? "Sincronizando com o Sheets..." : spreadsheetUrl ? "Sincronizar Leads Agora" : "Criar Planilha de Leads"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Right Block: Google Tasks & Automation Info */}
                      <div className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm flex flex-col justify-between gap-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                              <CheckSquare className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-brand-navy-900">Agenda & Google Tarefas</h3>
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            Crie lembretes de acompanhamento e tarefas diretamente nas suas contas oficiais do Google Tasks. Você pode fazer isso diretamente de cada Lead na aba <strong>Leads & Consultas</strong> para garantir que nenhum caso de recurso de trânsito ou INSS seja esquecido.
                          </p>
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
                              <Check className="w-4 h-4 text-purple-500" />
                              <span>Integração de lembretes em 1 clique</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
                              <Check className="w-4 h-4 text-purple-500" />
                              <span>Prazos e datas de conclusão integrados</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setActiveTab("leads")}
                          className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <span>Ver Leads para Agendar Tarefas</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Drive Folder Directory Panel */}
                  {isGoogleConnected && (
                    <div className="bg-white border border-gray-150 rounded-xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-50 text-[#4285F4] rounded-lg">
                          <Folder className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-brand-navy-900">Diretório de Pastas de Clientes (Drive)</h3>
                          <p className="text-xs text-gray-400">Pastas de backup para armazenamento e organização dos documentos do cliente (CNH, multas, petições).</p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-y border-gray-150 text-gray-400 uppercase tracking-wider font-bold">
                              <th className="p-3">Cliente</th>
                              <th className="p-3">Serviço / Interesse</th>
                              <th className="p-3 text-center">Status no Drive</th>
                              <th className="p-3 text-right">Ações no Drive</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {localLeads.map((lead, idx) => (
                              <tr key={lead.id ? `drive-lead-${lead.id}` : `drive-lead-${idx}`} className="hover:bg-gray-50/50">
                                <td className="p-3 font-bold text-brand-navy-900">{lead.name}</td>
                                <td className="p-3 text-gray-500 font-medium">{lead.service}</td>
                                <td className="p-3 text-center">
                                  {lead.driveFolderUrl ? (
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-full font-bold text-[9px] uppercase font-mono">Pasta Ativa</span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-150 rounded-full font-bold text-[9px] uppercase font-mono">Sem Pasta</span>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  {lead.driveFolderUrl ? (
                                    <div className="flex justify-end items-center gap-2">
                                      <a
                                        href={lead.driveFolderUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-100"
                                        title="Abrir no Google Drive"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                      <button
                                        onClick={() => handleLoadDriveFiles(lead)}
                                        className="px-2 py-1 bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 rounded-lg text-[10px] font-bold cursor-pointer"
                                      >
                                        Arquivos
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleCreateDriveFolder(lead.id, lead.name)}
                                      disabled={creatingFolderLeadId === lead.id}
                                      className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-150 hover:bg-amber-100 rounded-lg text-[10px] font-bold cursor-pointer disabled:opacity-50"
                                    >
                                      {creatingFolderLeadId === lead.id ? "Criando..." : "Criar Pasta"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: REVIEWS MANAGEMENT */}
              {activeTab === "reviews" && (
                <div className="space-y-6 text-left">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-display font-extrabold text-brand-navy-900 flex items-center gap-2">
                        <Award className="w-5 h-5 text-brand-gold-500" />
                        <span>Gerenciamento de Avaliações</span>
                      </h2>
                      <p className="text-xs text-gray-500">Aprove ou rejeite depoimentos e comentários enviados pelos usuários antes de publicá-los no site pública.</p>
                    </div>
                  </div>

                  {localReviews.length === 0 ? (
                    <div className="p-12 text-center bg-white border border-gray-150 rounded-xl text-gray-400 space-y-2 text-xs">
                      <Award className="w-10 h-10 text-gray-300 mx-auto" />
                      <p>Nenhuma avaliação cadastrada no banco de dados.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {localReviews.map((rev, idx) => {
                        const isApproved = rev.approved !== false;
                        return (
                          <div 
                            key={rev.id || `rev-${idx}`}
                            className={`p-5 bg-white border rounded-xl shadow-xs flex flex-col justify-between gap-4 transition-all hover:shadow-sm ${
                              !isApproved ? "border-l-4 border-l-amber-500 border-gray-200" : "border-gray-200"
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-bold text-brand-navy-900 text-sm flex items-center gap-2">
                                    {rev.author}
                                    {!isApproved && (
                                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded uppercase tracking-wide">
                                        Pendente
                                      </span>
                                    )}
                                    {isApproved && rev.approved !== undefined && (
                                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded uppercase tracking-wide">
                                        Publicado
                                      </span>
                                    )}
                                  </h4>
                                  <span className="text-[10px] text-brand-gold-600 font-mono font-semibold tracking-wide block mt-0.5">
                                    {rev.serviceType}
                                  </span>
                                </div>
                                <span className="text-[10px] text-gray-400 font-mono shrink-0">
                                  {rev.date}
                                </span>
                              </div>

                              <div className="flex gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star 
                                    key={i} 
                                    className={`w-3.5 h-3.5 ${
                                      i < rev.stars 
                                        ? "fill-brand-gold-500 text-brand-gold-500" 
                                        : "text-gray-200"
                                    }`} 
                                  />
                                ))}
                              </div>

                              <div className="text-xs space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-100 font-medium text-gray-600">
                                {rev.email && (
                                  <p className="flex items-center gap-1.5 text-[11px]">
                                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                                    <span>E-mail: <strong>{rev.email}</strong></span>
                                  </p>
                                )}
                                {rev.phone && (
                                  <p className="flex items-center gap-1.5 text-[11px]">
                                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                                    <span>Telefone: <strong>{rev.phone}</strong></span>
                                  </p>
                                )}
                              </div>

                              <p className="text-xs text-gray-600 italic leading-relaxed whitespace-pre-wrap">
                                "{rev.text}"
                              </p>
                            </div>

                            <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                              <button
                                onClick={() => handleDeleteReview(rev.id)}
                                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                title="Excluir avaliação permanentemente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir</span>
                              </button>

                              <div className="flex items-center gap-2">
                                {isApproved ? (
                                  <button
                                    onClick={() => handleDisapproveReview(rev.id)}
                                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                    title="Ocultar do site público"
                                  >
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>Ocultar</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleApproveReview(rev.id)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm hover:shadow-md cursor-pointer"
                                    title="Aprovar e publicar no site público"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Aprovar & Publicar</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 8: SUPABASE DATABASE MANAGEMENT */}
              {activeTab === "supabase" && (
                <div className="space-y-6 text-left animate-fade-in">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-200 pb-4">
                    <div>
                      <h2 className="text-lg font-display font-extrabold text-brand-navy-900 flex items-center gap-2">
                        <Database className="w-5 h-5 text-emerald-600" />
                        <span>Banco de Dados Supabase</span>
                      </h2>
                      <p className="text-xs text-gray-500 mt-1">
                        Gerencie a conexão, credenciais e sincronização com o banco de dados PostgreSQL do Supabase.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${
                        supabaseStatus === "connected" 
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : supabaseStatus === "warning"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : supabaseStatus === "error"
                          ? "bg-red-100 text-red-800 border border-red-300"
                          : "bg-gray-100 text-gray-700 border border-gray-300"
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          supabaseStatus === "connected" ? "bg-emerald-500 animate-pulse" :
                          supabaseStatus === "warning" ? "bg-amber-500 animate-ping" :
                          supabaseStatus === "error" ? "bg-red-500" : "bg-gray-400"
                        }`} />
                        {supabaseStatus === "connected" ? "Supabase Operacional" :
                         supabaseStatus === "warning" ? "Tabelas Pendentes" :
                         supabaseStatus === "error" ? "Erro de Conexão" : "Aguardando Configuração"}
                      </span>
                    </div>
                  </div>

                  {/* SUPABASE CREDENTIALS FORM */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-brand-navy-900">Credenciais da API Supabase</h3>
                        <p className="text-xs text-gray-500">Veja abaixo onde encontrar cada chave no seu painel do Supabase</p>
                      </div>
                    </div>

                    {/* Guia explicativo em destaque */}
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-950 space-y-2">
                      <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-emerald-700" />
                        <span>Onde encontrar as chaves no Supabase Dashboard:</span>
                      </p>
                      <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px] font-medium text-emerald-900/90">
                        <li>Acesse o painel em <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-bold text-emerald-800">supabase.com/dashboard</a> e abra o seu projeto.</li>
                        <li>No menu lateral esquerdo, clique no ícone de engrenagem ⚙️ (<strong>Project Settings</strong> ou <strong>Configurações</strong>).</li>
                        <li>No submenu de configurações, clique em <strong>API</strong> (ou <strong>API Keys / Data API</strong>).</li>
                        <li>Na seção <strong>Project URL</strong>, copie a URL (exemplo: <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-800">https://xyz.supabase.co</code>).</li>
                        <li>Na seção <strong>Project API Keys</strong>, você verá a chave <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-800">anon</code> / <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-800">public</code> (Anon Public Key) e a chave <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-800">service_role</code> / <code className="bg-emerald-100 px-1 py-0.5 rounded text-emerald-800">secret</code> (Service Role Key).</li>
                      </ol>
                    </div>

                    {supabaseMessage && (
                      <div className={`p-4 rounded-xl text-xs leading-relaxed font-semibold flex items-start gap-2.5 ${
                        supabaseStatus === "error" ? "bg-red-50 text-red-700 border border-red-200" :
                        supabaseStatus === "warning" ? "bg-amber-50 text-amber-800 border border-amber-200" :
                        "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}>
                        <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{supabaseMessage}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-bold text-gray-700">Project URL (URL do Projeto Supabase)</label>
                        <input
                          type="text"
                          value={supabaseUrl}
                          onChange={(e) => setSupabaseUrl(e.target.value)}
                          placeholder="https://sua-id-de-projeto.supabase.co"
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700">Anon Public Key (Chave Anônima)</label>
                        <input
                          type="password"
                          value={supabaseAnonKey}
                          onChange={(e) => setSupabaseAnonKey(e.target.value)}
                          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700">Service Role Secret Key (Opcional para Servidor)</label>
                        <input
                          type="password"
                          value={supabaseServiceRoleKey}
                          onChange={(e) => setSupabaseServiceRoleKey(e.target.value)}
                          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-3">
                      <button
                        onClick={handleSaveSupabaseConfig}
                        disabled={savingSupabase}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>{savingSupabase ? "Salvando..." : "Salvar Credenciais"}</span>
                      </button>

                      <button
                        onClick={handleTestSupabaseConnection}
                        disabled={testingSupabase}
                        className="px-5 py-2.5 bg-brand-navy-900 hover:bg-brand-navy-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${testingSupabase ? "animate-spin" : ""}`} />
                        <span>{testingSupabase ? "Testando..." : "Testar Conexão"}</span>
                      </button>

                      <button
                        onClick={handleSyncSupabaseData}
                        disabled={syncingSupabase}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Database className="w-4 h-4" />
                        <span>{syncingSupabase ? "Sincronizando..." : "Sincronizar Dados Existentes"}</span>
                      </button>
                    </div>
                  </div>

                  {/* SQL SCRIPT FOR SUPABASE WITH RLS */}
                  <div className="bg-brand-navy-950 rounded-2xl p-6 text-white space-y-4 shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-white/10 pb-4">
                      <div>
                        <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-400">
                          <Copy className="w-4 h-4" />
                          <span>Código SQL para Execução no Supabase (com RLS ativado)</span>
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Copie este código e execute no <strong>SQL Editor</strong> do painel Supabase para criar as tabelas e políticas de segurança.
                        </p>
                      </div>

                      <button
                        onClick={handleCopySqlScript}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shrink-0"
                      >
                        {sqlCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{sqlCopied ? "Copiado com Sucesso!" : "Copiar Código SQL"}</span>
                      </button>
                    </div>

                    <div className="relative bg-black/60 rounded-xl p-4 border border-white/10 max-h-96 overflow-y-auto font-mono text-[11px] text-emerald-300 leading-relaxed">
                      <pre className="whitespace-pre-wrap">{SUPABASE_SQL_SCRIPT}</pre>
                    </div>
                  </div>
                </div>
              )}

              {/* BOTTOM STATS/FOOTER */}
              <div className="mt-8 border-t border-gray-200 pt-4 text-center text-[10px] text-gray-400 font-mono flex flex-col sm:flex-row justify-between gap-2">
                <span>© 2026 SP Assessoria de Recursos Administrativos • Ambiente Restrito</span>
                <span>Última Sincronização do Servidor: {new Date().toLocaleTimeString("pt-BR")}</span>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 1: GOOGLE DRIVE FILE EXPLORER OVERLAY */}
        {activeDriveLead && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col text-left">
              <div className="bg-brand-navy-900 p-5 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-blue-400" />
                    <span>Documentos de {activeDriveLead.name}</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Armazenamento oficial e seguro no Google Drive</p>
                </div>
                <button 
                  onClick={() => setActiveDriveLead(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                
                {/* File Upload Area */}
                <div className="border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-xl p-5 text-center transition-all bg-gray-50 hover:bg-blue-50/20 relative group">
                  <input
                    type="file"
                    ref={driveFileInputRef}
                    onChange={handleUploadToDrive}
                    className="hidden"
                  />
                  <div className="space-y-2">
                    <div className="p-2.5 bg-blue-50 text-blue-500 rounded-full w-10 h-10 flex items-center justify-center mx-auto transition-all group-hover:scale-110">
                      <FileUp className="w-5 h-5" />
                    </div>
                    <div className="text-xs">
                      <button
                        onClick={() => driveFileInputRef.current?.click()}
                        disabled={uploadingToDrive}
                        className="text-[#4285F4] font-bold hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {uploadingToDrive ? "Enviando arquivo..." : "Clique para selecionar um arquivo"}
                      </button>
                      <p className="text-[10px] text-gray-400 mt-1">Carregue comprovantes, CNH, multas ou petições de recurso diretamente (Max 10MB)</p>
                    </div>
                  </div>
                </div>

                {/* Drive Files List */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Arquivos na Pasta do Drive</h4>
                  
                  {loadingDriveFiles ? (
                    <div className="p-8 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                      <span>Carregando diretório de arquivos...</span>
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 border border-gray-100 rounded-xl text-xs bg-gray-50/50">
                      Nenhum arquivo enviado para esta pasta ainda.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto divide-y divide-gray-100">
                      {driveFiles.map((file, idx) => (
                        <div key={file.id || `file-${idx}`} className="py-2.5 flex items-center justify-between gap-3 group text-xs">
                          <div className="flex items-center gap-2 truncate">
                            <img src={file.iconLink} alt="" className="w-4 h-4 opacity-75" referrerPolicy="no-referrer" />
                            <span className="font-medium text-gray-700 truncate group-hover:text-blue-600">{file.name}</span>
                          </div>
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 text-[10px] text-blue-600 hover:underline shrink-0 font-bold flex items-center gap-0.5"
                          >
                            <span>Visualizar</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                <a
                  href={activeDriveLead.driveFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 bg-blue-50 text-[#4285F4] font-bold text-xs rounded-lg border border-blue-150 hover:bg-blue-100 flex items-center gap-1 transition-all"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Ver no Google Drive</span>
                </a>
                <button
                  onClick={() => setActiveDriveLead(null)}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: GMAIL RESPONSE COMPOSER */}
        {emailModalLead && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-[#EA4335] p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Mail className="w-4 h-4 text-white" />
                  <span>Responder Lead via Gmail</span>
                </h3>
                <p className="text-[11px] text-red-100 mt-0.5">Envia um e-mail de resposta formal e personalizado usando sua conta</p>
              </div>
              <button 
                onClick={() => setEmailModalLead(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white rounded-b-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col text-left">
              <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                
                {/* Recipient */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Destinatário</label>
                    <input
                      type="text"
                      disabled
                      value={`${emailModalLead.name} (${emailModalLead.email})`}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-500 rounded-lg px-3 py-2 text-xs focus:outline-hidden font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Selecionar Modelo de E-mail</label>
                    <select
                      value={emailTemplate}
                      onChange={(e) => handleEmailTemplateChange(e.target.value, emailModalLead)}
                      className="w-full bg-white border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden font-medium cursor-pointer"
                    >
                      <option value="recebimento">Confirmar Recebimento de Caso</option>
                      <option value="documentos">Solicitar Documentação Restante</option>
                      <option value="atualizacao">Atualização de Status de Processo</option>
                    </select>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Assunto do E-mail</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full bg-white border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden font-semibold"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Conteúdo da Mensagem (HTML)</label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={8}
                    className="w-full bg-white border border-gray-250 text-gray-800 rounded-lg p-3 text-xs focus:outline-hidden resize-none font-mono leading-relaxed"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                <button
                  onClick={() => setEmailModalLead(null)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail}
                  className="px-4 py-2 bg-[#EA4335] hover:bg-[#d93829] text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sendingEmail ? "Enviando e-mail..." : "Enviar E-mail via Gmail"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: GOOGLE TASKS SCHEDULER */}
        {taskModalLead && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col text-left">
              <div className="bg-emerald-600 p-5 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-white" />
                    <span>Agendar no Google Tarefas</span>
                  </h3>
                  <p className="text-[11px] text-emerald-100 mt-0.5">Adiciona um lembrete com prazo na sua lista oficial do Google Tasks</p>
                </div>
                <button 
                  onClick={() => setTaskModalLead(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Task Title */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Título da Tarefa</label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full bg-white border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden font-bold"
                  />
                </div>

                {/* Task Notes */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Anotações / Descrição</label>
                  <textarea
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    rows={4}
                    className="w-full bg-white border border-gray-250 text-gray-800 rounded-lg p-3 text-xs focus:outline-hidden resize-none leading-relaxed"
                  />
                </div>

                {/* Task Due Date */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Data Limite (Due Date)</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full bg-white border border-gray-250 text-gray-800 rounded-lg px-3 py-2 text-xs focus:outline-hidden font-medium cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                <button
                  onClick={() => setTaskModalLead(null)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-lg hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={creatingTask}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{creatingTask ? "Agendando..." : "Criar Tarefa no Google"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: DOCUMENT PREVIEW MODAL */}
        {previewingDoc && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col text-left">
              <div className="bg-brand-navy-900 p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-brand-gold-500 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate max-w-md">{previewingDoc.name}</h3>
                    <p className="text-[10px] text-gray-300 font-mono">
                      {previewingDoc.size ? `${(previewingDoc.size / (1024 * 1024)).toFixed(2)} MB • ` : ""}
                      {previewingDoc.uploadedAt || "Documento Anexo"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {previewingDoc.url && (
                    <a
                      href={previewingDoc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-brand-gold-500 hover:bg-brand-gold-400 text-brand-navy-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir em Nova Aba</span>
                    </a>
                  )}
                  <button
                    onClick={() => setPreviewingDoc(null)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 bg-gray-100 flex items-center justify-center min-h-[400px]">
                {getDocType(previewingDoc.name, previewingDoc.type) === "image" && previewingDoc.url ? (
                  <div className="text-center">
                    <img
                      src={previewingDoc.url}
                      alt={previewingDoc.name}
                      className="max-h-[70vh] w-auto mx-auto object-contain rounded-lg shadow-md border border-gray-200"
                    />
                  </div>
                ) : getDocType(previewingDoc.name, previewingDoc.type) === "pdf" && previewingDoc.url ? (
                  <iframe
                    src={previewingDoc.url}
                    title={previewingDoc.name}
                    className="w-full h-[70vh] rounded-lg border border-gray-200 bg-white"
                  />
                ) : getDocType(previewingDoc.name, previewingDoc.type) === "word" && previewingDoc.url ? (
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewingDoc.url)}&embedded=true`}
                    title={previewingDoc.name}
                    className="w-full h-[70vh] rounded-lg border border-gray-200 bg-white"
                  />
                ) : previewingDoc.url ? (
                  <div className="text-center p-8 bg-white rounded-xl shadow-xs border border-gray-200 max-w-md">
                    <FileText className="w-16 h-16 text-brand-gold-500 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-brand-navy-900 mb-1">{previewingDoc.name}</h4>
                    <p className="text-xs text-gray-500 mb-4">Este arquivo pode ser baixado ou visualizado no navegador.</p>
                    <a
                      href={previewingDoc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-brand-navy-900 text-white text-xs font-bold rounded-lg hover:bg-brand-navy-800 transition-colors inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar / Abrir Arquivo</span>
                    </a>
                  </div>
                ) : (
                  <div className="text-center p-8 bg-white rounded-xl shadow-xs border border-gray-200 max-w-md">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <h4 className="text-sm font-bold text-brand-navy-900 mb-1">{previewingDoc.name}</h4>
                    <p className="text-xs text-gray-500 mb-2">Este documento foi cadastrado como registro ou nome de referência física.</p>
                    <span className="text-[11px] bg-amber-50 text-amber-800 px-3 py-1 rounded-md font-mono inline-block border border-amber-200">Sem arquivo digital direto anexado</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL 5: CLIENT QUICK DOCUMENTS LIST MODAL */}
        {viewingClientDocsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col text-left">
              <div className="bg-brand-navy-900 p-4 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-brand-gold-500" />
                    <span>Documentos da Ficha do Cliente</span>
                  </h3>
                  <p className="text-[11px] text-gray-300 mt-0.5">Cliente: <strong>{viewingClientDocsModal.name}</strong> • CPF: {viewingClientDocsModal.cpf}</p>
                </div>
                <button
                  onClick={() => setViewingClientDocsModal(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3 bg-gray-50/50">
                {(!viewingClientDocsModal.documents || viewingClientDocsModal.documents.length === 0) ? (
                  <p className="text-xs text-gray-500 text-center py-8 italic">Nenhum documento anexado para este cliente.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {viewingClientDocsModal.documents.map((docItem: any, idx: number) => {
                      const doc = normalizeDocItem(docItem);
                      const docCategory = getDocType(doc.name, doc.type);
                      return (
                        <div key={`view-doc-${idx}-${doc.name || ''}`} className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-2 flex flex-col justify-between shadow-2xs">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-brand-gold-500 shrink-0" />
                            <span className="text-xs font-bold text-gray-800 truncate" title={doc.name}>{doc.name}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                            <span className="uppercase font-bold text-brand-navy-800">{docCategory}</span>
                            <span>{doc.uploadedAt || "Anexo"}</span>
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            <button
                              onClick={() => {
                                setViewingClientDocsModal(null);
                                setPreviewingDoc(doc);
                              }}
                              className="flex-1 px-2.5 py-1.5 bg-brand-navy-900 text-white font-bold text-[10px] rounded-lg hover:bg-brand-navy-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-brand-gold-400" />
                              <span>Pré-visualizar</span>
                            </button>
                            {doc.url && (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Abrir</span>
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-3 bg-white border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setViewingClientDocsModal(null)}
                  className="px-4 py-2 bg-brand-navy-900 text-white font-bold text-xs rounded-lg hover:bg-brand-navy-800 transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CONVERT LEAD TO REGISTERED CLIENT */}
        {convertModalLead && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 flex flex-col text-left">
              <div className="bg-brand-navy-900 p-5 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-gold-500 text-brand-navy-950 rounded-xl">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Cadastrar Cliente a Partir de Lead</h3>
                    <p className="text-[11px] text-gray-300">Vincula o lead diretamente ao sistema de acompanhamento oficial por CPF.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setConvertModalLead(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmConvert} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* CPF FIELD (MANDATORY FOR PORTAL TRACKING) */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <label className="block text-xs font-extrabold text-amber-900">
                    CPF do Cliente * (Obrigatório para consulta de trâmites)
                  </label>
                  <input
                    type="text"
                    required
                    value={convertCpf}
                    onChange={(e) => setConvertCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    maxLength={11}
                    placeholder="12345678901"
                    className="w-full bg-white border border-amber-300 text-amber-950 font-mono font-bold rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-gold-500 outline-none"
                  />
                  <p className="text-[10px] text-amber-800">
                    Com este CPF, o cliente poderá consultar seus prazos e trâmites na página de acompanhamento pública.
                  </p>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={convertName}
                    onChange={(e) => setConvertName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-250 text-gray-900 rounded-lg px-3 py-2 text-xs font-bold focus:bg-white focus:ring-1 focus:ring-brand-gold-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">WhatsApp / Telefone</label>
                    <input
                      type="text"
                      value={convertPhone}
                      onChange={(e) => setConvertPhone(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-250 text-gray-900 rounded-lg px-3 py-2 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-brand-gold-500 outline-none"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={convertEmail}
                      onChange={(e) => setConvertEmail(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-250 text-gray-900 rounded-lg px-3 py-2 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-brand-gold-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Service */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Serviço em Andamento</label>
                    <input
                      type="text"
                      value={convertService}
                      onChange={(e) => setConvertService(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-250 text-gray-900 rounded-lg px-3 py-2 text-xs font-bold focus:bg-white focus:ring-1 focus:ring-brand-gold-500 outline-none"
                    />
                  </div>

                  {/* Assigned Employee */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Atendente Responsável</label>
                    <select
                      value={convertAssignedTo}
                      onChange={(e) => setConvertAssignedTo(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-250 text-gray-900 font-bold rounded-lg px-3 py-2 text-xs focus:bg-white focus:ring-1 focus:ring-brand-gold-500 outline-none cursor-pointer"
                    >
                      {CRM_EMPLOYEES.map(emp => (
                        <option key={emp} value={emp}>{emp}</option>
                      ))}
                      <option value="Sem Atribuição">Sem Atribuição</option>
                    </select>
                  </div>
                </div>

                {/* Stage */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Etapa Atual no CRM</label>
                  <select
                    value={convertStage}
                    onChange={(e) => setConvertStage(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-250 text-gray-900 font-bold rounded-lg px-3 py-2 text-xs focus:bg-white focus:ring-1 focus:ring-brand-gold-500 outline-none cursor-pointer"
                  >
                    {CRM_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Anotações Internas do Trâmites</label>
                  <textarea
                    value={convertNotes}
                    onChange={(e) => setConvertNotes(e.target.value)}
                    rows={3}
                    placeholder="Adicione observações sobre documentação, protocolo ou andamento..."
                    className="w-full bg-gray-50 border border-gray-250 text-gray-900 rounded-lg p-3 text-xs focus:bg-white focus:ring-1 focus:ring-brand-gold-500 outline-none resize-none"
                  />
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConvertModalLead(null)}
                    className="px-4 py-2 bg-white border border-gray-250 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isConverting}
                    className="px-5 py-2 bg-gradient-to-r from-brand-gold-500 to-brand-gold-600 hover:from-brand-gold-400 hover:to-brand-gold-500 text-brand-navy-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{isConverting ? "Cadastrando..." : "Confirmar e Cadastrar Cliente"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: GUARDAR PEDIDO (SELEÇÃO DE MOTIVOS DA PAUSA) */}
        {pauseModalLead && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 flex flex-col text-left">
              <div className="bg-orange-600 p-5 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl text-white">
                    <PauseCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Guardar Pedido / Pausar</h3>
                    <p className="text-[11px] text-orange-100">
                      Cliente: <strong className="text-white">{pauseModalLead.name}</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPauseModalLead(null)}
                  className="p-1 rounded-lg text-orange-100 hover:text-white hover:bg-orange-500/50 transition-colors cursor-pointer text-xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleConfirmPauseReasons} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-800">
                    Selecione um ou mais motivos para guardar o pedido:
                  </label>
                  <p className="text-[11px] text-gray-500">
                    Marque as opções aplicáveis para catalogar a pausa no atendimento.
                  </p>
                </div>

                <div className="space-y-2.5 pt-1">
                  {[
                    { id: "Prazo", label: "Prazo", icon: "⏱️", desc: "Aguardando prazo ou tempo do cliente/órgão" },
                    { id: "Valor", label: "Valor", icon: "💰", desc: "Negociação de valores ou pendência financeira" },
                    { id: "Documentação", label: "Documentação", icon: "📄", desc: "Pendente entrega de documentos solicitados" },
                    { id: "Outros", label: "Outros", icon: "✏️", desc: "Especifique o motivo no campo abaixo" },
                  ].map((option) => {
                    const isChecked = pauseModalReasons.includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          isChecked
                            ? "bg-orange-50/80 border-orange-300 shadow-2xs"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100/80"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPauseModalReasons(prev => [...prev, option.id]);
                            } else {
                              setPauseModalReasons(prev => prev.filter(r => r !== option.id));
                            }
                          }}
                          className="mt-0.5 w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                        />
                        <div className="flex-1 text-xs">
                          <div className="font-bold text-gray-900 flex items-center gap-1.5">
                            <span>{option.icon}</span>
                            <span>{option.label}</span>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">{option.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {pauseModalReasons.includes("Outros") && (
                  <div className="space-y-1.5 pt-2 animate-fade-in">
                    <label className="text-xs font-bold text-gray-700">
                      Outros (especifique o motivo):
                    </label>
                    <input
                      type="text"
                      value={pauseModalOtherText}
                      onChange={(e) => setPauseModalOtherText(e.target.value)}
                      placeholder="Ex: Cliente em viagem, aguardando retorno de familiar..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-xs text-gray-900 focus:bg-white focus:ring-1 focus:ring-orange-500 outline-none"
                    />
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPauseModalLead(null)}
                    className="px-4 py-2 bg-white border border-gray-250 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <PauseCircle className="w-4 h-4" />
                    <span>Mover para Guardar Pedido</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* BOTTOM STATS/FOOTER */}
        <div className="mt-8 border-t border-gray-200 pt-4 text-center text-[10px] text-gray-400 font-mono flex flex-col sm:flex-row justify-between gap-2">
          <span>© 2026 SP Assessoria de Recursos Administrativos • Ambiente Restrito</span>
          <span>Última Sincronização do Servidor: {new Date().toLocaleTimeString("pt-BR")}</span>
        </div>
      </div>
    </div>
  );
}
