## Some tips on Debian Packaging

- Debian New Maintainers' Guide [http://www.debian.org/doc/debian-policy/]
- Debian Policy Manual [http://www.debian.org/doc/manuals/maint-guide/]
- Machine-readable debian/copyright file [http://dep.debian.net/deps/dep5/]
- DebSrc 3.0 guidelines [https://wiki.debian.org/Projects/DebSrc3.0]


## Build using dpkg-buildpackage:

```bash
$ dpkg-buildpackage -d -tc
  -d   # do not check build dependencies and conflicts.
  -tc  # clean source tree when finished.
```


## Update changelog:

```bash
$ date -R
```

One can also install `devscripts` package and run:

```bash
$ dch -i
```


## Check packages:

```bash
$ dpkg -c *.deb
$ lintian *.deb
```


## TODO

Make it perfect!
