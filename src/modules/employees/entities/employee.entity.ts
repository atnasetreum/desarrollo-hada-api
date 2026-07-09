import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
} from 'typeorm';

import { PersonnelRequisition } from '@/modules/personnel-requisitions/entities/personnel-requisition.entity';
import { User } from '@/modules/users/entities/user.entity';
import { EmployeePosition } from './employee-position.entity';
import { EmployeeGenre } from './employee-genre.entity';
import { EmployeeArea } from './employee-area.entity';

@Entity({
  name: 'employees',
})
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
    type: 'bigint',
  })
  code: number;

  @Column({
    length: 150,
  })
  name: string;

  @Column({
    nullable: true,
    type: 'date',
    transformer: {
      from: (value: string) => value ?? null,
      to: (value: Date) =>
        value ? new Date(value).toISOString().slice(0, 10) : null,
    },
  })
  birthdate?: Date;

  @Column({
    nullable: true,
    type: 'date',
    transformer: {
      from: (value: string) => value ?? null,
      to: (value: Date) =>
        value ? new Date(value).toISOString().slice(0, 10) : null,
    },
  })
  dateOfAdmission?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @ManyToOne(() => Employee)
  replacedBy?: Employee;

  @ManyToOne(() => User)
  createdBy: User;

  @ManyToOne(() => User)
  updatedBy: User;

  @ManyToOne(() => User)
  deletedBy?: User;

  @ManyToOne(() => EmployeeArea, ({ employees }) => employees)
  area: EmployeeArea;

  @ManyToOne(() => EmployeePosition, ({ employees }) => employees)
  position: EmployeePosition;

  @ManyToOne(() => EmployeeGenre, ({ employees }) => employees)
  gender: EmployeeGenre;

  @ManyToOne(
    () => PersonnelRequisition,
    (personnelRequisition) => personnelRequisition.usersRemplaced,
  )
  personnelRequisition: PersonnelRequisition;
}
