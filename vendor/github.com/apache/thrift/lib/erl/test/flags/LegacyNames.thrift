enum Numberz
{
  ONE = 1,
  TWO,
  THREE,
  FIVE = 5,
  SIX,
  EIGHT = 8
}

const Numberz myNumberz = Numberz.ONE;

struct CapitalizedStruct
{
  1: i32 Id,
  2: binary message
}

struct ListCapitalizedStructs
{
  1: list<CapitalizedStruct> structs
}

exception Xception {
  1: i32 errorCode,
  2: binary message
}

service LegacyNames
{
  ListCapitalizedStructs Names(1: CapitalizedStruct foo, 2: CapitalizedStruct bar)
    throws(1: Xception err)
}