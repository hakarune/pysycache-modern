#!/usr/bin/env bash
#
# build-deb.sh - build a standalone .deb for PySyCache-Modern.
#
# This does NOT need debhelper or a source package: it stages a file tree under
# build/deb/ and calls dpkg-deb --build.  The resulting package installs the game
# to /usr/share/pysycache-modern, drops a launcher in /usr/games/pysycache-modern
# and a menu entry in /usr/share/applications.
#
# Usage:  ./build-deb.sh [version]
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

PKG="pysycache-modern"
VERSION="${1:-$(grep -m1 '^version' pyproject.toml | sed 's/.*"\(.*\)".*/\1/')}"
VERSION="${VERSION:-0.1.0}"
ARCH="all"
MAINTAINER="${DEBFULLNAME:-PySyCache-Modern contributors} <${DEBEMAIL:-pysycache-modern@example.org}>"

STAGE="build/deb/${PKG}_${VERSION}_${ARCH}"
SHARE="$STAGE/usr/share/$PKG"
DOCDIR="$STAGE/usr/share/doc/$PKG"

echo ">> Cleaning previous staging tree"
rm -rf "$STAGE"
mkdir -p "$SHARE" "$DOCDIR" \
         "$STAGE/DEBIAN" \
         "$STAGE/usr/games" \
         "$STAGE/usr/share/applications" \
         "$STAGE/usr/share/pixmaps"

echo ">> Copying application files"
cp -r src assets pyproject.toml README.md LICENSE "$SHARE/"
# Drop caches from the copy.
find "$SHARE" -name '__pycache__' -type d -prune -exec rm -rf {} +

INSTALLED_KB="$(du -ks "$STAGE/usr" | cut -f1)"

echo ">> Writing launcher"
cat > "$STAGE/usr/games/$PKG" <<EOF
#!/bin/sh
exec python3 -m src.main "\$@"
EOF
chmod 0755 "$STAGE/usr/games/$PKG"
# The launcher runs from the install dir so 'python3 -m src.main' resolves.
sed -i "1a cd /usr/share/$PKG || exit 1" "$STAGE/usr/games/$PKG"

echo ">> Writing desktop entry"
if [ -f "assets/images/pysycache-48x48.png" ]; then
    cp assets/images/pysycache-48x48.png "$STAGE/usr/share/pixmaps/$PKG.png"
fi
cat > "$STAGE/usr/share/applications/$PKG.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=PySyCache-Modern
Comment=Learn to use the mouse - a game for young children
Exec=$PKG
Icon=$PKG
Terminal=false
Categories=Game;KidsGame;Education;
EOF

echo ">> Writing packaging metadata"
cp LICENSE "$DOCDIR/copyright"
cat > "$DOCDIR/changelog" <<EOF
$PKG ($VERSION) unstable; urgency=low

  * Standalone build produced by build-deb.sh.

 -- $MAINTAINER  $(date -R)
EOF
gzip -9n "$DOCDIR/changelog"

cat > "$STAGE/DEBIAN/control" <<EOF
Package: $PKG
Version: $VERSION
Section: games
Priority: optional
Architecture: $ARCH
Depends: python3 (>= 3.10), python3-pygame (>= 2.4) | python3-pygame-ce (>= 2.4)
Installed-Size: $INSTALLED_KB
Maintainer: $MAINTAINER
Description: Python 3 / pygame-ce port of PySyCache, the mouse-training suite
 PySyCache-Modern helps young children learn to use a mouse through five
 activities: moving the pointer, single-clicking, double-clicking, drag and
 drop, and pressing buttons.  This is a modern port of the classic PySyCache.
EOF

echo ">> Building package"
mkdir -p build/deb/out
if command -v dpkg-deb >/dev/null 2>&1; then
    dpkg-deb --root-owner-group --build "$STAGE" "build/deb/out/${PKG}_${VERSION}_${ARCH}.deb"
    echo ">> Done: build/deb/out/${PKG}_${VERSION}_${ARCH}.deb"
else
    echo "!! dpkg-deb not found - staging tree left at $STAGE" >&2
    exit 1
fi
