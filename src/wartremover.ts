import * as stream from "stream"
import { clicolor } from "clicolor";

const cli = clicolor();

interface LogRecord {
  v: number;
  pid: number;
  hostname: string;
  name: string;
  level: number;
  time: string;
  msg: string;

  err?: Error;
  src?: {
    file: string;
    line: number;
    func?: string;
  }
}

// "2014-12-30T00:11:17.713Z" -> "[20141230-00:11:17.713]"
function formatDate(date: Date | string): string {
  if (date instanceof Date) date = date.toISOString();
  return "[" + date.slice(0, 4) + date.slice(5, 7) + date.slice(8, 10) + "-" + date.slice(11, 23) + "]";
}

function levelString(level: number): string {
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
function clean(s: string): string {
  return s.replace(/[\u0000-\u001f]/g, m => hexify(m.charCodeAt(0)));
}

function hexify(n: number): string {
  return "\\u" + ("0000" + n.toString(16)).slice(-2);
}

function format(
  record: LogRecord,
  stringifiers: { [key: string]: (data: any) => (string | null) } = {},
  headerFields: Set<string> = new Set(),
  useColor: boolean
) {
  let date = formatDate(record.time);
  let levelName = levelString(record.level).slice(0, 3);
  delete record.v;
  delete record.time;
  delete record.level;

  // ignore: pid, hostname
  delete record.pid;
  delete record.hostname;

  const name = record.name;
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
    source = cli.color("green", source).toString();
    delete record.src;
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
        if (headerFields.has(key)) {
          headers += " " + value;
        } else {
          messages[0] += " " + value;
        }
      }
    } else {
      if (typeof(value) != "string") value = JSON.stringify(value);
      if (headerFields.has(key)) {
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

export interface WartRemoverOptions {
  color?: boolean;
  stringifiers?: { [key: string]: (data: any) => (string | null) };
  headerFields?: string[];
}

export class WartRemover extends stream.Transform {
  private useColor: boolean;
  private stringifiers: { [key: string]: (data: any) => (string | null) };
  private buffer: string = "";
  private headerFields = new Set<string>();

  constructor(options: WartRemoverOptions = {}) {
    super({ objectMode: true });
    this.buffer = "";
    this.useColor = (options.color === undefined) ? true : options.color;
    this.stringifiers = (options.stringifiers === undefined) ? {} : options.stringifiers;
    if (options.headerFields) options.headerFields.forEach(f => this.headerFields.add(f));
    cli.useColor(this.useColor);
  }

  _transform(chunk: string | Buffer | Object, encoding: string, callback: () => void) {
    if (!(chunk instanceof Buffer) && typeof chunk !== "string") {
      // make a shallow copy, so we don't mess up other streams.
      const obj = {};
      for (const k in chunk) obj[k] = chunk[k];
      this.process(obj);
      return callback();
    }

    const lines = (this.buffer + chunk.toString()).split("\n");
    this.buffer = lines.pop() || "";
    lines.forEach(line => this.process(line));
    callback();
  }

  _flush(callback: () => void) {
    if (this.buffer.length > 0) this.process(this.buffer);
    this.buffer = "";
    callback();
  }

  process(line: string | Object) {
    let record: Object;
    try {
      if (typeof line !== "string") {
        record = line;
      } else {
        record = JSON.parse(line);
      }
    } catch (error) {
      // not json.
      this.push(new Buffer((line || "").toString()));
      return;
    }
    this.push(new Buffer(format(record as LogRecord, this.stringifiers, this.headerFields, this.useColor)));
  }
}
