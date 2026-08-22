import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { DATA_SUBJECT_REQUEST_TYPES } from './create-deletion-request.dto';

// Selbstauskunft/-löschung aus dem eigenen Konto heraus (Nutzervorgabe,
// 2026-08-19: "Man soll das später aus seinem Account im Frontend heraus
// machen können. Da wäre dann ein Benutzerkonto verknüpft.") – bewusst
// ohne requesterName/requesterEmail: die kommen aus dem eigenen Konto des
// eingeloggten Nutzers, nicht aus Nutzereingaben (verhindert, dass jemand
// im Namen eines anderen eine Anfrage anlegt).
export class CreateSelfServiceRequestDto {
  @ApiPropertyOptional({ enum: DATA_SUBJECT_REQUEST_TYPES })
  @IsOptional()
  @IsIn(DATA_SUBJECT_REQUEST_TYPES)
  type?: (typeof DATA_SUBJECT_REQUEST_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
