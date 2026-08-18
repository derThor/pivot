import { PartialType } from '@nestjs/swagger';
import { CreatePrivacyIncidentDto } from './create-privacy-incident.dto';

export class UpdatePrivacyIncidentDto extends PartialType(
  CreatePrivacyIncidentDto,
) {}
