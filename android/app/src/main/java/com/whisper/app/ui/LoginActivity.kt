package com.whisper.app.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.firebase.messaging.FirebaseMessaging
import com.whisper.app.R
import com.whisper.app.data.LoginRequest
import com.whisper.app.data.RegisterRequest
import com.whisper.app.network.ApiClient
import com.whisper.app.network.Prefs
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var prefs: Prefs

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)

        if (prefs.isLoggedIn()) {
            goToRules()
            return
        }

        setContentView(R.layout.activity_login)

        val emailInput = findViewById<android.widget.EditText>(R.id.emailInput)
        val passwordInput = findViewById<android.widget.EditText>(R.id.passwordInput)
        val statusText = findViewById<android.widget.TextView>(R.id.statusText)
        val loginButton = findViewById<android.widget.Button>(R.id.loginButton)
        val registerButton = findViewById<android.widget.Button>(R.id.registerButton)

        loginButton.setOnClickListener {
            submit(emailInput.text.toString(), passwordInput.text.toString(), statusText, isRegister = false)
        }
        registerButton.setOnClickListener {
            submit(emailInput.text.toString(), passwordInput.text.toString(), statusText, isRegister = true)
        }
    }

    private fun submit(email: String, password: String, statusText: android.widget.TextView, isRegister: Boolean) {
        if (email.isBlank() || password.isBlank()) {
            statusText.text = "Enter both email and password."
            return
        }

        statusText.text = "Please wait…"
        val api = ApiClient.get(this, prefs)

        lifecycleScope.launch {
            try {
                val response = if (isRegister) {
                    api.register(RegisterRequest(email, password))
                } else {
                    api.login(LoginRequest(email, password))
                }

                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    prefs.token = body.token
                    prefs.userEmail = body.user.email
                    registerFcmTokenIfNeeded()
                    goToRules()
                } else {
                    statusText.text = "Login failed. Check your email and password."
                }
            } catch (e: Exception) {
                statusText.text = "Network error: ${e.message}"
            }
        }
    }

    private fun registerFcmTokenIfNeeded() {
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            prefs.pendingFcmToken = token
            lifecycleScope.launch {
                try {
                    ApiClient.get(this@LoginActivity, prefs)
                        .registerDevice(com.whisper.app.data.DeviceRegisterRequest(token))
                } catch (_: Exception) {
                    // Will retry next app open via RulesActivity.onCreate
                }
            }
        }
    }

    private fun goToRules() {
        startActivity(Intent(this, RulesActivity::class.java))
        finish()
    }
}
