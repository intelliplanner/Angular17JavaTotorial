import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MultithredingComponent } from './multithreding.component';

describe('MultithredingComponent', () => {
  let component: MultithredingComponent;
  let fixture: ComponentFixture<MultithredingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultithredingComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MultithredingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
