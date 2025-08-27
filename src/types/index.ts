// User types
export interface User {
  id: string;
  email: string;
  role: string;
  avatar_url?: string | null;
  name?: string | null;
  status: string;
  wallet_balance: number;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string | null;
  last_seen_at?: string | null;
  login_count?: number;
  failed_login_attempts?: number;
  is_super_admin?: boolean;
  metadata?: Record<string, any>;
}

// Creator profile types
export interface CreatorProfile {
  id: string;
  name: string;
  category: string;
  bio?: string;
  price: number;
  delivery_time: string;
  avatar_url?: string;
  banner_url?: string;
  social_links?: {
    website?: string;
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
  };
  created_at?: string;
  updated_at?: string;
}

// Video ad types
interface VideoAd {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  price: number;
  duration: string;
  thumbnail_url?: string | null;
  sample_video_url?: string | null;
  requirements?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Request types
interface Request {
  id: string;
  creator_id: string;
  fan_id: string;
  request_type: string;
  status: string;
  price: number;
  message?: string;
  deadline: string;
  created_at: string;
  updated_at: string;
}

// Earnings types
interface Earning {
  id: string;
  creator_id: string;
  request_id: string;
  amount: number;
  status: string;
  created_at: string;
}

// Review types
interface Review {
  id: string;
  creator_id: string;
  fan_id: string;
  request_id: string;
  rating: number;
  comment?: string;
  created_at: string;
}

// Message types
interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

// Transaction types
interface Transaction {
  id: string;
  user_id: string;
  type: 'top_up' | 'purchase' | 'refund';
  amount: number;
  payment_method?: string;
  payment_status: 'pending' | 'completed' | 'failed';
  reference_id?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Support ticket types
interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: 'open' | 'in-progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

// Platform config types
interface PlatformConfig {
  key: string;
  value: any;
  updated_at: string;
  updated_by?: string;
}

// Creator stats
interface CreatorStats {
  completedRequests: number;
  averageRating: number;
  totalEarnings: number;
}

// Settings types
interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private';
  showEarnings: boolean;
  allowMessages: boolean;
}

interface AvailabilitySettings {
  autoAcceptRequests: boolean;
  maxRequestsPerDay: number;
  deliveryTime: number;
}

interface PaymentSettings {
  minimumPrice: number;
  currency: string;
  paymentMethods?: string[];
}

interface CreatorSettings {
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  availability: AvailabilitySettings;
  payments: PaymentSettings;
}
