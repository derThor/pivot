import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { RequirePermission } from '../auth/decorators/permissions.decorator';

@ApiTags('permissions')
@ApiBearerAuth()
@RequirePermission('roles:manage')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.getPermissionsCatalog();
  }
}
