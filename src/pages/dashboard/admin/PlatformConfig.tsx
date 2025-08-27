import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';

export function PlatformConfig() {
  const [settings, setSettings] = useState({
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
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data: configData, error } = await supabase
        .from('platform_config')
        .select('*');

      if (error) throw error;

      const configMap = configData.reduce((acc: any, item: any) => {
        acc[item.key] = item.value;
        return acc;
      }, {});

      setSettings({
        platformFee: configMap.platform_fee || 10,
        minRequestPrice: configMap.min_request_price || 5,
        maxRequestPrice: configMap.max_request_price || 1000,
        defaultDeliveryTime: configMap.default_delivery_time || 24,
        maxDeliveryTime: configMap.max_delivery_time || 72,
        allowedFileTypes: configMap.allowed_file_types || ['mp4', 'mov', 'avi'],
        maxFileSize: configMap.max_file_size || 100,
        autoApproveCreators: configMap.auto_approve_creators || false,
        requireEmailVerification: configMap.require_email_verification ?? true,
        enableDisputes: configMap.enable_disputes ?? true,
        disputeWindow: configMap.dispute_window || 48,
        payoutThreshold: configMap.payout_threshold || 50,
        payoutSchedule: configMap.payout_schedule || 'weekly',
      });
    } catch (error) {
      console.error('שגיאה בטעינת הגדרות:', error);
      toast.error('שגיאה בטעינת הגדרות');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Update platform fee separately using the RPC function
      const { data: feeResult, error: feeError } = await supabase.rpc(
        'update_platform_fee',
        { p_fee_percentage: settings.platformFee }
      );
      
      if (feeError) throw feeError;
      if (feeResult && !feeResult.success) {
        throw new Error(feeResult.error || 'Failed to update platform fee');
      }
      
      // Update other settings
      const updates = [
        { key: 'min_request_price', value: settings.minRequestPrice },
        { key: 'max_request_price', value: settings.maxRequestPrice },
        { key: 'default_delivery_time', value: settings.defaultDeliveryTime },
        { key: 'max_delivery_time', value: settings.maxDeliveryTime },
        { key: 'allowed_file_types', value: settings.allowedFileTypes },
        { key: 'max_file_size', value: settings.maxFileSize },
        { key: 'auto_approve_creators', value: settings.autoApproveCreators },
        { key: 'require_email_verification', value: settings.requireEmailVerification },
        { key: 'enable_disputes', value: settings.enableDisputes },
        { key: 'dispute_window', value: settings.disputeWindow },
        { key: 'payout_threshold', value: settings.payoutThreshold },
        { key: 'payout_schedule', value: settings.payoutSchedule },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('platform_config')
          .upsert({
            key: update.key,
            value: update.value, // The value is already in the correct format for JSONB
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'key'
          });

        if (error) throw error;
      }

      toast.success('ההגדרות עודכנו בהצלחה');
    } catch (error: any) {
      console.error('שגיאה בשמירת הגדרות:', error);
      toast.error(error.message || 'שגיאה בשמירת הגדרות');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSettings({
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
    });
    toast.success('ההגדרות אופסו לברירת המחדל');
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">הגדרות מערכת</h1>
        <div className="flex space-x-4">
          <button
            onClick={handleReset}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            איפוס לברירת מחדל
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Pricing & Fees */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">מחירים ועמלות</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                עמלת פלטפורמה (%)
              </label>
              <input
                type="number"
                value={settings.platformFee}
                onChange={(e) => setSettings({ ...settings, platformFee: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                min="0"
                max="100"
                step="0.1"
                disabled={loading}
              />
              <p className="mt-1 text-sm text-gray-500">
                אחוז העמלה שהפלטפורמה גובה מכל עסקה. למשל, אם העמלה היא 10% והמחיר הוא ₪100, היוצר יקבל ₪90.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                מחיר מינימלי לבקשה (₪)
              </label>
              <input
                type="number"
                value={settings.minRequestPrice}
                onChange={(e) => setSettings({ ...settings, minRequestPrice: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                min="1"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                מחיר מקסימלי לבקשה (₪)
              </label>
              <input
                type="number"
                value={settings.maxRequestPrice}
                onChange={(e) => setSettings({ ...settings, maxRequestPrice: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                min="1"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                סף תשלום (₪)
              </label>
              <input
                type="number"
                value={settings.payoutThreshold}
                onChange={(e) => setSettings({ ...settings, payoutThreshold: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                min="0"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Delivery Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">הגדרות אספקה</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                זמן אספקה ברירת מחדל (שעות)
              </label>
              <input
                type="number"
                value={settings.defaultDeliveryTime}
                onChange={(e) => setSettings({ ...settings, defaultDeliveryTime: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                min="1"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                זמן אספקה מקסימלי (שעות)
              </label>
              <input
                type="number"
                value={settings.maxDeliveryTime}
                onChange={(e) => setSettings({ ...settings, maxDeliveryTime: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                min="1"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Content Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">הגדרות תוכן</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                גודל קובץ מקסימלי (MB)
              </label>
              <input
                type="number"
                value={settings.maxFileSize}
                onChange={(e) => setSettings({ ...settings, maxFileSize: Number(e.target.value) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                min="1"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                סוגי קבצים מותרים
              </label>
              <input
                type="text"
                value={settings.allowedFileTypes.join(', ')}
                onChange={(e) => setSettings({ ...settings, allowedFileTypes: e.target.value.split(',').map(t => t.trim()) })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Platform Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">הגדרות פלטפורמה</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoApproveCreators"
                checked={settings.autoApproveCreators}
                onChange={(e) => setSettings({ ...settings, autoApproveCreators: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded ml-2"
                disabled={loading}
              />
              <label htmlFor="autoApproveCreators" className="block text-sm text-gray-900">
                אישור אוטומטי ליוצרים חדשים
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="requireEmailVerification"
                checked={settings.requireEmailVerification}
                onChange={(e) => setSettings({ ...settings, requireEmailVerification: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded ml-2"
                disabled={loading}
              />
              <label htmlFor="requireEmailVerification" className="block text-sm text-gray-900">
                דרוש אימות אימייל
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enableDisputes"
                checked={settings.enableDisputes}
                onChange={(e) => setSettings({ ...settings, enableDisputes: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded ml-2"
                disabled={loading}
              />
              <label htmlFor="enableDisputes" className="block text-sm text-gray-900">
                אפשר מערכת מחלוקות
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                שומר שינויים...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 ml-2" />
                שמור שינויים
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
