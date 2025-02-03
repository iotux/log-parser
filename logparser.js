#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const path = require('path'); // Added to get the base name of the executable

let recordSet = [];
const options = parseArgs();

// If the help option is provided or if no filename or keyword is given, print help and exit.
if (options.help || !options.filename || !options.keyword) {
  printHelp();
  process.exit(0);
}

const filePath = options.filename;

// ==================================================================
// 1. Command‐line arguments parser
// ==================================================================
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    keyword: null,
    jsonBeautified: false,  // -J option
    jsonPlain: false,       // -j option
    subkeyword: null,       // -s option
    listOfWords: [],        // -l option
    discardFull: false,     // -d option to discard full duplicate records
    discardKeys: [],        // -D option: comma-separated list of keys to compare
    help: false,            // -h option
    asTable: false,         // -t option
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
  const execName = path.basename(process.argv[1]); // Only the file name (not the full path)
  console.log(`Usage: ${execName} -k <keyword> [options] <filename>

Options:
  -k <keyword>         (Required) Specify the keyword that triggers the start of a record.
  -J                   Print JSON output in beautified (pretty-printed) format.
  -j                   Print JSON output in plain (compact) format.
  -t                   Display output as a table.
  -s <subkeyword>      Only include records that contain the specified key.
  -l <key1,key2,...>   Only include the listed keys in the output. Commas may be followed by spaces.
  -d                   Discard duplicate records (full object comparison).
  -D <key1,key2,...>   Discard records that have duplicate values for the specified keys.
  -h                   Print this help message.

Notes:
  • A record is recognized only when a line starts with the specified keyword (-k).
  • When parsing JSON objects, they must be in a beautified (multi-line) format.
  • The parser assumes one key/value pair per line; multiple pairs on one line may not be parsed correctly.
  • This tool uses only Node.js built-in modules and has no external dependencies.
`);
}

// ==================================================================
// 3. A helper to “filter” a value string into an appropriate type.
// ==================================================================
function filterValue(value) {
  value = value.trim();
  // If the value is surrounded by quotes, return it as a string.
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.substring(1, value.length - 1);
  }
  // If the value can be converted to a number, do so.
  if (!isNaN(Number(value))) {
    return Number(value);
  }
  // Check for booleans.
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

// ==================================================================
// 4. A function to split a string on commas that are at the “top‐level”.
// ==================================================================
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
      if (ch === quoteChar) {
        inQuotes = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuotes = true;
      quoteChar = ch;
      current += ch;
      continue;
    }
    if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
    }
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim() !== "") {
    parts.push(current.trim());
  }
  return parts;
}

// ==================================================================
// 5. Recursive parser functions that take a block (string) and return
//    the corresponding object, array or simple value.
// ==================================================================
function parseValue(str) {
  str = str.trim();
  if (str.startsWith('{')) {
    return parseObject(str);
  } else if (str.startsWith('[')) {
    return parseArray(str);
  } else {
    return filterValue(str);
  }
}

function parseObject(str) {
  let inner = str.trim();
  if (inner.startsWith('{')) {
    inner = inner.substring(1);
  }
  if (inner.endsWith('}')) {
    inner = inner.substring(0, inner.lastIndexOf('}'));
  }
  inner = inner.trim();
  if (inner === "") return {};

  let parts = splitTopLevel(inner);
  let obj = {};
  for (let part of parts) {
    let colonIndex = part.indexOf(':');
    if (colonIndex === -1) continue;
    let key = part.substring(0, colonIndex).trim();
    let valueStr = part.substring(colonIndex + 1).trim();
    // Remove quotes from keys if present.
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
  if (inner.startsWith('[')) {
    inner = inner.substring(1);
  }
  if (inner.endsWith(']')) {
    inner = inner.substring(0, inner.lastIndexOf(']'));
  }
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
// 6. The main function: reads the file line-by-line, collects each record's
//    block, and then uses the parser functions to build objects.
// ==================================================================
async function main(filePath) {
  try {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    // Accumulate complete record blocks.
    let recordBlocks = [];
    let currentBlock = "";
    let recordStarted = false;
    let braceDepth = 0;
    
    for await (let line of rl) {
      if (!recordStarted && options.keyword && line.startsWith(options.keyword)) {
        recordStarted = true;
        let idx = line.indexOf('{');
        if (idx !== -1) {
          currentBlock = line.substring(idx);
          for (let ch of currentBlock) {
            if (ch === '{') braceDepth++;
            else if (ch === '}') braceDepth--;
          }
        }
      } else if (recordStarted) {
        currentBlock += "\n" + line;
        for (let ch of line) {
          if (ch === '{') braceDepth++;
          else if (ch === '}') braceDepth--;
        }
      }
      
      if (recordStarted && braceDepth === 0) {
        recordBlocks.push(currentBlock);
        currentBlock = "";
        recordStarted = false;
      }
    }

    // Prepare sets for duplicate filtering.
    const fullDuplicates = new Set();
    const compositeDuplicates = new Set();

    // Parse each record block.
    for (let block of recordBlocks) {
      let rec = parseObject(block);
      if (options.subkeyword && !(options.subkeyword in rec)) continue;
      if (options.listOfWords.length > 0) {
        let filtered = {};
        for (let key of options.listOfWords) {
          if (key in rec) filtered[key] = rec[key];
        }
        rec = filtered;
      }
      // Discard full duplicate objects.
      if (options.discardFull) {
        const recStr = JSON.stringify(rec);
        if (fullDuplicates.has(recStr)) continue;
        fullDuplicates.add(recStr);
      }
      // Discard objects based on duplicate key values.
      if (options.discardKeys.length > 0) {
        const compositeKey = options.discardKeys.map(k => rec[k] !== undefined ? rec[k] : "").join("|");
        if (compositeDuplicates.has(compositeKey)) continue;
        compositeDuplicates.add(compositeKey);
      }
      recordSet.push(rec);
    }

    // ==================================================================
    // 7. Output the results based on the selected options.
    // ==================================================================
    if (options.jsonBeautified) {
      console.log(JSON.stringify(recordSet, null, 2));
    } else if (options.jsonPlain) {
      console.log(JSON.stringify(recordSet));
    } else if (options.asTable) {
      console.table(recordSet);
    } else {
      console.log(recordSet);
    }

  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
  }
}

main(filePath);
