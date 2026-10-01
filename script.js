(function () {
  'use strict';

  const COPY_RESET_DELAY = 1500;
  const TABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const SAMPLE_JSON = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      active: true,
      city: 'London'
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      age: 27,
      active: false,
      city: 'Manchester'
    },
    {
      id: 3,
      name: "O'Brien",
      email: null,
      age: 35,
      active: true,
      city: 'Dublin'
    }
  ];

  const jsonInput = document.getElementById('jsonInput');
  const sqlOutput = document.getElementById('sqlOutput');
  const tableNameInput = document.getElementById('tableName');
  const outputTypeSelect = document.getElementById('outputType');
  const dialectSelect = document.getElementById('dialect');
  const insertStyleSelect = document.getElementById('insertStyle');
  const nestedModeSelect = document.getElementById('nestedMode');
  const primaryKeySelect = document.getElementById('primaryKey');
  const detectDatesInput = document.getElementById('detectDates');
  const convertButton = document.getElementById('convertButton');
  const copyButton = document.getElementById('copyButton');
  const downloadButton = document.getElementById('downloadButton');
  const selectAllButton = document.getElementById('selectAllButton');
  const formatButton = document.getElementById('formatButton');
  const minifyButton = document.getElementById('minifyButton');
  const sampleButton = document.getElementById('sampleButton');
  const clearButton = document.getElementById('clearButton');
  const themeToggle = document.getElementById('themeToggle');
  const themeLabel = document.getElementById('themeLabel');
  const errorBox = document.getElementById('errorBox');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const converterShell = document.querySelector('.converter-shell');

  const statElements = {
    records: document.getElementById('recordCount'),
    columns: document.getElementById('columnCount'),
    statements: document.getElementById('statementCount'),
    inputSize: document.getElementById('inputSize')
  };

  let previousStats = {};
  let copyResetTimer;

  function getPreferredTheme() {
    const savedTheme = window.localStorage.getItem('jsonToSqlTheme');

    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const isDark = theme === 'dark';

    document.body.classList.toggle('theme-dark', isDark);
    themeToggle.setAttribute('aria-pressed', String(isDark));
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    themeLabel.textContent = isDark ? 'Dark' : 'Light';
    window.localStorage.setItem('jsonToSqlTheme', theme);
  }

  function toggleTheme() {
    const nextTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
    applyTheme(nextTheme);
  }

  function showError(title, message) {
    errorTitle.textContent = title;
    errorMessage.textContent = message || '';
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.hidden = true;
    errorTitle.textContent = '';
    errorMessage.textContent = '';
  }

  function resetStats() {
    updateStats({
      records: 0,
      columns: 0,
      statements: 0,
      inputSize: '0 B'
    });
  }

  function updateStats(stats) {
    Object.keys(statElements).forEach(function (key) {
      const element = statElements[key];
      const value = stats[key];
      const card = element.closest('.stat-card');

      if (previousStats[key] !== undefined && previousStats[key] !== value) {
        card.classList.add('is-updated');
        window.setTimeout(function () {
          card.classList.remove('is-updated');
        }, 220);
      }

      element.textContent = value;
    });

    previousStats = stats;
  }

  function formatBytes(text) {
    const bytes = new Blob([text]).size;

    if (bytes < 1024) {
      return bytes + ' B';
    }

    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1).replace(/\.0$/, '') + ' KB';
    }

    return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '') + ' MB';
  }

  function parseJsonInput() {
    const text = jsonInput.value.trim();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      showError('Invalid JSON', 'Please check the syntax and try again. ' + error.message);
      return undefined;
    }
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeRecords(parsed) {
    if (isPlainObject(parsed)) {
      return [parsed];
    }

    if (Array.isArray(parsed) && parsed.every(isPlainObject)) {
      return parsed;
    }

    throw new Error('JSON must be an object or an array of objects.');
  }

  function collectColumns(records) {
    const columns = [];
    const seen = new Set();

    records.forEach(function (record) {
      Object.keys(record).forEach(function (key) {
        if (!seen.has(key)) {
          seen.add(key);
          columns.push(key);
        }
      });
    });

    return columns;
  }

  function assertNestedValuesAllowed(records, columns, options) {
    if (options.nestedMode !== 'reject') {
      return;
    }

    const hasNestedValue = records.some(function (record) {
      return columns.some(function (column) {
        return isNestedValue(record[column]);
      });
    });

    if (hasNestedValue) {
      throw new Error('Nested objects or arrays were found. Change nested values to JSON string or remove nested data.');
    }
  }

  function quoteIdentifier(identifier, dialect) {
    const safeIdentifier = String(identifier);

    if (dialect === 'mysql') {
      return '`' + safeIdentifier.replace(/`/g, '``') + '`';
    }

    return '"' + safeIdentifier.replace(/"/g, '""') + '"';
  }

  function escapeSqlString(value) {
    return String(value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "''")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
  }

  function isNestedValue(value) {
    return value !== null && typeof value === 'object';
  }

  function formatBoolean(value, dialect) {
    if (dialect === 'mysql' || dialect === 'sqlite') {
      return value ? '1' : '0';
    }

    return value ? 'TRUE' : 'FALSE';
  }

  function formatSqlValue(value, options) {
    if (value === undefined || value === null) {
      return 'NULL';
    }

    if (isNestedValue(value)) {
      if (options.nestedMode === 'reject') {
        throw new Error('Nested objects or arrays were found. Change nested values to JSON string or remove nested data.');
      }

      return "'" + escapeSqlString(JSON.stringify(value)) + "'";
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : 'NULL';
    }

    if (typeof value === 'boolean') {
      return formatBoolean(value, options.dialect);
    }

    return "'" + escapeSqlString(value) + "'";
  }

  function isDateString(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function isDateTimeString(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value);
  }

  function typeForValue(value, options) {
    if (value === null || value === undefined) {
      return 'unknown';
    }

    if (isNestedValue(value)) {
      return 'nested';
    }

    if (typeof value === 'boolean') {
      return 'boolean';
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return 'unknown';
      }

      if (Number.isInteger(value)) {
        return Math.abs(value) > 2147483647 ? 'bigint' : 'int';
      }

      return 'decimal';
    }

    if (options.detectDates && isDateString(value)) {
      return 'date';
    }

    if (options.detectDates && isDateTimeString(value)) {
      return 'datetime';
    }

    return String(value).length > 255 ? 'text' : 'varchar';
  }

  function mergeType(current, next) {
    if (!current || current === 'unknown') {
      return next;
    }

    if (next === 'unknown' || current === next) {
      return current;
    }

    if ((current === 'int' && next === 'bigint') || (current === 'bigint' && next === 'int')) {
      return 'bigint';
    }

    if (['int', 'bigint', 'decimal'].includes(current) && ['int', 'bigint', 'decimal'].includes(next)) {
      return 'decimal';
    }

    if ((current === 'date' && next === 'datetime') || (current === 'datetime' && next === 'date')) {
      return 'datetime';
    }

    return 'text';
  }

  function inferColumnType(column, records, options) {
    let inferred = 'unknown';

    records.forEach(function (record) {
      inferred = mergeType(inferred, typeForValue(record[column], options));
    });

    if (inferred === 'unknown') {
      return 'TEXT';
    }

    if (inferred === 'int') {
      return 'INT';
    }

    if (inferred === 'bigint') {
      return 'BIGINT';
    }

    if (inferred === 'decimal') {
      return 'DECIMAL(18,6)';
    }

    if (inferred === 'boolean') {
      return 'BOOLEAN';
    }

    if (inferred === 'varchar') {
      return 'VARCHAR(255)';
    }

    if (inferred === 'nested') {
      if (options.dialect === 'mysql') {
        return 'JSON';
      }

      if (options.dialect === 'postgres') {
        return 'JSONB';
      }

      return 'TEXT';
    }

    if (inferred === 'date') {
      return 'DATE';
    }

    if (inferred === 'datetime') {
      return options.dialect === 'postgres' ? 'TIMESTAMP' : 'DATETIME';
    }

    return 'TEXT';
  }

  function generateCreateTableSql(tableName, columns, records, options) {
    const quotedTable = quoteIdentifier(tableName, options.dialect);
    const lines = columns.map(function (column) {
      return '  ' + quoteIdentifier(column, options.dialect) + ' ' + inferColumnType(column, records, options);
    });

    if (options.primaryKey && columns.includes(options.primaryKey)) {
      lines.push('  PRIMARY KEY (' + quoteIdentifier(options.primaryKey, options.dialect) + ')');
    }

    return 'CREATE TABLE ' + quotedTable + ' (\n' + lines.join(',\n') + '\n);';
  }

  function generateInsertSql(tableName, columns, records, options) {
    const quotedTable = quoteIdentifier(tableName, options.dialect);
    const quotedColumns = columns.map(function (column) {
      return quoteIdentifier(column, options.dialect);
    }).join(', ');

    if (records.length === 0) {
      return '';
    }

    if (options.insertStyle === 'multiple') {
      return records.map(function (record) {
        const values = columns.map(function (column) {
          return formatSqlValue(record[column], options);
        }).join(', ');

        return 'INSERT INTO ' + quotedTable + ' (' + quotedColumns + ')\nVALUES (' + values + ');';
      }).join('\n\n');
    }

    const rows = records.map(function (record) {
      const values = columns.map(function (column) {
        return formatSqlValue(record[column], options);
      }).join(', ');

      return '(' + values + ')';
    });

    return 'INSERT INTO ' + quotedTable + ' (' + quotedColumns + ') VALUES\n' + rows.join(',\n') + ';';
  }

  function countSqlStatements(sql) {
    if (!sql.trim()) {
      return 0;
    }

    return sql.split(';').filter(function (part) {
      return part.trim().length > 0;
    }).length;
  }

  function populatePrimaryKey(columns) {
    const previousValue = primaryKeySelect.value;

    primaryKeySelect.innerHTML = '<option value="">None</option>';
    columns.forEach(function (column) {
      const option = document.createElement('option');
      option.value = column;
      option.textContent = column;
      primaryKeySelect.appendChild(option);
    });

    if (columns.includes(previousValue)) {
      primaryKeySelect.value = previousValue;
    }
  }

  function getOptions() {
    return {
      dialect: dialectSelect.value,
      outputType: outputTypeSelect.value,
      insertStyle: insertStyleSelect.value,
      nestedMode: nestedModeSelect.value,
      detectDates: detectDatesInput.checked,
      primaryKey: primaryKeySelect.value
    };
  }

  function validateTableName(tableName) {
    if (!TABLE_NAME_PATTERN.test(tableName)) {
      throw new Error('Use only letters, numbers, and underscores. The first character must be a letter or underscore.');
    }
  }

  function convertToSql() {
    clearError();

    if (!jsonInput.value.trim()) {
      sqlOutput.value = '';
      populatePrimaryKey([]);
      resetStats();
      converterShell.classList.remove('has-output');
      return;
    }

    const parsed = parseJsonInput();

    if (parsed === undefined) {
      sqlOutput.value = '';
      resetStats();
      converterShell.classList.remove('has-output');
      return;
    }

    const tableName = tableNameInput.value.trim();
    const options = getOptions();

    try {
      validateTableName(tableName);
      const records = normalizeRecords(parsed);
      const columns = collectColumns(records);
      populatePrimaryKey(columns);
      options.primaryKey = primaryKeySelect.value;
      assertNestedValuesAllowed(records, columns, options);

      if (columns.length === 0) {
        throw new Error('No columns found. Add at least one property to the JSON object.');
      }

      const sqlParts = [];

      if (options.outputType === 'create' || options.outputType === 'both') {
        sqlParts.push(generateCreateTableSql(tableName, columns, records, options));
      }

      if (options.outputType === 'insert' || options.outputType === 'both') {
        sqlParts.push(generateInsertSql(tableName, columns, records, options));
      }

      const sql = sqlParts.join('\n\n');
      sqlOutput.value = sql;
      converterShell.classList.toggle('has-output', sql.length > 0);
      updateStats({
        records: records.length,
        columns: columns.length,
        statements: countSqlStatements(sql),
        inputSize: formatBytes(jsonInput.value)
      });
    } catch (error) {
      sqlOutput.value = '';
      converterShell.classList.remove('has-output');
      showError('Conversion error', error.message);
      resetStats();
    }
  }

  function parseForJsonTool() {
    clearError();

    try {
      return JSON.parse(jsonInput.value);
    } catch (error) {
      showError('Invalid JSON', 'Please check the syntax and try again. ' + error.message);
      return undefined;
    }
  }

  function formatJson() {
    if (!jsonInput.value.trim()) {
      return;
    }

    const parsed = parseForJsonTool();

    if (parsed !== undefined) {
      jsonInput.value = JSON.stringify(parsed, null, 2);
      convertToSql();
    }
  }

  function minifyJson() {
    if (!jsonInput.value.trim()) {
      return;
    }

    const parsed = parseForJsonTool();

    if (parsed !== undefined) {
      jsonInput.value = JSON.stringify(parsed);
      convertToSql();
    }
  }

  function loadSample() {
    jsonInput.value = JSON.stringify(SAMPLE_JSON, null, 2);
    tableNameInput.value = 'users';
    outputTypeSelect.value = 'both';
    dialectSelect.value = 'mysql';
    insertStyleSelect.value = 'single';
    nestedModeSelect.value = 'json';
    detectDatesInput.checked = false;
    convertToSql();
    jsonInput.focus();
  }

  function fallbackCopy() {
    sqlOutput.focus();
    sqlOutput.select();

    try {
      document.execCommand('copy');
    } catch (error) {
      console.warn('Copy fallback failed.', error);
    }
  }

  async function copySql() {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(sqlOutput.value);
      } catch (error) {
        fallbackCopy();
      }
    } else {
      fallbackCopy();
    }

    window.clearTimeout(copyResetTimer);
    copyButton.textContent = 'Copied!';
    copyResetTimer = window.setTimeout(function () {
      copyButton.textContent = 'Copy SQL';
    }, COPY_RESET_DELAY);
  }

  function selectAllSql() {
    sqlOutput.focus();
    sqlOutput.select();
  }

  function downloadSql() {
    const blob = new Blob([sqlOutput.value], {
      type: 'application/sql;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'converted.sql';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    jsonInput.value = '';
    sqlOutput.value = '';
    clearError();
    populatePrimaryKey([]);
    resetStats();
    converterShell.classList.remove('has-output');
    jsonInput.focus();
  }

  function handleKeyboardShortcuts(event) {
    const isConvertShortcut = (event.ctrlKey || event.metaKey) && event.key === 'Enter';

    if (isConvertShortcut) {
      event.preventDefault();
      convertToSql();
    }
  }

  convertButton.addEventListener('click', convertToSql);
  copyButton.addEventListener('click', copySql);
  downloadButton.addEventListener('click', downloadSql);
  selectAllButton.addEventListener('click', selectAllSql);
  formatButton.addEventListener('click', formatJson);
  minifyButton.addEventListener('click', minifyJson);
  sampleButton.addEventListener('click', loadSample);
  clearButton.addEventListener('click', clearAll);
  themeToggle.addEventListener('click', toggleTheme);
  document.addEventListener('keydown', handleKeyboardShortcuts);

  [tableNameInput, outputTypeSelect, dialectSelect, insertStyleSelect, nestedModeSelect, primaryKeySelect, detectDatesInput].forEach(function (control) {
    control.addEventListener('change', function () {
      if (jsonInput.value.trim()) {
        convertToSql();
      }
    });
  });

  jsonInput.addEventListener('input', function () {
    if (!jsonInput.value.trim()) {
      clearError();
      sqlOutput.value = '';
      populatePrimaryKey([]);
      resetStats();
      converterShell.classList.remove('has-output');
    }
  });

  applyTheme(getPreferredTheme());
  resetStats();
})();
