#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');

let recordSet = [];
const options = parseArgs();
const filePath = options.filename;

// ==================================================================
// 1. Command‐line arguments parser
// ==================================================================
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    keyword: null,
    // New options: -J for beautified JSON, -j for plain JSON.
    jsonBeautified: false,
    jsonPlain: false,
    subkeyword: null,
    listOfWords: [],
    filename: null,
    asTable: false,
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
        options.listOfWords = args[++i].split(',');
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
// 2. A helper to “filter” a value string into an appropriate type.
//    (If the value is quoted, we return a string; if it looks like a
//    number, we convert it; otherwise we try booleans.)
// ==================================================================
function filterValue(value) {
  value = value.trim();
  // If it is surrounded by quotes, return it as a string.
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
  // Otherwise, return the raw string.
  return value;
}

// ==================================================================
// 3. A function to split a string on commas that are at the “top‐level”.
//    (That is, commas not contained inside braces, brackets, or quotes.)
// ==================================================================
function splitTopLevel(str) {
  let parts = [];
  let current = "";
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';
  for (let i = 0; i < str.length; i++) {
    let ch = str[i];

    // If inside a quoted string, just append until the matching quote.
    if (inQuotes) {
      current += ch;
      if (ch === quoteChar) {
        inQuotes = false;
      }
      continue;
    }
    // If a quote starts, note it.
    if (ch === '"' || ch === "'") {
      inQuotes = true;
      quoteChar = ch;
      current += ch;
      continue;
    }

    // Adjust depth if we see an opening or closing brace/bracket.
    if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
    }
    // If we see a comma at top level, that’s a separator.
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
// 4. Recursive parser functions that take a block (string) and return
//    the corresponding object, array or simple value.
// ==================================================================

// Determines what to do based on the first non-whitespace character.
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

// Parse an object block. We assume the string starts with '{' and ends
// with the matching '}'.
function parseObject(str) {
  // Remove the outer braces.
  let inner = str.trim();
  if (inner.startsWith('{')) {
    inner = inner.substring(1);
  }
  if (inner.endsWith('}')) {
    inner = inner.substring(0, inner.lastIndexOf('}'));
  }
  inner = inner.trim();
  if (inner === "") return {};

  // Split on commas at the top level.
  let parts = splitTopLevel(inner);
  let obj = {};
  for (let part of parts) {
    // Look for the first colon.
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

// Parse an array block. We assume the string starts with '[' and ends with
// the matching ']'.
function parseArray(str) {
  // Remove the outer brackets.
  let inner = str.trim();
  if (inner.startsWith('[')) {
    inner = inner.substring(1);
  }
  if (inner.endsWith(']')) {
    inner = inner.substring(0, inner.lastIndexOf(']'));
  }
  inner = inner.trim();
  if (inner === "") return [];
  // Split on top-level commas.
  let parts = splitTopLevel(inner);
  let arr = [];
  for (let part of parts) {
    arr.push(parseValue(part));
  }
  return arr;
}

// ==================================================================
// 5. The main function that reads the file line-by-line, collects each
//    record’s block, and then uses the above parser to build an object.
// ==================================================================
async function main(filePath) {
  try {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    // We'll accumulate complete record blocks.
    let recordBlocks = [];
    let currentBlock = "";
    let recordStarted = false;
    let braceDepth = 0; // count of unmatched '{'
    
    for await (let line of rl) {
      // Look for the keyword indicating the start of a record.
      if (!recordStarted && options.keyword && line.startsWith(options.keyword)) {
        recordStarted = true;
        // Find the first "{" on the line.
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
        // Append the line to the current block.
        currentBlock += "\n" + line;
        for (let ch of line) {
          if (ch === '{') braceDepth++;
          else if (ch === '}') braceDepth--;
        }
      }
      
      // If we have started a record and the brace count returns to 0,
      // we assume the record is complete.
      if (recordStarted && braceDepth === 0) {
        recordBlocks.push(currentBlock);
        currentBlock = "";
        recordStarted = false;
      }
    }

    // Now parse each record block.
    for (let block of recordBlocks) {
      let rec = parseObject(block);
      // If the -s (subkeyword) option is provided, only keep records
      // that have that key.
      if (options.subkeyword && !(options.subkeyword in rec)) continue;
      // If a list of words was provided, filter out other keys.
      if (options.listOfWords.length > 0) {
        let filtered = {};
        for (let key of options.listOfWords) {
          if (key in rec) filtered[key] = rec[key];
        }
        recordSet.push(filtered);
      } else {
        recordSet.push(rec);
      }
    }

    // ==================================================================
    // 6. Output the results based on the selected options.
    // -J: Beautified JSON (pretty-printed)
    // -j: Plain JSON
    // -t: Table format
    // Default: Just log the object.
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
