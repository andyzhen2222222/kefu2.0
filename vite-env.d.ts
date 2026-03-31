/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** mock | api：强制数据源；不设则仅由 VITE_API_BASE_URL 是否为空决定 */
  readonly VITE_INTELLIDESK_DATA_SOURCE?: string;
  readonly VITE_API_BASE_URL?: string;
  /** 默认与 backend prisma seed 租户一致 */
  readonly VITE_INTELLIDESK_TENANT_ID?: string;
  /** 演示鉴权：与 seed admin 或 Firebase UUID 对齐，用于 X-User-Id */
  readonly VITE_INTELLIDESK_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
