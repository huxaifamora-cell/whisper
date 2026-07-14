package com.whisper.app.ui

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import com.whisper.app.R
import com.whisper.app.fcm.AlertSoundService

class AlertActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Belt-and-suspenders for showing over the lock screen and waking the
        // screen: the manifest attributes (showWhenLocked/turnScreenOn) cover
        // API 27+, these flags cover older versions too.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }

        setContentView(R.layout.activity_alert)

        val symbol = intent.getStringExtra("symbol") ?: ""
        val timeframe = intent.getStringExtra("timeframe") ?: ""
        val direction = intent.getStringExtra("direction") ?: ""
        val price = intent.getStringExtra("price") ?: ""
        val targetPrice = intent.getStringExtra("target_price") ?: ""
        val sharedBy = intent.getStringExtra("shared_by")

        findViewById<android.widget.TextView>(R.id.alertTitle).text = "$symbol ($timeframe)"
        findViewById<android.widget.TextView>(R.id.alertDetails).text =
            "Target $targetPrice reached — now $price (${direction.uppercase()})"

        val sharedByText = findViewById<android.widget.TextView>(R.id.sharedByText)
        if (!sharedBy.isNullOrBlank()) {
            sharedByText.text = "Shared by $sharedBy"
            sharedByText.visibility = android.view.View.VISIBLE
        } else {
            sharedByText.visibility = android.view.View.GONE
        }

        findViewById<android.widget.Button>(R.id.dismissButton).setOnClickListener {
            stopAlertSound()
            finish()
        }
    }

    override fun onBackPressed() {
        // Prevent dismissing the alarm accidentally with the back button -
        // must use the Dismiss button so the sound is always stopped explicitly.
    }

    private fun stopAlertSound() {
        val stopIntent = Intent(this, AlertSoundService::class.java).apply {
            action = AlertSoundService.ACTION_STOP
        }
        startService(stopIntent)
    }
}
