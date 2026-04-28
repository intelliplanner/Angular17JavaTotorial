import { Component, OnInit } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { DashboardService } from '../services/dashboard.service';
import { Topic } from '../dto/Topic';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  // filesNameList : any;
  topicList:Topic[] ;
  constructor(private _dashboardService:DashboardService){
    
  } 
  
  ngOnInit(){
    this.topicList = [
      {id:1,topicName:"collection"},
      {id:2,topicName:"Java 8"},
      {id:3,topicName:"Java 9"},
      {id:4,topicName:"Abstraction:  Interface & Abstract Class"},
      {id:5,topicName:"Abstract Class"}
    
    ];  
    // this._dashboardService.getTopicData().subscribe(
    // (topic) => this.topicList = topic,
    // (err) => console.log(err)
  // );

  }
  
}
