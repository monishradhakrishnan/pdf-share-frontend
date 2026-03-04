import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BASE_URL = "http://10.150.20.188:5000/api"; // ← Replace with YOUR PC's IPv4

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const signup          = (data)                    => api.post("/auth/signup", data);
export const login           = (data)                    => api.post("/auth/login", data);
export const getPDFs         = ()                        => api.get("/pdfs");
export const getPDF          = (id)                      => api.get(`/pdfs/${id}`);
export const deletePDF       = (id)                      => api.delete(`/pdfs/${id}`);
export const downloadURL     = (id)                      => `${BASE_URL}/pdfs/${id}/download`;
export const searchUsers     = (email)                   => api.get(`/users/search?email=${email}`);
export const getSharedWithMe = ()                        => api.get("/pdfs/shared/with-me");

// expiryMinutes: number of minutes before access expires, null = no expiry
export const sharePDF = (id, userId, expiryMinutes) => {
  console.log("api.js sharePDF called with:", { id, userId, expiryMinutes });
  return api.post(`/pdfs/${id}/share`, { userId, expiryMinutes });
};

export const uploadPDF = async (file, token) => {
  const form = new FormData();
  form.append("file", { uri: file.uri, name: file.name, type: "application/pdf" });
  return axios.post(`${BASE_URL}/pdfs/upload`, form, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
  });
};

export default api;