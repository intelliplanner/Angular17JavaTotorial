import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
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
