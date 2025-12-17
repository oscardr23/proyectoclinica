import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();
  
  // Añadir token a la petición
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req).pipe(
    catchError((error) => {
      // Si el error es 401 (Unauthorized) y tenemos un refresh token, intentar refrescar
      if (error.status === 401 && authService.getRefreshToken() && !req.url.includes('/auth/')) {
        return authService.refreshToken().pipe(
          switchMap(() => {
            // Reintentar la petición original con el nuevo token
            const newToken = authService.getAccessToken();
            if (newToken) {
              const clonedReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${newToken}`,
                },
              });
              return next(clonedReq);
            }
            return throwError(() => error);
          }),
          catchError((refreshError) => {
            // Si el refresh también falla, cerrar sesión
            authService.logout();
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};

