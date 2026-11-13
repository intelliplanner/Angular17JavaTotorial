import { environment } from '../environments/environment';

export function getAuthApiUrl(): string {
  if (environment.production) {
    return environment.authApiUrl;
  }

  const configuredHost = environment.authApiUrl
    ? new URL(environment.authApiUrl).hostname
    : '';
  const pageHost = window.location.hostname;
  if (configuredHost === 'localhost' || configuredHost === '127.0.0.1') {
    return `http://${pageHost}:9090`;
  }
  return environment.authApiUrl || `http://${pageHost}:9090`;
}
