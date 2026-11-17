import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AdminUsersComponent } from './admin-users.component';
import { AdminUserService } from '../services/admin-user.service';
import { DataService } from '../services/data.service';
import { AuthService } from '../auth.service';

describe('AdminUsersComponent', () => {
  let fixture: ComponentFixture<AdminUsersComponent>;
  let component: AdminUsersComponent;
  let adminUserService: jasmine.SpyObj<AdminUserService>;

  beforeEach(async () => {
    adminUserService = jasmine.createSpyObj<AdminUserService>(
      'AdminUserService',
      ['createUser', 'createBootstrapAdmin']
    );
    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [
        { provide: AdminUserService, useValue: adminUserService },
        { provide: DataService, useValue: { isFirebaseEnabled: () => true } },
        {
          provide: AuthService,
          useValue: {
            hasPermission: () => false,
            isFirebaseBootstrapUser: () => false
          }
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates a Firebase user with the selected username, password, and role', () => {
    adminUserService.createUser.and.returnValue(of({
      username: 'new-learner',
      role: 'learner',
      permissions: ['home', 'learn', 'practiceQuiz']
    }));
    component.username = 'new-learner';
    component.password = 'unique-password-123';
    component.role = 'learner';

    component.createUser();

    expect(adminUserService.createUser).toHaveBeenCalledOnceWith(
      'new-learner',
      'unique-password-123',
      'learner'
    );
    expect(component.password).toBe('');
    expect(component.message).toBe('Created learner account "new-learner".');
    expect(component.hasError).toBeFalse();
  });

  it('shows server validation errors without clearing the entered form', () => {
    adminUserService.createUser.and.returnValue(throwError(new HttpErrorResponse({
      status: 409,
      error: { message: 'That password is already assigned to another newly created user.' }
    })));
    component.username = 'new-learner';
    component.password = 'duplicate-password';

    component.createUser();

    expect(component.message).toBe('That password is already assigned to another newly created user.');
    expect(component.hasError).toBeTrue();
    expect(component.password).toBe('duplicate-password');
  });

  it('creates only the first Firebase administrator from a bootstrap session', () => {
    adminUserService.createBootstrapAdmin.and.returnValue(of({
      username: 'initial-admin',
      role: 'admin',
      permissions: ['*']
    }));
    component.isBootstrapMode = true;
    component.username = 'initial-admin';
    component.password = 'unique-password-123';

    component.createUser();

    expect(adminUserService.createBootstrapAdmin).toHaveBeenCalledOnceWith(
      'initial-admin',
      'unique-password-123'
    );
    expect(adminUserService.createUser).not.toHaveBeenCalled();
    expect(component.message).toContain('Sign out and sign in');
  });
});
