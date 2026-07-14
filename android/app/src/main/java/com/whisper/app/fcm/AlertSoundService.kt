package com.whisper.app.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat
import com.whisper.app.R
import com.whisper.app.data.SymbolCatalog
import com.whisper.app.ui.AlertActivity

// A foreground service is used (rather than just a notification) because it
// lets us actually play a looping sound reliably even while the app is fully
// backgrounded, and gives us a stable place to stop that sound from
// AlertActivity's Dismiss button.
//
// Sound is the bundled res/raw/alert_tone.wav, looped continuously for
// exactly ALERT_DURATION_MS, then stopped automatically.
class AlertSoundService : Service() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null

    companion object {
        const val CHANNEL_ID = "whisper_alerts_channel"
        const val NOTIFICATION_ID = 4201
        const val ACTION_STOP = "com.whisper.app.ACTION_STOP_ALERT"
        // The tone loops for exactly this long, then stops automatically so a
        // missed alert doesn't ring forever and drain the battery.
        const val ALERT_DURATION_MS = 45_000L
    }

    private val stopHandler = Handler(Looper.getMainLooper())
    private val stopRunnable = Runnable { stopSelf() }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        val symbolCode = intent?.getStringExtra("symbol") ?: ""
        val symbolLabel = SymbolCatalog.labelFor(symbolCode)
        val timeframe = intent?.getStringExtra("timeframe") ?: ""
        val direction = intent?.getStringExtra("direction") ?: ""
        val price = intent?.getStringExtra("price") ?: ""
        val targetPrice = intent?.getStringExtra("target_price") ?: ""
        val sharedBy = intent?.getStringExtra("shared_by")

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification(symbolLabel, timeframe, direction, price, targetPrice, sharedBy))
        playAlertTone()
        vibrate()

        stopHandler.removeCallbacks(stopRunnable)
        stopHandler.postDelayed(stopRunnable, ALERT_DURATION_MS)

        return START_NOT_STICKY
    }

    private fun buildNotification(
        symbolLabel: String, timeframe: String, direction: String, price: String, targetPrice: String, sharedBy: String?
    ): android.app.Notification {
        val fullScreenIntent = Intent(this, AlertActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("symbol", symbolLabel)
            putExtra("timeframe", timeframe)
            putExtra("direction", direction)
            putExtra("price", price)
            putExtra("target_price", targetPrice)
            putExtra("shared_by", sharedBy)
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, 0, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val bodyText = if (!sharedBy.isNullOrBlank()) {
            "Target $targetPrice reached — price now $price ($direction) — shared by $sharedBy"
        } else {
            "Target $targetPrice reached — price now $price ($direction)"
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("$symbolLabel ($timeframe)")
            .setContentText(bodyText)
            .setStyle(NotificationCompat.BigTextStyle().bigText(bodyText))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .setAutoCancel(true)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID, "Whisper Price Alerts", NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Alerts when your target price is hit"
                    enableVibration(true)
                    // Sound is handled by MediaPlayer in this service, not the
                    // channel itself, so the loop/stop control works properly.
                    setSound(null, null)
                }
                manager.createNotificationChannel(channel)
            }
        }
    }

    private fun playAlertTone() {
        try {
            mediaPlayer = MediaPlayer.create(this, R.raw.alert_tone).apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                start()
            }
        } catch (_: Exception) {
            // If playback fails for any reason, fail silently rather than
            // crashing the service - vibration still fires as a fallback.
        }
    }

    private fun vibrate() {
        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        val pattern = longArrayOf(0, 500, 500)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern, 0)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopHandler.removeCallbacks(stopRunnable)
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
        vibrator?.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
