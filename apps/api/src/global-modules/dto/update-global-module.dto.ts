import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateGlobalModuleDto } from './create-global-module.dto';

// `moduleTypeId` ist nach dem Anlegen nicht mehr änderbar – analog zu
// `ContentType` bei `Content` (siehe content-editor-form.tsx, "Content-Type
// kann nachträglich nicht geändert werden"), da sich `values` sonst nicht
// mehr sinnvoll gegen das (dann fremde) Feld-Schema deuten ließe.
export class UpdateGlobalModuleDto extends PartialType(
  OmitType(CreateGlobalModuleDto, ['moduleTypeId'] as const),
) {}
