import { prisma } from '../../utils/prisma.js';
import { hashPassword } from '../../utils/hash.js';
import type { CreateUserInput } from './user.schema.js';

export async function createUser(input: CreateUserInput) {
  const { email, alias, password } = input;

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      alias,
      password: hashedPassword,
    },
  });

  return user;
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      alias: true,
      password: true,
      googleId: true,
      twoFactorEnabled: true,
      createdAt: true,
    },
  });
}

export async function findUserByAlias(alias: string) {
  return prisma.user.findUnique({
    where: { alias },
  });
}

export async function findUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      alias: true,
      createdAt: true,
    },
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      alias: true,
      twoFactorEnabled: true,
      createdAt: true,
    },
  });
}

export async function updateUserAlias(id: string, alias: string) {
  return prisma.user.update({
    where: { id },
    data: { alias },
    select: {
      id: true,
      email: true,
      alias: true,
      twoFactorEnabled: true,
      createdAt: true,
    },
  });
}
