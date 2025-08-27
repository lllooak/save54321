import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface CartItem {
  id: string;
  title: string;
  price: number;
  creator_name: string;
  creator_id: string;
  thumbnail_url?: string;
  instructions?: string; // Added instructions field
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateItemInstructions: (id: string, instructions: string) => void; // New function to update instructions
  removeItem: (id: string) => void;
  clearCart: () => void;
  checkout: () => Promise<boolean>;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => set((state) => ({
        items: [...state.items, item]
      })),
      updateItemInstructions: (id, instructions) => set((state) => ({
        items: state.items.map(item => 
          item.id === id ? { ...item, instructions } : item
        )
      })),
      removeItem: (id) => set((state) => {
        // Find the index of the first item with the matching ID
        const indexToRemove = state.items.findIndex(item => item.id === id);
        
        // If no matching item was found, return the state unchanged
        if (indexToRemove === -1) return state;
        
        // Create a new array without the item at the found index
        const newItems = [
          ...state.items.slice(0, indexToRemove),
          ...state.items.slice(indexToRemove + 1)
        ];
        
        return { items: newItems };
      }),
      clearCart: () => set({ items: [] }),
      checkout: async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            toast.error('Please sign in to complete your purchase');
            return false;
          }

          const items = get().items;
          const results = await Promise.all(
            items.map(async (item) => {
              const { data, error } = await supabase.rpc('process_request_payment', {
                p_request_id: item.id,
                p_fan_id: user.id,
                p_creator_id: item.creator_id,
                p_amount: item.price
              });

              if (error || !data?.success) {
                throw new Error(error?.message || data?.error || 'Failed to process payment');
              }

              return data;
            })
          );

          // If all payments were successful, clear the cart
          get().clearCart();
          toast.success('Purchase successful!');
          return true;
        } catch (error: any) {
          console.error('Error processing purchase:', error);
          toast.error(error.message || 'Failed to process purchase');
          return false;
        }
      }
    }),
    {
      name: 'shopping-cart',
    }
  )
);
