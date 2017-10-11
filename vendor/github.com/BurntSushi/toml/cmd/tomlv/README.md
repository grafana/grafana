# TOML Validator

If Go is installed, it's simple to try it out:

```bash
go get github.com/BurntSushi/toml/cmd/tomlv
tomlv some-toml-file.toml
```

You can see the types of every key in a TOML file with:

```bash
tomlv -types some-toml-file.toml
```

At the moment, only one error message is reported at a time. Error messages
include line numbers. No output means that the files given are valid TOML, or 
there is a bug in `tomlv`.

Compatible with TOML version
[v0.1.0](https://github.com/mojombo/toml/blob/master/versions/toml-v0.1.0.md)

