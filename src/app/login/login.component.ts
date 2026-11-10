import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
  // preserveWhitespaces:true
})
export class LoginComponent implements OnInit { 
  constructor(private readonly _router: Router) {}

  ngOnInit(){

  }

  login(name:any,pwd:any){
    if(name == 'admin' && pwd == 'admin'){
     sessionStorage.setItem("isLoggedIn","true");
     this._router.navigateByUrl('/dashboard');
    }else{
        sessionStorage.setItem("isLoggedIn","false");
        alert("Incorrect Username & Password \n Please enter admin/admin");
    }
  }

  logout(){
    sessionStorage.setItem("isLoggedIn","false");
  }
}
