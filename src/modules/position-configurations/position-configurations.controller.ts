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

import { PositionConfigurationsService } from './position-configurations.service';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import {
  CreatePositionConfigurationDto,
  FindAllPositionConfigurationsDto,
  UpdatePositionConfigurationDto,
} from './dto';

@Controller('position-configurations')
export class PositionConfigurationsController {
  constructor(
    private readonly positionConfigurationsService: PositionConfigurationsService,
  ) {}

  @Post()
  create(
    @Body() createPositionConfigurationDto: CreatePositionConfigurationDto,
    @CurrentUser() userId: number,
  ) {
    return this.positionConfigurationsService.create(
      createPositionConfigurationDto,
      userId,
    );
  }

  @Get()
  findAll(@Query() query: FindAllPositionConfigurationsDto) {
    return this.positionConfigurationsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.positionConfigurationsService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePositionConfigurationDto: UpdatePositionConfigurationDto,
    @CurrentUser() userId: number,
  ) {
    return this.positionConfigurationsService.update(
      +id,
      updatePositionConfigurationDto,
      userId,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() userId: number) {
    return this.positionConfigurationsService.remove(+id, userId);
  }
}
