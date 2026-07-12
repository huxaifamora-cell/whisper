package com.whisper.app.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.whisper.app.R
import com.whisper.app.network.ApiClient
import com.whisper.app.network.Prefs
import kotlinx.coroutines.launch

class HistoryActivity : AppCompatActivity() {

    private lateinit var prefs: Prefs

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_history)
        prefs = Prefs(this)

        val recyclerView = findViewById<RecyclerView>(R.id.historyRecyclerView)
        recyclerView.layoutManager = LinearLayoutManager(this)
        val adapter = HistoryAdapter(emptyList())
        recyclerView.adapter = adapter

        BottomNavHelper.setup(this, findViewById(R.id.bottomNav), WhisperTab.HISTORY)

        lifecycleScope.launch {
            try {
                val response = ApiClient.get(this@HistoryActivity, prefs).getHistory()
                if (response.isSuccessful) {
                    val items = response.body().orEmpty()
                    adapter.updateData(items)
                    findViewById<android.widget.TextView>(R.id.emptyText).visibility =
                        if (items.isEmpty()) android.view.View.VISIBLE else android.view.View.GONE
                }
            } catch (_: Exception) {
            }
        }
    }
}
