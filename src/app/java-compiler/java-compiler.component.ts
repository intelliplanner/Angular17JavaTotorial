import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { JavaVersionService, JavaVersion } from '../services/java-version.service';
import { environment } from '../../environments/environment';

interface CodeSuggestion {
  label: string;
  code: string;
  description: string;
}

interface ImportSuggestion {
  label: string;
  import: string;
  description: string;
}

@Component({
  selector: 'app-java-compiler',
  templateUrl: './java-compiler.component.html',
  styleUrls: ['./java-compiler.component.css'],
  standalone: true,
  imports: [FormsModule, CommonModule, HttpClientModule]
})
export class JavaCompilerComponent implements OnInit {
  code: string = '';
  output: string = '';
  selectedVersion: string = '';
  selectedSample: string = '';
  javaVersions: JavaVersion[] = [];
  programName: string = '';
  savedJavaFiles: string[] = [];
  savedFileSelection: string = '';
  apiUrl: string = environment.apiUrl;

  importSuggestions: ImportSuggestion[] = [
    {
      label: 'ArrayList',
      import: 'import java.util.ArrayList;',
      description: 'Import ArrayList class'
    },
    {
      label: 'HashMap',
      import: 'import java.util.HashMap;',
      description: 'Import HashMap class'
    },
    {
      label: 'List',
      import: 'import java.util.List;',
      description: 'Import List interface'
    },
    {
      label: 'Arrays',
      import: 'import java.util.Arrays;',
      description: 'Import Arrays utility class'
    },
    {
      label: 'Collections',
      import: 'import java.util.Collections;',
      description: 'Import Collections utility class'
    },
    {
      label: 'Scanner',
      import: 'import java.util.Scanner;',
      description: 'Import Scanner for input'
    },
    {
      label: 'Stream',
      import: 'import java.util.stream.*;',
      description: 'Import Stream API'
    },
    {
      label: 'java.util.*',
      import: 'import java.util.*;',
      description: 'Import all java.util classes'
    },
    {
      label: 'java.io.*',
      import: 'import java.io.*;',
      description: 'Import all I/O classes'
    },
    {
      label: 'java.time.*',
      import: 'import java.time.*;',
      description: 'Import Java Time API'
    },
    {
      label: 'Optional',
      import: 'import java.util.Optional;',
      description: 'Import Optional class'
    },
    {
      label: 'DateFormat',
      import: 'import java.text.DateFormat;',
      description: 'Import DateFormat class'
    }
  ];

  codeSuggestions: CodeSuggestion[] = [
    {
      label: 'class',
      code: 'public class MyClass {\n    public static void main(String[] args) {\n        \n    }\n}',
      description: 'Insert a basic class structure'
    },
    {
      label: 'interface',
      code: 'public interface MyInterface {\n    void myMethod();\n}',
      description: 'Insert a basic interface structure'
    },
    // {
    //   label: 'main',
    //   code: 'public static void main(String[] args) {\n  \n}',
    //   description: 'Insert a basic main method'
    // },
    {
      label: 'Print Statement',
      code: 'System.out.println("");',
      description: 'Insert a print statement'
    },
    {
      label: 'For Loop',
      code: 'for (int i = 0; i < ; i++) {\n  \n}',
      description: 'Insert a for loop'
    },
    {
      label: 'If-Else',
      code: 'if () {\n  \n} else {\n  \n}',
      description: 'Insert if-else statement'
    },
    {
      label: 'While Loop',
      code: 'while () {\n  \n}',
      description: 'Insert a while loop'
    },
    {
      label: 'Try-Catch',
      code: 'try {\n  \n} catch (Exception e) {\n  e.printStackTrace();\n}',
      description: 'Insert try-catch block'
    },
    {
      label: 'Array Declaration',
      code: 'int[] array = new int[size];',
      description: 'Insert array declaration'
    },
    {
      label: 'ArrayList',
      code: 'List<String> list = new ArrayList<>();\nlist.add("");',
      description: 'Insert ArrayList usage'
    },
    {
      label: 'Method',
      code: 'public static void method() {\n  \n}',
      description: 'Insert a method'
    }
  ];

  constructor(
    private http: HttpClient,
    private javaVersionService: JavaVersionService
  ) { }

  ngOnInit() {
    this.loadJavaVersions();
     this.loadSavedJavaFiles(); 
  }

  loadJavaVersions() {
    this.javaVersions = this.javaVersionService.getJavaVersions();

    if (this.javaVersions.length === 0) {
      this.javaVersionService.loadJavaVersions().subscribe({
        next: (versions) => {
          this.javaVersions = versions;
          this.setDefaultVersion();
        },
        error: (err) => {
          console.error('Failed to load Java versions in component:', err);
          this.setDefaultVersion();
        }
      });
    } else {
      this.setDefaultVersion();
    }
  }



// saveProgram() {
//   if (!this.programName) {
//     alert('Please enter a program name!');
//     return;
//   }

//   const fileName = this.programName.trim() + '.java';
//   const payload = { fileName: fileName, code: this.code };

//   this.http.post<any>('http://192.168.1.10:9090/saveProgram', payload)
//     .subscribe({
//       next: (res) => this.output = res.message,
//       error: (err) => this.output = 'Error saving program: ' + (err.error?.message || err.statusText)
//     });
// }
private extractClassName(): string | null {
  const classPattern = /(?:public\s+)?class\s+(\w+)/;
  const match = this.code.match(classPattern);
  return match ? match[1] : null;
}
saveProgram() {
  if (!this.programName) {
    alert('Please enter a program name!');
    return;
  }
 const className = this.extractClassName();

  if (!className) {
    alert('No class found in code! Please define a class in the format:\npublic class ClassName { ... }');
    return;
  }

    // Add program name as a comment at the beginning
  const commentHeader = `/**\n * Program: ${this.programName}\n */\n`;
  const fullCode = commentHeader + this.code;

  const fileName = className + '.java';
  const payload = { fileName: fileName, code: fullCode };

  this.http.post<any>(`${this.apiUrl}/saveProgram`, payload)
    .subscribe({
      next: (res) => this.output = res.message,
      error: (err) => this.output = 'Error saving program: ' + (err.error?.message || err.statusText)
    });
}
// Add this new method to load Java files from server
loadSavedJavaFiles() {
  this.http.get<any>(`${this.apiUrl}/getSavedPrograms`)
    .subscribe({
      next: (res) => {
        this.savedJavaFiles = res.files || [];
      },
      error: (err) => {
        console.error('Failed to load saved Java files:', err);
        this.savedJavaFiles = [];
      }
    });
}
// Add this method to load selected Java file
loadSavedProgram(fileName: string) {
  if (!fileName) return;

  this.http.get<any>(`${this.apiUrl}/loadProgram?fileName=${fileName}`)
    .subscribe({
      next: (res) => {
        this.code = res.code || '';
        this.programName = fileName.replace('.java', '');
      },
      error: (err) => {
        this.output = 'Error loading program: ' + (err.error?.message || err.statusText);
      }
    });
}
  // saveProgram() {
  //   if (!this.programName) {
  //     alert('Please enter a program name!');
  //     return;
  //   }

  //   const fileName = this.programName.trim() + '.java';
  //   const blob = new Blob([this.code], { type: 'text/plain;charset=utf-8' });

  //   // Trigger download into assets-like location (browser side)
  //   const link = document.createElement('a');
  //   link.href = window.URL.createObjectURL(blob);
  //   link.download = fileName;
  //   link.click();

  //   // Reset output message
  //   this.output = `Program saved as ${fileName}`;
  // }

  private setDefaultVersion() {
    if (this.javaVersions.length > 0) {
      this.selectedVersion = this.javaVersions[0].value;
    }
  }

  getSelectedJavaPath(): string {
    return this.javaVersionService.getSelectedJavaPath(this.selectedVersion);
  }

  compileCode() {
    const javaPath = this.getSelectedJavaPath();
    const payload = { code: this.code, javaPath: javaPath };

    this.http.post<any>(`${this.apiUrl}/compile`, payload)
      .subscribe({
        next: (res) => this.output = res.output,
        error: (err) => this.output = 'Error: ' + err.message
      });
  }

  loadSampleCode() {
    const samples: { [key: string]: string } = {
      hello: `public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
      class: `public class SampleClass {
    private String name;
    private int age;

    public SampleClass(String name, int age) {
        this.name = name;
        this.age = age;
    }

    public void display() {
        System.out.println("Name: " + name + ", Age: " + age);
    }

    public static void main(String[] args) {
        SampleClass obj = new SampleClass("John", 25);
        obj.display();
    }
}`,
      loop: `public class ForLoop {
    public static void main(String[] args) {
        System.out.println("Numbers from 1 to 5:");
        for (int i = 1; i <= 5; i++) {
            System.out.println(i);
        }
    }
}`,
      streams: `import java.util.*;
import java.util.stream.*;

public class StreamsExample {
    public static void main(String[] args) {
        List<Integer> numbers = Arrays.asList(2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15);
        int sum = numbers.stream()
            .filter(p -> p % 2 == 0)
            .collect(Collectors.summingInt(p -> p));
        System.out.println("Sum of even numbers: " + sum);
    }
}`,
      array: `public class ArrayExample {
    public static void main(String[] args) {
        int[] numbers = {10, 20, 30, 40, 50};

        System.out.println("Array elements:");
        for (int i = 0; i < numbers.length; i++) {
            System.out.println("Element at index " + i + ": " + numbers[i]);
        }
    }
}`
    };

    if (this.selectedSample && samples[this.selectedSample]) {
      this.code = samples[this.selectedSample];
      this.output = '';
    }
  }

  insertSuggestion(suggestion: string) {
    this.code += '\n' + suggestion;
  }

  insertImport(importStatement: string) {
    // Check if import already exists
    if (this.code.includes(importStatement)) {
      alert('This import already exists in your code!');
      return;
    }

    // Add import at the beginning of the code
    this.code = importStatement + '\n' + this.code;
  }

  clearCode() {
    this.code = '';
    this.output = '';
  }

  /**
   * Handle Tab key press in textarea
   * Insert tab indentation instead of moving focus
   */
  handleTabKey(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      event.preventDefault();
      
      const textarea = event.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // Insert tab character at cursor position
      this.code = this.code.substring(0, start) + '\t' + this.code.substring(end);
      
      // Move cursor after inserted tab
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      }, 0);
    }
  }

}