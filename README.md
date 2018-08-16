<img src="https://100millionbooks.org/img/logo-circular-smaller.png" width="100" />

## What is 100 Million Books?

100 Million Books exists to bring serendipity & unrestricted freedom back to book discovery, just like the old days before algorithms took over with social networks and search engines. 

This service also serves as a critique of modern media and the damage it's done to discourse on current affairs. See more at this article [Why](https://medium.com/@100millionbooks/why-332a1c325299) and a more recent one [A More Medium Medium](https://medium.com/@100millionbooks/a-truly-medium-medium-a584208bd622) to learn more about our objectives.

To maximize the integrity of this environment of intellectual freedom, user privacy is a top priority. That's a big reason this source code is open, and we'll continue to open access to other client code bases, server code, and underlying data as we can.

## What does this program do?

Whispers is a desktop client for the 100 Million Books service. It offers discreet notifications of meaningful ideas from random books throughout the day. You'll probably miss most of them, which is intended (we don't want to distract you), but the ones you do notice may open your mind to ideas & inspiration you wouldn't have seen anywhere else.

It's like browsing a bookstore with all the books ever published, right on your laptop, without lifting a finger, while you go about your day.

## Currently in Beta

This program is currently in beta, meaning it's an early release. Although it's been tested across a number of machines, it may not be very stable.

Please send feedback! You can submit an issue here, [send an email](mailto:steve@100millionbooks.org), or [tweet](https://twitter.com/100millionbooks).

## Install Notes

**None of the install files are signed.** macOS and Windows will complain, but I sign every commit and release here with a GPG key which you can verify is mine on [Keybase](https://keybase.io/m52go). 

Furthermore, you can verify the integrity of the install files with the `.sig` files bundled in each release.

Thus you can be confident the install files are safe for your computer. If you still aren't, you're welcome to inspect the code and build the program yourself with the steps outlined below.

## Note for Linux Users

If you're on a Debian-based distribution, you'll be better off using the `.deb` binary. If you use the `.AppImage` binary, the program won't start autoamtically when you log in (unless you manually tweak the startup path...since an `AppImage` is basically a portable program, the OS won't know what file to execute upon logging in unless you specify it).

## Build it Yourself

To build, make sure you have `npm` and `yarn`. The build tool works best with yarn.

1. Run `npm install`.
2. Then `yarn`.
3. Make sure build settings in `package.json` are to your liking.
4. Run `yarn dist`. You'll find what you want in `/dist`.

## Note to Code Snobs

Yes, this program is built with jQuery.

For now, I'm taking a pragmatic stance and focusing on features and growth. I may migrate to React at some point, when complexity demands it, but for now, it works just fine.

## License

Whispers is [free software](https://www.gnu.org/philosophy/free-sw.html), licensed under Version 3 of the [GNU Affero General Public License](https://gnu.org/licenses/agpl.html).

In short, this means you can fork this repository and do anything you'd like with it. If you distribute your changes, you must:

 1. Publish your changes under the same license. This ensures the software remains free.
 2. Use a name that's substantially different from "Whispers" and "100 Million Books" as well as a logo that is not similar to the one at the top of this document. This allows for competition without confusion.

See [LICENSE](LICENSE) for complete details.