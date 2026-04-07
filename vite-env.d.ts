/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** mock | api：强制数据源；不设则仅由 VITE_API_BASE_URL 是否为空决定 */
  readonly VITE_INTELLIDESK_DATA_SOURCE?: string;
  readonly VITE_API_BASE_URL?: string;
  /** 浏览器直连豆包/方舟（仅本地演示；生产建议只用后端 /api/ai/*） */
  readonly VITE_DOUBAO_API_KEY?: string;
  /** 模型名（如 doubao-seed-1-8-251228）或 ep- 接入点；优先读 VITE_DOUBAO_MODEL_ID */
  readonly VITE_DOUBAO_ENDPOINT_ID?: string;
  readonly VITE_DOUBAO_MODEL_ID?: string;
  /** 可选：强制 responses | chat（默认：ep- 前缀走 chat，否则走 responses） */
  readonly VITE_DOUBAO_API_MODE?: string;
  readonly VITE_DOUBAO_BASE_URL?: string;
  /** 浏览器直连 Gemini 时的模型名 */
  readonly VITE_GEMINI_MODEL?: string;
  /** 默认与 backend prisma seed 租户一致 */
  readonly VITE_INTELLIDESK_TENANT_ID?: string;
  /** 演示鉴权：与 seed admin 或 Firebase UUID 对齐，用于 X-User-Id */
  readonly VITE_INTELLIDESK_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
