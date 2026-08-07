import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly fromAddress: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    this.fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@vibeai.com';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
      this.logger.log(`Email service initialized: ${host}:${port} (secure=${secure})`);
    } else {
      this.logger.warn('Email service not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing). Password reset tokens will be returned in API response.');
    }
  }

  isEmailEnabled(): boolean {
    return this.transporter !== null;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Email not sent (service not configured): ${options.subject} -> ${options.to}`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
      });
      this.logger.log(`Email sent: "${options.subject}" -> ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #10b981; font-size: 24px; margin: 0;">VibeAI</h1>
          <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">AI 内容创作平台</p>
        </div>
        <div style="background: #f9fafb; border-radius: 12px; padding: 32px;">
          <h2 style="color: #111827; font-size: 18px; margin: 0 0 16px;">重置您的密码</h2>
          <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
            我们收到了您的密码重置请求。点击下方按钮重置密码，链接将在 15 分钟后失效。
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}"
               style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: 500;">
              重置密码
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">
            如果按钮无法点击，请复制以下链接到浏览器：<br/>
            <span style="color: #6b7280; word-break: break-all;">${resetUrl}</span>
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">
            如果您没有请求重置密码，请忽略此邮件。您的密码不会被更改。
          </p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
          © ${new Date().getFullYear()} VibeAI. All rights reserved.
        </p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: 'VibeAI - 密码重置',
      html,
      text: `VibeAI 密码重置\n\n请点击以下链接重置密码（15分钟内有效）：\n${resetUrl}\n\n如果您没有请求重置密码，请忽略此邮件。`,
    });
  }
}
