import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = {
      message: (exception as Error).message,
      error: 'Internal Server Error',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } else if (
      (exception as any).code === '23505' ||
      (exception as any)?.driverError?.code === '23505'
    ) {
      status = HttpStatus.CONFLICT;
      message = {
        message: 'A record with this value already exists',
        error: 'Conflict',
      };
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(typeof message === 'object' ? message : { message }),
    };

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error('[AllExceptionsFilter]', exception);
    }

    response.status(status).json(errorResponse);
  }
}
