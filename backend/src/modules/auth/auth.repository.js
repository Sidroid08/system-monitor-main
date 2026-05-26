import prisma from '../../lib/prisma.js';

export async function findUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      organization: true,
    },
  });
}

export async function createUser(data) {
  const slug = `${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-org-${Math.random().toString(36).substring(2, 7)}`;
  const org = await prisma.organization.create({
    data: {
      name: `${data.name}'s Org`,
      slug,
    },
  });

  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      organizationId: org.id,
      role: 'ADMIN',
    },
  });
}