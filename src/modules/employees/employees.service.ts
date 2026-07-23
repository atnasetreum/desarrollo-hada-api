import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Readable } from 'node:stream';
import { Workbook } from 'exceljs';

import { Repository } from 'typeorm';

import {
  Employee,
  EmployeeArea,
  EmployeeGenre,
  EmployeePosition,
} from './entities';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';
import { PersonnelRequisition } from '../personnel-requisitions/entities/personnel-requisition.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);
  private readonly relationsAudits = ['createdBy', 'updatedBy', 'deletedBy'];
  private readonly relations = [
    ...this.relationsAudits,
    'area',
    'position',
    'gender',
    'personnelRequisition',
  ];
  private readonly excelHeaderMap = {
    code: ['codigoempleado', 'codigo', 'code', 'noempleado'],
    name: ['nombrelargo', 'nombre', 'name'],
    dateOfAdmission: ['fechaalta', 'dateofadmission', 'ingreso'],
    area: ['descripcion', 'area'],
    position: ['descripcion1', 'puesto', 'position'],
    birthdate: ['fechanacimiento', 'fechanacimento', 'birthdate'],
    gender: ['sexo', 'genero', 'sex', 'gender'],
  } as const;

  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(EmployeeArea)
    private readonly employeeAreasRepository: Repository<EmployeeArea>,
    @InjectRepository(EmployeePosition)
    private readonly employeePositionsRepository: Repository<EmployeePosition>,
    @InjectRepository(EmployeeGenre)
    private readonly employeeGenresRepository: Repository<EmployeeGenre>,
    @InjectRepository(PersonnelRequisition)
    private readonly personnelRequisitionsRepository: Repository<PersonnelRequisition>,
  ) {}

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private normalizeHeader(value: string): string {
    return this.normalizeText(value).replace(/[\s_\-./]/g, '');
  }

  private excelCellToString(value: unknown): string {
    if (value == null) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).trim();
    }

    if (typeof value === 'object') {
      const candidate = value as {
        text?: string;
        result?: string | number;
      };

      if (typeof candidate.text === 'string') {
        return candidate.text.trim();
      }

      if (
        typeof candidate.result === 'string' ||
        typeof candidate.result === 'number'
      ) {
        return String(candidate.result).trim();
      }
    }

    return '';
  }

  private parseExcelDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number') {
      const excelEpochMs = Date.UTC(1899, 11, 30);
      const dateMs = excelEpochMs + Math.round(value * 24 * 60 * 60 * 1000);
      const date = new Date(dateMs);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const text = this.excelCellToString(value);
    if (!text) {
      return null;
    }

    const ddMmYyyyMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (ddMmYyyyMatch) {
      const day = Number(ddMmYyyyMatch[1]);
      const month = Number(ddMmYyyyMatch[2]) - 1;
      const yearRaw = Number(ddMmYyyyMatch[3]);
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
      const date = new Date(year, month, day);

      return Number.isNaN(date.getTime()) ? null : date;
    }

    const fallbackDate = new Date(text);
    return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
  }

  private resolveGender(
    rawGender: string,
    genres: EmployeeGenre[],
  ): EmployeeGenre | null {
    const normalizedRaw = this.normalizeText(rawGender);
    if (!normalizedRaw) {
      return null;
    }

    const byExactName = genres.find(
      (genre) => this.normalizeText(genre.name) === normalizedRaw,
    );
    if (byExactName) {
      return byExactName;
    }

    const startsWithMaleHint =
      normalizedRaw === 'm' ||
      normalizedRaw.startsWith('masc') ||
      normalizedRaw.startsWith('hom') ||
      normalizedRaw === 'male';
    const startsWithFemaleHint =
      normalizedRaw === 'f' ||
      normalizedRaw.startsWith('fem') ||
      normalizedRaw.startsWith('muj') ||
      normalizedRaw === 'female';

    if (startsWithMaleHint) {
      return (
        genres.find((genre) => {
          const name = this.normalizeText(genre.name);
          return (
            name === 'm' ||
            name === 'male' ||
            name.startsWith('masc') ||
            name.startsWith('hom')
          );
        }) ?? null
      );
    }

    if (startsWithFemaleHint) {
      return (
        genres.find((genre) => {
          const name = this.normalizeText(genre.name);
          return (
            name === 'f' ||
            name === 'female' ||
            name.startsWith('fem') ||
            name.startsWith('muj')
          );
        }) ?? null
      );
    }

    return null;
  }

  private calculatePercentageOfCompliance(
    replacedUsers: number,
    vacancies: number,
  ): number {
    if (vacancies <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((replacedUsers / vacancies) * 100));
  }

  private async refreshComplianceForRequisition(
    requisitionId: number,
  ): Promise<void> {
    const requisition = await this.personnelRequisitionsRepository.findOne({
      where: { id: requisitionId },
      select: ['id', 'numberOfVacancies'],
    });

    if (!requisition) {
      return;
    }

    const replacedUsersCount = await this.employeesRepository.count({
      where: { personnelRequisition: { id: requisitionId } },
    });

    const percentage = this.calculatePercentageOfCompliance(
      replacedUsersCount,
      requisition.numberOfVacancies,
    );

    await this.personnelRequisitionsRepository.update(requisitionId, {
      percentageOfCompliance: percentage,
    });
  }

  async importFromExcel(
    file: { buffer: Uint8Array },
    userId: number,
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; reason: string }>;
  }> {
    const workbook = new Workbook();
    await workbook.xlsx.read(Readable.from(file.buffer));

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('El archivo no contiene hojas.');
    }

    const headerAliases = Object.fromEntries(
      Object.entries(this.excelHeaderMap).map(([key, aliases]) => [
        key,
        aliases.map((alias) => this.normalizeHeader(alias)),
      ]),
    ) as Record<keyof typeof this.excelHeaderMap, string[]>;

    const requiredHeaders: Array<keyof typeof this.excelHeaderMap> = [
      'code',
      'name',
      'area',
      'position',
      'gender',
    ];

    let headerRow = 0;
    let headerColumns: Partial<
      Record<keyof typeof this.excelHeaderMap, number>
    > = {};

    for (
      let rowIndex = 1;
      rowIndex <= Math.min(20, worksheet.rowCount);
      rowIndex += 1
    ) {
      const row = worksheet.getRow(rowIndex);
      const candidateHeaders: Partial<
        Record<keyof typeof this.excelHeaderMap, number>
      > = {};

      row.eachCell((cell, colNumber) => {
        const normalized = this.normalizeHeader(
          this.excelCellToString(cell.value),
        );

        (
          Object.keys(headerAliases) as Array<keyof typeof this.excelHeaderMap>
        ).forEach((key) => {
          if (
            headerAliases[key].includes(normalized) &&
            !candidateHeaders[key]
          ) {
            candidateHeaders[key] = colNumber;
          }
        });
      });

      const hasRequiredHeaders = requiredHeaders.every(
        (requiredHeader) => candidateHeaders[requiredHeader] !== undefined,
      );

      if (hasRequiredHeaders) {
        headerRow = rowIndex;
        headerColumns = candidateHeaders;
        break;
      }
    }

    if (headerRow === 0) {
      throw new BadRequestException(
        'No se encontraron encabezados válidos para importar colaboradores.',
      );
    }

    return this.employeesRepository.manager.transaction(async (manager) => {
      const employeesRepo = manager.getRepository(Employee);
      const areasRepo = manager.getRepository(EmployeeArea);
      const positionsRepo = manager.getRepository(EmployeePosition);
      const genresRepo = manager.getRepository(EmployeeGenre);

      const genres = await genresRepo.find({ withDeleted: true });
      const errors: Array<{ row: number; reason: string }> = [];
      let created = 0;
      let updated = 0;
      let skipped = 0;

      const areaCache = new Map<string, EmployeeArea>();
      const positionCache = new Map<string, EmployeePosition>();

      const getOrCreateArea = async (rawName: string) => {
        const name = rawName.trim();
        const normalizedName = this.normalizeText(name);

        if (areaCache.has(normalizedName)) {
          return areaCache.get(normalizedName) as EmployeeArea;
        }

        const existing = await areasRepo
          .createQueryBuilder('area')
          .withDeleted()
          .where('LOWER(TRIM(area.name)) = LOWER(TRIM(:name))', { name })
          .getOne();

        if (existing) {
          if (existing.deletedAt) {
            await areasRepo.restore(existing.id);
          }

          areaCache.set(normalizedName, existing);
          return existing;
        }

        const createdArea = await areasRepo.save(
          areasRepo.create({
            name,
            createdBy: { id: userId },
          }),
        );

        areaCache.set(normalizedName, createdArea);
        return createdArea;
      };

      const getOrCreatePosition = async (rawName: string) => {
        const name = rawName.trim();
        const normalizedName = this.normalizeText(name);

        if (positionCache.has(normalizedName)) {
          return positionCache.get(normalizedName) as EmployeePosition;
        }

        const existing = await positionsRepo
          .createQueryBuilder('position')
          .withDeleted()
          .where('LOWER(TRIM(position.name)) = LOWER(TRIM(:name))', { name })
          .getOne();

        if (existing) {
          if (existing.deletedAt) {
            await positionsRepo.restore(existing.id);
          }

          positionCache.set(normalizedName, existing);
          return existing;
        }

        const createdPosition = await positionsRepo.save(
          positionsRepo.create({
            name,
            createdBy: { id: userId },
          }),
        );

        positionCache.set(normalizedName, createdPosition);
        return createdPosition;
      };

      for (
        let rowIndex = headerRow + 1;
        rowIndex <= worksheet.rowCount;
        rowIndex += 1
      ) {
        const row = worksheet.getRow(rowIndex);
        const codeCell = row.getCell(headerColumns.code as number).value;
        const nameCell = row.getCell(headerColumns.name as number).value;
        const areaCell = row.getCell(headerColumns.area as number).value;
        const positionCell = row.getCell(
          headerColumns.position as number,
        ).value;
        const genderCell = row.getCell(headerColumns.gender as number).value;

        const codeText = this.excelCellToString(codeCell);
        const name = this.excelCellToString(nameCell);
        const areaName = this.excelCellToString(areaCell);
        const positionName = this.excelCellToString(positionCell);
        const genderRaw = this.excelCellToString(genderCell);

        const isRowEmpty =
          !codeText && !name && !areaName && !positionName && !genderRaw;

        if (isRowEmpty) {
          continue;
        }

        const code = Number(codeText);
        if (!Number.isFinite(code) || code <= 0) {
          skipped += 1;
          errors.push({
            row: rowIndex,
            reason: 'Código inválido en columna codigoempleado.',
          });
          continue;
        }

        if (!name) {
          skipped += 1;
          errors.push({
            row: rowIndex,
            reason: 'Nombre vacío en columna nombrelargo.',
          });
          continue;
        }

        if (!areaName) {
          skipped += 1;
          errors.push({
            row: rowIndex,
            reason: 'Área vacía en columna descripcion.',
          });
          continue;
        }

        if (!positionName) {
          skipped += 1;
          errors.push({
            row: rowIndex,
            reason: 'Posición vacía en columna descripcion1.',
          });
          continue;
        }

        const matchedGender = this.resolveGender(genderRaw, genres);
        if (!matchedGender) {
          skipped += 1;
          errors.push({
            row: rowIndex,
            reason: `Sexo no reconocido: "${genderRaw}".`,
          });
          continue;
        }

        if (matchedGender.deletedAt) {
          await genresRepo.restore(matchedGender.id);
        }

        const area = await getOrCreateArea(areaName);
        const position = await getOrCreatePosition(positionName);

        const dateOfAdmission = headerColumns.dateOfAdmission
          ? this.parseExcelDate(
              row.getCell(headerColumns.dateOfAdmission).value,
            )
          : null;
        const birthdate = headerColumns.birthdate
          ? this.parseExcelDate(row.getCell(headerColumns.birthdate).value)
          : null;

        const existingEmployee = await employeesRepo.findOne({
          where: { code },
          withDeleted: true,
          relations: ['personnelRequisition'],
        });

        if (existingEmployee) {
          if (existingEmployee.deletedAt) {
            await employeesRepo.restore(existingEmployee.id);
          }

          existingEmployee.code = code;
          existingEmployee.name = name;
          existingEmployee.birthdate = birthdate ?? undefined;
          existingEmployee.dateOfAdmission = dateOfAdmission ?? undefined;
          existingEmployee.area = { id: area.id } as EmployeeArea;
          existingEmployee.position = {
            id: position.id,
          } as EmployeePosition;
          existingEmployee.gender = {
            id: matchedGender.id,
          } as EmployeeGenre;
          existingEmployee.updatedBy = { id: userId } as User;

          await employeesRepo.save(existingEmployee);

          updated += 1;
          continue;
        }

        const employeeToCreate = new Employee();
        employeeToCreate.code = code;
        employeeToCreate.name = name;
        employeeToCreate.birthdate = birthdate ?? undefined;
        employeeToCreate.dateOfAdmission = dateOfAdmission ?? undefined;
        employeeToCreate.area = { id: area.id } as EmployeeArea;
        employeeToCreate.position = { id: position.id } as EmployeePosition;
        employeeToCreate.gender = { id: matchedGender.id } as EmployeeGenre;
        employeeToCreate.createdBy = { id: userId } as User;

        await employeesRepo.save(employeeToCreate);

        created += 1;
      }

      return { created, updated, skipped, errors };
    });
  }

  async create(createEmployeeDto: CreateEmployeeDto, userId: number) {
    const {
      code,
      name,
      birthdate,
      dateOfAdmission,
      areaId,
      positionId,
      genderId,
      personnelRequisitionId,
    } = createEmployeeDto;

    const employee = this.employeesRepository.create({
      code,
      name,
      birthdate,
      dateOfAdmission,
      area: { id: areaId },
      position: { id: positionId },
      gender: { id: genderId },
      ...(personnelRequisitionId
        ? { personnelRequisition: { id: personnelRequisitionId } }
        : {}),
      createdBy: { id: userId },
    });

    const createdEmployee = await this.employeesRepository.save(employee);

    if (personnelRequisitionId) {
      await this.refreshComplianceForRequisition(personnelRequisitionId);
    }

    return createdEmployee;
  }

  findAll() {
    return this.employeesRepository.find({
      relations: this.relations,
      order: { name: 'ASC' },
    });
  }

  findAllGenders() {
    return this.employeeGenresRepository.find({
      relations: this.relationsAudits,
      order: { name: 'ASC' },
    });
  }

  findAllPositions(withoutConfiguration = false) {
    const qb = this.employeePositionsRepository
      .createQueryBuilder('position')
      .leftJoin('position.config', 'positionConfiguration')
      .orderBy('position.name', 'ASC');

    if (withoutConfiguration) {
      qb.andWhere('positionConfiguration.id IS NULL');
    }

    return qb.getMany();
  }

  async findOne(id: number) {
    const employee = await this.employeesRepository.findOne({
      where: { id },
      relations: this.relations,
    });

    if (!employee) {
      throw new NotFoundException(`Colaborador con ID ${id} no encontrado.`);
    }

    return employee;
  }

  async update(
    id: number,
    updateEmployeeDto: UpdateEmployeeDto,
    userId: number,
  ) {
    const employee = await this.findOne(id);
    const previousRequisitionId = employee.personnelRequisition?.id;

    const {
      code,
      name,
      birthdate,
      dateOfAdmission,
      areaId,
      positionId,
      genderId,
      personnelRequisitionId,
    } = updateEmployeeDto;

    await this.employeesRepository.update(
      id,
      Object.assign(employee, {
        code,
        name,
        birthdate,
        dateOfAdmission,
        area: { id: areaId },
        position: { id: positionId },
        gender: { id: genderId },
        ...(personnelRequisitionId
          ? { personnelRequisition: { id: personnelRequisitionId } }
          : {}),
        updatedBy: { id: userId },
      }),
    );

    const currentRequisitionId =
      personnelRequisitionId ?? previousRequisitionId;

    if (currentRequisitionId) {
      await this.refreshComplianceForRequisition(currentRequisitionId);
    }

    if (
      previousRequisitionId &&
      previousRequisitionId !== currentRequisitionId
    ) {
      await this.refreshComplianceForRequisition(previousRequisitionId);
    }

    return this.findOne(id);
  }

  async remove(id: number, userId: number) {
    const employee = await this.findOne(id);

    employee.deletedBy = { id: userId } as User;
    await this.employeesRepository.save(employee);
    await this.employeesRepository.softDelete(id);

    return { message: `Colaborador con ID ${id} eliminado.` };
  }
}
