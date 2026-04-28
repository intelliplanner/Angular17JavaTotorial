import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { JavaComponent } from './java/java.component';
import { DesignpatternComponent } from './designpattern/designpattern.component';
import { HibernateComponent } from './hibernate/hibernate.component';
import { SpringbootComponent } from './springboot/springboot.component';
import { MicroserviceComponent } from './microservice/microservice.component';
import { CollectionComponent } from './collection/collection.component';
import { InterviewQuestionsComponent } from './interview-questions/interview-questions.component';
import { ExceptionHandlingComponent } from './exception-handling/exception-handling.component';
import { LoginComponent } from './login/login.component';
import { authGaurd } from './login-guard.guard';
import { JavaNotesComponent } from './java-notes/java-notes.component';
import { JavaCompilerComponent } from './java-compiler/java-compiler.component';

export const routes: Routes = [
    // {'path':'',component:HomeComponent,'title':'DashBoard',canActivate:[authGaurd]},
    {'path':'dashboard',component:HomeComponent,'title':'DashBoard'},
    {'path':'java',component:JavaComponent,'title':'Java'},
    {'path':'collection',component:CollectionComponent,'title':'collection'},
    {'path':'designPattern',component:DesignpatternComponent,'title':'DesignPattern',canActivate:[authGaurd]},
    {'path':'hibernate',component:HibernateComponent,'title':'Hibernate'},
    {'path':'springBoot',component:SpringbootComponent,'title':'SpringBoot'},
    {'path':'microservice',component:MicroserviceComponent,'title':'Microservice'},
    {'path':'interview',component:InterviewQuestionsComponent,'title':'Interview'},
    {'path':'exceptionHandling',component:ExceptionHandlingComponent,'title':'Exception Handling'},
    {'path':'login',component:LoginComponent,'title':'Login Page'},
    {'path':'myJavaNotes',component:JavaNotesComponent,'title':'Java Notes'},
    {'path':'',component:JavaNotesComponent,'title':'Java Notes'},
    {'path':'compiler',component:JavaCompilerComponent,'title':'Java Compiler'}
];
