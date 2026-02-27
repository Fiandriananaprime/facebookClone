const trim = (value) => (typeof value === "string" ? value.trim() : "");
const isUrl = (value) => /^https?:\/\/[^/\s]+$/i.test(value);

const getRuntimeUrl = (key) => {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  const fromQuery = trim(params.get(key));
  if (isUrl(fromQuery)) {
    localStorage.setItem(`chat_${key}_url`, fromQuery);
    return fromQuery;
  }

  const fromStorage = trim(localStorage.getItem(`chat_${key}_url`));
  if (isUrl(fromStorage)) {
    return fromStorage;
  }

  return "";
};

const getDefaultApiBaseUrl = () => {
  if (typeof window === "undefined") {
    return "http://localhost:5000";
  }

  const { protocol, hostname, origin } = window.location;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocal) {
    return "http://localhost:5000";
  }

  return `${origin}/api`;
};

export const RUNTIME_API_URL = getRuntimeUrl("api");
export const RUNTIME_SOCKET_URL = getRuntimeUrl("socket");

export const API_BASE_URL = RUNTIME_API_URL || trim(import.meta.env.VITE_API_URL) || getDefaultApiBaseUrl();
export const SOCKET_URL =
  RUNTIME_SOCKET_URL ||
  trim(import.meta.env.VITE_SOCKET_URL) ||
  (typeof window === "undefined" ? "http://localhost:5000" : window.location.origin);
export const SOCKET_PATH = trim(import.meta.env.VITE_SOCKET_PATH) || "/socket.io";

export const getApiHeaders = (customHeaders = {}) => {
  const headers = { ...customHeaders };

  try {
    const host = new URL(API_BASE_URL).hostname;
    if (host.includes("ngrok")) {
      headers["ngrok-skip-browser-warning"] = "true";
    }
  } catch (_error) {
    // Ignore invalid URL parse and keep default headers.
  }

  return headers;
};
