package com.whisper.app.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.messaging.FirebaseMessaging
import com.whisper.app.R
import com.whisper.app.data.DeviceRegisterRequest
import com.whisper.app.data.Rule
import com.whisper.app.network.ApiClient
import com.whisper.app.network.Prefs
import kotlinx.coroutines.launch

class RulesActivity : AppCompatActivity() {

    private lateinit var prefs: Prefs
    private lateinit var adapter: RulesAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_rules)
        prefs = Prefs(this)

        requestNotificationPermissionIfNeeded()
        ensureFcmTokenRegistered()

        val recyclerView = findViewById<RecyclerView>(R.id.rulesRecyclerView)
        recyclerView.layoutManager = LinearLayoutManager(this)
        adapter = RulesAdapter(emptyList()) { rule -> deleteRule(rule) }
        recyclerView.adapter = adapter

        findViewById<android.widget.TextView>(R.id.logoutText).setOnClickListener {
            prefs.clear()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        findViewById<com.google.android.material.floatingactionbutton.FloatingActionButton>(R.id.addButton)
            .setOnClickListener {
                startActivity(Intent(this, NewAlertActivity::class.java))
            }

        findViewById<android.widget.TextView>(R.id.historyNavText).setOnClickListener {
            startActivity(Intent(this, HistoryActivity::class.java))
        }
        findViewById<android.widget.TextView>(R.id.sharedNavText).setOnClickListener {
            startActivity(Intent(this, SharedActivity::class.java))
        }
    }

    override fun onResume() {
        super.onResume()
        loadRules()
    }

    private fun loadRules() {
        lifecycleScope.launch {
            try {
                val response = ApiClient.get(this@RulesActivity, prefs).getRules()
                if (response.isSuccessful) {
                    val rules = response.body().orEmpty()
                    adapter.updateData(rules)
                    findViewById<android.widget.TextView>(R.id.emptyText).visibility =
                        if (rules.isEmpty()) android.view.View.VISIBLE else android.view.View.GONE
                }
            } catch (_: Exception) {
                // Silently ignore - user can pull to refresh by reopening the screen.
                // A SwipeRefreshLayout could be added here for a nicer UX later.
            }
        }
    }

    private fun deleteRule(rule: Rule) {
        lifecycleScope.launch {
            try {
                ApiClient.get(this@RulesActivity, prefs).deleteRule(rule.id)
                loadRules()
            } catch (_: Exception) {
            }
        }
    }

    private fun ensureFcmTokenRegistered() {
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            if (token != prefs.pendingFcmToken) {
                prefs.pendingFcmToken = token
                lifecycleScope.launch {
                    try {
                        ApiClient.get(this@RulesActivity, prefs).registerDevice(DeviceRegisterRequest(token))
                    } catch (_: Exception) {
                    }
                }
            }
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
            }
        }
    }
}
