import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    // Get PayPal credentials from platform config using service role
    const { data: paypalConfig, error: configError } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'paypal_credentials')
      .maybeSingle()

    if (configError) {
      console.error('Database error fetching PayPal config:', configError)
      return new Response(
        JSON.stringify({
          success: false,
          connected: false,
          error: 'Database error accessing PayPal configuration'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    if (!paypalConfig?.value) {
      return new Response(
        JSON.stringify({
          success: false,
          connected: false,
          error: 'PayPal credentials are not configured'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    const { client_id, client_secret, environment } = paypalConfig.value

    if (!client_id || !client_secret) {
      return new Response(
        JSON.stringify({
          success: false,
          connected: false,
          error: 'PayPal credentials are incomplete'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    const baseURL = environment === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com'

    // Test PayPal connection by getting an access token
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
      
      return new Response(
        JSON.stringify({
          success: false,
          connected: false,
          error: 'Failed to authenticate with PayPal - please check your credentials'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    const tokenData = await tokenResponse.json()

    if (!tokenData.access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          connected: false,
          error: 'Invalid PayPal response - no access token received'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        connected: true,
        message: 'PayPal connection successful',
        environment: environment
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('PayPal connection test error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        connected: false,
        error: error.message || 'PayPal connection test failed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }
})