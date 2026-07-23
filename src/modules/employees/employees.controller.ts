import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto';
import { EmployeesService } from './employees.service';

type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;
type UploadedExcelFile = {
  mimetype: string;
  originalname: string;
  buffer: Buffer;
};

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

  @Post('import-excel')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (
        _req,
        file: UploadedExcelFile,
        callback: FileFilterCallback,
      ) => {
        const validMimeTypes = new Set([
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/octet-stream',
        ]);

        const isValidExtension = /\.(xlsx|xls)$/i.test(file.originalname ?? '');
        const isValidMimeType = validMimeTypes.has(file.mimetype);

        if (!isValidExtension && !isValidMimeType) {
          callback(
            new BadRequestException(
              'El archivo debe ser un Excel válido (.xlsx o .xls).',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  importExcel(
    @CurrentUser() userId: number,
    @UploadedFile() file?: UploadedExcelFile,
  ) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo Excel.');
    }

    return this.employeesService.importFromExcel(file, userId);
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
