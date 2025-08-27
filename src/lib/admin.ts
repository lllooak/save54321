import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from './supabase';

interface AdminState {
  settings: {
    platformFee: number;
    minRequestPrice: number;
    maxRequestPrice: number;
    defaultDeliveryTime: number;
    maxDeliveryTime: number;
    allowedFileTypes: string[];
    maxFileSize: number;
    autoApproveCreators: boolean;
    requireEmailVerification: boolean;
    enableDisputes: boolean;
    disputeWindow: number;
    payoutThreshold: number;
    payoutSchedule: string;
  };
  updateSettings: (settings: Partial<AdminState['settings']>) => void;
}

const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      settings: {
        platformFee: 10,
        minRequestPrice: 5,
        maxRequestPrice: 1000,
        defaultDeliveryTime: 24,
        maxDeliveryTime: 72,
        allowedFileTypes: ['mp4', 'mov', 'avi'],
        maxFileSize: 100,
        autoApproveCreators: false,
        requireEmailVerification: true,
        enableDisputes: true,
        disputeWindow: 48,
        payoutThreshold: 50,
        payoutSchedule: 'weekly',
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
          },
        }));
      },
    }),
    {
      name: 'admin-storage',
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);

async function saveConfig(key: string, value: any) {
  const { data, error } = await supabase
    .from('platform_config')
    .upsert({ 
      key, 
      value,
      updated_at: new Date().toISOString()
    }, { 
      onConflict: 'key'
    });

  if (error) throw error;
  return data;
}

async function saveEmailTemplate(template: {
  id?: string;
  name: string;
  subject: string;
  content: string;
  variables?: Record<string, any>;
}) {
  const { data, error } = await supabase
    .from('email_templates')
    .upsert(template);

  if (error) throw error;
  return data;
}

export async function saveRole(role: {
  id?: string;
  name: string;
  description?: string;
  permissions: string[];
}) {
  const { data, error } = await supabase
    .from('roles')
    .upsert({
      ...role,
      permissions: JSON.stringify(role.permissions)
    });

  if (error) throw error;
  return data;
}

export async function createAuditLog(log: {
  action: string;
  entity: string;
  entity_id?: string;
  details?: Record<string, any>;
}) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) {
    throw new Error('Unauthorized: User not authenticated');
  }

  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      ...log,
      user_id: user.id
    });

  if (error) throw error;
  return data;
}

export async function updateSupportTicket(ticket: {
  id: string;
  status?: string;
  priority?: string;
  assigned_to?: string;
}) {
  const { data, error } = await supabase
    .from('support_tickets')
    .update(ticket)
    .eq('id', ticket.id);

  if (error) throw error;
  return data;
}

async function updateUser(user: {
  id: string;
  email?: string;
  role?: string;
  avatar_url?: string;
}) {
  const { data, error } = await supabase
    .from('users')
    .update(user)
    .eq('id', user.id);

  if (error) throw error;
  return data;
}

async function updateVideoRequest(request: {
  id: string;
  status?: string;
  admin_notes?: string;
}) {
  const { data, error } = await supabase
    .from('requests')
    .update(request)
    .eq('id', request.id);

  if (error) throw error;
  return data;
}

async function resolveDispute(dispute: {
  id: string;
  resolution: string;
  admin_notes?: string;
}) {
  const { data, error } = await supabase
    .from('disputes')
    .update({
      status: 'resolved',
      resolution: dispute.resolution,
      admin_notes: dispute.admin_notes,
      resolved_at: new Date().toISOString()
    })
    .eq('id', dispute.id);

  if (error) throw error;
  return data;
}

async function getDeploymentStatus() {
  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }
  
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role, is_super_admin')
    .eq('id', user.id)
    .single();
  
  if (userError || userData?.role !== 'admin') {
    throw new Error('Unauthorized: Not an admin');
  }
  
  // This is a placeholder function that would normally check deployment status
  // In a real application, this might call an external API or check a database
  return {
    status: 'success',
    environment: 'production',
    version: '1.0.0',
    lastDeployed: new Date().toISOString(),
    deployedBy: 'admin'
  };
}

export async function checkAdminAccess() {
  try {
    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();
    
    // If no session or user, return false instead of throwing
    if (!session?.user) {
      return false;
    }
    
    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, is_super_admin')
      .eq('id', session.user.id)
      .single();
    
    if (userError) {
      console.error('Error checking admin status:', userError);
      return false;
    }
    
    // Check if user is either a regular admin or super admin
    return userData?.role === 'admin' || userData?.is_super_admin === true;
  } catch (error) {
    console.error('Admin access check failed:', error);
    return false;
  }
}

export async function checkSuperAdminAccess() {
  try {
    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();
    
    // If no session or user, return false
    if (!session?.user) {
      return false;
    }
    
    // Check if user is super admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_super_admin')
      .eq('id', session.user.id)
      .single();
    
    if (userError) {
      console.error('Error checking super admin status:', userError);
      return false;
    }
    
    return userData?.is_super_admin === true;
  } catch (error) {
    console.error('Super admin access check failed:', error);
    return false;
  }
}

// Function to log admin login attempts
export async function logAdminLoginAttempt(email: string, success: boolean, errorMessage?: string) {
  try {
    await supabase.from('audit_logs').insert({
      action: success ? 'admin_login_success' : 'admin_login_failed',
      entity: 'auth',
      details: {
        email,
        success,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        ip_address: 'client-side' // In a real app, you'd get this from the server
      }
    });
  } catch (error) {
    console.error('Failed to log login attempt:', error);
  }
}
