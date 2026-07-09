import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { ReasonForRequest } from '@/modules/reasons-for-request/entities/reasons-for-request.entity';
import { Workplace } from '@/modules/workplaces/entities/workplace.entity';
import { Project } from '@/modules/projects/entities/project.entity';
import { Employee, EmployeePosition } from '@/modules/employees/entities';
import { User } from '@/modules/users/entities/user.entity';
import { Area } from '@/modules/areas/entities/area.entity';

@Entity('personnel_requisitions')
export class PersonnelRequisition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'date',
    transformer: {
      from: (value: string) => (value ? new Date(value) : null),
      to: (value: Date) => (value ? value.toISOString().slice(0, 10) : null),
    },
  })
  requestDate: Date;

  @ManyToOne(() => Area)
  area: Area;

  @ManyToOne(() => User)
  requestingUser: User;

  @ManyToOne(() => EmployeePosition)
  positionRequestingUser: EmployeePosition;

  @ManyToOne(() => Workplace)
  workplace: Workplace;

  @ManyToOne(() => EmployeePosition)
  positionRequired: EmployeePosition;

  @Column({
    type: 'int',
    transformer: {
      from: (value: number) => value,
      to: (value: number) => Math.floor(value),
    },
  })
  numberOfVacancies: number;

  @Column({
    default: 0,
  })
  percentageOfCompliance: number;

  @Column()
  isExternal: boolean;

  @ManyToOne(() => ReasonForRequest)
  reasonForRequest: ReasonForRequest;

  @OneToMany(() => Employee, (employee) => employee.personnelRequisition)
  usersRemplaced?: Employee[];

  @ManyToOne(() => Project)
  projectReplaced?: Project;

  @Column({ nullable: true })
  observations?: string;

  @Column({ default: false })
  isAuthorized: boolean;

  @Column({ nullable: true })
  authorizedDate?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @ManyToOne(() => User)
  authorizedBy?: User;

  @ManyToOne(() => User)
  createdBy: User;

  @ManyToOne(() => User)
  updatedBy?: User;

  @ManyToOne(() => User)
  deletedBy?: User;
}
