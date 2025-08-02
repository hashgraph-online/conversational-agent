const { PassThrough } = require('stream');

class ThreadStream extends PassThrough {
  constructor(opts) {
    super();
    this.unref = () => {};
    this.worker = { terminate: () => {} };
  }
  
  end(cb) {
    super.end();
    if (cb) cb();
    return this;
  }
  
  flush(cb) {
    if (cb) cb();
    return this;
  }
  
  flushSync() {
    return this;
  }
}

class ThreadStream2 extends ThreadStream {
  constructor(opts) {
    super(opts);
  }
}

module.exports = ThreadStream;
module.exports.ThreadStream = ThreadStream;
module.exports.ThreadStream2 = ThreadStream2;
module.exports.default = ThreadStream;

ThreadStream.ThreadStream2 = ThreadStream2;