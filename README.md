# NodeJS Log Object Parser

This is a NodeJS command-line tool for parsing log files that contain object literals or JSON objects. It is designed to extract and convert these objects—even those with nested objects and arrays—into a JavaScript object (or array of objects) that you can further process or export.

> **Notes:**
>
> - **Trigger Keyword:**  
>   A keyword (specified with `-k`) must appear at the beginning of a log entry to trigger parsing of an object.
>
> - **Beautified JSON Required:**  
>   When processing JSON objects, they must be in a beautified (multi-line) format. Inline JSON objects may not be parsed correctly.
>
> - **Format Limitations:**  
>   The parser assumes one key/value pair per line for object entries. If your log file groups multiple pairs on one line or deviates from the expected structure, you might need to adjust the parser code accordingly.
>
> - **No External Dependencies:**  
>   This tool uses only Node.js built-in modules (such as `fs` and `readline`).
>
> - **Duplicate Filtering:**  
>   - Use `-d` to discard duplicate records (full object comparison).
>   - Use `-D <key1,key2,...>` to discard objects that have duplicate values for the specified keys.
>     *When providing lists (e.g., with `-l` or `-D`), spaces after commas are allowed.*
>
> - **Required Options:**  
>   Both the filename and the keyword (`-k`) are required. If either is missing, the help message is displayed.

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
  - `-s`: Only output objects containing a specific key.
  - `-l`: Output only a list of selected keys from each object.
- **Duplicate Removal:**  
  - `-d`: Discard duplicate records (using full object comparison).
  - `-D`: Discard records based on duplicate values for the specified keys.
- **Help:**  
  - `-h`: Print a help message with usage instructions.

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
For your convenience, you can copy the program to any location on your **PATH** and rename. Example:

```bash
cp logparser.js ~/bin/logparser
```

## Usage

Run the script with the required options:

```bash
./parser.js -k <keyword> [options] <filename>
```

Or, if you have renamed and copied the program to a **PATH** location:

```bash
logparser -k <keyword> [options] <filename>
```

### Options

- `-k <keyword>`  
  **(Required)** Specify the keyword that triggers the start of a record.
  
- `-J`  
  Print JSON output in beautified (pretty-printed) format.

- `-j`  
  Print JSON output in plain (compact) format.

- `-t`  
  Display output as a table.

- `-s <subkeyword>`  
  Only include records that contain the specified key.

- `-l <key1,key2,...>`  
  Only include the listed keys in the output. (Spaces after commas are allowed.)

- `-d`  
  Discard duplicate records (using full object comparison).

- `-D <key1,key2,...>`  
  Discard records that have duplicate values for the specified keys. (Spaces after commas are allowed.)

- `-h`  
  Print this help message.

If either the filename or the `-k` option is missing, the help message will be displayed.

## Examples

Assume you have a log file `log.txt` with entries like:

```
MyAppLog { 
  isVirgin: false,
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
./parser.js -k "MyAppLog" -l "consumptionToday, productionToday" log.txt
```

### Example 6: Discard Full Duplicate Records

```bash
./parser.js -k "MyAppLog" -d log.txt
```

### Example 7: Discard Records Based on Duplicate Key Values

```bash
./parser.js -k "MyAppLog" -D "consumptionToday, productionToday" log.txt
```

### Example 8: Print Help Message

```bash
./parser.js -h
```

## Contributing

Contributions are welcome! Feel free to fork the repository, open issues, or submit pull requests with improvements and bug fixes.

## License

```text
MIT License

Copyright (c) 2025 iotux

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
