import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom 未实现 URL.createObjectURL / revokeObjectURL（WorkspacePage 上传预览依赖）
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-preview') as unknown as typeof URL.createObjectURL;
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
}
