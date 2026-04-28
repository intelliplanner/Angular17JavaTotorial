import { Component, OnInit } from '@angular/core';
import { Topic } from '../dto/Topic';

@Component({
  selector: 'app-java',
  standalone: true,
  imports: [],
  templateUrl: './java.component.html',
  styleUrl: './java.component.css',


})
export class JavaComponent implements OnInit{
  
  obj: Topic;
  ngOnInit(): void {
  
  }
 
}
