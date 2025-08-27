import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CapturePaymentRequest {
  order_id: string
  transaction_id: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Get user from auth header
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Invalid or expired token')
    }

    const { order_id, transaction_id }: CapturePaymentRequest = await req.json()

    if (!order_id || !transaction_id) {
      throw new Error('Missing required parameters: order_id and transaction_id')
    }

    // Get PayPal credentials from platform config using service role
    const { data: paypalConfig, error: configError } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'paypal_credentials')
      .maybeSingle()

    if (configError) {
      console.error('Database error fetching PayPal config:', configError)
      throw new Error('Database error accessing PayPal configuration')
    }

    if (!paypalConfig?.value) {
      throw new Error('PayPal credentials not configured')
    }

    const { client_id, client_secret, environment } = paypalConfig.value
    
    if (!client_id || !client_secret) {
      throw new Error('PayPal credentials are incomplete')
    }

    const baseURL = environment === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com'

    // Get PayPal access token
    const tokenResponse = await fetch(`${baseURL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${client_id}:${client_secret}`)}`
      },
      body: 'grant_type=client_credentials'
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}))
      console.error('PayPal token request failed:', errorData)
      throw new Error('Failed to get PayPal access token')
    }

    const { access_token } = await tokenResponse.json()

    // Capture the PayPal payment
    const captureResponse = await fetch(`${baseURL}/v2/checkout/orders/${order_id}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      }
    })

    if (!captureResponse.ok) {
      const errorData = await captureResponse.json().catch(() => ({}))
      console.error('PayPal capture failed:', errorData)
      throw new Error(`PayPal capture failed: ${errorData.message || 'Unknown error'}`)
    }

    const captureData = await captureResponse.json()
    
    // Verify the payment was successful
    if (captureData.status !== 'COMPLETED') {
      throw new Error(`Payment not completed. Status: ${captureData.status}`)
    }

    // Get the payment amount from the capture data
    const paymentAmount = parseFloat(captureData.purchase_units[0].payments.captures[0].amount.value)

    // Check if this transaction has already been processed to prevent duplicate processing
    const { data: existingTransaction, error: checkError } = await supabase
      .from('wallet_transactions')
      .select('id, payment_status, reference_id')
      .eq('id', transaction_id)
      .eq('user_id', user.id)
      .single()

    if (checkError) {
      console.error('Failed to check existing transaction:', checkError)
      throw new Error('Failed to verify transaction status')
    }

    // If transaction is already completed, don't process it again
    if (existingTransaction.payment_status === 'completed') {
      console.log(`Transaction ${transaction_id} already completed, skipping duplicate processing`)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Payment already processed',
          amount: paymentAmount,
          transaction_id: existingTransaction.reference_id || captureData.id
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Use the corrected process_paypal_transaction function to prevent double charging
    const { data: processResult, error: processError } = await supabase
      .rpc('process_paypal_transaction', {
        p_transaction_id: transaction_id,
        p_status: 'completed'
      });

    if (processError) {
      console.error('Failed to process PayPal transaction:', processError);
      throw new Error('Failed to process transaction');
    }

    // Update the reference_id separately since the function doesn't handle it
    const { error: refError } = await supabase
      .from('wallet_transactions')
      .update({
        reference_id: captureData.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', transaction_id)
      .eq('user_id', user.id);

    if (refError) {
      console.error('Failed to update reference ID:', refError);
      // Don't throw error for reference ID update failure - transaction still processed
    }

    // Create a notification for the user
    await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        title: 'Payment Successful',
        message: `Your wallet has been topped up with ₪${paymentAmount.toFixed(2)}`,
        type: 'payment',
        entity_id: transaction_id,
        entity_type: 'transaction'
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment captured successfully',
        amount: paymentAmount,
        transaction_id: captureData.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('PayPal capture error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to capture payment'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
