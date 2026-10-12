import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = '/api';

  get<T>(url: string, params?: Record<string, any>): Observable<T> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') p = p.set(k, v);
    return this.http.get<T>(this.base + url, { params: p });
  }
  post<T>(url: string, body: any = {}): Observable<T> {
    return this.http.post<T>(this.base + url, body);
  }
  put<T>(url: string, body: any = {}): Observable<T> {
    return this.http.put<T>(this.base + url, body);
  }
  patch<T>(url: string, body: any = {}): Observable<T> {
    return this.http.patch<T>(this.base + url, body);
  }
  delete<T>(url: string): Observable<T> {
    return this.http.delete<T>(this.base + url);
  }
  blob(url: string): Observable<Blob> {
    return this.http.get(this.base + url, { responseType: 'blob' });
  }

  /** Fetch an authenticated file and open it in a new tab. */
  openFile(url: string) {
    const win = window.open('', '_blank');
    this.blob(url).subscribe({
      next: (b) => {
        const objectUrl = URL.createObjectURL(b);
        if (win) win.location.href = objectUrl;
        else window.open(objectUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      },
      error: () => win?.close(),
    });
  }

  download(url: string, fileName: string) {
    this.blob(url).subscribe((b) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
}

export function errorMessage(err: any): string {
  return err?.error?.message || err?.message || 'Something went wrong';
}
