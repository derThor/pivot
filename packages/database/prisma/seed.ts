import { PrismaClient, Role } from "../generated/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@strasev.dev" },
    update: {},
    create: {
      email: "admin@strasev.dev",
      name: "Admin",
      role: Role.ADMIN,
      passwordHash: await argon2.hash("ChangeMe123!"),
    },
  });

  await prisma.contentType.upsert({
    where: { slug: "page" },
    update: {},
    create: {
      name: "Seite",
      slug: "page",
      schema: {
        fields: [
          { name: "title", type: "string", required: true },
          { name: "body", type: "richtext", required: true },
        ],
      },
    },
  });

  console.log(`Seed abgeschlossen. Admin-User: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
