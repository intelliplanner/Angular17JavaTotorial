import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../auth.service';
import { AdminUserService } from '../services/admin-user.service';
import { DataService } from '../services/data.service';
import { DataSynchronizationComponent } from './data-synchronization.component';

describe('DataSynchronizationComponent', () => {
  let component: DataSynchronizationComponent;
  let dataService: jasmine.SpyObj<DataService>;
  let adminUserService: jasmine.SpyObj<AdminUserService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<DataService>(
      'DataService',
      ['isFirebaseEnabled', 'loadSavedFirebaseConfig', 'validateFirebaseConnection']
    );
    dataService.isFirebaseEnabled.and.returnValue(false);
    dataService.loadSavedFirebaseConfig.and.resolveTo(null);
    adminUserService = jasmine.createSpyObj<AdminUserService>(
      'AdminUserService',
      ['syncUserProfiles']
    );

    await TestBed.configureTestingModule({
      imports: [DataSynchronizationComponent],
      providers: [
        { provide: DataService, useValue: dataService },
        { provide: AdminUserService, useValue: adminUserService },
        { provide: AuthService, useValue: { user: null } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(DataSynchronizationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows Firestore permission details instead of a generic error', async () => {
    dataService.validateFirebaseConnection.and.returnValue(throwError(
      new HttpErrorResponse({
        status: 403,
        statusText: 'Forbidden',
        error: { error: { message: 'Missing or insufficient permissions.' } }
      })
    ));

    await component.testConnection();

    expect(component.message).toBe(
      'Firebase connection failed: HTTP 403: Missing or insufficient permissions.'
    );
  });

  it('syncs user profiles through the protected server action', async () => {
    adminUserService.syncUserProfiles.and.returnValue(of({ total: 2, synced: 2 }));

    await component.syncUserProfiles();

    expect(adminUserService.syncUserProfiles).toHaveBeenCalled();
    expect(component.userSyncResult).toEqual({ total: 2, synced: 2 });
    expect(component.message).toContain('2 of 2');
    expect(component.message).toContain('Password hashes and salts were excluded');
  });
});
