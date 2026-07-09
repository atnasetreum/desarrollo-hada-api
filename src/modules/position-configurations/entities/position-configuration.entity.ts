import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';

import { EmployeePosition } from '@/modules/employees/entities';
import { User } from '@/modules/users/entities/user.entity';

@Entity({
  name: 'position_configurations',
})
export class PositionConfiguration {
  @PrimaryGeneratedColumn()
  id: number = undefined as unknown as number;

  @Column({
    type: 'int',
    transformer: {
      from: (value: number) => value,
      to: (value: number) => Math.floor(value),
    },
  })
  responseTimeInDays: number = undefined as unknown as number;

  @CreateDateColumn()
  createdAt: Date = undefined as unknown as Date;

  @UpdateDateColumn()
  updatedAt: Date = undefined as unknown as Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @ManyToOne(() => User)
  createdBy: User = undefined as unknown as User;

  @ManyToOne(() => User)
  updatedBy: User = undefined as unknown as User;

  @ManyToOne(() => User)
  deletedBy?: User;

  @OneToOne(
    () => EmployeePosition,
    (employeePosition) => employeePosition.config,
  )
  @JoinColumn()
  position: EmployeePosition = undefined as unknown as EmployeePosition;
}
