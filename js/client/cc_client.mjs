import { EventTarget } from '../lib/event_target.mjs';
import { CCUser } from './cc_user.mjs';
import { CCConnectedEvent, CCDebugEvent, CCBroadcastEvent, CCUserListEvent } from './cc_events.mjs';

const clientData = new WeakMap();
const msgHandlers = Object.create(null);

function parseMessage(client, packet) {
  packet.split('\r\n')
  .filter(line => !!line)
  .map(line => line.split('|'))
  .forEach(([cmd, ...data]) => {
    client.dispatchEvent(new CCDebugEvent(`${cmd}|${data.join('|')}`));

    if (msgHandlers[cmd]) {
      msgHandlers[cmd](client, data);
    }
  });
}


// 10 - S_NAME_NOSET
msgHandlers['10'] = function(client, data) {
  const cdata = clientData.get(client);
  const user = new CCUser('3ChatServer,0');
  client.dispatchEvent(new CCBroadcastEvent(user, 1, `Your nickname "${cdata.get('new_nickname')}" is not valid.`));
  cdata.set('new_nickname', null);
}

// 11 - S_NAME_SET
msgHandlers['11'] = function(client, data) {
  const cdata = clientData.get(client);

  if (data.length) {
    cdata.set('nickname', data[0]);
  } else {
    cdata.set('nickname', cdata.get('new_nickname'));
  }

  cdata.set('new_nickname', null);
}

// 21 - S_SEND_MSG
// TODO

// 31 - S_SEND_ALL
msgHandlers['31'] = function(client, data) {
  const user = new CCUser(data.shift());
  const type = data[0].charAt(1) | 0;
  const msg = data.join('|').substring(2);

  client.dispatchEvent(new CCBroadcastEvent(user, type, msg));
}

// 35 - S_WHO_LIST
msgHandlers['35'] = function(client, data) {
  client.dispatchEvent(new CCUserListEvent(data.map(username => new CCUser(username))));
}

// 40 - S_LOBBY_MSG
msgHandlers['40'] = function(client, data) {
  const cdata = clientData.get(client);
  const user = new CCUser('2ChatServer,0');
  let msg = data.join('|');

  const version = msg.charAt(0);
  if (version > '0' && version < '9') {
    cdata.set('version', version | 0);
    msg = msg.substring(1);
  }

  if (!cdata.get('connected')) {
    cdata.set('connected', true);
    client.dispatchEvent(new CCConnectedEvent(cdata.get('version')));

    const newnick = cdata.get('new_nickname');
    if (newnick) {
      client.sendRaw(`10|${newnick}`);
    }
  }

  client.dispatchEvent(new CCBroadcastEvent(user, 1, msg));
}

// 70 - S_IGNORE
// TODO


export class CCClient extends EventTarget {
  constructor(socket = null) {
    super();

    clientData.set(this, new Map([
      ['version', 0],
      ['connected', false],
      ['nickname', ''],
      ['new_nickname', null],
      ['socket', null]
    ]));

    if (socket) {
      this.socket = socket;
    }
  }


  get connected() {
    return clientData.get(this).get('connected');
  }

  get version() {
    return clientData.get(this).get('version');
  }

  get host() {
    return this.socket && (new URL(this.socket.url)).hostname;
  }

  get port() {
    return this.socket && (new URL(this.socket.url)).port;
  }

  get nickname() {
    return clientData.get(this).get('nickname');
  }

  set nickname(newnick) {
    clientData.get(this).set('new_nickname', newnick);

    if (this.connected) {
      this.sendRaw(`10|${newnick}`);
    }
  }

  get socket() {
    return clientData.get(this).get('socket');
  }

  set socket(socket) {
    if (clientData.get(this).get('socket')) {
      throw new Error('CCClient socket already set');
    }

    socket.addEventListener('message', e => parseMessage(this, e.data));
    clientData.get(this).set('socket', socket);
  }


  connect(version = 5) {
    if (!this.socket) {
      throw new Error('CCClient socket is not set');
    }

    clientData.get(this).set('version', version);
    this.sendRaw(`40|${this.version}`);
  }


  disconnect(close = false) {
    if (this.nickname) {
      this.sendRaw(`15`);
    }

    if (close) {
      this.socket.close();
    }
  }


  sendRaw(msg) {
    if (!this.socket) {
      throw new Error('CCClient socket is not set');
    }

    const packet = msg + '\r\n';
    const sock = this.socket;

    if (sock.postMessage) {
      sock.postMessage(packet);
    } else {
      sock.send(packet);
    }
  }


  sendBroadcast(msg) {
    this.sendRaw(`30|^1${msg}`);
  }


  sendAction(msg) {
    if (this.version >= 2) {
      this.sendRaw(`30|^4${msg}`);
    } else {
      this.sendRaw(`30|^1*${msg}*`);
    }
  }
}
