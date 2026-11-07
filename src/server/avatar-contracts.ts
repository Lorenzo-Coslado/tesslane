import { z } from 'zod';
const color = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a six-digit hex color.');
export const RobotAppearance = z
  .object({
    shell: color,
    eyes: color,
    face: z.enum(['round', 'visor', 'pixels']),
    antenna: z.enum(['single', 'twin', 'none']),
  })
  .strict();
export const AvatarPreferences = z
  .record(z.string().min(1).max(500), RobotAppearance)
  .refine(
    (value) => Object.keys(value).length <= 2000,
    'This workspace supports 2,000 customized agent avatars.',
  );
export type AvatarPreferences = z.infer<typeof AvatarPreferences>;
