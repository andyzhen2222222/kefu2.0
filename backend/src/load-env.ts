/**
 * 始终从 backend/.env 加载，避免从仓库根目录或其它 cwd 启动时读不到配置（表现为 AI 一直走「未配置」回退）。
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env') });
