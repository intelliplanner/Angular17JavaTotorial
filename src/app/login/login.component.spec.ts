import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let router: jasmine.SpyObj<Router>;
  let http: jasmine.SpyObj<HttpClient>;

  beforeEach(async () => {
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['post', 'get']);
    http.post.and.returnValue(of({
      authenticated: true,
      user: { username: 'admin', role: 'admin', permissions: ['*'] }
    }));
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: HttpClient, useValue: http }
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    sessionStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to the dashboard after a successful login', () => {
    component.login('admin', 'admin');

    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/home');
  });

  it('sends credentials to the server and accepts the learner role', () => {
    http.post.and.returnValue(of({
      authenticated: true,
      user: { username: 'test', role: 'learner', permissions: ['home', 'learn', 'practiceQuiz'] }
    }));

    component.login('test', 'test');

    expect(http.post).toHaveBeenCalledWith(
      jasmine.stringMatching(/\/auth\/login$/),
      { username: 'test', password: 'test' },
      { withCredentials: true }
    );
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/home');
  });

  it('shows username and password fields without a Google sign-in option', () => {
    expect(fixture.nativeElement.querySelector('#name')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#pwd')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.google-sign-in-button')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Or');
  });

  it('shows an error when the credentials are invalid', () => {
    http.post.and.returnValue(throwError(new HttpErrorResponse({ status: 401 })));
    component.login('wrong', 'credentials');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Invalid username or password.');
  });
});
