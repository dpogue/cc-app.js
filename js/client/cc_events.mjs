import { CustomEvent } from '../lib/event_target.mjs';

export class CCBroadcastEvent extends CustomEvent {
  constructor(user, msgType, message) {
    super('broadcast', {
      detail: {
        user,
        msgType,
        message
      }
    })
  }
}


export class CCUserListEvent extends CustomEvent {
  constructor(users) {
    super('userlist', { detail: users });
  }
}


export class CCDebugEvent extends CustomEvent {
  constructor(message) {
    super('debug', { detail: message });
  }
}


export class CCConnectedEvent extends CustomEvent {
  constructor(version) {
    super('connected', { detail: version });
  }
}
