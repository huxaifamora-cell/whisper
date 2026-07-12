package com.whisper.app.ui

import android.app.Activity
import android.content.Intent
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.whisper.app.R

enum class WhisperTab { ALERTS, HISTORY, SHARED }

object BottomNavHelper {

    fun setup(activity: Activity, bottomNav: BottomNavigationView, current: WhisperTab) {
        bottomNav.selectedItemId = when (current) {
            WhisperTab.ALERTS -> R.id.nav_alerts
            WhisperTab.HISTORY -> R.id.nav_history
            WhisperTab.SHARED -> R.id.nav_shared
        }

        bottomNav.setOnItemSelectedListener { item ->
            val target: Class<*>? = when (item.itemId) {
                R.id.nav_alerts -> if (current != WhisperTab.ALERTS) RulesActivity::class.java else null
                R.id.nav_history -> if (current != WhisperTab.HISTORY) HistoryActivity::class.java else null
                R.id.nav_shared -> if (current != WhisperTab.SHARED) SharedActivity::class.java else null
                else -> null
            }

            if (target != null) {
                activity.startActivity(Intent(activity, target).apply {
                    flags = Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                })
                activity.overridePendingTransition(0, 0)
            }
            true
        }
    }
}
