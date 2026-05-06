<p align="center">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://github.com/FiloSottile/age/blob/main/logo/logo_white.svg">
        <source media="(prefers-color-scheme: light)" srcset="https://github.com/FiloSottile/age/blob/main/logo/logo.svg">
        <img alt="The age logo, a wireframe of St. Peters dome in Rome, with the text: age, file encryption" width="600" src="https://github.com/FiloSottile/age/blob/main/logo/logo.svg">
    </picture>
</p>

[![Go Reference](https://pkg.go.dev/badge/filippo.io/age.svg)](https://pkg.go.dev/filippo.io/age)
[![man page](<https://img.shields.io/badge/age(1)-man%20page-lightgrey>)](https://filippo.io/age/age.1)
[![C2SP specification](https://img.shields.io/badge/%C2%A7%23-specification-blueviolet)](https://age-encryption.org/v1)

age is a simple, modern and secure file encryption tool, format, and Go library.

It features small explicit keys, no config options, and UNIX-style composability.

```
$ age-keygen -o key.txt
Public key: age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
$ tar cvz ~/data | age -r age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p > data.tar.gz.age
$ age --decrypt -i key.txt data.tar.gz.age > data.tar.gz
```

📜 The format specification is at [age-encryption.org/v1](https://age-encryption.org/v1). age was designed by [@Benjojo12](https://twitter.com/Benjojo12) and [@FiloSottile](https://twitter.com/FiloSottile).

📬 Follow the maintenance of this project by subscribing to [Maintainer Dispatches](https://filippo.io/newsletter)!

🦀 An alternative interoperable Rust implementation is available at [github.com/str4d/rage](https://github.com/str4d/rage).

🔑 Hardware PIV tokens such as YubiKeys are supported through the [age-plugin-yubikey](https://github.com/str4d/age-plugin-yubikey) plugin.

✨ For more plugins, implementations, tools, and integrations, check out the [awesome age](https://github.com/FiloSottile/awesome-age) list.

💬 The author pronounces it `[aɡe̞]` [with a hard *g*](https://translate.google.com/?sl=it&text=aghe), like GIF, and is always spelled lowercase.

## Installation

<table>
    <tr>
        <td>Homebrew (macOS or Linux)</td>
        <td>
            <code>brew install age</code>
        </td>
    </tr>
    <tr>
        <td>MacPorts</td>
        <td>
            <code>port install age</code>
        </td>
    </tr>
    <tr>
        <td>Alpine Linux v3.15+</td>
        <td>
            <code>apk add age</code>
        </td>
    </tr>
    <tr>
        <td>Arch Linux</td>
        <td>
            <code>pacman -S age</code>
        </td>
    </tr>
    <tr>
        <td>Debian 12+ (Bookworm)</td>
        <td>
            <code>apt install age</code>
        </td>
    </tr>
    <tr>
        <td>Debian 11 (Bullseye)</td>
        <td>
            <code>apt install age/bullseye-backports</code>
            (<a href="https://backports.debian.org/Instructions/#index2h2">enable backports</a> for age v1.0.0+)
        </td>
    </tr>
    <tr>
        <td>Fedora 33+</td>
        <td>
            <code>dnf install age</code>
        </td>
    </tr>
    <tr>
        <td>Gentoo Linux</td>
        <td>
            <code>emerge app-crypt/age</code>
        </td>
    </tr>
    <tr>
        <td>NixOS / Nix</td>
        <td>
            <code>nix-env -i age</code>
        </td>
    </tr>
    <tr>
        <td>openSUSE Tumbleweed</td>
        <td>
            <code>zypper install age</code>
        </td>
    </tr>
    <tr>
        <td>Ubuntu 22.04+</td>
        <td>
            <code>apt install age</code>
        </td>
    </tr>
    <tr>
        <td>Void Linux</td>
        <td>
            <code>xbps-install age</code>
        </td>
    </tr>
    <tr>
        <td>FreeBSD</td>
        <td>
            <code>pkg install age</code> (security/age)
        </td>
    </tr>
    <tr>
        <td>OpenBSD 6.7+</td>
        <td>
            <code>pkg_add age</code> (security/age)
        </td>
    </tr>
    <tr>
        <td>Chocolatey (Windows)</td>
        <td>
            <code>choco install age.portable</code>
        </td>
    </tr>
    <tr>
        <td>Scoop (Windows)</td>
        <td>
            <code>scoop bucket add extras && scoop install age</code>
        </td>
    </tr>
    <tr>
        <td>pkgx</td>
        <td>
            <code>pkgx install age</code>
        </td>
    </tr>
</table>

On Windows, Linux, macOS, and FreeBSD you can use the pre-built binaries.

```
https://dl.filippo.io/age/latest?for=linux/amd64
https://dl.filippo.io/age/v1.1.1?for=darwin/arm64
...
```

If your system has [a supported version of Go](https://go.dev/dl/), you can build from source.

```
go install filippo.io/age/cmd/...@latest
```

Help from new packagers is very welcome.

### Verifying the release signatures

If you download the pre-built binaries, you can check their
[Sigsum](https://www.sigsum.org) proofs, which are like signatures with extra
transparency: you can cryptographically verify that every proof is logged in a
public append-only log, so you can hold the age project accountable for every
binary release we ever produced. This is similar to what the [Go Checksum
Database](https://go.dev/blog/module-mirror-launch) provides.

```
cat << EOF > age-sigsum-key.pub
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIM1WpnEswJLPzvXJDiswowy48U+G+G1kmgwUE2eaRHZG
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAz2WM5CyPLqiNjk7CLl4roDXwKhQ0QExXLebukZEZFS
EOF
cat << EOF > sigsum-trust-policy.txt
log 154f49976b59ff09a123675f58cb3e346e0455753c3c3b15d465dcb4f6512b0b https://poc.sigsum.org/jellyfish
witness poc.sigsum.org/nisse 1c25f8a44c635457e2e391d1efbca7d4c2951a0aef06225a881e46b98962ac6c
witness rgdd.se/poc-witness  28c92a5a3a054d317c86fc2eeb6a7ab2054d6217100d0be67ded5b74323c5806
group  demo-quorum-rule all poc.sigsum.org/nisse rgdd.se/poc-witness
quorum demo-quorum-rule
EOF

curl -JLO "https://dl.filippo.io/age/v1.2.0?for=darwin/arm64"
curl -JLO "https://dl.filippo.io/age/v1.2.0?for=darwin/arm64&proof"

go install sigsum.org/sigsum-go/cmd/sigsum-verify@v0.8.0
sigsum-verify -k age-sigsum-key.pub -p sigsum-trust-policy.txt \
    age-v1.2.0-darwin-arm64.tar.gz.proof < age-v1.2.0-darwin-arm64.tar.gz
```

You can learn more about what's happening above in the [Sigsum
docs](https://www.sigsum.org/getting-started/).

## Usage

For the full documentation, read [the age(1) man page](https://filippo.io/age/age.1).

```
Usage:
    age [--encrypt] (-r RECIPIENT | -R PATH)... [--armor] [-o OUTPUT] [INPUT]
    age [--encrypt] --passphrase [--armor] [-o OUTPUT] [INPUT]
    age --decrypt [-i PATH]... [-o OUTPUT] [INPUT]

Options:
    -e, --encrypt               Encrypt the input to the output. Default if omitted.
    -d, --decrypt               Decrypt the input to the output.
    -o, --output OUTPUT         Write the result to the file at path OUTPUT.
    -a, --armor                 Encrypt to a PEM encoded format.
    -p, --passphrase            Encrypt with a passphrase.
    -r, --recipient RECIPIENT   Encrypt to the specified RECIPIENT. Can be repeated.
    -R, --recipients-file PATH  Encrypt to recipients listed at PATH. Can be repeated.
    -i, --identity PATH         Use the identity file at PATH. Can be repeated.

INPUT defaults to standard input, and OUTPUT defaults to standard output.
If OUTPUT exists, it will be overwritten.

RECIPIENT can be an age public key generated by age-keygen ("age1...")
or an SSH public key ("ssh-ed25519 AAAA...", "ssh-rsa AAAA...").

Recipient files contain one or more recipients, one per line. Empty lines
and lines starting with "#" are ignored as comments. "-" may be used to
read recipients from standard input.

Identity files contain one or more secret keys ("AGE-SECRET-KEY-1..."),
one per line, or an SSH key. Empty lines and lines starting with "#" are
ignored as comments. Passphrase encrypted age files can be used as
identity files. Multiple key files can be provided, and any unused ones
will be ignored. "-" may be used to read identities from standard input.

When --encrypt is specified explicitly, -i can also be used to encrypt to an
identity file symmetrically, instead or in addition to normal recipients.
```

### Multiple recipients

Files can be encrypted to multiple recipients by repeating `-r/--recipient`. Every recipient will be able to decrypt the file.

```
$ age -o example.jpg.age -r age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p \
    -r age1lggyhqrw2nlhcxprm67z43rta597azn8gknawjehu9d9dl0jq3yqqvfafg example.jpg
```

#### Recipient files

Multiple recipients can also be listed one per line in one or more files passed with the `-R/--recipients-file` flag.

```
$ cat recipients.txt
# Alice
age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
# Bob
age1lggyhqrw2nlhcxprm67z43rta597azn8gknawjehu9d9dl0jq3yqqvfafg
$ age -R recipients.txt example.jpg > example.jpg.age
```

If the argument to `-R` (or `-i`) is `-`, the file is read from standard input.

### Passphrases

Files can be encrypted with a passphrase by using `-p/--passphrase`. By default age will automatically generate a secure passphrase. Passphrase protected files are automatically detected at decrypt time.

```
$ age -p secrets.txt > secrets.txt.age
Enter passphrase (leave empty to autogenerate a secure one):
Using the autogenerated passphrase "release-response-step-brand-wrap-ankle-pair-unusual-sword-train".
$ age -d secrets.txt.age > secrets.txt
Enter passphrase:
```

### Passphrase-protected key files

If an identity file passed to `-i` is a passphrase encrypted age file, it will be automatically decrypted.

```
$ age-keygen | age -p > key.age
Public key: age1yhm4gctwfmrpz87tdslm550wrx6m79y9f2hdzt0lndjnehwj0ukqrjpyx5
Enter passphrase (leave empty to autogenerate a secure one):
Using the autogenerated passphrase "hip-roast-boring-snake-mention-east-wasp-honey-input-actress".
$ age -r age1yhm4gctwfmrpz87tdslm550wrx6m79y9f2hdzt0lndjnehwj0ukqrjpyx5 secrets.txt > secrets.txt.age
$ age -d -i key.age secrets.txt.age > secrets.txt
Enter passphrase for identity file "key.age":
```

Passphrase-protected identity files are not necessary for most use cases, where access to the encrypted identity file implies access to the whole system. However, they can be useful if the identity file is stored remotely.

### SSH keys

As a convenience feature, age also supports encrypting to `ssh-rsa` and `ssh-ed25519` SSH public keys, and decrypting with the respective private key file. (`ssh-agent` is not supported.)

```
$ age -R ~/.ssh/id_ed25519.pub example.jpg > example.jpg.age
$ age -d -i ~/.ssh/id_ed25519 example.jpg.age > example.jpg
```

Note that SSH key support employs more complex cryptography, and embeds a public key tag in the encrypted file, making it possible to track files that are encrypted to a specific public key.

#### Encrypting to a GitHub user

Combining SSH key support and `-R`, you can easily encrypt a file to the SSH keys listed on a GitHub profile.

```
$ curl https://github.com/benjojo.keys | age -R - example.jpg > example.jpg.age
```

Keep in mind that people might not protect SSH keys long-term, since they are revokable when used only for authentication, and that SSH keys held on YubiKeys can't be used to decrypt files.
