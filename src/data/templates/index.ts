import type { PlayerTemplate } from '../playerTemplates';
import { ENGLAND_TEMPLATES } from './england';

export const ALL_TEMPLATES: Record<string, PlayerTemplate[]> = {
  ...ENGLAND_TEMPLATES,
};
