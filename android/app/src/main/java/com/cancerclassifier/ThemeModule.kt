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

            // Primary
            result.putInt(
                "primary",
                context.getColor(
                    if (isDark)
                        android.R.color.system_accent1_200
                    else
                        android.R.color.system_accent1_600
                )
            )

            // Primary container
            result.putInt(
                "primaryContainer",
                context.getColor(
                    if (isDark)
                        android.R.color.system_accent1_800
                    else
                        android.R.color.system_accent1_100
                )
            )

            // Text/icon on primary
            result.putInt(
                "onPrimary",
                context.getColor(
                    if (isDark)
                        android.R.color.primary_text_dark
                    else
                        android.R.color.primary_text_light
                )
            )

            // Secondary
            result.putInt(
                "secondary",
                context.getColor(
                    if (isDark)
                        android.R.color.system_accent2_200
                    else
                        android.R.color.system_accent2_600
                )
            )

            // Tertiary
            result.putInt(
                "tertiary",
                context.getColor(
                    if (isDark)
                        android.R.color.system_accent3_200
                    else
                        android.R.color.system_accent3_600
                )
            )

            // Background
            result.putInt(
                "background",
                context.getColor(
                    if (isDark)
                        android.R.color.background_dark
                    else
                        android.R.color.background_light
                )
            )

            // Text on background
            result.putInt(
                "onBackground",
                context.getColor(
                    if (isDark)
                        android.R.color.primary_text_dark
                    else
                        android.R.color.primary_text_light
                )
            )

            // Surface
            result.putInt(
                "surface",
                context.getColor(
                    if (isDark)
                        android.R.color.background_dark
                    else
                        android.R.color.background_light
                )
            )

            // Text on surface
            result.putInt(
                "onSurface",
                context.getColor(
                    if (isDark)
                        android.R.color.primary_text_dark
                    else
                        android.R.color.primary_text_light
                )
            )

            // Secondary text
            result.putInt(
                "onSurfaceVariant",
                context.getColor(
                    if (isDark)
                        android.R.color.secondary_text_dark
                    else
                        android.R.color.secondary_text_light
                )
            )

            // Error
            result.putInt(
                "error",
                context.getColor(
                    android.R.color.holo_red_dark
                )
            )

            // Error container
            result.putInt(
                "errorContainer",
                context.getColor(
                    if (isDark)
                        android.R.color.holo_red_dark
                    else
                        android.R.color.holo_red_light
                )
            )

            // Text on error container
            result.putInt(
                "onErrorContainer",
                context.getColor(
                    if (isDark)
                        android.R.color.primary_text_dark
                    else
                        android.R.color.primary_text_light
                )
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
