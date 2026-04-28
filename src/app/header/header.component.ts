import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
   loginClass:any="displayBlock";
   logoutClass:any="displayNone";
  login(){
    // alert("test");
    // this.loginClass = "displayNone";
    // this.logoutClass = "displayBlock";
  }
  logout(){
    // alert("test");
    // this.loginClass = "displayNone";
    // this.logoutClass = "displayBlock";
  }

}
