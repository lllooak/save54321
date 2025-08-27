# Video Creator Platform

A comprehensive platform for video creators and fans to connect, featuring custom video requests, payments, and affiliate systems.

## Features

### For Creators
- **Profile Management**: Upload square profile images and manage creator profiles  
- **Video Ad Management**: Create and manage video advertisements with custom thumbnails
- **Request Management**: Handle custom video requests from fans
- **Earnings Dashboard**: Track earnings and manage withdrawals
- **Real-time Notifications**: Get notified of new orders via email

### For Fans
- **Browse Creators**: Explore video ads and discover creators
- **Custom Requests**: Order personalized videos from favorite creators
- **Wallet System**: Secure payment processing with wallet balance
- **Order Tracking**: Track order status and delivery

### Platform Features
- **Affiliate System**: Referral tracking and commission management
- **Multi-language Support**: Hebrew and English localization
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Live updates for orders and notifications

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Database + Auth + Storage)
- **Payments**: PayPal integration
- **Email**: Resend.com for notifications
- **Deployment**: Netlify ready

## Key Components

- **Square Profile Images**: Creator profile images display prominently in video ad cards
- **Video Ad Display**: Enhanced cards showing creator images when thumbnails unavailable  
- **Email Notifications**: Automated Hebrew emails for order confirmations
- **Affiliate Tracking**: Real-time referral counting and commission tracking

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see section below)
4. Start development server: `npm run dev`
5. Build for production: `npm run build`

## Environment Variables

The application relies on several environment variables for interacting with Supabase and for sending emails using [Resend](https://resend.com). Ensure the following keys are available in your deployment:

- `SUPABASE_URL` – The base URL of your Supabase project.
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key used by the edge functions.
- `RESEND_API_KEY` – API key used by Supabase edge functions.
- `RESEND_FROM_EMAIL` – Address used by the server when sending emails.
- `VITE_RESEND_API_KEY` – API key exposed to the client for direct Resend calls.
- `VITE_RESEND_FROM_EMAIL` – Address used in the `from` field for client email requests.

Example `.env` configuration:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@example.com
VITE_RESEND_API_KEY=your_resend_api_key
VITE_RESEND_FROM_EMAIL=noreply@example.com
```

## Recent Updates

- ✅ Implemented square profile image integration in video ads
- ✅ Enhanced video ad display with creator profile images
- ✅ Fixed affiliate referral tracking system
- ✅ Added comprehensive email notification system
