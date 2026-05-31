import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { RootController } from './root.controller';

describe('RootController', () => {
  let controller: RootController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RootController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test'),
          },
        },
      ],
    }).compile();

    controller = module.get(RootController);
  });

  it('returns service metadata', () => {
    expect(controller.getVersion()).toEqual({
      name: 'sports-betting-service',
      version: '0.0.1',
      environment: 'test',
    });
  });
});
