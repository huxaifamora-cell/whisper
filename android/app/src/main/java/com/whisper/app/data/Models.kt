package com.whisper.app.data

data class RegisterRequest(val email: String, val password: String)
data class LoginRequest(val email: String, val password: String)

data class User(
    val id: Int,
    val email: String,
    val pairing_code: String? = null
)

data class AuthResponse(
    val token: String,
    val user: User
)

data class Rule(
    val id: Int,
    val symbol: String,
    val timeframe: String,
    val target_price: String,
    val direction: String,
    val sound: String,
    val description: String? = null,
    val status: String,
    val created_at: String
)

data class NewRuleRequest(
    val symbol: String,
    val timeframe: String,
    val target_price: Double,
    val direction: String,
    val sound: String = "default",
    val description: String? = null
)

data class HistoryItem(
    val id: Int,
    val symbol: String,
    val price: String,
    val direction: String,
    val dispatched_telegram: Boolean,
    val dispatched_fcm: Boolean,
    val created_at: String
)

data class SubscriptionRequest(val owner_email: String)

data class Subscription(
    val id: Int,
    val status: String,
    val created_at: String,
    val subscriber_email: String? = null,
    val owner_email: String? = null
)

data class SubscriptionStatusUpdate(val status: String)

data class DeviceRegisterRequest(val fcm_token: String)

data class ApiError(val error: String)

// Mirrors backend/src/constants/symbols.js SYMBOL_LABELS - keep in sync.
object SymbolCatalog {
    // Pair of (display label, Whisper code)
    val symbols: List<Pair<String, String>> = listOf(
        "Volatility 10 Index" to "R_10",
        "Volatility 25 Index" to "R_25",
        "Volatility 50 Index" to "R_50",
        "Volatility 75 Index" to "R_75",
        "Volatility 100 Index" to "R_100",
        "Volatility 10 (1s) Index" to "1HZ10V",
        "Volatility 15 (1s) Index" to "1HZ15V",
        "Volatility 25 (1s) Index" to "1HZ25V",
        "Volatility 30 (1s) Index" to "1HZ30V",
        "Volatility 50 (1s) Index" to "1HZ50V",
        "Volatility 75 (1s) Index" to "1HZ75V",
        "Volatility 90 (1s) Index" to "1HZ90V",
        "Volatility 100 (1s) Index" to "1HZ100V",
        "Volatility 5 Index (MT5 bridge)" to "MT5_VOL5",
        "Volatility 15 Index (MT5 bridge)" to "MT5_VOL15",
        "Volatility 30 Index (MT5 bridge)" to "MT5_VOL30",
        "Volatility 90 Index (MT5 bridge)" to "MT5_VOL90",
        "Volatility 5 (1s) Index (MT5 bridge)" to "MT5_VOL5_1S",
        "Volatility 150 (1s) Index (MT5 bridge)" to "MT5_VOL150_1S",
        "Volatility 250 (1s) Index (MT5 bridge)" to "MT5_VOL250_1S"
    )

    fun labelFor(code: String): String =
        symbols.firstOrNull { it.second == code }?.first ?: code

    val timeframes = listOf(
        "M1", "M5", "M10", "M15", "M30",
        "H1", "H2", "H4", "H6", "H12",
        "D1", "W1", "MN1"
    )
}
