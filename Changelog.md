## 1.2.2 (30 mar 2015)

- fixed a bug where wartremover was modifying the log record object, confusing the hell out of other stream processors (now we make a shallow copy before attacking it)

## 1.2.1 (27 mar 2015)

- fixed a bug where errors were not logged as anything useful, just `{}` (by switching to raw mode)

## 1.2.0 (17 mar 2015)

- added `headerFields` option for putting `key=value` fields into the header

## 1.1.0 (25 feb 2015)

- converted from coffee-script to ES6
- a stringifier may return `null` to drop a field from the text line

## 1.0.1 (7 jan 2015)

- update for clicolor 0.9.5's changed API

## 1.0.0 (29 dec 2014)

- start!
