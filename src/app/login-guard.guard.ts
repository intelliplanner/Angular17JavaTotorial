import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGaurd: CanActivateFn = (route, state) => {
  const _router = inject(Router);
  
  let isLogin = sessionStorage.getItem("isLoggedIn");
  if (isLogin == 'false') {
    alert("Please login, redirecting to login page");
    _router.navigate(['login']);
    return false;
  }else{
    // _router.navigate(['dashboard']);
    return true;
  }

 
};
