exception Error {
  1: string desc;
}

service Aggr {
  void addValue(1: i32 value);
  list<i32> getValues() throws (1: Error err);
}
