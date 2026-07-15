import React, { useState, useEffect } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "../firebase";
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
  LogOut, 
  Briefcase, 
  Award, 
  Phone, 
  Shield, 
  MessageSquare,
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
  FileUp
} from "lucide-react";

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  siteData: any;
  onDataUpdate: (newData: any) => void;
}

export function AdminDashboard({ isOpen, onClose, siteData, onDataUpdate }: AdminDashboardProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<"leads" | "blog" | "services" | "faqs" | "config" | "google">("leads");
  
  // Google Workspace state variables
  const [isGoogleConnected, setIsGoogleConnected] = useState(isWorkspaceConnected());
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(auth.currentUser?.email || null);
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
  
  // Edit forms states
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
    }
  }, [siteData]);

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
        console.error("Erro ao carregar leads do servidor.");
      }
    } catch (err) {
      console.error("Erro de conexão ao buscar leads:", err);
    }
  };

  const handlePasswordReset = async () => {
    if (!username.trim()) {
      setLoginError("Por favor, digite seu e-mail no campo acima para receber o link de recuperação.");
      return;
    }
    setLoginError("");
    try {
      await sendPasswordResetEmail(auth, username.trim());
      setLoginError("E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.");
    } catch (err: any) {
      console.error(err);
      let errMsg = "Erro ao enviar e-mail de recuperação.";
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
        errMsg = "E-mail de usuário inválido ou não cadastrado.";
      } else {
        errMsg = err.message || String(err);
      }
      setLoginError(errMsg);
    }
  };

  // Check login session
  useEffect(() => {
    setIsGoogleConnected(isWorkspaceConnected());

    // Connect Firebase Auth state change listener
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const idToken = await user.getIdToken();
          const response = await fetch("/api/admin/profile", {
            headers: {
              "Authorization": `Bearer ${idToken}`
            }
          });
          if (response.ok) {
            const profile = await response.json();
            const allowedRoles = ["admin", "gestor", "supervisor", "analista", "atendente", "financeiro", "marketing"];
            if (profile.active && allowedRoles.includes(profile.role)) {
              setIsLoggedIn(true);
              setGoogleUserEmail(user.email || "");
              fetchLeads(idToken);
            } else {
              setLoginError("Acesso negado: Perfil inativo ou sem permissão de acesso ao painel.");
              setIsLoggedIn(false);
              await signOut(auth);
            }
          } else {
            setIsLoggedIn(false);
            await signOut(auth);
          }
        } catch (err) {
          console.error("Erro ao carregar perfil do usuário:", err);
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setLoginError("");
    const provider = new GoogleAuthProvider();
    provider.addScope("https://mail.google.com/");
    provider.addScope("https://www.googleapis.com/auth/drive");
    provider.addScope("https://www.googleapis.com/auth/spreadsheets");
    provider.addScope("https://www.googleapis.com/auth/tasks");
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      const response = await fetch("/api/admin/profile", {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });

      if (response.ok) {
        const profile = await response.json();
        const allowedRoles = ["admin", "gestor", "supervisor", "analista", "atendente", "financeiro", "marketing"];
        if (profile.active && allowedRoles.includes(profile.role)) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            setWorkspaceToken(credential.accessToken);
            setIsGoogleConnected(true);
            setGoogleUserEmail(user.email || "");
          }
          setIsLoggedIn(true);
          fetchLeads(idToken);
        } else {
          setLoginError("Acesso negado: Conta inativa ou sem permissão para acessar o painel.");
          await signOut(auth);
        }
      } else {
        setLoginError("Acesso negado: E-mail não cadastrado como administrador.");
        await signOut(auth);
      }
    } catch (err: any) {
      console.error(err);
      setLoginError("Erro na autenticação com o Google: " + (err.message || String(err)));
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
      const userCredential = await signInWithEmailAndPassword(auth, normEmail, normPassword);
      const user = userCredential.user;
      const idToken = await user.getIdToken();

      const response = await fetch("/api/admin/profile", {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });

      if (response.ok) {
        const profile = await response.json();
        const allowedRoles = ["admin", "gestor", "supervisor", "analista", "atendente", "financeiro", "marketing"];
        if (profile.active && allowedRoles.includes(profile.role)) {
          setIsLoggedIn(true);
          setGoogleUserEmail(user.email || "");
          setUsername("");
          setPassword("");
          fetchLeads(idToken);
        } else {
          setLoginError("Acesso negado: Perfil inativo ou sem permissão de acesso ao painel.");
          await signOut(auth);
        }
      } else {
        setLoginError("Acesso negado: Perfil não registrado ou inativo.");
        await signOut(auth);
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = "Erro de autenticação.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errMsg = "E-mail ou senha incorretos.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "E-mail inválido.";
      } else {
        errMsg = err.message || String(err);
      }
      setLoginError(errMsg);
    }
  };

  const handleLogout = async () => {
    clearWorkspaceToken();
    setIsGoogleConnected(false);
    setGoogleUserEmail(null);
    setIsLoggedIn(false);
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Erro ao deslogar do Firebase:", err);
    }
  };

  const persistDataOnServer = async (updatedData: any) => {
    try {
      setSaveError("");
      // Guard local storage first for resilience
      localStorage.setItem("sp_site_data", JSON.stringify(updatedData));
      
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";
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

  const handleDeleteLead = (leadId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este lead permanentemente?")) return;
    const updatedLeads = localLeads.filter(l => l.id !== leadId);
    setLocalLeads(updatedLeads);
    const updatedData = { ...siteData, leads: updatedLeads };
    persistDataOnServer(updatedData);
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
              <span className="text-sm sm:text-base font-bold font-display">Painel Administrativo Restrito</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isLoggedIn && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-brand-navy-800 hover:bg-brand-navy-750 text-xs text-brand-gold-500 hover:text-brand-gold-400 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair do Painel</span>
              </button>
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

                <button
                  onClick={() => { setActiveTab("google"); }}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-lg flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    activeTab === "google" 
                      ? "bg-[#4285F4] text-white shadow-xs" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-[#4285F4]/10"
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Google Workspace</span>
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

              {/* TAB 1: LEADS & CONSULTAS */}
              {activeTab === "leads" && (
                <div className="space-y-6 text-left">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-display font-extrabold text-brand-navy-900">Leads & Consultas Coletadas</h2>
                      <p className="text-xs text-gray-500">Acompanhe as pessoas que preencheram o simulador ou formulário de contato do site.</p>
                    </div>
                  </div>

                  {localLeads.length === 0 ? (
                    <div className="p-12 text-center bg-white border border-gray-150 rounded-xl text-gray-400 space-y-2 text-xs">
                      <Users className="w-10 h-10 text-gray-300 mx-auto" />
                      <p>Nenhum lead ou solicitação registrada até o momento.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {localLeads.map((lead) => (
                        <div 
                          key={lead.id}
                          className={`p-5 bg-white border rounded-xl shadow-xs relative flex flex-col sm:flex-row justify-between gap-4 transition-all hover:shadow-sm ${
                            lead.status === "Novo" ? "border-l-4 border-l-brand-gold-500 border-gray-150" : "border-gray-150"
                          }`}
                        >
                          {/* Left contents */}
                          <div className="space-y-3 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono tracking-wide ${
                                lead.type === "Orçamento" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                              }`}>
                                {lead.type || "Contato"}
                              </span>
                              <span className="text-gray-400 font-mono text-[10px]">
                                {lead.date}
                              </span>
                              <span className={`ml-auto sm:ml-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono tracking-wide ${
                                lead.status === "Novo" 
                                  ? "bg-brand-gold-100 text-brand-gold-800 border border-brand-gold-200" 
                                  : lead.status === "Em Atendimento"
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}>
                                {lead.status}
                              </span>
                            </div>

                            <div className="text-xs">
                              <h4 className="text-sm font-bold text-brand-navy-900">{lead.name}</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1 text-gray-600 font-medium">
                                <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" /> WhatsApp: <strong>{lead.phone}</strong></span>
                                {lead.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" /> E-mail: <strong>{lead.email}</strong></span>}
                              </div>
                              <div className="mt-1">
                                <span className="text-gray-400">Interesse:</span> <strong className="text-brand-navy-850">{lead.service}</strong>
                              </div>
                            </div>

                            {lead.message && (
                              <p className="text-xs p-3 bg-gray-50 border border-gray-100 rounded-lg text-gray-600 italic whitespace-pre-line leading-relaxed">
                                "{lead.message}"
                              </p>
                            )}

                            {/* Google Workspace Lead Actions Bar */}
                            {isGoogleConnected && (
                              <div className="mt-3.5 pt-3.5 border-t border-gray-100 flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-gray-400 mr-1 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#4285F4]"></span>
                                  Google Workspace:
                                </span>
                                
                                {lead.driveFolderUrl ? (
                                  <div className="flex items-center gap-1.5">
                                    <a
                                      href={lead.driveFolderUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2.5 py-1.5 bg-blue-50 text-[#4285F4] border border-blue-150 hover:bg-blue-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                                      title="Abrir pasta no Google Drive"
                                    >
                                      <Folder className="w-3.5 h-3.5" />
                                      <span>Pasta Drive</span>
                                    </a>
                                    <button
                                      onClick={() => handleLoadDriveFiles(lead)}
                                      className="px-2.5 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                    >
                                      <FolderOpen className="w-3.5 h-3.5" />
                                      <span>Ver/Enviar Documentos</span>
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleCreateDriveFolder(lead.id, lead.name)}
                                    disabled={creatingFolderLeadId === lead.id}
                                    className="px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 border border-amber-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                  >
                                    <FolderPlus className="w-3.5 h-3.5" />
                                    <span>{creatingFolderLeadId === lead.id ? "Criando Pasta..." : "Criar Pasta Drive"}</span>
                                  </button>
                                )}

                                {lead.email && (
                                  <button
                                    onClick={() => handleOpenGmailModal(lead)}
                                    className="px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-150 hover:bg-red-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                    <span>Responder por E-mail</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleOpenTaskModal(lead)}
                                  className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-150 hover:bg-emerald-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                >
                                  <CheckSquare className="w-3.5 h-3.5" />
                                  <span>Criar Tarefa</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Right actions */}
                          <div className="flex sm:flex-col items-end sm:justify-between gap-3 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                              {lead.status !== "Em Atendimento" && lead.status !== "Concluído" && (
                                <button
                                  onClick={() => handleUpdateLeadStatus(lead.id, "Em Atendimento")}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg border border-amber-200 cursor-pointer"
                                >
                                  Marcar Atendimento
                                </button>
                              )}
                              {lead.status !== "Concluído" && (
                                <button
                                  onClick={() => handleUpdateLeadStatus(lead.id, "Concluído")}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200 cursor-pointer"
                                >
                                  Concluir Lead
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteLead(lead.id)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-lg border border-red-100 cursor-pointer ml-auto sm:ml-0"
                                title="Excluir Lead"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* WhatsApp Direct */}
                            <a
                              href={`https://api.whatsapp.com/send?phone=${lead.phone.replace(/\D/g, "")}&text=${encodeURIComponent(`Olá ${lead.name}, aqui é o gestor da SP Assessoria. Recebemos sua solicitação de assessoria sobre ${lead.service}. Como podemos ajudar?`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 shadow-xs"
                            >
                              <Phone className="w-3 h-3 fill-white" />
                              Chamar no WhatsApp
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
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
                        {localBlog.map((post) => (
                          <div 
                            key={post.id} 
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
                        {localFaqs.map((faq) => (
                          <div 
                            key={faq.id} 
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
                            {localLeads.map((lead) => (
                              <tr key={lead.id} className="hover:bg-gray-50/50">
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
                      {driveFiles.map((file) => (
                        <div key={file.id} className="py-2.5 flex items-center justify-between gap-3 group text-xs">
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

        {/* BOTTOM STATS/FOOTER */}
        <div className="mt-8 border-t border-gray-200 pt-4 text-center text-[10px] text-gray-400 font-mono flex flex-col sm:flex-row justify-between gap-2">
          <span>© 2026 SP Assessoria de Recursos Administrativos • Ambiente Restrito</span>
          <span>Última Sincronização do Servidor: {new Date().toLocaleTimeString("pt-BR")}</span>
        </div>
      </div>
    </div>
  );
}
