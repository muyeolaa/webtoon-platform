import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // HttpException(내가 의도한 에러)이면 그 상태 코드를 쓰고,
    // 아예 예상치 못한 에러(500 서버 에러)면 INTERNAL_SERVER_ERROR를 적용합니다.
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception as Error).message || 'Internal server error';

    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : ((rawMessage as any)?.message ?? 'Internal server error');

    // 🚨 콘솔에 빨갛게 에러 로그를 남겨서 범인을 찾기 쉽게 만듭니다.
    console.error(`🚨 [에러 발생] 경로: ${request.url} | 내용:`, exception);

    // 성공 응답(TransformInterceptor)과 동일한 {statusCode, message, data} 규격으로 통일
    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message.join(', ') : message,
      data: null,
    });
  }
}
