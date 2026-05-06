// module indicates the module's import path.
// For legacy reasons, we allow a missing module
// directory and an empty module directive.
module?: #Module | ""

// #Module constraints a module path.
// TODO encode the module path rules as regexp:
// WIP: (([\-_~a-zA-Z0-9][.\-_~a-zA-Z0-9]*[\-_~a-zA-Z0-9])|([\-_~a-zA-Z0-9]))(/([\-_~a-zA-Z0-9][.\-_~a-zA-Z0-9]*[\-_~a-zA-Z0-9])|([\-_~a-zA-Z0-9]))*
#Module:            =~"^[^@]+$"

// TODO add the rest of the module schema definition.
