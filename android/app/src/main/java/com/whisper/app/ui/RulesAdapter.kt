package com.whisper.app.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.whisper.app.R
import com.whisper.app.data.Rule
import com.whisper.app.data.SymbolCatalog

class RulesAdapter(
    private var rules: List<Rule>,
    private val onDelete: (Rule) -> Unit
) : RecyclerView.Adapter<RulesAdapter.RuleViewHolder>() {

    class RuleViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val symbolText: TextView = view.findViewById(R.id.symbolText)
        val detailsText: TextView = view.findViewById(R.id.detailsText)
        val descriptionText: TextView = view.findViewById(R.id.descriptionText)
        val statusText: TextView = view.findViewById(R.id.statusText)
        val deleteText: TextView = view.findViewById(R.id.deleteText)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RuleViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_rule, parent, false)
        return RuleViewHolder(view)
    }

    override fun onBindViewHolder(holder: RuleViewHolder, position: Int) {
        val rule = rules[position]
        holder.symbolText.text = SymbolCatalog.labelFor(rule.symbol)
        holder.detailsText.text = "${rule.timeframe} → target ${rule.target_price} (${rule.direction})"

        if (!rule.description.isNullOrBlank()) {
            holder.descriptionText.text = "\"${rule.description}\""
            holder.descriptionText.visibility = View.VISIBLE
        } else {
            holder.descriptionText.visibility = View.GONE
        }

        holder.statusText.text = rule.status

        val color = when (rule.status) {
            "active" -> R.color.success
            "triggered" -> R.color.purple_bright
            else -> R.color.text_dim
        }
        holder.statusText.setTextColor(ContextCompat.getColor(holder.itemView.context, color))

        holder.deleteText.setOnClickListener { onDelete(rule) }
    }

    override fun getItemCount(): Int = rules.size

    fun updateData(newRules: List<Rule>) {
        rules = newRules
        notifyDataSetChanged()
    }
}
