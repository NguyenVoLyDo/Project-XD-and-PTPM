import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorResponse } from './api-error.response.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Đã có lỗi xảy ra trên hệ thống';
    let details: Array<{ field?: string; code?: string; message?: string }> = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null && 'error' in res && typeof (res as any).error === 'object') {
        const errorObj = (res as any).error;
        code = errorObj.code || this.defaultCodeForStatus(status);
        message = errorObj.message || exception.message;
        details = Array.isArray(errorObj.details) ? errorObj.details : [];
      } else if (typeof res === 'object' && res !== null) {
        const anyRes = res as any;
        code = anyRes.code || this.defaultCodeForStatus(status);
        message = anyRes.message || exception.message;
        if (Array.isArray(anyRes.message)) {
          message = anyRes.message[0] || 'Dữ liệu không hợp lệ';
          details = anyRes.message.map((msg: string) => ({ message: msg }));
        }
      } else if (typeof res === 'string') {
        message = res;
        code = this.defaultCodeForStatus(status);
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      message = 'Đã có lỗi xảy ra trên hệ thống';
    }

    const payload: ApiErrorResponse = {
      error: {
        code,
        message,
        details,
      },
    };

    response.status(status).json(payload);
  }

  private defaultCodeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
