import { getJwtSecret } from '../common/jwt-secret';
import { config } from 'dotenv';
import path from 'path';

// 加载 .env.local（宿主机部署）> .env（本地开发）
config({ path: path.resolve(__dirname, '..', '..', '.env.local'), override: false });
config({ path: path.resolve(__dirname, '..', '..', 'server', '.env'), override: false });

export default () => ({
  port: parseInt(process.env.BACKEND_PORT || '3001', 10),
  database: {
    url: process.env.PGDATABASE_URL || process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibeai',
  },
  jwt: {
    secret: getJwtSecret(),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  bcrypt: {
    saltRounds: 12,
  },
  cors: {
    origin: process.env.CORS_ORIGIN || true,
  },
});