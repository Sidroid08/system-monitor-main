import prisma from '../../lib/prisma.js';

export async function createOrganization(data) {
  return prisma.organization.create({
    data,
  });
}

export async function getOrganizations() {
  return prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOrganizationById(id) {
  return prisma.organization.findUnique({
    where: { id },
  });
}

export async function getOrganizationsByUser(userId) {
  return prisma.organization.findMany({
    where: {
      users: {
        some: {
          id: userId,
        },
      },
    },
  });
}