import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CookieConsent } from './components/CookieConsent';
import { Home } from './pages/Home';
import { Explore } from './pages/Explore';
import { Categories } from './pages/Categories';
import { CreatorProfile } from './pages/CreatorProfile';
import { VideoAdDetails } from './pages/VideoAdDetails';
import { FanDashboard } from './pages/dashboard/fan/FanDashboard';
import { CreatorDashboard } from './pages/dashboard/creator/CreatorDashboard';
import { AdminDashboard } from './pages/dashboard/admin/AdminDashboard';
import { AdminLogin } from './pages/dashboard/admin/AdminLogin';
import { Login } from './pages/auth/Login';
import { FanSignup } from './pages/auth/FanSignup';
import { CreatorSignup } from './pages/auth/CreatorSignup';
import { EmailConfirmation } from './pages/auth/EmailConfirmation';
import { ResetPassword } from './pages/auth/ResetPassword';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { PaymentCancel } from './pages/PaymentCancel';
import { ContactUs } from './pages/ContactUs';
import { TermsOfService } from './pages/TermsOfService';
import { Privacy } from './pages/Privacy';
import { FooterPage } from './pages/FooterPage';
import { useSiteConfig } from './hooks/useSiteConfig';
import { ThankYou } from './pages/ThankYou';

function App() {
  // Initialize site configuration
  useSiteConfig();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="explore" element={<Explore />} />
          <Route path="categories" element={<Categories />} />
          <Route path="creator/:username" element={<CreatorProfile />} />
          <Route path="video-ad/:id" element={<VideoAdDetails />} />
          <Route path="login" element={<Login />} />
          <Route path="signup/fan" element={<FanSignup />} />
          <Route path="signup/creator" element={<CreatorSignup />} />
          <Route path="email-confirmation" element={<EmailConfirmation />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="payment-success" element={<PaymentSuccess />} />
          <Route path="payment-cancel" element={<PaymentCancel />} />
          <Route path="contact" element={<ContactUs />} />
          <Route path="terms" element={<TermsOfService />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="page/:slug" element={<FooterPage />} />
          <Route path="thank-you" element={<ThankYou />} />
          
          {/* Dashboard Routes */}
          <Route path="dashboard">
            <Route path="fan/*" element={<FanDashboard />} />
            <Route path="creator/*" element={<CreatorDashboard />} />
            <Route path="Joseph999/*" element={<AdminDashboard />} />
            <Route path="Joseph998/*" element={<CreatorDashboard />} />
            <Route path="Joseph998" element={<AdminLogin />} />
          </Route>
        </Route>
        
        {/* Auth callback routes */}
        <Route path="/auth/callback" element={<EmailConfirmation />} />
      </Routes>
      <CookieConsent />
    </Router>
  );
}

export default App;