#!/usr/bin/env python3
"""Root entry point for the web (pygbag / WebAssembly) and Android (Buildozer) builds.

Both toolchains expect a top-level ``main.py`` that they can execute directly.
pygbag also patches :func:`asyncio.run` so the coroutine drives the browser event
loop.

Desktop users do not need this file: ``python -m src.main`` or the
``pysycache-modern`` console script are the normal way in, and the Debian package
built by ``build-deb.sh`` ships only ``src/`` (this file is never packaged).
"""

import asyncio

from src.main import async_main

asyncio.run(async_main())
