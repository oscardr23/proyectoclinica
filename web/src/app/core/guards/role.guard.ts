import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const user = authService.getCurrentUser();
    
    if (!user) {
      return router.parseUrl('/login');
    }
    
    if (allowedRoles.includes(user.role)) {
      return true;
    }
    
    // Redirigir al dashboard si no tiene permisos
    return router.parseUrl('/dashboard');
  };
}

