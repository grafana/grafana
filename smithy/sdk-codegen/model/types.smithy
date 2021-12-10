namespace grafana

long Long
string String
boolean Bool
timestamp Timestamp
@box
float BoxedFloat
document Document

list LongList {
  member: Long,
}

list StringList {
  member: String,
}

map StringStringMap {
  key: String,
  value: String,
}
