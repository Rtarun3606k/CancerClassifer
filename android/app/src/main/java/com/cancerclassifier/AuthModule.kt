package com.cancerclassifier

import android.app.Activity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AuthModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {

    override fun getName(): String = "Auth"

    private val authenticators =
        BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL

    @ReactMethod
    fun canAuthenticate(promise: Promise) {
        try {
            val manager =
                BiometricManager.from(context)

            val result =
                manager.canAuthenticate(authenticators)

            promise.resolve(
                result == BiometricManager.BIOMETRIC_SUCCESS
            )

        } catch (e: Exception) {
            promise.reject(
                "BIOMETRIC_CHECK_ERROR",
                "Unable to check device authentication.",
                e
            )
        }
    }

    @ReactMethod
    fun authenticate(promise: Promise) {

        val activity: Activity? =
            getCurrentActivity()

        if (activity == null) {
            promise.reject(
                "NO_ACTIVITY",
                "No current Android activity."
            )
            return
        }

        if (activity !is FragmentActivity) {
            promise.reject(
                "INVALID_ACTIVITY",
                "Current activity is not a FragmentActivity."
            )
            return
        }

        activity.runOnUiThread {

            try {

                val executor =
                    ContextCompat.getMainExecutor(activity)

                val biometricPrompt =
                    BiometricPrompt(
                        activity,
                        executor,
                        object :
                            BiometricPrompt.AuthenticationCallback() {

                            override fun onAuthenticationSucceeded(
                                result: BiometricPrompt.AuthenticationResult
                            ) {
                                promise.resolve(true)
                            }

                            override fun onAuthenticationError(
                                errorCode: Int,
                                errString: CharSequence
                            ) {
                                promise.reject(
                                    "AUTH_ERROR",
                                    errString.toString()
                                )
                            }

                            override fun onAuthenticationFailed() {
                                // Keep the prompt open.
                                // User can try again.
                            }
                        }
                    )

                val promptInfo =
                    BiometricPrompt.PromptInfo.Builder()
                        .setTitle("OSCC")
                        .setSubtitle(
                            "Unlock to access patient data"
                        )
                        .setDescription(
                            "Authenticate using biometrics or your device screen lock."
                        )
                        .setAllowedAuthenticators(
                            authenticators
                        )
                        .build()

                biometricPrompt.authenticate(
                    promptInfo
                )

            } catch (e: Exception) {

                promise.reject(
                    "AUTHENTICATION_ERROR",
                    "Unable to start authentication.",
                    e
                )
            }
        }
    }
}
