import axios from "axios";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BASE_URL = "https://pdf-share-backend.onrender.com/api"; // ← Replace with YOUR PC's IPv4

const api = axios.create({ baseURL: BASE_URL,timeout: 15000, });

// ── Attach token automatically ─────────────────────────────
api.interceptors.request.use(async (config) => {
  let token;

  if (Platform.OS === "web") {
    token = localStorage.getItem("token");
  } else {
    token = await AsyncStorage.getItem("token");
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ── Auth ───────────────────────────────────────────────────
export const login  = (data) => api.post("/auth/login", data);
export const signup = (data) => api.post("/auth/signup", data);

// ── PDFs ───────────────────────────────────────────────────
export const getPDFs     = () => api.get("/pdfs");
export const getPDF      = (id) => api.get(`/pdfs/${id}`);
export const deletePDF   = (id) => api.delete(`/pdfs/${id}`);
export const downloadURL = (id) => `${BASE_URL}/pdfs/${id}/download`;

export const uploadPDF = async (file, token) => {
  const form = new FormData();
  const cleanName = decodeURIComponent(file.name);

  form.append("file", {
    uri: file.uri,
    name: cleanName,
    type: "application/pdf",
  });

  return axios.post(`${BASE_URL}/pdfs/upload`, form, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
};

// ── Sharing ────────────────────────────────────────────────
export const searchUsers     = (q) => api.get(`/users/search?email=${q}`);
export const getSharedWithMe = () => api.get("/pdfs/shared/with-me");
export const removeSharedPDF = (id) => api.delete(`/pdfs/${id}/shared`);

export const sharePDF = (id, userId, expiryMinutes) =>
  api.post(`/pdfs/${id}/share`, { userId, expiryMinutes });

// ── Print Requests ─────────────────────────────────────────
export const getPrintShops = () => api.get("/print/shops");  // was "/shops"
export const submitPrintRequest = (
  pdfId,
  copies,
  printAdminId,
  disappearAfterPrint = false,
  colorMode = "bw"
) =>
  api.post("/print/request", {
    pdfId,
    copies,
    printAdminId,
    disappearAfterPrint,
    colorMode,
  });

export const getMyPrintRequests = () => api.get("/print/my-requests");
export const getPrintQueue      = () => api.get("/print/queue");
export const getPrintBills      = () => api.get("/print/bills");

export const markAsPrinted = (id) =>
  api.patch(`/print/${id}/print`);

export const rejectPrintRequest = (id, reason) =>
  api.patch(`/print/${id}/reject`, { reason });

// ── Notifications ──────────────────────────────────────────
export const getNotifications  = () => api.get("/notifications");
export const markNotifRead     = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotifsRead = () => api.patch("/notifications/read-all");

export default api;