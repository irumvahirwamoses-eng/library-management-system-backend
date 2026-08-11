import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import { Resolver } from 'dns/promises';

const publicResolver = new Resolver({ servers: ['8.8.8.8', '1.1.1.1'] });
for (const m of ['resolveSrv', 'resolveTxt', 'resolveCname', 'resolve4', 'resolve6']) {
  if (typeof dns.promises[m] === 'function') dns.promises[m] = publicResolver[m].bind(publicResolver);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let ATLAS_URI = process.argv[2] || process.env.ATLAS_URI;
if (!ATLAS_URI) {
  console.error('Usage: node scripts/backup-atlas.js "mongodb+srv://USER:PASSWORD@cluster.../lms"');
  console.error('Or set ATLAS_URI in .env');
  process.exit(1);
}

const dbName = (ATLAS_URI.split('?')[0].split('/').pop()) || 'lms';
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(__dirname, '..', 'backups', `${dbName}_${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const run = async () => {
  await mongoose.connect(ATLAS_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  console.log(`Connected to ${dbName} on Atlas`);
  const collections = await db.listCollections().toArray();
  const summary = [];

  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray();
    const file = path.join(outDir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(docs, null, 2));
    summary.push({ collection: name, documents: docs.length, file });
    console.log(`${name}: ${docs.length} documents`);
  }

  const meta = path.join(outDir, 'backup-info.json');
  fs.writeFileSync(meta, JSON.stringify({
    database: dbName,
    exportedAt: new Date().toISOString(),
    collections: summary
  }, null, 2));

  console.log(`\nBackup complete: ${outDir}`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
