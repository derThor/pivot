import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModuleTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    // Zuerst die von Hand gesetzte Reihenfolge, dann der Name als
    // Rückfall: solange niemand etwas verschoben hat, stehen alle auf 0
    // und die Palette bleibt alphabetisch wie bisher.
    return this.prisma.moduleType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /** Neue Reihenfolge der Palette. Die Position ergibt sich aus dem
   * Index in der übergebenen Liste – dadurch kann kein Zwischenzustand mit
   * doppelten Positionen entstehen. In EINER Transaktion, damit eine
   * halb gespeicherte Reihenfolge nicht möglich ist.
   *
   * Unbekannte Ids lässt `updateMany` still fallen; Bausteine, die gar
   * nicht in der Liste stehen, behalten ihre bisherige Position. */
  async reorder(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.moduleType.updateMany({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.findAll();
  }

  async findOne(id: string) {
    const moduleType = await this.prisma.moduleType.findUnique({
      where: { id },
    });
    if (!moduleType) {
      throw new NotFoundException(`Modul-Typ ${id} nicht gefunden.`);
    }
    return moduleType;
  }
}
