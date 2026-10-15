import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from '../config/db.js';
import { getEnv } from '../config/env.js';
import { ROLES } from '../config/permissions.js';
import { User } from '../models/User.js';

const MIN_PASSWORD = 12;

async function main() {
  const email = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD ?? '';
  const firstName = process.env.SUPERADMIN_FIRST_NAME?.trim();
  const lastName = process.env.SUPERADMIN_LAST_NAME?.trim();

  if (!email || !firstName || !lastName) {
    console.error('SUPERADMIN_EMAIL, SUPERADMIN_FIRST_NAME et SUPERADMIN_LAST_NAME sont requis.');
    process.exit(1);
  }

  if (password.length < MIN_PASSWORD) {
    console.error(`SUPERADMIN_PASSWORD doit contenir au moins ${MIN_PASSWORD} caractères.`);
    process.exit(1);
  }

  const env = getEnv();
  await connectDb(env.MONGODB_URI);

  const existing = await User.findOne({ role: ROLES.SUPERADMIN });
  if (existing) {
    console.error('Un superadmin existe déjà. Aucun compte supplémentaire n’a été créé.');
    await disconnectDb();
    process.exit(1);
  }

  await User.create({
    email,
    passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS),
    role: ROLES.SUPERADMIN,
    firstName,
    lastName,
    isActive: true,
    organizationId: null,
  });

  console.log(`Superadmin créé pour ${email}. Le mot de passe n’est pas journalisé.`);
  await disconnectDb();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Création impossible');
  await disconnectDb();
  process.exit(1);
});
