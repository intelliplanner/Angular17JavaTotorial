# Angular17JavaTutorial

A comprehensive web-based platform for Java learning and coding practice. This application provides interactive tutorials, code examples, and an online Java compiler for hands-on learning.

**Live Demo**: [https://intelliplanner.github.io/Angular17JavaTotorial/](https://intelliplanner.github.io/Angular17JavaTotorial/)

## Features

- 📚 **Interactive Java Tutorials** - Learn core Java concepts with structured lessons
- 🖥️ **Online Java Compiler** - Write, compile, and run Java code directly in the browser
- 💾 **Save Programs** - Save your Java programs for later access
- 🔧 **Multiple Java Versions** - Support for different Java compiler versions
- 📖 **Interview Questions** - Prepare for technical interviews with curated questions
- 🧭 **Tutorials & Interview Q&A** - Search lessons, filter by topic and difficulty, track reading progress, and save or share content
- 🛠️ **Admin Panel** - Create, edit, publish, and delete tutorials and interview answers with server-side admin authorization
- ⚙️ **JSON Data Generator** - Run the Python dataset generator from the administrator Settings menu
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

## Application Flow

```mermaid
flowchart TD
    User[Learner or administrator] --> UI[Angular application]
    UI -->|Browse and practice| Content[Bundled JSON data and learning features]
    UI -->|API requests when configured| API[Express API]
    API -->|Read or persist managed content| Source[src/assets/data JSON files]
    UI -->|Admin Settings: Generate JSON data| API
    API -->|Authenticate administrator and validate request| Python[Python JSON generator]
    Python -->|Read and validate datasets and catalogs| Source
    Python -->|Write review drafts only| Drafts[data/generated-json]
    Drafts --> Review[Review selected records in Admin Settings]
    Review -->|Import approved records| Source
```

1. The Angular application opens the requested feature after applying the configured login and route-permission guards.
2. Learners browse tutorials, interview Q&A, video learning, and quizzes. The application uses bundled data and, when configured, the Express API for content.
3. Administrators manage content through protected pages. Successful tutorial and Q&A changes are persisted by the Express API to the source JSON files.
4. For generation, an administrator opens **Settings → Generate JSON data** and selects datasets and minimum record counts. The Angular client sends that request to the protected Express endpoint, which invokes the fixed Python generator module.
5. The generator scans and validates the source datasets against the category catalogs. Validation errors stop generation; otherwise it writes review drafts under `data/generated-json`. It does not modify or publish source content.
6. In the generator page, load a dataset, inspect the draft records, select only approved entries, and choose **Import selected**. Imports are limited to 100 records per action; imported entries are removed from the draft file, and duplicates are rejected. Tutorials are published immediately on import. Q&A is appended to `questions-and-answers.json`. Quiz drafts are routed only to existing category files listed in `question-files.json`; missing subcategories are added to their existing category, while drafts for unmapped categories remain in review.
7. Imported quizzes are stored in the source assets. For a static GitHub Pages deployment, rebuild and redeploy the frontend before learners can load those new quiz questions.

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
- `false`: all application tabs are available without signing in.
Change `loginEnabled` in `environment.prod.ts` and redeploy to change the GitHub Pages behavior. Disabling frontend login only changes access to application pages; protected backend write/admin APIs continue to require server authentication.

The `settingsEnabled` property in each `src/environments/environment*.ts` file controls whether the administrator Settings menu appears in the header. Set it to `false` to hide the menu or `true` to show it for administrators. This is a navigation visibility option; it does not replace route guards or backend authorization.

The login page offers Google sign-in as well as the existing username/password flow. Google ID tokens are verified by the backend and exchanged with Firebase Authentication. On first sign-in, Firebase Authentication creates the Google-linked account and the backend creates or updates `users/{uid}` in Firestore with `uid`, `displayName`, `email`, role, and permissions. Existing profile roles and permissions are preserved.

Username/password login follows `enableFirebase` in the active environment. When disabled, the server validates credentials against its private `data/users.json`. When enabled, login validates the username and password with Firebase Authentication and gets the role and permissions from the matching Firestore `users` profile; the local JSON password file is not used. Firebase Authentication must contain the account, and the Firestore profile document must use that account's Auth UID as its document ID and include `username`, `role`, and `permissions`. A Firestore profile by itself cannot authenticate a password.

For Firebase data access and user provisioning:

1. Deploy the Express backend using the repository's `render.yaml` Blueprint. The production `authApiUrl` must point to this backend.
2. The Blueprint supplies `FIREBASE_PROJECT_ID` and `FIREBASE_WEB_API_KEY` from the production Firebase web configuration. Verify they match the Firebase project; if using another project, update them in Render. Enable the Google provider under Firebase Authentication → Sign-in method, and ensure the Google OAuth client ID configured in `environment*.ts` is the same client ID accepted by the backend. Set `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` in the Render service's **Environment** settings to the private service-account JSON. Render generates `PASSWORD_UNIQUENESS_SECRET` from the Blueprint. Keep the service-account JSON and generated secret private; never add them to frontend environment files.
   When frontend login is disabled in local development, **Test Connection** uses a loopback-only backend Admin SDK check. The configured project ID and web API key must match `FIREBASE_PROJECT_ID` and `FIREBASE_WEB_API_KEY` on the backend, and its service account or Application Default Credentials must have Firestore access. This check does not grant browser users permission to sync data; production checks require an administrator session.
3. For a project with no Firebase administrator yet, replace the demo local admin password in the server-only `data/users.json` before deployment. Temporarily set the backend's `FIREBASE_BOOTSTRAP_ENABLED=true`, keep `settingsEnabled` enabled in the frontend, then choose **First-time setup? Use local administrator** on the login page. Use that local administrator account to create the first Firebase administrator. The setup session can only create that account; the server rejects it once a Firebase administrator exists. Turn `FIREBASE_BOOTSTRAP_ENABLED` off after setup. Do not expose the demo `admin` / `admin` credentials publicly.
4. Configure `FRONTEND_ORIGINS` as `https://intelliplanner.github.io` and deploy the repository's Firestore rules with `firebase deploy --only firestore:rules`.
5. For existing Firebase accounts, enter each account's UID in its server-side `data/users.json` record, then use **Settings → Data Synchronization → Sync User Profiles**. This securely upserts the username index and sanitized Firestore profile. Alternatively, configure local Firebase Admin Application Default Credentials (or `GOOGLE_APPLICATION_CREDENTIALS`), set `FIREBASE_PROJECT_ID`, and run `npm run sync:firebase-users`.
6. Firebase administrators can use **Settings → User Management** to create learner or administrator accounts. The backend adds each new account's password hash and Firebase UID to its private `data/users.json`, so the same local credentials work at the next login. Password uniqueness is checked for accounts created through this panel; existing Firebase passwords cannot be checked or migrated automatically.
7. Push to `main` or `dev`, or rerun the GitHub Pages workflow.

The Firestore `usernames` and `passwordUniqueness` collections must not be readable or writable by clients. User profile sync copies only username, role, and permissions; password hashes and salts remain in the server-side JSON file. The API uses Firebase Admin credentials to provision accounts and issue data-access tokens after local password verification. Firebase client configuration is not an Admin credential.

For local development, set the same Firebase server variables, then run `npm run server`; the local API is `http://localhost:9090`. Set `FIREBASE_BOOTSTRAP_ENABLED=true` only while creating the first Firebase administrator. Keep `SESSION_SECRET` and password hashes on the backend, and never copy `data/users.json` into `src/assets`.

The Render free service filesystem is ephemeral. If users are created through the administration panel, persist the updated `data/users.json` using a supported persistent disk or update the deployment copy before a restart/redeploy; otherwise those local login records can be lost.

For local JSON authentication only, the starter accounts are `test` / `test` (learner access) and `admin` / `admin` (full access). Replace these demo credentials before exposing the service publicly.
### Tutorials and Interview Q&A

- Open `/tutorials` to browse published tutorials or use the Interview Q&A tab. Search and filters support all configured categories, topics, and difficulty levels.
- Open `/admin-panel` while signed in as an administrator to manage tutorial drafts/publication and Q&A entries.
- Open **Settings → Generate JSON data** to invoke the server-side Python generator. Select tutorials, Q&A, and/or quiz datasets and set a minimum of 1,000–10,000 output records per selected file. The action requires the authenticated admin session and Node.js API; source data is validated first and never overwritten. Generated review drafts are stored in `data/generated-json` on the server and are not automatically published or merged into the Angular assets.
- The backend requires Python 3.10+; Tkinter is not needed for server execution. On Windows it invokes `py -3`; on other systems it invokes `python3`. Set `PYTHON_EXECUTABLE` to a Python executable path if the runtime is installed elsewhere. The server invokes a fixed Python module and does not accept commands or file paths from the browser.
- Seed content is stored in `src/assets/data/tutorials.json` and `src/assets/data/questions-and-answers.json`. The Express API persists admin changes to those JSON files.
- The production frontend can read the bundled JSON files when no API URL is configured; creating or editing content requires the Express backend and a configured `authApiUrl`.
- Browser bookmarks, tutorial completion, and question votes are stored locally in the current browser.

### Video Learning

- Open `/learn` for a responsive, searchable video library grouped by technology.
- Topic categories and subcategories come from `src/assets/data/topic_categories.json`; video entries are loaded from `src/assets/data/learning-videos.json`.
- YouTube links are restricted to `https://www.youtube.com/@Javatechie` and `https://www.youtube.com/@ApnaCollegeOfficial`. Learners browse those channels directly; the catalog does not embed or link to other videos. Bookmarks and completion progress are kept in browser local storage.
- AI, Claude, Data Science, and Data Engineering paths are included alongside the original technology categories.

The quiz bank includes AI, Claude, Data Science, and Data Engineering question files. Categories and subcategories for the quiz, tutorials, interview Q&A, and video learning are defined in `src/assets/data/topic_categories.json`; interview Q&A entries are stored in `src/assets/data/questions-and-answers.json`.

### Quiz Category Management

- Categories, subcategories, and shared display metadata are stored together in `src/assets/data/topic_categories.json`.
- The app reads this file directly when no backend URL is configured. The Express API exposes `GET /api/categories` and administrator-only `POST`, `PUT`, and `DELETE /api/categories` routes to persist changes to the same file.
- Category and subcategory edits that would orphan existing questions are rejected. Persistent changes require the Express backend and a configured `authApiUrl`.

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
- `GET /api/tutorials` - List published tutorials
- `GET /api/admin/tutorials` - List all tutorials (admin)
- `POST /api/tutorials` - Create a tutorial (admin)
- `PUT`, `DELETE /api/tutorials/:id` - Update or delete a tutorial (admin)
- `GET /api/questions` - List interview Q&A
- `POST /api/questions` - Create an interview question (admin)
- `PUT`, `DELETE /api/questions/:id` - Update or delete an interview question (admin)

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
