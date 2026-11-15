import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategorizedNotesComponent } from './categorized-notes.component';

describe('CategorizedNotesComponent', () => {
  let component: CategorizedNotesComponent;
  let fixture: ComponentFixture<CategorizedNotesComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategorizedNotesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CategorizedNotesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
    http.expectOne('assets/json_files/categorized_topic.json').flush({});
    component.currentUrl = TestBed.inject(DomSanitizer).bypassSecurityTrustResourceUrl('about:blank');
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('expands the selected PDF to the full page and closes the view', () => {
    component.togglePdfFullPage();
    fixture.detectChanges();

    expect(component.isPdfFullPage).toBeTrue();
    expect(fixture.nativeElement.querySelector('.pdf-viewer.full-page')).not.toBeNull();

    const closeButton = fixture.nativeElement.querySelector('.pdf-full-page-close') as HTMLButtonElement;
    closeButton.click();
    fixture.detectChanges();

    expect(component.isPdfFullPage).toBeFalse();
    expect(fixture.nativeElement.querySelector('.pdf-viewer.full-page')).toBeNull();
  });

  it('closes the full-page PDF view with Escape', () => {
    component.togglePdfFullPage();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.isPdfFullPage).toBeFalse();
  });
});
