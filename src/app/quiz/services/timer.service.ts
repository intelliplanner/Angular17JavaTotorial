import { Injectable } from '@angular/core';
import { interval } from 'rxjs';
import { map, takeWhile } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class TimerService {
  countdown(seconds: number) {
    return interval(1000).pipe(
      map(tick => Math.max(0, seconds - tick - 1)),
      takeWhile(remaining => remaining >= 0)
    );
  }

  format(seconds: number): string {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainder = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
  }
}
