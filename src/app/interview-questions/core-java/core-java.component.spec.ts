import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoreJavaComponent } from './core-java.component';

describe('CoreJavaComponent', () => {
  let component: CoreJavaComponent;
  let fixture: ComponentFixture<CoreJavaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoreJavaComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CoreJavaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
