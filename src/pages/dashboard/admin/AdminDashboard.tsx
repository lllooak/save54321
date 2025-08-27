import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Video,
  DollarSign,
  AlertTriangle,
  Shield,
  Settings,
  Mail,
  BarChart,
  HelpCircle,
  UserCog,
  Bell,
  Lock,
  Star,
  Globe,
  List,
  CreditCard,
  Wallet,
  Loader,
  FileText,
  Film
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { checkAdminAccess } from '../../../lib/admin';
import toast from 'react-hot-toast';
import { AdminLogin } from './AdminLogin';

// Import admin components
import { Overview } from './Overview';
import { UserManagement } from './UserManagement';
import { VideoRequests } from './VideoRequests';
import { FeaturedArtists } from './FeaturedArtists';
import { CategoryManagement } from './CategoryManagement';
import { PaymentsPayouts } from './PaymentsPayouts';
import { WithdrawalManagement } from './WithdrawalManagement';
import { PaypalIntegration } from './PaypalIntegration';
import { DisputeResolution } from './DisputeResolution';
import { ContentModeration } from './ContentModeration';
import { PlatformConfig } from './PlatformConfig';
import { EmailNotifications } from './EmailNotifications';
import { Analytics } from './Analytics';
import { Support } from './Support';
import { RolesPermissions } from './RolesPermissions';
import { SecurityAudit } from './SecurityAudit';
import { SiteConfig } from './SiteConfig';
import { SuperAdminManagement } from './SuperAdminManagement';
import { PageContentManagement } from './PageContentManagement';
import { VideoAdsManagement } from './VideoAdsManagement';
import { AffiliateManagement } from './AffiliateManagement';

export function AdminDashboard() {
  const [currentSection, setCurrentSection] = useState('overview');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        setLoading(true);
        
        // First check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        
        setIsAuthenticated(true);
        
        // Then check if user is admin
        const hasAccess = await checkAdminAccess();
        
        if (!hasAccess) {
          toast.error('אין לך הרשאות גישה ללוח הבקרה');
          navigate('/');
          return;
        }
        
        setIsAdmin(true);
        
        // Check if user is super admin using service role function
        const { data: isSuperAdminStatus, error: superAdminError } = await supabase.rpc(
          'admin_get_user_super_admin_status',
          { p_user_id: session.user.id }
        );
        
        if (!superAdminError) {
          setIsSuperAdmin(isSuperAdminStatus?.[0]?.is_super_admin === true);
        }
      } catch (error) {
        console.error('Error verifying admin access:', error);
        toast.error('אירעה שגיאה בבדיקת ההרשאות');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    verifyAccess();
  }, [navigate]);

  const menuItems = [
    { id: 'overview', label: 'סקירה כללית', icon: LayoutDashboard, component: Overview },
    { id: 'users', label: 'ניהול משתמשים', icon: Users, component: UserManagement },
    { id: 'videos', label: 'בקשות וידאו', icon: Video, component: VideoRequests },
    { id: 'video-ads', label: 'מודעות וידאו', icon: Film, component: VideoAdsManagement },
    { id: 'featured', label: 'יוצרים מובילים', icon: Star, component: FeaturedArtists },
    { id: 'categories', label: 'קטגוריות', icon: List, component: CategoryManagement },
    { id: 'payments', label: 'תשלומים והעברות', icon: DollarSign, component: PaymentsPayouts },
    { id: 'withdrawals', label: 'בקשות משיכה', icon: Wallet, component: WithdrawalManagement },
    { id: 'paypal', label: 'שילוב PayPal', icon: CreditCard, component: PaypalIntegration },
    { id: 'disputes', label: 'ניהול מחלוקות', icon: AlertTriangle, component: DisputeResolution },
    { id: 'moderation', label: 'ניהול תוכן', icon: Shield, component: ContentModeration },
    { id: 'site-config', label: 'הגדרות אתר', icon: Globe, component: SiteConfig },
    { id: 'config', label: 'הגדרות מערכת', icon: Settings, component: PlatformConfig },
    { id: 'email', label: 'דואר והתראות', icon: Mail, component: EmailNotifications },
    { id: 'analytics', label: 'ניתוח נתונים', icon: BarChart, component: Analytics },
    { id: 'support', label: 'תמיכה', icon: HelpCircle, component: Support },
    { id: 'pages', label: 'ניהול דפים', icon: FileText, component: PageContentManagement },
    { id: 'affiliate', label: 'ניהול שותפים', icon: Users, component: AffiliateManagement },
    { id: 'roles', label: 'תפקידים והרשאות', icon: UserCog, component: RolesPermissions, superAdminOnly: true },
    { id: 'security', label: 'אבטחה וביקורת', icon: Lock, component: SecurityAudit, superAdminOnly: true },
    { id: 'super-admin', label: 'ניהול מנהלי-על', icon: Shield, component: SuperAdminManagement, superAdminOnly: true }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-lg text-gray-600">טוען לוח בקרה...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">אין הרשאת גישה</h2>
          <p className="text-gray-600">אין לך הרשאות מנהל לצפות בדף זה.</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            חזרה לדף הבית
          </button>
        </div>
      </div>
    );
  }

  // Filter menu items based on super admin status
  const filteredMenuItems = menuItems.filter(item => 
    !item.superAdminOnly || (item.superAdminOnly && isSuperAdmin)
  );

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="fixed right-0 top-0 h-full w-64 bg-white border-l border-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900">לוח בקרה</h2>
          {isSuperAdmin && (
            <span className="inline-block mt-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
              מנהל-על
            </span>
          )}
        </div>
        <nav className="mt-2 px-4">
          {filteredMenuItems.map((item) => (
            <Link
              key={item.id}
              to={item.id}
              className={`flex items-center px-4 py-2 my-1 text-sm font-medium rounded-lg ${
                currentSection === item.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setCurrentSection(item.id)}
            >
              <item.icon className="h-5 w-5 ml-3" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mr-64 p-8">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="overview" element={<Overview />} />
          <Route path="users/*" element={<UserManagement />} />
          <Route path="videos" element={<VideoRequests />} />
          <Route path="video-ads" element={<VideoAdsManagement />} />
          <Route path="featured" element={<FeaturedArtists />} />
          <Route path="categories" element={<CategoryManagement />} />
          <Route path="payments" element={<PaymentsPayouts />} />
          <Route path="withdrawals" element={<WithdrawalManagement />} />
          <Route path="paypal" element={<PaypalIntegration />} />
          <Route path="disputes" element={<DisputeResolution />} />
          <Route path="moderation" element={<ContentModeration />} />
          <Route path="site-config" element={<SiteConfig />} />
          <Route path="config" element={<PlatformConfig />} />
          <Route path="email" element={<EmailNotifications />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="support" element={<Support />} />
          <Route path="pages" element={<PageContentManagement />} />
          <Route path="affiliate" element={<AffiliateManagement />} />
          <Route path="roles" element={<RolesPermissions />} />
          <Route path="security" element={<SecurityAudit />} />
          <Route path="super-admin" element={<SuperAdminManagement />} />
        </Routes>
      </div>
    </div>
  );
}