import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
@ApiTags('Aplicação')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOkResponse({ description: 'Resposta de verificação da API.' })
  getHello(): string {
    return this.appService.getHello();
  }
}
