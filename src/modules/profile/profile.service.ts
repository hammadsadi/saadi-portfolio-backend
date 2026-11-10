import { ProfileModel } from './profile.model.js';
import type { IProfileDocument } from './profile.types.js';
import type { UpsertProfileInput } from './profile.validation.js';

export async function getPublicProfile(): Promise<IProfileDocument | null> {
  return ProfileModel.findOne({});
}

export async function getAdminProfile(): Promise<IProfileDocument | null> {
  return ProfileModel.findOne({});
}

export async function upsertProfile(data: UpsertProfileInput): Promise<IProfileDocument> {
  return ProfileModel.findOneAndUpdate(
    {},
    { $set: data },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
}
