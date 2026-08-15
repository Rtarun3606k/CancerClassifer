package com.cancerclassifier

import android.content.res.Configuration
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ThemeModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AndroidTheme"

    @ReactMethod
    fun getTheme(promise: Promise) {
        try {
            val context = reactApplicationContext

            val isDark =
                (context.resources.configuration.uiMode and
                    Configuration.UI_MODE_NIGHT_MASK) ==
                    Configuration.UI_MODE_NIGHT_YES

            val result = Arguments.createMap()

            result.putBoolean("isDark", isDark)

            // Android system colors
            result.putInt(
                "primary",
                context.getColor(android.R.color.system_accent1_600)
            )

            result.putInt(
                "secondary",
                context.getColor(android.R.color.system_accent2_600)
            )

            result.putInt(
                "tertiary",
                context.getColor(android.R.color.system_accent3_600)
            )

            result.putInt(
                "background",
                context.getColor(
                    if (isDark)
                        android.R.color.background_dark
                    else
                        android.R.color.background_light
                )
            )

            result.putInt(
                "onBackground",
                context.getColor(
                    if (isDark)
                        android.R.color.primary_text_dark
                    else
                        android.R.color.primary_text_light
                )
            )

            result.putInt(
                "error",
                context.getColor(android.R.color.holo_red_dark)
            )

            promise.resolve(result)

        } catch (e: Exception) {
            promise.reject(
                "THEME_ERROR",
                "Failed to read Android theme",
                e
            )
        }
    }
}
