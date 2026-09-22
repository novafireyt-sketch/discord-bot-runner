"""Bridge between the Android app and the bundled Python bots.

The Kotlin PythonRunnerModule calls the functions below. Each bot is a module
inside the ``bots`` package that exposes:

    def start(token, emit) -> None   # blocking, runs until the bot stops
    def stop() -> None               # optional, requests a clean shutdown

``emit`` is a Java object (PythonRunnerModule) with an ``emit(str)`` method,
used to push log lines back to the React Native UI.
"""

import importlib
import io
import json
import pkgutil
import sys
import threading
import traceback

import bots

_running = {}
_lock = threading.Lock()


class _EmitterStream(io.TextIOBase):
    def __init__(self, emit, tag):
        self._emit = emit
        self._tag = tag

    def write(self, text):
        if text and text.strip():
            try:
                self._emit.emit(text.rstrip("\n"))
            except Exception:
                pass
        return len(text)

    def flush(self):
        pass


def list_bots():
    names = []
    for info in pkgutil.iter_modules(bots.__path__):
        if info.name.startswith("_"):
            continue
        names.append({"name": info.name + ".py", "running": info.name in _running})
    return json.dumps(names)


def _run_bot(module_name, token, emit):
    stdout, stderr = sys.stdout, sys.stderr
    sys.stdout = _EmitterStream(emit, "out")
    sys.stderr = _EmitterStream(emit, "err")
    try:
        module = importlib.import_module("bots." + module_name)
        module.start(token, emit)
    except Exception:
        try:
            emit.emit(traceback.format_exc())
        except Exception:
            pass
    finally:
        sys.stdout, sys.stderr = stdout, stderr
        with _lock:
            _running.pop(module_name, None)
        try:
            emit.emit("[%s] stopped" % module_name)
        except Exception:
            pass


def start_bot(name, token, emit):
    module_name = name[:-3] if name.endswith(".py") else name
    with _lock:
        if module_name in _running:
            return "already-running"
        _running[module_name] = True
    thread = threading.Thread(
        target=_run_bot, args=(module_name, token, emit), daemon=True
    )
    thread.start()
    return "started"


def stop_bot(name):
    module_name = name[:-3] if name.endswith(".py") else name
    with _lock:
        if module_name not in _running:
            return "not-running"
    module = sys.modules.get("bots." + module_name)
    if module is not None and hasattr(module, "stop"):
        try:
            module.stop()
            return "stopping"
        except Exception:
            return "stop-error"
    return "unsupported"


def is_running(name):
    module_name = name[:-3] if name.endswith(".py") else name
    return module_name in _running
