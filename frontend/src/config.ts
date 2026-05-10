// In dev, Vite proxies /api/* to localhost:8001 (stripping /api).
// In production (Vercel), VITE_API_BASE_URL points directly at the Render service,
// so calls become https://your-service.onrender.com/transcribe etc.
export const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? '/api'
