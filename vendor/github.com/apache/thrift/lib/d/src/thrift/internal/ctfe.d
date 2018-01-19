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

module thrift.internal.ctfe;

import std.conv : to;
import std.traits;

/*
 * Simple eager join() for strings, std.algorithm.join isn't CTFEable yet.
 */
string ctfeJoin(string[] strings, string separator = ", ") {
  string result;
  if (strings.length > 0) {
    result ~= strings[0];
    foreach (s; strings[1..$]) {
      result ~= separator ~ s;
    }
  }
  return result;
}

/*
 * A very primitive to!string() implementation for floating point numbers that
 * is evaluatable at compile time.
 *
 * There is a wealth of problems associated with the algorithm used (e.g. 5.0
 * prints as 4.999…, incorrect rounding, etc.), but a better alternative should
 * be included with the D standard library instead of implementing it here.
 */
string ctfeToString(T)(T val) if (isFloatingPoint!T) {
  if (val is T.nan) return "nan";
  if (val is T.infinity) return "inf";
  if (val is -T.infinity) return "-inf";
  if (val is 0.0) return "0";
  if (val is -0.0) return "-0";

  auto b = val;

  string result;
  if (b < 0) {
    result ~= '-';
    b *= -1;
  }

  short magnitude;
  while (b >= 10) {
    ++magnitude;
    b /= 10;
  }
  while (b < 1) {
    --magnitude;
    b *= 10;
  }

  foreach (i; 0 .. T.dig) {
    if (i == 1) result ~= '.';

    auto first = cast(ubyte)b;
    result ~= to!string(first);

    b -= first;
    import std.math;
    if (b < pow(10.0, i - T.dig)) break;
    b *= 10;
  }

  if (magnitude != 0) result ~= "e" ~ to!string(magnitude);
  return result;
}

unittest {
  import std.algorithm;
  static assert(ctfeToString(double.infinity) == "inf");
  static assert(ctfeToString(-double.infinity) == "-inf");
  static assert(ctfeToString(double.nan) == "nan");
  static assert(ctfeToString(0.0) == "0");
  static assert(ctfeToString(-0.0) == "-0");
  static assert(ctfeToString(2.5) == "2.5");
  static assert(ctfeToString(3.1415).startsWith("3.141"));
  static assert(ctfeToString(2e-200) == "2e-200");
}
