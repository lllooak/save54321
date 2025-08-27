import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  DollarSign, 
  Video, 
  TrendingUp, 
  Calendar,
  Clock,
  Star
} from 'lucide-react';

interface DashboardStats {
  totalEarnings: number;
  pendingRequests: number;
  completedRequests: number;
  totalVideoAds: number;
  averageRating: number;
  thisMonthEarnings: number;
}

export function OverviewPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEarnings: 0,
    pendingRequests: 0,
    completedRequests: 0,
    totalVideoAds: 0,
    averageRating: 0,
    thisMonthEarnings: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [creatorName, setCreatorName] = useState('');

  useEffect(() => {
    fetchDashboardData();
    
    let requestsSubscription: any;
    let earningsSubscription: any;
    
    const setupSubscriptions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to requests changes (correct table name)
      requestsSubscription = supabase
        .channel('requests_changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'requests',
            filter: `creator_id=eq.${user.id}`
          }, 
          (payload) => {
            console.log('Requests changed:', payload);
            fetchDashboardData(); // Refresh data when requests change
          }
        )
        .subscribe();

      console.log('Subscribed to requests changes for creator:', user.id);

      // Subscribe to wallet transactions changes (earnings)
      earningsSubscription = supabase
        .channel('wallet_transactions_changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'wallet_transactions',
            filter: `user_id=eq.${user.id}`
          }, 
          () => {
            fetchDashboardData(); // Refresh data when earnings change
          }
        )
        .subscribe();
    };

    setupSubscriptions();

    // Cleanup subscriptions on unmount
    return () => {
      if (requestsSubscription) {
        requestsSubscription.unsubscribe();
      }
      if (earningsSubscription) {
        earningsSubscription.unsubscribe();
      }
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get creator profile
      const { data: creatorProfile } = await supabase
        .from('creator_profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      if (creatorProfile) {
        setCreatorName(creatorProfile.name);
      }

      // Get total earnings
      const { data: earnings } = await supabase
        .from('wallet_transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('type', 'earning');

      const totalEarnings = earnings?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;

      // Get this month's earnings
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: monthlyEarnings } = await supabase
        .from('wallet_transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('type', 'earning')
        .gte('created_at', startOfMonth.toISOString());

      const thisMonthEarnings = monthlyEarnings?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;

      // Get request counts
      const { data: requests } = await supabase
        .from('requests')
        .select('status')
        .eq('creator_id', user.id);

      const pendingRequests = requests?.filter(r => r.status === 'pending').length || 0;
      const completedRequests = requests?.filter(r => r.status === 'completed').length || 0;

      // Get video ads count
      const { data: videoAds } = await supabase
        .from('video_ads')
        .select('id')
        .eq('creator_id', user.id);

      const totalVideoAds = videoAds?.length || 0;

      // Get average rating (mock for now)
      const averageRating = 4.8;

      setStats({
        totalEarnings,
        pendingRequests,
        completedRequests,
        totalVideoAds,
        averageRating,
        thisMonthEarnings
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, color = 'primary' }: {
    icon: React.ElementType;
    title: string;
    value: string | number;
    subtitle?: string;
    color?: string;
  }) => (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center">
        <div className={`flex-shrink-0 p-3 rounded-lg bg-${color}-100`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
        <div className="mr-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="text-lg font-medium text-gray-900">{value}</dd>
            {subtitle && <dd className="text-sm text-gray-500">{subtitle}</dd>}
          </dl>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow">
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          שלום {creatorName || 'יוצר'}! 👋
        </h1>
        <p className="text-gray-600">סקירה כללית על הפעילות שלך</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          icon={DollarSign}
          title="סך הכנסות"
          value={`₪${stats.totalEarnings.toFixed(2)}`}
          subtitle="מכל הזמנים"
          color="green"
        />

        <StatCard
          icon={TrendingUp}
          title="הכנסות החודש"
          value={`₪${stats.thisMonthEarnings.toFixed(2)}`}
          subtitle="החודש הנוכחי"
          color="blue"
        />

        <StatCard
          icon={Video}
          title="בקשות ממתינות"
          value={stats.pendingRequests}
          subtitle="דורשות טיפול"
          color="yellow"
        />

        <StatCard
          icon={Clock}
          title="בקשות שהושלמו"
          value={stats.completedRequests}
          subtitle="הושלמו בהצלחה"
          color="green"
        />

        <StatCard
          icon={Video}
          title="מודעות וידאו"
          value={stats.totalVideoAds}
          subtitle="מודעות פעילות"
          color="purple"
        />

        <StatCard
          icon={Star}
          title="דירוג ממוצע"
          value={stats.averageRating.toFixed(1)}
          subtitle="מתוך 5 כוכבים"
          color="yellow"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">פעילות אחרונה</h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="h-4 w-4 ml-2" />
              לא קיימת פעילות אחרונה
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">טיפים מהירים</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• עדכן את הפרופיל שלך כדי למשוך יותר לקוחות</li>
            <li>• הוסף מודעות וידאו חדשות להגדלת ההכנסות</li>
            <li>• ענה מהר לבקשות ללקוחות מרוצים</li>
            <li>• השתמש בתוכנית השותפים להכנסות נוספות</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
