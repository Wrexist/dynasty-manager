import { create } from 'zustand';
import type { GameState } from './storeTypes';
import { createCoreSlice } from './slices/coreSlice';
import { createClubSlice } from './slices/clubSlice';
import { createTransferSlice } from './slices/transferSlice';
import { createMatchSlice } from './slices/matchSlice';
import { createSystemsSlice } from './slices/systemsSlice';
import { createOrchestrationSlice } from './slices/orchestrationSlice';
import { createLoanSlice } from './slices/loanSlice';
import { createCupSlice } from './slices/cupSlice';
import { createFeatureSlice } from './slices/featureSlice';
import { createSponsorSlice } from './slices/sponsorSlice';
import { createMerchandiseSlice } from './slices/merchandiseSlice';

export type { GameState } from './storeTypes';

export const useGameStore = create<GameState>((set, get) => ({
  ...createCoreSlice(set, get),
  ...createClubSlice(set, get),
  ...createTransferSlice(set, get),
  ...createMatchSlice(set, get),
  ...createSystemsSlice(set, get),
  ...createOrchestrationSlice(set, get),
  ...createLoanSlice(set, get),
  ...createCupSlice(set, get),
  ...createFeatureSlice(set, get),
  ...createSponsorSlice(set, get),
  ...createMerchandiseSlice(set, get),
}));
