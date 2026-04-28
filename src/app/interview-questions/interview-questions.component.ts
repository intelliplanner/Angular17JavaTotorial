import { Component } from '@angular/core';
import { CoreJavaComponent } from './core-java/core-java.component';
import { DesignPatternComponent } from './design-pattern/design-pattern.component';
import { HibernateComponent } from './hibernate/hibernate.component';
import { ExceptionHandlingComponent } from './exception-handling/exception-handling.component';
import { MultithredingComponent } from './multithreding/multithreding.component';
import { SpringComponent } from './spring/spring.component';
import { Java8Component } from './java-8/java-8.component';
import { Java9Component } from './java-9/java-9.component';
import { AwsComponent } from './aws/aws.component';
import { MicroservicesComponent } from './microservices/microservices.component';
import { KafkaComponent } from './kafka/kafka.component';
import { CollectionsComponent } from './collections/collections.component';

@Component({
  selector: 'app-interview-questions',
  standalone: true,
  imports: [CoreJavaComponent,DesignPatternComponent,Java8Component,Java9Component,AwsComponent,CollectionsComponent,MicroservicesComponent,KafkaComponent,HibernateComponent,ExceptionHandlingComponent,MultithredingComponent,SpringComponent],
  templateUrl: './interview-questions.component.html',
  styleUrl: './interview-questions.component.css'
})
export class InterviewQuestionsComponent {

}
