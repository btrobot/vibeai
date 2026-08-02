import { vi } from 'vitest';

// 设置测试环境变量
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_EXPIRES_IN = '900';
process.env.JWT_REFRESH_EXPIRES_IN = '604800';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NODE_ENV = 'test';
process.env.STORAGE_TYPE = 'local';
process.env.STORAGE_PATH = '/tmp/test-storage';
process.env.COZE_BASE_URL = 'https://api.coze.cn';
process.env.COZE_API_KEY = 'test-coze-api-key';

// 全局 Mock：ConfigService（如果 Service 仍依赖它）
vi.mock('@nestjs/config', () => ({
  ConfigService: vi.fn().mockImplementation(() => ({
    get: vi.fn((key: string, defaultValue?: unknown) => {
      const envMap: Record<string, string> = {
        'jwt.secret': 'test-jwt-secret-key',
        'jwt.expiresIn': '900',
        'jwt.refreshExpiresIn': '604800',
        'database.url': 'postgresql://test:test@localhost:5432/test',
        'storage.type': 'local',
        'storage.path': '/tmp/test-storage',
        'coze.baseUrl': 'https://api.coze.cn',
        'coze.apiKey': 'test-coze-api-key',
      };
      return envMap[key] ?? defaultValue;
    }),
  })),
  ConfigModule: {
    forRoot: vi.fn().mockReturnValue({ module: 'ConfigModule', providers: [], exports: [] }),
    forFeature: vi.fn().mockReturnValue({ module: 'ConfigFeatureModule', providers: [], exports: [] }),
  },
}));