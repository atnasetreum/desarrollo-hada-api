import { InjectRepository } from '@nestjs/typeorm';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import argon2 from 'argon2';
import { Repository } from 'typeorm';

import { CreateUserDto, UpdateUserDto } from './dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  private readonly relations = ['createdBy', 'updatedBy', 'deletedBy'];

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto, currentUserId: number) {
    const code = Number(createUserDto.code);
    const name = String(createUserDto.name).trim();
    const email = String(createUserDto.email).trim().toLowerCase();
    const plainPassword = String(createUserDto.password);

    const existingUserByEmail = await this.usersRepository.findOne({
      where: { email },
      withDeleted: true,
    });

    if (existingUserByEmail) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const existingUserByCode = await this.usersRepository.findOne({
      where: { code },
      withDeleted: true,
    });

    if (existingUserByCode) {
      throw new ConflictException('Ya existe un usuario con ese codigo');
    }

    const passwordHash = await argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const userToCreate = this.usersRepository.create({
      code,
      name,
      email,
      password: passwordHash,
      createdBy: {
        id: currentUserId,
      },
    });

    const createdUser = await this.usersRepository.save(userToCreate);

    return createdUser;
  }

  findAll() {
    return this.usersRepository.find({
      relations: this.relations,
      order: { name: 'ASC' },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

  async findOne(id: number) {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: this.relations,
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
    }

    return user;
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    currentUserId: number,
  ) {
    const user = await this.findOne(id);

    const nextCode =
      typeof updateUserDto.code === 'number' ? updateUserDto.code : user.code;
    const nextName =
      typeof updateUserDto.name === 'string'
        ? String(updateUserDto.name).trim()
        : user.name;
    const nextEmail =
      typeof updateUserDto.email === 'string'
        ? String(updateUserDto.email).trim().toLowerCase()
        : user.email;

    const plainPassword =
      typeof updateUserDto.password === 'string'
        ? String(updateUserDto.password)
        : null;

    const existingUserByEmail = await this.usersRepository.findOne({
      where: { email: nextEmail },
      withDeleted: true,
    });

    if (existingUserByEmail && existingUserByEmail.id !== id) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const existingUserByCode = await this.usersRepository.findOne({
      where: { code: nextCode },
      withDeleted: true,
    });

    if (existingUserByCode && existingUserByCode.id !== id) {
      throw new ConflictException('Ya existe un usuario con ese codigo');
    }

    const payload: Partial<User> = {
      code: nextCode,
      name: nextName,
      email: nextEmail,
      updatedBy: { id: currentUserId } as User,
    };

    if (plainPassword && plainPassword.trim()) {
      payload.password = await argon2.hash(plainPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      });
    }

    await this.usersRepository.update(id, payload);

    return this.findOne(id);
  }

  async remove(id: number, currentUserId: number) {
    const user = await this.findOne(id);

    user.deletedBy = { id: currentUserId } as User;
    await this.usersRepository.save(user);
    await this.usersRepository.softDelete(id);

    return { message: `Usuario con ID ${id} eliminado.` };
  }
}
