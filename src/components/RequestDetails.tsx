import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Video, CheckCircle, X, Send, Check, Calendar, AlertCircle } from 'lucide-react';
import { format, isBefore, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

interface RequestDetailsProps {
  request: {
    id: string;
    fan_name?: string;
    fan_id: string;
    request_type: string;
    status: string;
    price: number;
    message?: string;
    deadline: string;
    video_url?: string;
    creator?: {
      name: string;
      avatar_url: string | null;
    };
    recipient?: string;
  };
  onClose: () => void;
  onStatusUpdate: () => void;
}

export function RequestDetails({ request, onClose, onStatusUpdate }: RequestDetailsProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Calculate days remaining until deadline
  const deadlineDate = new Date(request.deadline);
  const today = new Date();
  const daysRemaining = differenceInDays(deadlineDate, today);
  
  // Determine deadline status
  const isPastDeadline = daysRemaining < 0;
  const isCloseToDeadline = daysRemaining >= 0 && daysRemaining <= 2;

  const handleApprove = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('requests')
        .update({ status: 'approved' })
        .eq('id', request.id);

      if (error) throw error;
      
      toast.success('הבקשה אושרה בהצלחה');
      onStatusUpdate();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('שגיאה באישור הבקשה');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('requests')
        .update({ status: 'declined' })
        .eq('id', request.id);

      if (error) throw error;
      
      toast.success('הבקשה נדחתה והכסף הוחזר למעריץ');
      onStatusUpdate();
    } catch (error) {
      console.error('Error declining request:', error);
      toast.error('שגיאה בדחיית הבקשה');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      if (!videoFile && !request.video_url) {
        setVideoError('נא לבחור קובץ וידאו לפני השלמת הבקשה');
        return;
      }
      
      setLoading(true);
      
      // If there's a new video file, upload it first
      let videoUrl = request.video_url;
      if (videoFile) {
        videoUrl = await handleVideoUpload();
        if (!videoUrl) {
          throw new Error('שגיאה בהעלאת הוידאו');
        }
      }
      
      console.log('Attempting to complete request:', request.id, 'Current status:', request.status);
      const { data: updatedRequest, error: updateError } = await supabase.rpc(
        'complete_request_and_pay_creator',
        { p_request_id: request.id }
      );

      if (updateError) {
        console.error('RPC Error:', updateError);
        throw updateError;
      }
      
      if (!updatedRequest?.success) {
        const errorMsg = updatedRequest?.error || 'שגיאה בהשלמת הבקשה';
        console.error('Request completion failed:', errorMsg, 'Request ID:', request.id);
        
        // Provide more specific error messages
        if (errorMsg.includes('Request not found or already completed')) {
          throw new Error('הבקשה כבר הושלמה או לא נמצאה. אנא רענן את הדף ונסה שוב.');
        } else if (errorMsg.includes('Request already processed')) {
          throw new Error('הבקשה כבר עובדה. אנא בדוק את היסטוריית ההכנסות שלך.');
        }
        
        throw new Error(errorMsg);
      }

      toast.success('הוידאו הועלה והבקשה הושלמה בהצלחה');
      onStatusUpdate();
    } catch (error) {
      console.error('Error completing request:', error);
      
      // Capture detailed Supabase error information
      let errorMessage = 'שגיאה לא ידועה';
      
      if (error && typeof error === 'object') {
        // Handle Supabase error format
        const supabaseError = error as any;
        if (supabaseError.message) {
          errorMessage = supabaseError.message;
        } else if (supabaseError.error?.message) {
          errorMessage = supabaseError.error.message;
        } else if (supabaseError.details) {
          errorMessage = supabaseError.details;
        } else {
          // Stringify the entire error object for debugging
          errorMessage = JSON.stringify(error, null, 2);
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      console.error('Detailed error:', errorMessage);
      console.error('Full error object:', error);
      
      toast.error(`שגיאה בהשלמת הבקשה: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoUpload = async () => {
    if (!videoFile) {
      setVideoError('נא לבחור קובץ וידאו');
      return null;
    }

    try {
      setUploading(true);
      setVideoError(null);

      // Validate file before upload
      console.log('Starting video upload:', {
        fileName: videoFile.name,
        fileSize: videoFile.size,
        fileType: videoFile.type,
        requestId: request.id
      });

      // Check file size (max 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (videoFile.size > maxSize) {
        throw new Error(`קובץ הוידאו גדול מדי. הגודל המקסימלי הוא 100MB. הקובץ שלך: ${(videoFile.size / 1024 / 1024).toFixed(2)}MB`);
      }

      // Check file type
      const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'];
      if (!allowedTypes.includes(videoFile.type)) {
        throw new Error(`סוג קובץ לא נתמך. סוגי קבצים מותרים: MP4, MOV, AVI. סוג הקובץ שלך: ${videoFile.type}`);
      }

      // Verify user authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('לא מחובר למערכת. אנא התחבר מחדש ונסה שוב.');
      }

      console.log('User authenticated, proceeding with upload:', user.id);

      // Upload video to storage
      const fileExt = videoFile.name.split('.').pop();
      const filePath = `${request.id}/${Date.now()}.${fileExt}`;

      console.log('Uploading to path:', filePath);

      const { error: uploadError, data } = await supabase.storage
        .from('request-videos')
        .upload(filePath, videoFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        let errorMessage = 'שגיאה בהעלאת הוידאו לאחסון';
        
        if (uploadError.message?.includes('Permission denied')) {
          errorMessage = 'אין הרשאה להעלות וידאו. אנא וודא שאתה היוצר של הבקשה.';
        } else if (uploadError.message?.includes('Bucket not found')) {
          errorMessage = 'בעיה טכנית באחסון. אנא פנה לתמיכה.';
        } else if (uploadError.message?.includes('File size')) {
          errorMessage = 'קובץ הוידאו גדול מדי.';
        } else if (uploadError.message) {
          errorMessage = `שגיאה בהעלאת הוידאו: ${uploadError.message}`;
        }
        
        throw new Error(errorMessage);
      }

      console.log('Upload successful, getting public URL');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('request-videos')
        .getPublicUrl(filePath);

      if (!publicUrl) {
        throw new Error('שגיאה ביצירת קישור לוידאו');
      }

      console.log('Public URL generated:', publicUrl);

      // Update request with video URL
      const { error: updateError } = await supabase
        .from('requests')
        .update({
          video_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        
        // If database update fails, try to clean up uploaded file
        try {
          await supabase.storage
            .from('request-videos')
            .remove([filePath]);
          console.log('Cleaned up uploaded file after database error');
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded file:', cleanupError);
        }
        
        let errorMessage = 'שגיאה בעדכון פרטי הבקשה';
        if (updateError.message?.includes('Permission denied')) {
          errorMessage = 'אין הרשאה לעדכן את הבקשה.';
        } else if (updateError.message) {
          errorMessage = `שגיאה בעדכון הבקשה: ${updateError.message}`;
        }
        
        throw new Error(errorMessage);
      }

      console.log('Video upload and database update completed successfully');
      toast.success('הוידאו הועלה בהצלחה');
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading video:', error);
      
      let errorMessage = 'שגיאה לא ידועה בהעלאת הוידאו';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        const supabaseError = error as any;
        if (supabaseError.message) {
          errorMessage = supabaseError.message;
        } else if (supabaseError.error?.message) {
          errorMessage = supabaseError.error.message;
        }
      }
      
      console.error('Final error message:', errorMessage);
      toast.error(errorMessage);
      setVideoError(errorMessage);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4" dir="rtl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">פרטי בקשה</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">מעריץ</label>
            <p className="mt-1">{request.fan_name || 'לא ידוע'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">סוג בקשה</label>
            <p className="mt-1">{request.request_type}</p>
          </div>

          {request.recipient && (
            <div>
              <label className="block text-sm font-medium text-gray-700">נמען</label>
              <p className="mt-1">{request.recipient}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">מחיר</label>
            <p className="mt-1">₪{Number(request.price).toFixed(2)}</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-bold text-blue-800 mb-2">⏰ תאריך יעד למשלוח</label>
            <div className="flex items-center">
              <Calendar className={`h-6 w-6 ml-3 ${isPastDeadline ? 'text-red-500' : isCloseToDeadline ? 'text-yellow-500' : 'text-blue-600'}`} />
              <p className={`text-lg font-bold ${isPastDeadline ? 'text-red-600' : isCloseToDeadline ? 'text-yellow-600' : 'text-blue-800'}`}>
                {format(new Date(request.deadline), 'dd/MM/yyyy')}
                <span className="text-sm font-semibold mr-2">
                  {isPastDeadline ? ' (עבר התאריך!)' : 
                   isCloseToDeadline ? ` (${daysRemaining} ימים נותרו)` : 
                   ` (${daysRemaining} ימים נותרו)`}
                </span>
              </p>
            </div>
          </div>

          {request.message && (
            <div>
              <label className="block text-sm font-medium text-gray-700">הודעה</label>
              <div className="mt-1 p-4 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-right">
                  {request.message}
                </p>
              </div>
            </div>
          )}

          {request.status === 'pending' && (
            <div className="flex space-x-4 space-x-reverse">
              <button
                onClick={handleApprove}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="h-5 w-5 ml-2" />
                אשר בקשה
              </button>
              <button
                onClick={handleDecline}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <X className="h-5 w-5 ml-2" />
                דחה בקשה
              </button>
            </div>
          )}

          {request.status === 'approved' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  העלה וידאו <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    setVideoFile(e.target.files?.[0] || null);
                    setVideoError(null);
                  }}
                  className={`block w-full text-sm text-gray-500
                     file:ml-4 file:py-2 file:px-4
                     file:rounded-full file:border-0
                     file:text-sm file:font-semibold
                     file:bg-primary-50 file:text-primary-700
                    hover:file:bg-primary-100 ${videoError ? 'border border-red-500 rounded-md' : ''}`}
                />
                {videoError && (
                  <p className="mt-1 text-sm text-red-600">{videoError}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  העלאת וידאו הינה חובה להשלמת הבקשה
                </p>
              </div>
              <div className="flex space-x-4 space-x-reverse">
                <button
                  onClick={handleComplete}
                  disabled={!videoFile && !request.video_url || uploading || loading}
                  className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      מעלה וידאו...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 ml-2" />
                      {request.video_url ? 'השלם בקשה' : 'שלח וידאו והשלם'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {request.status === 'completed' && request.video_url && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                וידאו שנשלח
              </label>
              <video
                src={request.video_url}
                controls
                className="w-full rounded-lg"
                onError={(e) => {
                  console.error('Video error:', e);
                  toast.error('שגיאה בטעינת הוידאו');
                  (e.target as HTMLVideoElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
