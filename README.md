# JSON to SQL Converter

A free, browser-only tool that converts JSON objects and arrays into SQL `INSERT` and `CREATE TABLE` statements. Your data never leaves your browser — nothing is uploaded.

Built by [Ethereal Studios](https://builtbyethereal.com/).

## Features

- **Output types:** `INSERT` statements, `CREATE TABLE`, or both
- **SQL dialects:** MySQL, PostgreSQL, SQLite, and generic SQL (dialect-aware identifier quoting, booleans, and column types)
- **Insert styles:** a single multi-row `INSERT` or one `INSERT` per record
- **Type inference:** column types are inferred from your data, with optional date/datetime string detection
- **Nested values:** serialize nested objects/arrays as JSON strings, or reject them
- **Primary key:** pick any detected column as the primary key
- **Utilities:** format / minify JSON, load sample data, copy SQL, download as `.sql`
- **Stats:** record, column, statement count, and input size
- **Light and dark themes**
- Keyboard shortcut: <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Enter</kbd> to convert

## Usage

1. Paste a JSON object or an array of objects into **JSON Input**.
2. Set the table name, output type, dialect, and other options.
3. Click **Convert to SQL**.
4. Copy or download the generated SQL.

Example input:

```json
[
  { "id": 1, "name": "John Doe", "email": "john@example.com", "active": true },
  { "id": 2, "name": "Jane Smith", "email": "jane@example.com", "active": false }
]
```

MySQL output (single INSERT):

```sql
INSERT INTO `users` (`id`, `name`, `email`, `active`) VALUES
(1, 'John Doe', 'john@example.com', 1),
(2, 'Jane Smith', 'jane@example.com', 0);
```

> Always review generated SQL before running it against a database, especially in production.

## Running locally

No build step or dependencies — it's plain HTML, CSS, and JavaScript.

```bash
git clone https://github.com/builtbyethereal/JSONToSQLConverter-.git
cd JSONToSQLConverter-
```

Then open `index.html` in your browser, or serve the folder with any static server (e.g. `npx serve .`).

## Project structure

```
.
├── index.html   # Page markup
├── style.css    # Styles and light/dark themes
├── script.js    # Parsing, type inference, and SQL generation
└── assets/      # Logos
```

## Deployment

The site is fully static and can be hosted on GitHub Pages: enable Pages in the repository settings and serve from the `main` branch root.

## Privacy

All conversion happens locally in your browser. No data is sent to any server.
