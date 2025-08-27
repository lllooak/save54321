import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Star, Clock, Calendar, Users, Search, Filter, DollarSign, CheckCircle, XCircle, Eye, ArrowUpDown, Check, AlertCircle, Loader } from 'lucide-react';
import { format, isBefore, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

interface VideoRequest {
  id: string;
  creator_id: string;
  fan_id: string;
  request_type: string;
  status: string;
  price: number;
  message?: string;
  deadline: string;
  created_at: string;
  creator_name?: string;
  fan_name?: string;
  video_url?: string;
  recipient?: string;
}

export function VideoRequests() {
  const [requests, setRequests] = useState<VideoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [totalRequests, setTotalRequests] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<VideoRequest | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    fetchVideoRequests();
  }, [statusFilter, refreshTrigger, sortOrder]);

  // These helper functions are no longer needed since the service role function
  // returns creator and fan names directly

  async function fetchVideoRequests() {
    try {
      setLoading(true);
      setError(null);

      // Get the total count using service role function
      const statusFilterParam = statusFilter !== 'all' ? statusFilter : null;
      const { data: countData, error: countError } = await supabase.rpc(
        'admin_get_requests_count',
        { p_status_filter: statusFilterParam }
      );
      
      if (countError) throw countError;
      setTotalRequests(countData || 0);

      // Get the requests data using service role function
      const { data: requestsData, error: dataError } = await supabase.rpc(
        'admin_get_all_requests',
        { 
          p_status_filter: statusFilterParam,
          p_limit: 50,
          p_order_by: sortOrder
        }
      );

      if (dataError) throw dataError;

      // Data already includes creator_name and fan_name from the service function
      setRequests(requestsData || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת בקשות');
    } finally {
      setLoading(false);
    }
  }

  async function updateRequestStatus(requestId: string, newStatus: string) {
    try {
      setProcessingRequestId(requestId);
      
      // First, check if the request exists and get its current status using service role function
      const { data: requestDataArray, error: requestError } = await supabase.rpc(
        'admin_get_request_details',
        { p_request_id: requestId }
      );
      
      if (requestError) throw requestError;
      
      const requestData = requestDataArray?.[0];
      
      if (!requestData) {
        throw new Error('הבקשה לא נמצאה');
      }
      
      // If status is already the same, do nothing
      if (requestData.status === newStatus) {
        toast('הסטטוס כבר מעודכן');
        setProcessingRequestId(null);
        return;
      }
      
      // Special handling for completed status
      if (newStatus === 'completed') {
        // Check if video URL exists for completion
        if (!requestData.video_url) {
          toast.error('לא ניתן להשלים בקשה ללא סרטון');
          setProcessingRequestId(null);
          return;
        }
        
        // Call the function to update earnings and creator balance
        const { data: completionData, error: completionError } = await supabase.rpc(
          'complete_request_and_pay_creator',
          { p_request_id: requestId }
        );
        
        if (completionError) throw completionError;
        
        if (!completionData?.success) {
          throw new Error(completionData?.error || 'שגיאה בעדכון הסטטוס');
        }
        
        toast.success('הבקשה הושלמה והתשלום הועבר ליוצר');
      } 
      // For other status changes, use service role function
      else {
        const { data: updateResult, error } = await supabase.rpc(
          'admin_update_request_status',
          { 
            p_request_id: requestId,
            p_new_status: newStatus
          }
        );

        if (error) throw error;
        
        if (newStatus === 'declined') {
          toast.success('הבקשה נדחתה והכסף הוחזר למעריץ');
        } else if (newStatus === 'approved' && requestData.status === 'declined') {
          toast.success('הבקשה אושרה והכסף נלקח שוב מהמעריץ');
        } else {
          toast.success(`הבקשה עודכנה לסטטוס ${
            newStatus === 'approved' ? 'מאושר' : 
            newStatus === 'pending' ? 'ממתין' : 
            newStatus
          }`);
        }
      }

      // Audit logging is now handled by the service role function
      
      // Refresh the requests to get the latest data
      setRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
      console.error('Error updating request status:', error);
      toast.error(error.message || 'שגיאה בעדכון סטטוס הבקשה');
    } finally {
      setProcessingRequestId(null);
    }
  }

  const filteredRequests = requests.filter(request => {
    if (!searchQuery) return true;
    
    return (
      (request.creator_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (request.fan_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (request.message?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (request.request_type?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (request.recipient?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
    );
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'ממתין';
      case 'approved': return 'מאושר';
      case 'completed': return 'הושלם';
      case 'declined': return 'נדחה';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleViewRequest = (request: VideoRequest) => {
    setSelectedRequest(request);
    setIsRequestModalOpen(true);
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest');
  };

  // Function to check if deadline is passed or close
  const getDeadlineStatus = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const isPastDeadline = isBefore(deadlineDate, today);
    const daysRemaining = differenceInDays(deadlineDate, today);
    const isCloseToDeadline = daysRemaining >= 0 && daysRemaining <= 2;
    
    return { isPastDeadline, isCloseToDeadline, daysRemaining };
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-8 bg-red-50 rounded-lg">
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">בקשות וידאו</h1>
          <p className="text-sm text-gray-500 mt-1">סה"כ {totalRequests} בקשות</p>
        </div>
        <div className="flex gap-4">
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
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">כל הסטטוסים</option>
            <option value="pending">ממתין</option>
            <option value="approved">מאושר</option>
            <option value="completed">הושלם</option>
            <option value="declined">נדחה</option>
          </select>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    מזהה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    יוצר
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    מעריץ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סוג
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סטטוס
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    מחיר
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    תאריך יעד
                  </th>
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((request) => {
                    const { isPastDeadline, isCloseToDeadline, daysRemaining } = getDeadlineStatus(request.deadline);
                    
                    return (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {request.id.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {request.creator_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {request.fan_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {request.request_type || 'לא צוין'}
                          {request.recipient && (
                            <div className="text-xs text-gray-400">
                              עבור: {request.recipient}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={request.status}
                            onChange={(e) => updateRequestStatus(request.id, e.target.value)}
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}
                            disabled={processingRequestId === request.id}
                          >
                            <option value="pending">ממתין</option>
                            <option value="approved">מאושר</option>
                            <option value="completed">הושלם</option>
                            <option value="declined">נדחה</option>
                          </select>
                          {processingRequestId === request.id && (
                            <div className="mt-1 text-xs text-gray-500 flex items-center">
                              <div className="animate-spin h-3 w-3 border-b border-primary-600 rounded-full mr-1"></div>
                              מעדכן...
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ₪{request.price}
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
                          {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => handleViewRequest(request)}
                              className="text-blue-600 hover:text-blue-900 bg-blue-100 p-1 rounded-md"
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
                    <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                      לא נמצאו בקשות התואמות את החיפוש
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request Details Modal */}
      {isRequestModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">פרטי בקשה</h2>
              <button onClick={() => setIsRequestModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <span className="sr-only">סגור</span>
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">מזהה בקשה</label>
                <p className="mt-1">{selectedRequest.id}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">יוצר</label>
                <p className="mt-1">{selectedRequest.creator_name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">מעריץ</label>
                <p className="mt-1">{selectedRequest.fan_name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">סוג בקשה</label>
                <p className="mt-1">{selectedRequest.request_type}</p>
              </div>

              {selectedRequest.recipient && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">נמען</label>
                  <p className="mt-1">{selectedRequest.recipient}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">מחיר</label>
                <p className="mt-1">₪{Number(selectedRequest.price).toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">תאריך יעד</label>
                <div className="flex items-center mt-1">
                  <Calendar className={`h-5 w-5 ml-2 ${
                    isBefore(new Date(selectedRequest.deadline), new Date()) 
                      ? 'text-red-500' 
                      : differenceInDays(new Date(selectedRequest.deadline), new Date()) <= 2 
                        ? 'text-yellow-500' 
                        : 'text-gray-500'
                  }`} />
                  <p className={`${
                    isBefore(new Date(selectedRequest.deadline), new Date()) 
                      ? 'text-red-600 font-bold' 
                      : differenceInDays(new Date(selectedRequest.deadline), new Date()) <= 2 
                        ? 'text-yellow-600 font-bold' 
                        : ''
                  }`}>
                    {format(new Date(selectedRequest.deadline), 'dd/MM/yyyy')}
                    {isBefore(new Date(selectedRequest.deadline), new Date()) && (
                      <span className="mr-2 text-red-600">
                        <AlertCircle className="h-4 w-4 inline ml-1" />
                        עבר התאריך!
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">תאריך יצירה</label>
                <p className="mt-1">{format(new Date(selectedRequest.created_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>

              {selectedRequest.message && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">הודעה</label>
                  <p className="mt-1 p-3 bg-gray-50 rounded-md">{selectedRequest.message}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">סטטוס</label>
                <select
                  value={selectedRequest.status}
                  onChange={(e) => updateRequestStatus(selectedRequest.id, e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  disabled={processingRequestId === selectedRequest.id}
                >
                  <option value="pending">ממתין</option>
                  <option value="approved">מאושר</option>
                  <option value="completed">הושלם</option>
                  <option value="declined">נדחה</option>
                </select>
                {processingRequestId === selectedRequest.id && (
                  <div className="mt-1 text-sm text-gray-500 flex items-center">
                    <div className="animate-spin h-4 w-4 border-b border-primary-600 rounded-full mr-1"></div>
                    מעדכן סטטוס...
                  </div>
                )}
              </div>

              {selectedRequest.video_url && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">וידאו</label>
                  <div className="mt-1">
                    <video
                      src={selectedRequest.video_url}
                      controls
                      className="w-full rounded-lg"
                      onError={(e) => {
                        console.error('Video error:', e);
                        toast.error('שגיאה בטעינת הוידאו');
                        (e.target as HTMLVideoElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  סגור
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
