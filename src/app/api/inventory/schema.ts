import { z } from 'zod';

export const inventorySchema = z.object({
  item_name_id: z.number().int().positive(),
  category_id: z.number().int().positive(),
  brand_id: z.number().int().positive().nullable().optional(),
  unit_id: z.number().int().positive(),
  available_quantity: z.number().int().min(0),
  city_id: z.number().int().positive(),
});