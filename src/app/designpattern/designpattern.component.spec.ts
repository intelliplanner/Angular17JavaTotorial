import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesignpatternComponent } from './designpattern.component';

describe('DesignpatternComponent', () => {
  let component: DesignpatternComponent;
  let fixture: ComponentFixture<DesignpatternComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesignpatternComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DesignpatternComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
