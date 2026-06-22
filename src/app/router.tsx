import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

// Auth pages
const LoginPage = lazy(() => import("../features/auth/LoginPage"));

// Main app pages
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const ClueListPage = lazy(() => import("../features/clues/ClueListPage"));
const ClueFormPage = lazy(() => import("../features/clues/ClueFormPage"));
const ClueDetailPage = lazy(() => import("../features/clues/ClueDetailPage"));
const UnassignedPage = lazy(() => import("../features/clues/UnassignedPage"));
const SpacesListPage = lazy(() => import("../features/spaces/SpacesListPage"));
const SpaceDetailPage = lazy(() => import("../features/spaces/SpaceDetailPage"));
const RemindersPage = lazy(() => import("../features/reminders/RemindersPage"));
const ReportsPage = lazy(() => import("../features/reports/ReportsPage"));
const ImportsPage = lazy(() => import("../features/imports/ImportPage"));
const ExportsPage = lazy(() => import("../features/exports/ExportRequestsPage"));
const ProfilePage = lazy(() => import("../features/profile/ProfilePage"));

// Admin pages
const AdminDashboardPage = lazy(() => import("../features/admin/AdminDashboardPage"));
const UsersPage = lazy(() => import("../features/admin/UsersPage"));
const DepartmentsPage = lazy(() => import("../features/admin/DepartmentsPage"));
const RolesPage = lazy(() => import("../features/admin/RolesPage"));
const DictionariesPage = lazy(() => import("../features/admin/DictionariesPage"));
const AdminSpacesPage = lazy(() => import("../features/admin/AdminSpacesPage"));
const ImportJobsPage = lazy(() => import("../features/admin/ImportJobsPage"));
const ExportApprovalPage = lazy(() => import("../features/admin/ExportApprovalPage"));
const AuditLogPage = lazy(() => import("../features/admin/AuditLogPage"));
const AdminSettingsPage = lazy(() => import("../features/admin/SystemSettingsPage"));
const DeletedRecordsPage = lazy(() => import("../features/admin/DeletedRecordsPage"));
const CopyManagementPage = lazy(() => import("../features/admin/CopyManagementPage"));

import AppShell from "./AppShell";
import AdminShell from "./AdminShell";
import AuthGuard from "./AuthGuard";

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <AuthGuard><AppShell /></AuthGuard>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "clues", element: <ClueListPage /> },
      { path: "clues/new", element: <ClueFormPage /> },
      { path: "clues/:id", element: <ClueDetailPage /> },
      { path: "clues/:id/edit", element: <ClueFormPage /> },
      { path: "unassigned", element: <UnassignedPage /> },
      { path: "spaces", element: <SpacesListPage /> },
      { path: "spaces/:id", element: <SpaceDetailPage /> },
      { path: "reminders", element: <RemindersPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "imports", element: <ImportsPage /> },
      { path: "exports", element: <ExportsPage /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
  {
    path: "/admin",
    element: <AuthGuard requireAdmin><AdminShell /></AuthGuard>,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: "users", element: <UsersPage /> },
      { path: "departments", element: <DepartmentsPage /> },
      { path: "roles", element: <RolesPage /> },
      { path: "dictionaries", element: <DictionariesPage /> },
      { path: "spaces", element: <AdminSpacesPage /> },
      { path: "imports", element: <ImportJobsPage /> },
      { path: "exports", element: <ExportApprovalPage /> },
      { path: "audit", element: <AuditLogPage /> },
      { path: "settings", element: <AdminSettingsPage /> },
      { path: "deleted", element: <DeletedRecordsPage /> },
      { path: "copy", element: <CopyManagementPage /> },
    ],
  },
];
