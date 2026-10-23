import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.username);
      return existingAdmin;
    }

    // Never hardcode the admin password. Provide ADMIN_PASSWORD explicitly, or
    // let a strong random one be generated and printed once for local setup.
    const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString('base64url');
    if (!process.env.ADMIN_PASSWORD) {
      console.log('ADMIN_PASSWORD was not set. Generated password:', password);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const adminUser = await prisma.user.create({
      data: {
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        username: process.env.ADMIN_USERNAME || 'admin',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });

    console.log('Admin user created:', adminUser.username);
    return adminUser;
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
