export default () => ({
  port: parseInt(process.env.BACKEND_PORT || '3001', 10),
  database: {
    url: process.env.PGDATABASE_URL || process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibeai',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'vibeai-dev-secret-key-change-in-production',
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