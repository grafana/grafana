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

/*
 * Simple helpers for handling typical byte order-related issues.
 */
module thrift.internal.endian;

import core.bitop : bswap;
import std.traits : isIntegral;

union IntBuf(T) {
  ubyte[T.sizeof] bytes;
  T value;
}

T byteSwap(T)(T t) pure nothrow @trusted if (isIntegral!T) {
  static if (T.sizeof == 2) {
    return cast(T)((t & 0xff) << 8) | cast(T)((t & 0xff00) >> 8);
  } else static if (T.sizeof == 4) {
    return cast(T)bswap(cast(uint)t);
  } else static if (T.sizeof == 8) {
    return cast(T)byteSwap(cast(uint)(t & 0xffffffff)) << 32 |
      cast(T)bswap(cast(uint)(t >> 32));
  } else static assert(false, "Type of size " ~ to!string(T.sizeof) ~ " not supported.");
}

T doNothing(T)(T val) { return val; }

version (BigEndian) {
  alias doNothing hostToNet;
  alias doNothing netToHost;
  alias byteSwap hostToLe;
  alias byteSwap leToHost;
} else {
  alias byteSwap hostToNet;
  alias byteSwap netToHost;
  alias doNothing hostToLe;
  alias doNothing leToHost;
}

unittest {
  import std.exception;

  IntBuf!short s;
  s.bytes = [1, 2];
  s.value = byteSwap(s.value);
  enforce(s.bytes == [2, 1]);

  IntBuf!int i;
  i.bytes = [1, 2, 3, 4];
  i.value = byteSwap(i.value);
  enforce(i.bytes == [4, 3, 2, 1]);

  IntBuf!long l;
  l.bytes = [1, 2, 3, 4, 5, 6, 7, 8];
  l.value = byteSwap(l.value);
  enforce(l.bytes == [8, 7, 6, 5, 4, 3, 2, 1]);
}
