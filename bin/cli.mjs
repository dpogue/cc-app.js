#!/usr/bin/node --experimental-modules
import config from '../js/config.mjs';
import { Socket } from '../js/lib/socket.mjs';
import { CCClient } from '../js/client/cc_client.mjs';
import { CCUser } from '../js/client/cc_user.mjs';
import { CCBroadcastEvent } from '../js/client/cc_events.mjs';
import URL_REGEX from '../js/lib/url_regex.mjs';
import readline from 'readline';

if (!process.stdout.isTTY || !process.stdin.isTTY) {
  console.error(`${process.argv[1]} cannot be run non-interactively.`);
  process.exit(1);
}

const host = process.argv[2] || config.host;
const port = process.argv[3] || config.port;

var history = [];
var scroll_pos = 0;
var buffer = [];
var buf_idx = 0;

let ws = process.stdout.getWindowSize();

process.on('beforeExit', cleanup);
process.on('SIGINT', cleanup);
process.on('uncaughtException', cleanup);

process.stdout.on('resize', function() {
  ws = process.stdout.getWindowSize();
  set_up_screen();
});

process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.setRawMode(true);

readline.emitKeypressEvents(process.stdin);

process.stdin.on('end', cleanup);
process.stdin.on('keypress', (str, key) => {
  if (str === '\x03' || str === '\x04') {
    cleanup();
    return;
  }

  if (str === '\r' || str === '\n' || str === '\r\n') {
    process_input(buffer.join(''));

    buffer.length = 0;
    buf_idx = 0;
    print_buffer();
    return;
  }

  if (str === '\x7F' || str === '\x08') {
    buffer.splice(--buf_idx, 1);
    print_buffer();
    return;
  }

  if (key.sequence === '\x1b[D') { // Left arrow
    if (buf_idx > 0) {
      buf_idx--;
      process.stdout.write(`\x1b[D`);
    }
    return;
  }

  if (key.sequence === `\x1b[C`) { // Right arrow
    if (buf_idx < buffer.length) {
      buf_idx++;
      process.stdout.write(`\x1b[C`);
    }
    return;
  }

  // Up & Page Up
  if (key.sequence === `\x1b[5~` || key.sequence === `\x1b[A`) {
    if (scroll_pos > 0) {
      scroll_pos--;
      add_line(history[history.length - 1 - scroll_pos]);
    }
    return;
  }

  // Down & Page Down
  if (key.sequence === `\x1b[6~` || key.sequence === `\x1b[B`) {
    if (scroll_pos < history.length - 1) {
      // Get the height of the current top line item
      const length = textlen(history[history.length - 1 - scroll_pos]);
      const lines = Math.ceil(length / ws[0]);

      process.stdout.write(`\x1b7`);              // Save cursor position
      process.stdout.write(`\x1b[3;1H`);          // Set cursor to line 3
      process.stdout.write(`\x1b[${lines}S`);     // Delete N lines

      scroll_pos++;

      if (history.length > ws[1]) {
        let lnoff = ws[1] - lines + 1;
        process.stdout.write(`\x1b[${lnoff};1H`);   // Set cursor to line N

        let start = history.length - 1 - scroll_pos - lnoff + 3;
        let lncount = 0;
        while (start >= 0 && lncount < lines) {
          lncount += Math.ceil(textlen(history[start]) / ws[0]);
          process.stdout.write(history[start--]);       // Write the text

          process.stdout.write(`\x1b[${lnoff+lncount};1H`);   // Set cursor to line N
        }
      }

      process.stdout.write(`\x1b8`);              // Restore cursor position

    }
    return;
  }

  buffer.splice(buf_idx++, 0, str);
  if (buf_idx === buffer.length) {
    process.stdout.write(str);
  } else {
    print_buffer();
  }
});

set_up_screen();

const cc = new CCClient();
const sock = new Socket(`${host}:${port}`);

cc.socket = sock;
cc.connect();

cc.addEventListener('broadcast', (evt) => {
  let {user, msgType, message} = evt.detail;

  if (cc.version >= 5) {
    // Look for <url> and <url|text>
    message = message.replace(/<([^\|]+)(?:\|([^>]+))?>/ig, (match, p0, p1) => {
      if (p0.match(URL_REGEX)) {
        return `\x1b]8;;${p0}\x07${p1 || p0}\x1b]8;;\x07`;
      }

      return match;
    });
  } else if (message.match(URL_REGEX)) {
    message = message.replace(URL_REGEX, `\x1b]8;;$&\x07$&\x1b]8;;\x07`);
  }

  switch (msgType) {
    case 2:
      history.push(`\x1b[1;32m\\\\\\\\\\ ${get_colour(user.level)}[${user.nickname}]\x1b[m ${message} \x1b[1;32m/////\x1b[m`);
      break;

    case 3:
      history.push(`\x1b[1;32m///// ${get_colour(user.level)}[${user.nickname}]\x1b[m ${message} \x1b[1;32m\\\\\\\\\\\x1b[m`);
      break;

    case 4:
      history.push(`\x1b[1;33m** ${user.nickname} ${message}*\x1b[m`);
      break;

    default:
      history.push(`${get_colour(user.level)}[${user.nickname}]\x1b[m ${message}`);
      break;
  }

  if (scroll_pos) {
    scroll_pos++;
  } else {
    add_line(history[history.length - 1]);
  }
});


function set_up_screen() {
  process.stdout.write(`\x1b[?1049h`);        // Switch to alternate screen
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

  // Set window title
  process.stdout.write(`\x1b]2;CyanChat\x07`);

  for (let i = Math.max(0, history.length - scroll_pos - ws[1] - 2); i < history.length - scroll_pos; i++) {
    add_line(history[i]);
  }
}

function add_line(line) {
  const length = textlen(line);
  const lines = Math.ceil(length / ws[0]);

  process.stdout.write(`\x1b7`);              // Save cursor position
  process.stdout.write(`\x1b[3;1H`);          // Set cursor to line 3
  process.stdout.write(`\x1b[${lines}T`);     // Insert new lines
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
    if (utf8_chars[i] == 0x1b /*ESC*/) {
      // Are we a colour (ended by "m") or a URL (ended by BEL)?
      // Check the next character to be sure: '[' ? 'm' : BEL
      let endseq = utf8_chars[++i] == 0x5B ? 0x6D : 0x07;
      while (utf8_chars[i] != endseq) {
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


function cleanup(err) {
  if (cc.nickname) {
    cc.send('15');
  }

  sock.close();

  process.stdout.write(`\x1b[H`);             // Go to absolute origin
  process.stdout.write(`\x1b[2J`);            // Erase page down
  process.stdout.write(`\x1b[?1049l`);        // Switch to normal screen

  if (err instanceof Error) {
    console.log(err);
    process.exit(2);
  } else {
    process.exit(0);
  }
}

function print_buffer() {
  process.stdout.write(`\x1b[2K`);            // Erase line
  process.stdout.write(`\r`);                 // Go to start of line
  process.stdout.write(buffer.join(''));      // Print the buffer
  process.stdout.write(`\r`);                 // Go to start of line

  if (buf_idx) {
    process.stdout.write(`\x1b[${buf_idx}C`); // Move forwards in the line
  }
}


function process_input(line) {
  let m = line.match(/^\/nick (.+)/);
  if (m) {
    cc.nickname = m[1];
  } else if (line.match(/^\/part/)) {
    if (cc.nickname) {
      cc.send('15');
    }
  } else if (line.match(/^\/quit/) || line.match(/^\/exit/)) {
    input.close();
  } else {
    if (cc.nickname) {
      cc.send(`30|^1${line.trim()}`);
    } else {
      cc.dispatchEvent(new CCBroadcastEvent(new CCUser('3ChatServer,local'), 1, 'You must join the chat before sending messages'));
    }
  }
}
