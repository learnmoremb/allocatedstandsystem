import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DatePipe } from '@angular/common';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';
import { AppNotification } from '../core/models';
import { Badge } from './badge';

interface NavItem { path: string; label: string; icon: string }

const USER_NAV: NavItem[] = [
  { path: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { path: 'news', label: 'News & Updates', icon: '📰' },
  { path: 'stands', label: 'Available Stands', icon: '📍' },
  { path: 'applications', label: 'My Applications', icon: '📝' },
  { path: 'allocations', label: 'My Stands', icon: '🏡' },
  { path: 'payments', label: 'Payment History', icon: '💳' },
  { path: 'infrastructure', label: 'Planned Infrastructure', icon: '🚧' },
  { path: 'profile', label: 'Profile', icon: '👤' },
];

const STAFF_NAV: NavItem[] = [
  { path: 'dashboard', label: 'Dashboard', icon: '📊' },
  { path: 'applications', label: 'Applications', icon: '📝' },
  { path: 'allocations', label: 'Allocations', icon: '🏡' },
  { path: 'payments', label: 'Payment Approvals', icon: '💳' },
  { path: 'stands', label: 'Stands', icon: '📍' },
  { path: 'news', label: 'News', icon: '📰' },
  { path: 'infrastructure', label: 'Infrastructure', icon: '🚧' },
  { path: 'duplicates', label: 'Duplicate Check', icon: '🔍' },
  { path: 'profile', label: 'Profile', icon: '👤' },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe, Badge],
  template: `
    <div class="layout" [class.nav-open]="navOpen()">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">SA</span>
          <div><strong>Stand Allocation</strong><small>{{ portalName() }}</small></div>
        </div>
        <nav>
          @for (item of nav(); track item.path) {
            <a [routerLink]="[auth.base(), item.path]" routerLinkActive="active" (click)="navOpen.set(false)">
              <span class="ico">{{ item.icon }}</span>{{ item.label }}
            </a>
          }
        </nav>
      </aside>
      <div class="backdrop" (click)="navOpen.set(false)"></div>

      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" (click)="navOpen.set(!navOpen())" aria-label="Menu">☰</button>
          <div class="spacer"></div>
          @if (!auth.isStaff()) {
            <div class="notif">
              <button class="icon-btn" (click)="toggleNotifs()" aria-label="Notifications">
                🔔 @if (unread() > 0) { <span class="notif-count">{{ unread() }}</span> }
              </button>
              @if (showNotifs()) {
                <div class="notif-panel card">
                  <div class="row between"><strong>Notifications</strong>
                    <button class="link" (click)="markAll()">Mark all read</button></div>
                  @for (n of notifications(); track n._id) {
                    <a class="notif-item" [class.unread]="!n.read" (click)="open(n)">
                      <strong>{{ n.title }}</strong><span>{{ n.message }}</span>
                      <small class="muted">{{ n.createdAt | date: 'medium' }}</small>
                    </a>
                  } @empty { <p class="muted">No notifications yet.</p> }
                </div>
              }
            </div>
          }
          <div class="who">
            <span>{{ auth.user()?.fullName }}</span>
            <app-badge [value]="auth.role() || ''" />
          </div>
          <button class="btn btn-ghost" (click)="auth.logout()">Log out</button>
        </header>
        <main class="content"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class Shell {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  navOpen = signal(false);
  showNotifs = signal(false);
  notifications = signal<AppNotification[]>([]);
  unread = computed(() => this.notifications().filter((n) => !n.read).length);

  nav = computed<NavItem[]>(() => {
    if (this.auth.role() === 'user') return USER_NAV;
    const items = [...STAFF_NAV];
    if (this.auth.role() === 'admin') items.splice(1, 0, { path: 'users', label: 'User Management', icon: '👥' });
    return items;
  });
  portalName = computed(() => ({ admin: 'Administrator', council: 'Council Portal', user: 'Resident Portal' })[this.auth.role() || 'user']);

  constructor() {
    this.loadNotifs();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => this.loadNotifs());
  }

  loadNotifs() {
    // only residents have notifications; also skips the navigation that follows logout
    if (this.auth.role() !== 'user' || !this.auth.token()) return;
    this.api.get<AppNotification[]>('/notifications').subscribe((n) => this.notifications.set(n));
  }
  toggleNotifs() { this.showNotifs.update((v) => !v); }
  markAll() {
    this.api.patch('/notifications/read-all').subscribe(() => this.notifications.update((l) => l.map((n) => ({ ...n, read: true }))));
  }
  open(n: AppNotification) {
    this.api.patch(`/notifications/${n._id}/read`).subscribe();
    this.showNotifs.set(false);
    if (n.link) this.router.navigateByUrl(n.link);
  }
}
