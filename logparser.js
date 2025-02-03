#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Global variable to hold the unfiltered records
let recordSet = [];
const options = parseArgs();
const filePath = options.filename;

// If help or required options (-k and filename) are missing, print help and exit.
if (options.help || !options.filename || !options.keyword) {
  printHelp();
  process.exit(0);
}

// ==================================================================
// 1. Command-line arguments parser
// ==================================================================
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    keyword: null,
    jsonBeautified: false,  // -J option
    jsonPlain: false,       // -j option
    csvFormat: false,       // -c option for CSV-format output
    asTable: false,         // -t option for table output
    subkeyword: null,       // -s option (only include records that contain this key)
    listOfWords: [],        // -l option (keys to include in the output)
    discardFull: false,     // -d option for full duplicate filtering
    discardKeys: [],        // -D option: composite duplicate filtering keys
    help: false,            // -h option for help message
    filename: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-k':
        options.keyword = args[++i];
        break;
      case '-J':
        options.jsonBeautified = true;
        break;
      case '-j':
        options.jsonPlain = true;
        break;
      case '-c':
        options.csvFormat = true;
        break;
      case '-t':
        options.asTable = true;
        break;
      case '-s':
        options.subkeyword = args[++i];
        break;
      case '-l':
        options.listOfWords = args[++i]
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        break;
      case '-d':
        options.discardFull = true;
        break;
      case '-D':
        options.discardKeys = args[++i]
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        break;
      case '-h':
        options.help = true;
        break;
      default:
        if (!options.filename) {
          options.filename = args[i];
        }
        break;
    }
  }
  return options;
}

// ==================================================================
// 2. Print help message and usage instructions
// ==================================================================
function printHelp() {
  const execName = path.basename(process.argv[1]);
  console.log(`Usage: ${execName} -k <keyword> [options] <filename>

Options:
  -k <keyword>         (Required) Specify the keyword that triggers the start of a record.
  -J                   Print beautified (pretty-printed) JSON.
  -j                   Print plain (compact) JSON.
  -c                   Print output in CSV format.
  -t                   Display output in a table.
  -s <subkeyword>      Only include records that contain the specified key.
  -l <key1,key2,...>   Only include the listed keys in the output. (Spaces after commas allowed)
  -d                   Discard duplicate records (full object comparison).
  -D <key1,key2,...>   Discard records that have duplicate values for the specified keys.
  -h                   Print this help message.

Notes:
  • A record is recognized only when a line (after trimming) starts with the specified keyword (-k).
  • When parsing JSON objects, they must be in a beautified (multi-line) format.
  • The parser assumes one key/value pair per line; multiple pairs on one line may not be parsed correctly.
  • This tool uses only Node.js built-in modules and has no external dependencies.
`);
}

// ==================================================================
// 3. Helper functions for parsing values, objects, and arrays
// ==================================================================
function filterValue(value) {
  value = value.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.substring(1, value.length - 1);
  }
  if (!isNaN(Number(value))) return Number(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function splitTopLevel(str) {
  let parts = [];
  let current = "";
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';
  for (let i = 0; i < str.length; i++) {
    let ch = str[i];
    if (inQuotes) {
      current += ch;
      if (ch === quoteChar) inQuotes = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuotes = true;
      quoteChar = ch;
      current += ch;
      continue;
    }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim() !== "") parts.push(current.trim());
  return parts;
}

function parseValue(str) {
  str = str.trim();
  if (str.startsWith('{')) return parseObject(str);
  else if (str.startsWith('[')) return parseArray(str);
  else return filterValue(str);
}

function parseObject(str) {
  let inner = str.trim();
  if (inner.startsWith('{')) inner = inner.substring(1);
  if (inner.endsWith('}')) inner = inner.substring(0, inner.lastIndexOf('}'));
  inner = inner.trim();
  if (inner === "") return {};
  let parts = splitTopLevel(inner);
  let obj = {};
  for (let part of parts) {
    let colonIndex = part.indexOf(':');
    if (colonIndex === -1) continue;
    let key = part.substring(0, colonIndex).trim();
    let valueStr = part.substring(colonIndex + 1).trim();
    if (
      (key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))
    ) {
      key = key.substring(1, key.length - 1);
    }
    obj[key] = parseValue(valueStr);
  }
  return obj;
}

function parseArray(str) {
  let inner = str.trim();
  if (inner.startsWith('[')) inner = inner.substring(1);
  if (inner.endsWith(']')) inner = inner.substring(0, inner.lastIndexOf(']'));
  inner = inner.trim();
  if (inner === "") return [];
  let parts = splitTopLevel(inner);
  let arr = [];
  for (let part of parts) {
    arr.push(parseValue(part));
  }
  return arr;
}

// ==================================================================
// 4. Main function: read file, collect record blocks, parse records,
//    then (if filtering options are used) push the results to a temporary array
//    before outputting in the chosen format.
// ==================================================================
async function main(filePath) {
  try {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    // 4.1 Collect complete record blocks.
    let recordBlocks = [];
    let currentBlock = "";
    let recordStarted = false;
    let braceDepth = 0;
    for await (let line of rl) {
      // Look for the keyword that signals the start of a record.
      if (!recordStarted && options.keyword && line.startsWith(options.keyword)) {
        recordStarted = true;
        // Find the first '{' on the line.
        let idx = line.indexOf('{');
        if (idx !== -1) {
          currentBlock = line.substring(idx);
          // Initialize depth based on this line.
          for (let ch of currentBlock) {
            if (ch === '{') braceDepth++;
            else if (ch === '}') braceDepth--;
          }
        }
      } else if (recordStarted) {
        // Append subsequent lines.
        currentBlock += "\n" + line;
        for (let ch of line) {
          if (ch === '{') braceDepth++;
          else if (ch === '}') braceDepth--;
        }
      }
      // If a record block is complete (brace count returns to zero), push it.
      if (recordStarted && braceDepth === 0) {
        recordBlocks.push(currentBlock);
        currentBlock = "";
        recordStarted = false;
      }
    }

    // 4.2 Parse each record block into an object.
    for (let block of recordBlocks) {
      let rec = parseObject(block);
      if (options.subkeyword && !(options.subkeyword in rec)) continue;
      recordSet.push(rec);
    }

    // 4.3 Now push the result to a temporary array before applying filtering.
    let filteredRecords = recordSet.slice();

    // If duplicate filtering is requested with -d, do full-object duplicate filtering.
    if (options.discardFull) {
      const seenFull = new Set();
      filteredRecords = filteredRecords.filter(rec => {
        const recStr = JSON.stringify(rec);
        if (seenFull.has(recStr)) return false;
        seenFull.add(recStr);
        return true;
      });
    }

    // If composite duplicate filtering is requested with -D, process only consecutive duplicates.
    if (options.discardKeys.length > 0) {
      let temp = [];
      let prevComposite = null;
      for (let rec of filteredRecords) {
        if (options.discardKeys.every(k => rec.hasOwnProperty(k))) {
          const composite = options.discardKeys.map(k => rec[k]).join("|");
          if (composite !== prevComposite) {
            temp.push(rec);
          }
          prevComposite = composite;
        } else {
          temp.push(rec);
          prevComposite = null;
        }
      }
      filteredRecords = temp;
    }

    // If projection (-l) is used, limit the keys.
    // (We now assume that if -l is used, we want only the specified keys.)
    if (options.listOfWords.length > 0) {
      // Note: Do not add "lineNumber" automatically now.
      filteredRecords = filteredRecords.map(rec => {
        let filtered = {};
        for (let key of options.listOfWords) {
          if (rec.hasOwnProperty(key)) filtered[key] = rec[key];
        }
        return filtered;
      });
    }

    // 4.4 Output the filtered array using the chosen output format.
    if (options.csvFormat) {
      outputCSV(filteredRecords);
    } else if (options.jsonBeautified) {
      console.log(JSON.stringify(filteredRecords, null, 2));
    } else if (options.jsonPlain) {
      console.log(JSON.stringify(filteredRecords));
    } else if (options.asTable) {
      console.table(filteredRecords);
    } else {
      console.log(filteredRecords);
    }

  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
  }
}

// ==================================================================
// 5. Helper: Output records in CSV format.
// ==================================================================
function outputCSV(records) {
  if (records.length === 0) return;
  let keys = [];
  if (options.listOfWords.length > 0) {
    keys = options.listOfWords;
  } else {
    keys = Object.keys(records[0]);
  }
  // Build header row.
  let csv = keys.map(k => `"${k}"`).join(",") + "\n";
  for (let rec of records) {
    let row = keys.map(k => {
      let val = rec[k] !== undefined ? rec[k] : "";
      if (typeof val === 'string') return `"${val}"`;
      return val;
    }).join(",");
    csv += row + "\n";
  }
  console.log(csv);
}

main(filePath);
