import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let http: HttpTestingController;
  let originalProduction: boolean;
  let originalAuthApiUrl: string;

  beforeEach(() => {
    originalProduction = environment.production;
    originalAuthApiUrl = environment.authApiUrl;
    environment.production = true;
    environment.authApiUrl = '';
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(CategoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.production = originalProduction;
    environment.authApiUrl = originalAuthApiUrl;
  });

  it('loads categories and subcategories from the shared topic file', () => {
    let result: string[] = [];

    service.getCategories().subscribe(categories => result = categories[0].subCategories);

    http.expectOne('assets/data/topic_categories.json').flush([{
      name: 'Java',
      subCategories: ['Core Java', 'Collections']
    }]);
    expect(result).toEqual(['Core Java', 'Collections']);
  });

  it('rejects duplicate category names in the shared topic file', () => {
    let error = '';

    service.getCategories().subscribe({
      error: value => error = value.message
    });

    http.expectOne('assets/data/topic_categories.json').flush([
      { name: 'Java', subCategories: ['Core Java'] },
      { name: 'java', subCategories: ['Collections'] }
    ]);
    expect(error).toContain('must be unique');
  });
});
