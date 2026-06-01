import prisma from '../../lib/prisma.js';

export async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });
}

export async function findUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    include: { organization: true },
  });
}

// Creates an Organization and its first ADMIN user in a single transaction.
export async function createOrgAndAdmin({ orgName, name, email, passwordHash }) {
  return prisma.$transaction(async (tx) => {
    const slug = orgName
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'org';

    // Ensure slug uniqueness within the transaction.
    let uniqueSlug = slug;
    let suffix = 2;
    while (await tx.organization.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${suffix++}`;
    }

    const org = await tx.organization.create({ data: { name: orgName, slug: uniqueSlug } });
    const user = await tx.user.create({
      data: { organizationId: org.id, name, email, passwordHash, role: 'ADMIN' },
      include: { organization: true },
    });

    return user;
  });
}