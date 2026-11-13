import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: HttpClient, useValue: {} }
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    spyOn(component, 'ngAfterViewInit');
    fixture.detectChanges();
    sessionStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to the dashboard after a successful login', () => {
    component.login('admin', 'admin');

    expect(sessionStorage.getItem('isLoggedIn')).toBe('true');
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/dashboard');
  });

  it('keeps the username and password fields alongside Google sign-in', () => {
    expect(fixture.nativeElement.querySelector('#name')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#pwd')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.google-sign-in-button')).not.toBeNull();
  });
});
