import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { Repository } from 'typeorm';
import argon2 from 'argon2';

import { User } from './entities/user.entity';

@Injectable()
export class UsersSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersSeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const existingUsers = await this.usersRepository.count();

    if (existingUsers > 0) {
      return;
    }

    const name = this.configService.get<string>(
      'app.seed.firstUser.name',
      'Administrador',
    );
    const email = this.configService.get<string>(
      'app.seed.firstUser.email',
      'admin@hada.local',
    );
    const password = this.configService.get<string>(
      'app.seed.firstUser.password',
      'ChangeMe123!',
    );
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    const code = this.configService.get<string>(
      'app.seed.firstUser.code',
      '20090',
    );

    const permissions = {
      ['/dashboard']: [],
      '/requisicion-de-personal': ['applicant', 'approve-request', 'recruiter'],
      '/configuraciones': [
        { '/tiempos-de-respuesta': [], '/colaboradores': [], '/usuarios': [] },
      ],
    };

    const firstUser = this.usersRepository.create({
      name,
      email,
      password: passwordHash,
      code: Number(code),
      permissions,
      createdBy: {
        id: 1,
      },
    });

    await this.usersRepository.save(firstUser);

    this.logger.log(`Usuario inicial creado: ${email}`);
  }
}
