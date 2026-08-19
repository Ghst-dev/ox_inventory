import { Inventory } from './inventory';
import { Slot } from './slot';

export type State = {
  leftInventory: Inventory;
  rightInventory: Inventory;
  /**
   * A bag from the player's own inventory, open alongside the other two rather than in
   * place of the right-hand one. Null unless one is open.
   */
  containerInventory: Inventory | null;
  itemAmount: number;
  shiftPressed: boolean;
  isBusy: boolean;
  additionalMetadata: Array<{ metadata: string; value: string }>;
  history?: {
    leftInventory: Inventory;
    rightInventory: Inventory;
  };
};
