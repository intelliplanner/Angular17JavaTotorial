import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  errorMessage = '';
  isSubmitting = false;
  isLocalFirebaseBootstrap = false;
}
    });
  }

  toggleFirebaseBootstrapLogin(): void {
    this.isLocalFirebaseBootstrap = !this.isLocalFirebaseBootstrap;
    this.errorMessage = '';
  }
}
