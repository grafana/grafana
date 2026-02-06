# Contributing

We would love to have people submit pull requests and help make `grpc-ecosystem/go-grpc-middleware` even better 👍.

Fork, then clone the repo:

```bash
git clone git@github.com:your-username/go-grpc-middleware.git
```

Before submitting a patch, please make sure to run the following make commands to execute the formatting check, regenerate the proto files, and run the tests and linters:

```powershell
make fmt : Run formatting across all go files

make proto : Generate proto files

make test : Run all the tests

make lint : Run linting across all go files
```

One command to rule them all:

```bash
make all
```

This will `lint`, `fmt`, regenerate proto files and documentation and run all tests.

Push to your fork and open a pull request.
