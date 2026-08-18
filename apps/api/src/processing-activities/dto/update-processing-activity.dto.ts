import { PartialType } from '@nestjs/swagger';
import { CreateProcessingActivityDto } from './create-processing-activity.dto';

export class UpdateProcessingActivityDto extends PartialType(
  CreateProcessingActivityDto,
) {}
