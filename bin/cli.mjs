#!/usr/bin/node --experimental-modules
import config from '../js/config.mjs';
import { Socket } from '../js/lib/socket.mjs';
import { CCClient } from '../js/client/cc_client.mjs';
import { CCUser } from '../js/client/cc_user.mjs';
import { CCBroadcastEvent } from '../js/client/cc_events.mjs';
import readline from 'readline';

if (!process.stdout.isTTY) {
  console.error(`${process.argv[1]} cannot be run non-interactively.`);
  process.exit(1);
}

let ws = process.stdout.getWindowSize();
process.stdout.on('resize', function() {
  ws = process.stdout.getWindowSize();
  set_up_screen();
});
set_up_screen();

const cc = new CCClient();
const sock = new Socket(`${config.host}:${config.port}`);

cc.socket = sock;
cc.connect();

const input = readline.createInterface({
  input: process.stdin,
  output: null
});

input.prompt(true);

input.on('line', (line) => {
  process.stdout.write(`\x1b[H`);             // Go to origin
  process.stdout.write(`\x1b[2K`);            // Erase line

  let m = line.match(/^\/nick (.+)/);
  if (m) {
    cc.nickname = m[1];
  } else {
    if (cc.nickname) {
      cc.send(`30|^1${line.trim()}`);
    } else {
      cc.dispatchEvent(new CCBroadcastEvent(new CCUser('3ChatServer,local'), 1, 'You must join the chat before sending messages'));
    }
  }

  input.prompt(true);
}).on('close', () => {
  if (cc.nickname) {
    cc.send('15');
  }

  sock.close();

  process.stdout.write(`\x1b[H`);             // Go to absolute origin
  process.stdout.write(`\x1b[2J`);            // Erase page down
  process.exit(0);
});


cc.addEventListener('broadcast', (evt) => {
  const {user, msgType, message} = evt.detail;

  switch (msgType) {
    case 2:
      add_line(`\x1b[1;32m\\\\\\\\\\ ${get_colour(user.level)}[${user.nickname}]\x1b[m ${message} \x1b[1;32m/////\x1b[m`);
      break;

    case 3:
      add_line(`\x1b[1;32m///// ${get_colour(user.level)}[${user.nickname}]\x1b[m ${message} \x1b[1;32m\\\\\\\\\\\x1b[m`);
      break;

    case 4:
      add_line(`\x1b[1;33m** ${user.nickname} ${message}*\x1b[m`);
      break;

    default:
      add_line(`${get_colour(user.level)}[${user.nickname}]\x1b[m ${message}`);
      break;
  }
});


function set_up_screen() {
  process.stdout.write(`\x1b[?6l`);           // Origin mode: absolute top
  process.stdout.write(`\x1b[?7h`);           // Autowrap mode: on
  process.stdout.write(`\x1b[H`);             // Go to absolute origin
  process.stdout.write(`\x1b[2J`);            // Erase page down
  process.stdout.write(`\x1b[?4h`);           // Smooth scroll: on
  process.stdout.write(`\x1b[3;${ws[1]}r`);   // Set scroll region: 3...height
  process.stdout.write(`\x1b[B`);             // Down one line
  process.stdout.write(`\x1b(0`);             // Switch to graphics mode
  process.stdout.write('q'.repeat(ws[0]));    // Draw a solid horizontal line
  process.stdout.write(`\x1b(B`);             // Switch to ANSI mode
  process.stdout.write(`\x1b[H`);             // Go to absolute origin
  process.stdout.write(`\x1b[2K`);            // Clear the line
}

function add_line(line) {
  const length = textlen(line);
  const lines = Math.ceil(length / ws[0]);

  process.stderr.write(`Line: ${line}\n\tLength: ${length}\n\tLines: ${lines}\n`);

  process.stdout.write(`\x1b7`);              // Save cursor position
  process.stdout.write(`\x1b[3;1H`);          // Set cursor to line 3
  process.stdout.write(`\x1b[${lines}L`);     // Insert new lines
  process.stdout.write(line);                 // Write the text
  process.stdout.write(`\x1b8`);              // Restore cursor position
}


function get_colour(level) {
  switch (level) {
    case 0:   return `\x1b[1;37m`;  // white
    case 1:   return `\x1b[1;36m`;  // cyan
    case 2:   return `\x1b[1;32m`;  // green
    case 4:   return `\x1b[1;33m`;  // gold
    default:  return `\x1b[1;31m`;  // red
  }
}

/**
 * Count the number of visible output characters in a line.
 *
 * This must handle both UTF8 multi-byte characters as well as ANSI escape
 * sequences.
 */
function textlen(line) {
  const utf8_chars = ucs2decode(line);
  let counter = 0;

  for (let i = 0; i < utf8_chars.length; ++i) {
    if (utf8_chars[i] == '\x1b') {
      while (utf8_chars[i] != 'm') {
        i++;
      }
    } else {
      counter++;
    }
  }

  return counter;
}

/**
 * Creates an array containing the numeric code points of each Unicode
 * character in the string. While JavaScript uses UCS-2 internally,
 * this function will convert a pair of surrogate halves (each of which
 * UCS-2 exposes as separate characters) into a single code point,
 * matching UTF-16.
 * @see `punycode.ucs2.encode`
 * @see <https://mathiasbynens.be/notes/javascript-encoding>
 * @memberOf punycode.ucs2
 * @name decode
 * @param {String} string The Unicode input string (UCS-2).
 * @returns {Array} The new array of code points.
 */
function ucs2decode(string) {
  const output = [];
  let counter = 0;
  const length = string.length;
  while (counter < length) {
    const value = string.charCodeAt(counter++);
    if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
      // It's a high surrogate, and there is a next character.
      const extra = string.charCodeAt(counter++);
      if ((extra & 0xFC00) == 0xDC00) { // Low surrogate.
        output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
      } else {
        // It's an unmatched surrogate; only append this code unit, in case the
        // next code unit is the high surrogate of a surrogate pair.
        output.push(value);
        counter--;
      }
    } else {
      output.push(value);
    }
  }
  return output;
}
