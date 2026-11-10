import { MongoMemoryServer } from 'mongodb-memory-server';

// Pre-download the MongoDB binary once so parallel test files don't race to download it.
export async function setup(): Promise<void> {
  const mongod = await MongoMemoryServer.create();
  await mongod.stop();
}
