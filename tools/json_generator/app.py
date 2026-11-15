"""Tkinter desktop interface for learning-portal JSON validation and generation."""

from __future__ import annotations

import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from .generator import (
    GenerationBlocked,
    MAX_RECORDS_PER_FILE,
    OUTPUT_NAMES,
    coverage_report,
    generate_missing,
    load_master_catalog,
    scan_directory,
    validation_report,
)


class JsonGeneratorApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Learning Portal JSON Generator")
        self.geometry("920x680")
        self.minsize(720, 520)
        self.input_folder = tk.StringVar()
        self.output_folder = tk.StringVar()
        self.dataset_enabled = {
            "tutorials": tk.BooleanVar(value=True),
            "answers": tk.BooleanVar(value=True),
            "quiz": tk.BooleanVar(value=True),
        }
        self.minimum_counts = {
            kind: tk.StringVar(value="1000")
            for kind in OUTPUT_NAMES
        }
        self._build_ui()

    def _build_ui(self) -> None:
        root = ttk.Frame(self, padding=16)
        root.pack(fill=tk.BOTH, expand=True)
        ttk.Label(root, text="Learning Portal JSON Generator", font=("Segoe UI", 18, "bold")).pack(anchor=tk.W)
        ttk.Label(
            root,
            text="Analyze catalog coverage, validate existing data, and create unpublished review drafts.",
        ).pack(anchor=tk.W, pady=(4, 14))

        self._folder_row(root, "Input data folder", self.input_folder, self._choose_input)
        self._folder_row(root, "Output folder", self.output_folder, self._choose_output)
        settings = ttk.LabelFrame(root, text="Generation settings", padding=8)
        settings.pack(fill=tk.X, pady=(8, 0))
        ttk.Label(settings, text="Select datasets and minimum records per output file (1,000–100,000)").grid(
            row=0, column=0, columnspan=2, sticky=tk.W, pady=(0, 4)
        )
        for row, (kind, label) in enumerate((
            ("tutorials", "Tutorials"),
            ("answers", "Questions and answers"),
            ("quiz", "Quiz questions"),
        ), start=1):
            ttk.Checkbutton(
                settings,
                text=label,
                variable=self.dataset_enabled[kind],
            ).grid(row=row, column=0, sticky=tk.W, padx=(0, 12))
            ttk.Spinbox(
                settings,
                from_=1000,
                to=MAX_RECORDS_PER_FILE,
                increment=100,
                textvariable=self.minimum_counts[kind],
                width=12,
            ).grid(row=row, column=1, sticky=tk.W)
        buttons = ttk.Frame(root)
        buttons.pack(fill=tk.X, pady=(8, 10))
        ttk.Button(buttons, text="Analyze & Validate", command=self._analyze).pack(side=tk.LEFT)
        ttk.Button(buttons, text="Generate Selected Datasets", command=self._generate).pack(side=tk.LEFT, padx=(8, 0))
        ttk.Button(buttons, text="Export Report", command=self._export_report).pack(side=tk.RIGHT)
        ttk.Button(buttons, text="Clear Report", command=self._clear).pack(side=tk.RIGHT, padx=(0, 8))

        self.report = tk.Text(root, wrap=tk.WORD, font=("Consolas", 10), state=tk.DISABLED)
        scrollbar = ttk.Scrollbar(root, orient=tk.VERTICAL, command=self.report.yview)
        self.report.configure(yscrollcommand=scrollbar.set)
        self.report.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self._append("Select the source data folder. The output defaults to a separate generated-json subfolder.\n")
        self._append("Generated records are unpublished drafts and require technical review before use.\n")

    def _folder_row(self, parent: ttk.Frame, label: str, variable: tk.StringVar, command: object) -> None:
        row = ttk.Frame(parent)
        row.pack(fill=tk.X, pady=4)
        ttk.Label(row, text=label, width=18).pack(side=tk.LEFT)
        ttk.Entry(row, textvariable=variable).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=8)
        ttk.Button(row, text="Browse...", command=command).pack(side=tk.LEFT)

    def _choose_input(self) -> None:
        selected = filedialog.askdirectory(title="Choose existing JSON data folder")
        if selected:
            self.input_folder.set(selected)
            if not self.output_folder.get():
                self.output_folder.set(str(Path(selected) / "generated-json"))

    def _choose_output(self) -> None:
        selected = filedialog.askdirectory(title="Choose output folder")
        if selected:
            self.output_folder.set(selected)

    def _analyze(self) -> None:
        try:
            scan = scan_directory(Path(self.input_folder.get()), load_master_catalog())
            issues = validation_report(scan)
            self._append("\n=== Coverage ===\n" + "\n".join(coverage_report(scan)) + "\n")
            self._append(f"\n=== Validation ({len(issues)} issue(s)) ===\n")
            self._append("\n".join(str(issue) for issue in issues) if issues else "No validation errors found.")
            if issues:
                self._append("\n")
        except (OSError, ValueError) as exc:
            messagebox.showerror("Could not analyze data", str(exc))

    def _generate(self) -> None:
        if not self.input_folder.get() or not self.output_folder.get():
            messagebox.showwarning("Folders required", "Choose both an input folder and an output folder.")
            return
        selected = {
            kind for kind, enabled in self.dataset_enabled.items()
            if enabled.get()
        }
        if not selected:
            messagebox.showwarning("No datasets selected", "Select at least one dataset to generate.")
            return
        minimum_counts: dict[str, int] = {}
        try:
            for kind in selected:
                count = int(self.minimum_counts[kind].get())
                if not 1000 <= count <= MAX_RECORDS_PER_FILE:
                    raise ValueError(f"{kind} must be between 1,000 and {MAX_RECORDS_PER_FILE:,}.")
                minimum_counts[kind] = count
        except (ValueError, tk.TclError) as exc:
            messagebox.showerror("Invalid generation setting", str(exc))
            return
        try:
            output_path = Path(self.output_folder.get())
            counts = generate_missing(
                Path(self.input_folder.get()),
                output_path,
                minimum_counts=minimum_counts,
                selected_kinds=selected,
            )
            output_scan = scan_directory(output_path, load_master_catalog())
        except GenerationBlocked as exc:
            self._append("\n=== Generation blocked ===\n" + "\n".join(str(issue) for issue in exc.issues) + "\n")
            messagebox.showerror("Validation errors", str(exc))
            return
        except (OSError, ValueError) as exc:
            messagebox.showerror("Could not generate data", str(exc))
            return
        summary = [
            f"{kind}: added {counts[kind]}, output total {len(output_scan.records[kind])}"
            for kind in OUTPUT_NAMES
            if kind in selected
        ]
        self._append("\n=== Generated draft records ===\n")
        self._append("\n".join(summary))
        self._append(f"\nSaved to: {self.output_folder.get()}\n")
        self._append("Review every draft, then merge approved records into production data.\n")
        messagebox.showinfo(
            "Generation complete",
            "Requested minimum record counts have been met.\n\n"
            + "\n".join(summary)
            + f"\n\nDraft datasets saved to:\n{self.output_folder.get()}",
        )

    def _append(self, text: str) -> None:
        self.report.configure(state=tk.NORMAL)
        self.report.insert(tk.END, text.rstrip() + "\n")
        self.report.see(tk.END)
        self.report.configure(state=tk.DISABLED)

    def _clear(self) -> None:
        self.report.configure(state=tk.NORMAL)
        self.report.delete("1.0", tk.END)
        self.report.configure(state=tk.DISABLED)

    def _export_report(self) -> None:
        content = self.report.get("1.0", tk.END).strip()
        if not content:
            messagebox.showwarning("No report", "Analyze a data folder before exporting a report.")
            return
        path = filedialog.asksaveasfilename(
            title="Save validation report",
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")],
        )
        if not path:
            return
        try:
            Path(path).write_text(content + "\n", encoding="utf-8")
        except OSError as exc:
            messagebox.showerror("Could not save report", str(exc))
            return
        messagebox.showinfo("Report saved", f"Validation report saved to:\n{path}")


def main() -> None:
    JsonGeneratorApp().mainloop()


if __name__ == "__main__":
    main()
