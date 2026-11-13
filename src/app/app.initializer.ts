import { APP_INITIALIZER } from '@angular/core';
import { JavaVersionService } from './services/java-version.service';

export function initializeJavaVersions(javaVersionService: JavaVersionService) {
  return (): void => {
    javaVersionService.loadJavaVersions().subscribe({
      next: versions => {
        console.log('Java versions loaded during app initialization:', versions.length, 'versions');
      },
      error: error => {
        console.error('Failed to load Java versions during app initialization:', error);
      }
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