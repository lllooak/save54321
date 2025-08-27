import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { AlertTriangle, CheckCircle, RefreshCw, Save } from 'lucide-react';

interface PayPalCredentials {
  client_id: string;
  client_secret: string;
  environment: 'sandbox' | 'production';
}

export function PaypalIntegration() {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [credentials, setCredentials] = useState<PayPalCredentials>({
    client_id: '',
    client_secret: '',
    environment: 'sandbox'
  });

  const loadExistingCredentials = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'paypal_credentials')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error loading PayPal credentials:', error);
        return;
      }

      if (data?.value) {
        setCredentials(data.value as PayPalCredentials);
      }
    } catch (err) {
      console.error('Error loading PayPal credentials:', err);
    }
  };

  const saveCredentials = async () => {
    if (!credentials.client_id || !credentials.client_secret) {
      setErrorMessage('נא למלא את כל השדות הנדרשים');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase
        .from('platform_config')
        .upsert({
          key: 'paypal_credentials',
          value: credentials,
          updated_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      // Test connection after saving
      await checkConnection();
      
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'שגיאה בשמירת ההגדרות');
    } finally {
      setIsSaving(false);
    }
  };

  const checkConnection = async () => {
    setConnectionStatus('checking');
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-paypal-connection');
      
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to test PayPal connection');
      }
      
      if (data.connected) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('error');
        setErrorMessage(data.error || 'Could not verify PayPal connection');
      }
    } catch (err) {
      setConnectionStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
    }

    setLastChecked(new Date());
  };

  useEffect(() => {
    const initializeComponent = async () => {
      setIsLoading(true);
      await loadExistingCredentials();
      await checkConnection();
      setIsLoading(false);
    };

    initializeComponent();
  }, []);

  const handleInputChange = (field: keyof PayPalCredentials, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          <span className="mr-3 text-gray-600">טוען...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">שילוב PayPal</h1>
        <p className="text-gray-600">ניהול הגדרות שילוב PayPal והגדרת חשבון מסחר</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">סטטוס חיבור</h2>
          <button
            onClick={checkConnection}
            disabled={connectionStatus === 'checking'}
            className="flex items-center text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ml-2 ${connectionStatus === 'checking' ? 'animate-spin' : ''}`} />
            רענן בדיקה
          </button>
        </div>

        <div className="flex items-center mb-4">
          {connectionStatus === 'checking' ? (
            <div className="flex items-center text-gray-600">
              <RefreshCw className="h-5 w-5 ml-2 animate-spin" />
              בודק חיבור...
            </div>
          ) : connectionStatus === 'connected' ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-5 w-5 ml-2" />
              מחובר בהצלחה
            </div>
          ) : (
            <div className="flex items-center text-red-600">
              <AlertTriangle className="h-5 w-5 ml-2" />
              שגיאת חיבור
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
            {errorMessage}
          </div>
        )}

        {lastChecked && (
          <p className="text-sm text-gray-500">
            נבדק לאחרונה: {lastChecked.toLocaleString('he-IL')}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">הגדרות PayPal</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              מזהה לקוח PayPal *
            </label>
            <input
              type="text"
              value={credentials.client_id}
              onChange={(e) => handleInputChange('client_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              placeholder="הזן את מזהה הלקוח שלך"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סוד לקוח PayPal *
            </label>
            <input
              type="password"
              value={credentials.client_secret}
              onChange={(e) => handleInputChange('client_secret', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              placeholder="הזן את סוד הלקוח שלך"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סביבת PayPal
            </label>
            <select
              value={credentials.environment}
              onChange={(e) => handleInputChange('environment', e.target.value as 'sandbox' | 'production')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="sandbox">Sandbox (פיתוח)</option>
              <option value="production">Production (ייצור)</option>
            </select>
          </div>

          <div className="pt-4">
            <button
              onClick={saveCredentials}
              disabled={isSaving || !credentials.client_id || !credentials.client_secret}
              className="flex items-center bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 ml-2" />
              )}
              {isSaving ? 'שומר...' : 'שמור הגדרות'}
            </button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-md">
          <h3 className="text-sm font-medium text-blue-800 mb-2">הוראות הגדרה:</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>היכנס לחשבון PayPal Developer שלך</li>
            <li>צור אפליקציה חדשה או בחר אפליקציה קיימת</li>
            <li>העתק את Client ID ו-Client Secret</li>
            <li>בחר את הסביבה המתאימה (Sandbox לפיתוח, Production לייצור)</li>
            <li>שמור את ההגדרות ובדק את החיבור</li>
          </ol>
        </div>
      </div>
    </div>
  );
}