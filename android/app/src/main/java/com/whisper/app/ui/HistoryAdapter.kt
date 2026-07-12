package com.whisper.app.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.whisper.app.R
import com.whisper.app.data.HistoryItem
import com.whisper.app.data.SymbolCatalog

class HistoryAdapter(private var items: List<HistoryItem>) :
    RecyclerView.Adapter<HistoryAdapter.HistoryViewHolder>() {

    class HistoryViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val symbolText: TextView = view.findViewById(R.id.symbolText)
        val detailsText: TextView = view.findViewById(R.id.detailsText)
        val whenText: TextView = view.findViewById(R.id.whenText)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HistoryViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_history, parent, false)
        return HistoryViewHolder(view)
    }

    override fun onBindViewHolder(holder: HistoryViewHolder, position: Int) {
        val item = items[position]
        holder.symbolText.text = SymbolCatalog.labelFor(item.symbol)

        val sentVia = listOfNotNull(
            if (item.dispatched_telegram) "Telegram" else null,
            if (item.dispatched_fcm) "App" else null
        ).joinToString(" + ").ifBlank { "—" }

        holder.detailsText.text = "Price ${item.price} (${item.direction}) — sent via $sentVia"
        holder.whenText.text = item.created_at
    }

    override fun getItemCount(): Int = items.size

    fun updateData(newItems: List<HistoryItem>) {
        items = newItems
        notifyDataSetChanged()
    }
}
