import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Java8Component } from './java-8.component';

describe('Java8Component', () => {
  let component: Java8Component;
  let fixture: ComponentFixture<Java8Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Java8Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Java8Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
