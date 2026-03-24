import axios from "axios";
import { Platform } from "react-native";


export const BASE_URL = "https://pdf-share-backend.onrender.com/api"; // ← Replace with YOUR PC's IPv4

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  let token;
  if (Platform.OS === "web") {
    token = localStorage.getItem("token");
  } else {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    token = await AsyncStorage.getItem("token");
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const login           = (data) => api.post("/auth/login", data);
export const signup          = (data) => api.post("/auth/signup", data);
export const getPDFs         = ()     => api.get("/pdfs");
export const getPDF          = (id)   => api.get(`/pdfs/${id}`);
export const deletePDF       = (id)   => api.delete(`/pdfs/${id}`);
export const downloadURL     = (id)   => `${BASE_URL}/pdfs/${id}/download`;
export const searchUsers     = (q)    => api.get(`/users/search?email=${q}`);
export const getSharedWithMe = ()     => api.get("/pdfs/shared/with-me");
export const removeSharedPDF = (id)   => api.delete(`/pdfs/${id}/shared`);
export const sharePDF = (id, userId, expiryMinutes) => api.post(`/pdfs/${id}/share`, { userId, expiryMinutes });

export const uploadPDF = async (file, token) => {
  const form = new FormData();
  const cleanName = decodeURIComponent(file.name);
  form.append("file", { uri: file.uri, name: cleanName, type: "application/pdf" });
  return axios.post(`${BASE_URL}/pdfs/upload`, form, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
  });
};

export default api;