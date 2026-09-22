# Discord Bot Runner (Android)

Runs **your existing Discord bot scripts locally on an Android phone**.

- **Node.js bots** run inside [`nodejs-mobile-react-native`](https://github.com/nodejs-mobile/nodejs-mobile-react-native) (Node 18).
- **Python bots** run inside [Chaquopy](https://chaquo.com/chaquopy/) (Python 3.10).
- A React Native UI lists the scripts, starts/stops them and streams their logs.

> iOS is not supported: it does not allow spawning Node/Python runtimes the way this app does.

---

## 1. Build prerequisites

| Tool | Why | Notes |
| --- | --- | --- |
| **Android Studio** + Android SDK | Builds the APK | Install SDK 35, build-tools 35 |
| **JDK 17** | Required by AGP 8 / Chaquopy | JDK 8 or 21 will fail |
| **Node.js 18–22** | React Native + nodejs-mobile | Node 25 works for JS tooling but is untested |
| **Python 3.10 x64** | Chaquopy compiles/packages requirements | Must match `version = "3.10"` in `android/app/build.gradle` |
| **Android NDK 26.1.10909125** + CMake | Builds `libnode` | Install via Android Studio → SDK Manager |

Set `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) and `ANDROID_NDK_HOME`.

## 2. Install dependencies

```powershell
# app dependencies
npm install

# Node bot runtime dependencies (discord.js)
cd nodejs-assets/nodejs-project
npm install
cd ../..
```

## 3. Run

```powershell
npm run android
# or build a release APK
cd android; ./gradlew assembleRelease
```

The first build is slow: it compiles `libnode` and packages the Python runtime.

## 4. Add your bots

### Node.js

Drop `.js` files into `nodejs-assets/nodejs-project/bots/`, then reinstall that
folder's deps if you added packages, and rebuild.

Each file must export:

```js
module.exports = {
  async start(ctx) {
    // ctx = { token, name, log(line), error(line) }
    // start your bot here; keep it running (login, etc.)
  },
  async stop() {
    // cleanly shut down
  },
};
```

See `bots/example-bot.js` (discord.js).

### Python

Drop `.py` files into `android/app/src/main/python/bots/`, then rebuild.

Each module must expose:

```python
def start(token, emit):
    # blocking call, runs the bot until it stops
    # emit.emit("log line") -> streams to the UI

def stop():
    # optional, request a clean shutdown
```

See `bots/example_bot.py` (discord.py). Add any Python packages your bots need
to the `chaquopy { defaultConfig { pip { ... } } }` block in
`android/app/build.gradle`.

## 5. Security warning

Tokens are kept **in memory only** and are passed to your script at start; they
are not written to disk by this app. A token on a phone is still easy to
extract from a rooted/backed-up device — use a dedicated bot token and rotate
it if leaked. Never commit tokens to the repo.

## 6. Known limitations

- The bot only runs while the app process is alive. A low-priority foreground
  service (`BotKeepAliveService`) is started to keep it running in the
  background, but aggressive OEM battery savers may still kill it. Disable
  battery optimization for this app.
- `armeabi-v7a`, `arm64-v8a` and `x86_64` are the only supported ABIs.
- Some Python packages with native code may not have Chaquopy builds; check the
  build log if `pip` fails.
- New Architecture is disabled (`newArchEnabled=false`) because
  `nodejs-mobile-react-native` does not support it.
