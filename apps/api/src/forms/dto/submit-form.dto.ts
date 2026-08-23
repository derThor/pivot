import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

// Öffentlicher, unauthentifizierter Endpunkt (`POST /forms/:slug/submit`) –
// `values` ist bewusst locker typisiert (`Record<string, unknown>`, key =
// Feld-Id). Die eigentliche Prüfung (Pflichtfelder, bekannte Feld-Ids)
// passiert in FormsService.submit() gegen `form.fields`, nicht hier per
// class-validator, da das Schema je Formular unterschiedlich ist.
export class SubmitFormDto {
  @ApiProperty({ type: Object })
  @IsObject()
  values!: Record<string, unknown>;
}
