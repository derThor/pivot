import { PartialType } from '@nestjs/swagger';
import { CreateCompanyLocationDto } from './create-company-location.dto';

export class UpdateCompanyLocationDto extends PartialType(
  CreateCompanyLocationDto,
) {}
