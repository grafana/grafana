namespace cpp apache.thrift.test

exception MyError {
  1: string message
}

service ParentService {
  i32 incrementGeneration()
  i32 getGeneration()
  void addString(1: string s)
  list<string> getStrings()

  binary getDataWait(1: i32 length)
  oneway void onewayWait()
  void exceptionWait(1: string message) throws (2: MyError error)
  void unexpectedExceptionWait(1: string message)
}

service ChildService extends ParentService {
  i32 setValue(1: i32 value)
  i32 getValue()
}
