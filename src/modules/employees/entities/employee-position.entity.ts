import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  DeleteDateColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';

import { PositionConfiguration } from '@/modules/position-configurations/entities/position-configuration.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Employee } from './employee.entity';

@Entity({
  name: 'employee_positions',
})
export class EmployeePosition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @ManyToOne(() => User)
  createdBy: User;

  @ManyToOne(() => User)
  updatedBy: User;

  @ManyToOne(() => User)
  deletedBy?: User;

  @OneToMany(() => Employee, (employee) => employee.position)
  employees: Employee[];

  @OneToOne(
    () => PositionConfiguration,
    (positionConfiguration) => positionConfiguration.position,
  )
  config: PositionConfiguration;
}
