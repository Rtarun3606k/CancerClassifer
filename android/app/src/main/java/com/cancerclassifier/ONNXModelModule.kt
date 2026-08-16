package com.cancerclassifier

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream

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



    @ReactMethod
fun getAudioModelPath(promise: Promise) {
    try {
        val modelFile =
            File(
                reactApplicationContext.cacheDir,
                "audio_model.onnx"
            )

        if (!modelFile.exists()) {
            reactApplicationContext.resources
                .openRawResource(
                    reactApplicationContext.resources
                        .getIdentifier(
                            "audio_model",
                            "raw",
                            reactApplicationContext.packageName
                        )
                )
                .use { input ->
                    FileOutputStream(modelFile)
                        .use { output ->
                            input.copyTo(output)
                        }
                }
        }

        promise.resolve(
            modelFile.absolutePath
        )
    } catch (e: Exception) {
        promise.reject(
            "AUDIO_MODEL_ERROR",
            "Failed to load audio model",
            e
        )
    }
}
}
