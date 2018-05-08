# Grafana snap

The purpose is to use [snapcraft](https://github.com/snapcore/snapcraft) to build the grafana as snap package.  

## Requirement

Based on Ubuntu 16.04+, installing snapcraft:

```bash
sudo apt-get update
sudo apt-get install snapcraft
```

## How to build

Run `snapcraft` to build a snap.

```bash
cd snap
snapcraft
```

## How to rebuild

```bash
snapcraft clean; snapcraft
```

## Phantomjs issue for building armhf arch (obsolete)

For armhf, I hit the phantomjs build failed with compiling the grafana,  
and I forked the phantomjs to work around errors by refering this link [2].
After getting a successful compilation of phantomjs, just copy binary  
`bin/phantomjs` to `/usr/bin`.

To fork my works:

```bash
git clone git@github.com:woodrow-shen/phantomjs.git
```
[1] https://tecadmin.net/install-latest-nodejs-npm-on-ubuntu  
[2] https://github.com/aeberhardo/phantomjs-linux-armv6l 
