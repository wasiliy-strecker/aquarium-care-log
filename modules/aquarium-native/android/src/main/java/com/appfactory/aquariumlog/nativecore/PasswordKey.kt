package com.appfactory.aquariumlog.nativecore

import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

internal object PasswordKey {
    fun derive(password: String, saltHex: String, iterations: Int): String {
        require(saltHex.matches(Regex("[a-f0-9]{32}")))
        require(iterations == 600000)
        require(password.length <= 1024)
        val salt = saltHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
        val chars = password.toCharArray()
        val specification = PBEKeySpec(chars, salt, iterations, 256)
        try {
            val key = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(specification).encoded
            try { return key.joinToString("") { "%02x".format(it.toInt() and 255) } }
            finally { key.fill(0) }
        } finally { chars.fill('\u0000'); specification.clearPassword() }
    }
}
