package com.cancerclassifier

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class ONNXModelModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ONNXModel"
    }

    @ReactMethod
    fun getModelPath(promise: Promise) {
        try {
            val modelName = "mobilenetv3_oral_cancer.onnx"
            val outputFile = File(
                reactApplicationContext.cacheDir,
                modelName
            )

            if (!outputFile.exists()) {
                val inputStream = reactApplicationContext.resources.openRawResource(
                    R.raw.mobilenetv3_oral_cancer
                )

                inputStream.use { input ->
                    outputFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
            }

            promise.resolve(outputFile.absolutePath)

        } catch (e: Exception) {
            promise.reject(
                "MODEL_ERROR",
                "Failed to copy ONNX model: ${e.message}",
                e
            )
        }
    }
}
