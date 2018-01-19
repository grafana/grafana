module thrift_test_common;

import std.stdio;
import thrift.test.ThriftTest_types;

enum ProtocolType {
  binary,
  compact,
  json
}

void writeInsanityReturn(in Insanity[Numberz][UserId] insane) {
  write("{");
  foreach(key1, value1; insane) {
    writef("%s => {", key1);
    foreach(key2, value2; value1) {
      writef("%s => {", key2);
      write("{");
      foreach(key3, value3; value2.userMap) {
        writef("%s => %s, ", key3, value3);
      }
      write("}, ");

      write("{");
      foreach (x; value2.xtructs) {
        writef("{\"%s\", %s, %s, %s}, ",
          x.string_thing, x.byte_thing, x.i32_thing, x.i64_thing);
      }
      write("}");

      write("}, ");
    }
    write("}, ");
  }
  write("}");
}

Insanity[Numberz][UserId] testInsanityReturn;
int[int][int] testMapMapReturn;

static this() {
  testInsanityReturn = {
    Insanity[Numberz][UserId] insane;

    Xtruct hello;
    hello.string_thing = "Hello2";
    hello.byte_thing = 2;
    hello.i32_thing = 2;
    hello.i64_thing = 2;

    Xtruct goodbye;
    goodbye.string_thing = "Goodbye4";
    goodbye.byte_thing = 4;
    goodbye.i32_thing = 4;
    goodbye.i64_thing = 4;

    Insanity crazy;
    crazy.userMap[Numberz.EIGHT] = 8;
    crazy.xtructs ~= goodbye;

    Insanity looney;
    // The C++ TestServer also assigns these to crazy, but that is probably
    // an oversight.
    looney.userMap[Numberz.FIVE] = 5;
    looney.xtructs ~= hello;

    Insanity[Numberz] first_map;
    first_map[Numberz.TWO] = crazy;
    first_map[Numberz.THREE] = crazy;
    insane[1] = first_map;

    Insanity[Numberz] second_map;
    second_map[Numberz.SIX] = looney;
    insane[2] = second_map;
    return insane;
  }();

  testMapMapReturn = {
    int[int] pos;
    int[int] neg;

    for (int i = 1; i < 5; i++) {
      pos[i] = i;
      neg[-i] = -i;
    }

    int[int][int] result;
    result[4] = pos;
    result[-4] = neg;
    return result;
  }();
}
