#!/usr/bin/env bash
# Launch the Python game on the Android screen from Termux, via Termux:X11.
#
# One-time setup:
#   1. pkg install python-pygame termux-x11-nightly xorg-xdpyinfo
#      (python-pygame is in the TUR repo: pkg install tur-repo first)
#   2. Install the *Termux:X11* companion app -- it is NOT on the Play Store:
#      https://github.com/termux/termux-x11/releases/tag/nightly
#      download "termux-x11-universal-debug.apk" and install it.
#
# Then, from the repo root:   ./run-android.sh   [--fullscreen] [--level easy]
set -e
cd "$(dirname "$0")"

export DISPLAY=:0
export SDL_VIDEODRIVER=x11
# touch -> mouse, and give SDL a sane default
export SDL_MOUSE_TOUCH_EVENTS=1

# start the X server if it isn't up
if ! xdpyinfo >/dev/null 2>&1; then
  echo ">> starting Termux:X11 server on :0"
  termux-x11 :0 >/dev/null 2>&1 &
  # open the Termux:X11 activity so the server has a surface to draw to
  am start --user 0 -n com.termux.x11/com.termux.x11.MainActivity >/dev/null 2>&1 \
    || termux-am start --user 0 -n com.termux.x11/com.termux.x11.MainActivity >/dev/null 2>&1 \
    || echo "!! open the Termux:X11 app manually now"
  # wait for it
  for i in $(seq 1 30); do xdpyinfo >/dev/null 2>&1 && break; sleep 0.5; done
fi

echo ">> launching PySyCache-Modern  (Esc = menu/back, Tab = next theme)"
exec python -m src.main "$@"
