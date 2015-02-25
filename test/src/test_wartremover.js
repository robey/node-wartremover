const bunyan = require("bunyan");
const should = require("should");
const stream = require("stream");
const wartremover = require("../../lib/wartremover");
const util = require("util");


// simple writable stream that collects all incoming data and provides it in a single (combined) buffer.
class SinkStream extends stream.Writable {
  constructor(options = {}) {
    super(options);
    this.buffers = [];
  }

  _write(chunk, encoding, callback) {
    this.buffers.push(chunk);
    callback();
  }

  // combine all received data into a buffer and return it. may be called multiple times.
  getBuffer() {
    return Buffer.concat(this.buffers);
  }
}


const DIM = "\u001b[38;5;102m";
const OFF = "\u001b[39m";
const FAKE_TIME = "2014-12-30T04:20:00.000Z";

describe("wartremover", () => {
  it("generates strings", (done) => {
    const wart = new wartremover.WartRemover();
    const sink = new SinkStream();
    wart.pipe(sink);
    const log = bunyan.createLogger({ name: "test", streams: [ { level: "trace", stream: wart } ] });
    log.info({ time: FAKE_TIME }, "Hello.");
    wart.end();
    sink.on("finish", () => {
      sink.getBuffer().toString().should.eql(`${DIM}[20141230-04:20:00.000]${OFF} ${DIM}INF${OFF} test: Hello.\n`);
      done();
    });
  });

  it("can be told not to use color", (done) => {
    const wart = new wartremover.WartRemover({ color: false });
    const sink = new SinkStream();
    wart.pipe(sink);
    const log = bunyan.createLogger({ name: "test", streams: [ { level: "trace", stream: wart } ] });
    log.info({ time: FAKE_TIME }, "Hello.");
    wart.end();
    sink.on("finish", () => {
      sink.getBuffer().toString().should.eql("[20141230-04:20:00.000] INF test: Hello.\n");
      done();
    });
  });

  it("can be trained to stringify odd json objects", (done) => {
    function stringifyRequest(req) {
      return `url=${req.url} method=${req.method} code=${req.responseCode}`;
    };
    function dropEggs(eggs) { return null; }

    const wart = new wartremover.WartRemover({ color: false, stringifiers: { req: stringifyRequest, eggs: dropEggs } });
    const sink = new SinkStream();
    wart.pipe(sink);
    const log = bunyan.createLogger({ name: "test", streams: [ { level: "trace", stream: wart } ] });
    log.debug({ time: FAKE_TIME, req: { method: "GET", url: "/lamp", responseCode: "200" }, eggs: 10 }, "Okay.");
    wart.end();
    sink.on("finish", () => {
      sink.getBuffer().toString().should.eql("[20141230-04:20:00.000] DEB test: Okay. url=/lamp method=GET code=200\n");
      done();
    });
  });
});
