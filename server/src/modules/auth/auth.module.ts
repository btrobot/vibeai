import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => {
        const expiresIn = (process.env['JWT_ACCESS_EXPIRES_IN'] || '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`;
        return {
          secret: process.env['JWT_SECRET'] || 'vibeai-dev-jwt-secret-key-2026',
          signOptions: { expiresIn },
        };
      },
    }),
    UserModule,
  ],
  controllers: [AuthController],
  providers: [
    { provide: 'AUTH_SERVICE', useClass: AuthService },
    OAuthService,
    JwtStrategy,
  ],
  exports: ['AUTH_SERVICE', JwtModule, PassportModule],
})
export class AuthModule {}