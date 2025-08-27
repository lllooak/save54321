import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  requestId?: string;
  fanEmail?: string;
  fanName?: string;
  creatorEmail?: string;
  creatorName?: string;
  orderType?: string;
  orderPrice?: string | number;
  orderMessage?: string;
  recipient?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = 're_dQxbETrk_LSTFmGMKk4s1f6mB941HGW95'
    const FROM_EMAIL = 'orders@mystar.co.il' // You may need to verify this domain with Resend

    // Parse request body
    const body: RequestBody = await req.json()
    console.log('Received request body:', body)

    let fanEmail = body.fanEmail
    let fanName = body.fanName
    let creatorEmail = body.creatorEmail
    let creatorName = body.creatorName
    let orderType = body.orderType || 'video_ad'
    let orderPrice = body.orderPrice
    let orderMessage = body.orderMessage || ''
    let requestId = body.requestId

    // If requestId is provided but other details are missing, fetch from database
    if (requestId && (!fanEmail || !creatorEmail)) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Get request details with user information
      const { data: requestData, error: requestError } = await supabaseClient
        .from('requests')
        .select(`
          *,
          fan:users!requests_fan_id_fkey(email, name),
          creator:users!requests_creator_id_fkey(email, name)
        `)
        .eq('id', requestId)
        .single()

      if (requestError) {
        console.error('Error fetching request:', requestError)
        throw new Error('Failed to fetch request details')
      }

      if (requestData) {
        fanEmail = requestData.fan?.email
        fanName = requestData.fan?.name || 'Fan'
        creatorEmail = requestData.creator?.email
        creatorName = requestData.creator?.name || 'Creator'
        orderType = requestData.request_type || 'video_ad'
        orderPrice = requestData.price
        orderMessage = requestData.message || ''
      }
    }

    if (!fanEmail || !creatorEmail) {
      throw new Error('Missing required email addresses')
    }

    // Format price
    const formattedPrice = typeof orderPrice === 'number' ? 
      new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(orderPrice) :
      `₪${orderPrice}`

    // Email template for creator notification
    const creatorEmailHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">הזמנה חדשה!</h1>
        <p>היי ${creatorName || 'יוצר יקר'},</p>
        <p>קיבלת הזמנה חדשה ב-MyStar!</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0;">פרטי ההזמנה:</h2>
          <p><strong>סוג הזמנה:</strong> ${orderType === 'video_ad' ? 'סרטון פרסומי' : orderType}</p>
          <p><strong>מחיר:</strong> ${formattedPrice}</p>
          <p><strong>מזמין:</strong> ${fanName}</p>
          ${orderMessage ? `<p><strong>הודעה מהמזמין:</strong><br>${orderMessage}</p>` : ''}
          <p><strong>מספר הזמנה:</strong> ${requestId}</p>
        </div>
        
        <p>כדי לראות את ההזמנה ולהתחיל לעבוד עליה, היכנס לדשבורד שלך:</p>
        <a href="https://mystar.co.il/dashboard/creator/requests" 
           style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          צפה בהזמנה
        </a>
        
        <p style="margin-top: 30px; color: #666; font-size: 14px;">
          בברכה,<br>
          צוות MyStar
        </p>
      </div>
    `

    // Send email to creator using Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: creatorEmail,
        subject: `הזמנה חדשה ב-MyStar - ${formattedPrice}`,
        html: creatorEmailHtml
      })
    })

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json()
      console.error('Resend API error:', errorData)
      throw new Error(`Failed to send email: ${errorData.message || 'Unknown error'}`)
    }

    const emailResult = await emailResponse.json()
    console.log('Email sent successfully:', emailResult)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Order notification sent successfully',
        emailId: emailResult.id
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in send-order-notification:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error occurred' 
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})
