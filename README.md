<img src="https://100millionbooks.org/img/logo-circular-smaller.png" width="100" />

## What is 100 Million Books?

100 Million Books exists to bring serendipity & unrestricted freedom back to book discovery, just like the old days before algorithms took over with social networks and search engines. [See more here](https://medium.com/@100millionbooks/why-332a1c325299).

To maximize this environment of intellectual freedom, user privacy is a top priority. That's a big reason this source code is open, and we'll continue to open access to other client code bases, server code, and data as we can.

## What does this program do?

Whispers is a desktop client for the 100 Million Books service. It offers discreet notifications of meaningful ideas from random books throughout the day. You'll probably miss most of them, which is intended (we don't want to distract you), but the ones you do notice may open your mind to ideas & inspiration you wouldn't have seen anywhere else.

It's like browsing a bookstore with all the books ever published, right on your laptop, while you go about your day.

## Currently in Beta

This program is currently in beta, meaning it's an early release. Although it's been tested across a number of machines, it may not be very stable.

Please send feedback! You can submit an issue here, [send an email](mailto:steve@100millionbooks.org), or [tweet](https://twitter.com/100millionbooks).

## Install Notes

**None of the install files are signed.** macOS and Windows will complain, but I sign every commit and release here with a GPG key you can verify is mine on [Keybase](https://keybase.io/m52go). 

Furthermore, you can verify the integrity of the install files with the `sig` files bundled in each release.

Thus you can be confident the install files are safe for your computer. If you still aren't, you're welcome to inspect the code yourself and build the program with the steps outlined below.

## Note for Linux Users

If you're on a Debian-based distribution, you'll be better off using the `.deb` binary. The `.AppImage` binary will require you to tweak the startup path (since it's basically a portable program, the OS won't know what file to execute). Otherwise it should work just fine.

## Build it Yourself

To build, make sure you have `npm` and `yarn`.

1. Run `npm install`.
2. Then `yarn`.
3. Make sure build settings in `package.json` are to your liking.
4. Run `yarn dist`. You'll find what you want in `/dist`.