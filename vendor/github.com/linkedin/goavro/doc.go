/*
Package goavro is a library that encodes and decodes Avro data.

Goavro provides methods to encode native Go data into both binary and textual
JSON Avro data, and methods to decode both binary and textual JSON Avro data to
native Go data.

Goavro also provides methods to read and write Object Container File (OCF)
formatted files, and the library contains example programs to read and write OCF
files.

Usage Example:

    package main

    import (
        "fmt"

        "github.com/linkedin/goavro"
    )

    func main() {
        codec, err := goavro.NewCodec(`
            {
              "type": "record",
              "name": "LongList",
              "fields" : [
                {"name": "next", "type": ["null", "LongList"], "default": null}
              ]
            }`)
        if err != nil {
            fmt.Println(err)
        }

        // NOTE: May omit fields when using default value
        textual := []byte(`{"next":{"LongList":{}}}`)

        // Convert textual Avro data (in Avro JSON format) to native Go form
        native, _, err := codec.NativeFromTextual(textual)
        if err != nil {
            fmt.Println(err)
        }

        // Convert native Go form to binary Avro data
        binary, err := codec.BinaryFromNative(nil, native)
        if err != nil {
            fmt.Println(err)
        }

        // Convert binary Avro data back to native Go form
        native, _, err = codec.NativeFromBinary(binary)
        if err != nil {
            fmt.Println(err)
        }

        // Convert native Go form to textual Avro data
        textual, err = codec.TextualFromNative(nil, native)
        if err != nil {
            fmt.Println(err)
        }

        // NOTE: Textual encoding will show all fields, even those with values that
        // match their default values
        fmt.Println(string(textual))
        // Output: {"next":{"LongList":{"next":null}}}
    }
*/
package goavro
