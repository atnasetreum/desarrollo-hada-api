import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  InternalServerErrorException,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { rename } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import {
  CreateNonconformanceReportDto,
  ExportNonconformanceReportsExcelDto,
  FindAllNonconformanceReportsDto,
} from './dto';
import { NonconformanceReportsService } from './nonconformance-reports.service';

type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;
type UploadedImageFile = {
  mimetype: string;
  filename: string;
  originalname?: string;
  path?: string;
};

const EVIDENCE_UPLOAD_DIR = join(
  process.cwd(),
  'public',
  'nonconformance-evidences',
);

@Controller('nonconformance-reports')
export class NonconformanceReportsController {
  constructor(
    private readonly nonconformanceReportsService: NonconformanceReportsService,
  ) {}

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/bmp': '.bmp',
      'image/tiff': '.tif',
      'image/svg+xml': '.svg',
    };

    return mimeToExt[mimeType.toLowerCase()] ?? '.jpg';
  }

  private resolveFinalFilename(file: UploadedImageFile): string {
    const extensionFromFilename = extname(file.filename || '').toLowerCase();
    if (extensionFromFilename) {
      return file.filename;
    }

    const extensionFromOriginalName = extname(
      file.originalname || '',
    ).toLowerCase();
    const extension =
      extensionFromOriginalName || this.getExtensionFromMimeType(file.mimetype);

    return `${file.filename}${extension}`;
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      dest: EVIDENCE_UPLOAD_DIR,
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (
        _req,
        file: UploadedImageFile,
        callback: FileFilterCallback,
      ) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(
            new BadRequestException('El archivo debe ser una imagen válida.'),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  async create(
    @Body() createNonconformanceReportDto: CreateNonconformanceReportDto,
    @CurrentUser() userId: number,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    if (!file) {
      throw new BadRequestException(
        'La foto es obligatoria para crear el reporte.',
      );
    }

    const finalFilename = this.resolveFinalFilename(file);
    if (finalFilename !== file.filename) {
      const currentPath = file.path ?? join(EVIDENCE_UPLOAD_DIR, file.filename);
      const finalPath = join(EVIDENCE_UPLOAD_DIR, finalFilename);

      try {
        await rename(currentPath, finalPath);
      } catch {
        throw new InternalServerErrorException(
          'No fue posible guardar la imagen de evidencia con extensión válida.',
        );
      }
    }

    const imageUrl = `/nonconformance-evidences/${finalFilename}`;

    return this.nonconformanceReportsService.create(
      createNonconformanceReportDto,
      userId,
      imageUrl,
    );
  }

  @Get()
  findAll(@Query() query: FindAllNonconformanceReportsDto) {
    return this.nonconformanceReportsService.findAll(query);
  }

  @Get('count-by-employee/:employeeId')
  countByEmployee(@Param('employeeId') employeeId: string) {
    return this.nonconformanceReportsService.countByEmployee(+employeeId);
  }

  @Post('export-excel')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="FORMATO_RECORRIDO.xlsx"',
  )
  async exportExcel(
    @Body() exportDto: ExportNonconformanceReportsExcelDto,
  ): Promise<StreamableFile> {
    const fileBytes = await this.nonconformanceReportsService.exportExcel(
      exportDto.ids,
    );

    return new StreamableFile(fileBytes);
  }
}
