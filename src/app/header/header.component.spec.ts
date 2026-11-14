import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';

import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let router: Router;
  let http: jasmine.SpyObj<HttpClient>;

  beforeEach(async () => {
    environment.loginEnabled = true;
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

  afterEach(() => {
    environment.loginEnabled = true;
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

  it('shows all navigation tabs without sign-in controls when login is disabled', () => {
    environment.loginEnabled = false;
    fixture.destroy();
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.hub-nav-links')?.hasAttribute('hidden')).toBeFalse();
    expect(element.textContent).toContain('Question manager');
    expect(element.textContent).toContain('Categories');
    expect(element.textContent).not.toContain('Sign in');
    expect(element.textContent).not.toContain('Sign out');
  });
});
