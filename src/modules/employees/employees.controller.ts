import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @CurrentUser() userId: number,
  ) {
    return this.employeesService.create(createEmployeeDto, userId);
  }

  @Get()
  findAll() {
    return this.employeesService.findAll();
  }

  @Get('positions')
  findAllPositions(
    @Query('withoutConfiguration') withoutConfiguration?: string,
  ) {
    const shouldFilterWithoutConfiguration =
      withoutConfiguration === 'true' || withoutConfiguration === '1';

    return this.employeesService.findAllPositions(
      shouldFilterWithoutConfiguration,
    );
  }

  @Get('genders')
  findAllGenders() {
    return this.employeesService.findAllGenders();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @CurrentUser() userId: number,
  ) {
    return this.employeesService.update(+id, updateEmployeeDto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() userId: number) {
    return this.employeesService.remove(+id, userId);
  }
}
