struct Simple {
  1: string value
}

struct Complex {
  1: Simple struct_field
  2: list<Simple> struct_list_field
  3: set<Simple> struct_set_field
  4: map<string,Simple> struct_map_field
  5: list<set<map<string,list<Simple>>>> struct_nested_containers_field
  6: map<string, list<map<string,Simple>> > struct_nested_containers_field2
  7: list<list<string>> list_of_list_field
  8: list<list<list<string>>> list_of_list_of_list_field
}

struct ComplexList {
  1: list<Complex> struct_list_field;
}
