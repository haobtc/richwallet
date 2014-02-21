#!/bin/bash

ROOT=$PWD
COINS=(bitcoin litecoin dogecoin)
OSNAME=`uname -s`

if [ $OSNAME == Darwin ]; then
    PLATFORM=osx
else
    PLATFORM=unix
fi

function check_exit() {
    ext=$?
    word=$1
    if [ $ext -ne 0 ]; then
	if [ "coins$word" != "coins" ]; then
	    echo $word >&2
	fi
	exit $ext
    fi
}

function build_bitcoin() {
    if [ ! -x configure ]; then
	./autogen.sh
    fi

    if [ ! -f Makefile ]; then
	./configure --without-gui $BITCOIN_CONFIG
	check_exit
    fi

    make
    check_exit "Compiling failed, please refer to $ROOT/bitcoin/doc/build-$PLATFORM.md"
    mkdir -p ~/.richwallet/bin
    check_exit
    cp -f src/bitcoind ~/.richwallet/bin
    mkdir -p ~/.richwallet/bitcoin
    check_exit
    ln -s ~/.richwallet/bitcoin ~/.bitcoin
    check_exit
}

function build_orig_coin() {
    coin=$1
    cd src
    echo  makefile.$PLATFORM
    make -f makefile.$PLATFORM
    check_exit "Compiling failed, please refer to $ROOT/$coin/doc/build-$PLATFORM.md"

    mkdir -p ~/.richwallet/bin
    check_exit
    cp -f ${coin}d ~/.richwallet/bin
    mkdir -p ~/.richwallet/$coin
    check_exit
    ln -s ~/.richwallet/$coin ~/.$coin
    check_exit
}

function build_litecoin() {
    build_orig_coin litecoin
}

function build_dogecoin() {
    build_orig_coin dogecoin
}

cd $ROOT/..

echo Updating coins ...
if [ ! -d $ROOT/bitcoin ]; then
    git submodule update --init --recursive
fi

for coin in "${COINS[@]}"
do 
    cd $ROOT/$coin
    build_$coin
done 
