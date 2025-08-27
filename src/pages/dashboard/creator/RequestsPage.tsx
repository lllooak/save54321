import { useEffect, useState } from 'react';
import { useCreatorStore } from '../../../stores/creatorStore';
import { CheckCircle, XCircle, Search, Eye, ArrowUpDown, Calendar, AlertCircle } from 'lucide-react';
import { format, isBefore } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { RequestDetails } from '../../../components/RequestDetails';

interface RequestWithMeta {
  id: string;
  fan_id: string;
  fan_name?: string;
  fan_avatar?: string;
  request_type: string;
  status: string;
  price: number;
  message?: string;
  deadline: string;
  video_url?: string;
  created_at: string;
  recipient?: string;
  creator?: {
    name: string;
    avatar_url: string | null;
  };
}

type SortOrder = 'newest' | 'oldest';

export function RequestsPage() {
  const { requests, initializeRealtime } = useCreatorStore();
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<RequestWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  useEffect(() => {
    let cleanup: (() => void) | void;

    const initializeSubscriptions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('User not authenticated');
          return;
        }
        cleanup = await initializeRealtime();
      } catch (error) {
        console.error('Error initializing realtime subscriptions:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeSubscriptions();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  const filteredRequests = (requests || []).filter(request => {
    const matchesFilter = filter === 'all' || request.status === filter;
    const matchesSearch = (request.fan_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                         (request.request_type?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Sort the filtered requests based on the current sort order
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const dateA = new Date((a as any).created_at).getTime();
    const dateB = new Date((b as any).created_at).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const handleRequestClick = (request: RequestWithMeta) => {
    setSelectedRequest(request);
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest');
  };

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;
      
      // If request is marked as completed, update any related affiliate commissions
      if (newStatus === 'completed') {
        try {
          // Update any related affiliate commissions
          const { error: commissionError } = await supabase
            .from('affiliate_commissions')
            .update({ status: 'confirmed' })
            .eq('request_id', requestId)
            .eq('status', 'pending');

          if (commissionError) {
            console.error('Error updating affiliate commission:', commissionError);
          } else {
            console.log(`Updated affiliate commissions for completed request ${requestId}`);
          }
        } catch (affiliateError) {
          console.error('Error updating affiliate commissions:', affiliateError);
          // Don't throw error as this shouldn't block the main status update
        }
      }
      
      toast.success(`סטטוס הבקשה עודכן ל${newStatus === 'completed' ? 'הושלם' : 
                                          newStatus === 'approved' ? 'מאושר' : 
                                          newStatus === 'declined' ? 'נדחה' : newStatus}`);
      
      // Update local state
      initializeRealtime();
    } catch (error) {
      console.error('Error updating request status:', error);
      toast.error('שגיאה בעדכון סטטוס הבקשה');
    }
  };

  // Function to check if deadline is passed or close
  const getDeadlineStatus = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const isPastDeadline = isBefore(deadlineDate, today);
    
    // Calculate days remaining
    const daysRemaining = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isCloseToDeadline = daysRemaining >= 0 && daysRemaining <= 2;
    
    return { isPastDeadline, isCloseToDeadline, daysRemaining };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">בקשות וידאו</h1>
        <div className="flex space-x-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="חיפוש בקשות..."
              className="pr-10 pl-4 py-2 border rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded-lg px-4 py-2"
          >
            <option value="all">כל הבקשות</option>
            <option value="pending">בהמתנה</option>
            <option value="approved">מאושרות</option>
            <option value="completed">הושלמו</option>
            <option value="declined">נדחו</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מעריץ</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סוג</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">סטטוס</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מחיר</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך יעד</th>
                <th 
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={toggleSortOrder}
                >
                  <div className="flex items-center justify-end">
                    תאריך יצירה
                    <ArrowUpDown className="h-4 w-4 mr-1" />
                    <span className="text-xs font-normal mr-1">
                      ({sortOrder === 'newest' ? 'חדש לישן' : 'ישן לחדש'})
                    </span>
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">פעולות</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRequests.length > 0 ? (
                sortedRequests.map((request) => {
                  const { isPastDeadline, isCloseToDeadline, daysRemaining } = getDeadlineStatus(request.deadline);
                  
                  return (
                    <tr key={request.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleRequestClick(request as RequestWithMeta)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <img
                              className="h-10 w-10 rounded-full"
                              src={request.fan_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.fan_name || '')}`}
                              alt=""
                            />
                          </div>
                          <div className="mr-4">
                            <div className="text-sm font-medium text-gray-900">{request.fan_name || 'אנונימי'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{request.request_type || 'לא צוין'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${request.status === 'approved' ? 'bg-green-100 text-green-800' : ''}
                          ${request.status === 'completed' ? 'bg-blue-100 text-blue-800' : ''}
                          ${request.status === 'declined' ? 'bg-red-100 text-red-800' : ''}
                        `}>
                          {request.status === 'pending' ? 'בהמתנה' :
                           request.status === 'approved' ? 'מאושר' :
                           request.status === 'completed' ? 'הושלם' : 'נדחה'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ₪{request.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Calendar className={`h-4 w-4 mr-1 ${isPastDeadline ? 'text-red-500' : isCloseToDeadline ? 'text-yellow-500' : 'text-gray-400'}`} />
                          <span className={`text-sm ${isPastDeadline ? 'text-red-600 font-bold' : isCloseToDeadline ? 'text-yellow-600 font-medium' : 'text-gray-500'}`}>
                            {format(new Date(request.deadline), 'dd/MM/yyyy')}
                            {isPastDeadline && (
                              <span className="mr-1 text-red-600">
                                <AlertCircle className="h-4 w-4 inline ml-1" />
                                עבר התאריך!
                              </span>
                            )}
                            {isCloseToDeadline && !isPastDeadline && (
                              <span className="mr-1 text-yellow-600">
                                ({daysRemaining} ימים)
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date((request as any).created_at), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                          {request.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleStatusUpdate(request.id, 'approved')}
                                className="text-green-600 hover:text-green-900 bg-green-100 p-1 rounded-md"
                                title="אשר"
                              >
                                <CheckCircle className="h-5 w-5" />
                              </button>
                              <button 
                                onClick={() => handleStatusUpdate(request.id, 'declined')}
                                className="text-red-600 hover:text-red-900 bg-red-100 p-1 rounded-md"
                                title="דחה"
                              >
                                <XCircle className="h-5 w-5" />
                              </button>
                            </>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestClick(request as RequestWithMeta);
                            }}
                            className="text-primary-600 hover:text-primary-900 bg-primary-100 p-1 rounded-md"
                            title="צפה בפרטים"
                          >
                            <Eye className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    לא נמצאו בקשות
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selectedRequest && (
        <RequestDetails
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onStatusUpdate={() => {
            initializeRealtime();
            setSelectedRequest(null);
          }}
        />
      )}
    </div>
  );
}
