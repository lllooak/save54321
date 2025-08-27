import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface PayPalButtonProps {
  amount: number;
  onSuccess?: () => void;
  onError?: (error: any) => void;
  onCancel?: () => void;
  disabled?: boolean;
  returnUrl?: string;
}

export function PayPalButton({ amount, onSuccess, onError, onCancel, disabled = false, returnUrl }: PayPalButtonProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPayPalReady, setIsPayPalReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;

  useEffect(() => {
    checkAuth();
    testPayPalConnection();
  }, []);

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setErrorMessage('Authentication error. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }

  async function testPayPalConnection() {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      const { data, error } = await supabase.functions.invoke('test-paypal-connection');
      
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to connect to PayPal service');
      }
      
      if (!data.connected) {
        if (data.error === 'PayPal credentials are not configured') {
          setErrorMessage('PayPal payments are currently unavailable. Please contact support or try another payment method.');
          setIsPayPalReady(false);
          return;
        }
        throw new Error(data.error || 'PayPal connection test failed');
      }

      setIsPayPalReady(true);
    } catch (error: any) {
      console.error('PayPal connection test failed:', error);
      setErrorMessage('PayPal service is currently unavailable. Please try again later.');
      setIsPayPalReady(false);
      // Don't show toast errors for configuration issues to avoid spamming users
      if (!error.message.includes('PayPal credentials are not configured') && 
          !error.message.includes('PayPal is not configured')) {
        toast.error('PayPal service is currently unavailable');
      }
    } finally {
      setIsLoading(false);
    }
  }

  const createOrder = async () => {
    try {
      // Validate amount before making the request
      if (!amount || amount <= 0) {
        throw new Error('Please enter a valid amount greater than 0');
      }

      // Round to 2 decimal places
      const roundedAmount = parseFloat(amount.toFixed(2));

      const { data, error } = await supabase.functions.invoke('create-paypal-order', {
        body: { 
          amount: roundedAmount,
          currency: 'ILS',
          description: 'Wallet top-up',
          return_url: returnUrl || window.location.href
        }
      });

      // Handle edge function error
      if (error) {
        console.error('Edge function error:', {
          error,
          status: error.status,
          message: error.message,
          details: error.details
        });
        throw new Error(error.message || 'Failed to create PayPal order');
      }

      // Handle response error
      if (!data) {
        throw new Error('No response from payment service');
      }

      // Handle unsuccessful response
      if (!data.success) {
        throw new Error(data.error || 'Error creating PayPal order');
      }

      // Validate required response data
      if (!data.order_id || !data.transaction_id) {
        console.error('Invalid response data:', data);
        throw new Error('Invalid response from payment service');
      }

      // Store transaction details
      localStorage.setItem('paypal_transaction_id', data.transaction_id);
      localStorage.setItem('paypal_order_id', data.order_id);

      return data.order_id;
    } catch (error: any) {
      // Clean up any stored data
      localStorage.removeItem('paypal_transaction_id');
      localStorage.removeItem('paypal_order_id');

      // Log detailed error for debugging
      console.error('Error creating PayPal order:', {
        error,
        message: error.message,
        amount,
        timestamp: new Date().toISOString()
      });

      // Show user-friendly error message
      const errorMessage = error.message || 'Failed to create PayPal order. Please try again.';
      toast.error(errorMessage);
      
      // Propagate error to parent component
      if (onError) {
        onError(error);
      }
      
      // Re-throw the error to prevent PayPal from proceeding
      throw error;
    }
  };

  const onOrderApprove = async (data: any) => {
    try {
      const transactionId = localStorage.getItem('paypal_transaction_id');
      const orderId = localStorage.getItem('paypal_order_id');

      if (!transactionId || !orderId) {
        throw new Error('Missing transaction details');
      }

      const response = await supabase.functions.invoke('capture-paypal-payment', {
        body: { 
          order_id: orderId,
          transaction_id: transactionId
        }
      });

      // Handle edge function errors
      if (response.error) {
        console.error('Edge function error:', {
          error: response.error,
          status: response.error.status,
          message: response.error.message,
          details: response.error.details
        });
        
        // Provide more specific error messages
        const errorMessage = response.error.message || 'Failed to capture PayPal payment';
        throw new Error(errorMessage);
      }
      
      // Handle response data errors
      if (!response.data?.success) {
        const errorMessage = response.data?.error || 'Error capturing payment';
        console.error('Payment capture failed:', {
          error: errorMessage,
          data: response.data,
          transactionId,
          orderId
        });
        throw new Error(errorMessage);
      }

      localStorage.removeItem('paypal_transaction_id');
      localStorage.removeItem('paypal_order_id');

      // Show success message with amount if available
      if (response.data.amount) {
        toast.success(`Payment successful! ₪${response.data.amount.toFixed(2)} added to your wallet.`);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error capturing payment:', {
        error,
        message: error.message,
        transactionId: localStorage.getItem('paypal_transaction_id'),
        orderId: localStorage.getItem('paypal_order_id'),
        timestamp: new Date().toISOString()
      });
      
      // Clean up stored data on error
      localStorage.removeItem('paypal_transaction_id');
      localStorage.removeItem('paypal_order_id');
      
      // Show user-friendly error message
      const errorMessage = error.message || 'Failed to complete payment. Please try again.';
      toast.error(errorMessage);
      
      if (onError) {
        onError(error);
      }
    }
  };

  if (!clientId) {
    return (
      <div className="p-4 text-red-500 bg-red-50 rounded-lg">
        <p className="font-medium">PayPal Configuration Error</p>
        <p className="text-sm">Missing PayPal Client ID. Please contact support.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-4 text-amber-700 bg-amber-50 rounded-lg">
        <p className="font-medium">Payment Method Unavailable</p>
        <p className="text-sm">{errorMessage}</p>
        {!errorMessage.includes('unavailable') && !errorMessage.includes('contact support') && (
          <button 
            onClick={() => testPayPalConnection()}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (!isPayPalReady) {
    return (
      <div className="p-4 text-gray-600 bg-gray-50 rounded-lg">
        <p className="font-medium">PayPal Payment Unavailable</p>
        <p className="text-sm">PayPal payments are currently not available. Please try another payment method.</p>
        {!errorMessage?.includes('contact support') && (
          <button 
            onClick={() => testPayPalConnection()}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Check Again
          </button>
        )}
      </div>
    );
  }

  return (
    <PayPalScriptProvider 
      options={{
        clientId,
        currency: 'ILS',
        intent: 'capture',
        components: 'buttons'
      }}
    >
      <PayPalButtons
        disabled={disabled || !amount || amount <= 0}
        style={{ 
          layout: 'horizontal',
          height: 48
        }}
        createOrder={createOrder}
        onApprove={(data) => onOrderApprove(data)}
        onCancel={() => {
          localStorage.removeItem('paypal_transaction_id');
          localStorage.removeItem('paypal_order_id');
          if (onCancel) {
            onCancel();
          }
        }}
        onError={(err) => {
          localStorage.removeItem('paypal_transaction_id');
          localStorage.removeItem('paypal_order_id');
          console.error('PayPal error:', {
            error: err,
            timestamp: new Date().toISOString()
          });
          toast.error('PayPal encountered an error. Please try again.');
          if (onError) {
            onError(err);
          }
        }}
      />
    </PayPalScriptProvider>
  );
}
