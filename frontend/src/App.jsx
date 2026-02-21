import { Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./components/MainLayout";
import Dashboard from "./pages/Dashboard";
import Notary from "./pages/Notary";
import NotaryCreate from "./pages/NotaryCreate";
import CredentialCenter from "./pages/CredentialCenter";
import AdminGovernance from "./pages/AdminGovernance";
import Profile from "./pages/Profile";
import Archives from "./pages/Identity";
import SharePreview from "./pages/SharePreview";
import VerifyPreview from "./pages/VerifyPreview";
import IssuerDashboard from "./pages/IssuerDashboard";
import ShareTokenPreview from "./pages/ShareTokenPreview";
import RequirementList from "./pages/trustconnect/RequirementList";
import RequirementDetail from "./pages/trustconnect/RequirementDetail";
import ManageRequirements from "./pages/trustconnect/ManageRequirements";
import ApplicationList from "./pages/trustconnect/ApplicationList";
import MyApplications from "./pages/trustconnect/MyApplications";

export default function App() {
  return (
    <Routes>
      <Route path="/share/v1/:cid" element={<SharePreview />} />
      <Route path="/share/tc/:token" element={<ShareTokenPreview />} />
      <Route path="/verify/v1/:cid" element={<VerifyPreview />} />
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/connect/requirements" element={<RequirementList />} />
        <Route path="/connect/requirements/:id" element={<RequirementDetail />} />
        <Route path="/connect/my" element={<MyApplications />} />
        <Route path="/connect/manage" element={<ManageRequirements />} />
        <Route path="/connect/manage/requirements/:id" element={<ApplicationList />} />
        <Route path="/notary" element={<Notary />} />
        <Route path="/notary/create" element={<NotaryCreate />} />
        <Route path="/credentials" element={<CredentialCenter />} />
        <Route path="/issuer" element={<IssuerDashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin/governance" element={<AdminGovernance />} />
        <Route path="/archives" element={<Archives />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
