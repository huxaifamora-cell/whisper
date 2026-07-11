package com.whisper.app.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat
import com.whisper.app.R
import com.whisper.app.ui.AlertActivity

// A foreground service is used (rather than just a notification) because it
// lets us actually play a looping sound reliably even while the app is fully
// backgrounded, and gives us a stable place to stop that sound from
// AlertActivity's Dismiss button.
//
// Sound is SYNTHESIZED (via ToneGenerator) rather than a bundled audio file -
// this makes it a genuinely custom Whisper sound with no external asset
// dependency, and lets each "sound" choice (default/urgent/chime) have a
// distinct, easily-recognizable pattern.
class AlertSoundService : Service() {

    private var toneGenerator: ToneGenerator? = null
    private var vibrator: Vibrator? = null
    private val toneHandler = Handler(Looper.getMainLooper())
    private var isPlaying = false

    companion object {
        const val CHANNEL_ID = "whisper_alerts_channel"
        const val NOTIFICATION_ID = 4201
        const val ACTION_STOP = "com.whisper.app.ACTION_STOP_ALERT"
        const val AUTO_STOP_MS = 90_000L
    }

    private val stopHandler = Handler(Looper.getMainLooper())
    private val stopRunnable = Runnable { stopSelf() }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        val symbol = intent?.getStringExtra("symbol") ?: "Unknown symbol"
        val timeframe = intent?.getStringExtra("timeframe") ?: ""
        val direction = intent?.getStringExtra("direction") ?: ""
        val price = intent?.getStringExtra("price") ?: ""
        val targetPrice = intent?.getStringExtra("target_price") ?: ""
        val sound = intent?.getStringExtra("sound") ?: "default"

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification(symbol, timeframe, direction, price, targetPrice))
        playCustomTone(sound)
        vibrate()

        stopHandler.removeCallbacks(stopRunnable)
        stopHandler.postDelayed(stopRunnable, AUTO_STOP_MS)

        return START_NOT_STICKY
    }

    private fun buildNotification(
        symbol: String, timeframe: String, direction: String, price: String, targetPrice: String
    ): android.app.Notification {
        val fullScreenIntent = Intent(this, AlertActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("symbol", symbol)
            putExtra("timeframe", timeframe)
            putExtra("direction", direction)
            putExtra("price", price)
            putExtra("target_price", targetPrice)
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, 0, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("$symbol ($timeframe)")
            .setContentText("Target $targetPrice reached — price now $price ($direction)")
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
                    // Sound is handled by ToneGenerator in this service, not the
                    // channel itself, so the loop/stop control works properly.
                    setSound(null, null)
                }
                manager.createNotificationChannel(channel)
            }
        }
    }

    // Each "sound" choice gets a distinct, recognizable synthesized pattern:
    //  - default: two-tone chime, repeated every ~1.5s
    //  - urgent:  fast triple-beep, repeated every ~0.8s - harder to ignore
    //  - chime:   single soft high tone, repeated every ~2s - gentler
    private fun playCustomTone(sound: String) {
        try {
            toneGenerator = ToneGenerator(AudioManager.STREAM_ALARM, 100)
        } catch (_: Exception) {
            return // Some devices/emulators lack tone generator support; vibration still fires.
        }

        isPlaying = true
        playPattern(sound)
    }

    private fun playPattern(sound: String) {
        if (!isPlaying) return
        val tg = toneGenerator ?: return

        val repeatDelayMs: Long = when (sound) {
            "urgent" -> {
                tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 120)
                toneHandler.postDelayed({ if (isPlaying) tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 120) }, 200)
                toneHandler.postDelayed({ if (isPlaying) tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 120) }, 400)
                800L
            }
            "chime" -> {
                tg.startTone(ToneGenerator.TONE_CDMA_HIGH_L, 400)
                2000L
            }
            else -> { // "default"
                tg.startTone(ToneGenerator.TONE_CDMA_HIGH_SS, 200)
                toneHandler.postDelayed({ if (isPlaying) tg.startTone(ToneGenerator.TONE_CDMA_MED_SS, 200) }, 250)
                1500L
            }
        }

        toneHandler.postDelayed({ playPattern(sound) }, repeatDelayMs)
    }

    private fun stopTone() {
        isPlaying = false
        toneHandler.removeCallbacksAndMessages(null)
        toneGenerator?.release()
        toneGenerator = null
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
        stopTone()
        vibrator?.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
