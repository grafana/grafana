service Storage {
  oneway void incr(1: i32 amount);
  i32 get();
}
