import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, switchMap, tap } from 'rxjs';

import { User } from '../models';
import { environment } from '../../../environments/environment';

interface TokenResponse {
  access: string;
  refresh: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;
  private readonly accessTokenKey = 'dentconnect:access';
  private readonly refreshTokenKey = 'dentconnect:refresh';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    if (this.getAccessToken()) {
      this.refreshMe().subscribe({
        error: () => this.logout(),
      });
    }
  }

  login(credentials: { username: string; password: string }): Observable<User> {
    // Detectar si es email o username
    const isEmail = credentials.username.includes('@');
    // El backend espera ambos campos (username y email) opcionales
    const payload = isEmail
      ? { email: credentials.username, username: '', password: credentials.password }
      : { username: credentials.username, email: '', password: credentials.password };

    return this.http
      .post<TokenResponse>(`${this.baseUrl}/auth/login/`, payload)
      .pipe(
        tap((tokens) => {
          if (!tokens?.access) {
            throw new Error('No se recibió el token de acceso');
          }
          this.persistTokens(tokens);
        }),
        switchMap(() => this.refreshMe()),
      );
  }

  refreshMe(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/auth/me/`).pipe(
      tap((user) => this.currentUserSubject.next(user)),
    );
  }

  logout() {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    this.currentUserSubject.next(null);
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'ADMIN';
  }

  isProfessional(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'PROFESSIONAL';
  }

  isPatient(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'PATIENT';
  }

  private persistTokens(tokens: TokenResponse) {
    localStorage.setItem(this.accessTokenKey, tokens.access);
    localStorage.setItem(this.refreshTokenKey, tokens.refresh);
  }
}

