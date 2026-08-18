package com.cancerclassifier

import android.app.Activity
import android.content.Context
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import android.os.Build

class AuthModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {

    companion object {
        private const val PREFS_NAME = "oscc_auth"
        private const val PASSWORD_HASH = "password_hash"
        private const val PASSWORD_SALT = "password_salt"

        private const val ITERATIONS = 120_000
        private const val KEY_LENGTH = 256
    }

    private val authenticators =
        BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL

    override fun getName(): String = "Auth"

    private fun preferences() =
        context.getSharedPreferences(
            PREFS_NAME,
            Context.MODE_PRIVATE
        )

    // ---------------------------------------------------------
    // ANDROID DEVICE AUTHENTICATION
    // ---------------------------------------------------------

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

    val activity = getCurrentActivity()

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
                    object : BiometricPrompt.AuthenticationCallback() {

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
                                "$errorCode: $errString"
                            )
                        }

                        override fun onAuthenticationFailed() {
                            // Keep prompt open.
                        }
                    }
                )

            val builder =
                BiometricPrompt.PromptInfo.Builder()
                    .setTitle("")
                    .setSubtitle(
                        "Unlock to access patient data"
                    )
                    .setDescription(
                        "Use your fingerprint, face, or device PIN, pattern, or password."
                    )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {

                // Android 11+
                builder.setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL
                )

            } else {

                // Android 10 and below
                builder.setDeviceCredentialAllowed(true)
            }

            biometricPrompt.authenticate(
                builder.build()
            )

        } catch (e: IllegalArgumentException) {

            promise.reject(
                "AUTH_CONFIGURATION_ERROR",
                "Invalid biometric configuration: ${e.message}",
                e
            )

        } catch (e: Exception) {

            promise.reject(
                "AUTHENTICATION_ERROR",
                "Unable to start authentication: ${e.message}",
                e
            )
        }
    }
}

    // ---------------------------------------------------------
    // OSCC PASSWORD
    // ---------------------------------------------------------

    @ReactMethod
    fun hasPassword(promise: Promise) {
        try {
            val prefs = preferences()

            val exists =
                prefs.contains(PASSWORD_HASH) &&
                prefs.contains(PASSWORD_SALT)

            promise.resolve(exists)

        } catch (e: Exception) {
            promise.reject(
                "PASSWORD_CHECK_ERROR",
                "Unable to check password.",
                e
            )
        }
    }

    @ReactMethod
    fun setPassword(
        password: String,
        promise: Promise
    ) {
        try {

            if (password.length < 6) {
                promise.reject(
                    "PASSWORD_TOO_SHORT",
                    "Password must contain at least 6 characters."
                )
                return
            }

            val salt = ByteArray(32)

            SecureRandom().nextBytes(salt)

            val hash =
                derivePasswordHash(
                    password,
                    salt
                )

            preferences()
                .edit()
                .putString(
                    PASSWORD_SALT,
                    Base64.encodeToString(
                        salt,
                        Base64.NO_WRAP
                    )
                )
                .putString(
                    PASSWORD_HASH,
                    Base64.encodeToString(
                        hash,
                        Base64.NO_WRAP
                    )
                )
                .apply()

            promise.resolve(true)

        } catch (e: Exception) {
            promise.reject(
                "PASSWORD_SETUP_ERROR",
                "Unable to create password.",
                e
            )
        }
    }

    @ReactMethod
    fun verifyPassword(
        password: String,
        promise: Promise
    ) {
        try {

            val prefs = preferences()

            val storedHash =
                prefs.getString(
                    PASSWORD_HASH,
                    null
                )

            val storedSalt =
                prefs.getString(
                    PASSWORD_SALT,
                    null
                )

            if (
                storedHash == null ||
                storedSalt == null
            ) {
                promise.resolve(false)
                return
            }

            val salt =
                Base64.decode(
                    storedSalt,
                    Base64.NO_WRAP
                )

            val expectedHash =
                Base64.decode(
                    storedHash,
                    Base64.NO_WRAP
                )

            val actualHash =
                derivePasswordHash(
                    password,
                    salt
                )

            val matches =
                MessageDigest.isEqual(
                    expectedHash,
                    actualHash
                )

            promise.resolve(matches)

        } catch (e: Exception) {
            promise.reject(
                "PASSWORD_VERIFY_ERROR",
                "Unable to verify password.",
                e
            )
        }
    }

    private fun derivePasswordHash(
        password: String,
        salt: ByteArray
    ): ByteArray {

        val spec =
            PBEKeySpec(
                password.toCharArray(),
                salt,
                ITERATIONS,
                KEY_LENGTH
            )

        return try {

            SecretKeyFactory
                .getInstance(
                    "PBKDF2WithHmacSHA256"
                )
                .generateSecret(spec)
                .encoded

        } finally {
            spec.clearPassword()
        }
    }
}
