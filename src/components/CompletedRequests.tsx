import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Video, Calendar, DollarSign, Clock, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Request {
  id: string;
  creator_id: string;
  request_type: string;
  status: string;
  price: number;
  deadline: string;
  created_at: string;
  video_url?: string;
  creator?: {
    name: string;
    avatar_url: string | null;
  };
}

interface CompletedRequestsProps {
  requests: Request[];
}

export function CompletedRequests({ requests }: CompletedRequestsProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});

  const validateSupabaseUrl = (url: string): boolean => {
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      // Check if URL is from Supabase storage
      return urlObj.hostname.includes('supabase.co') && 
             urlObj.pathname.includes('/storage/v1/object/');
    } catch {
      return false;
    }
  };

  const getSignedUrl = async (videoUrl: string): Promise<string | null> => {
    try {
      if (!videoUrl) return null;
      
      // If it's not a Supabase URL, return as is
      if (!validateSupabaseUrl(videoUrl)) {
        return videoUrl;
      }

      // For external video URLs (like YouTube, Vimeo, etc.)
      if (!videoUrl.includes('supabase.co/storage')) {
        return videoUrl;
      }

      // Extract the bucket and file path from the URL
      const urlObj = new URL(videoUrl);
      const pathParts = urlObj.pathname.split('/storage/v1/object/public/');
      
      if (pathParts.length !== 2) {
        console.error('Invalid Supabase storage URL format:', videoUrl);
        return videoUrl; // Return original URL as fallback
      }

      const [bucket, ...pathSegments] = pathParts[1].split('/');
      const filePath = pathSegments.join('/');

      // Generate a signed URL that expires in 60 minutes
      const { data, error } = await supabase
        .storage
        .from(bucket)
        .createSignedUrl(filePath, 3600);

      if (error) {
        console.error('Error generating signed URL:', error);
        return videoUrl; // Return original URL as fallback
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error in getSignedUrl:', error);
      return videoUrl; // Return original URL as fallback
    }
  };

  // Load signed URLs when component mounts or requests change
  useEffect(() => {
    const loadSignedUrls = async () => {
      const newSignedUrls: Record<string, string> = {};
      const newLoadingState: Record<string, boolean> = {};
      
      for (const request of requests) {
        if (request.video_url) {
          newLoadingState[request.video_url] = true;
          setLoadingUrls({...loadingUrls, ...newLoadingState});
          
          try {
            const signedUrl = await getSignedUrl(request.video_url);
            if (signedUrl) {
              newSignedUrls[request.video_url] = signedUrl;
            }
          } catch (error) {
            console.error('Error getting signed URL:', error);
          } finally {
            newLoadingState[request.video_url] = false;
          }
        }
      }
      
      setSignedUrls(prev => ({...prev, ...newSignedUrls}));
      setLoadingUrls(prev => ({...prev, ...newLoadingState}));
    };

    loadSignedUrls();
  }, [requests]);

  const handleDownload = async (videoUrl: string, creatorName: string, requestId: string) => {
    try {
      if (!videoUrl) {
        throw new Error('כתובת הוידאו חסרה');
      }

      // Get or create a signed URL for the video
      let downloadUrl = signedUrls[videoUrl] || videoUrl;
      if (!signedUrls[videoUrl] && validateSupabaseUrl(videoUrl)) {
        const newSignedUrl = await getSignedUrl(videoUrl);
        if (newSignedUrl) {
          downloadUrl = newSignedUrl;
          setSignedUrls(prev => ({...prev, [videoUrl]: newSignedUrl}));
        }
      }

      const fileName = `${creatorName.replace(/\s+/g, '_')}_video_${requestId.substring(0, 8)}.mp4`;

      // Check if the URL is a direct link to a video file
      if (!validateSupabaseUrl(videoUrl)) {
        // For external URLs, open in new tab
        window.open(downloadUrl, '_blank');
        toast.success('הוידאו נפתח בחלון חדש');
        return;
      }

      // For Supabase storage URLs
      try {
        // Fetch the video file
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
          throw new Error(`שגיאה בגישה לוידאו: ${response.status} ${response.statusText}`);
        }
        
        // Get the blob
        const blob = await response.blob();
        
        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('הורדת הוידאו החלה');
      } catch (error) {
        console.error('Error downloading video:', error);
        
        // Fallback to opening in new tab
        window.open(downloadUrl, '_blank');
        toast.success('הוידאו נפתח בחלון חדש');
      }
    } catch (error) {
      console.error('Error downloading video:', {
        videoUrl,
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      let errorMessage = 'שגיאה בהורדת הוידאו';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  const handleVideoError = (videoUrl: string, e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error('Video error:', {
      url: videoUrl,
      error: e
    });
    
    // Mark this video URL as having an error
    setVideoErrors(prev => ({...prev, [videoUrl]: true}));
    
    // Hide the video element
    const videoElement = e.target as HTMLVideoElement;
    videoElement.style.display = 'none';
    
    // Show error message
    toast.error('שגיאה בטעינת הוידאו');
    
    // Try to refresh the signed URL
    if (validateSupabaseUrl(videoUrl)) {
      getSignedUrl(videoUrl).then(newUrl => {
        if (newUrl && newUrl !== signedUrls[videoUrl]) {
          setSignedUrls(prev => ({...prev, [videoUrl]: newUrl}));
          setVideoErrors(prev => ({...prev, [videoUrl]: false}));
          
          // Make the video visible again
          videoElement.style.display = 'block';
          
          // Set the new URL
          videoElement.src = newUrl;
          videoElement.load();
        }
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">בקשות וידאו</h2>
      </div>
      
      <div className="divide-y divide-gray-200">
        {requests.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            אין בקשות וידאו עדיין
          </div>
        ) : (
          requests.map((request) => (
            <div key={request.id} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <img
                    src={request.creator?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.creator?.name || '')}`}
                    alt={request.creator?.name}
                    className="h-10 w-10 rounded-full"
                  />
                  <div className="mr-3">
                    <h3 className="text-sm font-medium text-gray-900">
                      {request.creator?.name || 'יוצר לא ידוע'}
                    </h3>
                    <p className="text-sm text-gray-500">{request.request_type}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  request.status === 'completed' ? 'bg-green-100 text-green-800' :
                  request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {request.status === 'completed' ? 'הושלם' :
                   request.status === 'pending' ? 'בהמתנה' :
                   request.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-400 ml-2" />
                  <div>
                    <p className="text-xs text-gray-500">תאריך הזמנה</p>
                    <p className="text-sm font-medium">
                      {format(new Date(request.created_at), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <Clock className="h-6 w-6 text-blue-600 ml-2" />
                  <div>
                    <p className="text-xs font-bold text-blue-800">⏰ תאריך יעד למשלוח</p>
                    <p className="text-sm font-bold text-blue-800">
                      {format(new Date(request.deadline), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <DollarSign className="h-5 w-5 text-gray-400 ml-2" />
                  <div>
                    <p className="text-xs text-gray-500">מחיר</p>
                    <p className="text-sm font-medium">₪{request.price.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {request.status === 'completed' && request.video_url && (
                <div className="mt-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="flex-grow">
                      {loadingUrls[request.video_url] ? (
                        <div className="flex justify-center items-center h-48 bg-gray-100 rounded-lg">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                      ) : videoErrors[request.video_url] ? (
                        <div className="p-4 text-center text-red-600 bg-red-50 rounded-lg">
                          שגיאה בטעינת הוידאו. נסה שוב מאוחר יותר.
                        </div>
                      ) : (
                        <video
                          key={signedUrls[request.video_url] || request.video_url}
                          src={signedUrls[request.video_url] || request.video_url}
                          controls
                          className="w-full rounded-lg"
                          poster={request.creator?.avatar_url || undefined}
                          onError={(e) => handleVideoError(request.video_url!, e)}
                        >
                          Your browser does not support the video tag.
                        </video>
                      )}
                    </div>
                    <div className="mt-3 md:mt-0 md:ml-4 flex justify-end">
                      <button
                        onClick={() => handleDownload(request.video_url!, request.creator?.name || 'Creator', request.id)}
                        className="flex items-center px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                      >
                        <Download className="h-4 w-4 ml-2" />
                        הורד וידאו
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
