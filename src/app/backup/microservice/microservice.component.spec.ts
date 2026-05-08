import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MicroserviceComponent } from './microservice.component';

describe('MicroserviceComponent', () => {
  let component: MicroserviceComponent;
  let fixture: ComponentFixture<MicroserviceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MicroserviceComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MicroserviceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
