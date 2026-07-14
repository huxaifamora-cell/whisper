package com.whisper.app.fcm

import android.content.Intent
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.whisper.app.data.DeviceRegisterRequest
import com.whisper.app.network.ApiClient
import com.whisper.app.network.Prefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class WhisperFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val prefs = Prefs(applicationContext)
        prefs.pendingFcmToken = token

        // Only bother registering with the backend if the user is actually logged in -
        // otherwise LoginActivity/RulesActivity will register it right after sign-in.
        if (prefs.isLoggedIn()) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    ApiClient.get(applicationContext, prefs).registerDevice(DeviceRegisterRequest(token))
                } catch (_: Exception) {
                    // Best-effort; RulesActivity re-checks this on every app open too.
                }
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val data = message.data
        if (data["type"] != "PRICE_ALERT") return

        // Data-only messages (deliberately, per backend/src/services/fcm.js) always
        // reach this callback even while the app is backgrounded/killed, unlike
        // notification-only messages which the OS can swallow silently.
        val intent = Intent(applicationContext, AlertSoundService::class.java).apply {
            putExtra("symbol", data["symbol"])
            putExtra("timeframe", data["timeframe"])
            putExtra("direction", data["direction"])
            putExtra("target_price", data["target_price"])
            putExtra("price", data["price"])
            putExtra("sound", data["sound"])
            putExtra("rule_id", data["rule_id"])
            putExtra("shared_by", data["shared_by"])
        }

        androidx.core.content.ContextCompat.startForegroundService(applicationContext, intent)
    }
}
