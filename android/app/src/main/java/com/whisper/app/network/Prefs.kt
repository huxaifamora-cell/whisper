package com.whisper.app.network

import android.content.Context
import android.content.SharedPreferences

class Prefs(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("whisper_prefs", Context.MODE_PRIVATE)

    var token: String?
        get() = prefs.getString("token", null)
        set(value) = prefs.edit().putString("token", value).apply()

    var userEmail: String?
        get() = prefs.getString("user_email", null)
        set(value) = prefs.edit().putString("user_email", value).apply()

    var pendingFcmToken: String?
        get() = prefs.getString("pending_fcm_token", null)
        set(value) = prefs.edit().putString("pending_fcm_token", value).apply()

    fun isLoggedIn(): Boolean = !token.isNullOrEmpty()

    fun clear() = prefs.edit().clear().apply()
}
