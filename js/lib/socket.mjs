// Wrapper for NodeJS TCP Sockets in a WebSocket-y interface
import { Event, EventTarget } from './event_target.mjs';
import net from 'net';

export class Socket extends EventTarget {
  constructor(url) {
    super();

    const [host, port] = url.split(':');

    this.socket = new net.Socket();
    this.socket.on('data', (data) => {
      let evt = new Event('message');
      evt.data = data.toString();
      this.dispatchEvent(evt);
    });

    this.socket.on('close', () => {
      let evt = new Event('close');
      this.dispatchEvent(evt);
    });

    this.socket.connect(port|0, host);
  }

  send(data) {
    this.socket.write(data);
  }

  close() {
    this.socket.end();
  }
}
