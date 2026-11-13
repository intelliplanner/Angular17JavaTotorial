import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
// import { DesignpatternComponent } from './designpattern/designpattern.component';
// import { HibernateComponent } from './hibernate/hibernate.component';
// import { MicroserviceComponent } from './microservice/microservice.component';
// import { CollectionComponent } from './collection/collection.component';
import { InterviewQuestionsComponent } from './interview-questions/interview-questions.component';
// import { ExceptionHandlingComponent } from './exception-handling/exception-handling.component';
import { LoginComponent } from './login/login.component';
import { authGuard } from './login-guard.guard';
import { JavaNotesComponent } from './java-notes/java-notes.component';
import { JavaCompilerComponent } from './java-compiler/java-compiler.component';
import { CategorizedNotesComponent } from './categorized-notes/categorized-notes.component';
import { QuestionAnswerPanelComponent } from './question-answer-panel/question-answer-panel.component';
import { InterviewQuestionAnswerCategorywiseComponent } from './interview-question-answer-categorywise/interview-question-answer-categorywise.component';
import { InterviewQuestionsAnswerUpdateComponent } from './interview-questions-answer-update/interview-questions-answer-update.component';
import { InteriorSampleComponent } from './interior-sample/interior-sample.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, title: 'Login Page' },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: 'javaNotes', component: JavaNotesComponent, title: 'Java Notes' },
      { path: 'categorizedNotes', component: CategorizedNotesComponent, title: 'Categorized Notes' },
      { path: 'home', component: HomeComponent, title: 'Tech Interview Hub' },
      { path: 'dashboard', redirectTo: 'home', pathMatch: 'full' },
      { path: 'interior-sample', component: InteriorSampleComponent, title: 'Interior Sample' },
      { path: 'interview', component: InterviewQuestionsComponent, title: 'Interview' },
      { path: 'myJavaNotes', component: JavaNotesComponent, title: 'Java Notes' },
      { path: 'compiler', component: JavaCompilerComponent, title: 'Java Compiler' },
      { path: 'questionAnswerPanel', component: QuestionAnswerPanelComponent, title: 'Question-Answer-Panel' },
      { path: 'questionAnswerByCategory', component: InterviewQuestionAnswerCategorywiseComponent, title: 'Question-Answer by Category' },
      { path: 'updateInterviewQuestionsAnswer', component: InterviewQuestionsAnswerUpdateComponent, title: 'Manage Questions Answers' },
      {
        path: 'quiz',
        pathMatch: 'full',
        title: 'Interview Quiz Portal',
        loadComponent: () => import('./quiz/components/quiz-dashboard/quiz-dashboard.component').then(module => module.QuizDashboardComponent)
      },
      {
        path: 'quiz/play',
        title: 'Take a Quiz',
        loadComponent: () => import('./quiz/components/quiz-player/quiz-player.component').then(module => module.QuizPlayerComponent)
      },
      {
        path: 'quiz/result',
        title: 'Quiz Results',
        loadComponent: () => import('./quiz/components/quiz-result/quiz-result.component').then(module => module.QuizResultComponent)
      },
      {
        path: 'quiz/review',
        title: 'Review Answers',
        loadComponent: () => import('./quiz/components/review-answer/review-answer.component').then(module => module.ReviewAnswerComponent)
      },
      {
        path: 'quiz/questions',
        title: 'Question Manager',
        loadComponent: () => import('./quiz/components/question-manager/question-manager.component').then(module => module.QuestionManagerComponent)
      },
      {
        path: 'quiz/categories',
        title: 'Category Manager',
        loadComponent: () => import('./quiz/components/category-manager/category-manager.component').then(module => module.CategoryManagerComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'login', pathMatch: 'full' }
  // { 'path': 'exceptionHandling', component: ExceptionHandlingComponent, 'title': 'Exception Handling' },
     // { 'path': 'collection', component: CollectionComponent, 'title': 'collection' },
    // { 'path': 'designPattern', component: DesignpatternComponent, 'title': 'DesignPattern', canActivate: [authGaurd] },
    // { 'path': 'hibernate', component: HibernateComponent, 'title': 'Hibernate' },
    // { 'path': 'microservice', component: MicroserviceComponent, 'title': 'Microservice' },
    // { 'path': '', component: JavaNotesComponent, 'title': 'Java Notes' },
  
];
