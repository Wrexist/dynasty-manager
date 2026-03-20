import { toast } from 'sonner';

const GOLD_STYLE = {
  background: 'hsl(222 30% 12%)',
  border: '1px solid hsl(43 96% 46% / 0.4)',
  color: 'hsl(43 96% 56%)',
};

const SUCCESS_STYLE = {
  background: 'hsl(222 30% 12%)',
  border: '1px solid hsl(142 76% 36% / 0.4)',
  color: 'hsl(142 76% 46%)',
};

const ERROR_STYLE = {
  background: 'hsl(222 30% 12%)',
  border: '1px solid hsl(0 84% 60% / 0.4)',
  color: 'hsl(0 84% 60%)',
};

const INFO_STYLE = {
  background: 'hsl(222 30% 12%)',
  border: '1px solid hsl(215 60% 50% / 0.4)',
  color: 'hsl(215 60% 60%)',
};

/** Gold-themed toast for milestone celebrations */
export function celebrationToast(title: string, description?: string) {
  toast(title, { description, duration: 4000, style: GOLD_STYLE });
}

/** Green success toast matching the game's dark theme */
export function successToast(title: string, description?: string) {
  toast(title, { description, duration: 3000, style: SUCCESS_STYLE });
}

/** Red error toast matching the game's dark theme */
export function errorToast(title: string, description?: string) {
  toast(title, { description, duration: 3000, style: ERROR_STYLE });
}

/** Blue info toast matching the game's dark theme */
export function infoToast(title: string, description?: string) {
  toast(title, { description, duration: 3000, style: INFO_STYLE });
}
