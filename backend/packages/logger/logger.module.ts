import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { RequestContextModule } from '@packages/request-context/request-context.module';
import { RequestContextService } from '@packages/request-context/request-context.service';
import { IncomingMessage, ServerResponse } from 'http';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule, RequestContextModule],
      inject: [ConfigService, RequestContextService],
      useFactory: (config: ConfigService, requestContext: RequestContextService) => {
        const isProduction = config.get('NODE_ENV') === 'production';

        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                  },
                },
            customProps: (req: IncomingMessage, res: ServerResponse) => {
              const context = requestContext.get();
              if (!context) return {};
              return {
                requestId: context.requestId,
                correlationId: context.correlationId,
                userId: context.userId,
                agencyId: context.agencyId,
              };
            },
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const context = requestContext.get();
              return context?.requestId || (req as any).id;
            },
            autoLogging: false,
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
