import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorDetail, ApiErrorResponse } from './api-error.response.js';

export class AppException extends HttpException {
  public readonly code: string;
  public readonly details: ApiErrorDetail[];

  constructor(
    statusCode: HttpStatus,
    code: string,
    message: string,
    details: ApiErrorDetail[] = [],
  ) {
    const responsePayload: ApiErrorResponse = {
      error: {
        code,
        message,
        details,
      },
    };
    super(responsePayload, statusCode);
    this.code = code;
    this.details = details;
  }
}

export class UnauthorizedAppException extends AppException {
  constructor(code = 'UNAUTHORIZED', message = 'Chưa xác thực hoặc phiên đăng nhập không hợp lệ', details: ApiErrorDetail[] = []) {
    super(HttpStatus.UNAUTHORIZED, code, message, details);
  }
}

export class ForbiddenAppException extends AppException {
  constructor(code = 'FORBIDDEN', message = 'Không có quyền truy cập tài nguyên này', details: ApiErrorDetail[] = []) {
    super(HttpStatus.FORBIDDEN, code, message, details);
  }
}

export class BadRequestAppException extends AppException {
  constructor(code = 'VALIDATION_ERROR', message = 'Dữ liệu không hợp lệ', details: ApiErrorDetail[] = []) {
    super(HttpStatus.BAD_REQUEST, code, message, details);
  }
}

export class NotFoundAppException extends AppException {
  constructor(code = 'NOT_FOUND', message = 'Tài nguyên không tồn tại', details: ApiErrorDetail[] = []) {
    super(HttpStatus.NOT_FOUND, code, message, details);
  }
}

export class ConflictAppException extends AppException {
  constructor(code = 'CONFLICT', message = 'Xung đột dữ liệu', details: ApiErrorDetail[] = []) {
    super(HttpStatus.CONFLICT, code, message, details);
  }
}
