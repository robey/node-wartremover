"use strict";

import clicolor from "clicolor";
import sprintf from "sprintf";
import stream from "stream";

const cli = clicolor();

// "2014-12-30T00:11:17.713Z" -> "[20141230-00:11:17.713]"
function formatDate(date) {
  if (date instanceof Date) date = date.toISOString();
  return "[" + date.slice(0, 4) + date.slice(5, 7) + date.slice(8, 10) + "-" + date.slice(11, 23) + "]";
}

function levelString(level) {
  return {
    10: "TRACE",
    20: "DEBUG",
    30: "INFO",
    40: "WARNING",
    50: "ERROR",
    60: "FATAL"
  }[level];
}

// remove any control chars. unicode may stay, for now.
function clean(s) {
  return s.replace(/[\u0000-\u001f]/g, (m) => sprintf("\\x%02x", m.charCodeAt(0)));
}

function format(record, stringifiers = {}, headerFields = {}, useColor) {
  let date = formatDate(record.time);
  let levelName = levelString(record.level).slice(0, 3);
  delete record.v;
  delete record.time;
  delete record.level;

  // ignore: pid, hostname
  delete record.pid;
  delete record.hostname;

  let name = record.name;
  delete record.name;
  let messages = [ clean(record.msg) ];
  delete record.msg;

  let source = "";
  if (record.src && record.src.file) {
    if (record.src.func) {
      source = `(${record.src.file}:${record.src.line} in ${record.src.func}) `;
    } else {
      source = `(${record.src.file}:${record.src.line}) `;
    }
    source = cli.color("green", source);
    delete rec.src;
  }

  if (record.err && record.err.stack) {
    messages = messages.concat(record.err.stack.split("\n").filter(line => line.length > 0));
    delete record.err;
  }

  // leftover keys are user-defined
  let headers = "";
  Object.keys(record).sort().forEach(key => {
    let value = record[key];
    if (stringifiers[key]) {
      value = stringifiers[key](value);
      if (value != null) {
        if (headerFields[key]) {
          headers += " " + value;
        } else {
          messages[0] += " " + value;
        }
      }
    } else {
      if (typeof(value) != "string") value = JSON.stringify(value);
      if (headerFields[key]) {
        headers += ` ${key}=${value}`;
      } else {
        messages[0] += ` ${key}=${value}`;
      }
    }
  });

  // colorize
  if (useColor && [ "TRA", "DEB", "INF" ].indexOf(levelName) >= 0) {
    date = cli.color("dim", date).toString();
    levelName = cli.color("dim", levelName).toString();
  }
  let lines = messages.map(line => `${date} ${levelName} ${source}${name}${headers}: ${line}`);
  if (useColor) {
    if (levelName == "WAR") lines = lines.map(line => cli.color("warning", line).toString());
    if (levelName == "ERR") lines = lines.map(line => cli.color("error", line).toString());
  }
  return lines.join("\n") + "\n";
}


export default class WartRemover extends stream.Transform {
  constructor(options = {}) {
    super({ objectMode: true });
    this.buffer = "";
    if (options.color == null) options.color = true;
    if (options.stringifiers == null) options.stringifiers = {};
    cli.useColor(options.color);
    this.stringifiers = options.stringifiers;
    this.headerFields = {};
    if (options.headerFields) options.headerFields.forEach(f => this.headerFields[f] = true);
    this.useColor = options.color;
  }

  _transform(chunk, encoding, callback) {
    if (typeof chunk == "object") {
      // make a shallow copy, so we don't mess up other streams.
      const obj = {};
      for (let k in chunk) obj[k] = chunk[k];
      this.process(obj);
      callback();
      return;
    }
    const lines = (this.buffer + chunk.toString()).split("\n");
    this.buffer = lines.pop();
    lines.forEach((line) => this.process(line));
    callback();
  }

  _flush(callback) {
    if (this.buffer.length > 0) this.process(this.buffer);
    this.buffer = "";
    callback();
  }

  process(line) {
    let record = null;
    try {
      if (typeof line == "object") {
        record = line;
      } else {
        record = JSON.parse(line);
      }
    } catch (error) {
      // not json.
      this.push(new Buffer(line));
      return;
    }
    this.push(new Buffer(format(record, this.stringifiers, this.headerFields, this.useColor)));
  }
}
