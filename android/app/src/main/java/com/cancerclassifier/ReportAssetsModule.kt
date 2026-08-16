package com.cancerclassifier

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayOutputStream

class ReportAssetsModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {

    override fun getName(): String = "ReportAssets"

    @ReactMethod
    fun getLogo(promise: Promise) {
        try {
            val bitmap = BitmapFactory.decodeResource(
                context.resources,
                context.resources.getIdentifier(
                    "oralscan",
                    "drawable",
                    context.packageName
                )
            )

            val output = ByteArrayOutputStream()

            bitmap.compress(
                Bitmap.CompressFormat.PNG,
                100,
                output
            )

            val base64 = Base64.encodeToString(
                output.toByteArray(),
                Base64.NO_WRAP
            )

            promise.resolve("data:image/png;base64,$base64")

        } catch (e: Exception) {
            promise.reject(
                "LOGO_ERROR",
                "Unable to load OralScan logo",
                e
            )
        }
    }
}
