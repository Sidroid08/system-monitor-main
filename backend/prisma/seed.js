import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "sidroid-demo" },
    update: {},
    create: {
      name: "Sidroid Demo",
      slug: "sidroid-demo",
    },
  });

  const passwordHash = await bcrypt.hash("Admin@123", 10);

  const user = await prisma.user.upsert({
    where: { email: "admin@sidroid.local" },
    update: {},
    create: {
      organizationId: org.id,
      name: "Sidroid Admin",
      email: "admin@sidroid.local",
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("Seed completed");
  console.log({
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
    },
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });