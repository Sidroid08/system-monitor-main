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
  return prisma.user.create({
    data,
  });
}