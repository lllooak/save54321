import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreateOrderRequest {
  amount: number
  currency?: string
  description?: string
  return_url?: string
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

    const { amount, currency = 'ILS', description = 'Wallet top-up', return_url }: CreateOrderRequest = await req.json()

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount')
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

    // Create PayPal order
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toFixed(2)
        },
        description: description
      }],
      application_context: {
        return_url: return_url || `${req.headers.get('origin')}/payment-success`,
        cancel_url: `${req.headers.get('origin')}/payment-cancel`
      }
    }

    const orderResponse = await fetch(`${baseURL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify(orderData)
    })

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json().catch(() => ({}))
      console.error('PayPal order creation failed:', errorData)
      throw new Error(`Failed to create PayPal order: ${errorData.message || 'Unknown error'}`)
    }

    const order = await orderResponse.json()

    // Create a pending transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('wallet_transactions')
      .insert({
        user_id: user.id,
        type: 'top_up',
        amount: amount,
        payment_method: 'paypal',
        payment_status: 'pending',
        reference_id: order.id,
        description: description
      })
      .select()
      .single()

    if (transactionError) {
      console.error('Failed to create transaction record:', transactionError)
      throw new Error('Failed to create transaction record')
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        transaction_id: transaction.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Create order error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to create PayPal order'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})