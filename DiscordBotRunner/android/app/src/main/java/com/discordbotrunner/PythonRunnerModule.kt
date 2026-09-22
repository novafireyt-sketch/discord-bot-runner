package com.discordbotrunner

import com.chaquo.python.Python
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Runs the bundled Python bots through Chaquopy.
 *
 * All the real work lives in `android/app/src/main/python/dbrunner.py`, which
 * exposes `list_bots()`, `start_bot()`, `stop_bot()` and `is_running()`.
 */
class PythonRunnerModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

    override fun getName(): String = "PythonRunner"

    private fun dbrunner() = Python.getInstance().getModule("dbrunner")

    private fun sendLog(line: String) {
        val payload = Arguments.createMap()
        payload.putString("line", line)
        context
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("python-log", payload)
    }

    // Called from Python (`emit.emit(line)`) to stream bot output to the UI.
    fun emit(line: String) {
        sendLog(line)
    }

    @ReactMethod
    fun listBots(promise: Promise) {
        runCatching { dbrunner().callAttr("list_bots").toString() }
            .onSuccess { promise.resolve(it) }
            .onFailure { promise.reject("python_error", it) }
    }

    @ReactMethod
    fun startBot(name: String, token: String, promise: Promise) {
        runCatching { dbrunner().callAttr("start_bot", name, token, this).toString() }
            .onSuccess { promise.resolve(it) }
            .onFailure { promise.reject("python_error", it) }
    }

    @ReactMethod
    fun stopBot(name: String, promise: Promise) {
        runCatching { dbrunner().callAttr("stop_bot", name).toString() }
            .onSuccess { promise.resolve(it) }
            .onFailure { promise.reject("python_error", it) }
    }

    @ReactMethod
    fun isRunning(name: String, promise: Promise) {
        runCatching { dbrunner().callAttr("is_running", name).toBoolean() }
            .onSuccess { promise.resolve(it) }
            .onFailure { promise.reject("python_error", it) }
    }

    // Required so NativeEventEmitter is happy on Android.
    @ReactMethod
    fun addListener(eventName: String) = Unit

    @ReactMethod
    fun removeListeners(count: Double) = Unit
}
