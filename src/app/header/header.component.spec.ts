import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let router: Router;
  let http: jasmine.SpyObj<HttpClient>;

  beforeEach(async () => {
    sessionStorage.clear();
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['post']);
    http.post.and.returnValue(of({}));
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: http }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('clears login state and redirects to login on logout', () => {
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));

    component.logout();

    expect(component.isLoggedIn).toBeFalse();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/login');
    expect(http.post).toHaveBeenCalledWith(
      jasmine.stringMatching(/\/auth\/logout$/),
      {},
      { withCredentials: true }
    );
  });
});
