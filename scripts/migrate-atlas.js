import 'dotenv/config';
import mongoose from 'mongoose';

const LOCAL_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
const ATLAS_URI = process.argv[2] || process.env.ATLAS_URI;

if (!ATLAS_URI) {
  console.error('Usage: node scripts/migrate-atlas.js "mongodb+srv://USER:PASSWORD@cluster.../lms"');
  console.error('Or set ATLAS_URI in .env');
  process.exit(1);
}

const run = async () => {
  const local = await mongoose.createConnection(LOCAL_URI).asPromise();
  const atlas = await mongoose.createConnection(ATLAS_URI).asPromise();
  console.log('Connected to local + Atlas');

  const localDb = local.db;
  const atlasDb = atlas.db;
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
