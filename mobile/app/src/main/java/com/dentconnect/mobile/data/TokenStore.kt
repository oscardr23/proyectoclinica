package com.dentconnect.mobile.data

import android.content.Context
import androidx.core.content.edit

class TokenStore(context: Context) {
    private val prefs = context.getSharedPreferences("dentconnect-store", Context.MODE_PRIVATE)

    var accessToken: String?
        get() = prefs.getString("access_token", null)
        set(value) {
            prefs.edit { putString("access_token", value) }
        }
}

