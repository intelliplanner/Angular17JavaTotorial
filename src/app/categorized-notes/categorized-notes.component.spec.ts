import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategorizedNotesComponent } from './categorized-notes.component';

describe('CategorizedNotesComponent', () => {
  let component: CategorizedNotesComponent;
  let fixture: ComponentFixture<CategorizedNotesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategorizedNotesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CategorizedNotesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
