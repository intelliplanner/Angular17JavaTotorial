import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from "@angular/core";
import { Observable, throwError } from 'rxjs';
// import { catchError } from 'rxjs/operators';
import { Topic } from '../dto/Topic';
import {catchError} from 'rxjs/operators';


@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  // filesNameList: any[] = [{ id: 1, name: 'Features of Java' }
  //   , { id: 2, name: 'JDK, JRE, and JVM' }
  //   , { id: 3, name: 'Java 8 Features' }
  //   , { id: 4, name: 'Java 9 Features' }
  //   , { id: 5, name: 'Java OOPs Concepts' }
  //   , { id: 6, name: 'Inheritance [IS-A]' }
  //   , { id: 7, name: 'Aggregation' }
  //   , { id: 1, name: 'Polymorphism' }
  //   , { id: 2, name: 'Interface' }
  //   , { id: 3, name: 'String' }
  //   , { id: 4, name: 'Object vs Class' }
  //   , { id: 5, name: 'Java Reflection' }
  //   , { id: 6, name: 'Overloading Vs Overriding' }
  //   , { id: 7, name: 'Exception Handling' }
  //   , { id: 1, name: 'Collection' }
  // ];

  constructor(private httpClient: HttpClient) { }
  uri: string = 'http://localhost:8080/topicList';
  // uri: string = 'http://localhost:3000/topic';
  // getTopicDetails() {
  //   debugger;
  //   return this.filesNameList;
  // }


  getTopicData(): Observable<Topic[]> {
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      })
    };
    debugger
    return this.httpClient.get<Topic[]>(this.uri, httpOptions).pipe(
      // catchError(this.handleError)
    );
  }

  private handleError(errorResponse: HttpErrorResponse) {
    if (errorResponse.error instanceof ErrorEvent) {
      console.error('Clent Side Error');
    } else {
      console.error('Server Side Error');
    }
    return 
    
    ;
  }

}
