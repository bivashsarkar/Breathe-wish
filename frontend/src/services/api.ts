import axios from "axios";
import type { ApiErrorBody } from "../types";

const configuredBase =
  typeof import.meta.env.VITE_API_URL === "string" && import.meta.env.VITE_API_URL.trim()
    ? import.meta.env.VITE_API_URL.trim()
    : "http://127.0.0.1:5000/api";

export const API_BASE_URL = configuredBase.replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 22_000,
  headers: {
    "Content-Type": "application/json",
  },
});

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.error?.message;
    if (message) return message;
    if (error.code === "ECONNABORTED") {
      return "The request took too long. Check your connection and try again.";
    }
    if (!error.response) {
      return `Cannot reach the BreatheWise API at ${API_BASE_URL}. Make sure the backend is running.`;
    }
    if (error.response.status === 429) {
      return "Too many requests. Please wait a moment and try again.";
    }
    if (error.response.status >= 500) {
      return "The BreatheWise API had a problem. Please try again shortly.";
    }
    return `Request failed (${error.response.status}). Please try again.`;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

export default api;
