# Buildozer configuration for the Android APK build.
#
# This file is only read by Buildozer / python-for-android (see
# .github/workflows/android.yml).  It has no effect on the desktop run, the
# wheel/sdist, or the Debian package produced by build-deb.sh.
#
#   buildozer android debug     ->  bin/pysycachemodern-<version>-debug.apk

[app]
title = PySyCache-Modern
package.name = pysycachemodern
package.domain = org.pysycache

source.dir = .
source.main = main.py
source.include_exts = py,png,jpg,jpeg,ogg,wav,mp3,ttf,txt
source.include_patterns = assets/*, assets/**/*
source.exclude_dirs = tests, legacy-sources, build, bin, dist, .buildozer, .github, .git

# Keep in step with pyproject.toml / build-deb.sh by hand.
version = 0.1.0

requirements = python3, pygame

orientation = landscape
fullscreen = 1
android.presplash_color = #1a3755

android.archs = arm64-v8a, armeabi-v7a
android.allow_backup = 1
android.api = 34
android.minapi = 24
android.accept_sdk_license = True

# --- toolchain pinned to a known-good combo -------------------------------
# Current buildozer pulls NDK r27/r28, which neither classic pygame (Python
# 3.14, removed longintrepr.h) nor CPython 3.11 (grpmodule.c: undeclared
# setgrent/getgrent) will compile against.  Pin python-for-android to its
# 2024.01.21 release, which ships matching CPython 3.11 + pygame recipes and
# NDK r25b.  Pair with buildozer==1.5.0 in the workflows.
android.ndk = 25b
android.build_tools_version = 34.0.0
p4a.fork = kivy
p4a.branch = 2024.01.21

[buildozer]
log_level = 2
warn_on_root = 0
