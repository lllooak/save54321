import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { CreatorProfile } from '../types';

interface Stats {
  completedRequests: number;
  averageRating: number;
  totalEarnings: number;
}

interface Request {
  id: string;
  fan_name?: string;
  fan_avatar?: string;
  request_type?: string;
  status: string;
  price: number;
  deadline: string;
}

interface Earning {
  id: string;
  amount: number;
  status: string; // 'pending', 'completed', or 'refunded'
  request_id: string;
  created_at: string;
}

interface Settings {
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private';
    showEarnings: boolean;
  };
  availability: {
    autoAcceptRequests: boolean;
    maxRequestsPerDay: number;
    deliveryTime: number;
  };
}

interface CreatorStore {
  profile: CreatorProfile | null;
  isLoading: boolean;
  error: string | null;
  stats: Stats;
  requests: Request[];
  earnings: Earning[];
  settings: Settings | null;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<CreatorProfile>) => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
  initializeRealtime: () => Promise<(() => void) | void>;
}

export const useCreatorStore = create<CreatorStore>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,
  stats: {
    completedRequests: 0,
    averageRating: 0,
    totalEarnings: 0,
  },
  requests: [],
  earnings: [],
  settings: null,

  fetchProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile, error } = await supabase
        .from('creator_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      // If profile doesn't exist, create one
      if (!profile) {
        const { data: newProfile, error: createError } = await supabase
          .from('creator_profiles')
          .insert([
            {
              id: user.id,
              name: '',
              category: '',
              bio: '',
              price: 0,
              social_links: {},
            }
          ])
          .select()
          .single();

        if (createError) throw createError;
        set({ profile: newProfile, isLoading: false });
        return;
      }

      set({ profile, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please log in to update your profile');

      const { data: updatedProfile, error } = await supabase
        .from('creator_profiles')
        .update(data)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      set({ profile: updatedProfile, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateSettings: async (newSettings) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please log in to update your settings');

      const { data: updatedProfile, error } = await supabase
        .from('creator_profiles')
        .update({
          metadata: {
            settings: newSettings
          }
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      set({ settings: newSettings, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  initializeRealtime: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user found');
        return;
      }

      // Subscribe to requests
      const { data: requests, error: requestsError } = await supabase
        .from('requests')
        .select('*')
        .eq('creator_id', user.id);

      if (!requestsError && requests) {
        set({ requests });
      }

      const requestsSubscription = supabase
        .channel('requests')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'requests',
            filter: `creator_id=eq.${user.id}`,
          },
          (payload) => {
            const currentRequests = get().requests;
            let updatedRequests = [...currentRequests];

            switch (payload.eventType) {
              case 'INSERT':
                updatedRequests = [...currentRequests, payload.new as Request];
                break;
              case 'UPDATE':
                updatedRequests = currentRequests.map((request) =>
                  request.id === payload.new.id ? { ...request, ...payload.new } : request
                );
                break;
              case 'DELETE':
                updatedRequests = currentRequests.filter((request) => request.id !== payload.old.id);
                break;
            }

            set({ requests: updatedRequests });
          }
        )
        .subscribe();

      // Subscribe to earnings
      const { data: earnings, error: earningsError } = await supabase
        .from('earnings')
        .select('*')
        .eq('creator_id', user.id);

      if (!earningsError && earnings) {
        set({ earnings });
      }

      const earningsSubscription = supabase
        .channel('earnings')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'earnings',
            filter: `creator_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('💰 EARNINGS SUBSCRIPTION EVENT:', {
              eventType: payload.eventType,
              payload: payload.new || payload.old,
              timestamp: new Date().toISOString()
            });
            
            const currentEarnings = get().earnings;
            let updatedEarnings = [...currentEarnings];

            switch (payload.eventType) {
              case 'INSERT':
                console.log('➕ Adding new earning:', payload.new);
                updatedEarnings = [...currentEarnings, payload.new as Earning];
                break;
              case 'UPDATE':
                console.log('🔄 Updating earning:', payload.new);
                updatedEarnings = currentEarnings.map((earning) =>
                  earning.id === payload.new.id ? { ...earning, ...payload.new } : earning
                );
                break;
              case 'DELETE':
                console.log('❌ Deleting earning:', payload.old);
                updatedEarnings = currentEarnings.filter((earning) => earning.id !== payload.old.id);
                break;
            }

            console.log('📊 Earnings array updated:', {
              oldCount: currentEarnings.length,
              newCount: updatedEarnings.length,
              oldEarnings: currentEarnings.map(e => ({ id: e.id, amount: e.amount, status: e.status })),
              newEarnings: updatedEarnings.map(e => ({ id: e.id, amount: e.amount, status: e.status }))
            });
            
            set({ earnings: updatedEarnings });
          }
        )
        .subscribe();

      // Fetch stats with the updated RPC function
      const { data: stats, error: statsError } = await supabase
        .rpc('get_creator_stats', { user_id: user.id });

      if (!statsError && stats) {
        set({ stats });
      }

      return () => {
        requestsSubscription.unsubscribe();
        earningsSubscription.unsubscribe();
      };
    } catch (error) {
      console.error('Error initializing realtime subscriptions:', error);
      return;
    }
  },
}));
