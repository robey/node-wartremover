bunyan = require "bunyan"
should = require "should"
stream = require "stream"
util = require "util"

wartremover = require "../lib/wartremover"

# simple writable stream that collects all incoming data and provides it in a single (combined) buffer.
class SinkStream extends stream.Writable
  constructor: (options) ->
    super(options)
    @buffers = []

  _write: (chunk, encoding, callback) ->
    @buffers.push chunk
    callback()

  # combine all received data into a buffer and return it. may be called multiple times.
  getBuffer: ->
    Buffer.concat(@buffers)


DIM = "\u001b[38;5;102m"
OFF = "\u001b[39m"
FAKE_TIME = "2014-12-30T04:20:00.000Z"

describe "wartremover", ->
  it "generates strings", (done) ->
    wart = new wartremover.WartRemover()
    sink = new SinkStream()
    wart.pipe(sink)
    log = bunyan.createLogger(name: "test", streams: [ { level: "trace", stream: wart } ])
    log.info({ time: FAKE_TIME }, "Hello.")
    wart.end()
    sink.on "finish", ->
      sink.getBuffer().toString().should.eql "#{DIM}[20141230-04:20:00.000]#{OFF} #{DIM}INF#{OFF} test: Hello.\n"
      done()

  it "can be told not to use color", (done) ->
    wart = new wartremover.WartRemover(color: false)
    sink = new SinkStream()
    wart.pipe(sink)
    log = bunyan.createLogger(name: "test", streams: [ { level: "trace", stream: wart } ])
    log.info({ time: FAKE_TIME }, "Hello.")
    wart.end()
    sink.on "finish", ->
      sink.getBuffer().toString().should.eql "[20141230-04:20:00.000] INF test: Hello.\n"
      done()

  it "can be trained to stringify odd json objects", (done) ->
    stringifyRequest = (req) ->
      "url=#{req.url} method=#{req.method} code=#{req.responseCode}"
    wart = new wartremover.WartRemover(color: false, stringifiers: { req: stringifyRequest })
    sink = new SinkStream()
    wart.pipe(sink)
    log = bunyan.createLogger(name: "test", streams: [ { level: "trace", stream: wart } ])
    log.debug({ time: FAKE_TIME, req: { method: "GET", url: "/lamp", responseCode: "200" } }, "Okay.")
    wart.end()
    sink.on "finish", ->
      sink.getBuffer().toString().should.eql "[20141230-04:20:00.000] DEB test: Okay. url=/lamp method=GET code=200\n"
      done()

