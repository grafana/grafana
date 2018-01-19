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
module thrift.util.hashset;

import std.algorithm : joiner, map;
import std.conv : to;
import std.traits : isImplicitlyConvertible, ParameterTypeTuple;
import std.range : ElementType, isInputRange;

struct Void {}

/**
 * A quickly hacked together hash set implementation backed by built-in
 * associative arrays to have something to compile Thrift's set<> to until
 * std.container gains something suitable.
 */
// Note: The funky pointer casts (i.e. *(cast(immutable(E)*)&e) instead of
// just cast(immutable(E))e) are a workaround for LDC 2 compatibility.
final class HashSet(E) {
  ///
  this() {}

  ///
  this(E[] elems...) {
    insert(elems);
  }

  ///
  void insert(Stuff)(Stuff stuff) if (isImplicitlyConvertible!(Stuff, E)) {
    aa_[*(cast(immutable(E)*)&stuff)] = Void.init;
  }

  ///
  void insert(Stuff)(Stuff stuff) if (
    isInputRange!Stuff && isImplicitlyConvertible!(ElementType!Stuff, E)
  ) {
    foreach (e; stuff) {
      aa_[*(cast(immutable(E)*)&e)] = Void.init;
    }
  }

  ///
  void opOpAssign(string op : "~", Stuff)(Stuff stuff) {
    insert(stuff);
  }

  ///
  void remove(E e) {
    aa_.remove(*(cast(immutable(E)*)&e));
  }
  alias remove removeKey;

  ///
  void removeAll() {
    aa_ = null;
  }

  ///
  size_t length() @property const {
    return aa_.length;
  }

  ///
  size_t empty() @property const {
    return !aa_.length;
  }

  ///
  bool opBinaryRight(string op : "in")(E e) const {
    return (e in aa_) !is null;
  }

  ///
  auto opSlice() const {
    // TODO: Implement using AA key range once available in release DMD/druntime
    // to avoid allocation.
    return cast(E[])(aa_.keys);
  }

  ///
  override string toString() const {
    // Only provide toString() if to!string() is available for E (exceptions are
    // e.g. delegates).
    static if (is(typeof(to!string(E.init)) : string)) {
      return "{" ~ to!string(joiner(map!`to!string(a)`(aa_.keys), ", ")) ~ "}";
    } else {
      // Cast to work around Object not being const-correct.
      return (cast()super).toString();
    }
  }

  ///
  override bool opEquals(Object other) const {
    auto rhs = cast(const(HashSet))other;
    if (rhs) {
      return aa_ == rhs.aa_;
    }

    // Cast to work around Object not being const-correct.
    return (cast()super).opEquals(other);
  }

private:
  Void[immutable(E)] aa_;
}

/// Ditto
auto hashSet(E)(E[] elems...) {
  return new HashSet!E(elems);
}

unittest {
  import std.exception;

  auto a = hashSet(1, 2, 2, 3);
  enforce(a.length == 3);
  enforce(2 in a);
  enforce(5 !in a);
  enforce(a.toString().length == 9);
  a.remove(2);
  enforce(a.length == 2);
  enforce(2 !in a);
  a.removeAll();
  enforce(a.empty);
  enforce(a.toString() == "{}");

  void delegate() dg;
  auto b = hashSet(dg);
  static assert(__traits(compiles, b.toString()));
}
