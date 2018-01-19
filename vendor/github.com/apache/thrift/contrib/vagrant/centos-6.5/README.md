Apache Thrift Centos 6.5 Vagrant Support
========================================
This directory is the Vagrant project directory for Apache Thrift running on Centos 6.5. The Vagrantfile in this directory configures a Vagrant provisioned VM launched under VirtualBox. To use this project you must have a recent version of VirtualBox and Vagrant installed (in that order). To run the VM, open a shell, clone Apache Thrift, change to this directory and enter the Vagrant up command.

   $ git clone https://github.com/apache/thrift
   $ cd thrift/contrib/vagrant/centos-6.5
   $ vagrant up

This will download and launch the base box VM under VirtualBox and run the Apache Thrift provisioning script. This will take up to an hour depending on your hardware and network. Once complete you can login to the box with Vagrant ssh. The thrift source tree from your host os is mounted at /thrift.

   $ vagrant ssh
   [vagrant@thrift ~]$ cd /thrift
   [vagrant@thrift thrift]$ compiler/cpp/thrift --version
   Thrift version 1.0.0-dev

The provisioning script (inside the Vagrantfile) runs ./bootstrap.sh, ./configure, make and make check, but does not install thrift. To install thrift run "make install".

The Vagrant base box used here is a minimal Centos 6.5 VirtualBox with 2GB RAM and 2 CPUs. For more Vagrant information: https://www.vagrantup.com. A summary of the base box preparation follows:

root password: vagrant

#Create the vagrant user and give it sudo permission
adduser vagrant
passwd vagrant
visudo  :  vagrant ALL=(ALL) NOPASSWD: ALL
           #Defaults requiretty

#Shut down the firewall and disable it
service iptables stop
chkconfig iptables off

#Setup the vagrant ssh public key to allow vagrant to ssh
mkdir /home/vagrant/.ssh
chmod 700 /home/vagrant/.ssh
cd /home/vagrant/.ssh
wget --no-check-certificate 'https://raw.github.com/mitchellh/vagrant/master/keys/vagrant.pub' -O authorized_keys
chmod 600 /home/vagrant/.ssh/authorized_keys
chown -R vagrant /home/vagrant/.ssh

#Install EPEL (Extra Packages for Enterprise Linux) but protect the base
#repositories so that EPEL does not mask base packages
yum -y install yum-plugin-protectbase
rpm -Uvh http://download.fedoraproject.org/pub/epel/6/i386/epel-release-6-8.noarch.rpm

#Install perl, dynamic kernel modules, dev tools and kernel headers to support
#Virtual box additions
yum -y install perl
yum -y --enablerepo epel install dkms
yum -y groupinstall "Development Tools"
yum -y install kernel-devel

#Update everything and reboot
yum update
reboot

#Install the VirtualBox Guest additions (using VirtualBox iso)
mount /dev/cdrom /mnt
/mnt/VBoxLinuxAdditions.run
umount /mnt

See the Vagrantfile for further details
