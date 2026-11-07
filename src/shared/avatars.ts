import type { Role } from './contracts.ts';
export interface RobotAppearance {
  shell: string;
  eyes: string;
  face: 'round' | 'visor' | 'pixels';
  antenna: 'single' | 'twin' | 'none';
}
export type AvatarPreferences = Record<string, RobotAppearance>;
export const avatarPalette = [
  { name: 'Silver', color: '#b7bdc8' },
  { name: 'Mint', color: '#8eb6a2' },
  { name: 'Lavender', color: '#b1a0cf' },
  { name: 'Sky', color: '#92afcd' },
  { name: 'Amber', color: '#c6aa7b' },
  { name: 'Rose', color: '#cc999f' },
  { name: 'Teal', color: '#83b7b8' },
] as const;
const roleColors: Record<Role, string> = {
  coordinator: '#b1a0cf',
  analyst: '#c6aa7b',
  implementer: '#8eb6a2',
  validator: '#92afcd',
  reviewer: '#cc999f',
  integrator: '#83b7b8',
  specialist: '#b7bdc8',
};
export function defaultAvatar(seed: string, role: Role = 'specialist'): RobotAppearance {
  return {
    shell: roleColors[role],
    eyes: '#272b34',
    face: 'round',
    antenna: 'none',
  };
}
export function agentAvatar(seed: string, role: Role, preferences: AvatarPreferences = {}) {
  return preferences[seed] ?? defaultAvatar(seed, role);
}
