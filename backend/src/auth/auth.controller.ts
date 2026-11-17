import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
@ApiTags('Autenticação')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiCreatedResponse({
    description: 'Credenciais aceitas. Retorna accessToken e user.',
  })
  @ApiBadRequestResponse({
    description:
      'E-mail inválido, senha com menos de 8 caracteres ou campos inválidos.',
  })
  @ApiUnauthorizedResponse({
    description: 'Credenciais inválidas ou conta inativa.',
  })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido ou expirado, ou conta indisponível.',
  })
  @ApiOkResponse({ description: 'Perfil atual da conta autenticada.' })
  profile(@Req() req: any) {
    return req.user;
  }
}
