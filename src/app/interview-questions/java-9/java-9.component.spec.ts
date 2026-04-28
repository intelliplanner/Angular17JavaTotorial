import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Java9Component } from './java-9.component';

describe('Java9Component', () => {
  let component: Java9Component;
  let fixture: ComponentFixture<Java9Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Java9Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Java9Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
