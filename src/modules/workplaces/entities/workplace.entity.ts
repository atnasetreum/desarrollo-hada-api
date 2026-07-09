import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
} from 'typeorm';

import { User } from '@/modules/users/entities/user.entity';

@Entity('workplaces')
export class Workplace {
  @PrimaryGeneratedColumn()
  id: number = undefined as unknown as number;

  @Column({ length: 100, unique: true })
  name: string = undefined as unknown as string;

  @CreateDateColumn()
  createdAt: Date = undefined as unknown as Date;

  @UpdateDateColumn()
  updatedAt: Date = undefined as unknown as Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @ManyToOne(() => User)
  createdBy: User = undefined as unknown as User;

  @ManyToOne(() => User)
  updatedBy?: User;

  @ManyToOne(() => User)
  deletedBy?: User;
}
