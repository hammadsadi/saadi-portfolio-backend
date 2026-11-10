import type { Model } from 'mongoose';
import { z } from 'zod';

export interface ReorderItem {
  id: string;
  order: number;
}

export const reorderBodySchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId'),
        order: z.number().int().min(0),
      }),
    )
    .min(1),
});

export type ReorderBody = z.infer<typeof reorderBodySchema>;

export async function reorderItems<T>(model: Model<T>, items: ReorderItem[]): Promise<void> {
  if (items.length === 0) return;
  await Promise.all(
    items.map(({ id, order }) => model.updateOne({ _id: id }, { $set: { order } })),
  );
}
