import { Injectable, BadRequestException } from '@nestjs/common';

export interface OAuthUserInfo {
  provider: string;
  providerAccountId: string;
  email: string;
  name: string | null;
  avatar: string | null;
  providerData: Record<string, unknown>;
}

export interface OAuthProviderConfig {
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
}

@Injectable()
export class OAuthService {
  private get domain(): string {
    return process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
  }

  private getProviderConfig(provider: string): OAuthProviderConfig {
    const redirectUri = `${this.domain}/api/auth/oauth/${provider}/callback`;

    if (provider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
      if (!clientId || !clientSecret) {
        throw new BadRequestException('Google OAuth 未配置，请设置 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET 环境变量');
      }
      return {
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
        scope: 'openid email profile',
        clientId,
        clientSecret,
      };
    }

    if (provider === 'github') {
      const clientId = process.env.GITHUB_CLIENT_ID || '';
      const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
      if (!clientId || !clientSecret) {
        throw new BadRequestException('GitHub OAuth 未配置，请设置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET 环境变量');
      }
      return {
        authorizationUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        scope: 'user:email read:user',
        clientId,
        clientSecret,
      };
    }

    throw new BadRequestException(`不支持的 OAuth 提供商: ${provider}`);
  }

  getAuthorizationRedirect(provider: string): string {
    const config = this.getProviderConfig(provider);
    const redirectUri = `${this.domain}/api/auth/oauth/${provider}/callback`;
    const state = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scope,
      state,
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  async exchangeCodeForUser(provider: string, code: string): Promise<OAuthUserInfo> {
    const config = this.getProviderConfig(provider);
    const redirectUri = `${this.domain}/api/auth/oauth/${provider}/callback`;

    // Exchange code for access token
    const tokenBody: Record<string, string> = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };

    const tokenHeaders: Record<string, string> =
      provider === 'github'
        ? { Accept: 'application/json', 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/x-www-form-urlencoded' };

    const tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: tokenHeaders,
      body: provider === 'github' ? JSON.stringify(tokenBody) : new URLSearchParams(tokenBody).toString(),
    });

    if (!tokenRes.ok) {
      throw new BadRequestException(`${provider} OAuth 令牌交换失败: ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json() as { access_token: string; error?: string; error_description?: string };

    if (tokenData.error || !tokenData.access_token) {
      throw new BadRequestException(`${provider} OAuth 令牌交换失败: ${tokenData.error_description || tokenData.error || '未知错误'}`);
    }

    const accessToken = tokenData.access_token;

    // Fetch user info
    const userHeaders: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    if (provider === 'github') {
      userHeaders['Accept'] = 'application/vnd.github+json';
    }

    const userRes = await fetch(config.userInfoUrl, { headers: userHeaders });
    if (!userRes.ok) {
      throw new BadRequestException(`${provider} 用户信息获取失败: ${userRes.status}`);
    }

    const userData = await userRes.json() as Record<string, unknown>;

    return this.normalizeUserInfo(provider, userData);
  }

  private normalizeUserInfo(provider: string, data: Record<string, unknown>): OAuthUserInfo {
    if (provider === 'google') {
      return {
        provider,
        providerAccountId: String(data.sub || ''),
        email: String(data.email || ''),
        name: (data.name as string) || null,
        avatar: (data.picture as string) || null,
        providerData: data,
      };
    }

    if (provider === 'github') {
      return {
        provider,
        providerAccountId: String(data.id || ''),
        email: String(data.email || ''),
        name: (data.name as string) || (data.login as string) || null,
        avatar: (data.avatar_url as string) || null,
        providerData: data,
      };
    }

    throw new BadRequestException(`不支持的 OAuth 提供商: ${provider}`);
  }

  isOAuthConfigured(provider: string): boolean {
    if (provider === 'google') {
      return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    }
    if (provider === 'github') {
      return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    }
    return false;
  }

  getFrontendCallbackUrl(accessToken: string, refreshToken: string): string {
    const params = new URLSearchParams({ accessToken, refreshToken });
    return `${this.domain}/oauth-callback?${params.toString()}`;
  }
}
