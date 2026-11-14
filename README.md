# Angular17JavaTutorial

A comprehensive web-based platform for Java learning and coding practice. This application provides interactive tutorials, code examples, and an online Java compiler for hands-on learning.

**Live Demo**: [https://intelliplanner.github.io/Angular17JavaTotorial/](https://intelliplanner.github.io/Angular17JavaTotorial/)

## Features

- 📚 **Interactive Java Tutorials** - Learn core Java concepts with structured lessons
- 🖥️ **Online Java Compiler** - Write, compile, and run Java code directly in the browser
- 💾 **Save Programs** - Save your Java programs for later access
- 🔧 **Multiple Java Versions** - Support for different Java compiler versions
- 📖 **Interview Questions** - Prepare for technical interviews with curated questions
- 🎯 **Code Snippets** - Quick access to common code patterns and examples
- ✨ **Syntax Highlighting** - Beautiful code editor with suggestions

## Topics Covered

- Core Java
- Collections Framework
- Exception Handling
- Java 8 Features (Streams, Lambdas)
- Java 9+ Features
- Design Patterns
- Hibernate & ORM
- Spring Boot
- Microservices
- Kafka
- AWS
- Multithreading

## Tech Stack

- **Frontend**: Angular 17.3.4
- **Styling**: Bootstrap 5.3.3
- **Backend API**: Node.js/Express
- **HTTP Client**: Angular HttpClient

## Prerequisites

- Node.js v20.11.1 or higher
- npm 10.5.2 or higher
- Git

## Installation

```bash
# Clone the repository
git clone https://github.com/intelliplanner/Angular17JavaTotorial.git

# Navigate to project directory
cd Angular17JavaTotorial

# Install dependencies
npm install
```

## Development

### Run Development Server

```bash
npm start
```

Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

### Start Backend Server

```bash
npm run server
```

The backend API will run on `http://localhost:9090` (or `http://192.168.1.10:9090` depending on your network configuration).

### Login Access

The `loginEnabled` property in each `src/environments/environment*.ts` file controls route access:

- `true`: users must sign in; route permissions are enforced.
- `false`: all application tabs are available without signing in. The production environment currently sets this to `false`; local development sets it to `true`.

Change `loginEnabled` in `environment.prod.ts` and redeploy to change the GitHub Pages behavior. Disabling frontend login only changes access to application pages; protected backend write/admin APIs continue to require server authentication.

When login is enabled on GitHub Pages, username/password login requires the separate Express API:

1. Deploy the Express backend using the repository's `render.yaml` Blueprint. Render generates a `SESSION_SECRET` and enables secure cookies.
2. Set `authApiUrl` in `src/environments/environment.prod.ts` to the deployed backend's HTTPS origin (for example, `https://your-service.onrender.com`, without an `/auth` path).
3. Configure the Render service's `FRONTEND_ORIGINS` variable as `https://intelliplanner.github.io`.
4. Push to `main` or `dev`, or rerun the GitHub Pages workflow.
5. To run locally, start the backend and Angular frontend:

   ```powershell
   $env:SESSION_SECRET = (node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
   npm run server
   ```

   The configured local development API is `http://localhost:9090`.

The backend validates the configured accounts in `data/users.json` and issues an HTTP-only session cookie. Keep `SESSION_SECRET` and password hashes on the backend; never put the signing secret in frontend environment files.

The starter accounts are `test` / `test` (learner access) and `admin` / `admin` (full access). Replace these demo credentials before exposing the service publicly.

## Build

### Development Build

```bash
npm run build
```

### Production Build

```bash
npm run build:prod
```

The build artifacts will be stored in the `dist/` directory.

## Testing

### Unit Tests

```bash
npm test
```

Executes the unit tests via [Karma](https://karma-runner.github.io).

## Deployment

### GitHub Pages Deployment

The project is configured to deploy to GitHub Pages using GitHub Actions. On every push to the `main` branch:

1. Dependencies are installed
2. Production build is created with correct base href
3. Build artifacts are deployed to GitHub Pages

**Deployment URL**: `https://intelliplanner.github.io/Angular17JavaTotorial/`

## Project Structure

```
src/
├── app/
│   ├── java-compiler/          # Online Java compiler component
│   ├── interview-questions/    # Interview prep questions
│   ├── java-notes/             # Java tutorials and notes
│   ├── services/               # Angular services
│   ├── dto/                    # Data transfer objects
│   ├── collection/             # Collections framework lessons
│   ├── designpattern/          # Design pattern lessons
│   ├── exception-handling/     # Exception handling lessons
│   └── ... (other feature modules)
├── assets/
│   ├── images/
│   ├── javaNotesPdf/           # PDF resources
│   └── JavaPrograms/           # Sample programs
└── environments/               # Environment configurations
    ├── environment.ts          # Development config
    └── environment.prod.ts     # Production config
```

## Configuration

### Environment Configuration

- **Development** (`environment.ts`): API URL `http://192.168.1.10:9090`
- **Production** (`environment.prod.ts`): the GitHub Pages workflow injects the `AUTH_API_URL` GitHub Actions variable at build time.

## API Endpoints

- `POST /compile` - Compile and execute Java code
- `POST /saveProgram` - Save a Java program
- `GET /getSavedPrograms` - Retrieve saved programs
- `GET /loadProgram?fileName=` - Load a specific program

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or suggestions, please open an issue on the [GitHub repository](https://github.com/intelliplanner/Angular17JavaTotorial/issues).

## Further Help

- [Angular Documentation](https://angular.io)
- [Angular CLI Overview](https://angular.io/cli)
- [Java Documentation](https://docs.oracle.com/javase/)
- [Node.js Documentation](https://nodejs.org/docs/)
