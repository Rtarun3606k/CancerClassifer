package com.cancerclassifier

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class SharePdfModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {

    override fun getName(): String = "SharePdf"

    @ReactMethod
    fun share(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)

            if (!file.exists()) {
                promise.reject(
                    "FILE_NOT_FOUND",
                    "PDF does not exist: $filePath"
                )
                return
            }

            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )

            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(
                intent,
                "Share OralScan Report"
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            context.startActivity(chooser)

            promise.resolve(true)

        } catch (e: Exception) {
            promise.reject(
                "SHARE_ERROR",
                "Unable to share PDF",
                e
            )
        }
    }



    @ReactMethod
fun open(filePath: String, promise: Promise) {
    try {
        val file = File(filePath)

        if (!file.exists()) {
            promise.reject(
                "FILE_NOT_FOUND",
                "PDF does not exist: $filePath"
            )
            return
        }

        val uri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(
                uri,
                "application/pdf"
            )

            addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )

            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
            )
        }

        context.startActivity(intent)

        promise.resolve(true)

    } catch (e: android.content.ActivityNotFoundException) {
        promise.reject(
            "NO_PDF_VIEWER",
            "No PDF viewer is installed on this device.",
            e
        )

    } catch (e: Exception) {
        promise.reject(
            "OPEN_ERROR",
            "Unable to open PDF.",
            e
        )
    }
}


@ReactMethod
fun openAudio(filePath: String, promise: Promise) {
    try {
        val file = File(filePath)

        if (!file.exists()) {
            promise.reject(
                "FILE_NOT_FOUND",
                "Audio does not exist: $filePath"
            )
            return
        }

        val uri: Uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )

        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "audio/wav")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        context.startActivity(intent)

        promise.resolve(true)

    } catch (e: Exception) {
        promise.reject(
            "OPEN_AUDIO_ERROR",
            "Unable to open audio",
            e
        )
    }
}
}
