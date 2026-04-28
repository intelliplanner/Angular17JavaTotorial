import { APP_INITIALIZER } from '@angular/core';
import { JavaVersionService } from './services/java-version.service';

export function initializeJavaVersions(javaVersionService: JavaVersionService) {
  return (): Promise<any> => {
    return new Promise((resolve, reject) => {
      javaVersionService.loadJavaVersions().subscribe({
        next: (versions) => {
          console.log('✅ Java versions loaded during app initialization:', versions.length, 'versions');
          resolve(versions);
        },
        error: (error) => {
          console.warn('⚠️ Failed to load Java versions during app initialization, using fallback');
          resolve([]); // Resolve anyway to not block app startup
        }
      });
    });
  };
}

export const appInitializerProviders = [
  {
    provide: APP_INITIALIZER,
    useFactory: initializeJavaVersions,
    deps: [JavaVersionService],
    multi: true
  }
];