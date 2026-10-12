import { Routes } from '@angular/router';
import { guestGuard, passwordChangeGuard, roleGuard } from './core/guards';
import { ChangePassword } from './pages/auth/change-password';
import { Shell } from './shared/shell';
import { Login } from './pages/auth/login';
import { Register } from './pages/auth/register';
import { NewsPage } from './pages/common/news';
import { Profile } from './pages/common/profile';
import { AllocationDetail } from './pages/common/allocation-detail';

const staffChildren = (): Routes => [
  { path: 'dashboard', loadComponent: () => import('./pages/staff/staff-dashboard').then((m) => m.StaffDashboard) },
  { path: 'applications', loadComponent: () => import('./pages/staff/applications-review').then((m) => m.ApplicationsReview) },
  { path: 'allocations', loadComponent: () => import('./pages/staff/allocations-manage').then((m) => m.AllocationsManage) },
  { path: 'allocations/:id', component: AllocationDetail },
  { path: 'payments', loadComponent: () => import('./pages/staff/payments-review').then((m) => m.PaymentsReview) },
  { path: 'stands', loadComponent: () => import('./pages/staff/stands-manage').then((m) => m.StandsManage) },
  { path: 'news', component: NewsPage },
  { path: 'infrastructure', loadComponent: () => import('./pages/staff/infrastructure-manage').then((m) => m.InfrastructureManage) },
  { path: 'duplicates', loadComponent: () => import('./pages/staff/duplicates').then((m) => m.Duplicates) },
  { path: 'profile', component: Profile },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
];

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'register', component: Register, canActivate: [guestGuard] },
  { path: 'change-password', component: ChangePassword, canActivate: [passwordChangeGuard] },
  {
    path: 'admin',
    component: Shell,
    canActivate: [roleGuard('admin')],
    children: [
      { path: 'users', loadComponent: () => import('./pages/admin/users-manage').then((m) => m.UsersManage) },
      ...staffChildren(),
    ],
  },
  { path: 'council', component: Shell, canActivate: [roleGuard('council')], children: staffChildren() },
  {
    path: 'user',
    component: Shell,
    canActivate: [roleGuard('user')],
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/user/user-dashboard').then((m) => m.UserDashboard) },
      { path: 'news', component: NewsPage },
      { path: 'stands', loadComponent: () => import('./pages/user/available-stands').then((m) => m.AvailableStands) },
      { path: 'applications', loadComponent: () => import('./pages/user/my-applications').then((m) => m.MyApplications) },
      { path: 'allocations', loadComponent: () => import('./pages/user/my-allocations').then((m) => m.MyAllocations) },
      { path: 'allocations/:id', component: AllocationDetail },
      { path: 'payments', loadComponent: () => import('./pages/user/my-payments').then((m) => m.MyPayments) },
      { path: 'infrastructure', loadComponent: () => import('./pages/user/user-infrastructure').then((m) => m.UserInfrastructure) },
      { path: 'profile', component: Profile },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
