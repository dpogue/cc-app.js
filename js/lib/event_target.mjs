const ctx = (typeof global === 'object' && global.global === global && global) || (typeof self === 'object' && self.self === self && self);


let EventObject = ctx.Event;

if (!EventObject) {
  EventObject = function(typeArg) {
    this.type = typeArg;
  };
}


let CustomEventObject = ctx.CustomEvent;

if (!CustomEventObject) {
  CustomEventObject = class extends EventObject {
    constructor(typeArg, opts) {
      super(typeArg);
      this.detail = opts.detail;
    }
  };
}


let EventBase = ctx.EventTarget;

try {
  new EventBase();
} catch(e) {
  const eventData = new WeakMap();

  EventBase = class {
    constructor() {
      eventData.set(this, Object.create(null));
    }

    addEventListener(type, listener, options) {
      const data = eventData.get(this);
      const listeners = data[type] || (data[type] = []);

      if (listener && !listeners.some(info => info.listener === listener)) {
        listeners.push({target: this, listener, options});
      }
    }

    removeEventListener(type, listener, options) {
      const data = eventData.get(this);
      const listeners = data[type] || Array(1);

      for (let i = listeners.length - 1; i >= 0; --i) {
        if (listeners[i] && listeners[i].listener === listener) {
          listeners.splice(i, 1);
          break;
        }
      }
    }

    dispatchEvent(evt) {
      const data = eventData.get(this);
      const listeners = data[evt.type] || [];

      Object.defineProperty(evt, 'currentTarget', { configurable: true, value: this });
      Object.defineProperty(evt, 'target', { configurable: true, value: this });

      listeners.forEach(info => {
        const options = info.options;

        if (typeof options === 'object' && options.once) {
          this.removeEventListener(evt.type, info.listener, info.options);
        }

        if (typeof info.listener === 'function') {
          info.listener.call(info.target, evt);
        } else {
          info.listener.handleEvent(evt);
        }
      });

      delete evt.currentTarget;
      delete evt.target;

      return !evt.defaultPrevented;
    }
  };
}

export { EventObject as Event, CustomEventObject as CustomEvent, EventBase as EventTarget };
