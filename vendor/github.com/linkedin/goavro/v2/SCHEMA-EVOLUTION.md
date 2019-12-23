From the Avro specification:

    default: A default value for this field, used when reading instances
    that lack this field (optional). Permitted values depend on the
    field's schema type, according to the table below. Default values for
    union fields correspond to the first schema in the union. Default
    values for bytes and fixed fields are JSON strings, where Unicode code
    points 0-255 are mapped to unsigned 8-bit byte values 0-255.  I read
    the above to mean that the purpose of default values are to allow
    reading Avro data that was written without the fields, and not
    necessarily augmentation of data being serialized. So in general I
    agree with you in terms of purpose.

One very important aspect of Avro is that the schema used to serialize
the data should always remain with the data, so that a reader would
always be able to read the schema and then be able to consume the
data.  I think most people still agree so far.

However, this is where things get messy.  Schema evolution is
frequently cited when folks want to use a new version of the schema to
read data that was once written using an older version of that schema.
I do not believe the Avro specification properly handles schema
evolution.  Here's a simple example:

```
Record v0:
    name: string
    nickname: string, default: ""
```

```
Record v1:
    name: string
    nickname: string, default: ""
    title: string, default: ""
```

Okay, now a binary stream of records is just a bunch of strings.  Let's
do that now.

```
0x0A, A, l, i, c, e, 0x06, B, o, b, 0x0A, B, r, u, c, e, 0x0A, S, a, l, l, y, 0x06, A, n, n
```

How many records is that? It could be as many as 5 records, each of a
single name and no nicknames.  It could be as few as 2 records, one of
them with a nickname and a title, and one with only a nickname, or a
title.

Now to drive home the nail that Avro schema evolution is broken, even
if each record had a header that indicated how many bytes it would
consume, we could know where one record began and ended, and how many
records there are.  But if we were to read a record with two strings
in it, is the second string the nickname or the title?

The Avro specification has no answer to that question, so neither do I.

Effectively, Avro could be a great tool for serializing complex data,
but it's broken in its current form, and to fix it would require it to
break compatibility with itself, effectively rendering any binary data
serialized in a previous version of Avro unreadable by new versions,
unless it had some sort of version marker on the data so a library
could branch.

One great solution would be augmenting the binary encoding with a
simple field number identifier.  Let's imagine an Avro 2.x that had
this feature, and would support schema evolution.  Here's an example
stream of bytes that could be unambiguously decoded using the new
schema:

```
0x02, 0x0A, A, l, i, c, e, 0x02, 0x06, B, o, B, 0x04, 0x0A, B, r, u, c, e, 0x02, 0x0C, C, h, a, r, l, i, e, 0x06, 0x04, M, r
```

In the above example of my fake Avro 2.0, this can be
deterministically decoded because 0x02 indicates the following is
field number 1 (name), followed by string length 5, followed by
Alice.

Then the decoder would see 0x02, marking field number 1 again,
which means, "next record", followed by string length 3, followed by
Bob, followed by 0x04, which means field number 2 (nickname), followed
by string length 5, followed by Bruce.  

Followed by field number 1 (next record), followed by string length 6,
followed by Charlie, followed by field number 3 (title), followed by
string length 2, followed by Mr.

In my hypothetical version of Avro 2, Avro can cope with schema
evolution using record defaults and such.  Sadly, Avro 1.x cannot and
thus we should avoid using it if your use-case requires schema
evolution.
