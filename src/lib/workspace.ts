// Google Workspace Integration API wrapper utilizing REST endpoints for SP Assessoria
import { OperationType, handleFirestoreError } from "../firebase";

let cachedToken: string | null = null;

export function setWorkspaceToken(token: string) {
  cachedToken = token;
  localStorage.setItem("sp_workspace_token", token);
}

export function getWorkspaceToken(): string | null {
  if (!cachedToken) {
    cachedToken = localStorage.getItem("sp_workspace_token");
  }
  return cachedToken;
}

export function clearWorkspaceToken() {
  cachedToken = null;
  localStorage.removeItem("sp_workspace_token");
}

// Check if we have active auth
export function isWorkspaceConnected(): boolean {
  return !!getWorkspaceToken();
}

// API Fetch Helper
async function gFetch(url: string, options: RequestInit = {}) {
  const token = getWorkspaceToken();
  if (!token) {
    throw new Error("Não autenticado com o Google. Por favor, conecte-se no painel.");
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  
  if (!res.ok) {
    let errMsg = `Erro da API do Google (${res.status})`;
    try {
      const errJson = await res.json();
      errMsg = errJson.error?.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return res.json();
}

// ==========================================
// GOOGLE SHEETS API
// ==========================================

export interface LeadRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  message: string;
  date: string;
  status: string;
  type: string;
}

export async function createLeadsSpreadsheet(): Promise<{ id: string; url: string }> {
  const spreadsheet = await gFetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        title: "SP Assessoria - Controle de Leads & Consultas"
      },
      sheets: [
        {
          properties: {
            title: "Leads"
          }
        }
      ]
    })
  });

  const spreadsheetId = spreadsheet.spreadsheetId;
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  
  // Save spreadsheet id in local storage
  localStorage.setItem("sp_leads_spreadsheet_id", spreadsheetId);

  // Initialize Headers
  await syncLeadsToSpreadsheet(spreadsheetId, []);

  return { id: spreadsheetId, url };
}

export async function syncLeadsToSpreadsheet(spreadsheetId: string, leads: LeadRow[]) {
  // Clear any existing content in Sheets
  await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Leads!A1:Z1000:clear`, {
    method: "POST"
  });

  // Construct table rows
  const headers = [
    "ID do Lead",
    "Nome Completo",
    "WhatsApp / Telefone",
    "E-mail de Contato",
    "Serviço Requerido",
    "Mensagem / Descrição",
    "Data de Envio",
    "Status Atual",
    "Tipo de Solicitação"
  ];

  const rows = [headers];
  leads.forEach((l) => {
    rows.push([
      l.id,
      l.name,
      l.phone,
      l.email || "-",
      l.service || "Geral",
      l.message || "-",
      l.date || "-",
      l.status || "Novo",
      l.type || "Contato"
    ]);
  });

  // Write new data
  await gFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Leads!A1?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({
      values: rows
    })
  });
}

// ==========================================
// GOOGLE DRIVE API
// ==========================================

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink: string;
}

// Search or create a folder at root Drive or parent folder
async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  let query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  } else {
    query += " and 'root' in parents";
  }

  const encodedQuery = encodeURIComponent(query);
  const result = await gFetch(`https://www.googleapis.com/drive/v3/files?q=${encodedQuery}`);

  if (result.files && result.files.length > 0) {
    return result.files[0].id;
  }

  // Create it
  const body: any = {
    name,
    mimeType: "application/vnd.google-apps.folder"
  };
  if (parentId) {
    body.parents = [parentId];
  }

  const newFolder = await gFetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    body: JSON.stringify(body)
  });

  return newFolder.id;
}

// Create dedicated customer folder and return ID + Web Link
export async function createLeadDriveFolder(leadName: string, leadId: string): Promise<{ id: string; url: string }> {
  // 1. Find or create the master "SP Assessoria" root folder
  const rootFolderId = await findOrCreateFolder("SP Assessoria");

  // 2. Find or create the subfolder "Leads"
  const leadsFolderId = await findOrCreateFolder("Leads", rootFolderId);

  // 3. Create the specific customer folder
  const cleanDate = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  const folderName = `${leadName} (${cleanDate}) - ${leadId}`;
  
  const customerFolderId = await gFetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [leadsFolderId]
    })
  });

  // Get webViewLink
  const details = await gFetch(`https://www.googleapis.com/drive/v3/files/${customerFolderId.id}?fields=webViewLink`);

  return {
    id: customerFolderId.id,
    url: details.webViewLink
  };
}

// List all files in a specific folder
export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and trashed = false`;
  const encodedQuery = encodeURIComponent(query);
  const response = await gFetch(`https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name,mimeType,webViewLink,iconLink)`);
  return response.files || [];
}

// Upload file to Drive (base64 simple upload method)
export async function uploadFileToFolder(
  folderId: string, 
  filename: string, 
  mimeType: string, 
  base64Data: string
): Promise<DriveFile> {
  const metadata = {
    name: filename,
    parents: [folderId]
  };

  const boundary = "3P_ASSESSORIA_BOUNDARY";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  // Base64 data might contain prefix "data:image/png;base64,"
  const cleanBase64 = base64Data.includes("base64,") ? base64Data.split("base64,")[1] : base64Data;

  const metadataPart = JSON.stringify(metadata);

  // Combine into multipart payload
  const bodyParts = [
    delimiter,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    metadataPart,
    delimiter,
    `Content-Type: ${mimeType}\r\n`,
    "Content-Transfer-Encoding: base64\r\n\r\n",
    cleanBase64,
    closeDelim
  ];

  const blob = new Blob(bodyParts, { type: `multipart/related; boundary=${boundary}` });

  const token = getWorkspaceToken();
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,iconLink", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: blob
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload falhou: ${errorText}`);
  }

  return response.json();
}

// ==========================================
// GMAIL API
// ==========================================

function safeBase64Url(str: string): string {
  // Safe base64 encoding that escapes special characters and complies with RFC 4648
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmailReply(to: string, subject: string, htmlMessage: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    throw new Error(`O endereço de e-mail '${to}' é inválido.`);
  }

  // Construct standard MIME formatted message
  const utf8Subject = `=?utf-8?B?${safeBase64Url(subject)}?=`;
  const mimeParts = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    htmlMessage
  ];

  const mimeString = mimeParts.join("\r\n");
  const rawBase64 = safeBase64Url(mimeString);

  await gFetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({
      raw: rawBase64
    })
  });
}

// ==========================================
// GOOGLE TASKS API
// ==========================================

export async function createGoogleTask(title: string, notes: string, dueISO?: string) {
  // Get default tasklist
  const lists = await gFetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists");
  const defaultList = lists.items?.[0];
  
  if (!defaultList) {
    throw new Error("Nenhuma lista de tarefas do Google encontrada.");
  }

  const body: any = {
    title,
    notes
  };

  if (dueISO) {
    // Formatted as RFC 3339 timestamp
    body.due = dueISO;
  }

  return gFetch(`https://tasks.googleapis.com/tasks/v1/lists/${defaultList.id}/tasks`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}
