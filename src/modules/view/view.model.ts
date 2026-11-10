import mongoose, { Schema } from 'mongoose';
import type { IViewDedupe, IDailyViewStat } from './view.types.js';

const viewDedupeSchema = new Schema<IViewDedupe>(
  {
    targetType: { type: String, enum: ['post', 'profile'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    viewerKey: { type: String, required: true },
    day: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Deduplication guard: one entry per (viewer, target, day)
viewDedupeSchema.index(
  { targetType: 1, targetId: 1, viewerKey: 1, day: 1 },
  { unique: true },
);
// TTL: auto-delete after 48 h — dedup window is 24 h (calendar day), 48 h gives a safety buffer
viewDedupeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 24 * 60 * 60 });

export const ViewDedupeModel = mongoose.model<IViewDedupe>('ViewDedupe', viewDedupeSchema);

// ─────────────────────────────────────────────────────────────────────────────

const dailyViewStatSchema = new Schema<IDailyViewStat>(
  {
    targetType: { type: String, enum: ['post', 'profile'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    date: { type: String, required: true },
    views: { type: Number, required: true, default: 0 },
    uniqueViews: { type: Number, required: true, default: 0 },
  },
  { timestamps: false },
);

dailyViewStatSchema.index(
  { targetType: 1, targetId: 1, date: 1 },
  { unique: true },
);
dailyViewStatSchema.index({ ownerId: 1, targetType: 1, date: 1 }); // per-owner analytics range
dailyViewStatSchema.index({ date: 1 }); // global date range queries

export const DailyViewStatModel = mongoose.model<IDailyViewStat>('DailyViewStat', dailyViewStatSchema);
