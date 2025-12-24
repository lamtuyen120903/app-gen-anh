import { ProjectData, User, UsageLog, UsageSummary } from "../types";

// --- CONFIGURATION ---
// Connected to: ADS_BANNER_AI_DB
// Updated Deployment (Usage Logs Support):
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxidCuzd_LNei24zh-ukX3lAlHSxfqt6B2EWcWmuoxipEklsWTpagy1JnMaKywVmgfDPg/exec'; 

// ID của Google Drive Folder tổng để lưu dữ liệu dự án
const DRIVE_FOLDER_ID = '1BpHPWg7-IulR2AZNXu8PPaRTvMzREA8S';

const checkUrl = () => {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PASTE_YOUR')) {
    console.error("CRITICAL: Backend URL is missing inside services/googleBackend.ts");
    alert("System Error: Backend URL not configured. Please paste the Apps Script URL in the code.");
    return false;
  }
  return true;
};

// HELPER FOR HEADERS - CRITICAL FOR CORS
// Apps Script requires this specific header to accept POST requests without preflight OPTION failure
const REQUEST_HEADERS = {
  "Content-Type": "text/plain;charset=utf-8",
};

// HELPER FOR OPTIONS - CRITICAL FOR REDIRECTS
// Google Apps Script Web Apps often redirect. We must follow them.
const FETCH_OPTIONS = (method: string, body?: any): RequestInit => ({
    method,
    headers: REQUEST_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'follow' as RequestRedirect
});

// --- AUTH & USER MANAGEMENT ---

export const loginUser = async (username: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> => {
  if (!checkUrl()) return { success: false, message: "Backend configuration missing" };

  try {
    const response = await fetch(APPS_SCRIPT_URL, FETCH_OPTIONS('POST', {
        action: 'LOGIN',
        payload: { username, password }
    }));
    return await response.json();
  } catch (error) {
    console.error(error);
    return { success: false, message: "Network error during login. Please try again." };
  }
};

export const changePassword = async (userId: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
  if (!checkUrl()) return { success: false, message: "Backend configuration missing" };
  try {
    const response = await fetch(APPS_SCRIPT_URL, FETCH_OPTIONS('POST', {
        action: 'CHANGE_PASSWORD',
        payload: { userId, newPassword }
    }));
    return await response.json();
  } catch (e) { return { success: false, message: "Network error" }; }
};

// Admin Only
export const getAllUsers = async (adminId: string): Promise<{ success: boolean; users?: any[], message?: string }> => {
  if (!checkUrl()) return { success: false, message: "Backend configuration missing" };
  try {
    const url = `${APPS_SCRIPT_URL}?action=GET_ALL_USERS&adminId=${adminId}`;
    const response = await fetch(url, { redirect: 'follow' });
    return await response.json();
  } catch (e) { return { success: false, message: "Network error" }; }
};

// Admin Only: Add or Update User
export const manageUser = async (adminId: string, userData: any, actionType: 'ADD' | 'UPDATE' | 'DELETE'): Promise<{ success: boolean; message: string }> => {
  if (!checkUrl()) return { success: false, message: "Backend configuration missing" };
  try {
    const response = await fetch(APPS_SCRIPT_URL, FETCH_OPTIONS('POST', {
        action: 'MANAGE_USER',
        payload: { adminId, userData, actionType }
    }));
    return await response.json();
  } catch (e) { return { success: false, message: "Network error" }; }
};

// --- PROJECT MANAGEMENT ---

export const saveProjectToBackend = async (data: ProjectData): Promise<{ success: boolean; message: string }> => {
  if (!checkUrl()) return { success: false, message: "Backend configuration missing" };

  try {
    // Inject folderId into the payload so the backend knows where to save
    const payloadWithFolder = {
      ...data,
      folderId: DRIVE_FOLDER_ID
    };

    const response = await fetch(APPS_SCRIPT_URL, FETCH_OPTIONS('POST', {
        action: 'SAVE_PROJECT',
        payload: payloadWithFolder
    }));

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Save Error:", error);
    return { success: false, message: "Network error saving project: " + String(error) };
  }
};

export const loadProjectsFromBackend = async (userId: string, role: string): Promise<{ success: boolean; projects?: any[], message?: string }> => {
  if (!checkUrl()) return { success: false, message: "Backend configuration missing" };

  try {
    const url = `${APPS_SCRIPT_URL}?action=GET_PROJECTS&userId=${userId}&role=${role}`;
    const response = await fetch(url, { redirect: 'follow' });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Load Error:", error);
    return { success: false, message: "Network error loading projects." };
  }
};

// NEW: Fetch full project data from Drive File
export const loadProjectData = async (fileId: string): Promise<{ success: boolean; data?: any; message?: string }> => {
  if (!checkUrl()) return { success: false, message: "Backend configuration missing" };

  try {
    const url = `${APPS_SCRIPT_URL}?action=LOAD_PROJECT&fileId=${fileId}`;
    const response = await fetch(url, { redirect: 'follow' });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Load File Error:", error);
    return { success: false, message: "Network error loading project data." };
  }
};

export const shareProject = async (projectId: string, sharedWith: string[]): Promise<{ success: boolean; message: string }> => {
  if (!checkUrl()) return { success: false, message: "Backend configuration missing" };
  try {
    const response = await fetch(APPS_SCRIPT_URL, FETCH_OPTIONS('POST', {
        action: 'SHARE_PROJECT',
        payload: { projectId, sharedWith }
    }));
    return await response.json();
  } catch (e) { return { success: false, message: "Network error" }; }
};

// --- USAGE & COST MANAGEMENT ---

export const logUsage = async (userId: string, actionType: string, quantity: number, cost: number, details: string): Promise<void> => {
  if (!checkUrl()) return;
  // Fire and forget - don't block the UI
  fetch(APPS_SCRIPT_URL, FETCH_OPTIONS('POST', {
      action: 'LOG_USAGE',
      payload: { userId, actionType, quantity, cost, details }
  })).catch(e => console.error("Failed to log usage:", e));
};

export const getUsageStats = async (
    userId: string, 
    role: string, 
    startDate?: string, 
    endDate?: string,
    targetUserId?: string
): Promise<{ success: boolean; logs?: UsageLog[], summary?: UsageSummary[], message?: string }> => {
  if (!checkUrl()) return { success: false, message: "Backend config missing" };
  
  try {
    let url = `${APPS_SCRIPT_URL}?action=GET_USAGE_STATS&userId=${userId}&role=${role}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (targetUserId) url += `&targetUserId=${targetUserId}`;

    const response = await fetch(url, { redirect: 'follow' });
    const text = await response.text();
    
    try {
        const json = JSON.parse(text);
        if (json.success !== undefined) {
             return json;
        }
        throw new Error("Invalid format");
    } catch (parseError) {
        console.warn("Backend returned non-JSON response:", text);
        // Fallback for demo if backend isn't ready
        return { 
            success: true, 
            message: "Showing demo usage data (Backend not updated)",
            logs: [],
            summary: []
        };
    }
  } catch (e) { 
      return { success: false, message: "Network connection failed" }; 
  }
};
