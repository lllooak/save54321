import React, { useState } from 'react';
import { ShoppingCart as CartIcon, X, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/currency';
import { sendOrderEmails } from '../lib/emailService';

interface CartItem {
  id: string;
  title: string;
  price: number;
  creator_name: string;
  creator_id: string;
  thumbnail_url?: string;
  instructions?: string;
}

interface ShoppingCartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
}

export function ShoppingCart({ isOpen, onClose, items, onRemoveItem, onClearCart }: ShoppingCartProps) {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const total = items.reduce((sum, item) => sum + item.price, 0);

  const handleCheckout = async () => {
    try {
      setIsProcessing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to complete your purchase');
        navigate('/login');
        return;
      }

      // Check user's wallet balance
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('wallet_balance, email, name')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      if (!userData || userData.wallet_balance < total) {
        toast.error('Insufficient balance. Please top up your wallet.');
        return;
      }

      // Process payments for each item
      const results = await Promise.all(
        items.map(async (item) => {
          // First create a request entry for the video ad
          const { data: request, error: requestError } = await supabase
            .from('requests')
            .insert({
              creator_id: item.creator_id,
              fan_id: user.id,
              request_type: 'video_ad',
              status: 'pending',
              price: item.price,
              message: message || `Purchase of video ad: ${item.title}`,
              deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
            })
            .select()
            .single();

          if (requestError) {
            throw new Error(`Failed to create request: ${requestError.message}`);
          }

          // Now process the payment using the newly created request ID
          const { data, error } = await supabase.rpc('process_request_payment', {
            p_request_id: request.id,
            p_fan_id: user.id,
            p_creator_id: item.creator_id,
            p_amount: item.price
          });

          if (error || !data?.success) {
            throw new Error(error?.message || data?.error || 'Failed to process payment');
          }

          // Get creator email for notification
          const { data: creatorData, error: creatorError } = await supabase
            .from('users')
            .select('email')
            .eq('id', item.creator_id)
            .single();

          if (!creatorError && creatorData?.email) {
            // Send email notification
            try {
              await sendOrderEmails({
                fanEmail: userData.email,
                fanName: userData.name || user.user_metadata?.name || 'Fan',
                creatorEmail: creatorData.email,
                creatorName: item.creator_name,
                requestType: 'video_ad',
                orderId: request.id,
                price: item.price,
                message: message || `Purchase of video ad: ${item.title}`
              });
            } catch (emailError) {
              console.error('Error sending order emails:', emailError);
              // Continue with the checkout even if email fails
            }
          }

          return data;
        })
      );

      toast.success('Purchase successful!');
      onClearCart();
      onClose();
      navigate('/dashboard/fan');
    } catch (error: any) {
      console.error('Error processing purchase:', error);
      toast.error(error.message || 'Failed to process purchase');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md">
          <div className="h-full flex flex-col bg-white shadow-xl">
            <div className="flex-1 py-6 overflow-y-auto px-4 sm:px-6">
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-medium text-gray-900">Shopping Cart</h2>
                <button
                  onClick={onClose}
                  className="ml-3 h-7 flex items-center justify-center"
                >
                  <X className="h-6 w-6 text-gray-400 hover:text-gray-500" />
                </button>
              </div>

              <div className="mt-8">
                {items.length === 0 ? (
                  <div className="text-center py-12">
                    <CartIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Cart is empty</h3>
                    <p className="mt-1 text-sm text-gray-500">Browse videos to add to your cart</p>
                  </div>
                ) : (
                  <div className="flow-root">
                    <ul className="-my-6 divide-y divide-gray-200">
                      {items.map((item, index) => (
                        <li key={`${item.id}-${index}`} className="py-6 flex">
                          {item.thumbnail_url && (
                            <div className="flex-shrink-0 w-24 h-24 overflow-hidden rounded-md">
                              <img
                                src={item.thumbnail_url}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="ml-4 flex-1 flex flex-col">
                            <div>
                              <div className="flex justify-between text-base font-medium text-gray-900">
                                <h3>{item.title}</h3>
                                <p className="ml-4">{formatCurrency(item.price)}</p>
                              </div>
                              <p className="mt-1 text-sm text-gray-500">
                                By {item.creator_name}
                              </p>
                            </div>
                            <div className="flex-1 flex items-end justify-between text-sm">
                              <button
                                type="button"
                                onClick={() => {
                                  onRemoveItem(item.id);
                                  toast.success(`Removed ${item.title} from cart`);
                                }}
                                className="font-medium text-primary-600 hover:text-primary-500"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {items.length > 0 && (
              <div className="border-t border-gray-200 py-6 px-4 sm:px-6">
                <div className="mb-4">
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Instructions for the creator
                  </label>
                  <textarea
                    id="message"
                    rows={3}
                    className="w-full rounded-md border border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    placeholder="Add any specific instructions or details for the creator..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  ></textarea>
                </div>
                
                <div className="flex justify-between text-base font-medium text-gray-900">
                  <p>Total</p>
                  <p>{formatCurrency(total)}</p>
                </div>
                <p className="mt-0.5 text-sm text-gray-500">
                  Payment will be deducted from your wallet balance
                </p>
                <div className="mt-6">
                  <button
                    onClick={handleCheckout}
                    disabled={isProcessing}
                    className="w-full flex justify-center items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      'Checkout'
                    )}
                  </button>
                </div>
                <div className="mt-6 flex justify-center text-sm text-center text-gray-500">
                  <button
                    type="button"
                    className="font-medium text-primary-600 hover:text-primary-500"
                    onClick={onClose}
                  >
                    Continue Shopping
                    <span aria-hidden="true"> &rarr;</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}