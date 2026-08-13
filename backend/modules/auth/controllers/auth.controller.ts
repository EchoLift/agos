import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
} from "@nestjs/swagger";
import type { Request, Response, CookieOptions } from "express";
import { AuthService } from "../services/auth.service";
import { RegisterDto } from "../dto/register.dto";
import { LoginDto } from "../dto/login.dto";
import { GoogleOAuthDto } from "../dto/google-oauth.dto";
import { Public } from "@packages/security/decorators/public.decorator";

@ApiTags("Auth")
@Public()
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "User successfully registered",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Validation failed or email in use",
  })
  async register(@Body() dto: RegisterDto) {
    await this.authService.register(dto);

    return {
      success: true,
      message: "User registered",
    };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login and establish a session" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Returns access token and sets refresh token cookie",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Invalid credentials",
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.login(dto);

    this.setRefreshTokenCookie(res, refreshToken);

    return {
      accessToken,
      expiresIn: 900,
    };
  }

  @Post("google")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Login or register using a Google ID token",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Returns access token and sets refresh token cookie",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Invalid Google token",
  })
  async google(
    @Body() dto: GoogleOAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.googleLogin(dto.token);

    this.setRefreshTokenCookie(res, refreshToken);

    return {
      accessToken,
      expiresIn: 900,
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth("refreshToken")
  @ApiOperation({
    summary: "Rotate refresh token and get a new access token",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      "Returns new access token and updates refresh token cookie",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Invalid or missing refresh token",
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(
        "Refresh token missing",
      );
    }

    const {
      accessToken,
      refreshToken: newRefreshToken,
    } = await this.authService.refresh(refreshToken);

    this.setRefreshTokenCookie(
      res,
      newRefreshToken,
    );

    return {
      accessToken,
      expiresIn: 900,
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth("refreshToken")
  @ApiOperation({
    summary: "Logout and clear session",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      "Session revoked and cookie cleared",
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      req.cookies?.refreshToken;

    if (refreshToken) {
      await this.authService.logout(
        refreshToken,
      );
    }

    res.clearCookie(
      "refreshToken",
      this.getRefreshCookieOptions(),
    );

    return {
      success: true,
    };
  }

  private getRefreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/v1/auth",
    };
  }

  private setRefreshTokenCookie(
    res: Response,
    token: string,
  ) {
    res.cookie("refreshToken", token, {
      ...this.getRefreshCookieOptions(),
      maxAge:
        30 * 24 * 60 * 60 * 1000,
    });
  }
}