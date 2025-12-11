package com.dentconnect.mobile.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap

class CacheManager {
    private val cache = ConcurrentHashMap<String, CacheEntry<*>>()
    private val maxAge = 5 * 60 * 1000L

    data class CacheEntry<T>(
        val data: T,
        val timestamp: Long = System.currentTimeMillis()
    ) {
        fun isExpired(maxAge: Long): Boolean {
            return System.currentTimeMillis() - timestamp > maxAge
        }
    }

    suspend fun <T> getOrFetch(
        key: String,
        fetch: suspend () -> T
    ): T = withContext(Dispatchers.IO) {
        val entry = cache[key] as? CacheEntry<T>
        if (entry != null && !entry.isExpired(maxAge)) {
            entry.data
        } else {
            val data = fetch()
            cache[key] = CacheEntry(data)
            data
        }
    }

    fun clear() {
        cache.clear()
    }
}

