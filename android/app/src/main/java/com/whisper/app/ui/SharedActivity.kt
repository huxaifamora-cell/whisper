package com.whisper.app.ui

import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.whisper.app.R
import com.whisper.app.data.Subscription
import com.whisper.app.data.SubscriptionRequest
import com.whisper.app.data.SubscriptionStatusUpdate
import com.whisper.app.network.ApiClient
import com.whisper.app.network.Prefs
import kotlinx.coroutines.launch

class SharedActivity : AppCompatActivity() {

    private lateinit var prefs: Prefs

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_shared)
        prefs = Prefs(this)

        val emailInput = findViewById<EditText>(R.id.ownerEmailInput)
        val statusText = findViewById<TextView>(R.id.requestStatusText)

        BottomNavHelper.setup(this, findViewById(R.id.bottomNav), WhisperTab.SHARED)

        findViewById<Button>(R.id.requestButton).setOnClickListener {
            val email = emailInput.text.toString().trim()
            if (email.isBlank()) {
                statusText.text = "Enter an email address."
                return@setOnClickListener
            }
            statusText.text = "Sending request…"
            lifecycleScope.launch {
                try {
                    val response = ApiClient.get(this@SharedActivity, prefs)
                        .requestSubscription(SubscriptionRequest(email))
                    if (response.isSuccessful) {
                        statusText.text = "✅ Request sent. They need to approve it from their dashboard."
                        statusText.setTextColor(ContextCompat.getColor(this@SharedActivity, R.color.success))
                        emailInput.text.clear()
                        loadOutgoing()
                    } else {
                        statusText.text = "Couldn't send request. Check the email and try again."
                        statusText.setTextColor(ContextCompat.getColor(this@SharedActivity, R.color.danger))
                    }
                } catch (e: Exception) {
                    statusText.text = "Network error: ${e.message}"
                    statusText.setTextColor(ContextCompat.getColor(this@SharedActivity, R.color.danger))
                }
            }
        }

        loadIncoming()
        loadOutgoing()
    }

    private fun loadIncoming() {
        lifecycleScope.launch {
            try {
                val response = ApiClient.get(this@SharedActivity, prefs).getIncomingSubscriptions()
                if (response.isSuccessful) renderIncoming(response.body().orEmpty())
            } catch (_: Exception) {
            }
        }
    }

    private fun loadOutgoing() {
        lifecycleScope.launch {
            try {
                val response = ApiClient.get(this@SharedActivity, prefs).getOutgoingSubscriptions()
                if (response.isSuccessful) renderOutgoing(response.body().orEmpty())
            } catch (_: Exception) {
            }
        }
    }

    private fun renderIncoming(items: List<Subscription>) {
        val container = findViewById<LinearLayout>(R.id.incomingContainer)
        container.removeAllViews()

        if (items.isEmpty()) {
            container.addView(makeEmptyText())
            return
        }

        for (item in items) {
            container.addView(buildRow(
                title = item.subscriber_email ?: "",
                status = item.status,
                actions = buildList {
                    if (item.status == "pending") add("Approve" to { updateSubscription(item.id, "approved") { loadIncoming() } })
                    if (item.status != "revoked") add("Revoke" to { updateSubscription(item.id, "revoked") { loadIncoming() } })
                }
            ))
        }
    }

    private fun renderOutgoing(items: List<Subscription>) {
        val container = findViewById<LinearLayout>(R.id.outgoingContainer)
        container.removeAllViews()

        if (items.isEmpty()) {
            container.addView(makeEmptyText())
            return
        }

        for (item in items) {
            container.addView(buildRow(
                title = item.owner_email ?: "",
                status = item.status,
                actions = buildList {
                    if (item.status != "revoked") add("Cancel" to { updateSubscription(item.id, "revoked") { loadOutgoing() } })
                }
            ))
        }
    }

    private fun updateSubscription(id: Int, status: String, onDone: () -> Unit) {
        lifecycleScope.launch {
            try {
                ApiClient.get(this@SharedActivity, prefs).updateSubscription(id, SubscriptionStatusUpdate(status))
                onDone()
            } catch (_: Exception) {
            }
        }
    }

    private fun makeEmptyText(): TextView = TextView(this).apply {
        text = "None yet."
        setTextColor(ContextCompat.getColor(this@SharedActivity, R.color.text_dim))
        textSize = 13f
        setPadding(4, 4, 4, 16)
    }

    private fun buildRow(title: String, status: String, actions: List<Pair<String, () -> Unit>>): LinearLayout {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundResource(R.drawable.input_background)
            setPadding(28, 24, 28, 24)
            val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            params.setMargins(0, 0, 0, 12)
            layoutParams = params
        }

        val textContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        textContainer.addView(TextView(this).apply {
            text = title
            setTextColor(ContextCompat.getColor(this@SharedActivity, R.color.text_primary))
            textSize = 14f
        })
        val statusColor = when (status) {
            "approved" -> R.color.success
            "pending" -> R.color.purple_bright
            else -> R.color.text_dim
        }
        textContainer.addView(TextView(this).apply {
            text = status
            setTextColor(ContextCompat.getColor(this@SharedActivity, statusColor))
            textSize = 12f
        })
        row.addView(textContainer)

        for ((label, action) in actions) {
            row.addView(TextView(this).apply {
                text = label
                setTextColor(ContextCompat.getColor(this@SharedActivity,
                    if (label == "Approve") R.color.success else R.color.danger))
                textSize = 13f
                setPadding(16, 8, 16, 8)
                setOnClickListener { action() }
            })
        }

        return row
    }
}
