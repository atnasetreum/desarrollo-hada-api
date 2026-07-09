import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { DataSource, Repository } from 'typeorm';

import { HALLAZGOS_DATA_SOURCE_DB } from '@/constants';
import {
  Employee,
  EmployeeArea,
  EmployeePosition,
  EmployeeGenre,
} from './entities';

@Injectable()
export class EmployeesSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmployeesSeedService.name);

  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(EmployeeArea)
    private readonly employeeAreasRepository: Repository<EmployeeArea>,
    @InjectRepository(EmployeePosition)
    private readonly employeePositionsRepository: Repository<EmployeePosition>,
    @InjectRepository(EmployeeGenre)
    private readonly employeeGenresRepository: Repository<EmployeeGenre>,
    @InjectDataSource(HALLAZGOS_DATA_SOURCE_DB)
    private readonly hallazgosDataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if ((await this.employeeGenresRepository.count()) === 0) {
      const genresHallazgos = await this.hallazgosDataSource.query<
        { name: string }[]
      >(`SELECT "name" FROM genres ORDER BY id ASC`);
      const genresToCreate = genresHallazgos.map((genre) =>
        this.employeeGenresRepository.create({
          name: genre.name,
          createdBy: { id: 1 },
        }),
      );
      await this.employeeGenresRepository.save(genresToCreate);
    }

    if ((await this.employeePositionsRepository.count()) === 0) {
      const positionsHallazgos = await this.hallazgosDataSource.query<
        { name: string }[]
      >(`SELECT "name" FROM employee_position ORDER BY id ASC`);
      const positionsToCreate = positionsHallazgos.map((position) =>
        this.employeePositionsRepository.create({
          name: position.name,
          createdBy: { id: 1 },
        }),
      );
      await this.employeePositionsRepository.save(positionsToCreate);
    }

    if ((await this.employeeAreasRepository.count()) === 0) {
      const areasHallazgos = await this.hallazgosDataSource.query<
        { name: string }[]
      >(`SELECT "name" FROM employee_area ORDER BY id ASC`);
      const areasToCreate = areasHallazgos.map((area) =>
        this.employeeAreasRepository.create({
          name: area.name,
          createdBy: { id: 1 },
        }),
      );
      await this.employeeAreasRepository.save(areasToCreate);
    }

    if ((await this.employeesRepository.count()) === 0) {
      const employeesHallazgos = await this.hallazgosDataSource.query<
        {
          name: string;
          area: string;
          position: string;
          genre: string;
          birthdate: Date;
          dateOfAdmission: Date;
          code: string;
        }[]
      >(
        `SELECT
        e."name",
        ea."name" AS area,
        ep."name" AS "position",
        ge."name" AS genre,
        birthdate,
        "dateOfAdmission",
        code 
      FROM
        employee e
        LEFT JOIN employee_area ea ON ea."id" = e."areaId"
        LEFT JOIN employee_position ep ON ep."id" = e."positionId"
        LEFT JOIN genres ge ON ge."id" = e."genderId"
        ORDER BY e.id ASC`,
      );

      const employeesToCreate: Employee[] = [];

      for (const employee of employeesHallazgos) {
        const area = await this.employeeAreasRepository.findOne({
          where: { name: employee.area },
        });
        const position = await this.employeePositionsRepository.findOne({
          where: { name: employee.position },
        });
        const genre = await this.employeeGenresRepository.findOne({
          where: { name: employee.genre },
        });

        if (!area || !position || !genre) {
          this.logger.error(
            `No se encontró el area, posición o género para el colaborador ${employee.name}, code: ${employee.code}. Se omitirá su creación.`,
          );
          continue;
        }

        employeesToCreate.push(
          this.employeesRepository.create({
            name: employee.name,
            code: Number(employee.code),
            area: {
              id: Number(area.id),
            },
            position: {
              id: Number(position.id),
            },
            gender: {
              id: Number(genre.id),
            },
            birthdate: employee.birthdate,
            dateOfAdmission: employee.dateOfAdmission,
            createdBy: { id: 1 },
          }),
        );
      }
      await this.employeesRepository.save(employeesToCreate);

      // Se identifica cuales colaboradores no se migraron con base al code
      const existingCodes = await this.employeesRepository.find({
        select: ['code'],
      });

      const existingCodesSet = new Set(
        existingCodes.map((employee) => Number(employee.code)),
      );
      const missingEmployees = employeesHallazgos.filter(
        (employee) => !existingCodesSet.has(Number(employee.code)),
      );

      if (missingEmployees.length > 0) {
        this.logger.error(`Size: ${missingEmployees.length}`);
      }
    }

    this.logger.log(`Colaboradores iniciales creados`);
  }
}
