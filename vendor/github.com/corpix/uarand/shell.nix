let
  nixpkgs = builtins.fetchTarball {
    url    = "https://github.com/nixos/nixpkgs/archive/03050e9749e1548f1648aae5c062c954eaad546e.tar.gz";
    sha256 = "00hfkldmf853ynnd8a9d7a778ifcrdjxdndxyykzbpxfki5s5qsb";
  };
in with import nixpkgs {};
stdenv.mkDerivation {
  name = "nix-shell";
  buildInputs = [
    go
  ];
  shellHook = ''
    unset GOPATH
  '';
}
