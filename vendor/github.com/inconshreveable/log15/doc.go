/*
Package log15 provides an opinionated, simple toolkit for best-practice logging that is
both human and machine readable. It is modeled after the standard library's io and net/http
packages.

This package enforces you to only log key/value pairs. Keys must be strings. Values may be
any type that you like. The default output format is logfmt, but you may also choose to use
JSON instead if that suits you. Here's how you log:

    log.Info("page accessed", "path", r.URL.Path, "user_id", user.id)

This will output a line that looks like:

     lvl=info t=2014-05-02T16:07:23-0700 msg="page accessed" path=/org/71/profile user_id=9

Getting Started

To get started, you'll want to import the library:

    import log "github.com/inconshreveable/log15"


Now you're ready to start logging:

    func main() {
        log.Info("Program starting", "args", os.Args)
    }


Convention

Because recording a human-meaningful message is common and good practice, the first argument to every
logging method is the value to the *implicit* key 'msg'.

Additionally, the level you choose for a message will be automatically added with the key 'lvl', and so
will the current timestamp with key 't'.

You may supply any additional context as a set of key/value pairs to the logging function. log15 allows
you to favor terseness, ordering, and speed over safety. This is a reasonable tradeoff for
logging functions. You don't need to explicitly state keys/values, log15 understands that they alternate
in the variadic argument list:

    log.Warn("size out of bounds", "low", lowBound, "high", highBound, "val", val)

If you really do favor your type-safety, you may choose to pass a log.Ctx instead:

    log.Warn("size out of bounds", log.Ctx{"low": lowBound, "high": highBound, "val": val})


Context loggers

Frequently, you want to add context to a logger so that you can track actions associated with it. An http
request is a good example. You can easily create new loggers that have context that is automatically included
with each log line:

    requestlogger := log.New("path", r.URL.Path)

    // later
    requestlogger.Debug("db txn commit", "duration", txnTimer.Finish())

This will output a log line that includes the path context that is attached to the logger:

    lvl=dbug t=2014-05-02T16:07:23-0700 path=/repo/12/add_hook msg="db txn commit" duration=0.12


Handlers

The Handler interface defines where log lines are printed to and how they are formated. Handler is a
single interface that is inspired by net/http's handler interface:

    type Handler interface {
        Log(r *Record) error
    }


Handlers can filter records, format them, or dispatch to multiple other Handlers.
This package implements a number of Handlers for common logging patterns that are
easily composed to create flexible, custom logging structures.

Here's an example handler that prints logfmt output to Stdout:

    handler := log.StreamHandler(os.Stdout, log.LogfmtFormat())

Here's an example handler that defers to two other handlers. One handler only prints records
from the rpc package in logfmt to standard out. The other prints records at Error level
or above in JSON formatted output to the file /var/log/service.json

    handler := log.MultiHandler(
        log.LvlFilterHandler(log.LvlError, log.Must.FileHandler("/var/log/service.json", log.JsonFormat())),
        log.MatchFilterHandler("pkg", "app/rpc" log.StdoutHandler())
    )

Logging File Names and Line Numbers

This package implements three Handlers that add debugging information to the
context, CallerFileHandler, CallerFuncHandler and CallerStackHandler. Here's
an example that adds the source file and line number of each logging call to
the context.

    h := log.CallerFileHandler(log.StdoutHandler)
    log.Root().SetHandler(h)
    ...
    log.Error("open file", "err", err)

This will output a line that looks like:

    lvl=eror t=2014-05-02T16:07:23-0700 msg="open file" err="file not found" caller=data.go:42

Here's an example that logs the call stack rather than just the call site.

    h := log.CallerStackHandler("%+v", log.StdoutHandler)
    log.Root().SetHandler(h)
    ...
    log.Error("open file", "err", err)

This will output a line that looks like:

    lvl=eror t=2014-05-02T16:07:23-0700 msg="open file" err="file not found" stack="[pkg/data.go:42 pkg/cmd/main.go]"

The "%+v" format instructs the handler to include the path of the source file
relative to the compile time GOPATH. The github.com/go-stack/stack package
documents the full list of formatting verbs and modifiers available.

Custom Handlers

The Handler interface is so simple that it's also trivial to write your own. Let's create an
example handler which tries to write to one handler, but if that fails it falls back to
writing to another handler and includes the error that it encountered when trying to write
to the primary. This might be useful when trying to log over a network socket, but if that
fails you want to log those records to a file on disk.

    type BackupHandler struct {
        Primary Handler
        Secondary Handler
    }

    func (h *BackupHandler) Log (r *Record) error {
        err := h.Primary.Log(r)
        if err != nil {
            r.Ctx = append(ctx, "primary_err", err)
            return h.Secondary.Log(r)
        }
        return nil
    }

This pattern is so useful that a generic version that handles an arbitrary number of Handlers
is included as part of this library called FailoverHandler.

Logging Expensive Operations

Sometimes, you want to log values that are extremely expensive to compute, but you don't want to pay
the price of computing them if you haven't turned up your logging level to a high level of detail.

This package provides a simple type to annotate a logging operation that you want to be evaluated
lazily, just when it is about to be logged, so that it would not be evaluated if an upstream Handler
filters it out. Just wrap any function which takes no arguments with the log.Lazy type. For example:

    func factorRSAKey() (factors []int) {
        // return the factors of a very large number
    }

    log.Debug("factors", log.Lazy{factorRSAKey})

If this message is not logged for any reason (like logging at the Error level), then
factorRSAKey is never evaluated.

Dynamic context values

The same log.Lazy mechanism can be used to attach context to a logger which you want to be
evaluated when the message is logged, but not when the logger is created. For example, let's imagine
a game where you have Player objects:

    type Player struct {
        name string
        alive bool
        log.Logger
    }

You always want to log a player's name and whether they're alive or dead, so when you create the player
object, you might do:

    p := &Player{name: name, alive: true}
    p.Logger = log.New("name", p.name, "alive", p.alive)

Only now, even after a player has died, the logger will still report they are alive because the logging
context is evaluated when the logger was created. By using the Lazy wrapper, we can defer the evaluation
of whether the player is alive or not to each log message, so that the log records will reflect the player's
current state no matter when the log message is written:

    p := &Player{name: name, alive: true}
    isAlive := func() bool { return p.alive }
    player.Logger = log.New("name", p.name, "alive", log.Lazy{isAlive})

Terminal Format

If log15 detects that stdout is a terminal, it will configure the default
handler for it (which is log.StdoutHandler) to use TerminalFormat. This format
logs records nicely for your terminal, including color-coded output based
on log level.

Error Handling

Becasuse log15 allows you to step around the type system, there are a few ways you can specify
invalid arguments to the logging functions. You could, for example, wrap something that is not
a zero-argument function with log.Lazy or pass a context key that is not a string. Since logging libraries
are typically the mechanism by which errors are reported, it would be onerous for the logging functions
to return errors. Instead, log15 handles errors by making these guarantees to you:

- Any log record containing an error will still be printed with the error explained to you as part of the log record.

- Any log record containing an error will include the context key LOG15_ERROR, enabling you to easily
(and if you like, automatically) detect if any of your logging calls are passing bad values.

Understanding this, you might wonder why the Handler interface can return an error value in its Log method. Handlers
are encouraged to return errors only if they fail to write their log records out to an external source like if the
syslog daemon is not responding. This allows the construction of useful handlers which cope with those failures
like the FailoverHandler.

Library Use

log15 is intended to be useful for library authors as a way to provide configurable logging to
users of their library. Best practice for use in a library is to always disable all output for your logger
by default and to provide a public Logger instance that consumers of your library can configure. Like so:

    package yourlib

    import "github.com/inconshreveable/log15"

    var Log = log.New()

    func init() {
        Log.SetHandler(log.DiscardHandler())
    }

Users of your library may then enable it if they like:

    import "github.com/inconshreveable/log15"
    import "example.com/yourlib"

    func main() {
        handler := // custom handler setup
        yourlib.Log.SetHandler(handler)
    }

Best practices attaching logger context

The ability to attach context to a logger is a powerful one. Where should you do it and why?
I favor embedding a Logger directly into any persistent object in my application and adding
unique, tracing context keys to it. For instance, imagine I am writing a web browser:

    type Tab struct {
        url string
        render *RenderingContext
        // ...

        Logger
    }

    func NewTab(url string) *Tab {
        return &Tab {
            // ...
            url: url,

            Logger: log.New("url", url),
        }
    }

When a new tab is created, I assign a logger to it with the url of
the tab as context so it can easily be traced through the logs.
Now, whenever we perform any operation with the tab, we'll log with its
embedded logger and it will include the tab title automatically:

    tab.Debug("moved position", "idx", tab.idx)

There's only one problem. What if the tab url changes? We could
use log.Lazy to make sure the current url is always written, but that
would mean that we couldn't trace a tab's full lifetime through our
logs after the user navigate to a new URL.

Instead, think about what values to attach to your loggers the
same way you think about what to use as a key in a SQL database schema.
If it's possible to use a natural key that is unique for the lifetime of the
object, do so. But otherwise, log15's ext package has a handy RandId
function to let you generate what you might call "surrogate keys"
They're just random hex identifiers to use for tracing. Back to our
Tab example, we would prefer to set up our Logger like so:

        import logext "github.com/inconshreveable/log15/ext"

        t := &Tab {
            // ...
            url: url,
        }

        t.Logger = log.New("id", logext.RandId(8), "url", log.Lazy{t.getUrl})
        return t

Now we'll have a unique traceable identifier even across loading new urls, but
we'll still be able to see the tab's current url in the log messages.

Must

For all Handler functions which can return an error, there is a version of that
function which will return no error but panics on failure. They are all available
on the Must object. For example:

    log.Must.FileHandler("/path", log.JsonFormat)
    log.Must.NetHandler("tcp", ":1234", log.JsonFormat)

Inspiration and Credit

All of the following excellent projects inspired the design of this library:

code.google.com/p/log4go

github.com/op/go-logging

github.com/technoweenie/grohl

github.com/Sirupsen/logrus

github.com/kr/logfmt

github.com/spacemonkeygo/spacelog

golang's stdlib, notably io and net/http

The Name

https://xkcd.com/927/

*/
package log15
