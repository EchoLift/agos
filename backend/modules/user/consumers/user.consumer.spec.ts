import { Test, TestingModule } from '@nestjs/testing';
import { UserConsumer } from './user.consumer';
import { UserService } from '../services/user.service';
import { RabbitMQService } from '@packages/events/rabbitmq.service';

describe('UserConsumer Integration', () => {
  let userConsumer: UserConsumer;
  let userService: UserService;
  let rabbitmqService: RabbitMQService;

  beforeEach(async () => {
    const mockUserService = {
      provisionUser: jest.fn(),
    };

    const mockRabbitMQService = {
      subscribe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserConsumer,
        { provide: UserService, useValue: mockUserService },
        { provide: RabbitMQService, useValue: mockRabbitMQService },
      ],
    }).compile();

    userConsumer = module.get<UserConsumer>(UserConsumer);
    userService = module.get<UserService>(UserService);
    rabbitmqService = module.get<RabbitMQService>(RabbitMQService);
  });

  it('should provision a user when UserRegistered is consumed', async () => {
    await userConsumer.onModuleInit();
    
    expect(rabbitmqService.subscribe).toHaveBeenCalledWith(
      'user_module.user_registered',
      'event.UserRegistered',
      expect.any(Function)
    );

    const subscribeMock = rabbitmqService.subscribe as jest.Mock;
    const handler = subscribeMock.mock.calls[0][2];
    
    const msg = {
      content: Buffer.from(JSON.stringify({
        aggregateId: 'test-auth-user-id',
        payload: { email: 'test@example.com' }
      }))
    } as any;

    await handler(msg);

    expect(userService.provisionUser).toHaveBeenCalledWith('test-auth-user-id');
  });
});
