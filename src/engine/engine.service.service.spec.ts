import { Test, TestingModule } from '@nestjs/testing';
import { EngineServiceService } from './engine.service';

describe('EngineServiceService', () => {
  let service: EngineServiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EngineServiceService],
    }).compile();

    service = module.get<EngineServiceService>(EngineServiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
