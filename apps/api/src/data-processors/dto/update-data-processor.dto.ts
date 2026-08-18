import { PartialType } from '@nestjs/swagger';
import { CreateDataProcessorDto } from './create-data-processor.dto';

export class UpdateDataProcessorDto extends PartialType(
  CreateDataProcessorDto,
) {}
