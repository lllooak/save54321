import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { OverviewPage } from './OverviewPage';
import { RequestsPage } from './RequestsPage';
import { EarningsPage } from './EarningsPage';
import { ProfilePage } from './ProfilePage';
import { AnalyticsPage } from './AnalyticsPage';
import { VideoAdsPage } from './VideoAdsPage';
import { AffiliateProgram } from './AffiliateProgram';
import { Sidebar } from '../../../components/Sidebar';

export function CreatorDashboard() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Sidebar />
      <div className="mr-64 p-8">
        <Routes>
          <Route index element={<OverviewPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="earnings" element={<EarningsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="video-ads" element={<VideoAdsPage />} />
          <Route path="affiliate" element={<AffiliateProgram />} />
        </Routes>
      </div>
    </div>
  );
}