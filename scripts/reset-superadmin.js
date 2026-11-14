import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../config/db.js';
import SuperAdmin from '../models/SuperAdmin.js';

/*
 * Super admin recovery / management helper.
 *
 *   node scripts/reset-superadmin.js
 *       -> list all super admin emails
 *
 *   node scripts/reset-superadmin.js <email> <newPassword>
 *       -> reset that super admin's password (creates the account if it doesn't exist)
 *
 * Examples:
 *   node scripts/reset-superadmin.js
 *   node scripts/reset-superadmin.js superadmin@gmail.com superadmin@2026
 */

const HASH_ROUNDS = 10;

const list = async () => {
  const admins = await SuperAdmin.find({}).select('email createdAt updatedAt').sort({ createdAt: 1 });
  if (admins.length === 0) {
    console.log('No super admin accounts found.');
    console.log('Create one with:');
    console.log('  node scripts/reset-superadmin.js <email> <newPassword>');
    return;
  }
  console.log(`Found ${admins.length} super admin account(s):`);
  for (const a of admins) {
    console.log(`  - ${a.email}`);
  }
  console.log('\nReset a password with:');
  console.log('  node scripts/reset-superadmin.js <email> <newPassword>');
};

const reset = async (email, newPassword) => {
  const normalised = email.trim().toLowerCase();
  if (!normalised.includes('@')) {
    throw new Error(`"${email}" does not look like a valid email address.`);
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const password = await bcrypt.hash(newPassword, HASH_ROUNDS);
  const existing = await SuperAdmin.findOne({ email: normalised });

  if (existing) {
    existing.password = password;
    // Keep token/session flags consistent even if the schema doesn't use them.
    if ('mustChangePassword' in existing) existing.mustChangePassword = false;
    await existing.save();
    console.log(`Password reset for existing super admin: ${normalised}`);
  } else {
    const doc = { email: normalised, password };
    await SuperAdmin.create(doc);
    console.log(`Created new super admin: ${normalised}`);
  }

  console.log('\nYou can now sign in on the login page with:');
  console.log(`  Email:    ${normalised}`);
  console.log(`  Password: ${newPassword}`);
};

const run = async () => {
  await connectDB();

  const [, , email, newPassword] = process.argv;
  if (!email) {
    await list();
  } else if (!newPassword) {
    console.log('Missing new password.\nUsage: node scripts/reset-superadmin.js <email> <newPassword>');
    process.exitCode = 1;
  } else {
    await reset(email, newPassword);
  }

  await mongoose.disconnect();
};

run().catch(async (e) => {
  console.error('Error:', e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
