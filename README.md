
# wartremover

Bunyan writes log records as json, and provides a command-line tool to parse the json and generate pretty, colored text for humans.

Wartremover allows the human-readable text to be generated inside your server code. It's a stream transform that accepts bunyan json logging and writes human-formatted text.

Unlike bunyan, it enforces a "one log entry per line" policy. Every line must be a complete entry, with timestamp and log-level prefix. (An exception is made for stack traces, which are written on multiple lines atomically, but each line will still contain the same prefix.)

Example:

```javascript
var bunyan = require("bunyan");
var wartremover = require("wartremover");

var wart = new wartremover.WartRemover();
wart.pipe(process.stdout);
var log = bunyan.createLogger({ name: "myserver", streams: [ { level: "debug", stream: wart } ]);

log.info("I am writing a debug message!");
```

Sample log line:

```
[20141230-06:21:34.773] INF myserver: I am writing a debug message!
```


## Options

The `WartRemover` class takes an options object in its constructor. The available options are:

- `color`: true/false, whether to use ANSI colors in the output (default: true)

- `stringifiers`: object, a map of log record keys and functions to stringify them. For example, if you add a `req` record to logs like this:

```javascript
log.debug({ req: { method: "GET", url: "/lamp", responseCode: "200" } }, "...");
```

then you can tell WartRemover how to turn the request object into a string by passing:

```javascript
stringifiers: {
  req: function (req) {
    return "url=" + req.url + " method=" + req.method + " code=" + req.responseCode;
  }
}
```


# License

Apache 2 (open-source) license, included in 'LICENSE.txt'.

# Authors

@robey - Robey Pointer <robeypointer@gmail.com>
