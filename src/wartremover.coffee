clicolor = require "clicolor"
sprintf = require "sprintf"
stream = require "stream"
util = require "util"

cli = clicolor.cli()

# "2014-12-30T00:11:17.713Z" -> "[20141230-00:11:17.713]"
formatDate = (date) ->
  "[" + date[0...4] + date[5...7] + date[8...10] + "-" + date[11...23] + "]"

levelString = (level) ->
  {
    10: "TRACE"
    20: "DEBUG"
    30: "INFO"
    40: "WARNING"
    50: "ERROR"
    60: "FATAL"
  }[level]

# remove any control chars. unicode may stay, for now.
clean = (s) ->
  s.replace(/[\u0000-\u001f]/g, (m) -> sprintf("\\x%02x", m.charCodeAt(0)))

format = (record, stringifiers = {}) ->
  date = formatDate(record.time)
  level = levelString(record.level)
  levelName = level[0...3]
  delete record.v
  delete record.time
  delete record.level

  # ignore: pid, hostname
  delete record.pid
  delete record.hostname

  name = record.name
  delete record.name
  messages = [ clean(record.msg) ]
  delete record.msg

  source = ""
  if record.src? and record.src.file?
    if record.src.func?
      source = "(#{record.src.file}:#{record.src.line} in #{record.src.func}) "
    else
      source = "(#{record.src.file}:#{record.src.line}) "
    source = cli.color("green", source)
    delete rec.src

  if record.err? and record.err.stack?
    messages = messages.concat(record.err.stack.split("\n").filter (line) -> line.length > 0)
    delete record.err

  # leftover keys are user-defined
  for key, value of record
    if stringifiers[key]?
      messages[0] += " " + stringifiers[key](value)
    else
      if typeof(value) != "string" then value = JSON.stringify(value)
      messages[0] += " #{key}=#{value}"

  # colorize
  if level in [ "TRACE", "DEBUG", "INFO" ]
    date = cli.color("dim", date).toString()
    levelName = cli.color("dim", levelName).toString()
  lines = messages.map (line) -> "#{date} #{levelName} #{source}#{name}: #{line}"
  if level == "WARNING" then lines = lines.map (line) -> cli.color("warning", line).toString()
  if level == "ERROR" then lines = lines.map (line) -> cli.color("error", line).toString()
  lines.join("\n") + "\n"


class WartRemover extends stream.Transform
  constructor: (options = {}) ->
    super()
    @buffer = ""
    if not options.color? then options.color = true
    if not options.stringifiers? then options.stringifiers = {}
    cli.useColor(options.color)
    @stringifiers = options.stringifiers

  _transform: (chunk, encoding, callback) ->
    lines = (@buffer + chunk.toString()).split("\n")
    @buffer = lines.pop()
    for line in lines then @process(line)
    callback()

  _flush: (callback) ->
    if @buffer.length > 0 then @process(@buffer)
    @buffer = ""
    callback()

  process: (line) ->
    record = null
    try
      record = JSON.parse(line)
    catch error
      # not json.
      @push(new Buffer(line))
      return
    @push(new Buffer(format(record, @stringifiers)))


exports.WartRemover = WartRemover
