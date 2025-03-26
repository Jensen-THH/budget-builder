import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', redirectTo: '/budget', pathMatch: 'full' },
    {
        path: 'budget', loadComponent: () => import('./components/table/table.component').then(c => c.TableComponent)
    },
    { path: '**', redirectTo: '/budget' }, 
];
