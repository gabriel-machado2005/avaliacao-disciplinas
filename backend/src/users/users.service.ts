import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { auditSave } from '../audit/administrative-audit';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('E-mail já cadastrado.');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      passwordHash,
      role: createUserDto.role,
    });

    const savedUser = await auditSave(
      this.usersRepository,
      user,
      'CREATE',
      'USER',
    );

    return {
      id: savedUser.id,
      name: savedUser.name,
      email: savedUser.email,
      role: savedUser.role,
      active: savedUser.active,
      createdAt: savedUser.createdAt,
    };
  }

  findProfessors() {
    return this.usersRepository.find({
      select: {
        id: true,
        name: true,
      },
      where: {
        role: UserRole.PROFESSOR,
        active: true,
      },
      order: {
        name: 'ASC',
      },
    });
  }

  findStudents() {
    return this.usersRepository.find({
      select: {
        id: true,
        name: true,
      },
      where: {
        role: UserRole.STUDENT,
        active: true,
      },
      order: {
        name: 'ASC',
      },
    });
  }

  findActiveById(id: string) {
    return this.usersRepository.findOne({
      where: { id, active: true },
      select: { id: true, email: true, role: true },
    });
  }

  async findByEmailWithPassword(email: string) {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }
}
