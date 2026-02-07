This is a translation of the actual C code in Redis (7.2) which does the float
-> string conversion.
Strconv does a close enough job, but we can use the exact same logic, so why not.
