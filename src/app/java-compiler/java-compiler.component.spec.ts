import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JavaCompilerComponent } from './java-compiler.component';

describe('JavaCompilerComponent', () => {
  let component: JavaCompilerComponent;
  let fixture: ComponentFixture<JavaCompilerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JavaCompilerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(JavaCompilerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
