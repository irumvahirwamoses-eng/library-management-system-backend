import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'dns';
import { Resolver } from 'dns/promises';

const publicResolver = new Resolver({ servers: ['8.8.8.8', '1.1.1.1'] });
for (const m of ['resolveSrv', 'resolveTxt', 'resolveCname', 'resolve4', 'resolve6']) {
  if (typeof dns.promises[m] === 'function') dns.promises[m] = publicResolver[m].bind(publicResolver);
}

const LOCAL_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
let ATLAS_URI = process.argv[2] || process.env.ATLAS_URI;

if (!ATLAS_URI) {
  console.error('Usage: node scripts/migrate-atlas.js "mongodb+srv://USER:PASSWORD@cluster.../lms"');
  console.error('Or set ATLAS_URI in .env');
  process.exit(1);
}

const dbName = (LOCAL_URI.split('?')[0].split('/').pop()) || 'lms';
console.log(`Targeting database "${dbName}" on Atlas`);

const run = async () => {
  const local = await mongoose.createConnection(LOCAL_URI).asPromise();
  const atlas = await mongoose.createConnection(ATLAS_URI).asPromise();
  console.log('Connected to local + Atlas');

  const localDb = local.useDb(dbName, { noListener: true }).db;
  const atlasDb = atlas.useDb(dbName, { noListener: true }).db;
  const collections = await localDb.listCollections().toArray();

  for (const { name } of collections) {
    const docs = await localDb.collection(name).find({}).toArray();
    console.log(`${name}: ${docs.length} documents`);

    await atlasDb.collection(name).deleteMany({});
    if (docs.length > 0) {
      await atlasDb.collection(name).insertMany(docs);
    }
  }

  console.log('Migration complete');
  await local.close();
  await atlas.close();
  process.exit(0);
};

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
