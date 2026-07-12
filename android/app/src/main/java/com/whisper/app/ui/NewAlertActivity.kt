package com.whisper.app.ui

import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.whisper.app.R
import com.whisper.app.data.NewRuleRequest
import com.whisper.app.data.SymbolCatalog
import com.whisper.app.network.ApiClient
import com.whisper.app.network.Prefs
import kotlinx.coroutines.launch

class NewAlertActivity : AppCompatActivity() {

    private lateinit var prefs: Prefs

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_new_alert)
        prefs = Prefs(this)

        val symbolSpinner = findViewById<Spinner>(R.id.symbolSpinner)
        val timeframeSpinner = findViewById<Spinner>(R.id.timeframeSpinner)
        val directionSpinner = findViewById<Spinner>(R.id.directionSpinner)
        val soundSpinner = findViewById<Spinner>(R.id.soundSpinner)
        val targetPriceInput = findViewById<EditText>(R.id.targetPriceInput)
        val descriptionInput = findViewById<EditText>(R.id.descriptionInput)
        val statusText = findViewById<TextView>(R.id.statusText)
        val createButton = findViewById<Button>(R.id.createButton)

        symbolSpinner.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item,
            SymbolCatalog.symbols.map { it.first }
        )
        timeframeSpinner.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item,
            SymbolCatalog.timeframes
        )
        directionSpinner.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item,
            listOf("buy", "sell")
        )
        soundSpinner.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item,
            listOf("default", "urgent", "chime")
        )

        createButton.setOnClickListener {
            val symbolIndex = symbolSpinner.selectedItemPosition
            val symbolCode = SymbolCatalog.symbols[symbolIndex].second
            val timeframe = timeframeSpinner.selectedItem as String
            val direction = directionSpinner.selectedItem as String
            val sound = soundSpinner.selectedItem as String
            val description = descriptionInput.text.toString().trim().ifBlank { null }
            val priceText = targetPriceInput.text.toString()
            val price = priceText.toDoubleOrNull()

            if (price == null) {
                statusText.text = "Enter a valid target price."
                return@setOnClickListener
            }

            statusText.text = "Creating…"
            lifecycleScope.launch {
                try {
                    val response = ApiClient.get(this@NewAlertActivity, prefs)
                        .createRule(NewRuleRequest(symbolCode, timeframe, price, direction, sound, description))

                    if (response.isSuccessful) {
                        finish()
                    } else {
                        statusText.text = "Couldn't create alert. Check your inputs and try again."
                    }
                } catch (e: Exception) {
                    statusText.text = "Network error: ${e.message}"
                }
            }
        }
    }
}
