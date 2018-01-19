/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
module thrift.base;

/**
 * Common base class for all Thrift exceptions.
 */
class TException : Exception {
  ///
  this(string msg = "", string file = __FILE__, size_t line = __LINE__,
    Throwable next = null)
  {
    super(msg, file, line, next);
  }
}

/**
 * An operation failed because one or more sub-tasks failed.
 */
class TCompoundOperationException : TException {
  ///
  this(string msg, Exception[] exceptions, string file = __FILE__,
    size_t line = __LINE__, Throwable next = null)
  {
    super(msg, file, line, next);
    this.exceptions = exceptions;
  }

  /// The exceptions thrown by the children of the operation. If applicable,
  /// the list is ordered in the same way the exceptions occurred.
  Exception[] exceptions;
}

/// The Thrift version string, used for informative purposes.
// Note: This is currently hardcoded, but will likely be filled in by the build
// system in future versions.
enum VERSION = "0.10.0";

/**
 * Functions used for logging inside Thrift.
 *
 * By default, the formatted messages are written to stdout/stderr, but this
 * behavior can be overwritten by providing custom g_{Info, Error}LogSink
 * handlers.
 *
 * Examples:
 * ---
 * logInfo("An informative message.");
 * logError("Some error occurred: %s", e);
 * ---
 */
alias logFormatted!g_infoLogSink logInfo;
alias logFormatted!g_errorLogSink logError; /// Ditto

/**
 * Error and info log message sinks.
 *
 * These delegates are called with the log message passed as const(char)[]
 * argument, and can be overwritten to hook the Thrift libraries up with a
 * custom logging system. By default, they forward all output to stdout/stderr.
 */
__gshared void delegate(const(char)[]) g_infoLogSink;
__gshared void delegate(const(char)[]) g_errorLogSink; /// Ditto

shared static this() {
  import std.stdio;

  g_infoLogSink = (const(char)[] text) {
    stdout.writeln(text);
  };

  g_errorLogSink = (const(char)[] text) {
    stderr.writeln(text);
  };
}

// This should be private, if it could still be used through the aliases then.
template logFormatted(alias target) {
  void logFormatted(string file = __FILE__, int line = __LINE__,
    T...)(string fmt, T args) if (
    __traits(compiles, { target(""); })
  ) {
    import std.format, std.stdio;
    if (target !is null) {
      scope(exit) g_formatBuffer.clear();

      // Phobos @@BUG@@: If the empty string put() is removed, Appender.data
      // stays empty.
      g_formatBuffer.put("");

      formattedWrite(g_formatBuffer, "%s:%s: ", file, line);

      static if (T.length == 0) {
        g_formatBuffer.put(fmt);
      } else {
        formattedWrite(g_formatBuffer, fmt, args);
      }
      target(g_formatBuffer.data);
    }
  }
}

private {
  // Use a global, but thread-local buffer for constructing log messages.
  import std.array : Appender;
  Appender!(char[]) g_formatBuffer;
}
