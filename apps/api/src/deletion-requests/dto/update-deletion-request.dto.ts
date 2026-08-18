import { PartialType } from '@nestjs/swagger';
import { CreateDeletionRequestDto } from './create-deletion-request.dto';

export class UpdateDeletionRequestDto extends PartialType(
  CreateDeletionRequestDto,
) {}
