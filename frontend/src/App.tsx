import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import MainLayout from "./components/layout/MainLayout";
import PageLoading from "./components/common/PageLoading";
import { AirProvider } from "./context/AirContext";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const AIAssistant = lazy(() => import("./pages/AIAssistant"));
const DailyPlanner = lazy(() => import("./pages/DailyPlanner"));
const FamilyProtection = lazy(() => import("./pages/FamilyProtection"));
const IndoorProtection = lazy(() => import("./pages/IndoorProtection"));
const ImpactTracker = lazy(() => import("./pages/ImpactTracker"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <BrowserRouter>
      <AirProvider>
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="/assistant" element={<AIAssistant />} />
              <Route path="/planner" element={<DailyPlanner />} />
              <Route path="/family" element={<FamilyProtection />} />
              <Route path="/indoor" element={<IndoorProtection />} />
              <Route path="/impact" element={<ImpactTracker />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </AirProvider>
    </BrowserRouter>
  );
}
