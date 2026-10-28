/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Backend API base URL, including the `/api` suffix.
   * Example: `https://your-backend.example.com/api`
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
