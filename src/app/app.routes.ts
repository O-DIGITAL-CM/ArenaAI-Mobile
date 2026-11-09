import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'shell' },
  {
    path: 'shell',
    loadComponent: () =>
      import('./web-shell/web-shell.component').then((m) => m.WebShellComponent),
  },
  { path: '**', redirectTo: 'shell' },
];
