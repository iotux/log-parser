# NodeJS Log Object Parser

This is a NodeJS command-line tool for parsing log files that contain object literals or JSON objects. It is designed to extract and convert these objects—even those with nested objects and arrays—into a JavaScript object (or array of objects) that you can further process or export.

> **Note:**  
> - The parser makes some assumptions about the input file:
>   - **Trigger Keyword:** A keyword (specified with `-k`) must appear at the beginning of a log entry to trigger parsing of an object.
>   - **Beautified JSON Required:** When processing JSON objects, the objects must be in a beautified (multi-line) format. Inline JSON objects may not be correctly parsed.
>   - **Format Limitations:** The parser assumes one key/value pair per line for object entries. If your log file groups multiple pairs on one line or deviates from the expected structure, you might need to adjust the parser code accordingly.
> - **No External Dependencies:**  
>   This tool uses only Node.js built-in modules (such as `fs` and `readline`), so there is no need to install any external dependencies.

## Features

- **Recursive Parsing:**  
  Handles nested objects and arrays within the log file.
- **Flexible Key Formats:**  
  Supports both NodeJS-style object literals (unquoted keys) and JSON-style objects (quoted keys).
- **Output Options:**  
  - `-J`: Print beautified (pretty-printed) JSON.
  - `-j`: Print plain JSON.
  - `-t`: Display output in a table format.
- **Filtering:**  
  - Use `-s` to only output objects containing a specific key.
  - Use `-l` to output only a list of selected keys.

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/nodejs-log-object-parser.git
   cd nodejs-log-object-parser
   ```

2. **Ensure you have NodeJS installed.**

3. **Make the script executable (if not already):**

   ```bash
   chmod +x parser.js
   ```

## Usage

Run the script with the required options:

```bash
./parser.js -k <keyword> [options] <filename>
```

### Options

- `-k <keyword>`  
  **(Required)** Specify the keyword that triggers the start of a record.
  
- `-J`  
  Print JSON output in a beautified (pretty-printed) format.

- `-j`  
  Print JSON output in a plain (compact) format.

- `-t`  
  Display output as a table.

- `-s <subkeyword>`  
  Only include records that contain the specified key.

- `-l <word1,word2,...>`  
  Only include the listed keys in the output.

## Examples

Assume you have a log file `log.txt` with entries like:

```javascript
MyAppLog { 
  consumptionToday: 3.297,
  sortedHourlyConsumption: [
    { startTime: "2025-02-03T01:00:00", consumption: 1.6599 },
    { startTime: "2025-02-03T00:00:00", consumption: 1.6104 }
  ],
  productionToday: 0
}
```

### Example 1: Print Beautified JSON

```bash
./parser.js -k "MyAppLog" -J log.txt
```

### Example 2: Print Plain JSON

```bash
./parser.js -k "MyAppLog" -j log.txt
```

### Example 3: Output as a Table

```bash
./parser.js -k "MyAppLog" -t log.txt
```

### Example 4: Filter Records That Contain a Specific Key

```bash
./parser.js -k "MyAppLog" -s "sortedHourlyConsumption" log.txt
```

### Example 5: Output Only Selected Keys

```bash
./parser.js -k "MyAppLog" -l "consumptionToday,productionToday" log.txt
```

## Contributing

Contributions are welcome! Feel free to fork the repository, open issues, or submit pull requests with improvements and bug fixes.

## License

[MIT License](LICENSE)
