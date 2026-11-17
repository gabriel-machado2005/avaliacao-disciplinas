import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

@Controller('users')
@ApiTags('Usuários')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Token ausente, inválido ou expirado, ou conta indisponível.',
})
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação. ADMIN para o cadastro. ADMIN e COORDINATOR para as consultas.',
})
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiCreatedResponse({
    description: 'Usuário cadastrado. A resposta omite o hash da senha.',
  })
  @ApiBadRequestResponse({
    description: 'Campos inválidos ou e-mail já cadastrado.',
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  @Get('professors')
  @ApiOkResponse({
    description: 'Professores ativos. A lista contém os IDs e nomes.',
  })
  findProfessors() {
    return this.usersService.findProfessors();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  @Get('students')
  @ApiOkResponse({
    description: 'Estudantes ativos. A lista contém os IDs e nomes.',
  })
  findStudents() {
    return this.usersService.findStudents();
  }
}
