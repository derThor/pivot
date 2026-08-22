import { PrismaClient } from '@pivot/database';
const prisma = new PrismaClient();
const roles = await prisma.role.findMany({ include: { permissions: { include: { permission: true } } }, orderBy: { sortOrder: 'asc' } });
for (const r of roles) {
  console.log(r.name, '| sortOrder:', r.sortOrder, '| perms:', r.permissions.length);
}
console.log('---');
const user = await prisma.user.findUnique({ where: { id: 'cmsdjdq7v000ihen00gceqgfq' }, include: { userRoles: { include: { role: true } } } });
console.log(user.firstName, user.lastName, user.email, '->', user.userRoles.map(ur => ur.role.name));
await prisma.$disconnect();
