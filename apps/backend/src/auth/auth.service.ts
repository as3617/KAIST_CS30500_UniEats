import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  ScryptOptions,
  timingSafeEqual,
} from "crypto";
import { Model, Types } from "mongoose";
import { AuthTokenType, UserRole } from "../common/enums";
import { User } from "../users/schemas/user.schema";
import { AuthToken } from "./schemas/auth-token.schema";

const EMAIL_PATTERN = /^[^@\s]+@kaist\.ac\.kr$/;
const PASSWORD_HASH_PREFIX = "scrypt";
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SCRYPT_OPTIONS: ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

function deriveKey(
  password: string,
  salt: string,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

export interface RegisterBody {
  email?: string;
  password?: string;
  nickname?: string;
}

export interface LoginBody {
  email?: string;
  password?: string;
}

export interface RefreshBody {
  refreshToken?: string;
}

export interface TokenBody {
  refreshToken?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  isEmailVerified: boolean;
}

type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  exp: number;
};

@Injectable()
export class AuthService {
  private readonly accessTokenSecret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlDays: number;

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(AuthToken.name)
    private readonly authTokenModel: Model<AuthToken>,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenSecret =
      this.configService.get<string>("ACCESS_TOKEN_SECRET")?.trim() ||
      randomBytes(32).toString("base64url");
    this.accessTokenTtlSeconds = Number(
      this.configService.get<string>("ACCESS_TOKEN_TTL_SECONDS", "900"),
    );
    this.refreshTokenTtlDays = Number(
      this.configService.get<string>("REFRESH_TOKEN_TTL_DAYS", "30"),
    );
  }

  async register(body?: RegisterBody) {
    const email = this.normalizeEmail(body?.email);
    const password = this.normalizePassword(body?.password, { enforceStrength: true });
    const nickname = this.normalizeNickname(body?.nickname);

    const passwordHash = await this.hashPassword(password);

    try {
      const user = await this.userModel.create({
        email,
        passwordHash,
        nickname,
        role: UserRole.USER,
        isEmailVerified: false,
      });
      await this.createStoredToken(user._id as Types.ObjectId, AuthTokenType.EMAIL_VERIFY, 24);

      return {
        userId: user._id.toString(),
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      };
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException("email already registered");
      }
      throw error;
    }
  }

  async verifyEmail(token?: string) {
    if (!token?.trim()) {
      throw new BadRequestException("token is required");
    }

    const tokenHash = this.hashToken(token.trim());
    const authToken = await this.authTokenModel
      .findOne({
        tokenHash,
        type: AuthTokenType.EMAIL_VERIFY,
        usedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      })
      .exec();

    if (!authToken) {
      throw new UnauthorizedException("invalid or expired token");
    }

    await Promise.all([
      this.userModel.updateOne({ _id: authToken.userId }, { isEmailVerified: true }).exec(),
      this.authTokenModel
        .updateOne({ _id: authToken._id }, { usedAt: new Date() })
        .exec(),
    ]);

    return { isEmailVerified: true };
  }

  async login(body?: LoginBody) {
    const email = this.normalizeEmail(body?.email);
    const password = this.normalizePassword(body?.password, { enforceStrength: false });

    const user = await this.userModel.findOne({ email }).exec();
    if (!user || !(await this.verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Email or password is incorrect");
    }

    const refreshToken = await this.createStoredToken(
      user._id as Types.ObjectId,
      AuthTokenType.REFRESH_TOKEN,
      this.refreshTokenTtlDays * 24,
    );

    return {
      accessToken: this.createAccessToken(user._id.toString(), user.role),
      refreshToken,
      user: this.toAuthUser(user),
    };
  }

  async refresh(body?: RefreshBody) {
    const refreshToken = this.normalizeToken(body?.refreshToken);
    const tokenHash = this.hashToken(refreshToken);
    const authToken = await this.authTokenModel
      .findOneAndUpdate(
        {
          tokenHash,
          type: AuthTokenType.REFRESH_TOKEN,
          usedAt: { $exists: false },
          expiresAt: { $gt: new Date() },
        },
        { usedAt: new Date() },
      )
      .exec();

    if (!authToken) {
      throw new UnauthorizedException("invalid or expired refresh token");
    }

    const user = await this.userModel.findById(authToken.userId).exec();
    if (!user) {
      throw new UnauthorizedException("invalid refresh token");
    }

    const nextRefreshToken = await this.createStoredToken(
      user._id as Types.ObjectId,
      AuthTokenType.REFRESH_TOKEN,
      this.refreshTokenTtlDays * 24,
    );

    return {
      accessToken: this.createAccessToken(user._id.toString(), user.role),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(body?: TokenBody) {
    const refreshToken = this.normalizeToken(body?.refreshToken);
    const tokenHash = this.hashToken(refreshToken);

    await this.authTokenModel
      .updateOne(
        {
          tokenHash,
          type: AuthTokenType.REFRESH_TOKEN,
          usedAt: { $exists: false },
        },
        { usedAt: new Date() },
      )
      .exec();

    return {};
  }

  async getMe(authorization?: string) {
    return this.requireUser(authorization);
  }

  async requireUser(
    authorization?: string,
    options: { requireEmailVerified?: boolean } = {},
  ): Promise<AuthenticatedUser> {
    const payload = this.verifyAccessToken(authorization);
    const user = await this.userModel.findById(payload.sub).exec();

    if (!user) {
      throw new UnauthorizedException("invalid access token");
    }

    if (options.requireEmailVerified && !user.isEmailVerified) {
      throw new ForbiddenException("email verification required");
    }

    return this.toAuthUser(user);
  }

  private normalizeEmail(email?: string): string {
    const value = email?.trim().toLowerCase();
    if (!value) {
      throw new BadRequestException("email is required");
    }
    if (!EMAIL_PATTERN.test(value)) {
      throw new BadRequestException("Only kaist.ac.kr emails are allowed");
    }
    return value;
  }

  private normalizePassword(
    password: string | undefined,
    options: { enforceStrength: boolean },
  ): string {
    if (!password) {
      throw new BadRequestException("password is required");
    }
    if (options.enforceStrength && password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters long");
    }
    return password;
  }

  private normalizeNickname(nickname?: string): string {
    const value = nickname?.trim();
    if (!value) {
      throw new BadRequestException("nickname is required");
    }
    if (value.length < 2 || value.length > 24) {
      throw new BadRequestException("nickname must be between 2 and 24 characters");
    }
    return value;
  }

  private normalizeToken(token?: string): string {
    const value = token?.trim();
    if (!value) {
      throw new BadRequestException("refreshToken is required");
    }
    return value;
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("base64url");
    const derivedKey = await deriveKey(
      password,
      salt,
      PASSWORD_KEY_LENGTH,
      PASSWORD_SCRYPT_OPTIONS,
    );

    return [
      PASSWORD_HASH_PREFIX,
      PASSWORD_SCRYPT_OPTIONS.N,
      salt,
      derivedKey.toString("base64url"),
    ].join("$");
  }

  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [prefix, rawN, salt, hash] = storedHash.split("$");
    if (prefix !== PASSWORD_HASH_PREFIX || !rawN || !salt || !hash) {
      return false;
    }

    const derivedKey = await deriveKey(
      password,
      salt,
      Buffer.from(hash, "base64url").length,
      {
        ...PASSWORD_SCRYPT_OPTIONS,
        N: Number(rawN),
      },
    );
    const expected = Buffer.from(hash, "base64url");

    return (
      expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey)
    );
  }

  private async createStoredToken(
    userId: Types.ObjectId,
    type: AuthTokenType,
    ttlHours: number,
  ): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.authTokenModel.create({
      userId,
      type,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    });
    return token;
  }

  private createAccessToken(userId: string, role: UserRole): string {
    const payload: AccessTokenPayload = {
      sub: userId,
      role,
      exp: Math.floor(Date.now() / 1000) + this.accessTokenTtlSeconds,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.sign(encodedPayload);
    return `v1.${encodedPayload}.${signature}`;
  }

  private verifyAccessToken(authorization?: string): AccessTokenPayload {
    const [scheme, token = ""] = authorization?.trim().split(/\s+/, 2) ?? [];
    if (scheme?.toLowerCase() !== "bearer") {
      throw new UnauthorizedException("invalid access token");
    }

    const [version, encodedPayload, signature] = token.split(".");

    if (version !== "v1" || !encodedPayload || !signature) {
      throw new UnauthorizedException("invalid access token");
    }

    const expectedSignature = this.sign(encodedPayload);
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("invalid access token");
    }

    let payload: AccessTokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
      ) as AccessTokenPayload;
    } catch {
      throw new UnauthorizedException("invalid access token");
    }

    if (!Types.ObjectId.isValid(payload.sub) || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException("invalid or expired access token");
    }

    return payload;
  }

  private sign(value: string): string {
    return createHmac("sha256", this.accessTokenSecret).update(value).digest("base64url");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private toAuthUser(user: User & { _id: Types.ObjectId }): AuthenticatedUser {
    return {
      id: user._id.toString(),
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === 11000
    );
  }
}
